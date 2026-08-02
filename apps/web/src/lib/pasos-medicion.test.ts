import { describe, expect, it } from "vitest";
import { proyectarPasosMedicion, type EntradaPasos } from "./pasos-medicion";

const base: EntradaPasos = {
  steps: [],
  razonSinLedger: null,
  unidadObservadaLabel: "9376",
  llegadaTexto: "2026-07-27 05:30",
  deadlineTexto: "2026-07-27 05:40",
  margenMinutos: 9.4,
  toleranciaMinutos: 5,
  timing: "temprano",
};

const decision = (details: Record<string, unknown>) => ({
  step: "decision",
  result: "cumplido",
  details,
});

const cobertura = (details: Record<string, unknown>) => ({
  step: "cobertura_evidencia",
  result: "suficiente",
  details,
});

describe("proyectarPasosMedicion", () => {
  it("siempre devuelve los cuatro pasos, aunque no haya con qué medirlos", () => {
    const pasos = proyectarPasosMedicion({ ...base, steps: [] });
    expect(pasos.map((p) => p.numero)).toEqual([1, 2, 3, 4]);
  });

  it("NUNCA deja pasar el identificador interno de la unidad", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      steps: [
        decision({
          hasKml: true,
          observedUnit: "c1d53a82-4e10-4c4a-8376-b3130d222ed7",
          routeMatchPct: 98.45,
          minKmlPct: 60,
          corridorPrecisionPct: 54.9,
          minCorridorPct: 50,
        }),
      ],
    });
    const serializado = JSON.stringify(pasos);
    expect(serializado).not.toContain("c1d53a82-4e10-4c4a-8376-b3130d222ed7");
    expect(pasos[0]!.respuesta).toBe("9376");
  });

  it("ignora por completo las candidatas: no las lee, así que no las puede filtrar mal", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      steps: [
        { step: "candidata", result: "no_sirvio", details: { imei: "864893051234567" } },
        { step: "candidata", result: "no_sirvio", details: { imei: "864893059999999" } },
        decision({ hasKml: true, routeMatchPct: 98.4, minKmlPct: 60, corridorPrecisionPct: 70, minCorridorPct: 50 }),
      ],
    });
    const serializado = JSON.stringify(pasos);
    expect(serializado).not.toContain("864893051234567");
    expect(serializado).not.toContain("864893059999999");
  });

  it("sin trazado contratado NO afirma coincidencia: el 100 de relleno no se muestra", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      steps: [decision({ hasKml: false, routeMatchPct: 100, corridorPrecisionPct: 100 })],
    });
    const paso1 = pasos[0]!;
    expect(paso1.medidas).toHaveLength(0);
    expect(paso1.nota).toContain("no tiene trazado contratado");
  });

  it("con trazado, cada medida trae su umbral", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      steps: [
        decision({
          hasKml: true,
          routeMatchPct: 98.4573609189022,
          minKmlPct: 60,
          corridorPrecisionPct: 54.94505494505495,
          minCorridorPct: 50,
          corridorMeters: 150,
        }),
      ],
    });
    const medidas = pasos[0]!.medidas;
    expect(medidas[0]).toMatchObject({ valor: "98.5%", umbral: "mínimo del contrato 60.0%" });
    expect(medidas[1]).toMatchObject({ valor: "54.9%", umbral: "mínimo del contrato 50.0%" });
    expect(medidas.every((m) => m.umbral !== null || m.etiqueta === "Ancho del corredor")).toBe(true);
  });

  it("sin el paso de cobertura declara el hueco y no lo deriva ni inventa el motivo", () => {
    const pasos = proyectarPasosMedicion({ ...base, steps: [decision({ hasKml: false })] });
    const paso2 = pasos[1]!;
    expect(paso2.estado).toBe("no_registrado");
    expect(paso2.medidas).toHaveLength(0);
    // No afirma que se selló antes de que existiera la medición: no puede saberlo.
    expect(paso2.nota).not.toContain("antes de que");
  });

  it("sin un solo punto, la respuesta del paso 2 es 'no' medido, no un dato faltante", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      steps: [{ step: "evidencia", result: "indisponible" }],
    });
    const paso2 = pasos[1]!;
    expect(paso2.estado).toBe("medido");
    expect(paso2.respuesta).toContain("No se recibió ningún punto");
    expect(paso2.nota).toContain("Sin evidencia no hay incumplimiento");
  });

  it("el paso 3 nunca afirma un radio, porque la geocerca no se archiva con el hecho", () => {
    const pasos = proyectarPasosMedicion({ ...base, steps: [cobertura({ coveragePct: 100, minCoveragePct: 80 })] });
    const paso3 = pasos[2]!;
    expect(paso3.medidas.map((m) => m.etiqueta)).toEqual(["Hora de entrada"]);
    expect(JSON.stringify(paso3)).not.toMatch(/radio|radius/i);
  });

  it("el paso 4 nunca deja la etiqueta sola: siempre dice por cuánto", () => {
    const pasos = proyectarPasosMedicion(base);
    expect(pasos[3]!.respuesta).toBe("Temprano · 9.4 min antes del plazo");
  });

  it("una llegada tarde se enuncia como retraso, con la tolerancia al lado", () => {
    const pasos = proyectarPasosMedicion({
      ...base,
      timing: "tarde",
      margenMinutos: -134,
      toleranciaMinutos: 10,
    });
    expect(pasos[3]!.respuesta).toBe("Tarde · 2 h 14 min después del plazo");
    expect(pasos[3]!.medidas.at(-1)).toMatchObject({
      valor: "2 h 14 min de retraso",
      umbral: "tolerancia del contrato ±10 min",
    });
  });

  it("cuando el ledger no empareja, los pasos del hecho siguen vivos", () => {
    const pasos = proyectarPasosMedicion({ ...base, steps: null, razonSinLedger: "ambiguous" });
    expect(pasos[0]!.estado).toBe("no_registrado");
    expect(pasos[1]!.estado).toBe("no_registrado");
    expect(pasos[1]!.nota).toContain("más de una corrida");
    // 3 y 4 no dependen del ledger.
    expect(pasos[2]!.estado).toBe("medido");
    expect(pasos[3]!.estado).toBe("medido");
  });

  it("los pasos 1 y 2 declaran otra procedencia que los pasos 3 y 4", () => {
    const pasos = proyectarPasosMedicion(base);
    expect(pasos[0]!.procedencia).toBe(pasos[1]!.procedencia);
    expect(pasos[2]!.procedencia).toBe(pasos[3]!.procedencia);
    expect(pasos[0]!.procedencia).not.toBe(pasos[2]!.procedencia);
  });
});
