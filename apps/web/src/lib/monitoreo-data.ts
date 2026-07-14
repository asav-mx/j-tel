import { getRepos } from "@/lib/db";
import type { ContractPolicy, GpsPoint, OperationalScope } from "@jtel/domain";
import {
  computeCorridorPrecisionPct,
  computeRouteMatchPct,
  findGeofenceEntry,
  minDistanceToRouteKm,
} from "@jtel/verification";

/**
 * Torre de control ("Monitoreo") en vivo.
 *
 * Solo lectura / visual: reutiliza las mismas primitivas del motor oficial
 * (computeRouteMatchPct / computeCorridorPrecisionPct / findGeofenceEntry) para
 * pre-identificar qué unidad va en qué ruta ANTES de que el motor cierre el
 * veredicto. No escribe hechos, ledger ni veredictos (Marco-Limpio).
 */

export type MonitoreoState =
  | "programada"
  | "en_ruta"
  | "avanzando"
  | "llego"
  | "alerta";

export type LatLng = { lat: number; lng: number };
export type TrackPoint = { lat: number; lng: number; at: string };

export type MonitoreoRoute = {
  occurrenceId: string;
  profileCode: string;
  profileName: string;
  colorIndex: number;
  state: MonitoreoState;
  /** Motivo de alerta legible (si state === "alerta"). */
  alertReason: string | null;
  expectedDeadline: string;
  minutesToDeadline: number;
  /** Trazado esperado (fondo / marca de agua). */
  kmlWaypoints: LatLng[];
  geofencePolygon: LatLng[];
  /** Unidad pre-identificada en vivo (provisional, no veredicto). */
  matchedUnitId: string | null;
  matchedUnitLabel: string | null;
  /** % de cobertura de ruta (métrica A) — avance del pre-verificado. */
  coveragePct: number;
  corridorPct: number;
  /** Huella: tramo ya recorrido sobre el corredor (color de la ruta). */
  huella: TrackPoint[];
  /** Última posición conocida de la unidad. */
  currentPoint: TrackPoint | null;
  /** Llegada a geocerca destino (pre-cumplido). */
  arrivalAt: string | null;
};

export type MonitoreoPayload = {
  fecha: string;
  turnoId: string;
  turnoName: string;
  turnoStartTime: string;
  unitId: string;
  unitName: string;
  accountSlug: string;
  generatedAt: string;
  routes: MonitoreoRoute[];
  stats: {
    total: number;
    programada: number;
    en_ruta: number;
    avanzando: number;
    llego: number;
    alerta: number;
  };
  units: Array<{ id: string; label: string }>;
};

/** Umbrales de identificación en vivo (visual). */
const IDENTIFY_MIN_PCT = 10; // cubrió >=10% del corredor -> "en ruta"
const ON_CORRIDOR_MIN_PCT = 40; // qué tan sobre el corredor va (métrica B)
const ADVANCING_MIN_PCT = 60; // a partir de aquí "avanzando"
const OFF_CORRIDOR_FACTOR = 2; // último punto a > 2x corredor => se salió
const DEADLINE_WARN_MIN = 20; // sin unidad y faltan <=20 min -> alerta
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

type Candidate = {
  occurrenceIdx: number;
  unitId: string;
  score: number;
  routeMatchPct: number;
  corridorPct: number;
  points: GpsPoint[];
};

export async function loadMonitoreo(opts: {
  scope: OperationalScope;
  accountSlug: string;
  fecha: string;
  turnoId: string;
  now?: Date;
}): Promise<MonitoreoPayload | null> {
  const repos = getRepos();
  const now = opts.now ?? new Date();

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

  // Geocercas del alcance: para detectar llegada por ocurrencia (confidencialidad
  // dentro del propio cliente).
  const scopeGeofences = await repos.geofences.findForScope(opts.scope, account.id);
  const geofenceById = new Map<string, LatLng[]>();
  for (const g of scopeGeofences) {
    if (Array.isArray(g.polygon) && g.polygon.length >= 3) {
      geofenceById.set(g.id, g.polygon as LatLng[]);
    }
  }

  // KML + política + geocerca por ocurrencia.
  type OccData = {
    kml: LatLng[];
    corridorKm: number;
    geofence: LatLng[];
    deadline: Date;
    windowStart: Date;
    carrierAccountId: string | null;
  };
  const occData: OccData[] = [];
  for (const o of filtered) {
    const policy = (o.contract?.policy ?? {}) as ContractPolicy;
    const routeId = o.profile?.routeShift?.routeId;
    let kml: LatLng[] = [];
    if (routeId) {
      const kmlVer = await repos.routes.getKmlVersionForDate(routeId, o.expectedDeadline);
      kml = (kmlVer?.waypoints ?? []) as LatLng[];
    }
    const corridorKm = Math.min(0.5, Math.max(0.01, (policy.kmlCorridorMeters ?? 120) / 1000));
    const marginBefore = policy.evidenceMarginMinutesBefore ?? 60;
    const windowStart = new Date(o.expectedDeadline.getTime() - marginBefore * 60_000);
    occData.push({
      kml,
      corridorKm,
      geofence: geofenceById.get(o.profile?.geofenceId ?? "") ?? [],
      deadline: o.expectedDeadline,
      windowStart,
      carrierAccountId: o.contract?.carrierAccountId ?? null,
    });
  }

  // Telemetría por carrier (una sola lectura por carrier, reutilizada en sus rutas).
  const unitLabelById = new Map<string, string>();
  const unitCarrierById = new Map<string, string>();
  const pointsByUnit = new Map<string, GpsPoint[]>();
  const carrierIds = [
    ...new Set(occData.map((d) => d.carrierAccountId).filter((x): x is string => !!x)),
  ];

  for (const carrierId of carrierIds) {
    const idxs = occData
      .map((d, i) => (d.carrierAccountId === carrierId ? i : -1))
      .filter((i) => i >= 0);
    if (idxs.length === 0) continue;

    const windowStart = new Date(
      Math.min(...idxs.map((i) => occData[i]!.windowStart.getTime())),
    );

    const [units, devices] = await Promise.all([
      repos.fleet.getUnitsForCarrier(carrierId),
      repos.fleet.getDevicesForCarrier(carrierId),
    ]);
    for (const u of units) {
      unitLabelById.set(u.id, u.label);
      unitCarrierById.set(u.id, carrierId);
    }

    const imeiToUnitId = new Map<string, string>();
    for (const d of devices) {
      const a = await repos.fleet.resolveUnitAtTime(d.id, now);
      if (a?.unitId) imeiToUnitId.set(d.imei, a.unitId);
    }
    const imeis = [...imeiToUnitId.keys()];
    if (imeis.length === 0) continue;

    const telem = await repos.telemetry.getForImeis(imeis, windowStart, now);
    for (const p of telem) {
      const unitId = imeiToUnitId.get(p.imei);
      if (!unitId) continue;
      const list = pointsByUnit.get(unitId) ?? [];
      list.push({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.recordedAt,
        imei: p.imei,
      });
      pointsByUnit.set(unitId, list);
    }
  }
  for (const [, pts] of pointsByUnit) {
    pts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Candidatas por ocurrencia (reusando lógica del motor).
  const candidates: Candidate[] = [];
  for (let i = 0; i < occData.length; i++) {
    const d = occData[i]!;
    if (d.kml.length < 2 || !d.carrierAccountId) continue;
    const carrierUnitIds = [...pointsByUnit.keys()].filter(
      (uid) => unitCarrierById.get(uid) === d.carrierAccountId,
    );
    for (const uid of carrierUnitIds) {
      const raw = pointsByUnit.get(uid) ?? [];
      if (raw.length < 2) continue;
      const pts = downsample(raw, 200);
      const a = computeRouteMatchPct(pts, d.kml, d.corridorKm);
      const b = computeCorridorPrecisionPct(pts, d.kml, d.corridorKm);
      if (b >= ON_CORRIDOR_MIN_PCT && a >= IDENTIFY_MIN_PCT) {
        candidates.push({
          occurrenceIdx: i,
          unitId: uid,
          score: Math.min(a, b),
          routeMatchPct: a,
          corridorPct: b,
          points: raw,
        });
      }
    }
  }

  // Exclusividad: una unidad se engancha a una sola ruta (mayor score).
  candidates.sort((x, y) => y.score - x.score);
  const assignedOcc = new Map<number, Candidate>();
  const usedUnits = new Set<string>();
  for (const c of candidates) {
    if (assignedOcc.has(c.occurrenceIdx) || usedUnits.has(c.unitId)) continue;
    assignedOcc.set(c.occurrenceIdx, c);
    usedUnits.add(c.unitId);
  }

  const routes: MonitoreoRoute[] = filtered.map((o, i) => {
    const d = occData[i]!;
    const match = assignedOcc.get(i) ?? null;
    const minutesToDeadline = Math.round((d.deadline.getTime() - now.getTime()) / 60_000);

    let state: MonitoreoState = "programada";
    let alertReason: string | null = null;
    let huella: TrackPoint[] = [];
    let currentPoint: TrackPoint | null = null;
    let arrivalAt: string | null = null;
    let coveragePct = 0;
    let corridorPct = 0;

    if (match) {
      coveragePct = Math.round(match.routeMatchPct * 10) / 10;
      corridorPct = Math.round(match.corridorPct * 10) / 10;

      const onCorridor = match.points.filter(
        (p) =>
          minDistanceToRouteKm({ lat: p.latitude, lng: p.longitude }, d.kml) <=
          d.corridorKm,
      );
      huella = downsample(
        onCorridor.map((p) => ({
          lat: p.latitude,
          lng: p.longitude,
          at: p.timestamp.toISOString(),
        })),
        150,
      );
      const last = match.points[match.points.length - 1]!;
      currentPoint = {
        lat: last.latitude,
        lng: last.longitude,
        at: last.timestamp.toISOString(),
      };

      const entry =
        d.geofence.length >= 3 ? findGeofenceEntry(match.points, d.geofence) : null;
      arrivalAt = entry ? entry.toISOString() : null;

      const lastOffRoute =
        minDistanceToRouteKm({ lat: last.latitude, lng: last.longitude }, d.kml) >
        d.corridorKm * OFF_CORRIDOR_FACTOR;

      if (arrivalAt) {
        state = "llego";
      } else if (lastOffRoute) {
        state = "alerta";
        alertReason = "La unidad se salió del corredor de la ruta";
      } else if (match.routeMatchPct >= ADVANCING_MIN_PCT) {
        state = "avanzando";
      } else {
        state = "en_ruta";
      }
    } else {
      const started = now.getTime() >= d.windowStart.getTime();
      if (started && minutesToDeadline <= DEADLINE_WARN_MIN) {
        state = "alerta";
        alertReason =
          minutesToDeadline >= 0
            ? `Sin unidad identificada y faltan ${minutesToDeadline} min`
            : "Sin unidad identificada y el turno ya venció";
      } else {
        state = "programada";
      }
    }

    return {
      occurrenceId: o.id,
      profileCode: o.profile?.code ?? "?",
      profileName: o.profile?.name ?? "?",
      colorIndex: i % PALETTE_SIZE,
      state,
      alertReason,
      expectedDeadline: d.deadline.toISOString(),
      minutesToDeadline,
      kmlWaypoints: downsample(d.kml, 120),
      geofencePolygon: d.geofence,
      matchedUnitId: match?.unitId ?? null,
      matchedUnitLabel: match ? (unitLabelById.get(match.unitId) ?? null) : null,
      coveragePct,
      corridorPct,
      huella,
      currentPoint,
      arrivalAt,
    };
  });

  const stats = {
    total: routes.length,
    programada: routes.filter((r) => r.state === "programada").length,
    en_ruta: routes.filter((r) => r.state === "en_ruta").length,
    avanzando: routes.filter((r) => r.state === "avanzando").length,
    llego: routes.filter((r) => r.state === "llego").length,
    alerta: routes.filter((r) => r.state === "alerta").length,
  };

  const units = [...usedUnits].map((id) => ({
    id,
    label: unitLabelById.get(id) ?? id,
  }));

  return {
    fecha: opts.fecha,
    turnoId: opts.turnoId,
    turnoName,
    turnoStartTime,
    unitId: unit.id,
    unitName: unit.name,
    accountSlug: account.slug,
    generatedAt: now.toISOString(),
    routes,
    stats,
    units,
  };
}
