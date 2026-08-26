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

/**
 * Como `localDateTimeShort` pero **con segundos**: "YYYY-MM-DD HH:MM:SS".
 *
 * Para donde el segundo es parte de la evidencia —el primer y el último punto
 * del rastro de una unidad, una llegada—. Y **con su fecha, siempre**: la caja
 * de aportación imprimía solo la hora y un día real de rastro salió como *«de
 * 18:28:33 a 17:58:47»*, dos números correctos formando una frase falsa. El
 * rastro se recorta en días UTC, así que en la zona de la operación cruza la
 * medianoche; una hora sin fecha no sostiene un caso.
 *
 * Vive aquí y no en la app para que el producto formate instantes en un solo
 * lugar: la versión que estaba dentro del componente además omitía `timeZone`,
 * y sin él `Intl` usa el reloj de quien mira.
 */
export function localDateTimeSeconds(date: Date | string, timeZone = JTTEL_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const hhmmss = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return `${localDateIso(d, timeZone)} ${hhmmss}`;
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

/**
 * Qué se pudo observar de un servicio. Describe la EVIDENCIA, no la conducta
 * del transportista — el veredicto son otros tres valores (`ComplianceStatus`)
 * y no se tocan desde aquí.
 *
 * `sin_evidencia_posible` es el reconocimiento de que no hay dato que pueda
 * cubrir esta ventana: la memoria propia empieza después de que terminó, o
 * pasaron semanas sin que apareciera por ninguna vía. Saca al servicio de la
 * cola de reintento —de ahí que exista— y NO es un veredicto: el hecho se
 * queda en `pendiente_evidencia`. Sin evidencia no es incumplimiento.
 * Es reversible: una re-verificación forzada lo ignora.
 */
export const EvidenceStatus = z.enum([
  "disponible",
  "parcial",
  "en_espera",
  "indisponible",
  "sin_evidencia_posible",
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
  /**
   * El administrador dentro de una planta — D10 del plan. Declarado y
   * **parqueado sin permisos**: la regla 2 de D9 lo presupone y hoy no existía,
   * así que la única salida era dar `admin_corporativo`, que ve todas las
   * plantas. Sus permisos se definen con el alcance fino.
   */
  "admin_planta",
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

/**
 * Tope de distancia de Fréchet entre la traza y el trazado, en km.
 *
 * Vive aquí y no en el motor porque **el esquema es quien tiene que poder
 * declararlo** (Ley 6 del Marco: todo umbral es configurable por contrato). El
 * motor lo importa; antes lo resolvía con un `?? 0.8` propio, que era el único
 * umbral de KML fuera de `contractPolicySchema` — eso es C12.
 *
 * 0.8 es exactamente el valor que el motor venía aplicando, así que meterlo a
 * la política **no mueve nada**: cambia quién manda, no el comportamiento. Es
 * la misma forma del arreglo de `kmlOriginToleranceFraction`.
 */
export const DEFAULT_FRECHET_MAX_KM = 0.8;

/**
 * Por cuántos puntos de corredor tiene que ganar la ruta del servicio para que
 * la atribución se haga — Paso 3 de las preguntas separadas.
 *
 * ── Por qué existe una perilla nueva ────────────────────────────────────────
 *
 * Desde el paso 3, «cuál ruta sirvió» la contesta B: la ruta del servicio tiene
 * que ser la de mayor precisión de corredor **entre todas las del turno**.
 * Atribuir a la mayor sin margen resuelve por ruido dos rutas separadas por una
 * décima, así que el margen es parte de la pregunta, no una afinación.
 *
 * ── Por qué 5, y por qué el número no salió de aquí ─────────────────────────
 *
 * Medido el 17 de agosto de 2026 sobre los rankings sellados por el paso 2, por
 * contrato, contando solo las candidatas que HOY acreditan —las únicas a las que
 * el margen les cambia el veredicto:
 *
 *     margen      0     1     2     5    10
 *     Campus      0     0     0     0     0
 *     Planta 47   0     0     0     0     0
 *
 * Ningún valor entre 0 y 10 mueve una acreditación de hoy. La decisión fue de
 * Asav y su razón está escrita: **0 significaría que el corredor nunca opina y
 * la perilla no existiría**; 5 dice «algo de precisión, sin exigir», no mueve
 * nada hoy, y queda sellado en cada hecho para poder auditarlo después.
 *
 * ⚠ **Y qué pasa cuando el margen no alcanza:** no se elige. Dos rutas empatadas
 * son una atribución que el sistema no puede hacer, y eso es `pendiente`, nunca
 * un volado. Es la misma ley del piso, aplicada al empate.
 *
 * Vive en la política y no en el motor por la Ley 6 —todo umbral es configurable
 * por contrato— y por C12: un número horneado es un umbral que nadie puede
 * auditar. Al vivir aquí viaja dentro de `contractPolicySnapshot`, así que cada
 * hecho sellado dice con qué margen se le atribuyó.
 */
export const DEFAULT_CORRIDOR_ATTRIBUTION_MARGIN_PCT = 5;

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
  /**
   * Tope de distancia de Fréchet entre la traza observada y el trazado, en km.
   *
   * Desambigua el RANKING de candidatas — alimenta `shapeOk`, que ordena—, y
   * **no entra en la expresión `servedRoute`**, que es la que decide cuántas
   * acreditan. Por eso mover este umbral no puede cambiar un veredicto por sí
   * solo, y por eso C12 se pudo arreglar sin contaminar la medición de las
   * demás causas del nudo.
   *
   * Medido el 5 de agosto: **300 de los 319 servicios cumplidos también exceden
   * este tope** y cumplieron igual. Quien lo mueva pensando que rescata
   * servicios está mirando el umbral equivocado.
   */
  frechetMaxKm: z.number().min(0).default(DEFAULT_FRECHET_MAX_KM),
  /**
   * Margen de corredor con el que se atribuye la ruta — Paso 3.
   *
   * A diferencia de `frechetMaxKm`, **este umbral SÍ entra en `servedRoute`**:
   * mover este número puede cambiar un veredicto. Ver
   * `DEFAULT_CORRIDOR_ATTRIBUTION_MARGIN_PCT` para la medición que sostiene el 5
   * y para qué pasa cuando el margen no alcanza.
   */
  corridorAttributionMarginPct: z
    .number()
    .min(0)
    .max(100)
    .default(DEFAULT_CORRIDOR_ATTRIBUTION_MARGIN_PCT),
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
  /**
   * Rumbo en grados (0 = norte, 90 = este). Umbrella lo manda como `azimuth` y
   * hasta ahora se tiraba. La app del pasajero lo necesita para dibujar hacia
   * dónde apunta el camión; el archivador no lo usa y no le estorba.
   */
  heading?: number;
  /** El APARATO que emitió el punto. Nunca la unidad — ver `unitId`. */
  imei: string;
  /**
   * La UNIDAD a la que se resolvió ese aparato por la asignación vigente en el
   * instante observado. Opcional: un aparato sin asignación no tiene unidad, y
   * decir cuál sería inventarla.
   *
   * Existe por C15. Antes no había campo: quien preparaba la evidencia
   * **sobrescribía `imei` con el id de la unidad** y el aparato se perdía ahí
   * mismo. El motor agrupaba y etiquetaba con lo que recibía, así que el
   * expediente terminaba diciendo `imei:` sobre un id de vehículo — evidencia
   * mal etiquetada en el documento que sostiene una acusación.
   *
   * Ley 5 del Marco: el GPS es un dispositivo, no la unidad. Son dos campos
   * porque son dos cosas, y el expediente tiene que poder enseñar las dos.
   */
  unitId?: string;
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
   * Las rutas del MISMO turno, para rankear el corredor contra todas — Paso 2.
   *
   * **Informativo: no gobierna.** La atribución sigue saliendo de A∧B contra la
   * ruta contratada hasta el paso 3. Si se omite, el paso simplemente no se
   * escribe y nada cambia.
   *
   * Es distinto de `routeCorpus`, que son trazados hermanos usados como CORPUS
   * para pesar segmentos raros. Aquí cada ruta es una **candidata a explicar el
   * recorrido**, y por eso viaja con su identidad y su nombre.
   */
  rutasDelTurno?: Array<{
    routeShiftId: string;
    routeId: string;
    nombre: string;
    waypoints: Array<{ lat: number; lng: number }>;
    esLaDelServicio: boolean;
  }>;
  /**
   * Distancia de Fréchet máxima aceptable (km) como filtro suave de forma.
   * Default 0.8. Solo aplica con KML.
   */
  frechetMaxKm?: number;
  /**
   * Margen de corredor para atribuir — Paso 3. Default 5.
   *
   * Sin `rutasDelTurno` no hay contra qué comparar y la atribución se queda como
   * antes del paso 3: B contra su propio umbral. Se declara en el ledger, no se
   * asume.
   */
  corridorAttributionMarginPct?: number;
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
  /**
   * La densidad de la evidencia con la que se juzgó — Paso 1.
   *
   * **Informativa: no gobierna nada todavía.** El piso que la usará se enciende
   * en el paso 4, y hasta entonces esto solo deja registrado, dentro del hecho,
   * con qué material se decidió. Es la medición de «antes» del propio cambio.
   */
  densidadEvidencia?: {
    huecoMedianaS: number | null;
    huecoPeorS: number | null;
    aparatos: number;
    puntos: number;
  } | null;
  candidateUnits: Array<{
    unitId: string;
    servedRoute: boolean;
    arrivalAt: Date | null;
    /**
     * Métrica A — **cobertura de ruta**, la que DECIDE. Va ponderada por TF-IDF
     * cuando hay corpus de rutas, así que **no se lee como porcentaje llano**.
     */
    routeMatchPct: number;
    /**
     * La misma cobertura **sin ponderar**: qué fracción del trazado cubrió, a
     * secas. Existe porque la de arriba acreditaba ≥ 60 % a candidatas con una
     * cobertura real de 3.9 % de mediana — 168 de 3 054 medidas el 5 de agosto
     * de 2026. **No decide nada:** informa, para que el expediente no tenga que
     * elegir entre creerle a un nombre o no saber.
     */
    routeMatchPlainPct: number;
    /** Métrica B — **precisión de corredor**: % de puntos GPS dentro del corredor. */
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
    /**
     * Por qué NO acreditó — todas las compuertas que falló, no la primera.
     *
     * Vacío significa que acreditó. Existe porque hasta la Parte 2 el ledger
     * guardaba un motivo del SERVICIO —`ninguna_unidad_coincidio_ruta`, que dice
     * lo mismo que «no se pudo atribuir»— y ninguno de la candidata: el
     * expediente tenía que deducirlo comparando números con umbrales, y eso solo
     * funciona donde los números están.
     */
    motivos?: MotivoDeCandidata[];
  }>;
}

/**
 * La compuerta que rechazó a una candidata, **con la población a la que se le
 * preguntó**.
 *
 * ⚠ **Las dos partes van juntas y no se pueden separar.** `tramo_observable`
 * medido sobre la CANDIDATA y medido sobre el VIAJE son la misma comprobación
 * con dos respuestas distintas — el viaje trae la evidencia de la flota entera,
 * con mediana de cincuenta unidades, así que casi siempre contesta que sí. Eso
 * es C25, y **un motivo que no diga a quién se le preguntó repite el defecto
 * dentro del registro**: el expediente afirmaría una causa que no es la que
 * operó.
 */
export type MotivoDeCandidata = {
  compuerta:
    | "no_llego"
    | "tramo_observable"
    | "cobertura_de_trazado"
    | "precision_de_corredor"
    /**
     * Paso 3 · fue precisa, pero de OTRA ruta del turno — o le ganó a la mejor
     * ajena por menos que el margen.
     *
     * Distinta de `precision_de_corredor` a propósito: aquélla dice «no siguió
     * un corredor», ésta dice «siguió el de otra ruta». Un expediente que las
     * colapsara acusaría de no hacer su trazado a un camión que sí hizo uno.
     *
     * `medido` = por cuánto ganó la propia (negativo si perdió) · `umbral` = el
     * margen. `null` en `medido` cuando no había ninguna otra ruta que comparar.
     */
    | "atribucion_de_ruta";
  /** A quién se le preguntó: la unidad candidata, o la evidencia del viaje (la flota). */
  poblacion: "candidata" | "viaje";
  /** Lo medido, en la unidad de esa compuerta. `null` cuando no se pudo medir. */
  medido: number | null;
  /** El umbral que se le aplicó, de la política del contrato. Nunca una constante. */
  umbral: number | null;
};

/** La señal de UNA candidata — no la de la mejor unidad del viaje. */
export type SenalDeCandidata = {
  coberturaPct: number;
  huecoMaximoMin: number;
  /** Mediana del hueco entre puntos consecutivos (s); null con menos de dos puntos. */
  cadenciaMedianaS: number | null;
  puntos: number;
};

/**
 * Lo que se congela dentro del hecho sobre las candidatas que se evaluaron.
 *
 * `evaluadas` es obligatorio y es **la ley del corte**: la lista guarda solo las
 * relevantes —mediana de 3 contra una flota de 50—, y sin el total un filtro se
 * vuelve ocultamiento. Un transportista que hizo la ruta con GPS pobre y quedó
 * fuera del corte tiene que poder ver que hubo un corte, o diría «sí fui y ni
 * aparezco», con razón.
 *
 * ⚠ **`null` en la columna NO es esto con la lista vacía.** `null` significa
 * «no se preguntó» —los 1 297 hechos sellados antes de la Parte 2— y una lista
 * vacía significa «se preguntó y no hubo ninguna candidata». Los dos casos no se
 * dibujan igual, y lo viejo **no se rellena nunca**.
 */
export type CandidatasSnapshot = {
  /** CUÁNTAS se evaluaron en total, no cuántas se guardaron. */
  evaluadas: number;
  /** Con qué se recortó la lista, para que el corte sea auditable. */
  criterio: string;
  candidatas: Array<{
    unidadId: string | null;
    imeis: string[];
    llegadaAt: string | null;
    acredito: boolean;
    /** Todas las compuertas que fallaron, no la primera: colapsarlas inventa una prioridad. */
    motivos: MotivoDeCandidata[];
    senal: SenalDeCandidata | null;
  }>;
  /**
   * Contra qué trazado se le calificó — **no «cuál sirvió»**, que sigue en nulo
   * cuando ninguna sirvió. Son dos preguntas distintas y el expediente necesita
   * la primera.
   */
  trazadoEvaluado: { variantId: string | null; kmlVersionId: string | null } | null;
};

export * from "./enforcement.js";
export * from "./identidad.js";
export * from "./operational-scope.js";
export * from "./senal.js";
export * from "./ventana-observacion.js";
