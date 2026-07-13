import { getRepos } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  computeEnforcement,
  computeEvidenceWindow,
  type ContractPolicy,
} from "@jtel/domain";
import { cutTrackAtArrival } from "@/lib/map-evidence";

export type MapPoint = { lat: number; lng: number; at: string };
export type MapPolygon = Array<{ lat: number; lng: number }>;
export type MapWaypoint = { lat: number; lng: number };

export function downsampleMapPoints(points: MapPoint[], max = 400): MapPoint[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

export interface ServiceDetailData {
  occurrenceId: string;
  serviceDate: string;
  profileName: string;
  clientName: string;
  carrierName: string;
  plantName: string | null;
  status: string | null;
  expectedDeadline: string;
  referenceUnitLabel: string;
  observedUnitLabel: string;
  observedArrivalAt: string | null;
  timing: string | null;
  evidenceStatus: string | null;
  /** Ventana según política actual del contrato. */
  policyWindowStart: string | null;
  policyWindowEnd: string | null;
  /** Ventana congelada en el viaje (la que se usó al verificar). */
  tripWindowStart: string | null;
  tripWindowEnd: string | null;
  tripWindowDiffersFromPolicy: boolean;
  evidenceMarginBeforeMinutes: number | null;
  verificationGraceMinutes: number | null;
  evidenceMarginAfterMinutes: number | null;
  toleranceMinutes: number | null;
  /** Primer / último punto del trazo mostrado (corredor KML). */
  evidenceFirstAt: string | null;
  evidenceLastAt: string | null;
  /** Puntos GPS de la unidad en toda la ventana del viaje. */
  unitPointsInWindow: number;
  pointCount: number;
  mapPoints: MapPoint[];
  /** Trazado esperado (KML) para comparar en el mapa. */
  kmlWaypoints: MapWaypoint[];
  geofencePolygon: MapPolygon;
  arrivalPoint: MapPoint | null;
  enforcement: Array<{ description: string; applies: boolean }>;
  showEnforcement: boolean;
  ledger: unknown[];
  /** Para navegación de vuelta a la unidad / contrato. */
  clientSlug: string | null;
  contractId: string;
  plantId: string | null;
  plantGroupId: string | null;
  contractName: string;
}

async function unitLabel(
  repos: ReturnType<typeof getRepos>,
  carrierAccountId: string,
  unitId: string | null | undefined,
): Promise<string> {
  if (!unitId) return "—";
  const units = await repos.fleet.getUnitsForCarrier(carrierAccountId);
  const unit = units.find((u) => u.id === unitId);
  return unit ? `${unit.label}${unit.plateNumber ? ` (${unit.plateNumber})` : ""}` : unitId.slice(0, 8) + "…";
}

function closestPoint(points: MapPoint[], target: Date): MapPoint | null {
  if (points.length === 0) return null;
  let best = points[0]!;
  let bestDiff = Math.abs(new Date(best.at).getTime() - target.getTime());
  for (const p of points) {
    const diff = Math.abs(new Date(p.at).getTime() - target.getTime());
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/** Recorta el GPS al corredor del KML (sin el deambular por la ciudad). */
export function clipTrackToRoute(
  points: MapPoint[],
  kml: MapWaypoint[],
  corridorKm = 0.75,
): MapPoint[] {
  if (points.length === 0) return [];
  if (kml.length === 0) return points;

  const nearRoute = points.filter((p) =>
    kml.some((wp) => haversineKm(p, wp) <= corridorKm),
  );
  return nearRoute.length >= 3 ? nearRoute : points;
}

/** Re-export del corte en llegada (regla Marco: evidencia dibujada termina en la geocerca). */
export { cutTrackAtArrival } from "@/lib/map-evidence";


export async function loadServiceDetail(
  occurrenceId: string,
  options: { carrierAccountId?: string; showEnforcement?: boolean } = {},
): Promise<ServiceDetailData> {
  const repos = getRepos();
  const occurrence = await repos.occurrences.findById(occurrenceId);
  if (!occurrence) notFound();

  const contract = occurrence.profile?.contract;
  if (!contract) notFound();

  if (
    options.carrierAccountId &&
    contract.carrierAccountId !== options.carrierAccountId
  ) {
    notFound();
  }

  const [client, carrier, plant] = await Promise.all([
    repos.accounts.findById(contract.clientAccountId),
    repos.accounts.findById(contract.carrierAccountId),
    contract.plantId ? repos.clients.getPlantById(contract.plantId) : Promise.resolve(null),
  ]);

  const fact = occurrence.complianceFact;
  const policy = contract.policy as ContractPolicy;

  const evidencePoints = occurrence.trip?.evidencePoints ?? [];
  const observedUnitId = fact?.observedUnitId ?? null;

  // Mapa: solo la unidad observada, recortada al corredor KML / llegada
  // (no todo lo que hizo en la ventana del contrato).
  const unitEvidence = observedUnitId
    ? evidencePoints.filter((p) => p.unitId === observedUnitId)
    : [];

  const allUnitPoints: MapPoint[] = unitEvidence
    .map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      at: p.recordedAt.toISOString(),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const routeId = occurrence.profile?.routeShift?.routeId;
  const kmlVersion = routeId
    ? await repos.routes.getKmlVersionForDate(routeId, occurrence.expectedDeadline)
    : null;
  const kmlWaypoints: MapWaypoint[] = (kmlVersion?.waypoints ?? []).map((wp) => ({
    lat: wp.lat,
    lng: wp.lng,
  }));

  const mapPoints = clipTrackToRoute(allUnitPoints, kmlWaypoints);
  // Regla transversal: si hay llegada registrada, no dibujar nada después.
  const mapPointsCut = cutTrackAtArrival(mapPoints, fact?.observedArrivalAt ?? null);

  // Downsample para no saturar Leaflet (máx. ~400 puntos).
  const mapPointsDisplay =
    mapPointsCut.length <= 400
      ? mapPointsCut
      : mapPointsCut.filter((_, i) => i % Math.ceil(mapPointsCut.length / 400) === 0 || i === mapPointsCut.length - 1);

  const geofence = occurrence.profile?.geofence;
  const geofencePolygon: MapPolygon = (geofence?.polygon as MapPolygon | undefined) ?? [];

  const arrivalPoint =
    fact?.observedArrivalAt && mapPointsCut.length > 0
      ? closestPoint(mapPointsCut, fact.observedArrivalAt)
      : fact?.observedArrivalAt && allUnitPoints.length > 0
        ? closestPoint(
            cutTrackAtArrival(allUnitPoints, fact.observedArrivalAt),
            fact.observedArrivalAt,
          )
        : null;

  const enforcement =
    fact && options.showEnforcement !== false
      ? computeEnforcement(fact.status, fact.timing, fact.lateExcusable, policy)
      : [];

  const ledger = fact && occurrence.trip
    ? await repos.compliance.getLedgerForTrip(occurrence.trip.id)
    : [];

  const [referenceUnitLabel, observedUnitLabel] = await Promise.all([
    unitLabel(repos, contract.carrierAccountId, occurrence.referenceUnitId),
    unitLabel(repos, contract.carrierAccountId, fact?.observedUnitId),
  ]);

  const trip = occurrence.trip;
  const evidenceFirstAt = mapPointsCut[0]?.at ?? null;
  const evidenceLastAt = mapPointsCut[mapPointsCut.length - 1]?.at ?? null;

  const policyWindow = computeEvidenceWindow(occurrence.expectedDeadline, policy);
  const tripStart = trip?.evidenceWindowStart ?? null;
  const tripEnd = trip?.evidenceWindowEnd ?? null;
  const tripWindowDiffersFromPolicy = Boolean(
    tripStart &&
      tripEnd &&
      (Math.abs(tripStart.getTime() - policyWindow.windowStart.getTime()) > 60_000 ||
        Math.abs(tripEnd.getTime() - policyWindow.windowEnd.getTime()) > 60_000),
  );

  return {
    occurrenceId: occurrence.id,
    serviceDate: occurrence.serviceDate,
    profileName: occurrence.profile?.name ?? "—",
    clientName: client?.name ?? "—",
    carrierName: carrier?.name ?? "—",
    plantName: plant?.name ?? null,
    status: fact?.status ?? null,
    expectedDeadline: occurrence.expectedDeadline.toISOString(),
    referenceUnitLabel,
    observedUnitLabel,
    observedArrivalAt: fact?.observedArrivalAt?.toISOString() ?? null,
    timing: fact?.timing ?? null,
    evidenceStatus: trip?.evidenceStatus ?? null,
    policyWindowStart: policyWindow.windowStart.toISOString(),
    policyWindowEnd: policyWindow.windowEnd.toISOString(),
    tripWindowStart: tripStart?.toISOString() ?? null,
    tripWindowEnd: tripEnd?.toISOString() ?? null,
    tripWindowDiffersFromPolicy,
    evidenceMarginBeforeMinutes: policy.evidenceMarginMinutesBefore ?? null,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? null,
    evidenceMarginAfterMinutes: policy.evidenceMarginMinutesAfter ?? null,
    toleranceMinutes: policy.toleranceMinutes ?? null,
    evidenceFirstAt,
    evidenceLastAt,
    unitPointsInWindow: allUnitPoints.length,
    pointCount: mapPoints.length,
    mapPoints: mapPointsDisplay,
    kmlWaypoints,
    geofencePolygon,
    arrivalPoint,
    enforcement,
    showEnforcement: options.showEnforcement !== false,
    ledger,
    clientSlug: client?.slug ?? null,
    contractId: contract.id,
    plantId: contract.plantId ?? null,
    plantGroupId: contract.plantGroupId ?? null,
    contractName: contract.name,
  };
}
