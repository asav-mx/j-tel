import { beforeEach, expect, it, vi } from "vitest";

/*
 * La valla de los nombres reservados (PR 4a): J-Staff no da de alta un
 * circuito con el slug de una consulta fija de Ontoy. Quedaría tapado.
 */
const exigir = vi.fn();
const createCircuit = vi.fn();
vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({ getRepos: () => ({ circuits: { createCircuit: (...a: unknown[]) => createCircuit(...a) } }) }));

const { POST } = await import("./route");
const alta = (slug: string) => {
  const f = new FormData();
  f.set("concesionAccountId", "conc");
  f.set("nombre", "Circuito");
  f.set("publicSlug", slug);
  f.set("volver", "/casa/jstaff/circuitos");
  return POST(new Request("https://j-telemetry.com/api/jstaff/circuitos", { method: "POST", body: f }));
};

beforeEach(() => {
  exigir.mockReset().mockResolvedValue({ ok: true, identidad: { userId: "user_asav" } });
  createCircuit.mockReset();
});

for (const slug of ["en-vivo", "paradas-de-la-ciudad", "En-Vivo"]) {
  it(`«${slug}» no se da de alta: está reservado para Ontoy`, async () => {
    const r = await alta(slug);
    expect(new URL(r.headers.get("location")!).searchParams.get("error")).toMatch(/reservado/);
    expect(createCircuit).not.toHaveBeenCalled();
  });
}
