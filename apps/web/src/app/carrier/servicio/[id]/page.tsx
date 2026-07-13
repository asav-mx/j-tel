import { NavBar } from "@/components/ui";
import { ServiceDetailView } from "@/components/service-detail-view";
import { CarrierDudosoReview } from "@/components/carrier-dudoso-review";
import {
  clipTrackToRoute,
  downsampleMapPoints,
  loadServiceDetail,
  type MapPoint,
} from "@/lib/service-detail-data";
import { suggestionsFromLedger } from "@/lib/carrier-unit-suggestions";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { getRepos } from "@/lib/db";
import type { CandidateTrack } from "@/components/carrier-candidate-compare-map";

export const dynamic = "force-dynamic";

const TRACK_COLORS = ["#22c55e", "#f59e0b", "#38bdf8"];

export default async function CarrierServicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const showLabelForm = data.status === "no_cumplido";

  const evidencePoints = occurrence?.trip?.evidencePoints ?? [];
  const unitIdToImeis = new Map<string, string[]>();
  for (const a of assignments) {
    const imei = a.device?.imei;
    if (!imei) continue;
    const list = unitIdToImeis.get(a.unitId) ?? [];
    list.push(imei);
    unitIdToImeis.set(a.unitId, list);
  }

  // Si el viaje no tiene puntos por unidad, caemos a telemetría de la ventana.
  let telemetryByUnit = new Map<string, MapPoint[]>();
  const needsTelemetry = suggestions.some((s) => {
    const n = evidencePoints.filter(
      (p) => p.unitId === s.unitId || imeiToUnitId.get(p.imei) === s.unitId,
    ).length;
    return n < 2;
  });
  if (
    needsTelemetry &&
    occurrence?.trip?.evidenceWindowStart &&
    occurrence.trip.evidenceWindowEnd
  ) {
    const imeis = suggestions.flatMap((s) => unitIdToImeis.get(s.unitId) ?? []);
    if (imeis.length > 0) {
      const telem = await repos.telemetry.getForImeis(
        imeis,
        occurrence.trip.evidenceWindowStart,
        occurrence.trip.evidenceWindowEnd,
      );
      const byUnit = new Map<string, MapPoint[]>();
      for (const p of telem) {
        const unitId = p.unitId ?? imeiToUnitId.get(p.imei);
        if (!unitId) continue;
        const list = byUnit.get(unitId) ?? [];
        list.push({
          lat: p.latitude,
          lng: p.longitude,
          at: p.recordedAt.toISOString(),
        });
        byUnit.set(unitId, list);
      }
      for (const [uid, pts] of byUnit) {
        pts.sort((a, b) => a.at.localeCompare(b.at));
        telemetryByUnit.set(uid, pts);
      }
    }
  }

  const tracks: CandidateTrack[] = suggestions.map((s, i) => {
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

    if (raw.length < 2) {
      raw = telemetryByUnit.get(s.unitId) ?? [];
    }

    const clipped = clipTrackToRoute(raw, data.kmlWaypoints);
    return {
      unitId: s.unitId,
      label: s.label,
      color: TRACK_COLORS[i % TRACK_COLORS.length]!,
      points: downsampleMapPoints(clipped, 350),
    };
  });

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
            tracks={tracks}
            kmlWaypoints={data.kmlWaypoints}
            geofence={data.geofencePolygon}
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
