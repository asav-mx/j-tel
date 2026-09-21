import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `carrier/aportaciones` — los dos cierres del 21 sep 2026 (decisión de Asav).
 *
 *  1. Sólo el transportista escribe su versión: la guardia es
 *     `carrier-en-persona`, sin el pase del alcance global. Qué deja pasar esa
 *     guardia lo mide `guardia-api.test.ts`; aquí, que la ruta la pida y que sin
 *     ella no escriba nada.
 *  2. La unidad declarada se rechaza si el sello ya tiene unidad observada —
 *     **sólo ese campo**: una justificación sin unidad sigue entrando.
 */

const exigir = vi.fn();
const findBySlug = vi.fn();
const findById = vi.fn();
const getUnitsForCarrier = vi.fn();
const crear = vi.fn();
const addLedgerEntry = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/auth", () => ({ getIdentidad: async () => ({ userId: "user_jb" }) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    accounts: { findBySlug: (s: string) => findBySlug(s) },
    occurrences: { findById: (id: string) => findById(id) },
    fleet: { getUnitsForCarrier: (id: string) => getUnitsForCarrier(id) },
    aportaciones: { crear: (d: unknown) => crear(d) },
    compliance: { addLedgerEntry: (d: unknown) => addLedgerEntry(d) },
  }),
}));

const { POST } = await import("./route");

const mandar = (cuerpo: Record<string, unknown>) =>
  POST(
    new Request("https://j-telemetry.com/api/carrier/aportaciones", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: "juarez-bus", occurrenceId: "o1", ...cuerpo }),
    }),
  );

function servicio(observedUnitId: string | null) {
  return {
    trip: { id: "trip1" },
    profile: { contract: { carrierAccountId: "cuenta-jb", policy: { excusableReasons: ["falla_mecanica"] } } },
    complianceFact: { observedUnitId, contractPolicySnapshot: { excusableReasons: ["falla_mecanica"] } },
  };
}

beforeEach(() => {
  for (const f of [exigir, findBySlug, findById, getUnitsForCarrier, crear, addLedgerEntry]) f.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_jb" } });
  findBySlug.mockResolvedValue({ id: "cuenta-jb", type: "carrier", slug: "juarez-bus" });
  getUnitsForCarrier.mockResolvedValue([{ id: "u-2115" }]);
  crear.mockResolvedValue({ id: "ap1", estado: "enviada" });
});

describe("1 · sólo el transportista escribe su versión", () => {
  it("pide la guardia sin pase global, no la de leer", async () => {
    findById.mockResolvedValue(servicio(null));
    await mandar({ nota: "x" });
    expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "carrier-en-persona", slug: "juarez-bus" });
  });

  it("si la guardia niega (J-Staff), no se escribe nada", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
    findById.mockResolvedValue(servicio(null));
    const r = await mandar({ declaredUnitId: "u-2115" });
    expect(r.status).toBe(403);
    expect(crear).not.toHaveBeenCalled();
    expect(addLedgerEntry).not.toHaveBeenCalled();
  });
});

describe("2 · la unidad declarada sólo donde el sello no acreditó ninguna", () => {
  it("con unidad observada, el campo de unidad se rechaza y no se escribe nada", async () => {
    findById.mockResolvedValue(servicio("u-2126"));
    const r = await mandar({ declaredUnitId: "u-2115", nota: "fue la 2115" });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("ya tiene unidad observada");
    expect(crear).not.toHaveBeenCalled();
    expect(addLedgerEntry).not.toHaveBeenCalled();
  });

  it("con unidad observada, una justificación SIN unidad sigue entrando", async () => {
    findById.mockResolvedValue(servicio("u-2126"));
    const r = await mandar({ motivo: "falla_mecanica", nota: "se ponchó" });
    expect(r.status).toBe(200);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0]![0]).toMatchObject({ declaredUnitId: null, motivo: "falla_mecanica" });
  });

  it("sin unidad observada, la unidad declarada entra", async () => {
    findById.mockResolvedValue(servicio(null));
    const r = await mandar({ declaredUnitId: "u-2115" });
    expect(r.status).toBe(200);
    expect(crear.mock.calls[0]![0]).toMatchObject({ declaredUnitId: "u-2115" });
  });
});
