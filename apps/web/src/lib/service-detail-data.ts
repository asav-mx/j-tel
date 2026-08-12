import { getRepos } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  computeEnforcement,
  computeEvidenceWindow,
  localDateTimeShort,
  type ContractPolicy,
} from "@jtel/domain";
import {
  clipTrackToRoute,
  cutTrackAtArrival,
  downsampleMapPoints,
} from "@/lib/map-evidence";
import { pairLedgerEntryWithFact } from "@jtel/db";
import {
  proyectarPasosMedicion,
  type PasoMedicion,
  type RazonSinLedger,
} from "@/lib/pasos-medicion";
import { politicaDelSello } from "@/lib/politica-del-sello";

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
  /**
   * Ventana que daría la política **con la que se juzgó este servicio** — el
   * piso del contrato aplicado a su hora límite. C24: antes salía de la
   * política viva, que describía el contrato de hoy y no este hecho.
   */
  policyWindowStart: string | null;
  policyWindowEnd: string | null;
  /** Ventana congelada en el viaje (la que se usó al verificar). */
  tripWindowStart: string | null;
  tripWindowEnd: string | null;
  tripWindowDiffersFromPolicy: boolean;
  /**
   * De dónde salió la política que gobierna esta lectura: del sello del hecho
   * o del contrato vivo. Se declara para que la pantalla pueda decirlo en vez
   * de que el lector lo suponga.
   */
  politicaOrigen: "sello" | "contrato";
  /**
   * El contrato cambió alguna de las reglas que este expediente muestra desde
   * que el hecho se selló. Lo que se enseña sigue siendo lo del sello; esto
   * solo avisa de que hoy el contrato dice otra cosa.
   */
  contratoCambioDesdeElSello: boolean;
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
  /**
   * Cómo se midió — los cuatro pasos, ya proyectados.
   *
   * Va a TODAS las caras. A diferencia de `ledger`, esto no trae operación
   * interna del carrier: ni IMEIs ni las unidades candidatas que no sirvieron
   * la ruta. Por eso puede cruzar a la planta sin tocar la compuerta.
   */
  pasosMedicion: PasoMedicion[];
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
  /*
   * C24 · La política con la que se LEE este servicio sale del sello, no del
   * contrato de hoy.
   *
   * `contract.policy` sigue existiendo y sigue siendo la correcta mientras no
   * haya hecho — `politicaDelSello` decide cuál manda y lo declara en `origen`.
   * Con hecho, todo lo que este archivo muestra —tolerancia, márgenes, gracia,
   * zona horaria, consecuencias— describe **cómo se juzgó**, y eso no puede
   * moverse porque alguien edite el contrato después.
   *
   * Es la regla que ya vivía escrita en `no-cumplido-motivo.ts` y que cumplían
   * las otras tres pantallas; ésta era la que faltaba.
   */
  const lecturaDePolitica = politicaDelSello(fact, contract.policy as ContractPolicy);
  const policy = lecturaDePolitica.politica;
  const trip = occurrence.trip;

  const evidencePoints = trip?.evidencePoints ?? [];
  const observedUnitId = fact?.observedUnitId ?? null;
  const tripEvidencePointCount = evidencePoints.length;

  // ── Quién consume: carrier/jstaff vs cliente ──────────────────────────
  // El cliente JAMÁS ve la operación interna del carrier (Pieza 4, Marco).
  // Sin unidad observada, la cara cliente muestra solo KML + geocerca.
  // Carrier y J-Staff sí ven el GPS de flota (son sus propios datos).
  const isClientFace = !options.carrierAccountId && !options.isJStaff;

  let evidenceMapMode: ServiceDetailData["evidenceMapMode"] = "empty";
  let unitEvidence = evidencePoints;
  if (observedUnitId) {
    // Hay unidad observada: mostrar su trazo (todas las caras).
    const matched = evidencePoints.filter((p) => p.unitId === observedUnitId);
    if (matched.length > 0) {
      unitEvidence = matched;
      evidenceMapMode = "observed_unit";
    } else if (evidencePoints.length > 0) {
      if (isClientFace) {
        // Cara cliente: no filtrar por unidad si no hay match → vaciar.
        unitEvidence = [];
        evidenceMapMode = "empty";
      } else {
        // Carrier/J-Staff: mostrar todo (mismatch IMEI→unidad, diagnóstico).
        unitEvidence = evidencePoints;
        evidenceMapMode = "trip_fleet";
      }
    } else {
      unitEvidence = [];
      evidenceMapMode = "empty";
    }
  } else if (evidencePoints.length > 0) {
    if (isClientFace) {
      // Sin unidad observada, cara cliente: NO mostrar flota.
      unitEvidence = [];
      evidenceMapMode = "empty";
    } else {
      // Carrier/J-Staff: mostrar flota para diagnóstico.
      unitEvidence = evidencePoints;
      evidenceMapMode = "trip_fleet";
    }
  } else {
    unitEvidence = [];
    evidenceMapMode = "empty";
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

  // ── Cómo se midió: los pasos de ESTE sello ───────────────────────────────
  // No se reusa `ledger` de arriba: ese trae el viaje completo. Aquí se filtra
  // por ocurrencia en la base (ledger_entries_occurrence_idx) y se empareja con
  // el hecho vigente, que es lo único que puede hablar de este sello.
  let stepsDelSello: unknown = null;
  let razonSinLedger: RazonSinLedger | null = null;
  if (fact) {
    const entradas = await repos.compliance.getLedgerForOccurrence(occurrence.id, {
      sinceMaterializedAt: fact.materializedAt,
    });
    const emparejado = pairLedgerEntryWithFact(entradas, fact.materializedAt);
    if (emparejado.paired) {
      stepsDelSello = emparejado.entry.steps;
    } else {
      razonSinLedger = emparejado.reason;
    }
  }

  const margenMinutos =
    fact?.observedArrivalAt && occurrence.expectedDeadline
      ? (occurrence.expectedDeadline.getTime() - fact.observedArrivalAt.getTime()) / 60_000
      : null;

  const pasosMedicion = fact
    ? proyectarPasosMedicion({
        steps: stepsDelSello,
        razonSinLedger,
        // La etiqueta legible, nunca el IMEI de `decision.details.observedUnit`.
        unidadObservadaLabel:
          observedUnitLabel && observedUnitLabel !== "—" ? observedUnitLabel : null,
        llegadaTexto: fact.observedArrivalAt
          ? localDateTimeShort(fact.observedArrivalAt, tz)
          : null,
        deadlineTexto: localDateTimeShort(occurrence.expectedDeadline, tz),
        margenMinutos,
        toleranciaMinutos: policy.toleranceMinutes ?? null,
        timing: fact.timing ?? null,
      })
    : [];

  return {
    occurrenceId: occurrence.id,
    serviceDate: occurrence.serviceDate,
    profileName: occurrence.profile?.name ?? "—",
    clientName: client?.name ?? "—",
    carrierName: carrier?.name ?? "—",
    plantName: plant?.name ?? null,
    status: fact?.status ?? null,
    expectedDeadline: localDateTimeShort(occurrence.expectedDeadline, tz),
    referenceUnitLabel,
    observedUnitLabel,
    observedUnitId: fact?.observedUnitId ?? null,
    observedArrivalAt: fact?.observedArrivalAt
      ? localDateTimeShort(fact.observedArrivalAt, tz)
      : null,
    timing: fact?.timing ?? null,
    evidenceStatus: trip?.evidenceStatus ?? null,
    policyWindowStart: localDateTimeShort(policyWindow.windowStart, tz),
    policyWindowEnd: localDateTimeShort(policyWindow.windowEnd, tz),
    tripWindowStart: tripStart ? localDateTimeShort(tripStart, tz) : null,
    tripWindowEnd: tripEnd ? localDateTimeShort(tripEnd, tz) : null,
    tripWindowDiffersFromPolicy,
    politicaOrigen: lecturaDePolitica.origen,
    contratoCambioDesdeElSello: lecturaDePolitica.contratoCambioDesdeElSello,
    evidenceMarginBeforeMinutes: policy.evidenceMarginMinutesBefore ?? null,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? null,
    evidenceMarginAfterMinutes: policy.evidenceMarginMinutesAfter ?? null,
    toleranceMinutes: policy.toleranceMinutes ?? null,
    evidenceFirstAt: evidenceFirstAtRaw ? localDateTimeShort(evidenceFirstAtRaw, tz) : null,
    evidenceLastAt: evidenceLastAtRaw ? localDateTimeShort(evidenceLastAtRaw, tz) : null,
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
    // La compuerta de Pieza 4 se queda: el ledger crudo trae IMEIs de flota.
    // Lo que cruza a la planta es `pasosMedicion`, que es una proyección.
    ledger: isClientFace ? [] : ledger,
    pasosMedicion,
    clientSlug: client?.slug ?? null,
    contractId: contract.id,
    plantId: contract.plantId ?? null,
    plantGroupId: contract.plantGroupId ?? null,
    contractName: contract.name,
    timeZone: tz,
    fleetHiddenForClient: isClientFace && !observedUnitId,
  };
}
