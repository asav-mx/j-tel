import type {
  VerificationInput,
  VerificationResult,
  GpsPoint,
  LedgerStep,
  ComplianceStatus,
  TimingStatus,
} from "@jtel/domain";

import { haversineKm } from "@jtel/domain";

/**
 * La geometría base y la matemática de la ventana viven en `@jtel/domain`:
 * la política las necesita para dimensionar la ventana de cada ocurrencia, y
 * el dominio no puede depender del motor sin cerrar un ciclo. Se re-exportan
 * aquí para que quien trabaje con el motor las siga encontrando donde
 * estaban — es la MISMA función, no una copia.
 */
export {
  haversineKm,
  routeLengthKm,
  summarizeRouteDuration,
  estimateRouteDurationMinutes,
  deriveObservationWindow,
  DEFAULT_WINDOW_SLACK_PCT,
  DEFAULT_ROUTE_DURATION_PERCENTILE,
  DEFAULT_ROUTE_DURATION_MIN_SAMPLES,
  DEFAULT_MAX_WINDOW_BEFORE_MINUTES,
  DEFAULT_ROUTE_AVG_SPEED_KMH,
} from "@jtel/domain";
export type {
  RouteDurationSample,
  RouteDurationSummary,
  ObservationWindowBasis,
  ObservationWindowParams,
  DerivedObservationWindow,
} from "@jtel/domain";

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
  thresholdKm = 0.12,
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

/** Distancia mínima de un punto al polilínea (segmentos entre waypoints). */
export function minDistanceToRouteKm(
  point: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }>,
): number {
  if (waypoints.length === 0) return Infinity;
  if (waypoints.length === 1) {
    return haversineKm(point.lat, point.lng, waypoints[0]!.lat, waypoints[0]!.lng);
  }

  let min = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const dist = distPointToSegmentKm(point, a, b);
    if (dist < min) min = dist;
  }
  return min;
}

function distPointToSegmentKm(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  // Proyección equirectangular local (suficiente a escala de corredor <1 km).
  const lat0 = ((a.lat + b.lat + p.lat) / 3) * (Math.PI / 180);
  const toXY = (lat: number, lng: number) => ({
    x: lng * Math.cos(lat0) * 111.32,
    y: lat * 110.57,
  });
  const P = toXY(p.lat, p.lng);
  const A = toXY(a.lat, a.lng);
  const B = toXY(b.lat, b.lng);
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return haversineKm(p.lat, p.lng, a.lat, a.lng);
  let t = ((P.x - A.x) * abx + (P.y - A.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * abx;
  const cy = A.y + t * aby;
  const dx = P.x - cx;
  const dy = P.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Fracción máxima de la ruta sin evidencia cercana antes de considerar el origen no observado. */
export const DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION = 0.15;

/**
 * Fracción acumulada de distancia de cada waypoint sobre la longitud total
 * del KML: 0 en el origen, 1 en el destino.
 */
export function cumulativeRouteFractions(
  waypoints: Array<{ lat: number; lng: number }>,
): number[] {
  if (waypoints.length === 0) return [];
  const cumKm: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cumKm.push(
      cumKm[i - 1]! +
        haversineKm(
          waypoints[i - 1]!.lat,
          waypoints[i - 1]!.lng,
          waypoints[i]!.lat,
          waypoints[i]!.lng,
        ),
    );
  }
  const total = cumKm[cumKm.length - 1]!;
  if (total <= 0) return waypoints.map(() => 0);
  return cumKm.map((d) => d / total);
}

/**
 * Qué tan lejos, sobre la ruta, empieza la evidencia observada. 0 = se vio
 * el origen; 1 = solo se vio cerca del destino; null = ningún punto cayó
 * dentro del corredor en ningún waypoint del KML.
 *
 * No distingue "el chofer se saltó el arranque" de "la ventana de
 * observación abrió después de que la ruta ya había arrancado" — la Ley 1
 * dice que esa distinción no le toca resolverla a un veredicto: ambas son
 * observación insuficiente del origen.
 */
export function earliestObservedRouteFraction(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  thresholdKm: number,
): number | null {
  if (waypoints.length === 0 || points.length === 0) return null;
  const fractions = cumulativeRouteFractions(waypoints);
  let earliest: number | null = null;
  for (let i = 0; i < waypoints.length; i++) {
    if (earliest !== null && fractions[i]! >= earliest) continue;
    const wp = waypoints[i]!;
    const seen = points.some(
      (p) => haversineKm(wp.lat, wp.lng, p.latitude, p.longitude) <= thresholdKm,
    );
    if (seen) earliest = fractions[i]!;
  }
  return earliest;
}

export type ObservableRouteSpan = {
  /** Waypoints del tramo que la evidencia sí alcanzó a observar. */
  waypoints: Array<{ lat: number; lng: number }>;
  /** Dónde empieza el tramo observable sobre la ruta (0 = el origen). */
  fromFraction: number;
  /** Qué fracción de la ruta representa el tramo observable (1 = toda). */
  observableFraction: number;
};

/**
 * Recorta el KML al tramo que la evidencia alcanzó a observar: del primer
 * waypoint con evidencia cercana en adelante.
 *
 * El prefijo que se descarta es el que la ventana nunca miró — calificarlo
 * es cobrar por preguntas que no se entregaron. Del primer punto observado
 * hacia adelante NO se descarta nada: ahí el motor sí estaba mirando, así
 * que un hueco en ese tramo sigue siendo un fallo real. Por eso esto no
 * afloja el estándar, solo deja de castigar lo no observado.
 */
export function observableRouteSpan(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  thresholdKm: number,
): ObservableRouteSpan {
  const full = { waypoints, fromFraction: 0, observableFraction: 1 };
  if (waypoints.length === 0 || points.length === 0) return full;

  const fractions = cumulativeRouteFractions(waypoints);
  let firstIndex = -1;
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]!;
    const seen = points.some(
      (p) => haversineKm(wp.lat, wp.lng, p.latitude, p.longitude) <= thresholdKm,
    );
    if (seen) {
      firstIndex = i;
      break;
    }
  }
  if (firstIndex <= 0) return full;

  const fromFraction = fractions[firstIndex]!;
  return {
    waypoints: waypoints.slice(firstIndex),
    fromFraction,
    observableFraction: 1 - fromFraction,
  };
}

/**
 * Métrica B — precisión de corredor: % de puntos GPS cuya distancia mínima
 * a la polilínea KML es ≤ thresholdKm.
 */
export function computeCorridorPrecisionPct(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  thresholdKm = 0.12,
): number {
  if (waypoints.length === 0 || points.length === 0) return 0;
  let inside = 0;
  for (const p of points) {
    if (
      minDistanceToRouteKm({ lat: p.latitude, lng: p.longitude }, waypoints) <=
      thresholdKm
    ) {
      inside++;
    }
  }
  return (inside / points.length) * 100;
}

/** Clave de segmento cuantizada (orden-independiente) para TF-IDF. */
export function segmentKey(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  precision = 4,
): string {
  const p1 = `${a.lat.toFixed(precision)},${a.lng.toFixed(precision)}`;
  const p2 = `${b.lat.toFixed(precision)},${b.lng.toFixed(precision)}`;
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

/** IDF por segmento sobre un corpus de rutas (segmentos raros → peso alto). */
export function buildSegmentIdf(
  corpus: Array<Array<{ lat: number; lng: number }>>,
): Map<string, number> {
  const N = Math.max(1, corpus.length);
  const df = new Map<string, number>();
  for (const route of corpus) {
    const seen = new Set<string>();
    for (let i = 0; i < route.length - 1; i++) {
      seen.add(segmentKey(route[i]!, route[i + 1]!));
    }
    for (const s of seen) df.set(s, (df.get(s) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [s, d] of df) {
    idf.set(s, Math.log((N + 1) / (d + 1)) + 1);
  }
  return idf;
}

/**
 * Métrica A ponderada: cobertura de segmentos KML con peso IDF.
 * Un segmento cuenta como cubierto si algún GPS está a ≤ thresholdKm.
 */
export function computeWeightedRouteMatchPct(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  idf: Map<string, number>,
  thresholdKm = 0.12,
): number {
  if (waypoints.length < 2 || points.length === 0) {
    return computeRouteMatchPct(points, waypoints, thresholdKm);
  }

  let weightSum = 0;
  let matchedWeight = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const key = segmentKey(a, b);
    const w = idf.get(key) ?? 1;
    weightSum += w;
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const hit = points.some((p) => {
      const dSeg = distPointToSegmentKm(
        { lat: p.latitude, lng: p.longitude },
        a,
        b,
      );
      const dMid = haversineKm(mid.lat, mid.lng, p.latitude, p.longitude);
      return dSeg <= thresholdKm || dMid <= thresholdKm;
    });
    if (hit) matchedWeight += w;
  }
  if (weightSum <= 0) return 0;
  return (matchedWeight / weightSum) * 100;
}

function downsamplePolyline<T extends { lat?: number; latitude?: number; lng?: number; longitude?: number }>(
  points: T[],
  maxPoints: number,
): T[] {
  if (points.length <= maxPoints) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}

function asLatLng(p: {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}): { lat: number; lng: number } {
  return {
    lat: p.lat ?? p.latitude ?? 0,
    lng: p.lng ?? p.longitude ?? 0,
  };
}

/** Distancia de Fréchet discreta (km) entre dos polilíneas. */
export function discreteFrechetKm(
  trackA: Array<{ lat?: number; latitude?: number; lng?: number; longitude?: number }>,
  trackB: Array<{ lat?: number; latitude?: number; lng?: number; longitude?: number }>,
  maxPoints = 40,
): number {
  if (trackA.length === 0 || trackB.length === 0) return Infinity;
  const a = downsamplePolyline(trackA, maxPoints).map(asLatLng);
  const b = downsamplePolyline(trackB, maxPoints).map(asLatLng);
  const n = a.length;
  const m = b.length;
  const ca: number[][] = Array.from({ length: n }, () => Array(m).fill(-1));

  function c(i: number, j: number): number {
    if (ca[i]![j]! > -0.5) return ca[i]![j]!;
    const d = haversineKm(a[i]!.lat, a[i]!.lng, b[j]!.lat, b[j]!.lng);
    let result: number;
    if (i === 0 && j === 0) result = d;
    else if (i > 0 && j === 0) result = Math.max(c(i - 1, 0), d);
    else if (i === 0 && j > 0) result = Math.max(c(0, j - 1), d);
    else {
      result = Math.max(
        Math.min(c(i - 1, j), c(i - 1, j - 1), c(i, j - 1)),
        d,
      );
    }
    ca[i]![j] = result;
    return result;
  }

  return c(n - 1, m - 1);
}

function bearingUnit(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** Similitud de dirección media (coseno 0–1, negativos → 0). */
export function directionSimilarity(
  gps: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
): number {
  if (gps.length < 2 || waypoints.length < 2) return 0;
  const gpsSorted = [...gps].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  let gx = 0;
  let gy = 0;
  let gn = 0;
  for (let i = 1; i < gpsSorted.length; i++) {
    const u = bearingUnit(
      { lat: gpsSorted[i - 1]!.latitude, lng: gpsSorted[i - 1]!.longitude },
      { lat: gpsSorted[i]!.latitude, lng: gpsSorted[i]!.longitude },
    );
    gx += u.x;
    gy += u.y;
    gn += 1;
  }
  let kx = 0;
  let ky = 0;
  let kn = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const u = bearingUnit(waypoints[i - 1]!, waypoints[i]!);
    kx += u.x;
    ky += u.y;
    kn += 1;
  }
  if (gn === 0 || kn === 0) return 0;
  gx /= gn;
  gy /= gn;
  kx /= kn;
  ky /= kn;
  const gLen = Math.hypot(gx, gy) || 1;
  const kLen = Math.hypot(kx, ky) || 1;
  const cos = (gx / gLen) * (kx / kLen) + (gy / gLen) * (ky / kLen);
  return Math.max(0, Math.min(1, cos));
}

/**
 * Parámetros de la identificación unidad↔ruta (match). Los umbrales y el
 * corredor vienen de la política del contrato; nunca constantes de un archivo.
 */
export type RouteMatchParams = {
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
  geofencePolygon: Array<{ lat: number; lng: number }>;
  /** Radio del corredor en km (ya acotado por quien llama). */
  corridorKm: number;
  /** Umbral A (kmlMatchMinPct) — cobertura de ruta. */
  minKmlPct: number;
  /** Umbral B (kmlCorridorMinPct) — precisión de corredor. */
  minCorridorPct: number;
  /** Tope de Fréchet (km) para `shapeOk`. */
  frechetMaxKm: number;
  /**
   * Fracción mínima de la ruta que el tramo observable debe representar para
   * poder acreditar. Sin este piso, recortar el KML al tramo observado dejaría
   * que un solo punto pegado al destino diera 100% sobre un tramo de un
   * waypoint. Default 1 − DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION.
   */
  minObservableFraction?: number;
  /** IDF por segmento para métrica A ponderada; null = A sin ponderar. */
  idf?: Map<string, number> | null;
};

/** Evaluación de una unidad contra una ruta (misma matemática en todos lados). */
export type RouteMatchEvaluation = {
  arrivalAt: Date | null;
  routeMatchPct: number;
  corridorPrecisionPct: number;
  frechetKm: number | null;
  directionSimilarity: number | null;
  shapeOk: boolean;
  /** Sirvió la ruta: llegó a la geocerca y (sin KML) o (A ≥ umbral A ∧ B ≥ umbral B). */
  servedRoute: boolean;
  /**
   * Qué fracción de la ruta representa el tramo sobre el que se calculó A
   * (1 = la ruta completa). Se declara aparte, nunca se mezcla con el
   * porcentaje: un 78% sobre el 60% de la ruta no es un 78% de la ruta.
   */
  observableFraction: number;
};

/**
 * Identificación unidad↔ruta: ÚNICA implementación del match, compartida por el
 * árbitro (`verifyService`) y por la torre (monitoreo en vivo). El árbitro la
 * evalúa sobre la ventana de evidencia ya cerrada; la torre sobre la ventana
 * truncada a `now`. Recibe los puntos GPS de UNA unidad, ya ordenados por tiempo.
 *
 * No debe existir una segunda implementación de esta lógica en ningún lado.
 */
export function evaluateUnitRouteMatch(
  sortedPoints: GpsPoint[],
  params: RouteMatchParams,
): RouteMatchEvaluation {
  const hasKml = (params.kmlWaypoints?.length ?? 0) > 0;
  const arrivalAt = findGeofenceEntry(sortedPoints, params.geofencePolygon);

  // El match se califica sobre el tramo que la evidencia alcanzó a observar,
  // no contra el KML completo — el prefijo no observado no se cobra. El
  // umbral (params.minKmlPct) no se toca: se aplica igual, solo que sobre
  // una pregunta honesta.
  const span = hasKml
    ? observableRouteSpan(sortedPoints, params.kmlWaypoints!, params.corridorKm)
    : { waypoints: [], fromFraction: 0, observableFraction: 1 };
  const scoredWaypoints = span.waypoints;

  const routeMatchPct = hasKml
    ? params.idf
      ? computeWeightedRouteMatchPct(sortedPoints, scoredWaypoints, params.idf, params.corridorKm)
      : computeRouteMatchPct(sortedPoints, scoredWaypoints, params.corridorKm)
    : arrivalAt
      ? 100
      : 0;
  // B mide qué fracción de los PUNTOS GPS cae en el corredor; el prefijo no
  // observado no aporta puntos, así que va contra el KML completo sin sesgo.
  const corridorPrecisionPct = hasKml
    ? computeCorridorPrecisionPct(sortedPoints, params.kmlWaypoints!, params.corridorKm)
    : arrivalAt
      ? 100
      : 0;
  const frechetKm = hasKml
    ? discreteFrechetKm(
        sortedPoints.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        scoredWaypoints,
      )
    : null;
  const dirSim = hasKml ? directionSimilarity(sortedPoints, scoredWaypoints) : null;

  // Fréchet / dirección desambiguan el ranking; el match duro es geocerca + A∧B.
  // Un tope duro de Fréchet descartaba recorridos reales con muestreo irregular.
  const shapeOk =
    !hasKml ||
    frechetKm === null ||
    sortedPoints.length < 3 ||
    frechetKm <= params.frechetMaxKm;
  // El tramo observable tiene que dar para calificar. Si no da, la unidad no
  // acredita por esta vía — no porque haya fallado, sino porque no se le vio
  // suficiente ruta (Ley 1). El veredicto lo resuelve verifyService.
  const minObservableFraction =
    params.minObservableFraction ?? 1 - DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION;
  const observableEnough = !hasKml || span.observableFraction + 1e-9 >= minObservableFraction;

  const servedRoute =
    arrivalAt !== null &&
    (!hasKml ||
      (observableEnough &&
        routeMatchPct >= params.minKmlPct &&
        corridorPrecisionPct >= params.minCorridorPct));

  return {
    arrivalAt,
    routeMatchPct,
    corridorPrecisionPct,
    frechetKm,
    directionSimilarity: dirSim,
    shapeOk,
    servedRoute,
    observableFraction: span.observableFraction,
  };
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
  /**
   * Milisegundos de la ventana efectivamente cubiertos por señal.
   *
   * Es `coveragePct` sin redondear. Existe porque agregar cobertura de varios
   * servicios exige ponderar por la duración de cada ventana —Σ cubiertos / Σ
   * totales—, y un promedio de porcentajes ya redondeados engaña cuando las
   * ventanas duran distinto.
   */
  coveredMs: number;
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
      coveredMs: 0,
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
      coveredMs: 0,
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
    coveredMs,
    maxGapMs: largestGap,
    windowMs,
    pointCount: sorted.length,
    sufficient:
      coveragePct + 1e-9 >= minCoveragePct && largestGap <= maxAllowedGapMs,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   Ventana de observación derivada de la duración real de la ruta.

   El ancho de la ventana era una constante de política: el motor abría los
   ojos N minutos antes del deadline sin que nadie hubiera derivado ese N de
   nada. Como la ruta corre ANTES del deadline, cualquier recorrido más largo
   que ese N arranca con el motor ciego, y después se califica al carrier
   contra el trazado completo — incluido el tramo que nunca se miró.

   Aquí se deriva el lado de "antes" de la duración real del recorrido. Medir
   cuánto dura una ruta es un hecho, no una calibración: ningún umbral de
   cumplimiento se toca. El lado de "después" (gracia + margen) tampoco.
   ─────────────────────────────────────────────────────────────────────────── */

/** Cercanía al borde de la ventana (min) que vuelve una medición cota inferior. */
export const DEFAULT_WINDOW_EDGE_TOLERANCE_MINUTES = 5;

export type RouteTraversalMeasurement = {
  /** Duración observada del recorrido (min); null si no hubo con qué medirla. */
  durationMinutes: number | null;
  /** Primer instante con evidencia dentro del corredor del trazado. */
  startedAt: Date | null;
  /** Llegada a la geocerca si se conoce; si no, último instante en corredor. */
  endedAt: Date | null;
  pointsInCorridor: number;
  /**
   * La medición topó con el borde de la ventana: la ruta pudo haber empezado
   * antes de que el motor mirara, o seguir después. Entonces esto NO es la
   * duración: es una cota inferior. Se declara para que quien dimensione la
   * ventana sepa que el número que recibe está recortado por el defecto que
   * viene a corregir.
   */
  lowerBound: boolean;
};

/**
 * Cuánto duró un recorrido, medido sobre la evidencia: del primer punto GPS
 * dentro del corredor del trazado hasta la llegada a la geocerca (o, sin
 * llegada conocida, hasta el último punto en corredor).
 *
 * Terminar en la llegada y no en el último punto evita que una unidad
 * estacionada sobre el corredor después de llegar infle la duración.
 */
export function measureRouteTraversal(
  points: GpsPoint[],
  waypoints: Array<{ lat: number; lng: number }>,
  corridorKm: number,
  opts: {
    arrivalAt?: Date | null;
    window?: { start: Date; end: Date } | null;
    edgeToleranceMinutes?: number;
  } = {},
): RouteTraversalMeasurement {
  const empty: RouteTraversalMeasurement = {
    durationMinutes: null,
    startedAt: null,
    endedAt: null,
    pointsInCorridor: 0,
    lowerBound: false,
  };
  if (waypoints.length === 0 || points.length === 0) return empty;

  const inCorridor = points
    .filter(
      (p) =>
        minDistanceToRouteKm({ lat: p.latitude, lng: p.longitude }, waypoints) <=
        corridorKm,
    )
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  if (inCorridor.length === 0) return empty;

  const startedAt = inCorridor[0]!.timestamp;
  const lastInCorridor = inCorridor[inCorridor.length - 1]!.timestamp;
  const arrival = opts.arrivalAt ?? null;
  // La llegada manda, salvo que caiga antes del arranque observado (evidencia
  // desordenada o geocerca tocada de paso): ahí el último punto en corredor
  // es lo único defendible.
  const endedAt =
    arrival && arrival.getTime() >= startedAt.getTime() ? arrival : lastInCorridor;

  const edgeMs =
    (opts.edgeToleranceMinutes ?? DEFAULT_WINDOW_EDGE_TOLERANCE_MINUTES) * 60_000;
  const window = opts.window ?? null;
  const truncatedAtStart = window
    ? startedAt.getTime() - window.start.getTime() <= edgeMs
    : false;
  const truncatedAtEnd = window
    ? !arrival && window.end.getTime() - endedAt.getTime() <= edgeMs
    : false;

  return {
    durationMinutes: Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 60_000),
    startedAt,
    endedAt,
    pointsInCorridor: inCorridor.length,
    lowerBound: truncatedAtStart || truncatedAtEnd,
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

  const byImei = groupPointsByImei(input.evidencePoints);

  // Precondición (Fase 1): cobertura por IMEI (no flota mezclada).
  // Mezclar toda la flota rellena huecos con unidades ajenas y produce no_cumplido falso.
  if (input.coverageWindowStart && input.coverageWindowEnd) {
    let best: {
      imei: string;
      coverage: ReturnType<typeof assessEvidenceCoverage>;
    } | null = null;
    for (const [imei, points] of byImei) {
      const coverage = assessEvidenceCoverage(
        points.map((p) => p.timestamp),
        input.coverageWindowStart,
        input.coverageWindowEnd,
        {
          minCoveragePct: input.evidenceMinCoveragePct,
          maxGapMinutes: input.evidenceMaxGapMinutes,
        },
      );
      if (!best || coverage.coveragePct > best.coverage.coveragePct) {
        best = { imei, coverage };
      }
    }
    const coverage =
      best?.coverage ??
      assessEvidenceCoverage([], input.coverageWindowStart, input.coverageWindowEnd, {
        minCoveragePct: input.evidenceMinCoveragePct,
        maxGapMinutes: input.evidenceMaxGapMinutes,
      });
    steps.push({
      step: "cobertura_evidencia",
      result: coverage.sufficient ? "suficiente" : "insuficiente",
      details: {
        coveragePct: Number(coverage.coveragePct.toFixed(1)),
        maxGapMinutes: Number((coverage.maxGapMs / 60_000).toFixed(1)),
        minCoveragePct: input.evidenceMinCoveragePct ?? 80,
        maxGapMinutesAllowed: input.evidenceMaxGapMinutes ?? 10,
        pointCountInWindow: coverage.pointCount,
        // Sin redondear y en milisegundos, a propósito: agregar cobertura de
        // varios servicios se hace Σ cubiertos / Σ totales, y ponderar con
        // porcentajes ya redondeados arrastra error. Aditivos: los hechos
        // sellados antes de esto no los traen, y quien lea debe derivar la
        // ventana de expectedDeadline + la política congelada cuando falten.
        windowMs: coverage.windowMs,
        coveredMs: coverage.coveredMs,
        bestImei: best?.imei ?? null,
        perImei: true,
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
  const corridorKm = Math.min(0.5, Math.max(0.01, (input.kmlCorridorMeters ?? 120) / 1000));
  // Umbrales configurables. Sin KML no aplican A/B.
  const minKmlPct = hasKml
    ? Math.min(100, Math.max(0, input.kmlMatchMinPct ?? 60))
    : 0;
  const minCorridorPct = hasKml
    ? Math.min(100, Math.max(0, input.kmlCorridorMinPct ?? 60))
    : 0;
  const frechetMaxKm = input.frechetMaxKm ?? 0.8;
  // Una sola perilla gobierna las dos mitades del arreglo: cuánto arranque de
  // ruta se tolera perder. De ahí sale tanto el piso del tramo observable como
  // el gate que manda a pendiente_evidencia más abajo.
  const originToleranceFraction = Math.min(
    1,
    Math.max(0, input.kmlOriginToleranceFraction ?? DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION),
  );
  const minObservableFraction = 1 - originToleranceFraction;
  const idf =
    hasKml && input.routeCorpus && input.routeCorpus.length > 0
      ? buildSegmentIdf(
          input.routeCorpus.some((r) => r === input.kmlWaypoints)
            ? input.routeCorpus
            : [...input.routeCorpus, input.kmlWaypoints!],
        )
      : null;

  for (const [imei, points] of byImei) {
    const sorted = [...points].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    // Identificación unidad↔ruta: única implementación compartida con la torre.
    const {
      arrivalAt,
      routeMatchPct,
      corridorPrecisionPct,
      frechetKm,
      directionSimilarity: dirSim,
      shapeOk,
      servedRoute,
      observableFraction,
    } = evaluateUnitRouteMatch(sorted, {
      kmlWaypoints: input.kmlWaypoints,
      geofencePolygon: input.geofencePolygon,
      corridorKm,
      minKmlPct,
      minCorridorPct,
      frechetMaxKm,
      minObservableFraction,
      idf,
    });

    candidateUnits.push({
      unitId: imei,
      servedRoute,
      arrivalAt,
      routeMatchPct,
      corridorPrecisionPct,
      frechetKm,
      directionSimilarity: dirSim,
      observableFraction,
    });

    steps.push({
      step: "candidata",
      result: servedRoute ? "sirvio_ruta" : "no_sirvio",
      details: {
        imei,
        arrivalAt: arrivalAt?.toISOString(),
        routeMatchPct,
        corridorPrecisionPct,
        frechetKm: frechetKm == null ? null : Number(frechetKm.toFixed(3)),
        directionSimilarity: dirSim == null ? null : Number(dirSim.toFixed(3)),
        weightedIdf: Boolean(idf),
        corridorMeters: corridorKm * 1000,
        hasKml,
        minKmlPct,
        minCorridorPct,
        frechetMaxKm: hasKml ? frechetMaxKm : undefined,
        shapeOk,
        // A se calculó sobre este tramo, no sobre la ruta completa. Va aparte
        // del porcentaje a propósito: quien lea el expediente debe poder ver
        // sobre qué se calificó, no solo el número.
        observableFraction: hasKml ? Number(observableFraction.toFixed(3)) : undefined,
      },
    });
  }

  const serving = candidateUnits
    .filter((c) => c.servedRoute)
    .sort((a, b) => {
      // Con KML: gana quien mejor combina A y B (el mínimo); empate → Fréchet → dirección → llegada.
      if (hasKml) {
        const scoreA = Math.min(a.routeMatchPct, a.corridorPrecisionPct);
        const scoreB = Math.min(b.routeMatchPct, b.corridorPrecisionPct);
        const diff = scoreB - scoreA;
        if (Math.abs(diff) >= 1) return diff;
        const fA = a.frechetKm ?? Infinity;
        const fB = b.frechetKm ?? Infinity;
        if (Math.abs(fA - fB) >= 0.05) return fA - fB;
        const dA = a.directionSimilarity ?? 0;
        const dB = b.directionSimilarity ?? 0;
        if (Math.abs(dA - dB) >= 0.05) return dB - dA;
      }
      if (!a.arrivalAt) return 1;
      if (!b.arrivalAt) return -1;
      return a.arrivalAt.getTime() - b.arrivalAt.getTime();
    });

  if (serving.length === 0) {
    // Modo destino_only: distinguir "llegó pero no se puede atribuir" vs "no llegó".
    // Marco: "sin evidencia ≠ incumplimiento"; si hubo señal de servicio pero dudosa → pendiente.
    const anyArrived = candidateUnits.some((c) => c.arrivalAt !== null);
    const isDestinoOnly = input.routeStrictness === "destino_only";

    if (isDestinoOnly && anyArrived) {
      steps.push({
        step: "decision",
        result: "pendiente_evidencia",
        details: {
          reason: "llegada_sin_atribucion",
          explanation:
            "Una unidad llegó a la geocerca pero su recorrido no alcanza el mínimo de ninguna ruta",
        },
      });
      return {
        status: "pendiente_evidencia",
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

    // Ley 1: antes de acusar, ¿la ventana alcanzó a observar el origen de la
    // ruta? Si la evidencia más temprana que coincide con el KML ya cae bien
    // adentro del recorrido, el motor no puede saber si el tramo inicial se
    // hizo o no — eso es un problema de observación, no un veredicto.
    if (hasKml) {
      const earliestFraction = earliestObservedRouteFraction(
        input.evidencePoints,
        input.kmlWaypoints!,
        corridorKm,
      );
      if (earliestFraction !== null && earliestFraction > originToleranceFraction) {
        steps.push({
          step: "decision",
          result: "pendiente_evidencia",
          details: {
            reason: "observacion_insuficiente",
            explanation:
              "La ventana de observación no alcanzó a cubrir el origen de la ruta",
            earliestObservedFraction: Number(earliestFraction.toFixed(3)),
            originToleranceFraction,
          },
        });
        return {
          status: "pendiente_evidencia",
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
    }

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
  // Si sirvió la ruta (geocerca + KML A∧B), el status es cumplido; "tarde" vive en timing.
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
      corridorPrecisionPct: winner.corridorPrecisionPct,
      hasKml,
      minKmlPct: hasKml ? minKmlPct : undefined,
      minCorridorPct: hasKml ? minCorridorPct : undefined,
      corridorMeters: hasKml ? corridorKm * 1000 : undefined,
      observableFraction:
        hasKml && winner.observableFraction != null
          ? Number(winner.observableFraction.toFixed(3))
          : undefined,
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
