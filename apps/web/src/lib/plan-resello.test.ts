import { describe, it, expect } from "vitest";
import { diasDelRango, leerPlanDeResello, MAX_DIAS_RESELLO } from "./plan-resello";

const occ = (id: string, serviceDate: string, status: string | null = "no_cumplido") => ({
  id,
  serviceDate,
  expectedDeadline: new Date(`${serviceDate}T11:45:00Z`),
  trip: { id: `t-${id}` },
  complianceFact: status ? { status, materializedAt: new Date(`${serviceDate}T13:00:00Z`) } : null,
  profile: { code: `RUTA-${id}` },
});

function repos(ocurrencias: unknown[]) {
  return {
    contracts: { findById: async () => ({ id: "c1", name: "Tecma 47", clientAccountId: "cl", plant: { name: "Planta 47", code: "47" } }) },
    accounts: { findById: async () => ({ name: "Tecma" }) },
    occurrences: { findForContract: async () => ocurrencias },
  } as never;
}

describe("la lista de lo que se re-sellaría", () => {
  it("un rango de más de 31 días no se lista: cada día es una invocación al motor", async () => {
    const dias = diasDelRango("2026-08-01", "2026-09-15");
    expect(dias.length).toBeGreaterThan(MAX_DIAS_RESELLO);
    const r = await leerPlanDeResello(repos([]), { contractId: "c1", desde: "2026-08-01", hasta: "2026-09-15" });
    expect(r).toMatchObject({ status: 400 });
  });

  it("agrupa por día, omite los días sin servicios, y la frase lleva la cifra de TODO el rango", async () => {
    const r = await leerPlanDeResello(
      repos([occ("a", "2026-09-10"), occ("b", "2026-09-12"), occ("c", "2026-09-12", "cumplido"), occ("d", "2026-09-12", null)]),
      { contractId: "c1", desde: "2026-09-10", hasta: "2026-09-12" },
    );
    if ("error" in r) throw new Error(r.error);
    expect(r.dias.map((d) => [d.dia, d.servicios.length, d.yaSellados])).toEqual([
      ["2026-09-10", 1, 1],
      ["2026-09-12", 3, 2],
    ]);
    expect(r.resumen).toMatchObject({ total: 4, yaSellados: 3, sinHecho: 1, dias: 2 });
    expect(r.frase).toBe("RESELLAR 3");
    expect(r.contrato).toEqual({ id: "c1", nombre: "Tecma 47", cliente: "Tecma", planta: "Planta 47 (47)" });
  });
});
