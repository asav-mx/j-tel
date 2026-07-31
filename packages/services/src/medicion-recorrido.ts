import { measureRouteTraversal, type RouteTraversalMeasurement } from "@jtel/verification";
import type { GpsPoint } from "@jtel/domain";

/** Corredor efectivo (km) — mismo acotado que usa el motor al calificar. */
export function corridorKmFromMeters(meters: number | undefined | null): number {
  return Math.min(0.5, Math.max(0.01, (meters ?? 120) / 1000));
}

export type MeasuredTraversal = {
  /** Unidad a la que se le midió el recorrido (o su IMEI si no se resolvió). */
  unitId: string;
  measurement: RouteTraversalMeasurement;
};

/**
 * Mide cuánto duró el recorrido de la unidad que MÁS evidencia dejó sobre el
 * corredor de esta ruta.
 *
 * No se mide solo cuando el servicio cumplió, y es a propósito: las rutas que
 * hoy fallan por ventana corta son justo las que más necesitan que se sepa
 * cuánto duran. Medir es observar, no juzgar — el veredicto ya se decidió
 * antes y esto no lo toca.
 *
 * "La que más evidencia dejó" y no "la que el motor acreditó" porque una
 * ocurrencia sin veredicto de cumplimiento igual tiene una unidad que
 * recorrió la ruta; ignorarla dejaría la historia vacía precisamente donde
 * hace falta.
 */
export function measureBestTraversal(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  corridorKm: number,
  opts: {
    /** Llegada a la geocerca por unidad, cuando el motor la conoce. */
    arrivalAtByUnit?: Map<string, Date | null>;
    window?: { start: Date; end: Date } | null;
    /** Puntos mínimos en corredor para que la medición valga. */
    minPointsInCorridor?: number;
  } = {},
): MeasuredTraversal | null {
  if (waypoints.length === 0 || points.length === 0) return null;
  const minPoints = Math.max(1, opts.minPointsInCorridor ?? 3);

  const byUnit = new Map<string, GpsPoint[]>();
  for (const p of points) {
    const arr = byUnit.get(p.imei) ?? [];
    arr.push(p);
    byUnit.set(p.imei, arr);
  }

  let best: MeasuredTraversal | null = null;
  for (const [unitId, unitPoints] of byUnit) {
    const measurement = measureRouteTraversal(unitPoints, waypoints, corridorKm, {
      arrivalAt: opts.arrivalAtByUnit?.get(unitId) ?? null,
      window: opts.window ?? null,
    });
    if (measurement.durationMinutes == null || measurement.durationMinutes <= 0) continue;
    if (measurement.pointsInCorridor < minPoints) continue;
    if (
      !best ||
      measurement.pointsInCorridor > best.measurement.pointsInCorridor ||
      (measurement.pointsInCorridor === best.measurement.pointsInCorridor &&
        measurement.durationMinutes > (best.measurement.durationMinutes ?? 0))
    ) {
      best = { unitId, measurement };
    }
  }

  return best;
}
