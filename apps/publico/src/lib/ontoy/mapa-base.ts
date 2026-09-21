/**
 * El fondo del mapa — **una sola función, y ése es el punto.**
 *
 * Hoy son los tiles públicos de OpenStreetMap, y eso tiene dos consecuencias
 * que conviene tener escritas donde se cambian:
 *
 * ## 1. Es el único tercero que la app toca
 *
 * Cada tile que el pasajero ve es una petición **suya** a `openstreetmap.org`,
 * con su IP y —por las coordenadas del tile— aproximadamente hacia dónde está
 * mirando. La app no manda su ubicación a ningún lado (ver `ubicacion.ts`), pero
 * el mapa de fondo sí le cuenta algo a alguien. Va declarado en la página de
 * privacidad, porque lo que no se dice se descubre.
 *
 * ## 2. Los tiles públicos de OSM no son para producción
 *
 * Su política de uso lo dice sin rodeos: es infraestructura donada y el uso
 * pesado está prohibido; el remedio de ellos es bloquear por `User-Agent`, o
 * sea **el mapa se apaga un día, en la calle, para todos**. Para el piloto está
 * bien; para la tienda no.
 *
 * **El camino decidido (ASAV, 21-sep):** Protomaps servido desde nuestro propio
 * almacenamiento, para que ningún tercero vea dónde mira el pasajero; MapTiler
 * si Protomaps resulta pesado. Cambiar de proveedor es cambiar esta función —
 * y por eso está sola, en su archivo, en vez de dentro del componente del mapa.
 */

export interface FondoDelMapa {
  url: string;
  atribucion: string;
  zoomMaximo: number;
  /** Un tercero recibe las peticiones de tiles. Lo usa la página de privacidad. */
  hayTercero: boolean;
  /** El nombre del tercero, para poder decirlo. `null` cuando no hay ninguno. */
  tercero: string | null;
}

export function fondoDelMapa(): FondoDelMapa {
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    atribucion: "© OpenStreetMap",
    zoomMaximo: 19,
    hayTercero: true,
    tercero: "OpenStreetMap",
  };
}
