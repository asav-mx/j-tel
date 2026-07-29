import { describe, expect, it } from "vitest";
import { leerCobertura } from "./cobertura.js";

describe("leerCobertura", () => {
  it("lee la medición cuando el paso cobertura_evidencia trae coveragePct y minCoveragePct", () => {
    const c = leerCobertura([
      { step: "otro_paso", details: { foo: "bar" } },
      {
        step: "cobertura_evidencia",
        details: {
          coveragePct: 94.2,
          minCoveragePct: 60,
          maxGapMinutes: 12.5,
          maxGapMinutesAllowed: 20,
        },
      },
    ]);
    expect(c).toEqual({
      disponible: true,
      pct: 94.2,
      minimoPct: 60,
      mayorHuecoMinutos: 12.5,
      huecoMaximoPermitido: 20,
    });
  });

  it("el hueco es null cuando el paso no lo trae, sin fabricar un cero", () => {
    const c = leerCobertura([
      { step: "cobertura_evidencia", details: { coveragePct: 48.9, minCoveragePct: 80 } },
    ]);
    expect(c?.mayorHuecoMinutos).toBeNull();
    expect(c?.huecoMaximoPermitido).toBeNull();
  });

  it("devuelve null si el paso cobertura_evidencia no aparece en los steps", () => {
    expect(leerCobertura([{ step: "otro_paso", details: {} }])).toBeNull();
  });

  it("devuelve null si los steps no son un arreglo", () => {
    expect(leerCobertura(undefined)).toBeNull();
    expect(leerCobertura(null)).toBeNull();
    expect(leerCobertura("no es un arreglo")).toBeNull();
  });

  it("devuelve null si el paso no trae coveragePct o minCoveragePct numéricos", () => {
    expect(
      leerCobertura([{ step: "cobertura_evidencia", details: { coveragePct: "no-es-numero" } }]),
    ).toBeNull();
    expect(leerCobertura([{ step: "cobertura_evidencia", details: {} }])).toBeNull();
  });

  it("cero señal en la ventana también es una medición real, no se descarta", () => {
    const c = leerCobertura([
      { step: "cobertura_evidencia", details: { coveragePct: 0, minCoveragePct: 60 } },
    ]);
    expect(c).toEqual({
      disponible: true,
      pct: 0,
      minimoPct: 60,
      mayorHuecoMinutos: null,
      huecoMaximoPermitido: null,
    });
  });
});
