import { getRepos } from "@/lib/db";
import type { ContractPolicy, OperationalScope } from "@jtel/domain";
import { computeExclusiveContentionWindow } from "@jtel/services";

export type JornadaRoute = {
  occurrenceId: string;
  profileCode: string;
  profileName: string;
  status: string | null;
  timing: string | null;
  observedUnitId: string | null;
  observedUnitLabel: string | null;
  expectedDeadline: string;
  kmlWaypoints: Array<{ lat: number; lng: number }>;
  gpsTrack: Array<{ lat: number; lng: number; at: string }>;
  colorIndex: number;
};

export type JornadaPayload = {
  fecha: string;
  turnoId: string;
  turnoName: string;
  turnoStartTime: string;
  unitId: string;
  unitName: string;
  accountSlug: string;
  routes: JornadaRoute[];
  stats: {
    total: number;
    cumplido: number;
    no_cumplido: number;
    pendiente_evidencia: number;
    sin_verificar: number;
  };
  units: Array<{ id: string; label: string }>;
};

const PALETTE_SIZE = 12;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]!);
  return out;
}

async function resolveScopeUnit(
  repos: ReturnType<typeof getRepos>,
  scope: OperationalScope,
  clientAccountId: string,
): Promise<{ id: string; name: string } | null> {
  if (scope.kind === "plant") {
    const plant = await repos.clients.getPlantById(scope.plantId);
    if (!plant || plant.clientAccountId !== clientAccountId) return null;
    return { id: plant.id, name: plant.name };
  }
  const group = await repos.clients.getPlantGroupById(scope.plantGroupId);
  if (!group || group.clientAccountId !== clientAccountId) return null;
  return { id: group.id, name: group.name };
}

export async function loadJornada(opts: {
  scope: OperationalScope;
  accountSlug: string;
  fecha: string;
  turnoId: string;
}): Promise<JornadaPayload | null> {
  const repos = getRepos();
  const account = await repos.accounts.findBySlug(opts.accountSlug);
  if (!account || account.type !== "client") return null;

  const unit = await resolveScopeUnit(repos, opts.scope, account.id);
  if (!unit) return null;

  const day = new Date(`${opts.fecha}T00:00:00`);
  const occurrences = await repos.occurrences.findForScope(opts.scope, day, day);

  const filtered = occurrences.filter(
    (o) =>
      o.serviceDate === opts.fecha &&
      o.profile?.routeShift?.shiftId === opts.turnoId,
  );

  const shift = filtered[0]?.profile?.routeShift?.shift;
  const turnoName = shift?.name ?? "Turno";
  const turnoStartTime = String(shift?.startTime ?? "").slice(0, 5);

  const routes: JornadaRoute[] = [];
  const unitMap = new Map<string, string>();

  for (let i = 0; i < filtered.length; i++) {
    const o = filtered[i]!;
    const profile = o.profile;
    const contract = o.contract;
    const policy = (contract?.policy ?? {}) as ContractPolicy;
    const routeId = profile?.routeShift?.routeId;
    let kmlWaypoints: Array<{ lat: number; lng: number }> = [];
    if (routeId) {
      const kml = await repos.routes.getKmlVersionForDate(routeId, o.expectedDeadline);
      kmlWaypoints = downsample(kml?.waypoints ?? [], 80);
    }

    let gpsTrack: JornadaRoute["gpsTrack"] = [];
    const observedUnitId = o.complianceFact?.observedUnitId ?? null;
    if (observedUnitId && contract?.carrierAccountId) {
      const units = await repos.fleet.getUnitsForCarrier(contract.carrierAccountId);
      const unit = units.find((u) => u.id === observedUnitId);
      if (unit) unitMap.set(unit.id, unit.label);

      const devices = await repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
      const window = computeExclusiveContentionWindow(o.expectedDeadline, policy);
      const imeis: string[] = [];
      for (const d of devices) {
        const a = await repos.fleet.resolveUnitAtTime(d.id, o.expectedDeadline);
        if (a?.unitId === observedUnitId) imeis.push(d.imei);
      }
      if (imeis.length > 0) {
        const pts = await repos.telemetry.getForImeis(
          imeis,
          new Date(window.startMs),
          new Date(window.endMs),
        );
        gpsTrack = downsample(
          pts.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            at: p.recordedAt.toISOString(),
          })),
          120,
        );
      }
    }

    routes.push({
      occurrenceId: o.id,
      profileCode: profile?.code ?? "?",
      profileName: profile?.name ?? "?",
      status: o.complianceFact?.status ?? null,
      timing: o.complianceFact?.timing ?? null,
      observedUnitId,
      observedUnitLabel: observedUnitId ? (unitMap.get(observedUnitId) ?? null) : null,
      expectedDeadline: o.expectedDeadline.toISOString(),
      kmlWaypoints,
      gpsTrack,
      colorIndex: i % PALETTE_SIZE,
    });
  }

  const stats = {
    total: routes.length,
    cumplido: routes.filter((r) => r.status === "cumplido").length,
    no_cumplido: routes.filter((r) => r.status === "no_cumplido").length,
    pendiente_evidencia: routes.filter((r) => r.status === "pendiente_evidencia").length,
    sin_verificar: routes.filter((r) => r.status == null).length,
  };

  return {
    fecha: opts.fecha,
    turnoId: opts.turnoId,
    turnoName,
    turnoStartTime,
    unitId: unit.id,
    unitName: unit.name,
    accountSlug: account.slug,
    routes,
    stats,
    units: [...unitMap.entries()].map(([id, label]) => ({ id, label })),
  };
}
