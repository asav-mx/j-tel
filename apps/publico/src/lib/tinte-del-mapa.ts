"use client";

import { useEffect, type RefObject } from "react";

/**
 * El teñido de las teselas del mapa, para las dos pantallas que lo dibujan.
 *
 * ## Por qué el filtro va a la CAPA DE TESELAS y no al contenedor
 *
 * Aplicado al contenedor teñía también el trazado y los camiones: el morado de
 * la ruta salía invertido en lavanda y el ámbar dejaba de ser ámbar. O sea, el
 * color que viene del dato dejaba de ser el color que se ve — que es
 * exactamente lo que la regla del color por ruta existe para garantizar.
 *
 * ## Por qué vive aquí y no copiado en cada pantalla
 *
 * Estaba escrito dos veces, con los mismos cinco números, y el comentario de la
 * segunda copia decía «mismo teñido que la vista de la ruta» — que es la
 * confesión de la duplicación, no su remedio. Es la misma razón por la que el
 * tema y la ubicación ya viven en `lib/`: dos copias de una decisión se
 * separan, y el día que una cambie el pasajero vería un mapa en la ruta y otro
 * en el buscador.
 *
 * ## `mapaListo` no es un lujo: es el defecto que esto vino a arreglar
 *
 * El mapa se crea en un efecto **asíncrono** —`await import("leaflet")`—, así
 * que cuando este otro efecto corre por primera vez la capa de teselas todavía
 * no existe: `querySelector` devuelve `null`, el efecto se sale, y **no vuelve
 * a intentarlo** porque sus dependencias ya no cambian.
 *
 * En el buscador eso se veía: en tema oscuro el mapa se quedaba claro, y sólo
 * se teñía si alternabas el tema dos veces. En la vista de la ruta **no se
 * veía, y no porque estuviera bien**: sus dependencias incluían `vivo`, que
 * cambia con cada sondeo, así que el primer sondeo re-corría el efecto por
 * casualidad. Con el endpoint caído —`vivo` se queda en `null`— el mismo mapa
 * se habría quedado claro ahí también.
 *
 * Por eso la dependencia que hacía falta no era «llegaron datos» sino **«ya hay
 * mapa»**, dicha con todas sus letras.
 */

/** De noche un mapa blanco encandila. Los cinco números viven aquí y en un solo lugar. */
export const TINTE_DE_NOCHE =
  "invert(1) hue-rotate(185deg) brightness(.82) contrast(.92) saturate(.7)";

/** De día no se invierte nada: se baja el grito del color para que la ruta destaque. */
export const TINTE_DE_DIA = "saturate(.72) brightness(1.03)";

export function tinteDelMapa(deNoche: boolean): string {
  return deNoche ? TINTE_DE_NOCHE : TINTE_DE_DIA;
}

/**
 * @param contenedor El `div` donde vive el mapa.
 * @param deNoche El tema en curso.
 * @param mapaListo Si el mapa ya se creó. **Sin esto el teñido se pierde**: ver arriba.
 */
export function useTinteDelMapa(
  contenedor: RefObject<HTMLDivElement | null>,
  deNoche: boolean,
  mapaListo: boolean,
): void {
  useEffect(() => {
    const pane = contenedor.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (!pane) return;
    pane.style.filter = tinteDelMapa(deNoche);
  }, [contenedor, deNoche, mapaListo]);
}
