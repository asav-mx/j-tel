/**
 * A dónde sale quien abrió el buscador.
 *
 * Vive fuera del componente porque **es una decisión, no un adorno**: qué liga
 * lleva el único control de salida de una pantalla que hoy no tiene ninguna. Y
 * porque el caso que la hace difícil —un `desde` que no corresponde a ninguna
 * ruta publicada— no se puede probar mirando la pantalla.
 *
 * ## Por qué hay un destino y no «atrás»
 *
 * El manifiesto declara `display: "standalone"`. **Instalada en la pantalla de
 * inicio, la app no tiene botón de atrás del navegador**, y quien abre el
 * buscador de frío —una liga compartida, el arranque de la app— no tiene
 * historia a la cual volver. `history.back()` ahí no hace nada, y un control
 * que no hace nada es peor que ninguno: quien lo pica ya se creyó que hay
 * salida.
 *
 * ## Por qué el `desde` se coteja contra lo publicado
 *
 * El parámetro viaja en la URL, así que lo escribe quien quiera. Sin cotejarlo,
 * `?desde=lo-que-sea` produciría un botón rotulado «Volver a la ruta» que
 * aterriza en un 404 — un letrero prometiendo algo que no está detrás de la
 * puerta. Con el cotejo, un `desde` que no reconocemos cae a la portada, que
 * siempre existe.
 */

export interface SalidaDelBuscador {
  /** A dónde va. Siempre una ruta que existe. */
  href: string;
  /**
   * Cómo se llama para quien no ve el dibujo.
   *
   * El botón enseña sólo la flecha —arriba a la izquierda, que es lo que ya
   * significa «regresar» en cualquier teléfono, y el ancho que ahorra lo gana
   * el nombre de la ruta— pero **el nombre accesible sí dice el destino**.
   */
  etiqueta: string;
}

/**
 * @param desde El slug del circuito del que se llegó, si vino uno.
 * @param slugsPublicados Los circuitos que la pantalla ya tiene en la mano.
 */
export function salidaDelBuscador(
  desde: string | null | undefined,
  slugsPublicados: readonly string[],
): SalidaDelBuscador {
  if (desde && slugsPublicados.includes(desde)) {
    return { href: `/c/${desde}`, etiqueta: "Volver a la ruta" };
  }
  return { href: "/", etiqueta: "Volver al inicio" };
}
