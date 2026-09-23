/**
 * Qué trozo del fotograma se analiza — el arreglo del 23-sep-2026.
 *
 * ## Por qué existe este archivo
 *
 * El lector no leía con teléfonos de verdad. La causa, medida: **encogía cada
 * fotograma a 480 px de lado** antes de buscarle el código. Nuestro QR tiene 67
 * módulos, y con el desenfoque normal de una cámara —el que deja un pulso o un
 * enfoque a medias— jsQR necesita **4 píxeles por módulo**, o sea que el código
 * tiene que ocupar **268 px del cuadro analizado**. Con un cuadro de 480 px eso
 * obliga a que el QR llene el 56 % del ancho de la cámara: el teléfono casi
 * pegado al lente. A la distancia de una puerta de camión ocupa cerca del 8 %,
 * que da menos de 1 px por módulo. Imposible, no difícil.
 *
 * La medición está en `leer-qr.test.ts`, con desenfoque de verdad.
 *
 * ## Lo que hace ahora
 *
 * **Recorta en vez de escalar.** Toma el cuadrado centrado del fotograma a su
 * resolución nativa. De un 1280×720 salen 720×720 reales; de un 1920×1080,
 * 1080×1080. Sólo hay tope para no analizar un 4K entero, y ese tope está muy
 * por encima de lo que da un teléfono.
 *
 * **Y es el mismo cuadrado que se ve.** La caja de la cámara es cuadrada y
 * recorta con `object-fit: cover`, así que lo que encuadra el chofer es
 * exactamente lo que se analiza. Antes la mira eran 128 px decorativos mientras
 * se analizaba el fotograma entero: apuntar no servía de nada.
 */

/** Tope del cuadro analizado. No encoge nada que dé un teléfono; sólo evita un 4K. */
export const TOPE_DEL_ANALISIS = 1080;

/** Cuántos píxeles por módulo pide jsQR con el desenfoque de una cámara real. */
export const PIXELES_POR_MODULO = 4;

export interface Encuadre {
  /** De dónde se recorta, en el fotograma original. */
  readonly ox: number;
  readonly oy: number;
  readonly lado: number;
  /** El lado del cuadro que se analiza. Igual a `lado` salvo que haya tope. */
  readonly analisis: number;
}

/** El cuadrado centrado del fotograma, sin encoger salvo que pase del tope. */
export function cuadroDeAnalisis(
  ancho: number,
  alto: number,
  tope: number = TOPE_DEL_ANALISIS,
): Encuadre | null {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho < 1 || alto < 1) return null;
  const lado = Math.floor(Math.min(ancho, alto));
  return {
    ox: Math.floor((ancho - lado) / 2),
    oy: Math.floor((alto - lado) / 2),
    lado,
    analisis: Math.min(lado, tope),
  };
}

/**
 * Qué tan grande tiene que verse el código dentro del cuadro para que se lea.
 * No decide nada: es el número que la línea de diagnóstico del lector enseña,
 * para que una prueba fallida en la calle vuelva con un dato y no con «no
 * engancha».
 */
export const fraccionQueNecesitaElCodigo = (analisis: number, modulos = 67): number =>
  (modulos * PIXELES_POR_MODULO) / analisis;
