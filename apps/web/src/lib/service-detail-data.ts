import { getRepos } from "@/lib/db";
import { notFound } from "next/navigation";
import { computeEnforcement, type ContractPolicy } from "@jtel/domain";

export type MapPoint = { lat: number; lng: number; at: string };
export type MapPolygon = Array<{ lat: number; lng: number }>;
export type MapWaypoint = { lat: number; lng: number };

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
  /** Ventana GPS del contrato (viaje). */
  evidenceWindowStart: string | null;
  evidenceWindowEnd: string | null;
  evidenceMarginBeforeMinutes: number | null;
  evidenceMarginAfterMinutes: number | null;
  toleranceMinutes: number | null;
  /** Primer / último punto del trazo mostrado (corredor KML / llegada). */
  evidenceFirstAt: string | null;
  evidenceLastAt: string | null;
  /** Puntos GPS de la unidad en toda la ventana del contrato. */
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

/** Recorta el GPS al tramo útil: cerca del KML y alrededor de la llegada. */
function clipTrackToRoute(
  points: MapPoint[],
  kml: MapWaypoint[],
  arrivalAt: Date | null,
  maxRouteDurationMinutes: number,
  corridorKm = 0.6,
): MapPoint[] {
  if (points.length === 0) return [];

  let scoped = points;
  if (arrivalAt) {
    const fromMs = arrivalAt.getTime() - maxRouteDurationMinutes * 60_000;
    const toMs = arrivalAt.getTime() + 15 * 60_000;
    const inWindow = points.filter((p) => {
      const t = new Date(p.at).getTime();
      return t >= fromMs && t <= toMs;
    });
    if (inWindow.length > 0) scoped = inWindow;
  }

  if (kml.length === 0) return scoped;

  const nearRoute = scoped.filter((p) =>
    kml.some((wp) => haversineKm(p, wp) <= corridorKm),
  );
  // Si el filtro deja muy poco, no vaciar el mapa: usar el recorte temporal.
  return nearRoute.length >= 3 ? nearRoute : scoped;
}

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

  const mapPoints = clipTrackToRoute(
    allUnitPoints,
    kmlWaypoints,
    fact?.observedArrivalAt ?? null,
    policy.maxRouteDurationMinutes ?? 60,
  );

  // Downsample para no saturar Leaflet (máx. ~400 puntos).
  const mapPointsDisplay =
    mapPoints.length <= 400
      ? mapPoints
      : mapPoints.filter((_, i) => i % Math.ceil(mapPoints.length / 400) === 0 || i === mapPoints.length - 1);

  const geofence = occurrence.profile?.geofence;
  const geofencePolygon: MapPolygon = (geofence?.polygon as MapPolygon | undefined) ?? [];

  const arrivalPoint =
    fact?.observedArrivalAt && mapPoints.length > 0
      ? closestPoint(mapPoints, fact.observedArrivalAt)
      : fact?.observedArrivalAt && allUnitPoints.length > 0
        ? closestPoint(allUnitPoints, fact.observedArrivalAt)
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
  const evidenceFirstAt = mapPoints[0]?.at ?? null;
  const evidenceLastAt = mapPoints[mapPoints.length - 1]?.at ?? null;
  const afterMinutes =
    (policy.verificationGraceMinutes ?? 0) + (policy.evidenceMarginMinutesAfter ?? 0);

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
    evidenceWindowStart: trip?.evidenceWindowStart?.toISOString() ?? null,
    evidenceWindowEnd: trip?.evidenceWindowEnd?.toISOString() ?? null,
    evidenceMarginBeforeMinutes: policy.evidenceMarginMinutesBefore ?? null,
    evidenceMarginAfterMinutes: afterMinutes,
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
