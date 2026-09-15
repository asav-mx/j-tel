import { describe, it, expect, vi } from "vitest";
import { confirmaFrase, reselloPorDias } from "./resello-pantalla";
import type { PlanDeReselloEnPantalla } from "./plan-resello";

const servicio = (id: string) => ({
  occurrenceId: id,
  perfil: `RUTA-${id}`,
  horaLimite: "2026-09-11T11:45:00.000Z",
  veredicto: "no_cumplido" as const,
  selladoEn: "2026-09-11T13:00:00.000Z",
});

const plan: PlanDeReselloEnPantalla = {
  contrato: { id: "c1", nombre: "Tecma 47", cliente: "Tecma", planta: "Planta 47" },
  desde: "2026-09-10",
  hasta: "2026-09-12",
  dias: [
    { dia: "2026-09-10", servicios: [servicio("a")], yaSellados: 1 },
    { dia: "2026-09-11", servicios: [servicio("b"), servicio("c")], yaSellados: 2 },
    { dia: "2026-09-12", servicios: [servicio("d")], yaSellados: 1 },
  ],
  resumen: { total: 4, yaSellados: 4, sinHecho: 0, porVeredicto: { cumplido: 0, no_cumplido: 4, pendiente_evidencia: 0 }, dias: 3 },
  frase: "RESELLAR 4",
};

describe("qué cuenta como sí", () => {
  it("sólo la frase exacta, con la cifra", () => {
    expect(confirmaFrase("RESELLAR 4", plan.frase)).toBe(true);
    expect(confirmaFrase(" RESELLAR 4 ", plan.frase)).toBe(true);
    for (const no of ["", "si", "RESELLAR", "RESELLAR 3", "resellar 4"]) {
      expect(confirmaFrase(no, plan.frase)).toBe(false);
    }
  });
});

describe("el recorrido de los días", () => {
  it("sin la frase no se envía nada", async () => {
    const enviar = vi.fn();
    const r = await reselloPorDias({ plan, tecleado: "si", keepEvidence: true, enviar });
    expect(enviar).not.toHaveBeenCalled();
    expect(r.detenido).toBe(true);
  });

  it("cada día viaja con SUS ids, la frase y la cifra de todo el rango", async () => {
    const enviar = vi.fn().mockResolvedValue({ status: 200, json: { ok: true, resultados: [] } });
    const r = await reselloPorDias({ plan, tecleado: "RESELLAR 4", keepEvidence: false, enviar });
    expect(r.detenido).toBe(false);
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(enviar.mock.calls[1]![0]).toEqual({
      contractId: "c1",
      serviceDate: "2026-09-11",
      keepEvidence: false,
      esperadas: ["b", "c"],
      confirmacion: "RESELLAR 4",
      autorizados: 4,
    });
  });

  it("se detiene en el primer día que falla: los siguientes no se tocan", async () => {
    const enviar = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, json: { ok: true, resultados: [] } })
      .mockResolvedValueOnce({ status: 409, json: { ok: false, error: "cambió entre la lista y la confirmación" } })
      .mockResolvedValue({ status: 200, json: { ok: true, resultados: [] } });

    const r = await reselloPorDias({ plan, tecleado: "RESELLAR 4", keepEvidence: true, enviar });
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(r.detenido).toBe(true);
    expect(r.dias.at(-1)).toEqual({ dia: "2026-09-11", ok: false, error: "cambió entre la lista y la confirmación" });
  });
});
