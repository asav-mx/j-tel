/**
 * El fondo del mapa — **una sola función, y ése es el punto.**
 *
 * **El mapa lo servimos nosotros** (decisión de ASAV, 21-sep-2026): un archivo
 * de Protomaps con Juárez y El Paso, en `public/mapa/`, servido por el mismo
 * servidor que sirve la app. Antes eran los mosaicos públicos de
 * `tile.openstreetmap.org`, y se fueron por dos razones distintas:
 *
 * ## 1. Era el único tercero que la app tocaba
 *
 * Cada mosaico que el pasajero veía era una petición **suya** a
 * `openstreetmap.org`, con su IP y —por las coordenadas del mosaico—
 * aproximadamente hacia dónde estaba mirando. La app nunca mandó su ubicación a
 * ningún lado (ver `ubicacion.ts`); el mapa de fondo sí le contaba algo a
 * alguien. **Ya no hay a quién.** Va declarado en la página de privacidad,
 * porque lo que no se dice se descubre — y ahora lo que dice es que no hay
 * tercero, que es una afirmación más fuerte y por eso hay que poder sostenerla:
 * si alguien vuelve a poner una dirección absoluta aquí, `mapa-base.test.ts` se
 * cae.
 *
 * ## 2. Los mosaicos públicos de OSM no son para producción
 *
 * Su política de uso lo dice sin rodeos: es infraestructura donada y el uso
 * pesado está prohibido; el remedio de ellos es bloquear por `User-Agent`, o
 * sea **el mapa se apaga un día, en la calle, para todos**. Para el piloto
 * estuvo bien; para la tienda no.
 *
 * ## Lo que NO cambió: el crédito
 *
 * Los datos siguen siendo de **OpenStreetMap** (ODbL) y el crédito se queda en
 * el mapa. El crédito es por los **datos**; la privacidad es por **quién recibe
 * las peticiones**. Son dos cosas y confundirlas lleva a los dos errores: quitar
 * el crédito porque «ya no les pedimos nada», o dejar dicho que hay un tercero
 * porque «el crédito sigue ahí».
 *
 * **El crédito va sin liga, como ya iba.** Una liga en la esquina del mapa, en
 * una app instalada —`display: standalone`, o sea **sin flecha de atrás** (#374)—
 * es una salida sin regreso. El crédito completo, con sus ligas, vive en la
 * página de privacidad, que sí tiene salida.
 *
 * ## Cambiar de proveedor es cambiar esta función
 *
 * Por eso está sola, en su archivo, en vez de dentro del componente del mapa. Lo
 * que dibuja con esto está en `capa-de-fondo.ts` y los colores en
 * `piel-del-mapa.ts`.
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
   * pedazos que mira.
   */
  caja: { oeste: -107.0, sur: 31.2, este: -105.95, norte: 32.2 },
  /**
   * Hasta dónde se puede **alejar**. Es la otra mitad de lo mismo: con la caja
   * de arriba, en z10 la pantalla de un teléfono cabe dentro de lo recortado —
   * y ahí se ve la ciudad entera con El Paso. Un paso más lejos, no.
   *
   * Va junto con `maxBounds`, que es lo que impide llegar al borde
   * arrastrando en vez de alejando.
   */
  zoomMinimo: 10,
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
  /** Qué se le pide, y a quién. Hoy: un archivo de este mismo origen. */
  url: string;
  atribucion: string;
  /** Hasta dónde se puede acercar el mapa. */
  zoomMaximo: number;
  /** Hasta dónde se puede alejar sin que asome el borde del recorte. */
  zoomMinimo: number;
  /** Hasta dónde hay datos; de ahí para arriba el dibujo se agranda sin pixelarse. */
  zoomDeLosDatos: number;
  /**
   * Hasta dónde se puede arrastrar. **Es el mapa que tenemos, y ni un metro
   * más:** sin esto, alejar queda limitado pero arrastrar no, y el pasajero se
   * sale del recorte por un costado en vez de por abajo.
   */
  limites: { oeste: number; sur: number; este: number; norte: number };
  /** Un tercero recibe las peticiones del mapa. Lo usa la página de privacidad. */
  hayTercero: boolean;
  /** El nombre del tercero, para poder decirlo. `null` cuando no hay ninguno. */
  tercero: string | null;
}

export function fondoDelMapa(): FondoDelMapa {
  return {
    url: direccionDelMapa(),
    /*
     * Dos créditos y los dos obligados: los **datos** son de OpenStreetMap
     * (ODbL) y el **recorte** es del build de Protomaps (BSD-3). Sin ligas, por
     * la razón de arriba.
     */
    atribucion: "© OpenStreetMap · Protomaps",
    zoomMaximo: 19,
    zoomMinimo: MAPA_DE_LA_CIUDAD.zoomMinimo,
    zoomDeLosDatos: MAPA_DE_LA_CIUDAD.zoomDeLosDatos,
    limites: MAPA_DE_LA_CIUDAD.caja,
    hayTercero: false,
    tercero: null,
  };
}
