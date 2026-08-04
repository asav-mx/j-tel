import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { CarrierDudosoReview } from "@/components/carrier-dudoso-review";
import {
  loadServiceDetail,
  type MapPoint,
} from "@/lib/service-detail-data";
import { suggestionsFromLedger } from "@/lib/carrier-unit-suggestions";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";
import {
  calibrationViewEnd,
  cutTrackAtArrival,
  cutTrackAtIndex,
  findFirstGeofenceEntry,
  type NamedGeofence,
} from "@/lib/map-evidence";
import type { ContractPolicy } from "@jtel/domain";
import { localDateTimeShort, JTTEL_TZ } from "@jtel/domain";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

const TRACK_COLORS = ["#22c55e", "#f59e0b", "#38bdf8"];

function formatShort(iso: string, timeZone: string = JTTEL_TZ): string {
  return localDateTimeShort(iso, timeZone);
}

export default async function CarrierServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su payload
  // viaja igual en la respuesta (regla 7 del plan).
  await exigirSesion();

  const { id } = await params;
  const carrier = await resolveAccountByType("carrier", searchParams);
  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin carrier.</p>
      </main>
    );
  }

  const data = await loadServiceDetail(id, {
    carrierAccountId: carrier.id,
    showEnforcement: false,
  });

  const repos = getRepos();
  const [units, assignments, occurrence] = await Promise.all([
    repos.fleet.getUnitsForCarrier(carrier.id),
    repos.fleet.getActiveAssignmentsForCarrier(carrier.id),
    repos.occurrences.findById(id),
  ]);
  if (!occurrence) notFound();

  const unitOptions = units.map((u) => ({
    id: u.id,
    label: `${u.label}${u.plateNumber ? ` (${u.plateNumber})` : ""}`,
  }));

  const imeiToUnitId = new Map<string, string>();
  for (const a of assignments) {
    const imei = a.device?.imei;
    if (imei) imeiToUnitId.set(imei, a.unitId);
  }

  const suggestions = suggestionsFromLedger(
    data.ledger,
    unitOptions,
    imeiToUnitId,
    3,
  );

  const existingGt = await repos.occurrenceGroundTruth.findByOccurrence(id);
  // Solo dudosos reales (sin unidad observada) van al flujo de etiquetado.
  const fact = occurrence?.complianceFact;
  const isDudosoSinUnidad =
    data.status === "no_cumplido" && !fact?.observedUnitId;
  const showLabelForm = isDudosoSinUnidad;

  const evidencePoints = occurrence?.trip?.evidencePoints ?? [];
  const unitIdToImeis = new Map<string, string[]>();
  for (const a of assignments) {
    const imei = a.device?.imei;
    if (!imei) continue;
    const list = unitIdToImeis.get(a.unitId) ?? [];
    list.push(imei);
    unitIdToImeis.set(a.unitId, list);
  }

  const policy = (occurrence?.profile?.contract?.policy ?? {}) as ContractPolicy;
  const deadline = occurrence.expectedDeadline;
  // copia defensiva: calibrationViewEnd crea su propia copia internamente, pero un Date compartido es trampa
  const tripStart = occurrence.trip?.evidenceWindowStart ?? new Date(deadline);
  const viewEnd = calibrationViewEnd(deadline, policy);

  // Geocercas destino de TODOS los contratos de este carrier (solo lectura / calibración).
  const carrierContracts = await repos.contracts.findForCarrier(carrier.id);
  const geofenceById = new Map<string, NamedGeofence>();
  for (const c of carrierContracts) {
    const profiles = await repos.profiles.findForContract(c.id);
    for (const p of profiles) {
      const g = p.geofence;
      if (!g || g.role !== "destino" || !g.polygon || g.polygon.length < 3) continue;
      if (geofenceById.has(g.id)) continue;
      const scopeLabel =
        c.plantGroup?.name ?? c.plant?.code ?? c.client?.name ?? "destino";
      geofenceById.set(g.id, {
        id: g.id,
        name: `${g.name} · ${scopeLabel}`,
        polygon: g.polygon as Array<{ lat: number; lng: number }>,
      });
    }
  }
  // Asegura que la geocerca de ESTE servicio esté (aunque role no sea destino).
  if (data.geofencePolygon.length >= 3) {
    const selfId = occurrence?.profile?.geofence?.id ?? `self-${id}`;
    if (!geofenceById.has(selfId)) {
      geofenceById.set(selfId, {
        id: selfId,
        name: occurrence?.profile?.geofence?.name
          ? `${occurrence.profile.geofence.name} · este servicio`
          : "Destino de este servicio",
        polygon: data.geofencePolygon,
      });
    }
  }
  const namedGeofences = [...geofenceById.values()];

  // Telemetría en ventana de calibración (dudosos sin unidad) o viaje (con llegada).
  let telemetryByUnit = new Map<string, MapPoint[]>();
  const loadFrom = tripStart;
  const loadTo = isDudosoSinUnidad
    ? viewEnd
    : (occurrence?.trip?.evidenceWindowEnd ?? viewEnd);

  const imeis = suggestions.flatMap((s) => unitIdToImeis.get(s.unitId) ?? []);
  if (imeis.length > 0) {
    const telem = await repos.telemetry.getForImeis(imeis, loadFrom, loadTo);
    for (const p of telem) {
      const unitId = p.unitId ?? imeiToUnitId.get(p.imei);
      if (!unitId) continue;
      const list = telemetryByUnit.get(unitId) ?? [];
      list.push({
        lat: p.latitude,
        lng: p.longitude,
        at: p.recordedAt.toISOString(),
      });
      telemetryByUnit.set(unitId, list);
    }
    for (const [, pts] of telemetryByUnit) {
      pts.sort((a, b) => a.at.localeCompare(b.at));
    }
  }

  const trackSources = suggestions.map((s, i) => {
    let raw: MapPoint[] = evidencePoints
      .filter((p) => {
        if (p.unitId === s.unitId) return true;
        return imeiToUnitId.get(p.imei) === s.unitId;
      })
      .map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        at: p.recordedAt.toISOString(),
      }))
      .sort((a, b) => a.at.localeCompare(b.at));

    // Preferir telemetría extendida cuando hay más puntos (calibración).
    const telem = telemetryByUnit.get(s.unitId) ?? [];
    if (telem.length > raw.length) raw = telem;
    else if (raw.length < 2) raw = telem;

    // Con llegada registrada: cortar ahí (regla transversal).
    if (fact?.observedArrivalAt) {
      raw = cutTrackAtArrival(raw, fact.observedArrivalAt);
    }

    // Dudoso sin unidad: marcar primera entrada a cualquier geocerca del carrier y cortar.
    let entry: {
      lat: number;
      lng: number;
      at: string;
      geofenceName: string;
    } | null = null;
    if (isDudosoSinUnidad && raw.length > 0) {
      const hit = findFirstGeofenceEntry(raw, namedGeofences);
      if (hit) {
        entry = {
          lat: hit.point.lat,
          lng: hit.point.lng,
          at: hit.point.at,
          geofenceName: hit.geofence.name,
        };
        raw = cutTrackAtIndex(raw, hit.index);
      }
    }

    return {
      unitId: s.unitId,
      label: s.label,
      color: TRACK_COLORS[i % TRACK_COLORS.length]!,
      points: raw,
      entry,
    };
  });

  const tz = policy.timeZone ?? JTTEL_TZ;
  const calibrationWindowLabel = `${formatShort(loadFrom.toISOString(), tz)} → ${formatShort(
    loadTo.toISOString(), tz,
  )}`;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <NavBar
          title={`Servicio ${data.serviceDate} — ${data.clientName}`}
          links={[
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "← Cumplimiento",
            },
          ]}
        />
        <ServiceDetailView
          data={data}
          backHref={withAccount("/carrier/cumplimiento", carrier.slug)}
          backLabel="← Volver a cumplimiento"
          hideEvidenceMap={showLabelForm}
        />

        {showLabelForm ? (
          <CarrierDudosoReview
            occurrenceId={id}
            accountSlug={carrier.slug}
            units={unitOptions}
            suggestions={suggestions}
            trackSources={trackSources}
            kmlWaypoints={data.kmlWaypoints}
            geofences={namedGeofences}
            calibrationWindowLabel={calibrationWindowLabel}
            existing={
              existingGt
                ? {
                    verdict: existingGt.operatorVerdict,
                    unitId: existingGt.operatorUnitId,
                    notes: existingGt.notes,
                  }
                : null
            }
          />
        ) : null}
      </div>
    </main>
  );
}
