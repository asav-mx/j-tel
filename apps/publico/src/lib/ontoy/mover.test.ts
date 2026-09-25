import { describe, expect, it } from "vitest";
import { mover } from "./paradas-guardadas";

/*
 * **Mover una parada de lugar.**
 *
 * ## Qué NO prueba
 *
 * **No prueba el gesto.** Que el dedo arrastre, que la lista haga hueco y que
 * se suelte donde se ve — eso se mira. Esto prueba la cuenta de abajo, que es
 * la que se equivoca en silencio: los índices al mover hacia adelante no son
 * los mismos que al mover hacia atrás, y el error se ve como «se fue un lugar
 * de más» en vez de como una excepción.
 */

const l = ["a", "b", "c", "d"];

describe("mover", () => {
  it("hacia adelante cae donde se soltó, no un lugar antes", () => {
    /*
     * La trampa clásica: al sacar el elemento, todo lo de la derecha se corre
     * uno. Insertar en el índice original lo deja un lugar antes.
     */
    expect(mover(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("hacia atrás también", () => {
    expect(mover(l, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("al mismo lugar devuelve la MISMA lista, no una copia", () => {
    /* Así quien escucha el cambio no escribe el teléfono por un gesto que no movió nada. */
    expect(mover(l, 1, 1)).toBe(l);
  });

  it("soltarla fuera de la lista la deja en la orilla, sin perderla", () => {
    /*
     * Un gesto que se suelta debajo del último manda un índice de más. Lo
     * correcto es dejarla al final —donde el dedo la soltó— y no tirarla.
     */
    expect(mover(l, 0, 99)).toEqual(["b", "c", "d", "a"]);
    expect(mover(l, 3, -5)).toEqual(["d", "a", "b", "c"]);
  });

  it("un origen que no existe no rompe la lista", () => {
    expect(mover(l, 9, 0)).toBe(l);
    expect(mover([], 0, 0)).toEqual([]);
  });

  it("no toca la lista original", () => {
    const copia = [...l];
    mover(l, 0, 2);
    expect(l).toEqual(copia);
  });
});
