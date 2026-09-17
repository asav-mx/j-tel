import type { PuntoTraza } from "./huecos.js";

/*
 * Paradas de una traza. Nacieron en el Workbench (`workbench-medidas.ts`) y se
 * mudaron aquí sin cambiar la regla cuando el recorrido de Compás (C3, regla 9)
 * las necesitó como puntos intocables al simplificar: una parada larga que el
 * Workbench dibuja y el recorrido borra sería la misma traza contada distinto.
 * El Workbench las reexporta.
 */

/**
 * Una parada: una corrida de puntos consecutivos con velocidad reportada en
 * cero que dura al menos el umbral.
 *
 * Se dibuja en el mapa con su duración y **no se cuenta ni se suma**. Quien la
 * ve en el patio a las 3 de la mañana la lee como lo que es; el mismo hecho
 * dentro de un "6 h detenido" pierde el lugar y la hora que lo hacían legible.
 */
export type Parada = {
  desde: Date;
  hasta: Date;
  minutos: number;
  lat: number;
  lng: number;
};

/**
 * Cuánto tiene que durar una corrida en cero para llamarse parada.
 *
 * **Configurable, no horneado** (lo pedía la auditoría §5.2 de la ficha): viaja
 * como parámetro y la pantalla lo declara junto al mapa. Un semáforo no es una
 * parada y el umbral es lo único que los separa, así que quien mira tiene
 * derecho a moverlo y a saber en cuánto está.
 */
export const PARADA_MINUTOS_POR_DEFECTO = 5;

/** Velocidad, en km/h, en o por debajo de la cual el equipo se considera quieto. */
export const PARADA_VELOCIDAD_KMH = 0;

/**
 * Paradas, como lugares con duración.
 *
 * Una corrida se corta con el primer punto en movimiento. Y se corta también
 * cuando entre dos puntos quietos hay un hueco de señal: **el equipo dejó de
 * reportar, no se sabe si siguió quieto.** Sin ese corte, un hueco de dos horas
 * entre dos ceros se dibujaría como una parada de dos horas que nadie observó,
 * que es inventar evidencia con forma de medición.
 */
export function paradas(
  puntos: PuntoTraza[],
  opts: { minMinutos: number; umbralHuecoMinutos: number },
): Parada[] {
  const salida: Parada[] = [];
  let inicio: PuntoTraza | null = null;
  let previo: PuntoTraza | null = null;

  const cerrar = () => {
    if (inicio && previo) {
      const minutos = (previo.at.getTime() - inicio.at.getTime()) / 60_000;
      if (minutos >= opts.minMinutos) {
        salida.push({
          desde: inicio.at,
          hasta: previo.at,
          minutos: Math.round(minutos),
          lat: inicio.lat,
          lng: inicio.lng,
        });
      }
    }
    inicio = null;
    previo = null;
  };

  for (const p of puntos) {
    const quieto = p.speed !== null && p.speed <= PARADA_VELOCIDAD_KMH;
    if (!quieto) {
      cerrar();
      continue;
    }
    if (previo && (p.at.getTime() - previo.at.getTime()) / 60_000 > opts.umbralHuecoMinutos) {
      // El equipo se calló en medio: la corrida anterior termina donde se
      // dejó de ver, y esta empieza de nuevo.
      cerrar();
    }
    if (!inicio) inicio = p;
    previo = p;
  }
  cerrar();
  return salida;
}
