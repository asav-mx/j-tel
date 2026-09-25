/**
 * **Las tres alturas de la hoja inferior**, y a cuál cae cuando la sueltas.
 *
 * El estándar las nombra —asomada, media y completa— y dice cómo se mueve entre
 * ellas: «sube en 0.6 s `--ease`, sin rebote». Lo que no dice, porque es del
 * teléfono y no del dibujo, es **dónde cae la hoja cuando el dedo la suelta a
 * media camino**. Eso se decide aquí, en un archivo sin React ni DOM, para que
 * se pueda probar sin navegador.
 *
 * ## Por qué fracciones de la pantalla y no píxeles
 *
 * La hoja tapa el mapa, y lo que importa es **cuánto mapa queda**. En un
 * teléfono chico 400 px son casi toda la pantalla y en uno grande son la mitad:
 * una altura en píxeles tapa cosas distintas en cada aparato. La fracción dice
 * lo que se quiere decir —«la media deja ver la mitad del mapa»— en todos.
 *
 * ## Por qué la asomada no es cero
 *
 * Asomada es una altura, no «cerrada». Sigue enseñando la parada y su primera
 * fila; es el estado del §2 del diseño («abajo del mapa siempre se asoma la
 * parada más cerca de ti»). Cerrar es otra cosa y tiene su propio veredicto.
 */

export type AlturaDeLaHoja = "asomada" | "media" | "completa";

/**
 * Qué fracción del alto de la pantalla ocupa cada altura.
 *
 * **Salen de medir las tres láminas**, no de escogerlas a ojo. El método: en cada
 * captura de `docs/diseno/app-v1/capturas/2-mapa/` se localiza el área de la
 * pantalla dentro del marco del teléfono (1055 px de alto) y se busca el
 * renglón más alto desde el cual el color hueso domina a lo ancho hasta abajo.
 * Ese renglón es el borde superior de la hoja.
 *
 * | Altura | Lámina | Borde | Fracción |
 * |---|---|---|---|
 * | asomada | `01-mapa-asomada-dia.png` | y=732 | 0.318 |
 * | media | `02-mapa-hoja-media-dia.png` | y=418 | 0.615 |
 * | completa | `03-mapa-hoja-completa.png` | y=80 | 0.936 |
 *
 * Si alguien cambia una, que sea contra la lámina y volviendo a medir.
 */
export const FRACCION: Record<AlturaDeLaHoja, number> = {
  asomada: 0.318,
  media: 0.615,
  completa: 0.936,
};

/** Las tres, de la más baja a la más alta. */
export const ALTURAS: AlturaDeLaHoja[] = ["asomada", "media", "completa"];

/**
 * **Dónde cae la hoja al soltarla**, dada la fracción en la que quedó el dedo.
 *
 * `"cerrar"` cuando quedó por debajo de la mitad de la asomada: arrastrar hacia
 * abajo hasta casi desaparecer es la forma natural de cerrar una hoja, y si en
 * vez de cerrarse rebotara a la asomada el gesto no tendría respuesta.
 *
 * El resto es la altura **más cercana**, sin memoria de dónde venía. Un umbral
 * que dependiera de la dirección del arrastre («si venías de la media, se
 * necesita más para llegar a la completa») haría que el mismo punto de la
 * pantalla diera dos resultados distintos, y eso no se puede aprender usándolo.
 *
 * @param fraccion cuánto de la pantalla ocupa la hoja ahora mismo, de 0 a 1.
 */
export function alSoltar(fraccion: number): AlturaDeLaHoja | "cerrar" {
  if (!Number.isFinite(fraccion)) return "media";
  if (fraccion < FRACCION.asomada / 2) return "cerrar";
  let cerca: AlturaDeLaHoja = "asomada";
  for (const a of ALTURAS) {
    if (Math.abs(FRACCION[a] - fraccion) < Math.abs(FRACCION[cerca] - fraccion)) cerca = a;
  }
  return cerca;
}

/**
 * La altura de arriba y la de abajo, para las flechas del teclado.
 *
 * La hoja se arrastra con el dedo, pero **un arrastre no es alcanzable con
 * teclado ni con un conmutador**, y el asa es el único control que la mueve. Sin
 * esto, quien navega con teclado sólo tendría la altura con la que abrió. Es la
 * misma razón por la que reordenar paradas responde a las flechas.
 */
export function masArriba(a: AlturaDeLaHoja): AlturaDeLaHoja {
  return ALTURAS[Math.min(ALTURAS.indexOf(a) + 1, ALTURAS.length - 1)];
}

export function masAbajo(a: AlturaDeLaHoja): AlturaDeLaHoja {
  return ALTURAS[Math.max(ALTURAS.indexOf(a) - 1, 0)];
}
