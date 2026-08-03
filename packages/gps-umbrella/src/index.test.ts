import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createUmbrellaProvider,
  fullJitterDelayMs,
  parseRetryAfterMs,
  _resetRateLimitForTests,
  acquireToken,
  ingestEvidenceForTrip,
} from "./index.js";

describe("UmbrellaGpsProvider", () => {
  it("crea proveedor con nombre umbrella", () => {
    const provider = createUmbrellaProvider({
      baseUrl: "http://gps2.umbrellasoluciones.com",
      credentials: { userId: "u", password: "p" },
    });
    expect(provider.name).toBe("umbrella");
  });
});

describe("rate-limit helpers", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("parseRetryAfterMs seconds and date", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs(null)).toBeNull();
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(8000);
  });

  it("fullJitterDelayMs stays within cap", () => {
    for (let i = 0; i < 20; i++) {
      const d = fullJitterDelayMs(10, { baseMs: 1000, capMs: 5000 });
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(5000);
    }
  });

  it("acquireToken resolves under capacity", async () => {
    const t0 = Date.now();
    await acquireToken("test-bucket", { capacity: 2, refillPerMinute: 60 });
    await acquireToken("test-bucket", { capacity: 2, refillPerMinute: 60 });
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe("ingestEvidenceForTrip — un proveedor caído es un resultado, no una excepción", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.restoreAllMocks();
  });

  const entrada = () => ({
    tripId: "trip-1",
    imeis: ["imei-1", "imei-2"],
    windowStart: new Date("2026-06-22T10:45:00Z"),
    windowEnd: new Date("2026-06-22T12:20:00Z"),
    resolveUnit: async () => null,
    savePoints: vi.fn(async () => {}),
    updateStatus: vi.fn(async () => {}),
  });

  it("si el login falla devuelve indisponible en vez de lanzar", async () => {
    /*
     * El login estaba FUERA del try. Un 500 del proveedor escapaba de aquí,
     * tumbaba verifyOccurrence entera y dejaba al servicio SIN hecho — y quien
     * llama se traga la excepción, así que el servicio volvía a la cola cada
     * minuto sin que nadie viera un error. Ese es el fallo mudo.
     */
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
      headers: { get: () => null },
    } as never);

    const provider = createUmbrellaProvider({
      baseUrl: "http://example.com",
      credentials: { userId: "u", password: "p" },
    });
    const input = entrada();

    const resultado = await ingestEvidenceForTrip(provider, input);

    expect(resultado).toEqual({ pointCount: 0, status: "indisponible" });
    expect(input.updateStatus).toHaveBeenCalledWith("indisponible");
    expect(input.savePoints).not.toHaveBeenCalled();
  });

  it("si falla a media descarga de lotes tampoco lanza", async () => {
    let llamadas = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      llamadas++;
      // 1ª llamada: login OK. Las siguientes revientan.
      if (llamadas === 1) {
        return {
          ok: true,
          json: async () => ({ state: true, message: "", value: "token-1" }),
        } as never;
      }
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "",
        headers: { get: () => null },
      } as never;
    });

    const provider = createUmbrellaProvider({
      baseUrl: "http://example.com",
      credentials: { userId: "u", password: "p" },
    });
    const input = entrada();

    await expect(ingestEvidenceForTrip(provider, input)).resolves.toEqual({
      pointCount: 0,
      status: "indisponible",
    });
    expect(input.updateStatus).toHaveBeenCalledWith("indisponible");
  });
});
