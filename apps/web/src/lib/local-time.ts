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
  const sorted = [...shifts].sort(
    (a, b) =>
      parseHhMmToMinutes(a.startTime) - parseHhMmToMinutes(b.startTime) ||
      a.name.localeCompare(b.name),
  );
  const nowMin = localMinutesSinceMidnight(now, timeZone);
  let active: ShiftLike | null = null;
  for (const s of sorted) {
    if (parseHhMmToMinutes(s.startTime) <= nowMin) active = s;
    else break;
  }
  return active ?? sorted[0]!;
}
