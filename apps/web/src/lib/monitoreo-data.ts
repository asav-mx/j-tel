import { getRepos } from "@/lib/db";
import type { ContractPolicy, GpsPoint, OperationalScope } from "@jtel/domain";
import { computeEvidenceWindow } from "@jtel/domain";
import {
  computeCorridorPrecisionPct,
  computeRouteMatchPct,
  findGeofenceEntry,
  minDistanceToRouteKm,
} from "@jtel/verification";

/**
 * Torre de control ("Monitoreo") en vivo.
 *
 * Ley (Ficha-Handoff-Torre-No-Recalcula / Marco): la torre NO recalcula la
 * verdad. Si una ocurrencia ya tiene `complianceFact`, el árbitro ya emitió su
 * veredicto: la torre no corre match, no corre métricas, no infiere estado.
 * Muestra el servicio como cerrado (con su huella congelada, leída del hecho y
 * cortada en la llegada) y punto. Solo estima sobre servicios aún abiertos, y
 * al estimar usa la MISMA ventana con techo y los MISMOS umbrales de la
 * política del contrato que usará el árbitro. Solo lectura: no escribe hechos,
 * ledger ni veredictos.
 */

export type MonitoreoState =
  | "programada"
  | "en_ruta"
  | "avanzando"
  | "llego"
  | "alerta"
  | "cerrado";

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
  /** Unidad pre-identificada en vivo (provisional, no veredicto). Null si cerrado. */
  matchedUnitId: string | null;
  matchedUnitLabel: string | null;
  /** % de cobertura de ruta (métrica A) — avance del pre-verificado. 0 si cerrado. */
  coveragePct: number;
  corridorPct: number;
  /** Huella: tramo ya recorrido sobre el corredor (color de la ruta). */
  huella: TrackPoint[];
  /** Última posición conocida de la unidad. Null si cerrado (sin estado en vivo). */
  currentPoint: TrackPoint | null;
  /** Llegada a geocerca destino (pre-llegada en vivo, o la del hecho si cerrado). */
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
    cerrado: number;
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

/**
 * Ventana de GPS de la torre para un servicio ABIERTO: la misma del árbitro
 * (`computeEvidenceWindow`), con el fin truncado a `now`. En vivo crece con el
 * reloj pero se detiene en el fin de la ventana de evidencia — nunca `now` sin
 * límite. Defaults idénticos a los del motor (schema de política).
 */
export function computeMonitoreoWindow(
  deadline: Date,
  policy: ContractPolicy,
  now: Date,
): { windowStart: Date; windowEnd: Date } {
  const { windowStart, windowEnd } = computeEvidenceWindow(deadline, {
    evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
    evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
  });
  return {
    windowStart,
    windowEnd: new Date(Math.min(windowEnd.getTime(), now.getTime())),
  };
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
    /** Techo de la ventana: min(now, deadline + gracia + margen después). */
    windowEnd: Date;
    /** Umbral A de la política (kmlMatchMinPct) — mismo default del motor. */
    matchMinPct: number;
    /** Umbral B de la política (kmlCorridorMinPct) — mismo default del motor. */
    corridorMinPct: number;
    carrierAccountId: string | null;
    /** Hecho congelado: si existe, la torre no calcula nada sobre esta ocurrencia. */
    closed: boolean;
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
    // Corredor acotado a los límites del schema de política (10–500 m).
    const corridorKm = Math.min(0.5, Math.max(0.01, (policy.kmlCorridorMeters ?? 120) / 1000));
    const { windowStart, windowEnd } = computeMonitoreoWindow(
      o.expectedDeadline,
      policy,
      now,
    );
    occData.push({
      kml,
      corridorKm,
      geofence: geofenceById.get(o.profile?.geofenceId ?? "") ?? [],
      deadline: o.expectedDeadline,
      windowStart,
      windowEnd,
      matchMinPct: policy.kmlMatchMinPct ?? 60,
      corridorMinPct: policy.kmlCorridorMinPct ?? 60,
      carrierAccountId: o.contract?.carrierAccountId ?? null,
      closed: Boolean(o.complianceFact),
    });
  }

  // Telemetría por carrier (una sola lectura por carrier, reutilizada en sus
  // rutas). SOLO para ocurrencias abiertas: las cerradas no leen telemetría.
  const unitLabelById = new Map<string, string>();
  const unitCarrierById = new Map<string, string>();
  const pointsByUnit = new Map<string, GpsPoint[]>();
  const carrierIds = [
    ...new Set(
      occData
        .filter((d) => !d.closed)
        .map((d) => d.carrierAccountId)
        .filter((x): x is string => !!x),
    ),
  ];

  for (const carrierId of carrierIds) {
    const idxs = occData
      .map((d, i) => (!d.closed && d.carrierAccountId === carrierId ? i : -1))
      .filter((i) => i >= 0);
    if (idxs.length === 0) continue;

    const windowStart = new Date(
      Math.min(...idxs.map((i) => occData[i]!.windowStart.getTime())),
    );
    const windowEnd = new Date(
      Math.max(...idxs.map((i) => occData[i]!.windowEnd.getTime())),
    );
    if (windowEnd.getTime() <= windowStart.getTime()) continue;

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

    const telem = await repos.telemetry.getForImeis(imeis, windowStart, windowEnd);
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

  // Candidatas por ocurrencia ABIERTA (misma matemática que el motor: métricas
  // A y B contra umbrales de la política, sobre la ventana con techo de ESTA
  // ocurrencia).
  const candidates: Candidate[] = [];
  for (let i = 0; i < occData.length; i++) {
    const d = occData[i]!;
    if (d.closed || d.kml.length < 2 || !d.carrierAccountId) continue;
    const carrierUnitIds = [...pointsByUnit.keys()].filter(
      (uid) => unitCarrierById.get(uid) === d.carrierAccountId,
    );
    for (const uid of carrierUnitIds) {
      const inWindow = (pointsByUnit.get(uid) ?? []).filter(
        (p) =>
          p.timestamp.getTime() >= d.windowStart.getTime() &&
          p.timestamp.getTime() <= d.windowEnd.getTime(),
      );
      if (inWindow.length < 2) continue;
      const pts = downsample(inWindow, 200);
      const a = computeRouteMatchPct(pts, d.kml, d.corridorKm);
      const b = computeCorridorPrecisionPct(pts, d.kml, d.corridorKm);
      // Identificación en vivo: la unidad va SOBRE el corredor (B ≥ umbral B del
      // contrato) y ya cubrió algo de la ruta (A > 0). A todavía puede estar por
      // debajo del umbral A del contrato porque el avance crece con el reloj.
      if (b >= d.corridorMinPct && a > 0) {
        candidates.push({
          occurrenceIdx: i,
          unitId: uid,
          score: Math.min(a, b),
          routeMatchPct: a,
          corridorPct: b,
          points: inWindow,
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

  const routes: MonitoreoRoute[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const o = filtered[i]!;
    const d = occData[i]!;
    const minutesToDeadline = Math.round((d.deadline.getTime() - now.getTime()) / 60_000);

    let state: MonitoreoState = "programada";
    let alertReason: string | null = null;
    let huella: TrackPoint[] = [];
    let currentPoint: TrackPoint | null = null;
    let arrivalAt: string | null = null;
    let coveragePct = 0;
    let corridorPct = 0;
    let matchedUnitId: string | null = null;

    if (d.closed) {
      // El árbitro ya emitió veredicto: la torre no calcula nada. Solo dibuja
      // la huella congelada (evidencia del hecho, cortada en la llegada — la
      // geocerca es la frontera de evidencia) y marca el servicio como cerrado.
      // El detalle del veredicto vive en Cumplimiento / el expediente.
      state = "cerrado";
      const fact = o.complianceFact!;
      arrivalAt = fact.observedArrivalAt?.toISOString() ?? null;

      if (fact.observedUnitId && o.trip) {
        const evidence = await repos.evidence.getPointsForTrip(o.trip.id);
        const cutoffMs = fact.observedArrivalAt?.getTime() ?? null;
        const unitTrace = evidence.filter(
          (p) =>
            p.unitId === fact.observedUnitId &&
            (cutoffMs === null || p.recordedAt.getTime() <= cutoffMs),
        );
        const onCorridor =
          d.kml.length >= 2
            ? unitTrace.filter(
                (p) =>
                  minDistanceToRouteKm({ lat: p.latitude, lng: p.longitude }, d.kml) <=
                  d.corridorKm,
              )
            : unitTrace;
        huella = downsample(
          onCorridor.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            at: p.recordedAt.toISOString(),
          })),
          150,
        );
      }
    } else {
      const match = assignedOcc.get(i) ?? null;

      if (match) {
        coveragePct = Math.round(match.routeMatchPct * 10) / 10;
        corridorPct = Math.round(match.corridorPct * 10) / 10;
        matchedUnitId = match.unitId;

        // Servicio abierto: no hay hecho todavía. La llegada en vivo se detecta
        // por entrada a la geocerca (frontera de evidencia).
        const entryDetected =
          d.geofence.length >= 3 ? findGeofenceEntry(match.points, d.geofence) : null;
        arrivalAt = entryDetected ? entryDetected.toISOString() : null;

        // Recortar al momento de llegada: el servicio terminó ahí.
        // No seguir transmitiendo GPS post-llegada (p. ej. casa del chofer).
        const servicePoints = entryDetected
          ? match.points.filter((p) => p.timestamp.getTime() <= entryDetected.getTime())
          : match.points;

        const onCorridor = servicePoints.filter(
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

        if (entryDetected) {
          state = "llego";
          // Marcador estático de llegada (último punto del servicio), NO la posición en vivo.
          const arrivalPt =
            servicePoints[servicePoints.length - 1] ??
            match.points.find((p) => p.timestamp.getTime() >= entryDetected.getTime()) ??
            null;
          currentPoint = arrivalPt
            ? {
                lat: arrivalPt.latitude,
                lng: arrivalPt.longitude,
                at: arrivalPt.timestamp.toISOString(),
              }
            : null;
        } else {
          const last = servicePoints[servicePoints.length - 1]!;
          currentPoint = {
            lat: last.latitude,
            lng: last.longitude,
            at: last.timestamp.toISOString(),
          };
          // Fuera del corredor = fuera del corredor de la política (kmlCorridorMeters),
          // sin factores inventados.
          const lastOffRoute =
            minDistanceToRouteKm({ lat: last.latitude, lng: last.longitude }, d.kml) >
            d.corridorKm;
          if (lastOffRoute) {
            state = "alerta";
            alertReason = "La unidad se salió del corredor de la ruta";
          } else if (match.routeMatchPct >= d.matchMinPct) {
            // "Avanzando" = ya alcanzó el umbral A del contrato.
            state = "avanzando";
          } else {
            state = "en_ruta";
          }
        }
      } else {
        // Sin unidad identificada: alerta solo cuando el deadline ya venció
        // (derivado del deadline y la ventana de la política, sin minutos
        // inventados). Antes del deadline sigue "programada".
        const started = now.getTime() >= d.windowStart.getTime();
        if (started && minutesToDeadline < 0) {
          state = "alerta";
          alertReason = "Sin unidad identificada y el turno ya venció";
        } else {
          state = "programada";
        }
      }
    }

    routes.push({
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
      matchedUnitId,
      matchedUnitLabel: matchedUnitId ? (unitLabelById.get(matchedUnitId) ?? null) : null,
      coveragePct,
      corridorPct,
      huella,
      currentPoint,
      arrivalAt,
    });
  }

  const stats = {
    total: routes.length,
    programada: routes.filter((r) => r.state === "programada").length,
    en_ruta: routes.filter((r) => r.state === "en_ruta").length,
    avanzando: routes.filter((r) => r.state === "avanzando").length,
    llego: routes.filter((r) => r.state === "llego").length,
    alerta: routes.filter((r) => r.state === "alerta").length,
    cerrado: routes.filter((r) => r.state === "cerrado").length,
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
