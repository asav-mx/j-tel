import type * as Leaflet from "leaflet";
import { direccionDelMapa, fondoDelMapa } from "./mapa-base";
import { IDIOMA_DEL_MAPA, pielDelMapa } from "./piel-del-mapa";

/**
 * **La capa de fondo del mapa, en un archivo aparte.**
 *
 * Aquí está todo lo que hay que tocar para cambiar de dónde sale el mapa. El
 * componente del mapa (`vista-mapa.tsx`) sólo pide una capa y se la cuelga: no
 * sabe si detrás hay mosaicos de un tercero, un archivo nuestro o un proveedor
 * nuevo. Es la misma razón por la que `mapa-base.ts` existe — y ahora que el
 * fondo se dibuja (no se descarga dibujado) esa razón vale doble.
 *
 * ## Seguimos en Leaflet, y eso fue una decisión
 *
 * El mapa vectorial se dibuja con `protomaps-leaflet`, que pinta las teselas en
 * un `<canvas>` **dentro de una capa de Leaflet normal**. Se evaluó cambiar a
 * MapLibre, que es la librería que la mayoría usa para esto, y se descartó:
 * MapLibre habría obligado a reescribir el componente entero del mapa —los
 * muñecos, las trazas, las paradas, el punto del pasajero, todo lo que el #566
 * acaba de dejar en `main`— para ganar nada que el pasajero note. **Menos cambio
 * es menos riesgo**, y lo que había que arreglar era de dónde salen las teselas,
 * no cómo se dibuja lo de encima.
 *
 * ## El puente de `window.L`, que no es un adorno
 *
 * `protomaps-leaflet` declara su capa como `class extends L.GridLayer` leyendo
 * **la `L` global**: nació cuando Leaflet se cargaba con una etiqueta `<script>`.
 * Esta app importa Leaflet como módulo (`await import("leaflet")`), y la versión
 * ESM **no se publica en `window`**. Sin el puente de abajo, crear la capa
 * truena con un `TypeError` sobre `undefined` — y truena **dentro de un
 * `useEffect` asíncrono**, así que lo que se ve no es un error: es un mapa que
 * se queda vacío.
 */

/** Lo que el componente necesita saber de la capa, sin saber de qué librería es. */
export interface CapaDeFondo {
  capa: Leaflet.GridLayer;
  /** Vuelve a pintar con la piel que toca. La llama el efecto del tema. */
  vestir: (deNoche: boolean) => void;
}

/** La firma de lo que devuelve `leafletLayer`, con lo poco que usamos de ella. */
interface CapaVectorial extends Leaflet.GridLayer {
  paintRules: unknown[];
  labelRules: unknown[];
  backgroundColor?: string;
  clearLayout: () => void;
  rerenderTiles: () => void;
}

export async function crearCapaDeFondo(
  leaflet: typeof Leaflet,
  deNoche: boolean,
): Promise<CapaDeFondo> {
  /* El puente. Ver arriba: sin esto la capa no se puede ni construir. */
  const ventana = window as unknown as { L?: typeof Leaflet };
  ventana.L ??= leaflet;

  const { leafletLayer, paintRules, labelRules } = await import("protomaps-leaflet");
  const fondo = fondoDelMapa();

  const vestido = (deNoche: boolean) => {
    const piel = pielDelMapa(deNoche);
    return {
      paintRules: paintRules(piel),
      labelRules: labelRules(piel, IDIOMA_DEL_MAPA),
      backgroundColor: piel.background,
    };
  };

  const inicial = vestido(deNoche);
  const capa = leafletLayer({
    url: direccionDelMapa(),
    /*
     * Hasta dónde hay datos, que no es hasta dónde se puede acercar: de z15 a
     * z19 las mismas calles siguen creciendo nítidas —son vectores— y lo que no
     * aparece es detalle nuevo. Con mosaicos de imagen, pasado su zoom máximo la
     * calle se veía pixelada; aquí no.
     */
    maxDataZoom: fondo.zoomDeLosDatos,
    maxZoom: fondo.zoomMaximo,
    attribution: fondo.atribucion,
    ...inicial,
  }) as unknown as CapaVectorial;

  return {
    capa,
    vestir: (deNoche: boolean) => {
      const piel = vestido(deNoche);
      capa.paintRules = piel.paintRules;
      capa.labelRules = piel.labelRules;
      capa.backgroundColor = piel.backgroundColor;
      /*
       * Dos pasos, y el primero es el que se olvida: las etiquetas viven en un
       * índice que se armó con los colores viejos, así que re-pintar sin
       * tirarlo deja los nombres de las calles con el color de la otra piel —
       * texto oscuro sobre el mapa de noche.
       */
      capa.clearLayout();
      capa.rerenderTiles();
    },
  };
}
