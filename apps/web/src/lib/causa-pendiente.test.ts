import { describe, expect, it } from "vitest";
import { leerCausaPendiente, leerFraccionObservada } from "./causa-pendiente";
import type { Cobertura } from "@jtel/services";

/**
 * Estas pruebas existen por un error concreto: la pantalla contaba "no hubo
 * suficiente señal" para las cuatro causas de `pendiente_evidencia`, y en una
 * planta real 39 de 54 casos tenían la cobertura por encima del umbral. La
 * frase acusaba de perder señal a quien no la había perdido.
 *
 * Lo que se prueba, entonces, no es que la función devuelva una etiqueta: es
 * que NO deduzca la causa de la cobertura cuando el ledger dice otra cosa.
 */

const suficiente: Cobertura = {
  disponible: true,
  pct: 100,
  minimoPct: 80,
  mayorHuecoMinutos: 1,
  huecoMaximoPermitido: 10,
};

const insuficiente: Cobertura = {
  disponible: true,
  pct: 38.5,
  minimoPct: 80,
  mayorHuecoMinutos: 44,
  huecoMaximoPermitido: 10,
};

const sinCobertura: Cobertura = { disponible: false, razon: "sin_paso" };

describe("leerCausaPendiente", () => {
  it("no culpa a la señal cuando la cobertura pasó el umbral y el ledger dice otra cosa", () => {
    const steps = [
      { step: "cobertura", details: { coveragePct: 100, minCoveragePct: 80 } },
      {
        step: "decision",
        result: "pendiente_evidencia",
        details: { reason: "llegada_sin_atribucion" },
      },
    ];
    expect(leerCausaPendiente(steps, suficiente)).toBe("llegada_sin_atribucion");
  });

  it("lee el arranque no observado desde el ledger", () => {
    const steps = [
      {
        step: "decision",
        result: "pendiente_evidencia",
        details: { reason: "observacion_insuficiente", earliestObservedFraction: 0.42 },
      },
    ];
    expect(leerCausaPendiente(steps, suficiente)).toBe("observacion_insuficiente");
    expect(leerFraccionObservada(steps)).toBe(0.42);
  });

  it("la ausencia de evidencia gana sobre cualquier otra causa", () => {
    const steps = [
      { step: "evidencia", result: "indisponible" },
      {
        step: "decision",
        result: "pendiente_evidencia",
        details: { reason: "llegada_sin_atribucion" },
      },
    ];
    expect(leerCausaPendiente(steps, sinCobertura)).toBe("sin_evidencia");
  });

  it("cae a la cobertura solo cuando el ledger no dejó una razón escrita", () => {
    const steps = [{ step: "cobertura", details: { coveragePct: 38.5, minCoveragePct: 80 } }];
    expect(leerCausaPendiente(steps, insuficiente)).toBe("cobertura_insuficiente");
  });

  it("calla la causa antes que inventarla cuando no hay de dónde leerla", () => {
    // Cobertura por encima del umbral y ningún paso de decisión: el hecho es
    // viejo o el ledger no quedó emparejado. Decir "falta de señal" aquí sería
    // exactamente el error que esta función corrige.
    expect(leerCausaPendiente([{ step: "cobertura" }], suficiente)).toBe("desconocida");
    expect(leerCausaPendiente(null, suficiente)).toBe("desconocida");
    expect(leerCausaPendiente(undefined, sinCobertura)).toBe("desconocida");
  });

  it("no confunde un paso de decisión de otro resultado con el del pendiente", () => {
    const steps = [
      { step: "decision", result: "cumplido", details: { reason: "llegada_sin_atribucion" } },
      { step: "cobertura", details: { coveragePct: 38.5, minCoveragePct: 80 } },
    ];
    expect(leerCausaPendiente(steps, insuficiente)).toBe("cobertura_insuficiente");
  });
});

describe("leerFraccionObservada", () => {
  it("devuelve null cuando el paso no la trae", () => {
    expect(leerFraccionObservada([{ step: "decision", details: {} }])).toBeNull();
    expect(leerFraccionObservada(null)).toBeNull();
  });
});
