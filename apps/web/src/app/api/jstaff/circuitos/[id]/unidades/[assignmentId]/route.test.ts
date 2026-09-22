import { beforeEach, expect, it, vi } from "vitest";

/**
 * Soltar una unidad desde J-Staff (ficha de Circuitos, A2). Lo nuevo: la
 * asignación tiene que ser DE ESTE circuito —antes se soltaba por id nada más—
 * y el cierre queda firmado con quién, de la sesión.
 */
const exigir = vi.fn();
const listAssignments = vi.fn();
const endAssignment = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    circuits: {
      listAssignments: (id: string) => listAssignments(id),
      endAssignment: (...a: unknown[]) => endAssignment(...a),
    },
  }),
}));

const { DELETE } = await import("./route");
const soltar = (circuito: string, asignacion: string) =>
  DELETE(new Request(`https://j-telemetry.com/api/jstaff/circuitos/${circuito}/unidades/${asignacion}?motivo=taller`, { method: "DELETE" }), {
    params: Promise.resolve({ id: circuito, assignmentId: asignacion }),
  });

beforeEach(() => {
  for (const m of [exigir, listAssignments, endAssignment]) m.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_asav" } });
  listAssignments.mockImplementation(async (id: string) =>
    id === "c1" ? [{ id: "a1", validTo: null }, { id: "a0", validTo: new Date() }] : [{ id: "a9", validTo: null }],
  );
  endAssignment.mockResolvedValue({ id: "a1", validTo: new Date(), motivo: "taller" });
});

it("suelta la de este circuito, firmada con quién de la sesión", async () => {
  const r = await soltar("c1", "a1");
  expect(r.status).toBe(200);
  expect(endAssignment).toHaveBeenCalledWith("a1", "taller", "user_asav");
});

it("una asignación de OTRO circuito responde como si no existiera, y no se toca", async () => {
  const r = await soltar("c1", "a9");
  expect(r.status).toBe(404);
  expect(endAssignment).not.toHaveBeenCalled();
});

it("una ya terminada tampoco se vuelve a cerrar", async () => {
  expect((await soltar("c1", "a0")).status).toBe(404);
  expect(endAssignment).not.toHaveBeenCalled();
});

it("sin sesión no se suelta", async () => {
  exigir.mockResolvedValue({ ok: true, identidad: { userId: null } });
  expect((await soltar("c1", "a1")).status).toBe(401);
  expect(endAssignment).not.toHaveBeenCalled();
});
