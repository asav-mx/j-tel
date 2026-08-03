/**
 * Las medidas del Workbench, como funciones puras.
 *
 * Viven aparte de la carga de datos por la misma razón que el censo de
 * `recorrido.ts`: una medida que se prueba sin base de datos se puede probar
 * contra casos conocidos, y este producto ya aprendió lo que cuesta publicar un
 * instrumento sin pasarlo por casos conocidos.
 *
 * Lo que NO está aquí es tan importante como lo que sí: **no hay tiempo detenido
 * ni conteo de paradas.** Los dos se pueden calcular y los dos mentirían hoy —
 * la razón medida está en `Ficha-Workbench` §3.4. Las paradas existen como
 * lugares con duración para dibujarlas en el mapa; colapsarlas a un número es
 * justo lo que se decidió no hacer.
 */

import { SALTO_GPS_KMH } from "@jtel/services";
import { haversineKm } from "@jtel/verification";

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

/** Los puntos ordenados por tiempo. Todo lo de este módulo lo asume. */
export function ordenarPorTiempo(puntos: PuntoTraza[]): PuntoTraza[] {
  return [...puntos].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Huecos de señal, definidos por el mismo umbral que usa el resto del producto.
 *
 * El umbral entra como parámetro y no como constante importada aquí adentro,
 * para que la prueba pueda fijarlo y la pantalla pueda declararlo.
 */
export function huecosDeSenal(puntos: PuntoTraza[], umbralMinutos: number): Hueco[] {
  const huecos: Hueco[] = [];
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    const minutos = (b.at.getTime() - a.at.getTime()) / 60_000;
    if (minutos <= umbralMinutos) continue;
    huecos.push({
      desde: a.at,
      hasta: b.at,
      minutos: Math.round(minutos),
      lat: a.lat,
      lng: a.lng,
      latFin: b.lat,
      lngFin: b.lng,
    });
  }
  return huecos;
}

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

/**
 * Parte la traza en tramos observados, cortando en cada hueco de señal.
 *
 * **Es la diferencia entre un instrumento y un dibujo.** Una polilínea que
 * atraviesa un hueco de dos horas dibuja una recta por donde el camión nunca
 * demostró haber pasado, y la dibuja igual de brillante que lo que sí se
 * observó. En un rango de varios días eso son diagonales limpias cruzando la
 * ciudad de noche — y quien mire un mapa de defensa no tiene por qué saber que
 * ese trazo no es evidencia.
 *
 * El hueco no desaparece: se sigue marcando con su capa en ámbar. Lo que
 * cambia es que ya no se afirma un camino dentro de él.
 */
export function partirEnHuecos(puntos: PuntoTraza[], umbralMinutos: number): PuntoTraza[][] {
  if (puntos.length === 0) return [];
  const tramos: PuntoTraza[][] = [[puntos[0]!]];
  for (let i = 1; i < puntos.length; i += 1) {
    const minutos = (puntos[i]!.at.getTime() - puntos[i - 1]!.at.getTime()) / 60_000;
    if (minutos > umbralMinutos) tramos.push([puntos[i]!]);
    else tramos[tramos.length - 1]!.push(puntos[i]!);
  }
  return tramos;
}

/**
 * Kilómetros recorridos, descartando saltos del equipo.
 *
 * Misma regla y mismo umbral que el censo de `recorrido.ts` — deliberadamente,
 * porque dos pantallas del mismo producto que suman kilómetros distintos para
 * la misma unidad destruyen la credibilidad de las dos. Y por eso el número
 * viaja SIEMPRE con sus descartes: cada salto deja un hueco en la suma y no hay
 * regla honesta para rellenarlo.
 */
export function kilometros(puntos: PuntoTraza[]): { km: number; saltosDescartados: number } {
  let km = 0;
  let saltosDescartados = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    const horas = (b.at.getTime() - a.at.getTime()) / 3_600_000;
    if (horas <= 0) continue;
    const tramo = haversineKm(a.lat, a.lng, b.lat, b.lng);
    if (tramo / horas > SALTO_GPS_KMH) {
      saltosDescartados += 1;
      continue;
    }
    km += tramo;
  }
  return { km, saltosDescartados };
}
