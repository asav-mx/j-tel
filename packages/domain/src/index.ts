import { z } from "zod";

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
  allowAlternateDestination: z.boolean().default(false),
  excusableReasons: z.array(ExcusableReason).default([]),
  enforcementRules: z.array(enforcementRulesSchema).default([]),
  /** Ventana de observación GPS: empieza N min antes del deadline (ej. 60 → 5:45 si deadline 6:45). */
  evidenceMarginMinutesBefore: z.number().int().nonnegative().default(60),
  evidenceMarginMinutesAfter: z.number().int().nonnegative().default(30),
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
});

export type ContractPolicy = z.infer<typeof contractPolicySchema>;

/** Parsea "HH:MM" o "HH:MM:SS" a minutos desde medianoche. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Deadline = inicio del turno − anticipación de llegada (contrato). */
export function computeExpectedDeadline(
  serviceDate: string,
  shiftStartTime: string,
  arrivalAnticipationMinutes: number,
): Date {
  const minutes = parseTimeToMinutes(shiftStartTime) - arrivalAnticipationMinutes;
  const d = new Date(`${serviceDate}T00:00:00`);
  d.setMinutes(minutes);
  return d;
}

export function computeEvidenceWindow(
  deadline: Date,
  policy: Pick<
    ContractPolicy,
    "evidenceMarginMinutesBefore" | "verificationGraceMinutes" | "evidenceMarginMinutesAfter"
  >,
): { windowStart: Date; windowEnd: Date } {
  const windowStart = new Date(deadline);
  windowStart.setMinutes(windowStart.getMinutes() - policy.evidenceMarginMinutesBefore);
  const windowEnd = new Date(deadline);
  windowEnd.setMinutes(
    windowEnd.getMinutes() +
      policy.verificationGraceMinutes +
      policy.evidenceMarginMinutesAfter,
  );
  return { windowStart, windowEnd };
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
  geofencePolygon: Array<{ lat: number; lng: number }>;
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
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
  ledgerSteps: LedgerStep[];
  candidateUnits: Array<{
    unitId: string;
    servedRoute: boolean;
    arrivalAt: Date | null;
    /** Métrica A: % waypoints KML cubiertos por GPS. */
    routeMatchPct: number;
    /** Métrica B: % puntos GPS dentro del corredor. */
    corridorPrecisionPct: number;
  }>;
}

export * from "./enforcement.js";
export * from "./operational-scope.js";
