/**
 * Qué trozo del fotograma se analiza, y de qué tamaño.
 *
 * ## Escalar y recortar no son lo mismo, y confundirlos ya costó dos rondas
 *
 * **Escalar** 1080 → 640 reparte los mismos 67 módulos del código en menos
 * píxeles: pierde densidad, y ése fue el defecto que impedía leer con teléfonos
 * de verdad (23-sep, primera ronda).
 *
 * **Recortar** 640 del centro de 1080 se queda con píxeles **nativos**: cada
 * módulo sigue midiendo lo mismo, sólo se mira una ventana más chica. Cuesta
 * 2.8 veces menos y no pierde ni un píxel por módulo. La distancia a la que el
 * lector funciona **no cambia** al recortar; lo único que cambia es cuánta
 * puntería pide.
 *
 * Aquí eso ya no se puede equivocar: {@link Encuadre} tiene **un solo número**.
 * El trozo que se toma del fotograma y el lienzo donde se analiza son el mismo
 * tamaño por construcción, así que no hay dónde meter un escalado.
 *
 * ## Por qué el recorte se mueve solo
 *
 * Un recorte fijo no sirve para todos los aparatos. En el teléfono de ASAV,
 * analizar 1080×1080 tardaba **entre 100 y 1130 ms** —6 o 7 cuadros por
 * segundo—, y con la cámara enfocando de vez en cuando, la ventana para atrapar
 * un cuadro nítido era diminuta. Un recorte chico fijo, en cambio, le quitaría
 * alcance a un teléfono rápido.
 *
 * Así que el lector **se mide a sí mismo** y ajusta el recorte para que un
 * barrido quepa en {@link PRESUPUESTO_MS}. Más cuadros por segundo es más
 * oportunidades de que uno caiga justo cuando la cámara enfocó.
 */

/** Con qué recorte arranca, antes de saber qué tan rápido es el aparato. */
export const RECORTE_INICIAL = 640;
/** Nunca más chico: por debajo de esto la puntería que pide es irrazonable. */
export const RECORTE_MINIMO = 480;
/** Nunca más grande: de aquí para arriba no compra alcance, sólo tarda. */
export const RECORTE_MAXIMO = 900;
/** Lo que debería tardar un barrido. De aquí sale el ajuste. */
export const PRESUPUESTO_MS = 120;

/** Cuántos píxeles por módulo pide jsQR con el desenfoque de una cámara real. */
export const PIXELES_POR_MODULO = 4;

export interface Encuadre {
  /** De dónde se recorta, en el fotograma original. */
  readonly ox: number;
  readonly oy: number;
  /**
   * El lado del recorte **y** el del lienzo que se analiza: son el mismo
   * número a propósito. Uno a uno, sin escalar nunca.
   */
  readonly lado: number;
}

/**
 * El cuadrado centrado del fotograma, del tamaño pedido y **a resolución
 * nativa**. Si el fotograma es más chico que el recorte, manda el fotograma.
 */
export function cuadroDeAnalisis(
  ancho: number,
  alto: number,
  recorte: number = RECORTE_INICIAL,
): Encuadre | null {
  if (![ancho, alto, recorte].every((n) => Number.isFinite(n) && n >= 1)) return null;
  const lado = Math.floor(Math.min(ancho, alto, recorte));
  return {
    ox: Math.floor((ancho - lado) / 2),
    oy: Math.floor((alto - lado) / 2),
    lado,
  };
}

/**
 * El recorte para el siguiente barrido, según lo que tardó el anterior.
 *
 * Baja rápido y sube despacio: quedarse lento es peor que quedarse corto de
 * alcance, porque sin cuadros no hay ninguna oportunidad de atrapar uno nítido.
 * Los pasos son pequeños para que no oscile entre dos tamaños.
 */
export function siguienteRecorte(actual: number, ms: number): number {
  const objetivo =
    ms > PRESUPUESTO_MS * 1.3
      ? actual * 0.85
      : ms < PRESUPUESTO_MS * 0.6
        ? actual * 1.1
        : actual;
  return Math.round(Math.min(RECORTE_MAXIMO, Math.max(RECORTE_MINIMO, objetivo)));
}

/**
 * Qué parte de la caja de la cámara ocupa la mira, entre 0 y 1.
 *
 * Se dibuja del tamaño del recorte **mínimo**, no del que esté en uso: así la
 * mira **nunca se mueve** mientras alguien apunta, y lo que quede dentro de
 * ella está siempre dentro de lo que se analiza, aunque el recorte crezca. La
 * promesa «lo que ves es lo que se lee» se cumple por el lado seguro.
 */
export const fraccionDeLaMira = (ladoDelFotograma: number): number =>
  Math.min(1, RECORTE_MINIMO / Math.max(1, ladoDelFotograma));

/**
 * Qué tan grande tiene que verse el código dentro del recorte para que se lea.
 * No decide nada: alimenta la línea de diagnóstico, para que una prueba fallida
 * en la calle vuelva con un dato y no con «no engancha».
 */
export const fraccionQueNecesitaElCodigo = (lado: number, modulos = 67): number =>
  (modulos * PIXELES_POR_MODULO) / lado;
