import { describe, expect, it } from "vitest";
import { franjaEnPalabras, leerFranjasCapturadas, loQueDiceOntoyAhora, resumenDeLaPromesa } from "./promesa-por-franja";

const buena = { diaTipo: "entre_semana", sentido: null, desdeLocal: "06:00", hastaLocal: "09:00", frequencyMinutes: 10 };

describe("leerFranjasCapturadas", () => {
  it("lee una franja bien formada y la deja en HH:MM", () => {
    const r = leerFranjasCapturadas([{ ...buena, desdeLocal: "06:00:00" }]);
    expect(r).toEqual({ ok: true, franjas: [{ ...buena, desdeLocal: "06:00" }] });
  });

  it("una franja que termina antes de empezar se rechaza con SU razón, no como «fuera de horario»", () => {
    const r = leerFranjasCapturadas([{ ...buena, desdeLocal: "22:00", hastaLocal: "06:00" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("termina antes de empezar");
  });

  it("rechaza tipo de día, sentido, hora y frecuencia que no existen", () => {
    for (const mala of [
      { ...buena, diaTipo: "lunes" },
      { ...buena, sentido: "norte" },
      { ...buena, desdeLocal: "6" },
      { ...buena, frequencyMinutes: 0 },
      { ...buena, frequencyMinutes: 7.5 },
      { ...buena, frequencyMinutes: 999 },
    ]) {
      expect(leerFranjasCapturadas([mala]).ok).toBe(false);
    }
    expect(leerFranjasCapturadas("no es lista").ok).toBe(false);
  });

  it("una lista vacía es una promesa sin franjas, y se lee (quien guarda decide si la acepta)", () => {
    expect(leerFranjasCapturadas([])).toEqual({ ok: true, franjas: [] });
  });
});

it("franjaEnPalabras", () => {
  expect(franjaEnPalabras({ ...buena, sentido: "ida" } as never)).toBe("06:00–09:00 · cada 10 min · sólo ida");
});

describe("resumenDeLaPromesa", () => {
  it("tres casos que no se funden", () => {
    expect(resumenDeLaPromesa(null)).toBe("sin promesa capturada");
    expect(resumenDeLaPromesa([])).toContain("no declara frecuencia");
    expect(resumenDeLaPromesa([buena as never])).toBe("1 franja · cada 10 min");
  });
  it("con cadencias distintas dice el intervalo, nunca un promedio", () => {
    expect(resumenDeLaPromesa([buena as never, { ...buena, frequencyMinutes: 20 } as never])).toBe("2 franjas · cada 10–20 min");
  });
});

it("loQueDiceOntoyAhora dice lo mismo que la app", () => {
  expect(loQueDiceOntoyAhora({ estado: "sin_capturar" })).toContain("no publica cada cuánto pasa");
  expect(loQueDiceOntoyAhora({ estado: "sin_franja" })).toContain("Sin frecuencia publicada para esta hora");
  expect(loQueDiceOntoyAhora({ estado: "declarada", ida: 10, vuelta: 10 })).toContain("cada 10 min");
  expect(loQueDiceOntoyAhora({ estado: "declarada", ida: 10, vuelta: null })).toContain("sin frecuencia a esta hora");
});

it("con ida y vuelta distintas cita la frase EXACTA de Ontoy, no una propia", () => {
  expect(loQueDiceOntoyAhora({ estado: "declarada", ida: 10, vuelta: 20 })).toBe(
    "«Pasa de ida cada 10 min · de vuelta cada 20 min».",
  );
});

it("con ida y vuelta iguales también cita la frase exacta de Ontoy", () => {
  expect(loQueDiceOntoyAhora({ estado: "declarada", ida: 10, vuelta: 10 })).toBe("«Pasa cada 10 min», en los dos sentidos.");
});
