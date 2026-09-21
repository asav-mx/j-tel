import { describe, expect, it } from "vitest";
import { franjaEnPalabras, leerFranjasCapturadas, propuestaDesdeNumero } from "./promesa-por-franja";

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

describe("propuestaDesdeNumero", () => {
  it("el número de antes, todo el horario, los tres tipos de día", () => {
    const p = propuestaDesdeNumero(20, { inicioLocal: "06:00:00", finLocal: "20:00:00" });
    expect(p.map((f) => f.diaTipo)).toEqual(["entre_semana", "sabado", "domingo"]);
    expect(p.every((f) => f.desdeLocal === "06:00" && f.hastaLocal === "20:00" && f.frequencyMinutes === 20)).toBe(true);
  });

  it("sin número no se propone nada: no se inventa una promesa", () => {
    expect(propuestaDesdeNumero(null, { inicioLocal: "06:00", finLocal: "20:00" })).toEqual([]);
  });

  it("con horario nocturno no se propone: partir la franja es decidir por quien captura", () => {
    expect(propuestaDesdeNumero(15, { inicioLocal: "22:00", finLocal: "06:00" })).toEqual([]);
  });
});

it("franjaEnPalabras", () => {
  expect(franjaEnPalabras({ ...buena, sentido: "ida" } as never)).toBe("06:00–09:00 · cada 10 min · sólo ida");
});
