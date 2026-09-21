import { describe, expect, it } from "vitest";
import { loMinimoParaMedir, type EntradaLoMinimo } from "./lo-minimo-para-medir.js";

const COMPLETO: EntradaLoMinimo = {
  trazados: [
    { sentido: "ida", puntos: 120 },
    { sentido: "vuelta", puntos: 118 },
  ],
  paradas: [{ sentido: "ida" }, { sentido: "ida" }, { sentido: "vuelta" }, { sentido: null }],
  franjasDeLaPromesa: 3,
  unidadesAsignadas: 2,
};
const requisitos = (e: EntradaLoMinimo) => loMinimoParaMedir(e).faltan.map((f) => f.requisito);

describe("loMinimoParaMedir — una sola definición para el expediente y la torre", () => {
  it("con las cuatro cosas está listo, y los dos sentidos tienen carril", () => {
    expect(loMinimoParaMedir(COMPLETO)).toEqual({ carriles: ["ida", "vuelta"], faltan: [], listo: true });
  });

  it("un carril necesita dos paradas: una parada de «los dos» cuenta en cada sentido", () => {
    const r = loMinimoParaMedir({ ...COMPLETO, paradas: [{ sentido: "ida" }, { sentido: null }] });
    expect(r.carriles).toEqual(["ida"]);
    expect(r.listo).toBe(true);
  });

  it("sin trazado no hay carril aunque haya paradas, y lo dice por su nombre", () => {
    const r = loMinimoParaMedir({ ...COMPLETO, trazados: [] });
    expect(r.faltan.map((f) => f.frase)).toEqual([
      "falta el trazado",
      "ningún sentido tiene dos paradas sobre su trazado",
    ]);
  });

  it("un trazado de un punto no es un trazado", () => {
    expect(requisitos({ ...COMPLETO, trazados: [{ sentido: "ida", puntos: 1 }] })).toContain("trazado");
  });

  it("sin paradas se dice distinto que con paradas que no alcanzan", () => {
    expect(loMinimoParaMedir({ ...COMPLETO, paradas: [] }).faltan[0]!.frase).toBe("faltan las paradas");
    expect(loMinimoParaMedir({ ...COMPLETO, paradas: [{ sentido: "ida" }] }).faltan[0]!.frase).toBe(
      "ningún sentido tiene dos paradas sobre su trazado",
    );
  });

  it("promesa nunca capturada y promesa sin franjas son dos cosas", () => {
    expect(loMinimoParaMedir({ ...COMPLETO, franjasDeLaPromesa: null }).faltan[0]!.frase).toBe("falta la promesa");
    expect(loMinimoParaMedir({ ...COMPLETO, franjasDeLaPromesa: 0 }).faltan[0]!.frase).toBe(
      "la promesa no tiene franjas",
    );
  });

  it("sin unidades ASIGNADAS falta; que ninguna esté al aire no es cosa de este módulo", () => {
    expect(requisitos({ ...COMPLETO, unidadesAsignadas: 0 })).toEqual(["unidades"]);
  });

  it("no habla de publicar: publicar es acto de quien opera", () => {
    expect(JSON.stringify(loMinimoParaMedir({ ...COMPLETO, trazados: [], paradas: [] }))).not.toMatch(/publica/i);
  });
});
