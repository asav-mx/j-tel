import { SIN_SENAL_MINUTOS } from "./senal.js";
import { haversineKm } from "./ventana-observacion.js";

/**
 * Huecos de señal, saltos del GPS y tramos observados de una traza.
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

/* ─── Los saltos del GPS ────────────────────────────────────────────────── */

/**
 * Velocidad implícita por encima de la cual dos puntos seguidos son un salto
 * del equipo y no movimiento real: 300 km/h es imposible para un camión.
 *
 * Vivía en `@jtel/services` (recorrido.ts), donde sólo descartaba el tramo al
 * sumar kilómetros. Se mudó aquí cuando el salto empezó a partir también la
 * traza (18 sep 2026): el que cuenta los kilómetros y el que dibuja la línea
 * tienen que decidir con la misma regla, o una pantalla dice «salto» donde la
 * otra dibuja camino. `@jtel/services` lo reexporta sin cambio.
 */
export const SALTO_GPS_KMH = 300;

/**
 * Un salto del GPS: dos puntos seguidos, los dos medidos, cuya distancia es
 * imposible en el tiempo que los separa. **No se borra ninguno de los dos** —
 * decidir cuál es el falso sería especular—; lo que se niega es la línea
 * entre ellos, que afirmaría un camino a 600 km/h que nadie recorrió.
 */
export type Salto = {
  desde: Date;
  hasta: Date;
  /** Distancia en línea recta entre los dos puntos. */
  km: number;
  lat: number;
  lng: number;
  latFin: number;
  lngFin: number;
};

type PuntoConLugar = { at: Date; lat: number; lng: number };

/**
 * ¿Son un salto estos dos puntos consecutivos?
 *
 * Dos lecturas del mismo instante no son un tramo: no son salto (la misma
 * regla con la que `kilometrosSinSaltos` las deja fuera de la suma).
 */
export function esSaltoGps(a: PuntoConLugar, b: PuntoConLugar, umbralKmh: number = SALTO_GPS_KMH): boolean {
  const horas = (b.at.getTime() - a.at.getTime()) / 3_600_000;
  if (horas <= 0) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) / horas > umbralKmh;
}

/**
 * Los saltos de una traza ordenada. Un par que ya es hueco no es además
 * salto: el hueco lo cortó y lo dice, y contarlo dos veces diría dos cosas
 * del mismo silencio.
 */
export function saltosDeGps(
  puntos: PuntoTraza[],
  umbralHuecoMinutos: number = SIN_SENAL_MINUTOS,
): Salto[] {
  const saltos: Salto[] = [];
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    if (hayHuecoEntre(a, b, umbralHuecoMinutos) || !esSaltoGps(a, b)) continue;
    saltos.push({
      desde: a.at,
      hasta: b.at,
      km: haversineKm(a.lat, a.lng, b.lat, b.lng),
      lat: a.lat,
      lng: a.lng,
      latFin: b.lat,
      lngFin: b.lng,
    });
  }
  return saltos;
}

/**
 * Parte la traza en todo lo que la rompe: los huecos **y los saltos**.
 *
 * «Una traza rota se dibuja rota» (Pieza 1 §E). Un hueco la rompe porque nadie
 * midió; un salto, porque lo medido se contradice. En los dos casos la línea
 * entre los dos puntos afirmaría un camino que nadie observó.
 *
 * Es lo que se DIBUJA. Las cifras del periodo (kilómetros, minutos con señal)
 * siguen saliendo de `partirEnHuecos`: durante un salto el equipo sí estaba
 * transmitiendo.
 */
export function partirEnCortes<T extends PuntoConLugar>(
  puntos: T[],
  umbralHuecoMinutos: number = SIN_SENAL_MINUTOS,
): T[][] {
  if (puntos.length === 0) return [];
  const tramos: T[][] = [[puntos[0]!]];
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    if (hayHuecoEntre(a, b, umbralHuecoMinutos) || esSaltoGps(a, b)) tramos.push([b]);
    else tramos[tramos.length - 1]!.push(b);
  }
  return tramos;
}
