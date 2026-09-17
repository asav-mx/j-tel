import { beforeEach, describe, expect, it, vi } from "vitest";

const exigir = vi.fn();
const findBySlug = vi.fn();
const serviciosDeUnidadEnDia = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({ accounts: { findBySlug: (s: string) => findBySlug(s) } }),
}));
vi.mock("@jtel/services", () => ({
  serviciosDeUnidadEnDia: (...a: unknown[]) => serviciosDeUnidadEnDia(...a),
}));

const { GET } = await import("./route");

const pedir = (params: Record<string, string>) =>
  GET(new Request(`https://j-telemetry.com/api/casa/recorrido/servicios?${new URLSearchParams(params)}`));

beforeEach(() => {
  exigir.mockReset();
  findBySlug.mockReset();
  serviciosDeUnidadEnDia.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "admin" } });
  findBySlug.mockResolvedValue({ id: "c1", type: "carrier", slug: "cuenta" });
  serviciosDeUnidadEnDia.mockResolvedValue({ reservada: false });
});

describe("casa/recorrido/servicios", () => {
  it("la guardia va primero, con la audiencia del carrier", async () => {
    exigir.mockResolvedValue({ ok: false, respuesta: new Response("{}", { status: 403 }) });
    const r = await pedir({ account: "cuenta", unidad: "u1", dia: "2026-09-14" });
    expect(r.status).toBe(403);
    expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "carrier", slug: "cuenta" });
    expect(serviciosDeUnidadEnDia).not.toHaveBeenCalled();
  });

  it.each(["", "14/09/2026", "2026-9-14", "2026-13-40"])("día «%s» → 400", async (dia) => {
    expect((await pedir({ account: "cuenta", unidad: "u1", dia })).status).toBe(400);
  });

  it("la unidad de otra cuenta: 404", async () => {
    serviciosDeUnidadEnDia.mockResolvedValue(null);
    expect((await pedir({ account: "cuenta", unidad: "u1", dia: "2026-09-14" })).status).toBe(404);
  });

  it("contesta lo que dice el servicio, sin caché", async () => {
    const r = await pedir({ account: "cuenta", unidad: "u1", dia: "2026-09-14" });
    expect(await r.json()).toEqual({ reservada: false });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(serviciosDeUnidadEnDia.mock.calls[0]![1]).toMatchObject({ carrierAccountId: "c1", unitId: "u1", dia: "2026-09-14" });
  });
});
