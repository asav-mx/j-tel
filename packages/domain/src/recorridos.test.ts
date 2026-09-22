import { describe, expect, it } from "vitest";
import { MINIMO_TRAVESIAS, recorridosPorTramo, type PasoDeUnaUnidad } from "./recorridos.js";

/*
 * El recorrido por tramo, agregado (8.16.5). Aritmética pura: pasos adentro,
 * tramos afuera. Los pasos son rangos —los dos pings que encierran el cruce—,
 * así que el tramo también.
 */

const T0 = Date.UTC(2026, 8, 22, 12, 0, 0);
const p = (
  unidad: string,
  parada: string,
  orden: number,
  desdeSeg: number,
  anchoSeg = 20,
  sentido: "ida" | "vuelta" = "ida",
): PasoDeUnaUnidad => ({
  unidad,
  sentido,
  parada,
  orden,
  desde: new Date(T0 + desdeSeg * 1000),
  hasta: new Date(T0 + (desdeSeg + anchoSeg) * 1000),
});

/** `n` travesías de A→B, cada una de `duracion` segundos entre el fin de A y el inicio de B. */
const travesias = (n: number, duracion = 300, unidad = "u1"): PasoDeUnaUnidad[] =>
  Array.from({ length: n }, (_, i) => {
    const arranque = i * 3600;
    return [p(unidad, "A", 1, arranque), p(unidad, "B", 2, arranque + 20 + duracion)];
  }).flat();

describe("recorridosPorTramo", () => {
  it("con travesías suficientes publica el tramo, con su rango y su mediana", () => {
    const r = recorridosPorTramo(travesias(10, 300));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ sentido: "ida", de: "A", a: "B", travesias: 10 });
    // Lo menos: del fin de A al inicio de B = 300. Lo más: 300 + los dos anchos = 340.
    expect(r[0]!.desdeSeg).toBe(300);
    expect(r[0]!.hastaSeg).toBe(340);
    expect(r[0]!.medianaSeg).toBe(320);
  });

  it(`con menos de ${MINIMO_TRAVESIAS} travesías no publica nada: la app dirá «se está midiendo»`, () => {
    expect(recorridosPorTramo(travesias(9))).toEqual([]);
  });

  it("junta las travesías de TODAS las unidades del circuito: es un agregado, no una por camión", () => {
    const r = recorridosPorTramo([...travesias(5, 300, "u1"), ...travesias(5, 300, "u2")]);
    expect(r[0]!.travesias).toBe(10);
  });

  it("nada de la unidad sale en el agregado", () => {
    const r = recorridosPorTramo(travesias(10, 300, "unidad-que-no-debe-salir"));
    expect(JSON.stringify(r)).not.toContain("unidad");
    expect(Object.keys(r[0]!).sort()).toEqual(["a", "de", "desdeSeg", "hastaSeg", "medianaSeg", "sentido", "travesias"]);
  });

  it("si el detector se saltó una parada, el salto no cuenta como tramo", () => {
    // A (orden 1) → C (orden 3): dos tramos en uno. No se publica.
    const pasos = Array.from({ length: 10 }, (_, i) => [p("u1", "A", 1, i * 3600), p("u1", "C", 3, i * 3600 + 600)]).flat();
    expect(recorridosPorTramo(pasos)).toEqual([]);
  });

  it("una travesía de más de una hora es un hueco del instrumento, no un tramo", () => {
    expect(recorridosPorTramo(travesias(10, 3700))).toEqual([]);
  });

  it("el mismo cruce contado dos veces no infla las travesías (el detector se apila, no se pisa)", () => {
    const unos = travesias(10, 300);
    const r = recorridosPorTramo([...unos, ...unos]);
    expect(r[0]!.travesias).toBe(10);
  });

  it("ida y vuelta son tramos distintos", () => {
    const ida = travesias(10, 300);
    const vuelta = Array.from({ length: 10 }, (_, i) => [
      p("u1", "B", 1, i * 3600 + 1800, 20, "vuelta"),
      p("u1", "A", 2, i * 3600 + 2200, 20, "vuelta"),
    ]).flat();
    const r = recorridosPorTramo([...ida, ...vuelta]);
    expect(r.map((x) => [x.sentido, x.de, x.a])).toEqual([
      ["ida", "A", "B"],
      ["vuelta", "B", "A"],
    ]);
  });

  it("un semáforo largo suelto no estira el rango publicado (p25 y p75, no mínimo y máximo)", () => {
    const normales = travesias(10, 300);
    const atorada = [p("u2", "A", 1, 0), p("u2", "B", 2, 20 + 1800)];
    const r = recorridosPorTramo([...normales, ...atorada]);
    expect(r[0]!.travesias).toBe(11);
    expect(r[0]!.hastaSeg).toBeLessThan(600); // la de 30 min no arrastra el techo
  });

  it("dos pasos que se traslapan no afirman nada", () => {
    const pasos = Array.from({ length: 10 }, (_, i) => [
      p("u1", "A", 1, i * 3600, 600),
      p("u1", "B", 2, i * 3600 + 300, 20),
    ]).flat();
    expect(recorridosPorTramo(pasos)).toEqual([]);
  });
});
