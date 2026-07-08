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
]);
export const routeStrictnessEnum = pgEnum("route_strictness", [
  "destino_only",
  "kml_full",
]);
export const geofenceRoleEnum = pgEnum("geofence_role", [
  "destino",
  "base",
  "caseta",
  "otro",
]);
export const geofenceOwnerTypeEnum = pgEnum("geofence_owner_type", [
  "plant",
  "carrier",
]);
export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "demo",
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
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startTime: time("start_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const routeShifts = pgTable("route_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientAccountId: uuid("client_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  routeId: uuid("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  deadlineTime: time("deadline_time").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("route_shifts_unique_idx").on(table.routeId, table.shiftId),
]);

export const routeShiftKmlVersions = pgTable("route_shift_kml_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeShiftId: uuid("route_shift_id")
    .notNull()
    .references(() => routeShifts.id, { onDelete: "cascade" }),
  kmlContent: text("kml_content").notNull(),
  waypoints: jsonb("waypoints").$type<Array<{ lat: number; lng: number }>>().notNull().default([]),
  validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

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
  policy: jsonb("policy").$type<import("@jtel/domain").ContractPolicy>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const serviceProfiles = pgTable("service_profiles", {
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
  referenceUnitId: uuid("reference_unit_id").references(() => units.id, {
    onDelete: "set null",
  }),
  activeDays: jsonb("active_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

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
  kmlVersionId: uuid("kml_version_id").references(() => routeShiftKmlVersions.id, {
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
  status: complianceStatusEnum("status").notNull(),
  timing: timingStatusEnum("timing"),
  lateExcusable: boolean("late_excusable").notNull().default(false),
  excusableReason: text("excusable_reason"),
  routeStrictnessApplied: routeStrictnessEnum("route_strictness_applied").notNull(),
  contractPolicySnapshot: jsonb("contract_policy_snapshot")
    .$type<import("@jtel/domain").ContractPolicy>()
    .notNull(),
  materializedAt: timestamp("materialized_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  serviceOccurrenceId: uuid("service_occurrence_id")
    .notNull()
    .references(() => serviceOccurrences.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id"),
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

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  carrierProfile: one(carrierProfiles),
  clientProfile: one(clientProfiles),
  units: many(units),
  devices: many(devices),
  contractsAsCarrier: many(serviceContracts, { relationName: "carrierContracts" }),
  contractsAsClient: many(serviceContracts, { relationName: "clientContracts" }),
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
}));

export const routeShiftsRelations = relations(routeShifts, ({ one, many }) => ({
  route: one(routes, { fields: [routeShifts.routeId], references: [routes.id] }),
  shift: one(shifts, { fields: [routeShifts.shiftId], references: [shifts.id] }),
  kmlVersions: many(routeShiftKmlVersions),
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
