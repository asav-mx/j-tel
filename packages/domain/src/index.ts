import { z } from "zod";
import {
  deriveObservationWindow,
  type DerivedObservationWindow,
} from "./ventana-observacion.js";

// ── Zona horaria ────────────────────────────────────────────────────────
/**
 * Zona horaria por defecto del despliegue j-tel.
 * Usar solo cuando no hay un contrato en contexto (vistas multi-contrato,
 * dashboard J-Staff, cron jobs del sistema).
 * Para vistas de un contrato específico, usar `contract.policy.timeZone`.
 */
export const JTTEL_TZ = "America/Ciudad_Juarez";

/**
 * Fecha civil YYYY-MM-DD en la zona indicada.
 * Esta es LA función canónica para resolver "qué día es" — no duplicar.
 */
export function localDateIso(now = new Date(), timeZone = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
/** Desplazamiento de una zona respecto a UTC, en ms, para un instante dado. */
function desplazamientoMs(instante: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  return (
    Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) -
    instante.getTime()
  );
}

/**
 * Una fecha civil y unos minutos desde su medianoche, en una zona, al instante
 * real que les corresponde.
 *
 * Esta es LA función canónica para ir de "tal día a tal hora, allá" a un
 * instante — la pareja que faltaba de `localDateIso` y `dayForDateQuery`.
 *
 * **Nunca construir estas fechas a mano.** `new Date(\`${fecha}T00:00:00\`)`,
 * sin marca de zona, se resuelve en la zona del proceso que corre: el mismo
 * código da un instante en una laptop y otro seis horas distinto en Vercel.
 * Ese fue el bug que produjo 294 hechos sellados con la hora equivocada, con
 * un solo cumplido entre ellos.
 *
 * `minutos` puede ser negativo o pasar de 1440: se interpreta como
 * desplazamiento desde la medianoche civil y puede caer en otro día.
 *
 * Dos pasadas a propósito: la primera conjetura el desplazamiento con la hora
 * equivocada, la segunda lo corrige. Sin eso, los dos días del año en que
 * cambia el horario salen con una hora de error.
 */
export function instanteZonificado(
  fechaIso: string,
  minutos: number,
  timeZone: string = JTTEL_TZ,
): Date {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split("-").map(Number);
  const civil = Date.UTC(anio!, mes! - 1, dia!, 0, 0, 0) + minutos * 60_000;
  const primera = civil - desplazamientoMs(new Date(civil), timeZone);
  return new Date(civil - desplazamientoMs(new Date(primera), timeZone));
}

/**
 * Construye la fecha de consulta para `findForScope` y funciones similares
 * a partir de una cadena YYYY-MM-DD.
 *
 * Usa mediodía UTC (T12:00:00.000Z) — no medianoche — porque el cambio de
 * día UTC cruza la tarde civil de Juárez (18:00 h del día anterior cuando
 * el reloj marca 00:00 UTC). Mediodía UTC = 06:00 Juárez en verano y
 * 05:00 Juárez en invierno: siempre el mismo día civil en cualquier zona
 * entre UTC-12 y UTC+12.
 *
 * Es la pareja canónica de `localDateIso`:
 *   `string → Date`  (esta función, para armar consultas a la BD)
 *   `Date → string`  (`localDateIso`, para resolver "qué día es")
 */
export function dayForDateQuery(fechaIso: string): Date {
  return new Date(`${fechaIso}T12:00:00.000Z`);
}

/**
 * Devuelve las fechas civiles YYYY-MM-DD en [fromIso, toIso] cuyo día de la
 * semana (0=Dom … 6=Sáb) esté en `activeDays`.
 *
 * Itera sobre strings de fecha civil — el DOW y el string salen del mismo
 * calendario. Usa mediodía UTC para derivar el DOW: nunca cruza cambio de día
 * entre UTC-12 y UTC+12, por lo que getUTCDay() es siempre el día civil correcto.
 */
export function civilDatesInRange(
  fromIso: string,
  toIso: string,
  activeDays: number[],
): string[] {
  const result: string[] = [];
  let current = fromIso;
  while (current <= toIso) {
    if (activeDays.includes(new Date(`${current}T12:00:00.000Z`).getUTCDay()))
      result.push(current);
    const d = new Date(`${current}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    current = d.toISOString().slice(0, 10);
  }
  return result;
}

/**
 * Suma `days` días a una fecha civil YYYY-MM-DD y devuelve el resultado como string.
 *
 * Ancla mediodía UTC — mismo principio que `dayForDateQuery` y `civilDatesInRange`.
 * Usa `setUTCDate`/`getUTCDate` para que la aritmética sea puramente UTC:
 * cero `setHours`, cero dependencia del runtime TZ.
 */
export function addDaysIso(fechaIso: string, days: number): string {
  const d = new Date(`${fechaIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Formatea un timestamp como "HH:MM" (24h) en la zona indicada.
 * Para UI: deadlines, llegadas, ventanas, tooltips del mapa.
 */
export function localTimeHHMM(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/**
 * Formatea un timestamp como "YYYY-MM-DD HH:MM" en la zona indicada.
 * Para UI: tablas, expedientes, CSV.
 */
export function localDateTimeShort(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return `${localDateIso(d, timeZone)} ${localTimeHHMM(d, timeZone)}`;
}
// ─────────────────────────────────────────────────────────────────────────

export const AccountType = z.enum(["carrier", "client", "jstaff"]);
export type AccountType = z.infer<typeof AccountType>;

export const ComplianceStatus = z.enum([
  "cumplido",
  "no_cumplido",
  "pendiente_evidencia",
]);
export type ComplianceStatus = z.infer<typeof ComplianceStatus>;

export const TimingStatus = z.enum(["temprano", "a_tiempo", "tarde"]);
export type TimingStatus = z.infer<typeof TimingStatus>;

export const EvidenceStatus = z.enum([
  "disponible",
  "parcial",
  "en_espera",
  "indisponible",
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const RouteStrictness = z.enum(["destino_only", "kml_full"]);
export type RouteStrictness = z.infer<typeof RouteStrictness>;

export const GeofenceRole = z.enum([
  "destino",
  "base",
  "caseta",
  "otro",
]);
export type GeofenceRole = z.infer<typeof GeofenceRole>;

export const GeofenceOwnerType = z.enum(["plant", "plant_group", "carrier"]);
export type GeofenceOwnerType = z.infer<typeof GeofenceOwnerType>;

export const JStaffRole = z.enum(["admin_plataforma", "soporte", "comercial"]);
export type JStaffRole = z.infer<typeof JStaffRole>;

export const ClientRole = z.enum([
  "admin_corporativo",
  "coord_rutas",
  "cumplimiento",
  "inspecciones",
  "procurement",
  "usuario_planta",
]);
export type ClientRole = z.infer<typeof ClientRole>;

export const CarrierRole = z.enum([
  "admin",
  "coordinador",
  "despacho",
  "mantenimiento",
  "chofer",
]);
export type CarrierRole = z.infer<typeof CarrierRole>;

export const ScopeType = z.enum([
  "global",
  "account",
  "plant",
  "plant_group",
  "contract",
  "fleet",
]);
export type ScopeType = z.infer<typeof ScopeType>;

export const EnforcementType = z.enum([
  "no_pago_viaje",
  "rebate_escalonado",
  "reembolso",
]);
export type EnforcementType = z.infer<typeof EnforcementType>;

export const ExcusableReason = z.enum([
  "lluvia_nieve",
  "marchas",
  "obstruccion",
  "falla_mecanica",
  "ponchadura",
  "obra_sin_aviso",
]);
export type ExcusableReason = z.infer<typeof ExcusableReason>;

export const ContractStatus = z.enum(["draft", "demo", "active", "suspended"]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const InspectionStatus = z.enum([
  "pendiente",
  "en_progreso",
  "completada",
  "requiere_accion",
]);
export type InspectionStatus = z.infer<typeof InspectionStatus>;

export const MaintenanceStatus = z.enum([
  "programado",
  "en_progreso",
  "completado",
  "vencido",
]);
export type MaintenanceStatus = z.infer<typeof MaintenanceStatus>;

export const NotificationType = z.enum([
  "tarde",
  "sin_evidencia",
  "reporte_listo",
  "requiere_revision",
  "inspeccion",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const enforcementRulesSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("no_pago_viaje"),
    toleranceMinutes: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("rebate_escalonado"),
    toleranceMinutes: z.number().int().positive(),
    baseRebatePercent: z.number(),
    baseFailureCount: z.number().int().positive(),
    additionalRebatePercent: z.number(),
  }),
  z.object({
    type: z.literal("reembolso"),
    amount: z.number().optional(),
  }),
]);

export type EnforcementRules = z.infer<typeof enforcementRulesSchema>;

export const contractPolicySchema = z.object({
  toleranceMinutes: z.number().int().nonnegative(),
  /** Minutos antes del inicio del turno en que debe estar en geocerca (deadline). */
  arrivalAnticipationMinutes: z.number().int().nonnegative().default(15),
  /**
   * Minutos DESPUÉS del inicio del turno en que el turno se sella.
   *
   * El cierre lo define el contrato, no la última llegada: una unidad que llega
   * después de esta hora no retrasa el cierre — el turno se sella igual y ese
   * servicio carga su propio veredicto.
   *
   * Opcional a propósito. La política vive dentro de `contract_policy_snapshot`
   * (jsonb), así que los hechos sellados antes de que existiera esta perilla
   * simplemente no traen la llave y siguen siendo válidos. La pantalla trata la
   * ausencia como "turno histórico sin hora de cierre" y lo dice; nunca inventa
   * una hora. Ver `docs/DESPUES.md` — hoy la ausencia no distingue "no existía
   * la perilla" de "nadie la configuró".
   */
  shiftCloseMinutesAfterStart: z.number().int().nonnegative().optional(),
  verificationGraceMinutes: z.number().int().nonnegative().default(15),
  routeStrictness: RouteStrictness,
  /**
   * % mínimo de waypoints del KML que deben tener un punto GPS cerca
   * (métrica A: cobertura de ruta). 0–100. Solo aplica si hay KML.
   */
  kmlMatchMinPct: z.number().min(0).max(100).default(60),
  /**
   * Radio del corredor KML en metros (default 120). Antes era 500 fijo.
   * Aplica a métricas A (cobertura de ruta) y B (precisión de corredor).
   */
  kmlCorridorMeters: z.number().min(10).max(500).default(120),
  /**
   * % mínimo de puntos GPS de la unidad que deben caer dentro del corredor
   * (métrica B: precisión). Un match exige A ≥ kmlMatchMinPct Y B ≥ este umbral.
   */
  kmlCorridorMinPct: z.number().min(0).max(100).default(60),
  /**
   * Fracción máxima de la ruta (0–1, medida desde el origen por distancia
   * acumulada del KML) que puede quedar sin ningún punto de evidencia
   * cercano antes de que el motor renuncie a dictar `no_cumplido`. Si el
   * punto de evidencia más temprano que coincide con el KML cae más allá de
   * esta fracción, el origen de la ruta se considera no observado y el
   * resultado es `pendiente_evidencia` — Ley 1: un problema de observación
   * (la ventana no alcanzó a cubrir el arranque de la ruta) nunca se
   * convierte en veredicto. Default 0.15 (15% inicial de la ruta).
   */
  kmlOriginToleranceFraction: z.number().min(0).max(1).default(0.15),
  excusableReasons: z.array(ExcusableReason).default([]),
  enforcementRules: z.array(enforcementRulesSchema).default([]),
  /**
   * Ventana de observación GPS: empieza AL MENOS N min antes del deadline
   * (ej. 60 → 5:45 si deadline 6:45). Es el **piso**, no el ancho final: si la
   * ruta dura más que esto, la ventana se abre antes — ver
   * `deriveObservationWindow` y las perillas de abajo.
   */
  evidenceMarginMinutesBefore: z.number().int().nonnegative().default(60),
  evidenceMarginMinutesAfter: z.number().int().nonnegative().default(30),
  /**
   * Dimensionar la ventana con la duración real de la ruta. Apagarlo devuelve
   * la ventana de política tal cual (`evidenceMarginMinutesBefore` fijo) — es
   * el interruptor de emergencia, no una perilla de afinación.
   */
  windowDerivationEnabled: z.boolean().default(true),
  /** Holgura (%) sobre la duración de la ruta al dimensionar la ventana. */
  windowSlackPct: z.number().min(0).max(200).default(25),
  /**
   * Velocidad promedio (km/h) para estimar la duración de una ruta sin
   * historia medida. Ruta con paradas, no flujo libre.
   */
  routeAvgSpeedKmh: z.number().positive().default(20),
  /** Techo del lado "antes" (min): una medición loca no abre una ventana absurda. */
  maxWindowBeforeMinutes: z.number().int().positive().default(360),
  /** Percentil de las duraciones históricas: la ventana cubre el día lento. */
  routeDurationPercentile: z.number().min(1).max(100).default(90),
  /** Mediciones mínimas para creerle a la historia de una ruta. */
  routeDurationMinSamples: z.number().int().positive().default(3),
  /** Duración máxima esperada del recorrido de recolección (min). */
  maxRouteDurationMinutes: z.number().int().positive().default(60),
  /**
   * Cobertura temporal mínima (%) de la ventana de servicio para poder emitir
   * no_cumplido. Por debajo → pendiente_evidencia. Default 80 (Fase 1).
   */
  evidenceMinCoveragePct: z.number().min(0).max(100).default(80),
  /**
   * Hueco continuo máximo (minutos) permitido en la ventana de servicio.
   * Si el hueco es mayor → pendiente_evidencia. Default 10.
   */
  evidenceMaxGapMinutes: z.number().int().positive().default(10),
  /**
   * Permitir consolidación de rutas: una unidad puede cubrir varias rutas del
   * turno (situaciones de fuerza operativa). El recorrido mínimo de cada ruta
   * sigue siendo obligatorio. Default false (exclusividad).
   */
  permitirConsolidacion: z.boolean().default(false),
  /**
   * Zona horaria IANA del contrato. Todas las horas de este contrato
   * (deadline, ventana, llegada, reportes) se muestran en esta zona.
   * Default: America/Ciudad_Juarez (zona actual de operación).
   */
  timeZone: z.string().default("America/Ciudad_Juarez"),
});

export type ContractPolicy = z.infer<typeof contractPolicySchema>;

/** Parsea "HH:MM" o "HH:MM:SS" a minutos desde medianoche. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Deadline = inicio del turno − anticipación de llegada (contrato).
 *
 * `timeZone` es la del contrato; sin ella cae a la del despliegue. **No es
 * opcional por comodidad**: la hora del turno es una hora civil del lugar
 * donde opera el carrier, y resolverla sin zona explícita hace que el
 * resultado dependa de en qué máquina corrió el generador. Ver
 * `instanteZonificado`.
 */
export function computeExpectedDeadline(
  serviceDate: string,
  shiftStartTime: string,
  arrivalAnticipationMinutes: number,
  timeZone: string = JTTEL_TZ,
): Date {
  const minutes = parseTimeToMinutes(shiftStartTime) - arrivalAnticipationMinutes;
  return instanteZonificado(serviceDate, minutes, timeZone);
}

/** Lo que la política aporta al dimensionar la ventana. */
export type EvidenceWindowPolicy = Pick<
  ContractPolicy,
  "evidenceMarginMinutesBefore" | "verificationGraceMinutes" | "evidenceMarginMinutesAfter"
> &
  Partial<
    Pick<
      ContractPolicy,
      | "windowDerivationEnabled"
      | "windowSlackPct"
      | "routeAvgSpeedKmh"
      | "maxWindowBeforeMinutes"
    >
  >;

/** Los hechos de la ruta que permiten dimensionar la ventana. */
export type EvidenceWindowRoute = {
  /** p90 de las duraciones ya medidas de esta ruta×turno (min). */
  measuredDurationMinutes?: number | null;
  /** Largo del trazado (km), para el arranque en frío sin historia. */
  routeLengthKm?: number | null;
  /** Trazado, si el largo no viene calculado. */
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
};

/**
 * Ventana de observación de una ocurrencia.
 *
 * **Sin el tercer argumento el resultado es el de siempre**, minuto por
 * minuto: `evidenceMarginMinutesBefore` antes del deadline, gracia + margen
 * después. Así los llamadores que no saben nada de la ruta —la torre en vivo,
 * la ficha de servicio, la corrección de deadlines— no cambian de
 * comportamiento por este arreglo.
 *
 * Cuando quien llama SÍ conoce la ruta (la generación de ocurrencias, que
 * tiene el KML y la historia de mediciones en la mano), el lado de "antes" se
 * deriva de cuánto dura de verdad ese recorrido, y el margen de política pasa
 * a ser el piso. La ventana solo puede ensancharse, nunca angostarse.
 */
export function computeEvidenceWindow(
  deadline: Date,
  policy: EvidenceWindowPolicy,
  route?: EvidenceWindowRoute,
): DerivedObservationWindow {
  const afterMinutes =
    policy.verificationGraceMinutes + policy.evidenceMarginMinutesAfter;
  const derivationOff = policy.windowDerivationEnabled === false;

  return deriveObservationWindow(deadline, {
    minBeforeMinutes: policy.evidenceMarginMinutesBefore,
    afterMinutes,
    maxBeforeMinutes: policy.maxWindowBeforeMinutes,
    slackPct: policy.windowSlackPct,
    avgSpeedKmh: policy.routeAvgSpeedKmh,
    measuredDurationMinutes: derivationOff ? null : route?.measuredDurationMinutes,
    routeLengthKm: derivationOff ? null : route?.routeLengthKm,
    kmlWaypoints: derivationOff ? undefined : route?.kmlWaypoints,
  });
}

export const createContractSchema = z
  .object({
    carrierAccountId: z.string().uuid(),
    clientAccountId: z.string().uuid(),
    plantId: z.string().uuid().optional(),
    plantGroupId: z.string().uuid().optional(),
    name: z.string().min(1),
    /** Inicio de vigencia comercial (YYYY-MM-DD). */
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Fin de vigencia comercial (YYYY-MM-DD), inclusive. */
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    policy: contractPolicySchema,
    status: ContractStatus.default("draft"),
  })
  .refine(
    (data) => (data.plantId && !data.plantGroupId) || (!data.plantId && data.plantGroupId),
    { message: "Debe especificar planta o grupo de plantas, no ambos" },
  )
  .refine((data) => data.validFrom <= data.validTo, {
    message: "La vigencia debe tener fecha inicio ≤ fecha fin",
    path: ["validTo"],
  });

export type CreateContractInput = z.infer<typeof createContractSchema>;

/** Normaliza un código de perfil a A-Z0-9 y guiones (máx. 24). */
export function normalizeProfileCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/** Sugiere código a partir del nombre del perfil. */
export function suggestProfileCode(name: string): string {
  const base = normalizeProfileCode(name);
  return base.length > 0 ? base : "SRV";
}

export const createServiceProfileSchema = z.object({
  contractId: z.string().uuid(),
  routeShiftId: z.string().uuid(),
  geofenceId: z.string().uuid(),
  name: z.string().min(1),
  code: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? normalizeProfileCode(v) : undefined))
    .refine((v) => v === undefined || /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(v), {
      message: "Código inválido (usa letras, números y guiones)",
    }),
  possibleUnitIds: z.array(z.string().uuid()).default([]),
  referenceUnitId: z.string().uuid().optional(),
  activeDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
});

export type CreateServiceProfileInput = z.infer<typeof createServiceProfileSchema>;

export const createRouteShiftSchema = z.object({
  plantId: z.string().uuid(),
  clientAccountId: z.string().uuid(),
  routeId: z.string().uuid(),
  shiftId: z.string().uuid(),
});

export type CreateRouteShiftInput = z.infer<typeof createRouteShiftSchema>;

export const ledgerStepSchema = z.object({
  step: z.string(),
  result: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type LedgerStep = z.infer<typeof ledgerStepSchema>;

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  imei: string;
}

export interface VerificationInput {
  occurrenceId: string;
  expectedDeadline: Date;
  toleranceMinutes: number;
  routeStrictness: RouteStrictness;
  /** Umbral mínimo métrica A — cobertura de ruta (0–100). Default 60. */
  kmlMatchMinPct?: number;
  /** Radio del corredor en metros. Default 120. */
  kmlCorridorMeters?: number;
  /** Umbral mínimo métrica B — precisión de corredor (0–100). Default 60. */
  kmlCorridorMinPct?: number;
  /**
   * Fracción máxima de la ruta (0–1, desde el origen) sin evidencia cercana
   * antes de que el motor prefiera `pendiente_evidencia` sobre `no_cumplido`
   * por no haber observado el arranque de la ruta. Default 0.15.
   */
  kmlOriginToleranceFraction?: number;
  geofencePolygon: Array<{ lat: number; lng: number }>;
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
  /**
   * Corpus de rutas hermanas (mismo campus/contrato) para pesos TF-IDF de
   * segmentos. Si se omite, A usa cobertura uniforme (Fase 2).
   */
  routeCorpus?: Array<Array<{ lat: number; lng: number }>>;
  /**
   * Distancia de Fréchet máxima aceptable (km) como filtro suave de forma.
   * Default 0.8. Solo aplica con KML.
   */
  frechetMaxKm?: number;
  evidencePoints: GpsPoint[];
  excusableReasons: ExcusableReason[];
  manualExcusable?: ExcusableReason | null;
  /**
   * Ventana sobre la que se mide cobertura temporal (típicamente operativa:
   * deadline − duración ruta … deadline + tolerancia). Si no se envía, no se
   * aplica la precondición de cobertura (compat tests viejos).
   */
  coverageWindowStart?: Date;
  coverageWindowEnd?: Date;
  /** Default 80. */
  evidenceMinCoveragePct?: number;
  /** Default 10. */
  evidenceMaxGapMinutes?: number;
}

export interface VerificationResult {
  status: ComplianceStatus;
  timing: TimingStatus | null;
  observedUnitId: string | null;
  observedArrivalAt: Date | null;
  observedRouteMatchPct: number | null;
  lateExcusable: boolean;
  routeStrictnessApplied: RouteStrictness;
  /** Variante de trazado que sirvió la unidad. Llenado por la capa de servicios, no por verifyService. */
  servedVariantId?: string | null;
  ledgerSteps: LedgerStep[];
  candidateUnits: Array<{
    unitId: string;
    servedRoute: boolean;
    arrivalAt: Date | null;
    /** Métrica A: % waypoints KML cubiertos por GPS (uniforme o TF-IDF). */
    routeMatchPct: number;
    /** Métrica B: % puntos GPS dentro del corredor. */
    corridorPrecisionPct: number;
    /** Distancia de Fréchet discreta (km); null sin KML. */
    frechetKm?: number | null;
    /** Similitud de dirección 0–1; null sin KML. */
    directionSimilarity?: number | null;
    /**
     * Fracción de la ruta sobre la que se calculó la métrica A (1 = completa).
     * Se declara aparte del porcentaje: A sobre medio trazado no es A sobre
     * el trazado entero, y el expediente debe poder decir cuál de las dos es.
     */
    observableFraction?: number;
  }>;
}

export * from "./enforcement.js";
export * from "./operational-scope.js";
export * from "./senal.js";
export * from "./ventana-observacion.js";
