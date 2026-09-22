import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";

/**
 * **Qué rutas se dibujan en el Mapa de la ciudad** (8.8; ASAV, 22-sep-2026).
 *
 * El pasajero prende y apaga rutas con una tira de chips abajo. Esta regla dice
 * cuáles entran a la tira, cuáles quedan para el panel de «+N rutas más», y
 * cuáles se dibujan.
 *
 * ## «Todas prendidas al abrir» quiere decir las de la TIRA
 *
 * Decisión de ASAV, y conviene tenerla escrita porque la frase se lee de dos
 * maneras. La tira trae **las cercanas** —las primeras del orden por distancia,
 * o las primeras alfabéticas si no hay ubicación—, y ésas abren prendidas.
 *
 * Las de la ciudad entera **no**: con cuarenta rutas encimadas el mapa deja de
 * ser un mapa, que es justo lo que este filtro vino a resolver. Las lejanas
 * llegan por el panel, y llegan prendidas **porque el pasajero las escogió**.
 *
 * ## Prender y apagar no cuesta una petición, y no dice quién eres
 *
 * Es mostrar y ocultar lo que ya se bajó: los trazados vienen con la portada y
 * las paradas con la lista pública de la ciudad. Nada de esto viaja ni se
 * guarda — al volver a abrir el Mapa, todas las de la tira están prendidas otra
 * vez. **Que no haya memoria es la decisión**, no un pendiente: guardar qué
 * rutas mira el pasajero sería empezar a saber quién es (8.7).
 */

/** Cuántos chips caben en la tira antes de mandar el resto al panel. */
export const RUTAS_EN_LA_TIRA = 4;

export interface Tira {
  /** Las de los chips, en orden. */
  tira: RutaOrdenada[];
  /** Las que quedan, para el panel de «+N rutas más». */
  resto: RutaOrdenada[];
  /** Los ids que se dibujan en el mapa ahorita. */
  prendidas: Set<string>;
}

/**
 * @param ordenadas Las rutas ya ordenadas (`ordenarRutas`): por cercanía con
 *   ubicación, alfabéticas sin ella.
 * @param agregadas Las que el pasajero sumó desde el panel. Entran a la tira.
 * @param apagadas Las que el pasajero apagó tocando su chip.
 */
export function armarLaTira(
  ordenadas: RutaOrdenada[],
  agregadas: ReadonlySet<string>,
  apagadas: ReadonlySet<string>,
): Tira {
  const cercanas = ordenadas.slice(0, RUTAS_EN_LA_TIRA);
  const enLaTira = new Set(cercanas.map((r) => r.ruta.circuito_id));

  /*
   * Una agregada que YA estaba entre las cercanas no se duplica: el panel
   * enseña sólo el resto, pero el pasajero puede apagar una cercana y volver a
   * marcarla desde el panel, y entonces sería la misma ruta dos veces.
   */
  const extras = ordenadas.filter(
    (r) => agregadas.has(r.ruta.circuito_id) && !enLaTira.has(r.ruta.circuito_id),
  );

  const tira = [...cercanas, ...extras];
  const resto = ordenadas.filter((r) => !tira.some((t) => t.ruta.circuito_id === r.ruta.circuito_id));

  return {
    tira,
    resto,
    prendidas: new Set(
      tira.map((r) => r.ruta.circuito_id).filter((id) => !apagadas.has(id)),
    ),
  };
}
