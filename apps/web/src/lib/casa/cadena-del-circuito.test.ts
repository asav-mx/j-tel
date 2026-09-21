import { describe, expect, it } from "vitest";
import { loMinimoParaMedir } from "@jtel/services";
import { cadenaDelCircuito, loQueFaltaEnPalabras, type DatosDeLaCadena } from "./cadena-del-circuito";

function datos(e: Partial<Omit<DatosDeLaCadena, "minimo">> = {}): DatosDeLaCadena {
  const base = {
    trazados: [
      { sentido: "ida" as const, puntos: 120 },
      { sentido: "vuelta" as const, puntos: 110 },
    ],
    paradas: [{ sentido: null }, { sentido: null }, { sentido: "ida" as const }],
    franjasDeLaPromesa: 3,
    unidadesAsignadas: 2,
    publicado: true,
    ...e,
  };
  return { ...base, minimo: loMinimoParaMedir(base) };
}
const resumen = (d: DatosDeLaCadena) => cadenaDelCircuito(d).map((x) => `${x.nombre}: ${x.resumen}${x.pide ? " ·pide" : ""}`);

describe("cadenaDelCircuito — la lista y el expediente dicen lo mismo", () => {
  it("un circuito con todo: nada pide, y medición lista", () => {
    expect(resumen(datos())).toEqual([
      "Identidad: completa",
      "Trazado: ida y vuelta",
      "Paradas: 3",
      "Promesa: 3 franjas",
      "Unidades: 2 asignadas",
      "Medición: lista para medir",
      "Publicar: publicado",
    ]);
  });

  it("recién creado: pide trazado, paradas, promesa y unidades — y medición", () => {
    const d = datos({ trazados: [], paradas: [], franjasDeLaPromesa: null, unidadesAsignadas: 0, publicado: false });
    expect(cadenaDelCircuito(d).filter((x) => x.pide).map((x) => x.nombre)).toEqual([
      "Trazado",
      "Paradas",
      "Promesa",
      "Unidades",
      "Medición",
    ]);
  });

  it("publicar nunca pide: es acto de quien opera", () => {
    const d = datos({ trazados: [], publicado: false });
    expect(cadenaDelCircuito(d).find((x) => x.paso === 7)!.pide).toBe(false);
  });

  it("paradas que no alcanzan para un carril lo dicen, no sólo el número", () => {
    expect(resumen(datos({ paradas: [{ sentido: "ida" }] }))[2]).toBe("Paradas: 1 · sin carril ·pide");
  });

  it("asignadas, no corriendo: la palabra es «asignada»", () => {
    expect(JSON.stringify(cadenaDelCircuito(datos()))).not.toMatch(/corriendo|al aire/);
  });

  it("la frase de lo que falta sale de la misma definición que la torre", () => {
    expect(loQueFaltaEnPalabras(datos().minimo)).toBe("Tiene lo mínimo para medir.");
    expect(loQueFaltaEnPalabras(datos({ unidadesAsignadas: 0, franjasDeLaPromesa: null }).minimo)).toBe(
      "Para medir: falta la promesa · sin unidades asignadas.",
    );
  });
});
