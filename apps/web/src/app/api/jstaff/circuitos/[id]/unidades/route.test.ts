import { beforeEach, expect, it, vi } from "vitest";

/**
 * Asignar una unidad desde J-Staff (ficha de Circuitos, A2): la guardia va
 * primero, quién asigna sale de la sesión — nunca del cuerpo — y sin sesión no
 * se asigna. Las reglas de fondo (cerrar la del otro circuito en la misma
 * transacción) son de `assignUnit`, con su prueba contra base.
 */
const exigir = vi.fn();
const getCircuit = vi.fn();
const listUnidadesAsignables = vi.fn();
const assignUnit = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    circuits: {
      getCircuit: (id: string) => getCircuit(id),
      listUnidadesAsignables: (c: string) => listUnidadesAsignables(c),
      assignUnit: (d: unknown) => assignUnit(d),
    },
  }),
}));

const { POST } = await import("./route");
const mandar = (cuerpo: unknown) =>
  POST(
    new Request("https://j-telemetry.com/api/jstaff/circuitos/c1/unidades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
    { params: Promise.resolve({ id: "c1" }) },
  );

beforeEach(() => {
  for (const m of [exigir, getCircuit, listUnidadesAsignables, assignUnit]) m.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "user_asav" } });
  getCircuit.mockResolvedValue({ id: "c1", name: "Oasis-Centro", concessionAccountId: "conc" });
  listUnidadesAsignables.mockResolvedValue([
    { unitId: "u1", label: "2120", carrierAccountId: "carr", ocupadaEnCircuitoId: "c9" },
  ]);
  assignUnit.mockResolvedValue({ abierta: { id: "a1", validFrom: new Date() }, cerrada: null });
});

it("la guardia va primero: sólo J-Staff", async () => {
  exigir.mockResolvedValue({ ok: false, respuesta: new Response(null, { status: 403 }) });
  expect((await mandar({ unidadId: "u1" })).status).toBe(403);
  expect(exigir.mock.calls[0]![1]).toEqual({ tipo: "jstaff" });
  expect(assignUnit).not.toHaveBeenCalled();
});

it("quién asigna sale de la sesión, nunca del cuerpo", async () => {
  await mandar({ unidadId: "u1", actorId: "alguien_inventado" });
  expect(assignUnit.mock.calls[0]![0]).toMatchObject({ actorId: "user_asav", carrierAccountId: "carr" });
});

it("sin sesión no se asigna", async () => {
  exigir.mockResolvedValue({ ok: true, identidad: { userId: null } });
  expect((await mandar({ unidadId: "u1" })).status).toBe(401);
  expect(assignUnit).not.toHaveBeenCalled();
});
