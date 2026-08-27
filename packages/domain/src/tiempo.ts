/**
 * Tiempo civil: qué día es, qué hora es, y en qué zona.
 *
 * Vive en su propio módulo —y no dentro de `index.ts`— desde que el endpoint
 * público necesitó `localDateIso` y `localTimeHHMM`. Importarlas del índice
 * habría cerrado un ciclo (`index` reexporta `publico`, `publico` importa
 * `index`), y la salida fácil —copiar las seis líneas de `Intl`— es justo la
 * que el comentario de `localDateIso` prohíbe: es LA función canónica para
 * resolver qué día es, y dos copias divergen sin que nadie lo note.
 *
 * `index.ts` las reexporta, así que para quien las usa no cambió nada.
 */

// ── Zona horaria ────────────────────────────────────────────────────────
/**
 * Zona horaria por defecto del despliegue j-tel.
 * Usar solo cuando no hay un contrato en contexto (vistas multi-contrato,
 * dashboard J-Staff, cron jobs del sistema).
 * Para vistas de un contrato específico, usar `contract.policy.timeZone`.
 */
export const JTTEL_TZ = "America/Ciudad_Juarez";

/**
 * Fecha civil YYYY-MM-DD en la zona indicada.
 * Esta es LA función canónica para resolver "qué día es" — no duplicar.
 */
export function localDateIso(now = new Date(), timeZone = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
/** Desplazamiento de una zona respecto a UTC, en ms, para un instante dado. */
function desplazamientoMs(instante: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  return (
    Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) -
    instante.getTime()
  );
}

/**
 * Una fecha civil y unos minutos desde su medianoche, en una zona, al instante
 * real que les corresponde.
 *
 * Esta es LA función canónica para ir de "tal día a tal hora, allá" a un
 * instante — la pareja que faltaba de `localDateIso` y `dayForDateQuery`.
 *
 * **Nunca construir estas fechas a mano.** `new Date(\`${fecha}T00:00:00\`)`,
 * sin marca de zona, se resuelve en la zona del proceso que corre: el mismo
 * código da un instante en una laptop y otro seis horas distinto en Vercel.
 * Ese fue el bug que produjo 294 hechos sellados con la hora equivocada, con
 * un solo cumplido entre ellos.
 *
 * `minutos` puede ser negativo o pasar de 1440: se interpreta como
 * desplazamiento desde la medianoche civil y puede caer en otro día.
 *
 * Dos pasadas a propósito: la primera conjetura el desplazamiento con la hora
 * equivocada, la segunda lo corrige. Sin eso, los dos días del año en que
 * cambia el horario salen con una hora de error.
 */
export function instanteZonificado(
  fechaIso: string,
  minutos: number,
  timeZone: string = JTTEL_TZ,
): Date {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split("-").map(Number);
  const civil = Date.UTC(anio!, mes! - 1, dia!, 0, 0, 0) + minutos * 60_000;
  const primera = civil - desplazamientoMs(new Date(civil), timeZone);
  return new Date(civil - desplazamientoMs(new Date(primera), timeZone));
}

/**
 * Construye la fecha de consulta para `findForScope` y funciones similares
 * a partir de una cadena YYYY-MM-DD.
 *
 * Usa mediodía UTC (T12:00:00.000Z) — no medianoche — porque el cambio de
 * día UTC cruza la tarde civil de Juárez (18:00 h del día anterior cuando
 * el reloj marca 00:00 UTC). Mediodía UTC = 06:00 Juárez en verano y
 * 05:00 Juárez en invierno: siempre el mismo día civil en cualquier zona
 * entre UTC-12 y UTC+12.
 *
 * Es la pareja canónica de `localDateIso`:
 *   `string → Date`  (esta función, para armar consultas a la BD)
 *   `Date → string`  (`localDateIso`, para resolver "qué día es")
 */
export function dayForDateQuery(fechaIso: string): Date {
  return new Date(`${fechaIso}T12:00:00.000Z`);
}

/**
 * Devuelve las fechas civiles YYYY-MM-DD en [fromIso, toIso] cuyo día de la
 * semana (0=Dom … 6=Sáb) esté en `activeDays`.
 *
 * Itera sobre strings de fecha civil — el DOW y el string salen del mismo
 * calendario. Usa mediodía UTC para derivar el DOW: nunca cruza cambio de día
 * entre UTC-12 y UTC+12, por lo que getUTCDay() es siempre el día civil correcto.
 */
export function civilDatesInRange(
  fromIso: string,
  toIso: string,
  activeDays: number[],
): string[] {
  const result: string[] = [];
  let current = fromIso;
  while (current <= toIso) {
    if (activeDays.includes(new Date(`${current}T12:00:00.000Z`).getUTCDay()))
      result.push(current);
    const d = new Date(`${current}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    current = d.toISOString().slice(0, 10);
  }
  return result;
}

/**
 * Suma `days` días a una fecha civil YYYY-MM-DD y devuelve el resultado como string.
 *
 * Ancla mediodía UTC — mismo principio que `dayForDateQuery` y `civilDatesInRange`.
 * Usa `setUTCDate`/`getUTCDate` para que la aritmética sea puramente UTC:
 * cero `setHours`, cero dependencia del runtime TZ.
 */
export function addDaysIso(fechaIso: string, days: number): string {
  const d = new Date(`${fechaIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Formatea un timestamp como "HH:MM" (24h) en la zona indicada.
 * Para UI: deadlines, llegadas, ventanas, tooltips del mapa.
 */
export function localTimeHHMM(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/**
 * Formatea un timestamp como "YYYY-MM-DD HH:MM" en la zona indicada.
 * Para UI: tablas, expedientes, CSV.
 */
export function localDateTimeShort(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return `${localDateIso(d, timeZone)} ${localTimeHHMM(d, timeZone)}`;
}

/**
 * Como `localDateTimeShort` pero **con segundos**: "YYYY-MM-DD HH:MM:SS".
 *
 * Para donde el segundo es parte de la evidencia —el primer y el último punto
 * del rastro de una unidad, una llegada—. Y **con su fecha, siempre**: la caja
 * de aportación imprimía solo la hora y un día real de rastro salió como *«de
 * 18:28:33 a 17:58:47»*, dos números correctos formando una frase falsa. El
 * rastro se recorta en días UTC, así que en la zona de la operación cruza la
 * medianoche; una hora sin fecha no sostiene un caso.
 *
 * Vive aquí y no en la app para que el producto formate instantes en un solo
 * lugar: la versión que estaba dentro del componente además omitía `timeZone`,
 * y sin él `Intl` usa el reloj de quien mira.
 */
export function localDateTimeSeconds(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const hhmmss = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${localDateIso(d, timeZone)} ${hhmmss}`;
}
