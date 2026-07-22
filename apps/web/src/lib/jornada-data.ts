import { getRepos } from "@/lib/db";
import type { ContractPolicy, GpsPoint, OperationalScope } from "@jtel/domain";
import { localTimeHHMM, JTTEL_TZ } from "@jtel/domain";
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
  /** Destino del perfil — misma geocerca que Cumplimiento / árbitro. */
  geofencePolygon: Array<{ lat: number; lng: number }>;
  geofenceName: string | null;
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

function normalizePolygon(raw: unknown): Array<{ lat: number; lng: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ lat: number; lng: number }> = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const rec = p as Record<string, unknown>;
    const lat = Number(rec.lat ?? rec.latitude);
    const lng = Number(rec.lng ?? rec.longitude ?? rec.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
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

/**
 * Historial (contraste esperado vs observado).
 * Producto genérico: planta independiente o campus — misma lógica.
 */
export async function loadJornada(opts: {
  accountSlug: string;
  scope: OperationalScope;
  fecha: string;
  turnoId: string;
}): Promise<JornadaPayload | null> {
  const repos = getRepos();
  const account = await repos.accounts.findBySlug(opts.accountSlug);
  if (!account) return null;

  const unit = await resolveScopeUnit(repos, opts.scope, account.id);
  if (!unit) return null;

  const day = new Date(`${opts.fecha}T12:00:00.000Z`);
  const occs = await repos.occurrences.findForScope(opts.scope, day, day);
  const filtered = occs.filter(
    (o) =>
      o.serviceDate === opts.fecha &&
      o.profile?.routeShift?.shiftId === opts.turnoId,
  );

  const shift = filtered[0]?.profile?.routeShift?.shift;
  const turnoName = shift?.name ?? "Turno";
  const turnoStartTime = String(shift?.startTime ?? "").slice(0, 5);

  // Telemetría por carrier (una lectura), reutilizada en rutas sin unidad
  // observada — si no, el mapa de Historial quedaba vacío en no_cumplido.
  const pointsByCarrierUnit = new Map<string, Map<string, GpsPoint[]>>();
  const carrierIds = [
    ...new Set(
      filtered
        .map((o) => o.contract?.carrierAccountId)
        .filter((x): x is string => Boolean(x)),
    ),
  ];

  for (const carrierId of carrierIds) {
    const idxs = filtered
      .map((o, i) => (o.contract?.carrierAccountId === carrierId ? i : -1))
      .filter((i) => i >= 0);
    if (idxs.length === 0) continue;

    const windows = idxs.map((i) => {
      const o = filtered[i]!;
      const policy = (o.contract?.policy ?? {}) as ContractPolicy;
      return computeExclusiveContentionWindow(o.expectedDeadline, policy);
    });
    const windowStart = new Date(Math.min(...windows.map((w) => w.startMs)));
    const windowEnd = new Date(Math.max(...windows.map((w) => w.endMs)));
    if (windowEnd.getTime() <= windowStart.getTime()) continue;

    const [units, devices] = await Promise.all([
      repos.fleet.getUnitsForCarrier(carrierId),
      repos.fleet.getDevicesForCarrier(carrierId),
    ]);
    const imeiToUnitId = new Map<string, string>();
    for (const d of devices) {
      const a = await repos.fleet.resolveUnitAtTime(d.id, windowEnd);
      if (a?.unitId) imeiToUnitId.set(d.imei, a.unitId);
    }
    const imeis = [...imeiToUnitId.keys()];
    if (imeis.length === 0) continue;

    const telem = await repos.telemetry.getForImeis(imeis, windowStart, windowEnd);
    const byUnit = new Map<string, GpsPoint[]>();
    for (const p of telem) {
      const unitId = p.unitId ?? imeiToUnitId.get(p.imei);
      if (!unitId) continue;
      const list = byUnit.get(unitId) ?? [];
      list.push({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.recordedAt,
        imei: p.imei,
      });
      byUnit.set(unitId, list);
    }
    for (const [, pts] of byUnit) {
      pts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    pointsByCarrierUnit.set(carrierId, byUnit);

    // Labels
    void units;
  }

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

    const geoRaw = profile?.geofence;
    const geofencePolygon = normalizePolygon(geoRaw?.polygon);
    const geofenceName = geoRaw?.name ?? null;

    let gpsTrack: JornadaRoute["gpsTrack"] = [];
    const observedUnitId = o.complianceFact?.observedUnitId ?? null;
    const carrierId = contract?.carrierAccountId ?? null;
    const window = computeExclusiveContentionWindow(o.expectedDeadline, policy);
    const byUnit = carrierId ? pointsByCarrierUnit.get(carrierId) : undefined;

    if (carrierId && byUnit) {
      const units = await repos.fleet.getUnitsForCarrier(carrierId);
      for (const u of units) unitMap.set(u.id, u.label);

      if (observedUnitId) {
        const pts = (byUnit.get(observedUnitId) ?? []).filter(
          (p) =>
            p.timestamp.getTime() >= window.startMs &&
            p.timestamp.getTime() <= window.endMs,
        );
        gpsTrack = downsample(
          pts.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            at: p.timestamp.toISOString(),
          })),
          120,
        );
      } else if (o.complianceFact?.status === "no_cumplido" || !o.complianceFact) {
        // Sin unidad: unir flota en ventana (diagnóstico). Misma necesidad en
        // planta 47, campus u otra — no especializar por ejemplo.
        const merged: Array<{ lat: number; lng: number; at: string }> = [];
        for (const [, pts] of byUnit) {
          for (const p of pts) {
            if (
              p.timestamp.getTime() < window.startMs ||
              p.timestamp.getTime() > window.endMs
            ) {
              continue;
            }
            merged.push({
              lat: p.latitude,
              lng: p.longitude,
              at: p.timestamp.toISOString(),
            });
          }
        }
        merged.sort((a, b) => a.at.localeCompare(b.at));
        gpsTrack = downsample(merged, 160);
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
      expectedDeadline: localTimeHHMM(o.expectedDeadline, JTTEL_TZ),
      kmlWaypoints,
      geofencePolygon,
      geofenceName,
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
