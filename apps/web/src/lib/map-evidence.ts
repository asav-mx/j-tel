/**
 * Cortes y utilidades de mapa de evidencia (solo pantalla).
 * No tocan hechos ni el veredicto: recortan lo dibujado.
 */

export type EvidencePoint = { lat: number; lng: number; at: string };

export type NamedGeofence = {
  id: string;
  name: string;
  polygon: Array<{ lat: number; lng: number }>;
};

/** Punto en polígono (ray casting). Copia local para no acoplar la UI al motor. */
export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersect =
      pi.lat > point.lat !== pj.lat > point.lat &&
      point.lng <
        ((pj.lng - pi.lng) * (point.lat - pi.lat)) / (pj.lat - pi.lat + 1e-12) + pi.lng;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Fin de la ventana de calibración (solo pantalla):
 * deadline + gracia + max(60, margenDespués) minutos.
 */
export function calibrationViewEnd(
  deadline: Date,
  policy: {
    verificationGraceMinutes?: number | null;
    evidenceMarginMinutesAfter?: number | null;
  },
): Date {
  const grace = policy.verificationGraceMinutes ?? 15;
  const after = policy.evidenceMarginMinutesAfter ?? 0;
  const end = new Date(deadline);
  end.setMinutes(end.getMinutes() + grace + Math.max(60, after));
  return end;
}

/** Corta el trazo en (o antes de) observedArrivalAt. Inclusive el punto de llegada. */
export function cutTrackAtArrival(
  points: EvidencePoint[],
  observedArrivalAt: string | Date | null | undefined,
): EvidencePoint[] {
  if (!observedArrivalAt || points.length === 0) return points;
  const cutoff =
    observedArrivalAt instanceof Date
      ? observedArrivalAt.getTime()
      : new Date(observedArrivalAt).getTime();
  if (!Number.isFinite(cutoff)) return points;
  return points.filter((p) => new Date(p.at).getTime() <= cutoff);
}

/**
 * Primera entrada a alguna geocerca a lo largo del trazo (orden temporal).
 * Devuelve el punto de entrada + índice; el trazo mostrado debe cortarse ahí.
 */
export function findFirstGeofenceEntry(
  points: EvidencePoint[],
  geofences: NamedGeofence[],
): {
  geofence: NamedGeofence;
  point: EvidencePoint;
  index: number;
} | null {
  if (points.length === 0 || geofences.length === 0) return null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    for (const g of geofences) {
      if (g.polygon.length >= 3 && pointInPolygon(p, g.polygon)) {
        return { geofence: g, point: p, index: i };
      }
    }
  }
  return null;
}

/** Corta inclusive en el índice de entrada a geocerca. */
export function cutTrackAtIndex(points: EvidencePoint[], index: number): EvidencePoint[] {
  if (index < 0) return [];
  return points.slice(0, index + 1);
}
