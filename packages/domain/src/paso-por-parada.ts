/**
 * El detector de pasos por parada (Marco 9.2 / 9.11) — eslabón 2 de la
 * cadena del arranque.
 *
 * **Detección por cruce sobre el trazado** (decisión A de Asav, 19-sep):
 * la unidad se proyecta sobre el trazado con la MISMA geometría
 * punto-a-segmento que ya usa el pegado de paradas (`proyectarSobreTrazado`,
 * en `trazado.ts`); la parada tiene su propia abscisa sobre ese mismo
 * trazado; hay paso cuando la proyección cruza esa abscisa entre dos puntos
 * consecutivos.
 *
 * **Por qué no el radio.** Medido el 19-sep: los FTC927 dan 15–61 m entre
 * puntos con el camión andando —mucho más fino que los 440–810 m de la flota
 * vieja—, pero los HUECOS siguen ahí (hasta 75 h en un aparato en una
 * semana), y el hueco es justo donde está la parada: es donde el camión se
 * detiene. Un detector de radio se salta la parada cuando el hueco se traga
 * el tramo; el cruce no, porque ocurre entre los dos puntos que encierran el
 * hueco — lo único que se ensancha es el rango de la hora.
 *
 * **El paso es un rango, no un instante** (decisión C): `pasoDesde` y
 * `pasoHasta` son los dos pings que encierran el cruce. No hay «la hora del
 * paso» — el instrumento no la conoce, y fingir que sí es la afirmación
 * falsa que el Marco §D prohíbe.
 *
 * **Fuera del corredor no hay paso** (decisión B, recomendación de la
 * ficha): un camión desviado no está pasando por sus paradas. El tramo queda
 * como hueco — dicho, no un cero callado.
 */

import { proyectarSobreTrazado } from "./trazado.js";

export interface PuntoDeTelemetria {
  /** El id real del punto, para guardar como evidencia (decisión C). */
  id: string;
  lat: number;
  lon: number;
  recordedAt: Date;
}

export interface ParadaParaDetectar {
  stopId: string;
  /** La versión de la parada vigente cuando se detecta — decisión F. */
  stopVersionId: string;
  lat: number;
  lon: number;
}

export interface PasoDetectado {
  stopId: string;
  stopVersionId: string;
  /** El ping de antes del cruce. */
  pasoDesde: Date;
  /** El ping de después. */
  pasoHasta: Date;
  huecoSegundos: number;
  pingPrevioId: string;
  pingSiguienteId: string;
}

/**
 * Detecta los cruces de un recorrido de puntos consecutivos sobre las
 * paradas de un trazado, en UN sentido.
 *
 * `puntos` debe venir ordenado por `recordedAt` ascendente, y todos del
 * MISMO trazado de UN sentido — cada sentido tiene su propio trazado
 * (`circuit_paths`), así que esta función se llama una vez por sentido.
 *
 * Cada parada se proyecta sobre el trazado UNA vez (su abscisa, en metros
 * desde el inicio) y se compara contra el avance de cada intervalo. No
 * cuenta retroceso: si el avance no crece entre dos puntos, ningún cruce de
 * ese intervalo se considera real — un camión detenido o que se mueve hacia
 * atrás en la proyección no está sirviendo la ruta hacia adelante.
 */
export function detectarPasosEnRecorrido(
  puntos: PuntoDeTelemetria[],
  trazado: Array<[number, number]>,
  paradas: ParadaParaDetectar[],
  corridorToleranceMeters: number,
): PasoDetectado[] {
  const pasos: PasoDetectado[] = [];
  if (puntos.length < 2 || trazado.length < 2 || paradas.length === 0) return pasos;

  const abscisas = paradas.map((p) => {
    const proyeccion = proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado);
    return { parada: p, avanceMetros: proyeccion?.avanceMetros ?? null };
  });

  const proyecciones = puntos.map((p) => proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado));

  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = proyecciones[i];
    const p2 = proyecciones[i + 1];
    if (!p1 || !p2) continue;

    // Decisión B: fuera del corredor no genera pasos. El tramo se queda como
    // hueco — no se afirma nada de él, ni cumplimiento ni falta.
    if (p1.distanciaMetros > corridorToleranceMeters || p2.distanciaMetros > corridorToleranceMeters) {
      continue;
    }

    if (p2.avanceMetros <= p1.avanceMetros) continue; // sin avance, sin cruce.

    for (const { parada, avanceMetros } of abscisas) {
      if (avanceMetros === null) continue; // la parada no proyecta sobre este trazado.
      // (p1, p2]: estrictamente después del punto anterior, hasta el
      // siguiente inclusive — para no contar la misma parada dos veces si
      // cae justo en la frontera de dos intervalos consecutivos.
      if (avanceMetros > p1.avanceMetros && avanceMetros <= p2.avanceMetros) {
        pasos.push({
          stopId: parada.stopId,
          stopVersionId: parada.stopVersionId,
          pasoDesde: puntos[i]!.recordedAt,
          pasoHasta: puntos[i + 1]!.recordedAt,
          huecoSegundos: Math.round(
            (puntos[i + 1]!.recordedAt.getTime() - puntos[i]!.recordedAt.getTime()) / 1000,
          ),
          pingPrevioId: puntos[i]!.id,
          pingSiguienteId: puntos[i + 1]!.id,
        });
      }
    }
  }

  return pasos;
}
