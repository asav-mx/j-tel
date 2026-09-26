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

/**
 * **La corrección de errores del código impreso: H.**
 *
 * Vive en el dominio y no en la pantalla porque es una decisión sobre un objeto
 * que se atornilla a un poste, igual que la dirección: una lámina impresa con
 * una corrección y releída con otra no existe — el lector lo saca del propio
 * código—, pero una lámina impresa con **menos** corrección de la que se decidió
 * es una lámina que se muere antes, y nadie va a ir a cambiarla.
 *
 * ## Medido, y no por la razón que trae la hoja de diseño
 *
 * La hoja dice «corrección alta, por eso aguanta a Ontoy en el centro». Eso no
 * es lo que manda: un disco centrado que tapa el 22 % del lado le quita el 4 %
 * de los cuadritos, y eso lo sobrevive hasta M.
 *
 * Lo que H compra es la calle. Simulando calcomanías y rayones —manchas de 3×3
 * cuadritos, 40 tiradas por nivel, decodificado con jsQR, el mismo lector de la
 * app— sobre `https://ontoy.app/p/oasis-01`:
 *
 * | Manchas | Lee con M | Lee con H |
 * |---|---|---|
 * | 3 | 68 % | 93 % |
 * | 4 | 25 % | 85 % |
 * | 6 | 3 % | 75 % |
 * | 8 | 0 % | 65 % |
 *
 * **Lo que cuesta:** más cuadritos en los mismos 9 cm — 33 en vez de 29 con un
 * slug corto, o sea 2.20 mm por cuadrito en vez de 2.43. Una razón más para que
 * los `qr_slug` sigan siendo cortos.
 */
export const CORRECCION_DEL_LETRERO = "H" as const;

/**
 * **La etiqueta corta de una ruta, para la placa de Tino en la lámina.**
 *
 * La placa de Tino mide 14 mm de ancho impresa. «51» cabe; «Oasis – Parroquia
 * Santa Teresa de Jesús» no cabe de ninguna manera — apretarlo con `textLength`
 * lo convierte en una mancha gris, que fue exactamente lo que salió del primer
 * intento y se vio en la primera captura.
 *
 * Así que la placa lleva **el nombre si cabe, y si no sus iniciales**. No se
 * pierde nada: el nombre completo va en la placa carbón de al lado, siempre, en
 * el mismo letrero y a dos centímetros. El color nunca va solo (8.8c) y aquí va
 * acompañado dos veces.
 *
 * El corte en 8 caracteres está medido sobre la placa, no escogido: a 11 px en
 * un lienzo de 120 unidades, más de ocho letras ya no entran a su ancho natural.
 *
 * ⚠ **Hay una función hermana en `apps/publico/src/lib/color-ruta.ts`** que
 * calcula iniciales para la insignia de la app. No se comparten, y no por
 * descuido: ese módulo lo usan componentes `"use client"`, y hacerlo importar
 * `@jtel/domain` le metería el dominio entero al teléfono de un pasajero. Las
 * dos hacen lo mismo y las dos tienen prueba; si alguna cambia, que cambie la
 * otra.
 */
/**
 * **El número de la ruta, o `null`** — lo único que puede ir en una placa
 * carbón de lo impreso (ASAV, 26-sep-2026, antes de imprimir las 18 láminas).
 *
 * La regla: **nunca iniciales**. La placa carbón es para identificadores cortos
 * que existen —el número de la ruta o el de la unidad—, y una ruta sin número
 * va con **su franja de color y su nombre como texto**. «OC» por
 * Oasis–Centro no es un identificador: es uno inventado, y atornillado a un
 * poste por años sería el nombre de la ruta que nadie usa.
 *
 * Tampoco un nombre corto sin número: «Oasis» no es un identificador corto,
 * es un nombre, y va como nombre.
 *
 * Es el mismo reconocimiento de número que `etiquetaCortaDeLaRuta` —un token de
 * hasta tres caracteres, todo dígitos o una letra seguida de dígitos: «51»,
 * «4», «T1», «C2»—, sin el camino de las iniciales.
 */
export function numeroDeLaRuta(nombre: string): string | null {
  const partes = nombre
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const conNumero = partes.find((t) => /^(?:\d{1,3}|\p{L}\d{1,2})$/u.test(t));
  return conNumero ? conNumero.toUpperCase() : null;
}

export function etiquetaCortaDeLaRuta(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 8) return limpio;
  const partes = limpio
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (partes.length === 0) return "··";

  /*
   * **Si la ruta trae número, el número ES la etiqueta.** Y va antes que las
   * iniciales a propósito: en la calle las rutas se conocen por su número — «la
   * 51», «la T1» —, nadie dice «la RT», y la placa es justo el sitio donde el
   * pasajero busca ese número.
   *
   * Lo enseñó la lámina de 40 × 60: «Ruta 51 · Centro–Tecnológico» salía «RT»,
   * y eso, atornillado a un poste durante años, es la ruta equivocada escrita
   * en grande.
   *
   * Vale un token de hasta tres caracteres que sea todo dígitos o una letra
   * seguida de dígitos: cubre «51», «4», «T1», «C2». Más largo que eso ya no es
   * un número de ruta sino un año o un código de otra cosa, y se deja pasar.
   */
  const conNumero = partes.find((t) => /^(?:\d{1,3}|\p{L}\d{1,2})$/u.test(t));
  if (conNumero) return conNumero.toUpperCase();

  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

/**
 * **El título de la página del QR** — y por lo tanto el nombre del archivo PDF.
 *
 * Existe porque el navegador saca las dos cosas del `<title>`: el nombre que
 * sugiere al guardar y el título que va **dentro** del PDF. Sin esto, la página
 * heredaba el de toda la casa y a la imprenta le llegaban dieciocho archivos
 * llamados «JTEL — Verificación de Transporte», indistinguibles entre sí.
 *
 * Vive en el dominio y no en la pantalla por lo mismo que la dirección impresa:
 * es el nombre con el que un objeto físico viaja a un tercero, la imprenta va a
 * archivar por ese nombre, y una regla así no debe poder cambiar de forma sin que
 * se caiga una prueba.
 *
 * Formato: `QR · ‹circuito› · ‹parada o cuántas›`, y la variante al final sólo si
 * no es la de por omisión. Todo sale del dato: no hay nada escrito a mano para
 * ningún circuito.
 */
export function tituloDelQr(entrada: {
  circuito: string;
  /** Una parada concreta, cuando se imprime sólo ésa. */
  parada?: string;
  /** O cuántas van, cuando se imprimen todas. */
  cuantasParadas?: number;
  /** «cuadrados», «cuadrados y esquinas normales»… Vacío en la de por omisión. */
  variante?: string;
}): string {
  const { circuito, parada, cuantasParadas, variante } = entrada;
  const sujeto =
    parada ??
    (cuantasParadas === 1 ? "1 parada" : `${cuantasParadas ?? 0} paradas`);
  const partes = ["QR", circuito.trim(), sujeto];
  if (variante?.trim()) partes.push(variante.trim());
  return partes.join(" · ");
}
