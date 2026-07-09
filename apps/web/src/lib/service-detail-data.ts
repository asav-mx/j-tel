import { getRepos } from "@/lib/db";
import { notFound } from "next/navigation";
import { computeEnforcement, type ContractPolicy } from "@jtel/domain";

export type MapPoint = { lat: number; lng: number; at: string };
export type MapPolygon = Array<{ lat: number; lng: number }>;

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
  pointCount: number;
  mapPoints: MapPoint[];
  geofencePolygon: MapPolygon;
  arrivalPoint: MapPoint | null;
  enforcement: Array<{ description: string; applies: boolean }>;
  showEnforcement: boolean;
  ledger: unknown[];
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
  const mapPoints: MapPoint[] = evidencePoints
    .map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      at: p.recordedAt.toISOString(),
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const geofence = occurrence.profile?.geofence;
  const geofencePolygon: MapPolygon = (geofence?.polygon as MapPolygon | undefined) ?? [];

  const arrivalPoint =
    fact?.observedArrivalAt && mapPoints.length > 0
      ? closestPoint(mapPoints, fact.observedArrivalAt)
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
    evidenceStatus: occurrence.trip?.evidenceStatus ?? null,
    pointCount: mapPoints.length,
    mapPoints,
    geofencePolygon,
    arrivalPoint,
    enforcement,
    showEnforcement: options.showEnforcement !== false,
    ledger,
  };
}
