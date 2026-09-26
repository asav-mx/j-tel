import { describe, expect, it } from "vitest";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import { paradaAsomada, porQueEnPalabras } from "./parada-asomada";

/**
 * **Lo que esta valla NO prueba.**
 *
 * No prueba que la hoja asomada se vea como la lámina, ni que la llegada que
 * enseña sea la correcta: eso es de la hoja y de la revisión visual. Prueba la
 * **regla de ASAV y su orden** —la más cerca; sin ubicación, la guardada; sin
 * nada, nada— y el texto que la explica, que es lo que se puede romper
 * editando código sin que ninguna captura lo delate.
 */

const p = (id: string, ruta: string, lat: number, lon = -106.45): ParadaDeLaCiudad => ({
  id,
  ruta,
  nombre: `Parada ${id}`,
  sentido: null,
  lat,
  lon,
});

/* Tres paradas en fila sobre el mismo meridiano; «yo» está junto a la B. */
const A = p("a", "r1", 31.7);
const B = p("b", "r1", 31.71);
const C = p("c", "r2", 31.72);
const TODAS = [A, B, C];
const NINGUNA = new Set<string>();
const JUNTO_A_B = { lat: 31.7101, lon: -106.45 };

describe("qué parada se asoma", () => {
  it("con ubicación: LA MÁS CERCA, y dice a cuánto", () => {
    const r = paradaAsomada({ yo: JUNTO_A_B, paradas: TODAS, apagadas: NINGUNA, guardadas: [] });
    expect(r?.id).toBe("b");
    expect(r?.porQue.tipo).toBe("la-mas-cerca");
    if (r?.porQue.tipo === "la-mas-cerca") expect(r.porQue.distanciaM).toBeLessThan(20);
  });

  it("con ubicación manda la cercanía AUNQUE haya guardadas", () => {
    /* La regla dice «la más cerca de ti» primero. Una guardada lejana no le
       gana a la parada donde estás parado. */
    const r = paradaAsomada({
      yo: JUNTO_A_B,
      paradas: TODAS,
      apagadas: NINGUNA,
      guardadas: [{ parada: "c", ruta: "r2" }],
    });
    expect(r?.id).toBe("b");
  });

  it("una ruta APAGADA con su ojo no se asoma, aunque sea la más cercana", () => {
    /* El ojo manda sobre la asomada igual que sobre el dibujo: el pasajero que
       dijo «ésta no» no la ve volver por abajo. */
    const r = paradaAsomada({
      yo: JUNTO_A_B,
      paradas: TODAS,
      apagadas: new Set(["r1"]),
      guardadas: [],
    });
    expect(r?.id).toBe("c");
  });

  it("sin ubicación: la PRIMERA guardada, en el orden del pasajero", () => {
    /* No la más cercana —no hay con qué medir— ni la alfabética: la que puso
       arriba en «Tus paradas». */
    const r = paradaAsomada({
      yo: null,
      paradas: TODAS,
      apagadas: NINGUNA,
      guardadas: [
        { parada: "c", ruta: "r2" },
        { parada: "a", ruta: "r1" },
      ],
    });
    expect(r?.id).toBe("c");
    expect(r?.porQue.tipo).toBe("tu-guardada");
  });

  it("una guardada que ya no existe, o de una ruta apagada, se salta: no se asoma un fantasma", () => {
    const r = paradaAsomada({
      yo: null,
      paradas: TODAS,
      apagadas: new Set(["r2"]),
      guardadas: [
        { parada: "retirada", ruta: "r1" },
        { parada: "c", ruta: "r2" },
        { parada: "a", ruta: "r1" },
      ],
    });
    expect(r?.id).toBe("a");
  });

  it("sin ubicación, la guardada se asoma AUNQUE su ruta no esté en la tira", () => {
    /*
     * El defecto que enseñó la primera captura: sin ubicación la tira es
     * alfabética, y filtrar por «lo que está en la tira» dejaba fuera a una
     * guardada por el alfabeto. Sólo el ojo excluye; «no estar entre las
     * primeras» no es una decisión del pasajero.
     */
    const r = paradaAsomada({
      yo: null,
      paradas: TODAS,
      apagadas: NINGUNA,
      guardadas: [{ parada: "c", ruta: "r2" }],
    });
    expect(r?.id).toBe("c");
    expect(r?.porQue.tipo).toBe("tu-guardada");
  });

  it("la guardada se busca por parada Y por ruta, no sólo por el id", () => {
    /* Un slug igual en otra ruta no es la misma parada. */
    const r = paradaAsomada({
      yo: null,
      paradas: TODAS,
      apagadas: NINGUNA,
      guardadas: [{ parada: "a", ruta: "r2" }],
    });
    expect(r).toBeNull();
  });

  it("SIN NADA, NADA: ni ubicación ni guardadas no inventan una parada", () => {
    expect(paradaAsomada({ yo: null, paradas: TODAS, apagadas: NINGUNA, guardadas: [] })).toBeNull();
  });

  it("con la lista de la ciudad todavía sin bajar, tampoco inventa", () => {
    expect(
      paradaAsomada({ yo: JUNTO_A_B, paradas: [], apagadas: NINGUNA, guardadas: [{ parada: "a", ruta: "r1" }] }),
    ).toBeNull();
  });

  it("con dos a la MISMA distancia se queda la primera, y no brinca entre sondeos", () => {
    const X = p("x", "r1", 31.71, -106.4501);
    const Y = p("y", "r1", 31.71, -106.4499);
    const yo = { lat: 31.71, lon: -106.45 };
    const una = paradaAsomada({ yo, paradas: [X, Y], apagadas: NINGUNA, guardadas: [] });
    const otra = paradaAsomada({ yo, paradas: [X, Y], apagadas: NINGUNA, guardadas: [] });
    expect(una?.id).toBe("x");
    expect(otra?.id).toBe(una?.id);
  });
});

describe("el renglón de debajo del nombre, como lo escribe el diseño", () => {
  it("la más cerca: con la distancia y «en línea recta»", () => {
    expect(porQueEnPalabras({ tipo: "la-mas-cerca", distanciaM: 88 })).toBe(
      "La más cerca de ti · a 90 m en línea recta",
    );
  });

  it("«en línea recta» se queda también en kilómetros", () => {
    /* No es caminando. Quitarlo en la cifra grande, que es donde más se nota
       la diferencia con el camino de verdad, sería lo peor. */
    expect(porQueEnPalabras({ tipo: "la-mas-cerca", distanciaM: 1234 })).toMatch(/km en línea recta$/);
  });

  it("la guardada dice que es tuya, y no inventa una distancia", () => {
    const t = porQueEnPalabras({ tipo: "tu-guardada" });
    expect(t).toBe("Tu parada guardada");
    expect(t).not.toMatch(/\d/);
  });
});
