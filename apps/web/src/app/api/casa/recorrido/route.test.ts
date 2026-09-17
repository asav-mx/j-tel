import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `casa/recorrido` — C3-b. Lo que se mide aquí es la puerta: qué se acepta,
 * qué no existe desde esta cuenta, y **con qué caché sale cada respuesta**.
 * El cálculo del recorrido tiene sus pruebas en `recorrido-servido.test.ts`;
 * aquí se sustituye para que un fallo de la regla 10 no se esconda detrás de
 * uno del cálculo.
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const cargarRecorridoDeUnidad = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));
vi.mock("@jtel/services", () => ({
  cargarRecorridoDeUnidad: (...a: unknown[]) => cargarRecorridoDeUnidad(...a),
}));

const { GET } = await import("./route");

const DESDE = "2026-09-14T00:00:00-06:00";
const HASTA = "2026-09-14T23:59:59.999-06:00";

function pedir(params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return GET(new Request(`https://j-telemetry.com/api/casa/recorrido?${q}`));
}
const completa = (extra: Record<string, string> = {}) =>
  pedir({ account: "juarez-bus", unidad: "u1", desde: DESDE, hasta: HASTA, ...extra });

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  cargarRecorridoDeUnidad.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "jb_admin" } });
  findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });
  cargarRecorridoDeUnidad.mockResolvedValue({ cerrada: true, tramos: [] });
});

describe("la guardia va primero", () => {
  it("sin cuenta: 400, y no se lee nada", async () => {
    const r = await pedir({ unidad: "u1", desde: DESDE, hasta: HASTA });
    expect(r.status).toBe(400);
    expect(cargarRecorridoDeUnidad).not.toHaveBeenCalled();
  });

  it("quien no pertenece al carrier recibe la respuesta de la guardia, y no se lee nada", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response("{}", { status: 403 }) });
    const r = await completa();
    expect(r.status).toBe(403);
    expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "carrier", slug: "juarez-bus" });
    expect(cargarRecorridoDeUnidad).not.toHaveBeenCalled();
  });

  it("la unidad de otra cuenta: 404, sin caché", async () => {
    cargarRecorridoDeUnidad.mockResolvedValue(null);
    const r = await completa({ grado: "0" });
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("la ventana", () => {
  it.each([
    ["sin zona: se resolvería en el reloj del servidor", { desde: "2026-09-14T00:00:00", hasta: HASTA }],
    ["sólo fecha", { desde: "2026-09-14", hasta: HASTA }],
    ["basura", { desde: "ayer", hasta: HASTA }],
    ["al revés", { desde: HASTA, hasta: DESDE }],
    ["de largo cero", { desde: DESDE, hasta: DESDE }],
    ["de más de 32 días", { desde: "2026-08-01T00:00:00-06:00", hasta: "2026-09-03T00:00:00-06:00" }],
  ])("%s → 400", async (_n, ventana) => {
    const r = await pedir({ account: "juarez-bus", unidad: "u1", ...ventana });
    expect(r.status).toBe(400);
    expect(cargarRecorridoDeUnidad).not.toHaveBeenCalled();
  });

  it("acepta minutos a través de la medianoche, y pasa los instantes tal cual", async () => {
    const r = await pedir({ account: "juarez-bus", unidad: "u1", desde: "2026-09-13T22:00:00-06:00", hasta: "2026-09-14T06:00:00Z", grado: "0" });
    expect(r.status).toBe(200);
    const opciones = cargarRecorridoDeUnidad.mock.calls[0]![1];
    expect(opciones.ventana.desde.toISOString()).toBe("2026-09-14T04:00:00.000Z");
    expect(opciones.ventana.hasta.toISOString()).toBe("2026-09-14T06:00:00.000Z");
    expect(opciones).toMatchObject({ carrierAccountId: "cuenta-jb", unitId: "u1", grado: 0 });
  });
});

describe("el grado", () => {
  it.each(["4", "-1", "1.5", "x", ""])("grado «%s» → 400", async (grado) => {
    expect((await completa({ grado })).status).toBe(400);
  });

  it("sin grado, el servidor lo elige por la duración de la ventana", async () => {
    await pedir({ account: "juarez-bus", unidad: "u1", desde: "2026-09-01T00:00:00-06:00", hasta: "2026-09-08T00:00:00-06:00" });
    expect(cargarRecorridoDeUnidad.mock.calls[0]![1].grado).toBe(1);
  });
});

describe("la caché (regla 10)", () => {
  it("ventana cerrada con grado escrito: inmutable, y privada — nunca en el CDN", async () => {
    const r = await completa({ grado: "2" });
    expect(r.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
  });

  it("ventana abierta (toca hoy, o el archivador no ha llegado): revalida", async () => {
    cargarRecorridoDeUnidad.mockResolvedValue({ cerrada: false, tramos: [] });
    const r = await completa({ grado: "2" });
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("cerrada pero sin grado escrito: revalida — el criterio del servidor puede cambiar", async () => {
    const r = await completa();
    expect(r.headers.get("Cache-Control")).toBe("private, no-cache");
  });

  it("ninguna respuesta sale pública", async () => {
    for (const cerrada of [true, false]) {
      cargarRecorridoDeUnidad.mockResolvedValue({ cerrada, tramos: [] });
      for (const extra of [{}, { grado: "0" }, { grado: "3" }] as Record<string, string>[]) {
        const cc = (await completa(extra)).headers.get("Cache-Control") ?? "";
        expect(cc).toMatch(/^private,/);
        expect(cc).not.toMatch(/public|s-maxage/);
      }
    }
  });
});
