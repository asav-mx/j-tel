/**
 * El periodo que se está mirando — función pura, sin base de datos.
 *
 * Un día con franja horaria y un rango de días son el mismo filtro: cambia
 * cuántas fechas trae y el rango de horas se aplica DENTRO de cada día. Así
 * "el primer turno de los últimos cinco días" es una consulta natural y no un
 * caso especial.
 *
 * Vive aparte de la consulta para poder probarse: aquí es donde se decide qué
 * ventana de tiempo se le pide a la base, y equivocarse en eso es equivocarse
 * en todo lo que la pantalla afirma después.
 */

import { instanteZonificado } from "@jtel/domain";
import { JTTEL_TZ } from "./local-time";
import { addDaysIso, todayIso } from "./date-range";

/**
 * Tope de días por consulta.
 *
 * Hoy la telemetría se lee por carrier y se filtra por unidad en memoria: no
 * hay índice por `unit_id`. Siete días es lo que rinde sin que la pantalla se
 * vuelva lenta. El tope NUNCA es silencioso — la pantalla dice cuántos días
 * pidió el usuario y cuántos está viendo.
 *
 * La salida cuando estorbe no es recortar más, sino una consulta por unidad
 * en `@jtel/db` con su índice `(carrier_account_id, unit_id, recorded_at)`.
 */
export const MAX_DIAS = 7;

export type Periodo = {
  /** Días civiles del periodo, del más reciente al más antiguo. */
  fechas: string[];
  fechaDesde: string;
  fechaHasta: string;
  minutosDesde: number;
  minutosHasta: number;
  cruzaMedianoche: boolean;
  /** Instante de arranque del primer día y de cierre del último. */
  desde: Date;
  hasta: Date;
  /** Días que el usuario pidió y que el tope dejó fuera. Se dice en pantalla. */
  diasPedidos: number;
  diasRecortados: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && ISO_DATE.test(raw.trim()) ? raw.trim() : null;
}

export function minutosDeHhMm(
  raw: string | string[] | undefined,
  porDefecto: number,
): number {
  if (typeof raw !== "string") return porDefecto;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return porDefecto;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return porDefecto;
  return h * 60 + min;
}

export function hhMm(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function diasEntre(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  let cursor = hasta;
  // Del más reciente al más antiguo: lo último que hizo la unidad es lo
  // primero que el carrier quiere ver.
  while (cursor >= desde && fechas.length < 366) {
    fechas.push(cursor);
    cursor = addDaysIso(cursor, -1, JTTEL_TZ);
  }
  return fechas;
}

/**
 * El periodo pedido, ya acotado.
 *
 * Un día con franja horaria y un rango de días son el mismo filtro: cambia
 * cuántas fechas trae. El rango de horas se aplica DENTRO de cada día, así
 * que "el primer turno de los últimos cinco días" es una consulta natural.
 */
export function resolverPeriodo(
  sp: Record<string, string | string[] | undefined> | undefined,
  opciones: { maxDias?: number } = {},
): Periodo {
  const maxDias = opciones.maxDias ?? MAX_DIAS;
  const hoy = todayIso(JTTEL_TZ);

  const hasta = fechaValida(sp?.hasta) ?? fechaValida(sp?.fecha) ?? hoy;
  const desdePedido = fechaValida(sp?.desde) ?? fechaValida(sp?.fecha) ?? hasta;
  // Un rango al revés es un dedo torcido, no una intención: se endereza.
  const desde = desdePedido > hasta ? hasta : desdePedido;

  const todas = diasEntre(desde, hasta);
  const fechas = todas.slice(0, maxDias);

  const minutosDesde = minutosDeHhMm(sp?.horaDesde, 0);
  const minutosHasta = minutosDeHhMm(sp?.horaHasta, 0);
  /*
   * Dos cosas distintas que es fácil confundir en una sola bandera:
   *
   *   envuelve        — la franja termina al día siguiente, y por eso el
   *                     cierre necesita +1440 minutos. El día completo
   *                     (00:00 a 00:00) TAMBIÉN envuelve: sin esto la
   *                     ventana quedaría de duración cero.
   *   cruzaMedianoche — lo que se le dice al usuario. El día completo no
   *                     "cierra al día siguiente": es el día entero, y
   *                     decírselo así lo hace dudar de la fecha que pidió.
   */
  const diaCompleto = minutosDesde === 0 && minutosHasta === 0;
  const envuelve = minutosHasta <= minutosDesde;
  const cruzaMedianoche = envuelve && !diaCompleto;

  const primera = fechas[fechas.length - 1] ?? hasta;
  const ultima = fechas[0] ?? hasta;

  return {
    fechas,
    fechaDesde: primera,
    fechaHasta: ultima,
    minutosDesde,
    minutosHasta,
    cruzaMedianoche,
    // Un solo reloj: el mismo `instanteZonificado` que usa el resto del
    // producto. Una segunda implementación de la zona horaria es exactamente
    // el bug que costó el turno vespertino.
    desde: instanteZonificado(primera, minutosDesde, JTTEL_TZ),
    hasta: instanteZonificado(ultima, envuelve ? minutosHasta + 1440 : minutosHasta, JTTEL_TZ),
    diasPedidos: todas.length,
    diasRecortados: Math.max(0, todas.length - fechas.length),
  };
}
