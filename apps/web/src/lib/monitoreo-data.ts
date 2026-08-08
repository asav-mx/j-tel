import { getRepos } from "@/lib/db";
import type {
  ContractPolicy,
  EtaBasis,
  GpsPoint,
  OperationalScope,
  RouteDurationSample,
} from "@jtel/domain";
import {
  computeEvidenceWindow,
  dayForDateQuery,
  haversineKm,
  localTimeHHMM,
  JTTEL_TZ,
  DEFAULT_FRECHET_MAX_KM,
} from "@jtel/domain";
import { edadSenalMinutos } from "@/lib/monitoreo-umbrales";
import { estimarLlegada } from "@/lib/monitoreo-eta";
import {
  cumulativeRouteFractions,
  evaluateUnitRouteMatch,
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
  /** Nombre de la geocerca destino (para tooltip en mapa). */
  geofenceName: string | null;
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
  /**
   * Hace cuánto se recibió el último punto GPS de esta unidad, en minutos.
   * Null si no hay unidad en vivo. Es la resta que la torre necesita para
   * decir "sin señal" por unidad: el heartbeat del sistema existe agregado
   * por carrier, y ese no distingue cuál unidad se calló.
   */
  signalAgeMinutes: number | null;
  /** Hora local del último punto GPS — la evidencia de la antigüedad de arriba. */
  lastSignalAt: string | null;
  /**
   * Kilómetros que faltan del trazado CONTRATADO, medidos sobre el trazado
   * mismo y no en línea recta: la recta al destino miente a la baja.
   * Null si no hay unidad, si ya llegó, o si no hay KML contra el cual medir.
   */
  remainingKm: number | null;
  /**
   * Certeza de la asociación unidad↔ruta. Mientras el turno corre la
   * asociación se recalcula en cada lectura: es inferencia en formación, y se
   * declara `probable`. Las cerradas traen su unidad del hecho congelado y van
   * SIN etiqueta — `confirmada` es palabra del acta, no de la torre.
   */
  certeza: "probable" | null;
  /**
   * Minutos entre la llegada y SU deadline: negativo antes, positivo después.
   * Null si no ha llegado. La tira de llegadas se dibuja sobre este delta y no
   * sobre la hora del reloj, porque cada ruta trae su propio deadline y un eje
   * de horas absolutas mezclaría plazos distintos en la misma pista.
   */
  arrivalDeltaMinutes: number | null;
  /**
   * Holgura del contrato en minutos (`verificationGraceMinutes`). Es el umbral
   * que la tira dibuja al lado de la llegada — el dato nunca va sin su lectura.
   */
  graceMinutes: number;
  /**
   * Llegada ESTIMADA (hora local) — inferencia, no medición. Null cuando no se
   * puede estimar sin inventar: sin unidad, con señal vieja, ya llegada o
   * cerrada. No confundir con `arrivalAt`, que es la entrada real a la
   * geocerca.
   */
  etaAt: string | null;
  /** Minutos que faltan según esa estimación. Null cuando `etaAt` es null. */
  etaMinutes: number | null;
  /** De dónde salió la estimación. Viaja con el número para que se pueda decir. */
  etaBasis: EtaBasis | null;
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
  /**
   * El turno está corriendo AHORA: alguna ocurrencia tiene a `now` dentro de
   * su ventana de evidencia sin truncar. Es la misma ventana del árbitro, no
   * un horario aparte — así la torre y el acta no pueden discrepar sobre
   * cuándo estaba en vuelo un turno.
   */
  enVuelo: boolean;
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

/**
 * Dónde va la unidad sobre el trazado contratado: qué fracción lleva recorrida
 * y cuántos kilómetros le faltan.
 *
 * Se proyecta el punto al waypoint más cercano del KML y se mide lo que queda
 * de ahí al destino SOBRE el trazado. La alternativa —línea recta al
 * destino— miente a la baja: dice 3 km cuando por calle faltan 7.
 *
 * La fracción se devuelve además de los kilómetros porque la llegada estimada
 * la necesita: los km dicen cuánto falta de camino, la fracción dice cuánto de
 * la ruta, y una duración típica se reparte por fracción, no por distancia.
 */
function avanceSobreRuta(
  punto: LatLng,
  kml: LatLng[],
): { avanceFraccion: number; restanteKm: number } | null {
  if (kml.length < 2) return null;

  let totalKm = 0;
  for (let i = 1; i < kml.length; i++) {
    totalKm += haversineKm(kml[i - 1]!.lat, kml[i - 1]!.lng, kml[i]!.lat, kml[i]!.lng);
  }
  if (totalKm <= 0) return null;

  let masCercano = 0;
  let mejorKm = Number.POSITIVE_INFINITY;
  for (let i = 0; i < kml.length; i++) {
    const d = haversineKm(punto.lat, punto.lng, kml[i]!.lat, kml[i]!.lng);
    if (d < mejorKm) {
      mejorKm = d;
      masCercano = i;
    }
  }

  // Fracción acumulada del árbitro, para que "avance sobre la ruta" signifique
  // lo mismo aquí y en la verificación.
  const avance = cumulativeRouteFractions(kml)[masCercano] ?? 0;
  return {
    avanceFraccion: avance,
    restanteKm: Math.max(0, Math.round(totalKm * (1 - avance) * 10) / 10),
  };
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]!);
  return out;
}

/** Acepta {lat,lng} o variantes comunes al leer jsonb. */
function normalizePolygon(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const rec = p as Record<string, unknown>;
    const lat = Number(rec.lat ?? rec.latitude);
    const lng = Number(rec.lng ?? rec.longitude ?? rec.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
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

  const day = dayForDateQuery(opts.fecha);
  const occurrences = await repos.occurrences.findForScope(opts.scope, day, day);
  const filtered = occurrences.filter(
    (o) =>
      o.serviceDate === opts.fecha &&
      o.profile?.routeShift?.shiftId === opts.turnoId,
  );

  const shift = filtered[0]?.profile?.routeShift?.shift;
  const turnoName = shift?.name ?? "Turno";
  const turnoStartTime = String(shift?.startTime ?? "").slice(0, 5);

  // Geocercas del alcance (fallback). Preferimos la del perfil cargada con la
  // ocurrencia: así Monitoreo muestra exactamente la misma geocerca que usa el
  // árbitro, aunque el dueño del polígono no esté en findForScope.
  const scopeGeofences = await repos.geofences.findForScope(opts.scope, account.id);
  const geofenceById = new Map<string, { polygon: LatLng[]; name: string }>();
  for (const g of scopeGeofences) {
    const poly = normalizePolygon(g.polygon);
    if (poly.length >= 3) {
      geofenceById.set(g.id, { polygon: poly, name: g.name });
    }
  }

  // KML + política + geocerca por ocurrencia.
  type OccData = {
    kml: LatLng[];
    corridorKm: number;
    geofence: LatLng[];
    geofenceName: string | null;
    deadline: Date;
    windowStart: Date;
    /** Techo de la ventana: min(now, deadline + gracia + margen después). */
    windowEnd: Date;
    /** La misma ventana SIN truncar a `now` — para saber si el turno va en vuelo. */
    windowEndFull: Date;
    /** Umbral A de la política (kmlMatchMinPct) — mismo default del motor. */
    matchMinPct: number;
    frechetMaxKm: number;
    /** Umbral B de la política (kmlCorridorMinPct) — mismo default del motor. */
    corridorMinPct: number;
    /** Holgura de la política, en minutos — el umbral que la tira dibuja. */
    graceMinutes: number;
    /** Velocidad promedio contratada (km/h) — el arranque en frío de la estimación. */
    avgSpeedKmh: number;
    /** Ruta×turno: la llave de la historia de duraciones de esta ruta. */
    routeShiftId: string | null;
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
    const { windowEnd: windowEndFull } = computeEvidenceWindow(o.expectedDeadline, {
      evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
      verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
      evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
    });
    const profileGeo = o.profile?.geofence;
    const fromProfile = profileGeo ? normalizePolygon(profileGeo.polygon) : [];
    const fromScope = geofenceById.get(o.profile?.geofenceId ?? "");
    const geofence =
      fromProfile.length >= 3 ? fromProfile : (fromScope?.polygon ?? []);
    const geofenceName =
      fromProfile.length >= 3
        ? (profileGeo?.name ?? null)
        : (fromScope?.name ?? null);
    occData.push({
      kml,
      corridorKm,
      geofence,
      geofenceName,
      deadline: o.expectedDeadline,
      windowStart,
      windowEnd,
      windowEndFull,
      matchMinPct: policy.kmlMatchMinPct ?? 60,
      frechetMaxKm: policy.frechetMaxKm ?? DEFAULT_FRECHET_MAX_KM,
      corridorMinPct: policy.kmlCorridorMinPct ?? 60,
      graceMinutes: policy.verificationGraceMinutes ?? 15,
      // El mismo default del motor: 20 km/h, ruta de recolección de personal
      // con paradas, no flujo libre.
      avgSpeedKmh: policy.routeAvgSpeedKmh ?? 20,
      routeShiftId: o.profile?.routeShift?.id ?? null,
      carrierAccountId: o.contract?.carrierAccountId ?? null,
      closed: Boolean(o.complianceFact),
    });
  }

  // ── Historia de duraciones, para la llegada estimada ────────────────────
  // Las catorce rutas del turno en UNA consulta. De a una serían catorce viajes
  // más a la base en una pantalla que ya carga de más.
  //
  // Solo se piden las de servicios ABIERTOS: un servicio cerrado no se estima.
  const muestrasPorRutaTurno = await repos.routeTraversals.recentSamplesForRouteShifts(
    occData
      .filter((d) => !d.closed)
      .map((d) => d.routeShiftId)
      .filter((x): x is string => !!x),
  );

  // ── Labels de unidades (TODOS los carriers) ─────────────────────────────
  // Se cargan labels de todos los carriers (abiertos y cerrados) porque las
  // cerradas necesitan etiquetar su unidad observada (del hecho congelado).
  // Las labels son de uso INTERNO: solo salen en la respuesta para unidades
  // que resulten observadas o emparejadas. El inventario completo del
  // carrier NUNCA llega al cliente (Marco Pieza 4).
  const unitLabelById = new Map<string, string>();
  const unitCarrierById = new Map<string, string>();
  const pointsByUnit = new Map<string, GpsPoint[]>();
  const allCarrierIds = [
    ...new Set(
      occData
        .map((d) => d.carrierAccountId)
        .filter((x): x is string => !!x),
    ),
  ];
  for (const carrierId of allCarrierIds) {
    const carrierUnits = await repos.fleet.getUnitsForCarrier(carrierId);
    for (const u of carrierUnits) {
      unitLabelById.set(u.id, u.label);
      unitCarrierById.set(u.id, carrierId);
    }
  }

  // ── Telemetría en vivo (solo carriers con ocurrencias ABIERTAS) ─────────
  // Las cerradas usan la evidencia congelada del viaje, no telemetría en
  // vivo. Se carga la flota COMPLETA del carrier internamente porque el
  // motor de emparejamiento necesita evaluar todas las candidatas antes de
  // saber cuál ganó. Solo las emparejadas salen en la respuesta — las
  // candidatas descartadas nunca llegan al cliente.
  const openCarrierIds = [
    ...new Set(
      occData
        .filter((d) => !d.closed)
        .map((d) => d.carrierAccountId)
        .filter((x): x is string => !!x),
    ),
  ];

  for (const carrierId of openCarrierIds) {
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

    const devices = await repos.fleet.getDevicesForCarrier(carrierId);

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
      // Misma identificación unidad↔ruta que el árbitro (@jtel/verification):
      // la torre NO mantiene una segunda matemática del match. Evaluada sobre
      // la ventana truncada a `now`; umbrales de la política del contrato.
      const evalRes = evaluateUnitRouteMatch(pts, {
        kmlWaypoints: d.kml,
        geofencePolygon: d.geofence,
        corridorKm: d.corridorKm,
        minKmlPct: d.matchMinPct,
        minCorridorPct: d.corridorMinPct,
        // C12 · el comentario de arriba decía «umbrales de la política del
        // contrato» sobre un 0.8 horneado. Ahora es verdad también para éste.
        frechetMaxKm: d.frechetMaxKm,
        idf: null,
      });
      const a = evalRes.routeMatchPct;
      const b = evalRes.corridorPrecisionPct;
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
    let arrivalDate: Date | null = null;
    let coveragePct = 0;
    let corridorPct = 0;
    let matchedUnitId: string | null = null;
    let transcurridoMinutos: number | null = null;

    if (d.closed) {
      // El árbitro ya emitió veredicto: la torre no calcula nada. Solo dibuja
      // la huella congelada (evidencia del hecho, cortada en la llegada — la
      // geocerca es la frontera de evidencia) y marca el servicio como cerrado.
      // El detalle del veredicto vive en Cumplimiento / el expediente.
      state = "cerrado";
      const fact = o.complianceFact!;
      // Unidad observada del hecho congelado — la planta SÍ la ve
      // (es la verdad operativa del servicio que pagó).
      matchedUnitId = fact.observedUnitId ?? null;
      arrivalDate = fact.observedArrivalAt ?? null;
      arrivalAt = arrivalDate ? localTimeHHMM(arrivalDate, JTTEL_TZ) : null;

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
        arrivalDate = entryDetected;
        arrivalAt = entryDetected ? localTimeHHMM(entryDetected, JTTEL_TZ) : null;

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

        // Cuánto lleva andando ESTE viaje: del primer punto en corredor al
        // último. Se mide sobre el corredor y no sobre todos los puntos porque
        // antes de entrar al trazado la unidad no había empezado la ruta, y
        // contar ese tiempo inflaría el ritmo observado con minutos de patio.
        const primero = onCorridor[0];
        const ultimo = onCorridor[onCorridor.length - 1];
        transcurridoMinutos =
          primero && ultimo && ultimo.timestamp.getTime() > primero.timestamp.getTime()
            ? (ultimo.timestamp.getTime() - primero.timestamp.getTime()) / 60_000
            : null;

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

    // La resta que la torre necesita y el heartbeat agregado por carrier no da:
    // hace cuánto se calló ESTA unidad. La ley de cuándo preguntarlo vive en
    // `edadSenalMinutos`, aparte y probada: después de la geocerca no hay señal
    // que esperar, porque ahí se corta la evidencia a propósito.
    const puntoVivo = d.closed || state === "llego" ? null : currentPoint;
    const signalAgeMinutes = edadSenalMinutos({
      cerrado: d.closed,
      llego: state === "llego",
      ultimoPuntoAt: currentPoint?.at ?? null,
      ahora: now,
    });

    // Dónde va sobre el trazado. Los km alimentan el renglón; la fracción,
    // la estimación de llegada.
    const avance =
      puntoVivo && state !== "llego"
        ? avanceSobreRuta({ lat: puntoVivo.lat, lng: puntoVivo.lng }, d.kml)
        : null;

    // La llegada estimada — inferencia, y la ley de cuándo NO estimarla vive
    // aparte y probada en `monitoreo-eta`. Aquí solo se le entregan los hechos.
    const estimacion = estimarLlegada({
      cerrado: d.closed,
      llego: state === "llego",
      edadSenalMinutos: signalAgeMinutes,
      avanceFraccion: avance?.avanceFraccion ?? null,
      restanteKm: avance?.restanteKm ?? null,
      transcurridoMinutos,
      muestras: d.routeShiftId
        ? (muestrasPorRutaTurno.get(d.routeShiftId) ?? ([] as RouteDurationSample[]))
        : [],
      avgSpeedKmh: d.avgSpeedKmh,
    });

    routes.push({
      occurrenceId: o.id,
      profileCode: o.profile?.code ?? "?",
      profileName: o.profile?.name ?? "?",
      colorIndex: i % PALETTE_SIZE,
      state,
      alertReason,
      expectedDeadline: localTimeHHMM(d.deadline, JTTEL_TZ),
      minutesToDeadline,
      kmlWaypoints: downsample(d.kml, 120),
      geofencePolygon: d.geofence,
      geofenceName: d.geofenceName,
      matchedUnitId,
      matchedUnitLabel: matchedUnitId ? (unitLabelById.get(matchedUnitId) ?? null) : null,
      coveragePct,
      corridorPct,
      huella,
      currentPoint,
      arrivalAt,
      signalAgeMinutes,
      lastSignalAt: puntoVivo ? localTimeHHMM(new Date(puntoVivo.at), JTTEL_TZ) : null,
      // Ya llegó = no falta camino. Sin unidad = no hay desde dónde medir.
      remainingKm: avance?.restanteKm ?? null,
      certeza: !d.closed && matchedUnitId ? "probable" : null,
      arrivalDeltaMinutes: arrivalDate
        ? Math.round((arrivalDate.getTime() - d.deadline.getTime()) / 60_000)
        : null,
      etaAt: estimacion
        ? localTimeHHMM(new Date(now.getTime() + estimacion.minutosRestantes * 60_000), JTTEL_TZ)
        : null,
      etaMinutes: estimacion?.minutosRestantes ?? null,
      etaBasis: estimacion?.base ?? null,
      graceMinutes: d.graceMinutes,
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

  // Incluir unidades observadas de ocurrencias cerradas (su unidad viene
  // del hecho congelado, no del emparejamiento en vivo).
  for (const route of routes) {
    if (route.matchedUnitId) usedUnits.add(route.matchedUnitId);
  }

  // Solo unidades observadas/emparejadas — el inventario completo del
  // carrier NUNCA llega a la respuesta (Marco Pieza 4).
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
    generatedAt: localTimeHHMM(now, JTTEL_TZ),
    // En vuelo = `now` cae dentro de la ventana de evidencia SIN truncar de
    // alguna ocurrencia. No se compara contra la hora de inicio del turno: la
    // ventana abre antes y cierra después, y es la que el árbitro va a usar.
    enVuelo: occData.some(
      (d) =>
        !d.closed &&
        now.getTime() >= d.windowStart.getTime() &&
        now.getTime() <= d.windowEndFull.getTime(),
    ),
    routes,
    stats,
    units,
  };
}
