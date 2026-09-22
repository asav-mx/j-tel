/**
 * Con qué fuerza se dibuja cada ruta en el Mapa de la ciudad (8.8, PR 3b).
 *
 * Vive fuera del componente porque **es una decisión, no un estilo**, y porque
 * la que estaba escrita adentro escondía las rutas de todos los pasajeros
 * nuevos sin que nadie lo notara.
 *
 * ## La regla, y el defecto que la corrigió
 *
 * Las rutas de contexto se dibujan apagadas **para no tapar a una viva**: si
 * tienes prendida tu favorita, las demás son fondo. Escrito así:
 *
 * > apagada = no está prendida
 *
 * …lo cual es cierto cuando hay alguna prendida, y falso cuando no hay
 * ninguna: entonces no existe la línea viva a la que no hay que tapar, y
 * «apagar a todas las demás» apaga a **todas**.
 *
 * Y ése es el estado de cualquiera que abre la app por primera vez: sin
 * paradas guardadas no hay favoritas. El Mapa de la ciudad dibujaba la ciudad
 * y escondía las rutas — lo único que la pantalla existe para enseñar.
 *
 * La regla correcta no habla de favoritas, habla de **a quién hay que no
 * tapar**:
 *
 * > apagada = hay otra prendida, y ésta no es
 */

export interface Trazo {
  /** Grosor de la línea en píxeles. */
  grosor: number;
  opacidad: number;
  /** Si se puede tocar para abrir la ruta. Una línea de fondo no se toca. */
  tocable: boolean;
  /** Si lleva halo contra el lienzo (cuando su color lo necesita). */
  conHalo: boolean;
}

const FUERTE: Trazo = { grosor: 5, opacidad: 0.95, tocable: true, conHalo: true };
const FONDO: Trazo = { grosor: 3, opacidad: 0.25, tocable: false, conHalo: false };

/**
 * @param prendida Si ESTA ruta es una favorita prendida.
 * @param hayPrendidas Si hay al menos una prendida en el mapa.
 */
export function trazoDeLaRuta(prendida: boolean, hayPrendidas: boolean): Trazo {
  return prendida || !hayPrendidas ? FUERTE : FONDO;
}
