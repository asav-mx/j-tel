import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createUmbrellaProvider,
  fullJitterDelayMs,
  parseRetryAfterMs,
  _resetRateLimitForTests,
  acquireToken,
  ingestEvidenceForTrip,
  pedidosEnCola,
  ColaDeGpsLlenaError,
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

describe("la cola del balde tiene tope", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("rechaza en vez de encolar cuando ya hay demasiados formados", async () => {
    /*
     * La cola vive a nivel de módulo: sobrevive a la invocación que la llenó y
     * cada pedido formado retiene la verificación entera que lo pidió. Mientras
     * entren más pedidos por minuto de los que salen, crece sin techo. Así
     * murió /api/cron/verify cuatro veces el 3 de agosto de 2026, con el montón
     * en ~1.7 GB tras 20, 26 y 47 minutos de vida del proceso.
     */
    const opts = { capacity: 1, refillPerMinute: 1, maxEnCola: 5 };

    // El primero se lleva el único token; los siguientes se forman.
    const formados = [];
    for (let i = 0; i < 6; i++) formados.push(acquireToken("tope", opts).catch(() => "rechazado"));

    // El séptimo ya no cabe: la cola está en su tope.
    await expect(acquireToken("tope", opts)).rejects.toThrow(ColaDeGpsLlenaError);
    expect(pedidosEnCola("tope")).toBeLessThanOrEqual(5);
  });

  it("por debajo del tope sigue entregando como antes", async () => {
    const t0 = Date.now();
    await acquireToken("holgado", { capacity: 3, refillPerMinute: 60, maxEnCola: 100 });
    await acquireToken("holgado", { capacity: 3, refillPerMinute: 60, maxEnCola: 100 });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(pedidosEnCola("holgado")).toBe(0);
  });

  it("una cola llena se traduce a evidencia indisponible, no a excepción", async () => {
    // La razón de que el tope viva aquí y no en quien llama: el camino que ya
    // existe para "no pude observar" absorbe el rechazo sin tumbar nada.
    const opts = { capacity: 0, refillPerMinute: 0.0001, maxEnCola: 0 };
    await expect(acquireToken("lleno", opts)).rejects.toThrow(ColaDeGpsLlenaError);
  });
});
