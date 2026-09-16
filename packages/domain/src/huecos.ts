import { SIN_SENAL_MINUTOS } from "./senal.js";

/**
 * Huecos de señal y tramos observados de una traza.
 *
 * **Un solo lugar para una sola regla.** Nació en el Workbench
 * (`apps/web/src/lib/workbench-medidas.ts`) y se mudó aquí sin cambiar una
 * línea cuando el cuarto de Compás la necesitó para el recorrido y el
 * playback: dos pantallas que parten la misma traza con dos copias de la regla
 * terminan partiéndola distinto (decisión 3 del cuarto: un solo umbral de 15
 * min para recorrido, playback y SIN SEÑAL). El Workbench la reexporta.
 *
 * El umbral viaja como parámetro para que una prueba lo fije y una pantalla lo
 * declare; si no se da, es `SIN_SENAL_MINUTOS`, el mismo número que vuelve
 * «sin señal» a una unidad en Flota en vivo.
 */

export type PuntoTraza = {
  lat: number;
  lng: number;
  at: Date;
  /** Velocidad reportada por el equipo, km/h. Medida en producción: nunca nula. */
  speed: number | null;
};

/**
 * Un hueco de evidencia: entre dos puntos consecutivos pasó más tiempo del
 * umbral. **No es una falta** — es que el sistema dejó de ver, y en este
 * producto no ver nunca equivale a incumplir (ley 7).
 */
export type Hueco = {
  desde: Date;
  hasta: Date;
  minutos: number;
  /** Dónde se perdió la señal, para poder marcarlo en el mapa. */
  lat: number;
  lng: number;
  /** Dónde reapareció. Un hueco tiene dos extremos y los dos importan. */
  latFin: number;
  lngFin: number;
};

/** Los puntos ordenados por tiempo. Todo lo de este módulo lo asume. */
export function ordenarPorTiempo<T extends { at: Date }>(puntos: T[]): T[] {
  return [...puntos].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** ¿Hay hueco entre estos dos puntos consecutivos? Exclusivo: exactamente el umbral no es hueco. */
export function hayHuecoEntre(
  a: { at: Date },
  b: { at: Date },
  umbralMinutos: number = SIN_SENAL_MINUTOS,
): boolean {
  return (b.at.getTime() - a.at.getTime()) / 60_000 > umbralMinutos;
}

/** Huecos de señal entre puntos consecutivos. */
export function huecosDeSenal(
  puntos: PuntoTraza[],
  umbralMinutos: number = SIN_SENAL_MINUTOS,
): Hueco[] {
  const huecos: Hueco[] = [];
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    if (!hayHuecoEntre(a, b, umbralMinutos)) continue;
    huecos.push({
      desde: a.at,
      hasta: b.at,
      minutos: Math.round((b.at.getTime() - a.at.getTime()) / 60_000),
      lat: a.lat,
      lng: a.lng,
      latFin: b.lat,
      lngFin: b.lng,
    });
  }
  return huecos;
}

/**
 * Parte la traza en tramos observados, cortando en cada hueco de señal.
 *
 * **Es la diferencia entre un instrumento y un dibujo.** Una polilínea que
 * atraviesa un hueco de dos horas dibuja una recta por donde el camión nunca
 * demostró haber pasado, y la dibuja igual de brillante que lo que sí se
 * observó (Marco §E).
 *
 * El hueco no desaparece: se sigue marcando. Lo que cambia es que ya no se
 * afirma un camino dentro de él.
 */
export function partirEnHuecos<T extends { at: Date }>(
  puntos: T[],
  umbralMinutos: number = SIN_SENAL_MINUTOS,
): T[][] {
  if (puntos.length === 0) return [];
  const tramos: T[][] = [[puntos[0]!]];
  for (let i = 1; i < puntos.length; i += 1) {
    if (hayHuecoEntre(puntos[i - 1]!, puntos[i]!, umbralMinutos)) tramos.push([puntos[i]!]);
    else tramos[tramos.length - 1]!.push(puntos[i]!);
  }
  return tramos;
}
