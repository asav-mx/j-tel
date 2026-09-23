/**
 * **Qué paradas llevan su nombre escrito en el carril** (ASAV, 22-sep-2026).
 *
 * ## El defecto que esto corrige
 *
 * Las paradas se reparten parejas a lo largo del carril y su nombre va centrado
 * bajo el tique, sin cortarse. Con 17 paradas cada una tiene `94 % / 16` del
 * ancho —unos 79 px en un carril de 1354—, y un nombre real como
 * «Fraccionamiento Praderas del Sur Segunda Etapa» mide cerca de 250. Los
 * rótulos se encaramaban y el carril quedaba ilegible.
 *
 * ## Se ralea, no se acorta
 *
 * **El nombre de la parada no se toca**: es dato del circuito. Aquí se decide
 * *cuáles* se escriben, no *cómo*. Cortarlos todos a 79 px daría diecisiete
 * «Fraccionamien…» igual de inútiles; rotarlos 45° los deja caber y se leen
 * peor, y en pantalla angosta se vuelven a encimar.
 *
 * ## Por qué esto recibe los anchos MEDIDOS y no los adivina
 *
 * La primera versión usaba un hueco mínimo constante —«un rótulo necesita
 * 78 px»— y **la captura la desmintió**: el carril daba 79,5 px por parada, la
 * regla dijo «caben todas», y los nombres largos siguieron encaramados. Un
 * ancho supuesto no puede saber que una parada se llama «Fraccionamiento
 * Praderas del Sur Segunda Etapa» y otra «Centro».
 *
 * Así que la decisión vive aquí, pura y probada, y **quien la llama le pasa lo
 * que midió**. El componente mide; esto decide.
 *
 * ## Las que NUNCA se ralean
 *
 * Los **extremos** —de dónde sale y a dónde llega el carril—, la
 * **seleccionada** y las **vencidas**. Una parada que se pasó de su rango es
 * justo la que hay que poder nombrar por radio (9.2b): esconder su nombre
 * convertiría el cobre en un tique anónimo.
 *
 * Las que se quedan sin rótulo **conservan su tique y su zona de toque**, y al
 * tocarlas su detalle dice el nombre completo.
 */

/** Aire entre dos rótulos vecinos para que no se toquen. */
export const HOLGURA_PX = 10;

export interface RotuloMedido {
  /** Centro del rótulo sobre el carril, en píxeles. */
  centroPx: number;
  /** Lo que mide el nombre dibujado, sin cortar. */
  anchoPx: number;
}

/**
 * @param medidos Uno por parada, en el orden del carril.
 * @param forzados Índices que se escriben aunque choquen (seleccionada, vencidas).
 */
export function rotulosQueCaben(
  medidos: RotuloMedido[],
  forzados: ReadonlySet<number> = new Set(),
): Set<number> {
  const cuantas = medidos.length;
  const visibles = new Set<number>();
  if (cuantas === 0) return visibles;

  /*
   * Antes de medir (primer dibujo) se enseñan TODAS: el carril se ve un
   * instante apretado, que es mejor que verlo un instante incompleto y que los
   * nombres aparezcan solos después.
   */
  if (medidos.every((m) => m.anchoPx <= 0)) {
    for (let i = 0; i < cuantas; i++) visibles.add(i);
    return visibles;
  }

  const caja = (i: number) => {
    const m = medidos[i]!;
    return { de: m.centroPx - m.anchoPx / 2, a: m.centroPx + m.anchoPx / 2 };
  };
  const chocan = (a: number, b: number) => {
    const x = caja(a);
    const y = caja(b);
    return x.de - HOLGURA_PX < y.a && y.de - HOLGURA_PX < x.a;
  };

  /*
   * Primero los que no se negocian —extremos y forzados—, y luego el resto de
   * izquierda a derecha. El orden importa: si los forzados entraran al final,
   * un vecino cualquiera les habría ganado el lugar y habría que quitarlo.
   */
  const primero = [0, cuantas - 1, ...forzados].filter((i) => i >= 0 && i < cuantas);
  for (const i of primero) {
    if (![...visibles].some((v) => chocan(i, v))) visibles.add(i);
  }
  /*
   * Un forzado que choca con otro forzado entra igual: los dos piden ser
   * nombrados y callar uno sería escoger a cuál parada se le puede hablar.
   */
  for (const i of forzados) if (i >= 0 && i < cuantas) visibles.add(i);

  for (let i = 0; i < cuantas; i++) {
    if (visibles.has(i)) continue;
    if (![...visibles].some((v) => chocan(i, v))) visibles.add(i);
  }

  return visibles;
}
