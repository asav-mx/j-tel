/**
 * El adelgazador es la pieza de la que cuelga todo el argumento de C19: si
 * adelgaza mal, la caída de cobertura que se le atribuye a la densidad puede
 * ser suya. Por eso se cerca aparte de la medición.
 *
 * Lo que estas pruebas protegen no es «que quite puntos» —eso se ve— sino las
 * tres formas en que podría quitar los equivocados sin que nada se pusiera en
 * rojo: que no sea determinista, que mida el hueco contra el punto anterior en
 * vez de contra el último CONSERVADO, y que dependa del orden en que la base
 * devolvió las filas.
 */
import { describe, expect, it } from "vitest";
import type { GpsPoint } from "@jtel/domain";
import { adelgazar } from "./medir-efecto-densidad.js";

const t0 = new Date("2026-08-11T06:00:00Z").getTime();

/** Puntos cada `cada` segundos, con posición irrelevante para esta prueba. */
function serie(cuantos: number, cada: number): GpsPoint[] {
  return Array.from({ length: cuantos }, (_, i) => ({
    latitude: 31.7 + i * 0.001,
    longitude: -106.4,
    timestamp: new Date(t0 + i * cada * 1000),
    imei: "A",
  }));
}

describe("adelgazar", () => {
  it("sin puntos no inventa ninguno", () => {
    expect(adelgazar([], 60)).toEqual([]);
  });

  it("conserva siempre el primero, que es el ancla del intervalo", () => {
    const s = serie(5, 20);
    expect(adelgazar(s, 60)[0]!.timestamp).toEqual(s[0]!.timestamp);
  });

  it("una serie de 20 s adelgazada a 60 s deja uno de cada tres", () => {
    // 0,20,40,60,80,100,120 → conserva 0, 60, 120
    const r = adelgazar(serie(7, 20), 60);
    expect(r.map((p) => (p.timestamp.getTime() - t0) / 1000)).toEqual([0, 60, 120]);
  });

  /*
   * El error que esta prueba existe para atrapar: medir el hueco contra el
   * punto ANTERIOR en vez de contra el último CONSERVADO. Con puntos cada 40 s
   * y un umbral de 60, la versión mala conservaría uno sí y uno no —porque 80
   * está a 40 del 40, que descartó— y dejaría una serie de 80 s en vez de 120.
   * Adelgazaría de más, y la caída de cobertura que se le atribuye a la
   * densidad sería mitad suya.
   */
  it("el hueco se mide contra el último CONSERVADO, no contra el anterior", () => {
    // 0,40,80,120,160 con umbral 60 → conserva 0, 80, 160
    const r = adelgazar(serie(5, 40), 60);
    expect(r.map((p) => (p.timestamp.getTime() - t0) / 1000)).toEqual([0, 80, 160]);
  });

  it("un umbral menor al intervalo real no quita nada", () => {
    expect(adelgazar(serie(10, 60), 40)).toHaveLength(10);
  });

  /*
   * Determinista y ciego al orden de llegada: dos corridas sobre los mismos
   * datos tienen que dar lo mismo, o «antes y después» deja de ser comparable
   * — que es la única razón por la que esta medición sirve de algo.
   */
  it("es determinista", () => {
    const s = serie(50, 17);
    expect(adelgazar(s, 60)).toEqual(adelgazar(s, 60));
  });

  it("no depende del orden en que lleguen los puntos", () => {
    const s = serie(20, 25);
    const revuelto = [...s].reverse();
    expect(adelgazar(revuelto, 60).map((p) => p.timestamp.getTime())).toEqual(
      adelgazar(s, 60).map((p) => p.timestamp.getTime()),
    );
  });

  it("no muta la serie que recibe", () => {
    const s = serie(10, 20);
    const copia = [...s];
    adelgazar(s, 60);
    expect(s).toEqual(copia);
  });
});
