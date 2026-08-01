/**
 * Re-exporta las utilidades de zona horaria desde @jtel/domain
 * (una sola implementación canónica) y agrega helpers específicos de la UI.
 */
export { JTTEL_TZ, localDateIso } from "@jtel/domain";
import { JTTEL_TZ } from "@jtel/domain";

/** Minutos desde medianoche local (0–1439). */
export function localMinutesSinceMidnight(now = new Date(), timeZone = JTTEL_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** Parsea "HH:MM" o "HH:MM:SS" → minutos desde medianoche. */
export function parseHhMmToMinutes(time: string): number {
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export type ShiftLike = { id: string; name: string; startTime: string };

/**
 * Turno activo según la hora local.
 * - Si ya pasó el inicio de uno o más turnos hoy → el más reciente.
 * - Si aún no inicia el primero → el próximo (primer turno del día).
 *
 * El monitorista puede sobreescribir manualmente con ?turno=.
 */
export function pickActiveShift(
  shifts: ShiftLike[],
  now = new Date(),
  timeZone = JTTEL_TZ,
): ShiftLike | null {
  if (shifts.length === 0) return null;
  const sorted = ordenarPorHora(shifts);
  const nowMin = localMinutesSinceMidnight(now, timeZone);
  let active: ShiftLike | null = null;
  for (const s of sorted) {
    if (parseHhMmToMinutes(s.startTime) <= nowMin) active = s;
    else break;
  }
  return active ?? sorted[0]!;
}

function ordenarPorHora(shifts: ShiftLike[]): ShiftLike[] {
  return [...shifts].sort(
    (a, b) =>
      parseHhMmToMinutes(a.startTime) - parseHhMmToMinutes(b.startTime) ||
      a.name.localeCompare(b.name),
  );
}

export type ProximoTurno = {
  turno: ShiftLike;
  /** El turno es del día siguiente: hoy ya no queda ninguna salida. */
  manana: boolean;
  /** Cuánto falta para su hora de inicio, en minutos. */
  minutosPara: number;
};

/**
 * El turno que sigue, para la cuenta regresiva del estado "sin turno activo".
 *
 * Distingue los dos casos que `pickActiveShift` colapsa: si hoy todavía queda
 * una salida, esa es la siguiente; si el día ya cerró, la siguiente es la
 * primera de mañana y la cuenta regresiva cruza la medianoche. Devolver el
 * primer turno del día en ese caso daría una hora que ya pasó.
 */
export function pickNextShift(
  shifts: ShiftLike[],
  now = new Date(),
  timeZone = JTTEL_TZ,
): ProximoTurno | null {
  if (shifts.length === 0) return null;
  const sorted = ordenarPorHora(shifts);
  const nowMin = localMinutesSinceMidnight(now, timeZone);

  const hoy = sorted.find((s) => parseHhMmToMinutes(s.startTime) > nowMin);
  if (hoy) {
    return {
      turno: hoy,
      manana: false,
      minutosPara: parseHhMmToMinutes(hoy.startTime) - nowMin,
    };
  }

  const primero = sorted[0]!;
  return {
    turno: primero,
    manana: true,
    minutosPara: 24 * 60 - nowMin + parseHhMmToMinutes(primero.startTime),
  };
}

/** "2 h 14 min", "45 min" — duración, nunca con formato de hora. */
export function formatearDuracion(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
