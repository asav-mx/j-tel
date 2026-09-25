import type { EstadoDeRuta } from "./estado-de-ruta";

/**
 * **La ciudad cerrada** — cuando ninguna ruta publicada está operando ahorita.
 *
 * ## Por qué esto no es «la ruta está cerrada» repetido
 *
 * Inicio no habla de una ruta: habla de la ciudad. Y una afirmación sobre la
 * ciudad se puede equivocar de una forma que la de una ruta no — la del §D del
 * Marco: **el dato correcto con la afirmación falsa.**
 *
 * El caso concreto: si tres rutas abren a las 5:30 y una a las 9:53, decir
 * «Vuelven a las 5:30» es un valor correcto —es la primera— presentado como si
 * fuera de todas. Quien tome la de las 9:53 sale de su casa tres horas antes.
 *
 * Por eso esto devuelve **dos cosas**: la hora y si todas coinciden. La frase
 * la escoge la pantalla, y es distinta en cada caso.
 *
 * ## Lo que NO cuenta como cerrada
 *
 * **Una ruta por arrancar no está cerrada: no ha abierto nunca.** Si la única
 * ruta de la ciudad todavía no arranca, esto **no** dice que sea de noche — lo
 * que hay que decir ahí es que arranca, y lo dice su propia tarjeta.
 *
 * Y con **cero rutas** tampoco: una ciudad sin rutas publicadas no es una
 * ciudad dormida, es una ciudad sin rutas, que es otra pantalla.
 */
export interface CiudadCerrada {
  /** La primera hora a la que algo vuelve a abrir, `HH:MM`. */
  abre: string;
  /** Si TODAS abren a esa hora. Con `false`, la frase tiene que decir «la primera». */
  todasIgual: boolean;
}

export function ciudadCerrada(estados: EstadoDeRuta[]): CiudadCerrada | null {
  const cerradas = estados.filter((e) => e.situacion === "cerrado");
  /*
   * Todas las que PUEDEN estar abiertas lo están cerradas. Las de «por
   * arrancar» se descuentan del universo en vez de contarse como cerradas: no
   * han abierto nunca, y meterlas volvería «de noche» a una ciudad cuyo único
   * servicio arranca el mes que entra.
   */
  const operables = estados.filter((e) => e.situacion !== "por_arrancar");
  if (operables.length === 0 || cerradas.length !== operables.length) return null;

  const horas = cerradas.map((e) => e.abre_a.slice(0, 5)).filter((h) => /^\d{2}:\d{2}$/.test(h)).sort();
  if (horas.length === 0) return null;

  return { abre: horas[0], todasIgual: new Set(horas).size === 1 };
}

/**
 * La frase, que cambia según coincidan o no.
 *
 * Se escribe aquí y no en el `.tsx` por la razón de siempre —una frase dentro de
 * un componente no se puede probar sin montarlo— y porque **es la frase la que
 * puede mentir**, no el cálculo.
 */
export function vuelvenEnPalabras(c: CiudadCerrada): string {
  return c.todasIgual ? `Vuelven a las ${c.abre}.` : `La primera vuelve a las ${c.abre}.`;
}
