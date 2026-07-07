import type {
  VerificationInput,
  VerificationResult,
  GpsPoint,
  LedgerStep,
  ComplianceStatus,
  TimingStatus,
} from "@jtel/domain";

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lng;
    const yi = polygon[i]!.lat;
    const xj = polygon[j]!.lng;
    const yj = polygon[j]!.lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findGeofenceEntry(
  points: GpsPoint[],
  polygon: Array<{ lat: number; lng: number }>,
): Date | null {
  for (const point of points) {
    if (pointInPolygon({ lat: point.latitude, lng: point.longitude }, polygon)) {
      return point.timestamp;
    }
  }
  return null;
}

export function computeRouteMatchPct(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  thresholdKm = 0.5,
): number {
  if (waypoints.length === 0 || points.length === 0) return 0;

  let matched = 0;
  for (const wp of waypoints) {
    const closest = points.reduce((min, p) => {
      const dist = haversineKm(wp.lat, wp.lng, p.latitude, p.longitude);
      return dist < min ? dist : min;
    }, Infinity);
    if (closest <= thresholdKm) matched++;
  }

  return (matched / waypoints.length) * 100;
}

export function groupPointsByImei(points: GpsPoint[]): Map<string, GpsPoint[]> {
  const groups = new Map<string, GpsPoint[]>();
  for (const point of points) {
    const existing = groups.get(point.imei) ?? [];
    existing.push(point);
    groups.set(point.imei, existing);
  }
  return groups;
}

export function determineTiming(
  arrivalAt: Date,
  deadline: Date,
  toleranceMinutes: number,
): TimingStatus {
  const diffMs = arrivalAt.getTime() - deadline.getTime();
  const diffMin = diffMs / 60000;

  if (diffMin < -toleranceMinutes) return "temprano";
  if (diffMin <= toleranceMinutes) return "a_tiempo";
  return "tarde";
}

export function verifyService(input: VerificationInput): VerificationResult {
  const steps: LedgerStep[] = [];
  const candidateUnits: VerificationResult["candidateUnits"] = [];

  steps.push({
    step: "inicio",
    result: "evaluando",
    details: { occurrenceId: input.occurrenceId, pointCount: input.evidencePoints.length },
  });

  if (input.evidencePoints.length === 0) {
    steps.push({ step: "evidencia", result: "indisponible" });
    return {
      status: "pendiente_evidencia",
      timing: null,
      observedUnitId: null,
      observedArrivalAt: null,
      observedRouteMatchPct: null,
      lateExcusable: false,
      routeStrictnessApplied: input.routeStrictness,
      ledgerSteps: steps,
      candidateUnits: [],
    };
  }

  steps.push({ step: "evidencia", result: "disponible", details: { count: input.evidencePoints.length } });

  const byImei = groupPointsByImei(input.evidencePoints);

  for (const [imei, points] of byImei) {
    const arrivalAt = findGeofenceEntry(points, input.geofencePolygon);
    const routeMatchPct =
      input.routeStrictness === "kml_full" && input.kmlWaypoints
        ? computeRouteMatchPct(points, input.kmlWaypoints)
        : arrivalAt
          ? 100
          : 0;

    const servedRoute =
      input.routeStrictness === "kml_full"
        ? routeMatchPct >= 80
        : arrivalAt !== null;

    candidateUnits.push({
      unitId: imei,
      servedRoute,
      arrivalAt,
      routeMatchPct,
    });

    steps.push({
      step: "candidata",
      result: servedRoute ? "sirvio_ruta" : "no_sirvio",
      details: { imei, arrivalAt: arrivalAt?.toISOString(), routeMatchPct },
    });
  }

  const serving = candidateUnits
    .filter((c) => c.servedRoute)
    .sort((a, b) => {
      if (!a.arrivalAt) return 1;
      if (!b.arrivalAt) return -1;
      return a.arrivalAt.getTime() - b.arrivalAt.getTime();
    });

  if (serving.length === 0) {
    steps.push({ step: "decision", result: "no_cumplido", details: { reason: "ninguna_unidad_sirvio" } });
    return {
      status: "no_cumplido",
      timing: null,
      observedUnitId: null,
      observedArrivalAt: null,
      observedRouteMatchPct: null,
      lateExcusable: false,
      routeStrictnessApplied: input.routeStrictness,
      ledgerSteps: steps,
      candidateUnits,
    };
  }

  const winner = serving[0]!;
  const timing = winner.arrivalAt
    ? determineTiming(winner.arrivalAt, input.expectedDeadline, input.toleranceMinutes)
    : null;

  const lateExcusable =
    timing === "tarde" && input.manualExcusable != null;

  let status: ComplianceStatus = "cumplido";
  if (timing === "tarde" && !lateExcusable) {
    status = "no_cumplido";
  }

  steps.push({
    step: "decision",
    result: status,
    details: {
      observedUnit: winner.unitId,
      timing,
      lateExcusable,
      arrivalAt: winner.arrivalAt?.toISOString(),
    },
  });

  return {
    status,
    timing,
    observedUnitId: winner.unitId,
    observedArrivalAt: winner.arrivalAt,
    observedRouteMatchPct: winner.routeMatchPct,
    lateExcusable,
    routeStrictnessApplied: input.routeStrictness,
    ledgerSteps: steps,
    candidateUnits,
  };
}
