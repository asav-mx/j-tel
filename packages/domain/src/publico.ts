import { createHmac } from "node:crypto";
import { proyectarSobreTrazado } from "./trazado.js";
import { localDateIso, localTimeHHMM } from "./tiempo.js";

/**
 * Lo que el endpoint público necesita decidir, sin base de datos.
 *
 * Todo lo de aquí es puro a propósito: son las decisiones que deciden **qué se
 * le enseña a un pasajero**, y una decisión así tiene que poder probarse sin
 * montar un circuito. La consulta trae datos crudos; estas funciones dicen qué
 * de esos datos se puede afirmar.
 *
 * Ningún umbral vive aquí. La frecuencia, el horario y los segundos de dato
 * viejo son **campos por circuito** y entran por parámetro: hornear cualquiera
 * convertiría el alta de un concesionario nuevo en un despliegue.
 */

// ── Identidad pública ────────────────────────────────────────────────────

/**
 * El identificador opaco de una unidad, para un día.
 *
 * **Rota cada día, en la zona del circuito.** Dentro del día es estable, que es
 * lo que permite a la app animar el mismo camión moviéndose en vez de verlo
 * parpadear; entre días no se puede ligar, así que nadie arma el historial de
 * un camión —ni de su chofer— raspando el endpoint día tras día.
 *
 * HMAC y no un hash a secas: sin la llave, cualquiera con una lista de
 * identificadores de unidad podría recalcularlo y deshacer el anonimato.
 */
export function idPublicoDelDia(unitId: string, fechaLocal: string, secreto: string): string {
  if (!secreto) throw new Error("idPublicoDelDia necesita una llave: sin ella el id no es opaco");
  return createHmac("sha256", secreto).update(`${unitId}:${fechaLocal}`).digest("hex").slice(0, 12);
}

/** La fecha civil del circuito, que es la que hace rotar el identificador. */
export function fechaLocalDelCircuito(ahora: Date, zona: string): string {
  return localDateIso(ahora, zona);
}

// ── Horario de servicio ──────────────────────────────────────────────────

/**
 * ¿El circuito está en horario de servicio ahora?
 *
 * **Aguanta que la ventana cruce la medianoche.** Un circuito de 05:00 a 23:00
 * es el caso fácil; uno de 22:00 a 06:00 es un servicio nocturno real, y con
 * una comparación ingenua daría `false` toda la noche — justo cuando corre.
 *
 * Las horas llegan como las guarda Postgres (`HH:MM` o `HH:MM:SS`) y se
 * comparan como texto, que en 24 h con cero a la izquierda ordena igual que el
 * reloj. Sin construir fechas: construirlas obliga a inventar un día y a
 * atravesar el horario de verano por nada.
 */
export function enHorarioDeServicio(
  ahora: Date,
  inicioLocal: string,
  finLocal: string,
  zona: string,
): boolean {
  const hhmm = localTimeHHMM(ahora, zona);
  const inicio = inicioLocal.slice(0, 5);
  const fin = finLocal.slice(0, 5);
  if (inicio === fin) return true; // 24 horas: no hay hueco que dejar fuera.
  return inicio < fin ? hhmm >= inicio && hhmm < fin : hhmm >= inicio || hhmm < fin;
}

// ── Frescura ─────────────────────────────────────────────────────────────

/** Segundos desde que el aparato tomó el fix. La cuenta la hace el servidor. */
export function antiguedadSegundos(recordedAt: Date, ahora: Date): number {
  return Math.max(0, Math.round((ahora.getTime() - recordedAt.getTime()) / 1000));
}

/**
 * ¿La posición todavía dice dónde está el camión?
 *
 * El umbral entra por parámetro porque es del circuito. **No reutiliza
 * `SIN_SENAL_MINUTOS`**, que es el de la torre interna: otro público, otro
 * número, y mezclarlos haría que afinar uno moviera al otro sin querer.
 */
export function esFresco(antiguedadSeg: number, umbralSegundos: number): boolean {
  return antiguedadSeg < umbralSegundos;
}

// ── Sentido ──────────────────────────────────────────────────────────────

export type Sentido = "ida" | "vuelta";

export interface TrazadoDeSentido {
  sentido: Sentido;
  coordinates: Array<[number, number]>;
}

/**
 * Cuánto se puede alejar el punto del trazado antes de dejar de estar «en el
 * circuito». Los 150 m salen de la geometría del archivo, no del gusto: el KML
 * del circuito 1 tiene huecos de hasta 224 m entre vértices, y con proyección
 * punto-a-segmento un camión a media cuadra de una avenida ancha sigue estando
 * sobre su recorrido.
 *
 * Es tolerancia del instrumento, no política de operación. Si algún día un
 * corredor pide otra, se vuelve columna del circuito como los demás umbrales.
 */
export const CORREDOR_METROS_POR_DEFECTO = 150;

/** Cuánto puede diferir el rumbo del camión del rumbo del tramo y seguir siendo ese sentido. */
const RUMBO_TOLERANCIA_GRADOS = 70;

/** Cuánto tiene que ganarle un sentido al otro para poder decidir entre los dos. */
const VENTAJA_MINIMA_GRADOS = 25;

/**
 * De qué lado va la unidad: `"ida"`, `"vuelta"`, o **`null` cuando no se puede
 * afirmar**.
 *
 * Ida y vuelta no son espejo —20.83 km contra 16.44 en el circuito 1, por los
 * sentidos únicos del Centro—, pero comparten tramos, y en un tramo compartido
 * la posición sola no distingue nada. Lo que distingue es **hacia dónde
 * apunta**: se compara el rumbo del aparato contra el rumbo del tramo donde
 * cayó la proyección.
 *
 * Devuelve `null` en todos los casos donde el instrumento no vio lo suficiente:
 * sin trazados, sin rumbo, fuera del corredor, o con los dos sentidos igual de
 * plausibles. Un sentido inventado es peor que un hueco declarado — mandaría al
 * pasajero a esperar del otro lado de la calle.
 */
export function sentidoDeLaUnidad(
  punto: { lat: number; lon: number },
  rumboGrados: number | null,
  trazados: TrazadoDeSentido[],
  corredorMetros = CORREDOR_METROS_POR_DEFECTO,
): Sentido | null {
  if (trazados.length === 0) return null;
  if (rumboGrados === null || !Number.isFinite(rumboGrados)) return null;

  const candidatos: Array<{ sentido: Sentido; desvio: number }> = [];

  for (const t of trazados) {
    const p = proyectarSobreTrazado(punto, t.coordinates);
    if (!p) continue;
    if (p.distanciaMetros > corredorMetros) continue;

    const a = t.coordinates[p.indiceSegmento];
    const b = t.coordinates[p.indiceSegmento + 1];
    if (!a || !b) continue;

    const desvio = diferenciaAngular(rumboGrados, rumboDelTramo(a, b));
    if (desvio > RUMBO_TOLERANCIA_GRADOS) continue;
    candidatos.push({ sentido: t.sentido, desvio });
  }

  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0].sentido;

  candidatos.sort((x, y) => x.desvio - y.desvio);
  // Empate técnico: los dos sentidos explican igual de bien lo que se ve.
  if (candidatos[1].desvio - candidatos[0].desvio < VENTAJA_MINIMA_GRADOS) return null;
  return candidatos[0].sentido;
}

/** Rumbo de un tramo en grados desde el norte, en el sentido del reloj. */
function rumboDelTramo(a: [number, number], b: [number, number]): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const rad = Math.PI / 180;
  const lat1 = latA * rad;
  const lat2 = latB * rad;
  const dLon = (lonB - lonA) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

/** Diferencia entre dos rumbos, siempre entre 0 y 180. */
function diferenciaAngular(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}
