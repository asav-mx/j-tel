import type { EsperaDeParada } from "@jtel/services";
import type { Sentido } from "@jtel/domain";

/**
 * **Qué reloj lleva cada parada del carril, y qué se dice una sola vez**
 * (9.2d; ASAV, 22-sep-2026).
 *
 * ## El defecto que esto corrige
 *
 * Una unidad asignada que no rodó hoy deja el circuito **sin una sola pasada**.
 * Entonces `derivarEsperas` ancla TODAS las paradas al mismo instante —la
 * apertura declarada— porque no hay otra cosa a la que anclarlas, y las 17
 * salen con el mismo número y todas pasadas de su rango.
 *
 * El número es correcto: es lo que lleva el circuito abierto. **La pantalla era
 * la que mentía.** Diecisiete relojes idénticos en cobre se leen como
 * diecisiete mediciones independientes que casualmente coinciden, cuando es
 * **una sola** medición repetida diecisiete veces. Es §D del Marco: el dato
 * correcto con la afirmación falsa, y lo falso lo pone la UNIDAD de lo que se
 * cuenta.
 *
 * Y el cobre dejaba de significar. La regla de la torre es que el cobre marca
 * **la parada que se pasó de su rango**; con todas en cobre no marca ninguna.
 *
 * ## La regla
 *
 * Una parada lleva **reloj propio** sólo si su espera se mide contra una
 * **pasada real** de hoy. Si se ancló a la apertura —`desdeLaApertura`—, lo que
 * hay no es una parada atrasada: es **un circuito parado**, y eso es un hecho
 * del circuito que se dice **una vez**, en el carril.
 *
 * Esto no debilita la 9.2d, la cumple mejor: la parada sigue declarando que la
 * promesa se está rompiendo sin que ninguna unidad haya hecho nada — sólo que
 * lo declara el carril, en la unidad en que el hecho es cierto.
 *
 * **No se pierde nada:** el detalle de cada parada sigue abriendo con su
 * espera, su ancla y sus últimas pasadas. Lo que se quita es el número
 * repetido, no el dato.
 */

export interface EsperasDelCarril {
  /** Las que sí tienen pasada real hoy: llevan su reloj y pueden ir en cobre. */
  conReloj: Map<string, EsperaDeParada>;
  /**
   * Lo que se dice UNA vez porque es del circuito, no de cada parada.
   * `null` cuando todas tienen pasada real, o cuando no hay nada que afirmar.
   */
  sinPasada: {
    cuantas: number;
    deCuantas: number;
    /** Lo que lleva abierto el circuito. Es el mismo para todas, por eso va una vez. */
    minutos: number;
  } | null;
}

/**
 * @param esperas Todas las del circuito; se filtran por sentido aquí.
 */
export function esperasDelCarril(esperas: EsperaDeParada[], sentido: Sentido): EsperasDelCarril {
  const delCarril = esperas.filter((e) => e.sentido === sentido);
  const conReloj = new Map<string, EsperaDeParada>();
  const ancladas: EsperaDeParada[] = [];

  for (const e of delCarril) {
    /*
     * `no_aplica` y `sin_datos` no son esperas: son huecos declarados, y ya
     * viajan con su motivo. No entran ni al reloj ni a la cuenta del carril.
     */
    if (e.estado !== "en_rango" && e.estado !== "atrasada") continue;
    if (e.desdeLaApertura) ancladas.push(e);
    else conReloj.set(e.stopId, e);
  }

  if (ancladas.length === 0) return { conReloj, sinPasada: null };

  /*
   * Todas comparten ancla, así que comparten número: se toma el mayor y no un
   * promedio — promediar números idénticos es teatro, y si alguna difiriera,
   * lo que el carril afirma («lleva X sin que pase nadie») tiene que ser el
   * mayor para no quedarse corto.
   */
  const minutos = Math.max(...ancladas.map((e) => e.minutos ?? 0));

  return {
    conReloj,
    sinPasada: { cuantas: ancladas.length, deCuantas: delCarril.length, minutos },
  };
}
