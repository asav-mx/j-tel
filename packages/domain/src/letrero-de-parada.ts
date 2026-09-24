/**
 * **La dirección que va impresa en el letrero de una parada.**
 *
 * Ésta es la única cadena de todo el producto que se **atornilla a un poste**.
 * Un cambio de formato aquí no rompe una pantalla: convierte en callejón cada
 * lámina que ya está en la calle, y nadie puede ir a corregirlas. Por eso vive
 * en el dominio, en un solo lugar, con su prueba —que es lo que se cae si
 * alguien la cambia—, y no armada a mano en la pantalla que imprime.
 *
 * ## Por qué `/p/‹qr_slug›` y no algo más descriptivo
 *
 * Tres razones, en este orden:
 *
 * 1. **Corta.** Un QR crece con lo que lleva adentro: menos caracteres son
 *    menos cuadritos, cuadritos más grandes en la misma lámina, y un enganche
 *    más rápido para alguien parado en la banqueta con el sol de frente.
 * 2. **Sin nombres propios.** Ni el del transportista, ni el de la ruta. La
 *    plataforma no se viste de ninguno, y además una ruta puede cambiar de
 *    nombre: el letrero no.
 * 3. **De la identidad, no de la versión.** El `qr_slug` vive en la identidad
 *    de la parada (0025). Si la parada se mueve media cuadra o la renombran, la
 *    dirección impresa sigue valiendo.
 */

/** La casa de Ontoy, cuando nadie dice otra cosa. */
export const CASA_DE_ONTOY = "https://ontoy.app";

/** El prefijo de la puerta del letrero. Impreso en lámina: no se cambia. */
export const PUERTA_DEL_LETRERO = "/p/";

/**
 * La dirección completa del letrero de una parada.
 *
 * `sitio` se pasa —y no se lee del entorno aquí— para que el dominio siga
 * siendo puro y para poder imprimir una hoja de prueba contra un preview sin
 * tocar código.
 */
export function direccionDelLetrero(qrSlug: string, sitio: string = CASA_DE_ONTOY): string {
  return `${sitio.replace(/\/+$/, "")}${PUERTA_DEL_LETRERO}${qrSlug}`;
}

/**
 * La misma dirección **para leerla en voz alta o teclearla**, sin el `https://`.
 *
 * Va impresa debajo del QR para quien no trae cámara, no sabe escanear o tiene
 * la pantalla rota. El esquema sobra ahí: nadie teclea `https://` en un
 * teléfono, y quitarlo deja la línea más corta y más grande.
 */
export function direccionDelLetreroEnPalabras(qrSlug: string, sitio: string = CASA_DE_ONTOY): string {
  return direccionDelLetrero(qrSlug, sitio).replace(/^https?:\/\//, "");
}
