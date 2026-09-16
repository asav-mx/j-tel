import { describe, expect, it } from "vitest";
import { hayHuecoEntre, huecosDeSenal, partirEnHuecos, type PuntoTraza } from "./huecos.js";
import { SIN_SENAL_MINUTOS } from "./senal.js";

const T0 = new Date("2026-09-14T11:00:00.000Z");
const p = (minuto: number): PuntoTraza => ({
  lat: 31.7,
  lng: -106.4,
  at: new Date(T0.getTime() + minuto * 60_000),
  speed: 40,
});

describe("huecos · el umbral único", () => {
  it("sin umbral explícito usa SIN_SENAL_MINUTOS, el mismo de Flota en vivo", () => {
    expect(SIN_SENAL_MINUTOS).toBe(15);
    expect(hayHuecoEntre(p(0), p(SIN_SENAL_MINUTOS))).toBe(false);
    expect(hayHuecoEntre(p(0), p(SIN_SENAL_MINUTOS + 1))).toBe(true);
    expect(huecosDeSenal([p(0), p(16)])).toHaveLength(1);
    expect(partirEnHuecos([p(0), p(16)])).toHaveLength(2);
  });

  it("partirEnHuecos conserva el tipo de punto de quien llama", () => {
    const conEtiqueta = [
      { at: p(0).at, etiqueta: "a" },
      { at: p(1).at, etiqueta: "b" },
      { at: p(40).at, etiqueta: "c" },
    ];
    const tramos = partirEnHuecos(conEtiqueta);
    expect(tramos.map((t) => t.map((q) => q.etiqueta))).toEqual([["a", "b"], ["c"]]);
  });

  it("una traza vacía no tiene tramos", () => {
    expect(partirEnHuecos([])).toEqual([]);
  });
});
