import { describe, expect, it, vi } from "vitest";
import {
  confirma,
  fraseDeConfirmacion,
  modoDeResello,
  planDeResello,
  resumenDelPlan,
} from "./resello.js";
import { VerificationService } from "./verification.js";

/*
 * Re-sellar re-emite el juicio sobre la jornada de un cliente. Estas pruebas
 * fijan las tres cosas que lo vuelven un acto autorizado y no un comando:
 * sin `--aplicar` no se escribe, el sí lleva la cifra, y lo autorizado es
 * exactamente lo que se hace.
 */

const dia = "2026-07-09";
const occ = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  serviceDate: dia,
  expectedDeadline: new Date("2026-07-09T13:00:00Z"),
  trip: { id: `trip-${id}` },
  complianceFact: { status: "no_cumplido", materializedAt: new Date("2026-07-09T14:00:00Z") },
  profile: { code: `RUTA-${id}` },
  ...over,
});

describe("sin --aplicar no se escribe", () => {
  it("el modo por omisión es simulación", () => {
    expect(modoDeResello(["node", "reverify-day.ts"])).toBe("simulacion");
    expect(modoDeResello(["node", "reverify-day.ts", "--aplicar"])).toBe("aplicar");
    // Ni la costumbre de otros guiones ni un error de dedo cuentan.
    expect(modoDeResello(["node", "reverify-day.ts", "--apply", "--force", "-y"])).toBe("simulacion");
  });
});

describe("la lista es lo que el motor va a tocar", () => {
  it("entra lo del día con viaje; no entra otro día ni lo que no tiene viaje", () => {
    const plan = planDeResello(
      [occ("a"), occ("b", { trip: null }), occ("c", { serviceDate: "2026-07-10" })],
      dia,
    );
    expect(plan.map((s) => s.occurrenceId)).toEqual(["a"]);
  });

  it("dice el veredicto de hoy y distingue lo que se re-sella de lo que se sella por primera vez", () => {
    const plan = planDeResello(
      [occ("a"), occ("b", { complianceFact: { status: "cumplido" } }), occ("c", { complianceFact: null })],
      dia,
    );
    expect(resumenDelPlan(plan)).toEqual({
      total: 3,
      yaSellados: 2,
      sinHecho: 1,
      porVeredicto: { cumplido: 1, no_cumplido: 1, pendiente_evidencia: 0 },
    });
  });
});

describe("el sí lleva la cifra de lo que se reescribe", () => {
  const plan = planDeResello([occ("a"), occ("b"), occ("c", { complianceFact: null })], dia);

  it("la frase nombra los veredictos YA sellados, no el total", () => {
    expect(fraseDeConfirmacion(plan)).toBe("RESELLAR 2");
  });

  it("sólo la frase exacta confirma", () => {
    expect(confirma("RESELLAR 2", plan)).toBe(true);
    expect(confirma("  RESELLAR 2 \n", plan)).toBe(true);
    for (const no of ["s", "si", "sí", "y", "yes", "RESELLAR", "RESELLAR 3", "resellar 2", "", null]) {
      expect(confirma(no, plan)).toBe(false);
    }
  });
});

describe("lo autorizado es lo que se hace", () => {
  function servicio(ocurrencias: unknown[]) {
    const verificar = vi.fn();
    const svc = new VerificationService({
      occurrences: { findForContract: async () => ocurrencias, findById: async () => null },
    } as never);
    (svc as unknown as { verifyOccurrence: unknown }).verifyOccurrence = verificar;
    return { svc, verificar };
  }

  it("si el día cambió entre la lista y el sí, no se re-sella NADA", async () => {
    // Se autorizó a y b; entre la lista y la confirmación apareció c.
    const { svc, verificar } = servicio([occ("a"), occ("b"), occ("c")]);

    await expect(
      svc.reverifyContract("contrato", { serviceDate: dia, exclusiveUnits: false, esperadas: ["a", "b"] }),
    ).rejects.toThrow(/No se re-selló nada/);
    expect(verificar).not.toHaveBeenCalled();
  });

  it("con exactamente lo autorizado, sí re-sella", async () => {
    const { svc, verificar } = servicio([occ("a"), occ("b")]);
    verificar.mockResolvedValue({ skipped: false, status: "cumplido" });

    await svc.reverifyContract("contrato", { serviceDate: dia, exclusiveUnits: false, esperadas: ["b", "a"] });
    expect(verificar).toHaveBeenCalledTimes(2);
  });
});
