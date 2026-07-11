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

export type EvidenceCoverageAssessment = {
  coveragePct: number;
  maxGapMs: number;
  windowMs: number;
  pointCount: number;
  sufficient: boolean;
};

/**
 * Cobertura temporal de una ventana.
 *
 * Un tramo entre dos lecturas (o borde↔lectura) cuenta como cubierto si su
 * duración ≤ maxGapMinutes; si es mayor, es un hueco. Suficiente solo si
 * coveragePct ≥ minCoveragePct y el hueco máximo ≤ maxGapMinutes.
 */
export function assessEvidenceCoverage(
  timestamps: Date[],
  windowStart: Date,
  windowEnd: Date,
  opts: { minCoveragePct?: number; maxGapMinutes?: number } = {},
): EvidenceCoverageAssessment {
  const minCoveragePct = opts.minCoveragePct ?? 80;
  const maxAllowedGapMs = (opts.maxGapMinutes ?? 10) * 60_000;
  const start = windowStart.getTime();
  const end = windowEnd.getTime();
  const windowMs = Math.max(0, end - start);

  if (windowMs <= 0) {
    return {
      coveragePct: 100,
      maxGapMs: 0,
      windowMs: 0,
      pointCount: 0,
      sufficient: true,
    };
  }

  const sorted = timestamps
    .map((t) => t.getTime())
    .filter((t) => t >= start && t <= end)
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return {
      coveragePct: 0,
      maxGapMs: windowMs,
      windowMs,
      pointCount: 0,
      sufficient: false,
    };
  }

  const anchors = [start, ...sorted, end];
  let coveredMs = 0;
  let largestGap = 0;
  for (let i = 1; i < anchors.length; i++) {
    const gap = anchors[i]! - anchors[i - 1]!;
    if (gap > largestGap) largestGap = gap;
    if (gap <= maxAllowedGapMs) coveredMs += gap;
  }

  const coveragePct = Math.max(
    0,
    Math.min(100, (coveredMs / windowMs) * 100),
  );

  return {
    coveragePct,
    maxGapMs: largestGap,
    windowMs,
    pointCount: sorted.length,
    sufficient:
      coveragePct + 1e-9 >= minCoveragePct && largestGap <= maxAllowedGapMs,
  };
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

  // Precondición (Fase 1): sin cobertura suficiente → pendiente, nunca no_cumplido.
  if (input.coverageWindowStart && input.coverageWindowEnd) {
    const coverage = assessEvidenceCoverage(
      input.evidencePoints.map((p) => p.timestamp),
      input.coverageWindowStart,
      input.coverageWindowEnd,
      {
        minCoveragePct: input.evidenceMinCoveragePct,
        maxGapMinutes: input.evidenceMaxGapMinutes,
      },
    );
    steps.push({
      step: "cobertura_evidencia",
      result: coverage.sufficient ? "suficiente" : "insuficiente",
      details: {
        coveragePct: Number(coverage.coveragePct.toFixed(1)),
        maxGapMinutes: Number((coverage.maxGapMs / 60_000).toFixed(1)),
        minCoveragePct: input.evidenceMinCoveragePct ?? 80,
        maxGapMinutesAllowed: input.evidenceMaxGapMinutes ?? 10,
        pointCountInWindow: coverage.pointCount,
      },
    });
    if (!coverage.sufficient) {
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
  }

  steps.push({ step: "evidencia", result: "disponible", details: { count: input.evidencePoints.length } });

  const hasKml = (input.kmlWaypoints?.length ?? 0) > 0;
  // Umbral configurable en la política del contrato. Sin KML no aplica.
  const minKmlPct = hasKml
    ? Math.min(100, Math.max(0, input.kmlMatchMinPct ?? 60))
    : 0;

  const byImei = groupPointsByImei(input.evidencePoints);

  for (const [imei, points] of byImei) {
    const sorted = [...points].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const arrivalAt = findGeofenceEntry(sorted, input.geofencePolygon);
    const routeMatchPct = hasKml
      ? computeRouteMatchPct(sorted, input.kmlWaypoints!)
      : arrivalAt
        ? 100
        : 0;

    const servedRoute =
      arrivalAt !== null && (!hasKml || routeMatchPct >= minKmlPct);

    candidateUnits.push({
      unitId: imei,
      servedRoute,
      arrivalAt,
      routeMatchPct,
    });

    steps.push({
      step: "candidata",
      result: servedRoute ? "sirvio_ruta" : "no_sirvio",
      details: {
        imei,
        arrivalAt: arrivalAt?.toISOString(),
        routeMatchPct,
        hasKml,
        minKmlPct,
      },
    });
  }

  const serving = candidateUnits
    .filter((c) => c.servedRoute)
    .sort((a, b) => {
      // Con KML: gana quien mejor siguió la ruta; empate → quien llegó primero.
      if (hasKml) {
        const diff = (b.routeMatchPct ?? 0) - (a.routeMatchPct ?? 0);
        if (Math.abs(diff) >= 1) return diff;
      }
      if (!a.arrivalAt) return 1;
      if (!b.arrivalAt) return -1;
      return a.arrivalAt.getTime() - b.arrivalAt.getTime();
    });

  if (serving.length === 0) {
    steps.push({
      step: "decision",
      result: "no_cumplido",
      details: { reason: hasKml ? "ninguna_unidad_coincidio_ruta" : "ninguna_unidad_sirvio" },
    });
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

  // Cumplimiento de ruta ≠ puntualidad.
  // Si sirvió la ruta (geocerca + KML), el status es cumplido; "tarde" vive en timing.
  const lateExcusable =
    timing === "tarde" && input.manualExcusable != null;
  const status: ComplianceStatus = "cumplido";

  steps.push({
    step: "decision",
    result: status,
    details: {
      observedUnit: winner.unitId,
      timing,
      lateExcusable,
      arrivalAt: winner.arrivalAt?.toISOString(),
      routeMatchPct: winner.routeMatchPct,
      hasKml,
      minKmlPct: hasKml ? minKmlPct : undefined,
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
