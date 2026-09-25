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
 *
 * **Y el mapa ya está en el repo, pero la app todavía no lo usa.** Lo de abajo
 * —`MAPA_DE_LA_CIUDAD`— describe el archivo que sirve este mismo servidor;
 * `fondoDelMapa()` sigue devolviendo OpenStreetMap hasta que entre el estilo,
 * que es lo que hace que el mapa se vea como Ontoy y no como un mapa cualquiera.
 * Van en dos PRs a propósito: el archivo pesa 14 MB y el estilo se revisa
 * mirándolo, y un PR que trae las dos cosas no deja revisar ninguna.
 */

/**
 * **El mapa de la ciudad, servido por nosotros.**
 *
 * Un solo archivo `.pmtiles` con Juárez y El Paso, en `public/mapa/`. No son
 * teselas sueltas: es un archivo que el navegador lee **por rangos** —pide los
 * pedazos que necesita, como un disco— así que servirlo no necesita ningún
 * programa, sólo un servidor que entienda `Range`. El nuestro lo entiende.
 *
 * Lo regenera `scripts/traer-mapa.mjs`, que explica la caja y los zooms.
 */
export const MAPA_DE_LA_CIUDAD = {
  /**
   * El día del build de Protomaps del que salió el recorte, `AAAAMMDD`.
   *
   * **Va en el nombre del archivo, y eso es lo que hace que refrescar el mapa
   * funcione:** la dirección cambia con la fecha, así que ningún teléfono ni
   * ningún CDN puede servir el mapa viejo desde su caché. Un nombre fijo habría
   * dejado a los teléfonos con el mapa de siempre sin forma de saberlo.
   */
  fecha: "20260924",
  /**
   * La caja recortada, en grados: Juárez completo, El Paso hasta que la frontera
   * no se vea cortada, y **margen de sobra alrededor**.
   *
   * El margen no es generosidad. La primera caja iba pegada a la ciudad
   * (`-106.75,31.50 → -106.15,31.95`, 13.7 MB) y se vio mirándola: de cerca,
   * perfecta; **al alejar en un teléfono alto enseñaba un vacío de borde recto**
   * donde se acababa el recorte, porque la pantalla es más alta que ancha y
   * pedía más grados de los que había. Un mapa que se acaba en una línea
   * horizontal no se lee como «hasta aquí llega el recorte»: se lee como que la
   * app está rota.
   *
   * Cuesta **4.8 MB más en el repo y cero para el pasajero**, que sólo baja los
   * pedazos que mira. El piso de zoom y los límites de arrastre que la
   * acompañan entran con el PR del estilo, que es quien crea el mapa.
   */
  caja: { oeste: -107.0, sur: 31.2, este: -105.95, norte: 32.2 },
  /**
   * Hasta dónde hay **datos**. El build de Protomaps se acaba en z15 y no es un
   * tope de acercamiento: el dibujo es vectorial, así que más allá de z15 las
   * mismas calles siguen creciendo nítidas. Lo que no aparece es detalle nuevo.
   */
  zoomDeLosDatos: 15,
} as const;

/** La dirección del archivo, ya con su fecha. Es de este mismo servidor. */
export function direccionDelMapa(): string {
  return `/mapa/juarez-${MAPA_DE_LA_CIUDAD.fecha}.pmtiles`;
}

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
