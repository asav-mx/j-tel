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
  allowAlternateDestination: z.boolean().default(false),
  excusableReasons: z.array(ExcusableReason).default([]),
  enforcementRules: z.array(enforcementRulesSchema).default([]),
  /** Ventana de observación GPS: empieza N min antes del deadline (ej. 60 → 5:45 si deadline 6:45). */
  evidenceMarginMinutesBefore: z.number().int().nonnegative().default(60),
  evidenceMarginMinutesAfter: z.number().int().nonnegative().default(30),
  /** Duración máxima esperada del recorrido de recolección (min). */
  maxRouteDurationMinutes: z.number().int().positive().default(60),
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

export const createContractSchema = z.object({
  carrierAccountId: z.string().uuid(),
  clientAccountId: z.string().uuid(),
  plantId: z.string().uuid().optional(),
  plantGroupId: z.string().uuid().optional(),
  name: z.string().min(1),
  policy: contractPolicySchema,
  status: ContractStatus.default("draft"),
}).refine(
  (data) => (data.plantId && !data.plantGroupId) || (!data.plantId && data.plantGroupId),
  { message: "Debe especificar planta o grupo de plantas, no ambos" },
);

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const createServiceProfileSchema = z.object({
  contractId: z.string().uuid(),
  routeShiftId: z.string().uuid(),
  geofenceId: z.string().uuid(),
  name: z.string().min(1),
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
  geofencePolygon: Array<{ lat: number; lng: number }>;
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
  evidencePoints: GpsPoint[];
  excusableReasons: ExcusableReason[];
  manualExcusable?: ExcusableReason | null;
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
    routeMatchPct: number;
  }>;
}

export * from "./enforcement.js";
export * from "./operational-scope.js";
