import { getRepos } from "@/lib/db";
import type { ContractPolicy, GpsPoint, OperationalScope } from "@jtel/domain";
import { JTTEL_TZ } from "@jtel/domain";
import { pairLedgerEntryWithFact } from "@jtel/db";
import {
  computeExclusiveContentionWindow,
  contarTurno,
  esExcepcion,
  limiteConTolerancia,
  margenMinutos,
  mayorHueco,
  titularDelTurno,
  type ConteoTurno,
  type EstadoServicio,
  type Hueco,
} from "@jtel/services";

/**
 * Cierre del turno — el resumen de un turno ya juzgado.
 *
 * Absorbe la pantalla que antes se llamaba Historial / Jornada: el mapa de
 * contraste sigue aquí, pero deja de ser la portada. La portada es el resultado
 * del turno; el mapa dibuja solo lo que tiene excepción y lo demás se enciende
 * a demanda.
 *
 * **Esta vista deriva de hechos ya sellados. Cargarla no verifica nada.** No
 * hay una sola llamada al motor en este archivo: se leen hechos, ledger y
 * puntos de evidencia ya anclados.
 *
 * Confidencialidad (Marco, Pieza 4): el cliente jamás ve la operación interna
 * del carrier. La línea base del mapa es el **trazado contratado**; el recorrido
 * real solo se dibuja donde el árbitro selló una unidad, y cortado en la
 * llegada a geocerca.
 */

/** Por qué no se pudo poner la medición de cobertura junto a este sello. */
export type CoberturaNoDisponible = {
  disponible: false;
  razon: "no_entry" | "ambiguous" | "out_of_tolerance" | "sin_paso";
};

export type CoberturaMedida = {
  disponible: true;
  pct: number;
  minimoPct: number;
  mayorHuecoMinutos: number | null;
  huecoMaximoPermitido: number | null;
};

export type Cobertura = CoberturaMedida | CoberturaNoDisponible;

export type ServicioDelCierre = {
  occurrenceId: string;
  profileCode: string;
  profileName: string;
  estado: EstadoServicio;
  timing: string | null;
  excepcion: boolean;
  unidadLabel: string | null;

  /** La marca de sellado. `versiones > 1` enciende el punto azul. */
  selladoEn: string | null;
  versiones: number;

  /** Llegada medida contra el límite que gobierna, ambos del hecho congelado. */
  llegadaEn: string | null;
  limiteEn: string | null;
  margenMinutos: number | null;

  /** Fidelidad del recorrido — solo existe donde el árbitro acreditó unidad. */
  matchPct: number | null;
  matchUmbralPct: number | null;

  cobertura: Cobertura;
  /** El silencio más largo de la ventana, descrito desde evidencia anclada. */
  hueco: { minutos: number; desdeEn: string; hastaEn: string } | null;
  ventanaMinutos: number | null;

  kmlWaypoints: Array<{ lat: number; lng: number }>;
  geofencePolygon: Array<{ lat: number; lng: number }>;
  gpsTrack: Array<{ lat: number; lng: number }>;
};

export type CierrePayload = {
  fecha: string;
  turnoId: string;
  turnoName: string;
  turnoStartTime: string;
  zonaHoraria: string;
  deadlineEn: string | null;
  toleranciaMinutos: number | null;
  titular: string;
  conteo: ConteoTurno;
  /** Ventanas con evidencia suficiente. Falta cuando el ledger no empareja. */
  ventanasConEvidencia: { medidas: number; suficientes: number } | null;
  excepciones: ServicioDelCierre[];
  limpios: ServicioDelCierre[];
};

const COBERTURA = "cobertura_evidencia";

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

type PasoLedger = { step?: string; details?: Record<string, unknown> };

function leerCobertura(steps: unknown): CoberturaMedida | null {
  if (!Array.isArray(steps)) return null;
  const paso = (steps as PasoLedger[]).find((s) => s?.step === COBERTURA);
  const d = paso?.details;
  if (!d) return null;
  const pct = Number(d.coveragePct);
  const minimo = Number(d.minCoveragePct);
  if (!Number.isFinite(pct) || !Number.isFinite(minimo)) return null;
  const gap = Number(d.maxGapMinutes);
  const gapMax = Number(d.maxGapMinutesAllowed);
  return {
    disponible: true,
    pct,
    minimoPct: minimo,
    mayorHuecoMinutos: Number.isFinite(gap) ? gap : null,
    huecoMaximoPermitido: Number.isFinite(gapMax) ? gapMax : null,
  };
}

export async function loadCierre(opts: {
  accountSlug: string;
  scope: OperationalScope;
  fecha: string;
  turnoId: string;
}): Promise<CierrePayload | null> {
  const repos = getRepos();
  const account = await repos.accounts.findBySlug(opts.accountSlug);
  if (!account) return null;

  const day = new Date(`${opts.fecha}T12:00:00.000Z`);
  const occs = await repos.occurrences.findForScope(opts.scope, day, day);
  const delTurno = occs.filter(
    (o) => o.serviceDate === opts.fecha && o.profile?.routeShift?.shiftId === opts.turnoId,
  );

  const shift = delTurno[0]?.profile?.routeShift?.shift;
  const primeraPolitica = (delTurno[0]?.contract?.policy ?? {}) as ContractPolicy;

  // ── Recorridos observados ────────────────────────────────────────────────
  // Solo de unidades que el árbitro acreditó. El inventario del carrier no
  // entra a esta respuesta ni siquiera para descartarlo.
  const observedUnitIds = new Set(
    delTurno.map((o) => o.complianceFact?.observedUnitId).filter((x): x is string => Boolean(x)),
  );
  const unitLabels = new Map<string, string>();
  const pointsByUnit = new Map<string, GpsPoint[]>();

  const carrierIds = [
    ...new Set(
      delTurno.map((o) => o.contract?.carrierAccountId).filter((x): x is string => Boolean(x)),
    ),
  ];

  for (const carrierId of carrierIds) {
    const suyas = delTurno.filter((o) => o.contract?.carrierAccountId === carrierId);
    const ventanas = suyas.map((o) =>
      computeExclusiveContentionWindow(o.expectedDeadline, (o.contract?.policy ?? {}) as ContractPolicy),
    );
    if (ventanas.length === 0) continue;
    const desde = new Date(Math.min(...ventanas.map((w) => w.startMs)));
    const hasta = new Date(Math.max(...ventanas.map((w) => w.endMs)));
    if (hasta.getTime() <= desde.getTime()) continue;

    const [unidades, equipos] = await Promise.all([
      repos.fleet.getUnitsForCarrier(carrierId),
      repos.fleet.getDevicesForCarrier(carrierId),
    ]);
    for (const u of unidades) if (observedUnitIds.has(u.id)) unitLabels.set(u.id, u.label);

    const imeiToUnit = new Map<string, string>();
    for (const d of equipos) {
      const a = await repos.fleet.resolveUnitAtTime(d.id, hasta);
      if (a?.unitId && observedUnitIds.has(a.unitId)) imeiToUnit.set(d.imei, a.unitId);
    }
    if (imeiToUnit.size === 0) continue;

    const telem = await repos.telemetry.getForImeis([...imeiToUnit.keys()], desde, hasta);
    for (const p of telem) {
      const unitId = p.unitId ?? imeiToUnit.get(p.imei);
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
    for (const [, pts] of pointsByUnit) pts.sort((a, b) => +a.timestamp - +b.timestamp);
  }

  // ── Un servicio a la vez ─────────────────────────────────────────────────
  const servicios: ServicioDelCierre[] = [];

  for (const o of delTurno) {
    const fact = o.complianceFact;
    const profile = o.profile;
    const policy = (o.contract?.policy ?? {}) as ContractPolicy;
    // El umbral que gobierna es el CONGELADO, no el vigente.
    const snapshot = (fact?.contractPolicySnapshot ?? policy) as ContractPolicy;

    const estado = (fact?.status ?? null) as EstadoServicio;
    const timing = fact?.timing ?? null;
    const excepcion = esExcepcion(estado, timing);

    const routeId = profile?.routeShift?.routeId;
    const kml = routeId
      ? await repos.routes.getKmlVersionForDate(routeId, o.expectedDeadline)
      : null;

    const observedUnitId = fact?.observedUnitId ?? null;
    const ventana = computeExclusiveContentionWindow(o.expectedDeadline, policy);

    let gpsTrack: Array<{ lat: number; lng: number }> = [];
    if (observedUnitId) {
      const llegada = fact?.observedArrivalAt ? +fact.observedArrivalAt : ventana.endMs;
      // La traza se corta en la llegada a geocerca. Lo que la unidad hizo
      // después no se muestra a nadie, en ninguna cara.
      const pts = (pointsByUnit.get(observedUnitId) ?? []).filter(
        (p) => +p.timestamp >= ventana.startMs && +p.timestamp <= llegada,
      );
      gpsTrack = downsample(pts.map((p) => ({ lat: p.latitude, lng: p.longitude })), 120);
    }

    // ── Cobertura: solo si la entrada del ledger es la que produjo ESTE sello
    let cobertura: Cobertura = { disponible: false, razon: "no_entry" };
    if (fact) {
      const entradas = await repos.compliance.getLedgerForOccurrence(o.id, {
        sinceMaterializedAt: fact.materializedAt,
      });
      const par = pairLedgerEntryWithFact(entradas, fact.materializedAt);
      if (par.paired) {
        cobertura = leerCobertura(par.entry.steps) ?? { disponible: false, razon: "sin_paso" };
      } else {
        cobertura = { disponible: false, razon: par.reason };
      }
    }

    // ── El hueco, descrito desde evidencia ya anclada ─────────────────────
    // Solo para las excepciones: es una lectura por servicio y no hace falta
    // pagarla por los que cerraron limpio.
    let hueco: Hueco | null = null;
    if (excepcion && o.trip?.id) {
      const inicio = o.trip.evidenceWindowStart ?? new Date(ventana.startMs);
      const fin = o.trip.evidenceWindowEnd ?? new Date(ventana.endMs);
      const puntos = await repos.evidence.getPointsForTrip(o.trip.id);
      hueco = mayorHueco(
        puntos.map((p) => ({ at: p.recordedAt })),
        { inicio, fin },
      );
    }

    const historia = fact ? await repos.compliance.getFactHistory(o.id) : [];
    const tolerancia = snapshot.toleranceMinutes ?? 0;
    const limite = fact ? limiteConTolerancia(fact.expectedDeadline, tolerancia) : null;

    servicios.push({
      occurrenceId: o.id,
      profileCode: profile?.code ?? "—",
      profileName: profile?.name ?? "—",
      estado,
      timing,
      excepcion,
      unidadLabel: observedUnitId ? (unitLabels.get(observedUnitId) ?? null) : null,
      selladoEn: fact?.materializedAt?.toISOString() ?? null,
      versiones: historia.length + (fact ? 1 : 0),
      llegadaEn: fact?.observedArrivalAt?.toISOString() ?? null,
      limiteEn: limite?.toISOString() ?? null,
      margenMinutos:
        fact?.observedArrivalAt && limite ? margenMinutos(fact.observedArrivalAt, limite) : null,
      matchPct: fact?.observedRouteMatchPct ?? null,
      matchUmbralPct: snapshot.kmlMatchMinPct ?? null,
      cobertura,
      hueco: hueco
        ? {
            minutos: hueco.minutos,
            desdeEn: hueco.desde.toISOString(),
            hastaEn: hueco.hasta.toISOString(),
          }
        : null,
      ventanaMinutos: (ventana.endMs - ventana.startMs) / 60_000,
      kmlWaypoints: downsample(kml?.waypoints ?? [], 90),
      geofencePolygon: normalizePolygon(profile?.geofence?.polygon),
      gpsTrack,
    });
  }

  const conteo = contarTurno(servicios.map((s) => ({ estado: s.estado, timing: s.timing })));

  // Línea secundaria: puede faltar sin romper la pantalla, por diseño.
  const medidas = servicios.filter((s) => s.cobertura.disponible);
  const ventanasConEvidencia =
    medidas.length === servicios.length && servicios.length > 0
      ? {
          medidas: medidas.length,
          suficientes: medidas.filter(
            (s) => s.cobertura.disponible && s.cobertura.pct >= s.cobertura.minimoPct,
          ).length,
        }
      : null;

  const orden = (s: ServicioDelCierre) =>
    s.estado === "no_cumplido" ? 0 : s.estado === "pendiente_evidencia" ? 1 : 2;

  return {
    fecha: opts.fecha,
    turnoId: opts.turnoId,
    turnoName: shift?.name ?? "Turno",
    turnoStartTime: String(shift?.startTime ?? "").slice(0, 5),
    zonaHoraria: primeraPolitica.timeZone ?? JTTEL_TZ,
    deadlineEn: delTurno[0]?.expectedDeadline?.toISOString() ?? null,
    toleranciaMinutos: primeraPolitica.toleranceMinutes ?? null,
    titular: titularDelTurno(conteo),
    conteo,
    ventanasConEvidencia,
    excepciones: servicios.filter((s) => s.excepcion).sort((a, b) => orden(a) - orden(b)),
    limpios: servicios
      .filter((s) => !s.excepcion)
      .sort((a, b) => (a.llegadaEn ?? "").localeCompare(b.llegadaEn ?? "")),
  };
}
