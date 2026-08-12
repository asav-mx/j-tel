import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
  date,
  time,
  uniqueIndex,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", ["carrier", "client", "jstaff"]);
export const complianceStatusEnum = pgEnum("compliance_status", [
  "cumplido",
  "no_cumplido",
  "pendiente_evidencia",
]);
export const timingStatusEnum = pgEnum("timing_status", [
  "temprano",
  "a_tiempo",
  "tarde",
]);
export const evidenceStatusEnum = pgEnum("evidence_status", [
  "disponible",
  "parcial",
  "en_espera",
  "indisponible",
  // Ver `EvidenceStatus` en @jtel/domain: estado de cola, no veredicto.
  "sin_evidencia_posible",
]);
export const routeStrictnessEnum = pgEnum("route_strictness", [
  "destino_only",
  "kml_full",
]);

/**
 * Estado de una VARIANTE de trazado.
 *
 * Distinción clave (no confundir):
 *   • VARIANTE = caminos alternos que COEXISTEN como válidos hoy
 *     (ej. Riveras-B por MEX-45 o por la Panamericana).
 *   • VERSIÓN  = la historia temporal de UNA variante
 *     (el trazado cambió → versión nueva; se juzga cada servicio
 *      con la versión vigente en su fecha).
 */
export const variantStatusEnum = pgEnum("variant_status", ["activa", "legacy"]);
export const variantOriginEnum = pgEnum("variant_origin", [
  "manual",
  /** Campo preparado para Tarea C / Ficha 3 — la maquinaria de promoción aún no existe. */
  "promovida_de_viaje",
]);
export const geofenceRoleEnum = pgEnum("geofence_role", [
  "destino",
  "base",
  "caseta",
  "otro",
]);
export const geofenceOwnerTypeEnum = pgEnum("geofence_owner_type", [
  "plant",
  "plant_group",
  "carrier",
]);
export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "demo",
  "active",
  "suspended",
]);
export const clientCarrierAuthorizationStatusEnum = pgEnum("client_carrier_authorization_status", [
  "active",
  "suspended",
]);
export const scopeTypeEnum = pgEnum("scope_type", [
  "global",
  "account",
  "plant",
  "plant_group",
  "contract",
  "fleet",
]);
export const inspectionStatusEnum = pgEnum("inspection_status", [
  "pendiente",
  "en_progreso",
  "completada",
  "requiere_accion",
]);
export const maintenanceStatusEnum = pgEnum("maintenance_status", [
  "programado",
  "en_progreso",
  "completado",
  "vencido",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "tarde",
  "sin_evidencia",
  "reporte_listo",
  "requiere_revision",
  "inspeccion",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: accountTypeEnum("type").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  clerkOrgId: text("clerk_org_id"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const carrierProfiles = pgTable("carrier_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" })
    .unique(),
  legalName: text("legal_name").notNull(),
  // Proveedor de GPS del carrier. Cada carrier puede usar uno distinto
  // (umbrella hoy; a futuro otros o hardware propio).
  gpsProvider: text("gps_provider").notNull().default("umbrella"),
  gpsBaseUrl: text("gps_base_url"),
  // Credenciales del proveedor. La contraseña se guarda cifrada (AES-256-GCM).
  umbrellaUserId: text("umbrella_user_id"),
  umbrellaPasswordEncrypted: text("umbrella_password_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const clientProfiles = pgTable("client_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" })
    .unique(),
  legalName: text("legal_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const plantGroups = pgTable("plant_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const plants = pgTable("plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  plantGroupId: uuid("plant_group_id").references(() => plantGroups.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const geofences = pgTable("geofences", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: geofenceOwnerTypeEnum("owner_type").notNull(),
  ownerPlantId: uuid("owner_plant_id").references(() => plants.id, { onDelete: "cascade" }),
  ownerPlantGroupId: uuid("owner_plant_group_id").references(() => plantGroups.id, {
    onDelete: "cascade",
  }),
  ownerCarrierAccountId: uuid("owner_carrier_account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }),
  role: geofenceRoleEnum("role").notNull(),
  name: text("name").notNull(),
  polygon: jsonb("polygon").$type<Array<{ lat: number; lng: number }>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  plateNumber: text("plate_number"),
  jrzPassDriverId: text("jrz_pass_driver_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  imei: text("imei").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("devices_carrier_imei_idx").on(table.carrierAccountId, table.imei),
]);

export const deviceAssignments = pgTable("device_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("device_assignments_unit_valid_idx").on(table.unitId, table.validFrom),
  index("device_assignments_device_valid_idx").on(table.deviceId, table.validFrom),
]);

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  /** Planta independiente (XOR con plantGroupId). */
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "cascade" }),
  /** Campus / grupo compartido (XOR con plantId). */
  plantGroupId: uuid("plant_group_id").references(() => plantGroups.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "cascade" }),
  plantGroupId: uuid("plant_group_id").references(() => plantGroups.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  /** Hora nominal de inicio del turno (cuándo entra el personal / pasa lista). */
  startTime: time("start_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  /**
   * Cuándo se editó por última vez. La escribe el TRIGGER, no quien actualiza.
   *
   * Nullable y sin default a propósito: un turno que nunca se ha editado no
   * tiene fecha de edición, y rellenarla con la de la migración afirmaría un
   * cambio que no ocurrió. NULL dice lo que de verdad se sabe.
   */
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }),
});

/**
 * La historia del turno — una fila por edición, con las dos fotos.
 *
 * Existe por C21: cuando el Turno B de Planta 47 se movió, el cambio no se pudo
 * FECHAR —solo acotar entre dos corridas del cron— porque `shifts` no guardaba
 * nada. Con esto, la divergencia entre una ocurrencia y el turno que la produjo
 * pasa de inferible a legible.
 *
 * **La escribe un trigger de Postgres, no el código de la aplicación**, y ésa
 * es la lección de C13: ahí el registro vive dentro de `updatePolicy` desde el
 * 31 de julio y la tabla sigue vacía, porque la edición real la hizo un guion
 * con `UPDATE` crudo. Un trigger alcanza también a los guiones y a la consola.
 *
 * La aplicación declara al actor con `set_config('jtel.actor_kind', …, true)`
 * en su transacción; lo que no lo declare queda firmado `sql_directo`.
 *
 * Nada del motor lee esta tabla. Cada ocurrencia sigue congelando su propia
 * hora límite; esto es registro hacia adelante, no ley.
 */
export const shiftHistory = pgTable(
  "shift_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    nameBefore: text("name_before").notNull(),
    nameAfter: text("name_after").notNull(),
    startTimeBefore: time("start_time_before").notNull(),
    startTimeAfter: time("start_time_after").notNull(),
    /** Quién editó. `sql_directo` cuando la escritura no declaró actor. */
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    /** Por qué. Opcional: no bloquea guardar, pero cuando está vale más que el qué. */
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sh_shift_idx").on(table.shiftId, table.changedAt)],
);

export const routeShifts = pgTable("route_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "cascade" }),
  plantGroupId: uuid("plant_group_id").references(() => plantGroups.id, {
    onDelete: "cascade",
  }),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("route_shifts_unique_idx").on(table.routeId, table.shiftId),
]);

/**
 * Catálogo de VARIANTES de trazado de una ruta.
 *
 * Una ruta = UN destino (identidad, intocable) + N trazados aceptados (variantes).
 * El motor evalúa contra todas las variantes activas y una unidad cumple si
 * sirve la ruta por CUALQUIERA de ellas.
 *
 * No confundir VARIANTE con VERSIÓN:
 *   • VARIANTE = caminos alternos que coexisten como válidos hoy.
 *   • VERSIÓN  = historia temporal de una variante (route_kml_versions).
 */
export const routeKmlVariants = pgTable("route_kml_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: variantStatusEnum("status").notNull().default("activa"),
  origin: variantOriginEnum("origin").notNull().default("manual"),
  /** Trip del que se promovió (si origin = promovida_de_viaje). Campo preparado; maquinaria en Tarea C.
   *  FK definida en migración SQL (no en Drizzle) para evitar ciclo de tipos con trips. */
  originTripId: uuid("origin_trip_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("route_kml_variants_route_name_idx").on(table.routeId, table.name),
]);

/**
 * VERSIÓN temporal del trazado de una VARIANTE (KML/KMZ).
 *
 * Cada variante conserva su propio historial de versiones:
 * el trazado puede actualizarse sin cambiar ruta/turno ni variante.
 * Se juzga cada servicio con la versión vigente en su fecha.
 *
 * `routeId` se conserva (redundante con variant→route) para queries directos
 * y compatibilidad con getKmlVersionForDate existente.
 */
export const routeKmlVersions = pgTable("route_kml_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  /** Variante a la que pertenece esta versión. NULL solo en datos pre-migración no migrados. */
  variantId: uuid("variant_id").references(() => routeKmlVariants.id, { onDelete: "cascade" }),
  kmlContent: text("kml_content").notNull(),
  waypoints: jsonb("waypoints").$type<Array<{ lat: number; lng: number }>>().notNull().default([]),
  validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Relación comercial J-Staff: qué carriers puede contratar un cliente. */
export const clientCarrierAuthorizations = pgTable(
  "client_carrier_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientAccountId: uuid("client_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    status: clientCarrierAuthorizationStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("client_carrier_auth_unique_idx").on(
      table.clientAccountId,
      table.carrierAccountId,
    ),
    index("client_carrier_auth_client_idx").on(table.clientAccountId),
  ],
);

export const serviceContracts = pgTable("service_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  plantId: uuid("plant_id").references(() => plants.id, { onDelete: "cascade" }),
  plantGroupId: uuid("plant_group_id").references(() => plantGroups.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  status: contractStatusEnum("status").notNull().default("draft"),
  /** Vigencia comercial del contrato (licitación / asignación). */
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to").notNull(),
  policy: jsonb("policy").$type<import("@jtel/domain").ContractPolicy>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * Historia de la política — una fila por edición, nunca se borra.
 *
 * Los hechos guardan la suya desde la 0012; la política, que es la ley con la
 * que se juzga, no tenía registro: `updatePolicy` sobrescribía y la versión
 * anterior se perdía.
 *
 * Se guardan las DOS fotos a propósito. Con solo la anterior, saber qué cambió
 * una edición obliga a mirar la fila siguiente, y un camino de escritura que no
 * registre rompe la cadena en silencio. Con las dos, cada fila es verdadera por
 * sí sola y el hueco se puede detectar: si el `policyAfter` de una fila no
 * coincide con el `policyBefore` de la siguiente, alguien escribió sin dejar
 * rastro, y eso se dice en vez de dibujar una historia falsa.
 *
 * Nada del motor lee esta tabla. Cada hecho congela su propio
 * `contractPolicySnapshot`; esto es registro hacia adelante, no ley.
 */
export const contractPolicyHistory = pgTable(
  "contract_policy_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => serviceContracts.id, { onDelete: "cascade" }),
    policyBefore: jsonb("policy_before")
      .$type<import("@jtel/domain").ContractPolicy>()
      .notNull(),
    policyAfter: jsonb("policy_after")
      .$type<import("@jtel/domain").ContractPolicy>()
      .notNull(),
    /** Quién editó. Hasta que exista auth-rbac, la firma honesta es el rol. */
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    /** Por qué. Opcional: no bloquea guardar, pero cuando está vale más que el qué. */
    note: text("note"),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("cph_contract_idx").on(table.contractId, table.changedAt)],
);

export type ContractPolicyEdit = typeof contractPolicyHistory.$inferSelect;

export const serviceProfiles = pgTable(
  "service_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => serviceContracts.id, { onDelete: "cascade" }),
    routeShiftId: uuid("route_shift_id")
      .notNull()
      .references(() => routeShifts.id, { onDelete: "cascade" }),
    geofenceId: uuid("geofence_id")
      .notNull()
      .references(() => geofences.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Código operativo legible (ej. CSD-FINA-I). Único globalmente. */
    code: text("code").notNull(),
    referenceUnitId: uuid("reference_unit_id").references(() => units.id, {
      onDelete: "set null",
    }),
    activeDays: jsonb("active_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("service_profiles_code_unique_idx").on(table.code)],
);

export const serviceProfileUnits = pgTable("service_profile_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceProfileId: uuid("service_profile_id")
    .notNull()
    .references(() => serviceProfiles.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("service_profile_units_unique_idx").on(
    table.serviceProfileId,
    table.unitId,
  ),
]);

export const serviceOccurrences = pgTable("service_occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceProfileId: uuid("service_profile_id")
    .notNull()
    .references(() => serviceProfiles.id, { onDelete: "cascade" }),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => serviceContracts.id, { onDelete: "cascade" }),
  routeShiftId: uuid("route_shift_id")
    .notNull()
    .references(() => routeShifts.id, { onDelete: "cascade" }),
  kmlVersionId: uuid("kml_version_id").references(() => routeKmlVersions.id, {
    onDelete: "set null",
  }),
  serviceDate: date("service_date").notNull(),
  expectedDeadline: timestamp("expected_deadline", { withTimezone: true, mode: "date" }).notNull(),
  expectedGeofenceId: uuid("expected_geofence_id")
    .notNull()
    .references(() => geofences.id),
  referenceUnitId: uuid("reference_unit_id").references(() => units.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("service_occurrences_unique_idx").on(
    table.serviceProfileId,
    table.serviceDate,
  ),
  index("service_occurrences_deadline_idx").on(table.expectedDeadline),
]);

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOccurrenceId: uuid("service_occurrence_id")
    .notNull()
    .references(() => serviceOccurrences.id, { onDelete: "cascade" })
    .unique(),
  evidenceWindowStart: timestamp("evidence_window_start", { withTimezone: true, mode: "date" }).notNull(),
  evidenceWindowEnd: timestamp("evidence_window_end", { withTimezone: true, mode: "date" }).notNull(),
  evidenceStatus: evidenceStatusEnum("evidence_status").notNull().default("en_espera"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const evidencePoints = pgTable("evidence_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  imei: text("imei").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speed: doublePrecision("speed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("evidence_points_trip_idx").on(table.tripId, table.recordedAt),
]);

/**
 * La compuerta que rechazó a una candidata, **con la población a la que se le
 * preguntó**.
 *
 * Las dos partes van juntas y no se pueden separar: `tramo_observable` medido
 * sobre la CANDIDATA y medido sobre el VIAJE son la misma comprobación con dos
 * respuestas distintas — es C25, y un motivo que no diga cuál se usó repite el
 * defecto dentro del registro.
 */
export type MotivoDeCandidata = {
  compuerta:
    | "no_llego"
    | "tramo_observable"
    | "cobertura_de_trazado"
    | "precision_de_corredor";
  /** A quién se le preguntó: la unidad candidata, o la evidencia del viaje (la flota). */
  poblacion: "candidata" | "viaje";
  /** Lo medido y el umbral que se le aplicó, en la unidad de esa compuerta. */
  medido: number | null;
  umbral: number | null;
};

/**
 * Lo que se congela dentro del hecho sobre las candidatas que se evaluaron.
 *
 * `evaluadas` es obligatorio y es **la ley del corte**: la lista guarda solo las
 * relevantes —mediana de 3 contra una flota de 50—, y sin el total un filtro se
 * vuelve ocultamiento. Un transportista que hizo la ruta con GPS pobre y quedó
 * fuera del corte tiene que poder ver que hubo un corte.
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
    /** Todas las compuertas que fallaron, no la primera: colapsarlas inventa una prioridad. */
    motivos: MotivoDeCandidata[];
    /** Su señal, no la de la mejor unidad del viaje. */
    senal: {
      coberturaPct: number;
      huecoMaximoMin: number;
      cadenciaMedianaS: number | null;
      puntos: number;
    } | null;
  }>;
  /** Contra qué trazado se le calificó — no «cuál sirvió», que sigue en nulo. */
  trazadoEvaluado: { variantId: string | null; kmlVersionId: string | null } | null;
};

export const complianceFacts = pgTable("compliance_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOccurrenceId: uuid("service_occurrence_id")
    .notNull()
    .references(() => serviceOccurrences.id, { onDelete: "cascade" })
    .unique(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  expectedDeadline: timestamp("expected_deadline", { withTimezone: true, mode: "date" }).notNull(),
  expectedGeofenceId: uuid("expected_geofence_id")
    .notNull()
    .references(() => geofences.id),
  referenceUnitId: uuid("reference_unit_id").references(() => units.id, {
    onDelete: "set null",
  }),
  observedUnitId: uuid("observed_unit_id").references(() => units.id, {
    onDelete: "set null",
  }),
  observedArrivalAt: timestamp("observed_arrival_at", { withTimezone: true, mode: "date" }),
  observedRouteMatchPct: doublePrecision("observed_route_match_pct"),
  /** Variante de trazado que sirvió la unidad. NULL para hechos pre-variantes y para no_cumplido/pendiente. */
  servedVariantId: uuid("served_variant_id").references(() => routeKmlVariants.id, {
    onDelete: "set null",
  }),
  status: complianceStatusEnum("status").notNull(),
  timing: timingStatusEnum("timing"),
  lateExcusable: boolean("late_excusable").notNull().default(false),
  excusableReason: text("excusable_reason"),
  routeStrictnessApplied: routeStrictnessEnum("route_strictness_applied").notNull(),
  contractPolicySnapshot: jsonb("contract_policy_snapshot")
    .$type<import("@jtel/domain").ContractPolicy>()
    .notNull(),
  /**
   * Las candidatas relevantes con su motivo y su señal — Parte 2 del expediente
   * sin atribución. Congelado dentro del hecho, como la política de arriba.
   *
   * **Vive aquí y no en una tabla hija a propósito.** Una tabla aparte son filas
   * que alguien puede editar o borrar por separado del hecho, y eso es C24 con
   * otro nombre. Aquí se escribe en el mismo INSERT que el veredicto, y como
   * `compliance_fact_history` guarda `fact_snapshot` serializando la fila
   * completa, **viaja sola a la historia** sin código extra.
   *
   * ⚠ **`null` NO es lista vacía, y la diferencia es la razón de existir de la
   * columna:**
   *
   *   `null` — **no se preguntó.** El motor de esa época no registraba el
   *            porqué. Son los 1 278 hechos anteriores a la Parte 2, los 397 de
   *            julio entre ellos. **No se puede rellenar hacia atrás**: deducir
   *            el motivo con los números que sí quedaron sería escribir un hecho
   *            que nadie observó dentro de un expediente sellado (Marco §E).
   *   `[]`   — **se preguntó y no hubo ninguna candidata.**
   *
   * Por eso la columna no lleva default. Un `DEFAULT '[]'` haría que todo lo ya
   * sellado dijera «se evaluaron cero candidatas», que es falso —se evaluaron
   * unas cincuenta por servicio— y **es irreversible**: escrito el `[]`, nadie
   * puede volver a distinguir los dos casos.
   *
   * **Y la pantalla tiene que decirlo con palabras.** Si dibuja `—` o una lista
   * vacía en los dos casos, un hueco se lee como un cero y esta columna no
   * sirvió de nada.
   */
  candidatasSnapshot: jsonb("candidatas_snapshot").$type<CandidatasSnapshot>(),
  /**
   * El chofer declarado, CONGELADO dentro del hecho — Capa 1 del Plan-Choferes.
   *
   * El nombre es texto plano, no una referencia. Es la única forma de que la
   * historia sobreviva a la purga: si el expediente del chofer se borra —porque
   * se fue, o porque la ley obliga— este renglón sigue diciendo quién manejó
   * ese día según el transportista. Una referencia a una fila purgable dejaría
   * el acta de ese servicio con un hueco.
   *
   * Es el mismo argumento que congela `contractPolicySnapshot`: lo que sostiene
   * un hecho sellado vive dentro del hecho.
   *
   * `declaredDriverId` es comodidad para enlazar mientras el chofer exista, y
   * por eso se anula al borrarlo. **El nombre nunca se anula.**
   *
   * Nulo en los hechos anteriores al módulo, y nulo cuando el transportista no
   * declaró chofer — que es un hueco legítimo y se muestra, no se esconde.
   */
  declaredDriverName: text("declared_driver_name"),
  declaredDriverId: uuid("declared_driver_id").references(() => drivers.id, {
    onDelete: "set null",
  }),
  materializedAt: timestamp("materialized_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * El chofer — Capa 1 del Plan-Choferes: la identidad estable, no purgable.
 *
 * **No guarda un solo dato personal.** Es el ancla: existe para que las
 * asignaciones y los hechos tengan a qué colgarse, y para que borrar el
 * expediente de una persona no rompa nada.
 *
 * **El identificador lo genera J-Telemetry, no el transportista.** Si el
 * transportista tiene su propio número de nómina, vive en las credenciales
 * como un campo más —purgable— y nunca como llave: un identificador ajeno
 * puede repetirse, cambiar de dueño o desaparecer con el sistema que lo emitió,
 * y nada de eso puede arrastrar la historia de un servicio sellado.
 */
export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  /** La baja NO borra: marca. Los hechos que cubrió siguen siendo suyos. */
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true, mode: "date" }),
  /** Cuándo se purgaron las credenciales. Deja constancia de que se purgaron. */
  credentialsPurgedAt: timestamp("credentials_purged_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("drivers_carrier_idx").on(table.carrierAccountId),
]);

/**
 * Las credenciales — Capa 2 del Plan-Choferes: el expediente vivo, PURGABLE.
 *
 * Todo el dato personal vive aquí y solo aquí, en su propia tabla, para que
 * purgarlo sea borrar filas y no editar columnas de media base. Al dar de baja
 * se borra esta fila; `drivers` y los hechos quedan intactos.
 *
 * Alta mínima: nombre y licencia. Todo lo demás es opcional y se llena después
 * — el transportista tiene que poder registrar a alguien en treinta segundos.
 */
export const driverCredentials = pgTable("driver_credentials", {
  driverId: uuid("driver_id")
    .primaryKey()
    .references(() => drivers.id, { onDelete: "cascade" }),
  /** Alta mínima. */
  fullName: text("full_name").notNull(),
  licenseNumber: text("license_number").notNull(),
  /** Todo lo de abajo es opcional a propósito. */
  licenseExpiresOn: date("license_expires_on"),
  phone: text("phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  photoUrl: text("photo_url"),
  /**
   * El número que el transportista ya usa para esta persona. Es una comodidad
   * suya, purgable como todo lo de esta tabla, y JAMÁS una llave: la llave es
   * `drivers.id`, que genera J-Telemetry.
   */
  carrierPayrollNumber: text("carrier_payroll_number"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * Asignaciones — un solo tipo de registro, no varios.
 *
 * - **Fija:** `validTo` nulo. Cubre esa ruta indefinidamente.
 * - **Por periodo:** con rango. Cubre del día X al día Y.
 *
 * **Las excepciones se superponen; no cierran la fija.** Si el titular falta un
 * día y otro lo cubre, esa cobertura es un registro por periodo *encima* de la
 * fija — la fija no se cancela ni se parte, y al pasar el día sigue vigente
 * como si nada. Por eso no hay columna de "tipo": el rango ya lo dice todo, y
 * quien lee resuelve por especificidad (el rango más angosto que cubre el día
 * gana).
 *
 * El modelo de cerrar-y-reabrir se descartó a propósito: genera huecos y
 * confusión sobre quién era titular.
 */
export const driverAssignments = pgTable("driver_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  driverId: uuid("driver_id")
    .notNull()
    .references(() => drivers.id, { onDelete: "cascade" }),
  routeShiftId: uuid("route_shift_id")
    .notNull()
    .references(() => routeShifts.id, { onDelete: "cascade" }),
  validFrom: date("valid_from").notNull(),
  /** Nulo = fija, sin fecha de fin. */
  validTo: date("valid_to"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("driver_assignments_driver_idx").on(table.driverId),
  index("driver_assignments_route_shift_idx").on(table.routeShiftId, table.validFrom),
]);

/** Fila completa de un hecho de cumplimiento. La foto que archiva la Pieza 1 debe ser fiel a esto. */
export type ComplianceFact = typeof complianceFacts.$inferSelect;

export const complianceFactHistory = pgTable("compliance_fact_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOccurrenceId: uuid("service_occurrence_id").notNull(),
  status: text("status").notNull(),
  timing: text("timing"),
  factSnapshot: jsonb("fact_snapshot").notNull(),
  replacedByFactId: uuid("replaced_by_fact_id").references(() => complianceFacts.id, {
    onDelete: "set null",
  }),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  replacedAt: timestamp("replaced_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  serviceOccurrenceId: uuid("service_occurrence_id")
    .notNull()
    .references(() => serviceOccurrences.id, { onDelete: "cascade" }),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  steps: jsonb("steps").$type<import("@jtel/domain").LedgerStep[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("ledger_entries_trip_idx").on(table.tripId),
  index("ledger_entries_occurrence_idx").on(table.serviceOccurrenceId),
]);

export const userMemberships = pgTable("user_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  clerkUserId: text("clerk_user_id").notNull(),
  role: text("role").notNull(),
  scopeType: scopeTypeEnum("scope_type").notNull(),
  scopeId: uuid("scope_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_memberships_unique_idx").on(
    table.accountId,
    table.clerkUserId,
    table.role,
    table.scopeType,
    table.scopeId,
  ),
]);

export const fuelRecords = pgTable("fuel_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  liters: doublePrecision("liters").notNull(),
  cost: doublePrecision("cost"),
  odometerKm: doublePrecision("odometer_km"),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const maintenanceRecords = pgTable("maintenance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  status: maintenanceStatusEnum("status").notNull().default("programado"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const inspections = pgTable("inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => serviceContracts.id, { onDelete: "cascade" }),
  plantId: uuid("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  status: inspectionStatusEnum("status").notNull().default("pendiente"),
  notes: text("notes"),
  inspectedAt: timestamp("inspected_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id"),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const demoTemplates = pgTable("demo_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// Archivo continuo de telemetría GPS ("memoria propia"): guardamos todo el
// historial de cada equipo de forma continua, independiente de los viajes, para
// dejar de depender del histórico del proveedor.
export const telemetryPoints = pgTable("telemetry_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
  unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
  imei: text("imei").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speed: doublePrecision("speed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
  source: text("source").notNull().default("umbrella"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  // Deduplica: un mismo equipo no puede tener dos puntos en el mismo instante.
  uniqueIndex("telemetry_points_imei_recorded_idx").on(table.imei, table.recordedAt),
  index("telemetry_points_carrier_recorded_idx").on(table.carrierAccountId, table.recordedAt),
  /**
   * Lectura por unidad. Sin él, pedir los puntos de UNA unidad en un día leía
   * los del carrier entero y tiraba el resto: medido en producción el
   * 2026-07-31, 58 464 filas leídas para devolver 744 (8.3 ms) contra 744
   * leídas (0.4 ms) con el índice.
   *
   * Se aplicó a mano con CONCURRENTLY (migración 0014) porque la tabla recibe
   * telemetría en vivo. Ver el archivo de la migración.
   */
  index("telemetry_points_carrier_unit_recorded_idx").on(
    table.carrierAccountId,
    table.unitId,
    table.recordedAt,
  ),
]);

// Marca de agua por carrier: hasta qué instante ya archivamos, para que cada
// corrida del cron solo pida lo nuevo.
export const telemetryWatermarks = pgTable("telemetry_watermarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  lastRecordedAt: timestamp("last_recorded_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("telemetry_watermarks_carrier_idx").on(table.carrierAccountId),
]);

/** Marca de agua por IMEI (Fase 5): relleno dirigido sin saltar huecos ajenos. */
export const telemetryImeiWatermarks = pgTable(
  "telemetry_imei_watermarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    imei: text("imei").notNull(),
    lastRecordedAt: timestamp("last_recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("telemetry_imei_watermarks_carrier_imei_idx").on(
      table.carrierAccountId,
      table.imei,
    ),
  ],
);

/** Verdad de campo del operador — separada del ledger de hechos (Fase 0). */
export const groundTruthDays = pgTable(
  "ground_truth_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => serviceContracts.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    expectedAllCumplido: boolean("expected_all_cumplido").notNull().default(true),
    declaredCumplidoCount: integer("declared_cumplido_count"),
    notes: text("notes"),
    recordedBy: text("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ground_truth_days_contract_date_idx").on(table.contractId, table.serviceDate),
  ],
);

/** Veredicto fino del operador por ocurrencia (cierre de residuales). */
export const occurrenceGtVerdictEnum = pgEnum("occurrence_gt_verdict", [
  "cumplido",
  "no_hecho",
]);

export const occurrenceGroundTruth = pgTable(
  "occurrence_ground_truth",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => serviceOccurrences.id, { onDelete: "cascade" }),
    operatorVerdict: occurrenceGtVerdictEnum("operator_verdict").notNull(),
    operatorUnitId: uuid("operator_unit_id").references(() => units.id, {
      onDelete: "set null",
    }),
    /** threshold | kml_geofence | exclusive_steal | wrong_unit | no_trip */
    primaryCause: text("primary_cause"),
    notes: text("notes"),
    recordedBy: text("recorded_by"),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("occurrence_ground_truth_occurrence_idx").on(table.occurrenceId),
  ],
);

export const ingestAlertKindEnum = pgEnum("ingest_alert_kind", [
  "heartbeat_stale",
  "watermark_lag",
  "archive_error",
  "rate_limit",
]);

/** Alertas operativas de ingesta (no son notificaciones de cliente). */
export const ingestAlerts = pgTable(
  "ingest_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierAccountId: uuid("carrier_account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    kind: ingestAlertKindEnum("kind").notNull(),
    severity: text("severity").notNull().default("warning"),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ingest_alerts_carrier_created_idx").on(table.carrierAccountId, table.createdAt),
    index("ingest_alerts_unresolved_idx").on(table.resolvedAt),
  ],
);

/**
 * Cuánto duró de verdad cada recorrido de una ruta×turno.
 *
 * Es una MEDICIÓN, no un veredicto: se guarda haya cumplido o no el servicio,
 * porque justo las rutas que fallan por ventana corta son las que más
 * necesitan que se sepa cuánto duran. Nadie juzga con esta tabla; solo
 * dimensiona la ventana de observación de las ocurrencias futuras
 * (`deriveObservationWindow`).
 *
 * Una medición por ocurrencia: re-verificar la reemplaza en vez de acumular
 * duplicados que sesguen el percentil.
 */
export const routeTraversalMeasurements = pgTable(
  "route_traversal_measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeShiftId: uuid("route_shift_id")
      .notNull()
      .references(() => routeShifts.id, { onDelete: "cascade" }),
    serviceOccurrenceId: uuid("service_occurrence_id")
      .notNull()
      .references(() => serviceOccurrences.id, { onDelete: "cascade" })
      .unique(),
    serviceDate: date("service_date").notNull(),
    kmlVersionId: uuid("kml_version_id").references(() => routeKmlVersions.id, {
      onDelete: "set null",
    }),
    /** Del primer punto en corredor a la llegada (o al último punto en corredor). */
    durationMinutes: doublePrecision("duration_minutes").notNull(),
    /**
     * La medición topó con el borde de la ventana: la ruta duró AL MENOS
     * esto. Sin esta bandera el percentil se quedaría atrapado en la ventana
     * angosta que produjo la medición.
     */
    lowerBound: boolean("lower_bound").notNull().default(false),
    pointsInCorridor: integer("points_in_corridor").notNull().default(0),
    /** Unidad a la que se le midió el recorrido; informativa, nunca un veredicto. */
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
    measuredAt: timestamp("measured_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("route_traversal_route_shift_date_idx").on(
      table.routeShiftId,
      table.serviceDate,
    ),
  ],
);

export type RouteTraversalMeasurement = typeof routeTraversalMeasurements.$inferSelect;

export const clientCarrierAuthorizationsRelations = relations(
  clientCarrierAuthorizations,
  ({ one }) => ({
    client: one(accounts, {
      fields: [clientCarrierAuthorizations.clientAccountId],
      references: [accounts.id],
      relationName: "clientCarrierAuthAsClient",
    }),
    carrier: one(accounts, {
      fields: [clientCarrierAuthorizations.carrierAccountId],
      references: [accounts.id],
      relationName: "clientCarrierAuthAsCarrier",
    }),
  }),
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  carrierProfile: one(carrierProfiles),
  clientProfile: one(clientProfiles),
  units: many(units),
  devices: many(devices),
  contractsAsCarrier: many(serviceContracts, { relationName: "carrierContracts" }),
  contractsAsClient: many(serviceContracts, { relationName: "clientContracts" }),
  authorizedCarriers: many(clientCarrierAuthorizations, {
    relationName: "clientCarrierAuthAsClient",
  }),
  authorizedClients: many(clientCarrierAuthorizations, {
    relationName: "clientCarrierAuthAsCarrier",
  }),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  carrier: one(accounts, {
    fields: [units.carrierAccountId],
    references: [accounts.id],
  }),
  assignments: many(deviceAssignments),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  carrier: one(accounts, {
    fields: [devices.carrierAccountId],
    references: [accounts.id],
  }),
  assignments: many(deviceAssignments),
}));

export const deviceAssignmentsRelations = relations(deviceAssignments, ({ one }) => ({
  unit: one(units, {
    fields: [deviceAssignments.unitId],
    references: [units.id],
  }),
  device: one(devices, {
    fields: [deviceAssignments.deviceId],
    references: [devices.id],
  }),
}));

export const serviceContractsRelations = relations(serviceContracts, ({ one, many }) => ({
  carrier: one(accounts, {
    fields: [serviceContracts.carrierAccountId],
    references: [accounts.id],
    relationName: "carrierContracts",
  }),
  client: one(accounts, {
    fields: [serviceContracts.clientAccountId],
    references: [accounts.id],
    relationName: "clientContracts",
  }),
  plant: one(plants, { fields: [serviceContracts.plantId], references: [plants.id] }),
  plantGroup: one(plantGroups, {
    fields: [serviceContracts.plantGroupId],
    references: [plantGroups.id],
  }),
  profiles: many(serviceProfiles),
  policyHistory: many(contractPolicyHistory),
}));

export const contractPolicyHistoryRelations = relations(contractPolicyHistory, ({ one }) => ({
  contract: one(serviceContracts, {
    fields: [contractPolicyHistory.contractId],
    references: [serviceContracts.id],
  }),
}));

export const routeShiftsRelations = relations(routeShifts, ({ one }) => ({
  route: one(routes, { fields: [routeShifts.routeId], references: [routes.id] }),
  shift: one(shifts, { fields: [routeShifts.shiftId], references: [shifts.id] }),
  plant: one(plants, { fields: [routeShifts.plantId], references: [plants.id] }),
  plantGroup: one(plantGroups, {
    fields: [routeShifts.plantGroupId],
    references: [plantGroups.id],
  }),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  plant: one(plants, { fields: [routes.plantId], references: [plants.id] }),
  plantGroup: one(plantGroups, {
    fields: [routes.plantGroupId],
    references: [plantGroups.id],
  }),
  kmlVariants: many(routeKmlVariants),
  kmlVersions: many(routeKmlVersions),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  plant: one(plants, { fields: [shifts.plantId], references: [plants.id] }),
  plantGroup: one(plantGroups, {
    fields: [shifts.plantGroupId],
    references: [plantGroups.id],
  }),
  history: many(shiftHistory),
}));

export const shiftHistoryRelations = relations(shiftHistory, ({ one }) => ({
  shift: one(shifts, { fields: [shiftHistory.shiftId], references: [shifts.id] }),
}));

export const routeKmlVariantsRelations = relations(routeKmlVariants, ({ one, many }) => ({
  route: one(routes, {
    fields: [routeKmlVariants.routeId],
    references: [routes.id],
  }),
  kmlVersions: many(routeKmlVersions),
}));

export const routeKmlVersionsRelations = relations(routeKmlVersions, ({ one }) => ({
  route: one(routes, {
    fields: [routeKmlVersions.routeId],
    references: [routes.id],
  }),
  variant: one(routeKmlVariants, {
    fields: [routeKmlVersions.variantId],
    references: [routeKmlVariants.id],
  }),
}));

export const serviceProfilesRelations = relations(serviceProfiles, ({ one, many }) => ({
  contract: one(serviceContracts, {
    fields: [serviceProfiles.contractId],
    references: [serviceContracts.id],
  }),
  routeShift: one(routeShifts, {
    fields: [serviceProfiles.routeShiftId],
    references: [routeShifts.id],
  }),
  geofence: one(geofences, {
    fields: [serviceProfiles.geofenceId],
    references: [geofences.id],
  }),
  possibleUnits: many(serviceProfileUnits),
  occurrences: many(serviceOccurrences),
}));

export const serviceProfileUnitsRelations = relations(serviceProfileUnits, ({ one }) => ({
  serviceProfile: one(serviceProfiles, {
    fields: [serviceProfileUnits.serviceProfileId],
    references: [serviceProfiles.id],
  }),
  unit: one(units, {
    fields: [serviceProfileUnits.unitId],
    references: [units.id],
  }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  occurrence: one(serviceOccurrences, {
    fields: [trips.serviceOccurrenceId],
    references: [serviceOccurrences.id],
  }),
  evidencePoints: many(evidencePoints),
}));

export const evidencePointsRelations = relations(evidencePoints, ({ one }) => ({
  trip: one(trips, {
    fields: [evidencePoints.tripId],
    references: [trips.id],
  }),
  device: one(devices, {
    fields: [evidencePoints.deviceId],
    references: [devices.id],
  }),
  unit: one(units, {
    fields: [evidencePoints.unitId],
    references: [units.id],
  }),
}));

export const telemetryPointsRelations = relations(telemetryPoints, ({ one }) => ({
  carrier: one(accounts, {
    fields: [telemetryPoints.carrierAccountId],
    references: [accounts.id],
  }),
  device: one(devices, {
    fields: [telemetryPoints.deviceId],
    references: [devices.id],
  }),
  unit: one(units, {
    fields: [telemetryPoints.unitId],
    references: [units.id],
  }),
}));

export const serviceOccurrencesRelations = relations(serviceOccurrences, ({ one }) => ({
  profile: one(serviceProfiles, {
    fields: [serviceOccurrences.serviceProfileId],
    references: [serviceProfiles.id],
  }),
  contract: one(serviceContracts, {
    fields: [serviceOccurrences.contractId],
    references: [serviceContracts.id],
  }),
  trip: one(trips, {
    fields: [serviceOccurrences.id],
    references: [trips.serviceOccurrenceId],
  }),
  complianceFact: one(complianceFacts, {
    fields: [serviceOccurrences.id],
    references: [complianceFacts.serviceOccurrenceId],
  }),
}));

export const complianceFactsRelations = relations(complianceFacts, ({ one }) => ({
  occurrence: one(serviceOccurrences, {
    fields: [complianceFacts.serviceOccurrenceId],
    references: [serviceOccurrences.id],
  }),
  observedUnit: one(units, {
    fields: [complianceFacts.observedUnitId],
    references: [units.id],
  }),
  servedVariant: one(routeKmlVariants, {
    fields: [complianceFacts.servedVariantId],
    references: [routeKmlVariants.id],
  }),
}));
