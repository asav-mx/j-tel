import { getRepos } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  computeEnforcement,
  computeEvidenceWindow,
  localTimeHHMM,
  localDateTimeShort,
  type ContractPolicy,
} from "@jtel/domain";
import {
  clipTrackToRoute,
  cutTrackAtArrival,
  downsampleMapPoints,
} from "@/lib/map-evidence";

export type MapPoint = { lat: number; lng: number; at: string };
export type MapPolygon = Array<{ lat: number; lng: number }>;
export type MapWaypoint = { lat: number; lng: number };

export { clipTrackToRoute, downsampleMapPoints };

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
  /** UUID de unidad observada (null = sin servicio detectado). */
  observedUnitId: string | null;
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
  /** Origen del trazo en el mapa de evidencia. */
  evidenceMapMode: "observed_unit" | "trip_fleet" | "empty";
  /** Cuántos puntos crudos hay en el viaje (antes de filtrar por unidad). */
  tripEvidencePointCount: number;
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
  /** Zona horaria del contrato (para formatear horas en la UI). */
  timeZone: string;
  /** True = cara cliente sin unidad observada (GPS de flota ocultado). */
  fleetHiddenForClient: boolean;
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

/** Re-export del corte en llegada (regla Marco: evidencia dibujada termina en la geocerca). */
export { cutTrackAtArrival };


export async function loadServiceDetail(
  occurrenceId: string,
  options: { carrierAccountId?: string; showEnforcement?: boolean; isJStaff?: boolean } = {},
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
  const trip = occurrence.trip;

  const evidencePoints = trip?.evidencePoints ?? [];
  const observedUnitId = fact?.observedUnitId ?? null;
  const tripEvidencePointCount = evidencePoints.length;

  // ── Quién consume: carrier/jstaff vs cliente ──────────────────────────
  // El cliente JAMÁS ve la operación interna del carrier (Pieza 4, Marco).
  // Sin unidad observada, la cara cliente muestra solo KML + geocerca.
  // Carrier y J-Staff sí ven el GPS de flota (son sus propios datos).
  const isClientFace = !options.carrierAccountId && !options.isJStaff;

  let evidenceMapMode: ServiceDetailData[“evidenceMapMode”] = “empty”;
  let unitEvidence = evidencePoints;
  if (observedUnitId) {
    // Hay unidad observada: mostrar su trazo (todas las caras).
    const matched = evidencePoints.filter((p) => p.unitId === observedUnitId);
    if (matched.length > 0) {
      unitEvidence = matched;
      evidenceMapMode = “observed_unit”;
    } else if (evidencePoints.length > 0) {
      if (isClientFace) {
        // Cara cliente: no filtrar por unidad si no hay match → vaciar.
        unitEvidence = [];
        evidenceMapMode = “empty”;
      } else {
        // Carrier/J-Staff: mostrar todo (mismatch IMEI→unidad, diagnóstico).
        unitEvidence = evidencePoints;
        evidenceMapMode = “trip_fleet”;
      }
    } else {
      unitEvidence = [];
      evidenceMapMode = “empty”;
    }
  } else if (evidencePoints.length > 0) {
    if (isClientFace) {
      // Sin unidad observada, cara cliente: NO mostrar flota.
      unitEvidence = [];
      evidenceMapMode = “empty”;
    } else {
      // Carrier/J-Staff: mostrar flota para diagnóstico.
      unitEvidence = evidencePoints;
      evidenceMapMode = “trip_fleet”;
    }
  } else {
    unitEvidence = [];
    evidenceMapMode = “empty”;
  }

  const allUnitPoints: MapPoint[] = unitEvidence
    .map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      at: p.recordedAt.toISOString(),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  // Si el viaje quedó sin evidence_points (p. ej. re-ingesta fallida) pero hay
  // telemetría archivada del carrier, usarla — solo carrier/jstaff cuando no
  // hay unidad observada (cara cliente no ve flota).
  let mapSourcePoints = allUnitPoints;
  const canFallbackToFleetTelemetry =
    !isClientFace || observedUnitId != null;
  if (
    canFallbackToFleetTelemetry &&
    mapSourcePoints.length === 0 &&
    trip?.evidenceWindowStart &&
    trip.evidenceWindowEnd
  ) {
    const devices = await repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const imeiToUnitId = new Map<string, string>();
    for (const d of devices) {
      const a = await repos.fleet.resolveUnitAtTime(d.id, occurrence.expectedDeadline);
      if (a?.unitId) imeiToUnitId.set(d.imei, a.unitId);
    }
    const imeis =
      observedUnitId != null
        ? [...imeiToUnitId.entries()]
            .filter(([, uid]) => uid === observedUnitId)
            .map(([imei]) => imei)
        : [...imeiToUnitId.keys()];
    if (imeis.length > 0) {
      const telem = await repos.telemetry.getForImeis(
        imeis,
        trip.evidenceWindowStart,
        trip.evidenceWindowEnd,
      );
      mapSourcePoints = telem
        .map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
          at: p.recordedAt.toISOString(),
        }))
        .sort((a, b) => a.at.localeCompare(b.at));
      if (mapSourcePoints.length > 0) {
        evidenceMapMode = observedUnitId ? "observed_unit" : "trip_fleet";
      }
    }
  }

  const routeId = occurrence.profile?.routeShift?.routeId;
  const kmlVersion = routeId
    ? await repos.routes.getKmlVersionForDate(routeId, occurrence.expectedDeadline)
    : null;
  const kmlWaypoints: MapWaypoint[] = (kmlVersion?.waypoints ?? []).map((wp) => ({
    lat: wp.lat,
    lng: wp.lng,
  }));

  const mapPoints = clipTrackToRoute(mapSourcePoints, kmlWaypoints);
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

  const evidenceFirstAtRaw = mapPointsCut[0]?.at ?? null;
  const evidenceLastAtRaw = mapPointsCut[mapPointsCut.length - 1]?.at ?? null;

  const policyWindow = computeEvidenceWindow(occurrence.expectedDeadline, policy);
  const tripStart = trip?.evidenceWindowStart ?? null;
  const tripEnd = trip?.evidenceWindowEnd ?? null;
  const tripWindowDiffersFromPolicy = Boolean(
    tripStart &&
      tripEnd &&
      (Math.abs(tripStart.getTime() - policyWindow.windowStart.getTime()) > 60_000 ||
        Math.abs(tripEnd.getTime() - policyWindow.windowEnd.getTime()) > 60_000),
  );

  const tz = policy.timeZone ?? "America/Ciudad_Juarez";

  return {
    occurrenceId: occurrence.id,
    serviceDate: occurrence.serviceDate,
    profileName: occurrence.profile?.name ?? "—",
    clientName: client?.name ?? "—",
    carrierName: carrier?.name ?? "—",
    plantName: plant?.name ?? null,
    status: fact?.status ?? null,
    expectedDeadline: localTimeHHMM(occurrence.expectedDeadline, tz),
    referenceUnitLabel,
    observedUnitLabel,
    observedUnitId: fact?.observedUnitId ?? null,
    observedArrivalAt: fact?.observedArrivalAt
      ? localTimeHHMM(fact.observedArrivalAt, tz)
      : null,
    timing: fact?.timing ?? null,
    evidenceStatus: trip?.evidenceStatus ?? null,
    policyWindowStart: localTimeHHMM(policyWindow.windowStart, tz),
    policyWindowEnd: localTimeHHMM(policyWindow.windowEnd, tz),
    tripWindowStart: tripStart ? localTimeHHMM(tripStart, tz) : null,
    tripWindowEnd: tripEnd ? localTimeHHMM(tripEnd, tz) : null,
    tripWindowDiffersFromPolicy,
    evidenceMarginBeforeMinutes: policy.evidenceMarginMinutesBefore ?? null,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? null,
    evidenceMarginAfterMinutes: policy.evidenceMarginMinutesAfter ?? null,
    toleranceMinutes: policy.toleranceMinutes ?? null,
    evidenceFirstAt: evidenceFirstAtRaw ? localTimeHHMM(evidenceFirstAtRaw, tz) : null,
    evidenceLastAt: evidenceLastAtRaw ? localTimeHHMM(evidenceLastAtRaw, tz) : null,
    unitPointsInWindow:
      isClientFace && evidenceMapMode === "empty" ? 0 : mapSourcePoints.length,
    evidenceMapMode,
    tripEvidencePointCount:
      isClientFace && evidenceMapMode === "empty"
        ? 0
        : tripEvidencePointCount > 0 ? tripEvidencePointCount : mapSourcePoints.length,
    pointCount: mapPoints.length,
    mapPoints: mapPointsDisplay,
    kmlWaypoints,
    geofencePolygon,
    arrivalPoint,
    enforcement,
    showEnforcement: options.showEnforcement !== false,
    ledger: isClientFace ? [] : ledger,
    clientSlug: client?.slug ?? null,
    contractId: contract.id,
    plantId: contract.plantId ?? null,
    plantGroupId: contract.plantGroupId ?? null,
    contractName: contract.name,
    timeZone: tz,
    fleetHiddenForClient: isClientFace && !observedUnitId,
  };
}
