import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `casa/recorrido/dispositivo` — la puerta del recorrido del dispositivo. La
 * ventana y la caché se prueban a fondo en la del recorrido de la unidad (es la
 * misma función); aquí, lo propio: la guardia, el dispositivo de otra cuenta y
 * los autores.
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const cargarRecorridoDeDispositivo = vi.fn();
const correosDeAutores = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));
vi.mock("@jtel/services", () => ({
  cargarRecorridoDeDispositivo: (...a: unknown[]) => cargarRecorridoDeDispositivo(...a),
}));
vi.mock("@/lib/casa/autores", () => ({ correosDeAutores: (ids: unknown) => correosDeAutores(ids) }));

const { GET } = await import("./route");

const DESDE = "2026-09-16T00:00:00-06:00";
const HASTA = "2026-09-16T23:59:59.999-06:00";

function pedir(params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return GET(new Request(`https://j-telemetry.com/api/casa/recorrido/dispositivo?${q}`));
}
const completa = (extra: Record<string, string> = {}) =>
  pedir({ account: "juarez-bus", dispositivo: "d3", desde: DESDE, hasta: HASTA, ...extra });

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  cargarRecorridoDeDispositivo.mockReset();
  correosDeAutores.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "jb_admin" } });
  findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });
  cargarRecorridoDeDispositivo.mockResolvedValue({
    cerrada: true,
    etapas: [
      { tipo: "unidad", asignadaPor: null, cerradaPor: "user_ana" },
      { tipo: "bodega" },
      { tipo: "unidad", asignadaPor: "user_ana", cerradaPor: null },
    ],
  });
  correosDeAutores.mockResolvedValue(new Map([["user_ana", "ana@ejemplo.mx"]]));
});

describe("la puerta del recorrido del dispositivo", () => {
  it("quien no pertenece al carrier recibe la respuesta de la guardia, y no se lee nada", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response("{}", { status: 403 }) });
    const r = await completa();
    expect(r.status).toBe(403);
    expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "carrier", slug: "juarez-bus" });
    expect(cargarRecorridoDeDispositivo).not.toHaveBeenCalled();
  });

  it("sin dispositivo: 400", async () => {
    const r = await pedir({ account: "juarez-bus", desde: DESDE, hasta: HASTA });
    expect(r.status).toBe(400);
  });

  it("una ventana sin zona se rechaza con la misma regla que la unidad", async () => {
    const r = await completa({ desde: "2026-09-16T00:00:00" });
    expect(r.status).toBe(400);
    expect(cargarRecorridoDeDispositivo).not.toHaveBeenCalled();
  });

  it("el dispositivo de otra cuenta: 404, sin caché", async () => {
    cargarRecorridoDeDispositivo.mockResolvedValue(null);
    const r = await completa({ grado: "0" });
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("lee con la cuenta del slug, no con la que diga el dispositivo", async () => {
    await completa({ grado: "0" });
    expect(cargarRecorridoDeDispositivo.mock.calls[0]![1]).toMatchObject({ carrierAccountId: "cuenta-jb", deviceId: "d3" });
  });

  it("los autores son sólo quienes montaron o soltaron, en correo", async () => {
    const r = await completa({ grado: "0" });
    expect(correosDeAutores.mock.calls[0]![0]).toEqual([null, "user_ana", "user_ana", null]);
    expect((await r.json()).autores).toEqual({ user_ana: "ana@ejemplo.mx" });
  });

  it("ventana cerrada con grado escrito: inmutable; sin grado: revalida", async () => {
    expect((await completa({ grado: "0" })).headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect((await completa()).headers.get("Cache-Control")).toBe("private, no-cache");
  });
});
