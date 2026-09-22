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
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
/*
 * Los defaults del circuito no se escriben aquí a mano: salen del dominio, que
 * es de donde también los lee la pantalla que los enseña. Dos copias del mismo
 * número —una en el esquema y otra en la interfaz— se separan el día que alguien
 * mueva una, y la pantalla seguiría afirmando el valor viejo.
 */
import { ORIGEN_DEL_CIRCUITO } from "@jtel/domain/publico";

export const accountTypeEnum = pgEnum("account_type", ["carrier", "client", "jstaff", "concesion"]);
/** Ida y vuelta son caminos distintos, no espejo: en el circuito 1 son 20.83 y 16.44 km. */
export const sentidoCircuitoEnum = pgEnum("sentido_circuito", ["ida", "vuelta"]);
/**
 * Entre semana, sábado o domingo — nunca los siete días (Marco 9.1c, decisión
 * de Asav del 20-sep-2026). Un concesionario sabe contestar tres cadencias, no
 * siete; los festivos no entran aquí, son un calendario y una pieza aparte.
 */
export const tipoDeDiaCircuitoEnum = pgEnum("tipo_de_dia_circuito", [
  "entre_semana",
  "sabado",
  "domingo",
]);
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
  /**
   * El mercado de una cuenta de carrier: decide qué catálogo de documentos le
   * aplica (0038). Sólo carriers — un CHECK en la base lo sostiene. Nulo es
   * «todavía sin mercado», y la familia de documentos lo dice en vez de suponer
   * uno.
   */
  marketId: uuid("market_id").references((): AnyPgColumn => markets.id, { onDelete: "restrict" }),
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
  // Proveedor de GPS del carrier. Gobierna `getProviderForCarrier`, por donde
  // pasan el recolector y el archivador.
  //
  //   · `compas`   — la conexión de plataforma a Compás, el Traccar de J-Tel.
  //                  No lleva credencial en la cuenta: vive en el ambiente.
  //                  **Por omisión desde la 0035.**
  //   · `traccar`  — un Traccar ajeno, con la credencial guardada aquí.
  //   · `umbrella` — el de antes del corte del 5 de septiembre de 2026.
  //
  // Hasta la 0035 el valor por omisión era `umbrella`, y una cuenta creada el
  // 14 de septiembre nació leyendo de un proveedor muerto sin que nada avisara.
  gpsProvider: text("gps_provider").notNull().default("compas"),
  gpsBaseUrl: text("gps_base_url"),
  /*
   * Credenciales del proveedor, sea cual sea. El secreto se guarda cifrado
   * (AES-256-GCM) y sólo se descifra en `getGpsCredentials`.
   *
   * Se llamaban `umbrella_user_id` y `umbrella_password_encrypted` hasta la
   * **0034**, y el nombre era una afirmación falsa esperando al segundo
   * proveedor: `gps_provider` decía desde el día uno que el proveedor es una
   * variable del carrier, mientras las columnas de al lado juraban que la
   * credencial es de Umbrella. Un carrier con `gps_provider = 'traccar'` habría
   * guardado su token en una columna que dice Umbrella.
   *
   * Qué es el secreto depende del proveedor, y por eso el nombre no lo dice:
   * para Umbrella es la contraseña; para Traccar puede ser la contraseña o un
   * token de cuenta, que su API acepta igual.
   */
  gpsUserId: text("gps_user_id"),
  gpsPasswordEncrypted: text("gps_password_encrypted"),
  /**
   * Cada cuántos segundos se sondea al proveedor de este carrier.
   *
   * Vive aquí y no en el código porque el sondeo es contra SU proveedor con SUS
   * credenciales: un carrier con otro proveedor y otra cadencia se ajusta desde
   * la pantalla, sin desplegar. 30 s es el valor de hoy para Umbrella, no una ley.
   */
  gpsPollSeconds: integer("gps_poll_seconds").notNull().default(30),
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
  /**
   * El VIN, desde la 0040. Opcional; se guarda normalizado (mayúsculas, sin
   * espacios ni guiones) y es único **por cuenta**, no en la plataforma: el
   * camión es del transportista, y un aviso que dijera «ya existe en otra
   * cuenta» delataría lo que hay del otro lado del muro (ASAV, 18 sep 2026).
   */
  vin: text("vin"),
  jrzPassDriverId: text("jrz_pass_driver_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  /**
   * Ningún nombre repetido en una cuenta (0040). «El mismo» es sin mayúsculas,
   * sin espacios a los lados y con los de en medio contados como uno: la misma
   * regla que `nombreComparable` en @jtel/domain.
   */
  uniqueIndex("units_nombre_unico_por_cuenta").on(
    table.carrierAccountId,
    sql`regexp_replace(lower(btrim(${table.label})), '\\s+', ' ', 'g')`,
  ),
  uniqueIndex("units_vin_unico_por_cuenta").on(table.carrierAccountId, table.vin).where(sql`${table.vin} IS NOT NULL`),
]);

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  imei: text("imei").notNull(),
  label: text("label"),
  /*
   * La baja de un aparato, desde la 0036. **La fila no se borra.**
   *
   * Un aparato que trajo datos es historia: sus puntos, sus asignaciones y los
   * veredictos que se juzgaron con ellos siguen apuntando aquí. Borrarlo
   * arrastraría en cascada sus `device_assignments` y dejaría en null el
   * `device_id` de `telemetry_points`, `evidence_points` y `live_positions` —
   * reescribir la historia—. La baja sólo dice que ya no está en servicio:
   *
   *   · el cotejo con Compás deja de esperarlo, y avisa si vuelve a transmitir;
   *   · la flota lo muestra aparte y no se puede asignar;
   *   · **el motor lo sigue leyendo**, porque un servicio de antes de la baja
   *     se juzga con los puntos que ese aparato trajo.
   *
   * Nació para los 82 aparatos de Umbrella, muertos desde el corte del 5 de
   * septiembre de 2026. Las dos columnas van juntas: una baja sin motivo no es
   * una baja, es una fila que alguien marcó sin decir por qué.
   */
  retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
  retiredReason: text("retired_reason"),
  /** Quién dio la baja (id de usuario). Nulo en las bajas por hoja SQL (0039). */
  retiredBy: text("retired_by"),
  /**
   * El consecutivo global del nombre (Marco 6.3), desde la 0039. Lo entrega
   * `devices_consecutivo_seq`: se asigna una vez y nunca se reutiliza, aunque
   * la inserción que lo pidió falle. Nulo en los dispositivos que no nacieron
   * con nombre generado (los de Umbrella).
   */
  consecutivo: integer("consecutivo"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("devices_carrier_imei_idx").on(table.carrierAccountId, table.imei),
  uniqueIndex("devices_consecutivo_unico").on(table.consecutivo),
  /**
   * Ningún nombre repetido entre los dispositivos EN SERVICIO de una cuenta
   * (0040). Los de baja no compiten: los 77 de Umbrella se llaman todos
   * «umbrella» y su nombre ya es historia.
   */
  uniqueIndex("devices_nombre_unico_en_servicio")
    .on(table.carrierAccountId, sql`regexp_replace(lower(btrim(${table.label})), '\\s+', ' ', 'g')`)
    .where(sql`${table.label} IS NOT NULL AND ${table.retiredAt} IS NULL`),
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
  /** Quién asignó (id de usuario). Nulo en lo anterior a la 0039. */
  asignadaPor: text("asignada_por"),
  /** Quién cerró: al soltar, reasignar o dar de baja. Nulo si fue un guion. */
  cerradaPor: text("cerrada_por"),
  /**
   * Por qué terminó. Lo escribe quien suelta, o el sistema cuando la cierra
   * otra acción (`MOTIVO_SISTEMA`). Se escribe al cerrar, no al abrir.
   */
  motivoCierre: text("motivo_cierre"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("device_assignments_unit_valid_idx").on(table.unitId, table.validFrom),
  index("device_assignments_device_valid_idx").on(table.deviceId, table.validFrom),
  /**
   * Un dispositivo en una sola unidad a la vez, y una unidad con un solo
   * dispositivo (0039). Sin estos candados dos clics simultáneos dejaban dos
   * asignaciones vigentes, y el archivador tomaría cualquiera para decidir de
   * qué unidad es un punto.
   */
  uniqueIndex("device_assignments_dispositivo_una_vigente")
    .on(table.deviceId)
    .where(sql`${table.validTo} IS NULL`),
  uniqueIndex("device_assignments_unidad_una_vigente")
    .on(table.unitId)
    .where(sql`${table.validTo} IS NULL`),
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
  /**
   * Cuántas veces el motor intentó verificar este viaje — **estado, no historia**.
   *
   * Vive aquí y no como entradas del ledger por dos razones, y las dos
   * costaron 4.16 millones de renglones antes de entenderse: `ledger_entries`
   * no tiene `factId`, así que `ledger-pairing.ts` empareja por fecha y una
   * entrada reescrita deja de representar la corrida que produjo el hecho; y
   * los cambios son eventos, no reemplazos — menos todavía en la tabla que
   * existe para ser la historia.
   */
  intentosDeVerificacion: integer("intentos_de_verificacion").notNull().default(0),
  /** Cuándo se intentó la primera vez. Con `ultimoIntentoAt` conserva el «de tal fecha a tal fecha». */
  primerIntentoAt: timestamp("primer_intento_at", { withTimezone: true, mode: "date" }),
  /** Cuándo se intentó la última vez. */
  ultimoIntentoAt: timestamp("ultimo_intento_at", { withTimezone: true, mode: "date" }),
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
  candidatasSnapshot: jsonb("candidatas_snapshot")
    .$type<import("@jtel/domain").CandidatasSnapshot>(),
  /**
   * La densidad de la evidencia con la que se juzgó — Paso 1.
   *
   * Mediana de segundos entre puntos consecutivos del mismo aparato, con la
   * MISMA definición que `medir-cadencia`: si el hecho y el instrumento no
   * midieran lo mismo, comparar el «antes» con el «después» del cambio no
   * querría decir nada.
   *
   * ⚠ **No gobierna.** Es el «piso apagado»: se anota y ningún veredicto la
   * mira. El piso se enciende en el paso 4.
   *
   * **Columna propia y no dentro de `candidatasSnapshot`** aunque saldría más
   * barato: aquél dice «candidatas» y esto es propiedad de la EVIDENCIA. Un
   * campo cuyo nombre no describe su contenido es C15 y C20 otra vez.
   *
   * `null` = no se midió. No se rellena hacia atrás.
   */
  densidadSnapshot: jsonb("densidad_snapshot").$type<{
    huecoMedianaS: number | null;
    huecoPeorS: number | null;
    aparatos: number;
    puntos: number;
  }>(),
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
  /**
   * La cuenta del chofer, copiada de `drivers` (0042). Una llave compuesta en la
   * migración la ata a la de su chofer; existe para que los candados de nombre y
   * licencia puedan ser «únicos por cuenta».
   */
  carrierAccountId: uuid("carrier_account_id").notNull(),
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
}, (table) => [
  /**
   * Ningún nombre ni licencia repetidos entre los choferes activos de una cuenta
   * (0042). Activos son los que tienen credenciales: la baja las purga. Las
   * expresiones son las de `nombreComparable` y `licenciaComparable` en
   * @jtel/domain.
   */
  uniqueIndex("driver_credentials_nombre_unico_por_cuenta").on(
    table.carrierAccountId,
    sql`regexp_replace(lower(btrim(${table.fullName})), '\\s+', ' ', 'g')`,
  ),
  uniqueIndex("driver_credentials_licencia_unica_por_cuenta").on(
    table.carrierAccountId,
    sql`upper(regexp_replace(${table.licenseNumber}, '[\\s-]+', '', 'g'))`,
  ),
]);

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

// ── El expediente: la familia de documentos (0038) ───────────────────────
//
// Marco, Pieza 6 §H y `docs/Ficha-Expedientes.md`, ratificada el 16 de
// septiembre de 2026. Los CHECK, la llave compuesta que sostiene el muro entre
// cuentas y los triggers que impiden editar en sitio viven en la migración;
// aquí se declaran las tablas, las columnas y los índices.

/**
 * Un mercado: país + estado + municipio opcional.
 *
 * Existe porque **el catálogo de documentos no se hornea**: qué papel se exige,
 * si vence y cada cuánto depende de la ley de cada lugar. Cada mercado define
 * el suyo, como cada contrato define su tolerancia.
 *
 * `timeZone` decide el «hoy» de un vencimiento: un papel que vence el 30 es
 * vigente todo el 30 en la hora del mercado, no en UTC.
 */
export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** ISO 3166-1, dos letras: `MX`. */
  countryCode: text("country_code").notNull(),
  /** La clave del estado: `CHH`. */
  stateCode: text("state_code").notNull(),
  /** Sólo para la ley que es de una ciudad. Nulo = el estado entero. */
  municipality: text("municipality"),
  name: text("name").notNull(),
  /** Zona IANA: `America/Ciudad_Juarez`. */
  timeZone: text("time_zone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Un tipo de papel del catálogo de un mercado. La regla vive aparte, versionada. */
export const documentTypes = pgTable("document_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: uuid("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "restrict" }),
  /** `unidad` o `chofer`. */
  subject: text("subject").$type<"unidad" | "chofer">().notNull(),
  /** Identificador estable dentro del mercado: `poliza_de_seguro`. */
  clave: text("clave").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("document_types_mercado_clave_idx").on(table.marketId, table.subject, table.clave),
]);

/**
 * La regla de un tipo, **una fila por versión**. La vigente es la más reciente.
 *
 * Cada campo nulo es «todavía no se carga», y la lectura dice «falta la regla»
 * en vez de suponer. Cambiar una regla agrega una versión con su autor; no
 * reescribe el pasado. La base rechaza el UPDATE.
 */
export const documentTypeRules = pgTable("document_type_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentTypeId: uuid("document_type_id")
    .notNull()
    .references(() => documentTypes.id, { onDelete: "restrict" }),
  required: boolean("required"),
  expires: boolean("expires"),
  /** Días antes del vencimiento en que el papel pasa a «por vencer». Sólo si vence. */
  warningDays: integer("warning_days"),
  /** Cada cuántos meses se renueva, para calcular el vencimiento desde la emisión. Sólo si vence. */
  periodicityMonths: integer("periodicity_months"),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("document_type_rules_tipo_idx").on(table.documentTypeId, table.createdAt),
]);

/**
 * Una foja: un papel de una unidad **o** de un chofer, nunca de los dos.
 *
 * Renovar crea una foja nueva; la anterior queda en el historial. La llave hacia
 * la unidad o el chofer va junto con la cuenta (llave compuesta en la
 * migración): el papel de una cuenta no puede apuntar a la unidad de otra.
 */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  carrierAccountId: uuid("carrier_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  documentTypeId: uuid("document_type_id")
    .notNull()
    .references(() => documentTypes.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id"),
  driverId: uuid("driver_id"),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("documents_cuenta_idx").on(table.carrierAccountId),
]);

/**
 * Las versiones de una foja. Corregir crea una versión nueva; la vigente es la
 * más reciente, y las anteriores quedan con su autor.
 *
 * `expiryCalculated` dice que `expiresOn` no venía en el papel: se calculó
 * desde la emisión con la periodicidad de la regla, y la pantalla lo dice.
 */
export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  folio: text("folio"),
  issuedOn: date("issued_on"),
  expiresOn: date("expires_on"),
  expiryCalculated: boolean("expiry_calculated").notNull().default(false),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("document_versions_foja_idx").on(table.documentId, table.createdAt),
]);

/** Fila completa de un hecho de cumplimiento. La foto que archiva la Pieza 1 debe ser fiel a esto. */
export type ComplianceFact = typeof complianceFacts.$inferSelect;

/**
 * La pausa de la verificación de un contrato — eventos, no una palomita (0041,
 * 19 sep 2026). Pausar agrega un evento; reanudar agrega otro. El estado se lee
 * del último evento cuya `valeDesde` ya empezó.
 *
 * Mientras está en pausa el motor no genera ocurrencias del contrato ni sella
 * nada de él. Lo ya sellado no se toca.
 *
 * `valeDesde` y `registradoAt` son dos fechas distintas a propósito: la pausa
 * del primer uso vale desde el 5 sep 2026 (el día que la telemetría murió) y se
 * registró días después.
 *
 * La base sostiene lo que el código revisa: los eventos se alternan, van hacia
 * adelante, no valen en el futuro y no se editan (triggers de la 0041).
 *
 * No confundir con `serviceContracts.status = "suspended"`: ésa es una etiqueta
 * comercial que ningún proceso lee.
 */
export const contractVerificationEvents = pgTable(
  "contract_verification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => serviceContracts.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<"pausa" | "reanudacion">().notNull(),
    valeDesde: timestamp("vale_desde", { withTimezone: true, mode: "date" }).notNull(),
    motivo: text("motivo"),
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    registradoAt: timestamp("registrado_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("cve_contrato_idx").on(table.contractId, table.valeDesde)],
);

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

/**
 * Última posición conocida por aparato — el camino propio de la app pública.
 *
 * **No es histórico y no crece: se sobrescribe.** El histórico sigue siendo
 * `telemetryPoints`, que llena el archivador cada 10 minutos. La app del
 * pasajero no puede leer aquello: medido el 26 de agosto de 2026, el archivador
 * mete un p99 de 12.84 min de retraso, y una posición congelada doce minutos es
 * la mentira que el Tramo JB prohíbe.
 */
export const livePositions = pgTable(
  "live_positions",
  {
    imei: text("imei").primaryKey(),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    /** Cuándo el aparato tomó el fix. De aquí sale la antigüedad que decide si está fresco. */
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Cuándo lo recogimos. `collectedAt - recordedAt` es el retraso de nuestro propio camino. */
    collectedAt: timestamp("collected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("live_positions_carrier_recorded_idx").on(table.carrierAccountId, table.recordedAt),
  ],
);


// ─────────────────────────────────────────────────────────────────────────────
// Transporte concesionado — Tramo JB. Nada de esto toca el transporte especial.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perfil de una concesión. La concesión **no es tabla propia**: es un `accounts`
 * de tipo `concesion`, para heredar membresías, alcance y ledger sin duplicar
 * expediente.
 */
export const concessionProfiles = pgTable("concession_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" })
    .unique(),
  legalName: text("legal_name").notNull(),
  /** Opcional a propósito: un concesionario invitado puede entrar antes de formalizar. */
  numeroConcesion: text("numero_concesion"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Muchos-a-muchos concesión ↔ carrier, con vigencia. */
export const concessionCarriers = pgTable(
  "concession_carriers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    concessionAccountId: uuid("concession_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("concession_carriers_concession_idx").on(table.concessionAccountId, table.validTo),
    index("concession_carriers_carrier_idx").on(table.carrierAccountId, table.validTo),
  ],
);

/**
 * Circuito. **Pertenece a la concesión, no al carrier.** Quién lo opera hoy lo
 * dice `circuitUnitAssignments`.
 *
 * Los tres campos configurables son campos y no constantes por la regla del
 * tramo: nada hardcodeado. Los defaults son los del circuito 1.
 */
export const circuits = pgTable(
  "circuits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    concessionAccountId: uuid("concession_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Va en la URL pública y en el QR impreso. No se cambia después de imprimir. */
    publicSlug: text("public_slug").notNull().unique(),
    /** En minutos: es una promesa pública, y en minutos se promete. */
    /*
     * `declared_frequency_minutes` se borró en la 0050: la promesa tiene una sola
     * fuente, las franjas (`circuit_promise_tables`, decisión de Asav del 21 sep
     * 2026). La valla `guardia-promesa-una-fuente` impide que vuelva.
     */
    /** En segundos: la prueba de campo puede pedir afinarlo por debajo del minuto. */
    staleAfterSeconds: integer("stale_after_seconds")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.frescuraSegundos),
    /** En segundos, por la misma razón. Es el piso; la varianza de tráfico se suma encima. */
    arrivalRangeFloorSeconds: integer("arrival_range_floor_seconds")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.pisoDelRangoSegundos),
    /**
     * A partir de cuántos metros del trazado el pegado de una parada deja de ser
     * obvio y la pantalla avisa, ofreciendo soltarlo. Por circuito porque una
     * calle del Centro y una avenida no admiten el mismo margen.
     */
    stopSnapToleranceMeters: doublePrecision("stop_snap_tolerance_meters")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.pegadoDeParadasMetros),
    /**
     * A cuántos metros del trazado deja de poderse afirmar que una unidad va en
     * la ruta. Más allá de esto **no se publica al pasajero**: misma ley que el
     * dato viejo — si el sistema no puede afirmarlo, no lo dibuja.
     *
     * **No es `stopSnapToleranceMeters`**, y confundirlas rompe la app. Aquélla
     * es para que una persona coloque una parada a mano sobre un mapa quieto, y
     * por eso son 25 m. Un camión en movimiento trae error de GPS, va por el
     * carril de la orilla, y el trazado que lo juzga tiene sus propios huecos
     * entre vértices: con 25 m no se publicaría casi nada.
     */
    corridorToleranceMeters: doublePrecision("corridor_tolerance_meters")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.corredorEnRutaMetros),
    /**
     * Cuánto tiempo después de ver una unidad **dentro del corredor** se puede
     * seguir afirmando que hay servicio. Pasado esto el circuito cae a SIN
     * SERVICIO y la app deja de prometer cadencia.
     *
     * No se deriva de la frecuencia: derivarla acoplaría dos perillas con
     * significados distintos, y quien afinara la frecuencia movería sin saberlo
     * cuánto tiempo la app sigue afirmando que hay servicio.
     */
    serviceConfidenceMinutes: integer("service_confidence_minutes")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.confianzaMinutos),
    /**
     * Cuánto se perdona alrededor del intervalo esperado, al juzgar un paso
     * contra la frecuencia prometida (Marco 9.2, decisión de Asav 20-sep):
     * **porcentaje de la frecuencia, no segundos fijos** — 2 min de tolerancia
     * sobre «cada 10» es el 20 %; sobre «cada 30» no es nada. `50` = ±50 %.
     *
     * **Por circuito, nunca escondida en el código.** Nace ANCHA a propósito:
     * la primera medición es de un servicio nuevo, y una banda estrecha desde
     * el día uno pintaría todo rojo sin que el servicio hubiera fallado. Se
     * aprieta con semanas medidas — misma lógica que la tolerancia del
     * transporte especial, que tampoco nació ajustada a ciegas.
     */
    arrivalTolerancePct: doublePrecision("arrival_tolerance_pct")
      .notNull()
      .default(ORIGEN_DEL_CIRCUITO.toleranciaLlegadaPct),
    /**
     * Desde cuándo el circuito muestra el **rango** de llegada al pasajero.
     * `null` = apagado: se ve el camión moverse en el mapa —verdad observada—
     * pero no el minuto estimado, que depende de una velocidad todavía sin
     * calibrar contra la calle. Hermana del interruptor de publicación.
     */
    arrivalRangeEnabledAt: timestamp("arrival_range_enabled_at", { withTimezone: true }),
    /**
     * Cuántos minutos seguidos fuera del corredor cuentan como **salida** en la
     * jornada de una unidad (0051, A4b). Menos que esto es el brinco del GPS.
     * Nació como constante (3, PR B) y es columna para calibrarla con camiones
     * reales; cambiarla queda en `circuit_rule_changes` con su motivo.
     */
    corridorExitMinutes: integer("corridor_exit_minutes").notNull().default(ORIGEN_DEL_CIRCUITO.minutosFueraDelCorredor),
    /**
     * Velocidad EFECTIVA de avance, en km/h: desplazamiento entre tiempo, con
     * las paradas y los semáforos adentro. Es lo que responde «en cuánto
     * llega»; la instantánea no responde eso.
     *
     * Punto de partida del rango de llegada — el teléfono la corrige con lo que
     * mide. **No reutiliza `routeAvgSpeedKmh`** de la política del contrato:
     * ése es de la modalidad especial, y afinar uno movería el otro.
     *
     * El default 20.5 está medido (9 118 ventanas, 35 aparatos, 14 días) sobre
     * la flota que reporta, **no sobre este circuito**. Se calibra en la calle.
     */
    avgSpeedKmh: doublePrecision("avg_speed_kmh").notNull().default(ORIGEN_DEL_CIRCUITO.velocidadKmh),
    /**
     * El color con que se identifica la ruta en el mapa y en la app.
     *
     * Por circuito y no en el código: con más rutas, cada una lleva el suyo, y
     * el pasajero las distingue por color antes que por nombre. Un hex aquí
     * inválido no revienta nada — pinta una ruta invisible, que es peor—, así
     * que lo comprueba un CHECK de la base.
     */
    colorHex: text("color_hex").notNull().default(ORIGEN_DEL_CIRCUITO.colorHex),
    /**
     * El día en que arranca el servicio de este circuito. `null` = **ya opera**.
     *
     * Es el escalón que faltaba: un circuito sólo podía estar invisible o
     * presentado como si operara. Con fecha en el futuro la app enseña el
     * recorrido y lo declarado, dice que arranca ese día, y **no cae a “sin
     * evidencia”** — no hay nada que evidenciar todavía.
     *
     * **No se llama `service_start_*` a propósito**, y la distancia del nombre
     * es la defensa. `service_start_local` es la HORA a la que abre cada día;
     * ésta es el DÍA en que el servicio existe por primera vez. Un nombre
     * hermano dejaría que quien busca «el start» encuentre el que no es y lo
     * mueva — que es exactamente lo que ya pasó con las dos «tolerancias»
     * (`stop_snap` y `corridor`), y por eso ninguna de las dos se llama así.
     *
     * **Sin default, y por la misma razón que la frecuencia declarada.** Un
     * valor de origen aquí volvería indistinguibles «el concesionario declaró
     * esta fecha» y «la trajo la columna», y la app la dice en voz alta. Por
     * eso tampoco está en `ORIGEN_DEL_CIRCUITO`: no tiene valor de origen.
     */
    serviceLaunchDate: date("service_launch_date"),
    serviceStartLocal: time("service_start_local").notNull().default(ORIGEN_DEL_CIRCUITO.horaInicioLocal),
    serviceEndLocal: time("service_end_local").notNull().default(ORIGEN_DEL_CIRCUITO.horaFinLocal),
    timeZone: text("time_zone").notNull().default(ORIGEN_DEL_CIRCUITO.zonaHoraria),
    active: boolean("active").notNull().default(true),
    /**
     * Desde cuándo el circuito es visible para la app del pasajero.
     *
     * `null` = **creado pero no publicado**: el endpoint público contesta como
     * si el slug no existiera. Es lo que permite armar el circuito por partes
     * —trazado, paradas, unidades— y probar el endpoint con datos reales sin
     * que aparezca en la app.
     *
     * **No confundir con `active`**, que es dado de baja. Un circuito puede
     * estar vivo y sin publicar durante días, y ése es el caso normal mientras
     * se arma. `active` además nace en `true`, así que no serviría de puerta:
     * publicaría solo por existir.
     */
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("circuits_concession_idx").on(table.concessionAccountId, table.active),
    /** Por dónde entra el endpoint público: slug, y solo entre los publicados. */
    index("circuits_publicados_idx")
      .on(table.publicSlug)
      .where(sql`${table.publishedAt} IS NOT NULL`),
  ],
);

/**
 * **Aperturas de la app, por día y por circuito.** El contador anónimo.
 *
 * Una fila = un aparato distinguible que abrió esta ruta ese día. La rotación
 * diaria de la huella es lo que impide que esto se vuelva otra cosa: **no se
 * puede seguir a un aparato entre días**, así que de aquí no sale «cuántos
 * volvieron» ni por accidente ni a propósito. Medir regresos sería otro
 * producto, con su propio consentimiento.
 *
 * ## Nada de esto se guarda en el teléfono
 *
 * Ni cookie, ni `localStorage`, ni identificador que viaje. La huella la deriva
 * el servidor de lo que la petición ya trae —IP y agente— con
 * `huellaDeApertura`, y por eso el aparato no tiene que recordar nada para que
 * su segunda apertura del día no cuente dos veces.
 *
 * ## Dos cifras, y sólo una se enseña
 *
 * `open_count` es el crudo: cuántas veces se abrió desde esa misma huella ese
 * día. **No se enseña**, y no es un dato de reserva: es el detector. El
 * `Procedimiento-Firewall-Publico` dejó escrito que el límite de tasa «no
 * protege contra un raspado lento y distribuido», y **la distancia entre el
 * crudo y las filas es la única señal que queda**: un guion inflando el crudo
 * sin mover el conteo de filas es exactamente lo que se ve desde aquí.
 *
 * Presentar el crudo como uso sería el error que este contador vino a evitar.
 * Guardarlo y callarlo es lo contrario: la pantalla enseña lo que se sostiene y
 * el instrumento conserva con qué dudar de sí mismo.
 */
export const circuitOpens = pgTable(
  "circuit_opens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    /**
     * El día CIVIL DEL CIRCUITO, no el del servidor. Es la misma fecha con la
     * que rota la huella, así que si aquí se guardara otra, la unicidad de abajo
     * dejaría de corresponder con lo que la huella distingue.
     */
    localDate: date("local_date").notNull(),
    /** HMAC del día, la ruta y lo que la petición ya traía. Ver `huellaDeApertura`. */
    fingerprint: text("fingerprint").notNull(),
    /** El crudo. Se guarda, no se enseña — ver el encabezado. */
    openCount: integer("open_count").notNull().default(1),
    firstOpenAt: timestamp("first_open_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastOpenAt: timestamp("last_open_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /* La deduplicación vive EN LA BASE y no en el código que inserta: es lo que
       hace que dos peticiones simultáneas del mismo aparato no produzcan dos
       filas, y lo que convierte «contar filas» en una definición y no en una
       esperanza. */
    uniqueIndex("circuit_opens_un_dia").on(table.circuitId, table.localDate, table.fingerprint),
    index("circuit_opens_resumen_idx").on(table.circuitId, table.localDate),
  ],
);

/** El trazado de un sentido. Uno por sentido: ida y vuelta no son espejo. */
export const circuitPaths = pgTable(
  "circuit_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    sentido: sentidoCircuitoEnum("sentido").notNull(),
    /** `[[lon, lat], ...]` en el orden del recorrido. */
    coordinates: jsonb("coordinates").$type<Array<[number, number]>>().notNull(),
    pointCount: integer("point_count").notNull(),
    lengthMeters: doublePrecision("length_meters").notNull(),
    /**
     * De qué capa del KML salió, **según la escogió un humano en la pantalla**.
     * Se guarda para auditar la decisión, nunca para tomarla por nombre: el KML
     * del circuito 1 trae cuatro capas y dos son una versión burda que no sirve.
     */
    sourceLayerName: text("source_layer_name"),
    sourceFileName: text("source_file_name"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("circuit_paths_un_sentido").on(table.circuitId, table.sentido)],
);

/**
 * IDENTIDAD de una parada: lo que el QR impreso señala.
 *
 * El `qrSlug` vive aquí y no en la versión **porque va impreso en un letrero de
 * lámina atornillado a un poste**. Si la parada se mueve media cuadra, el
 * letrero sigue siendo el mismo y su QR tiene que seguir funcionando. Nombre y
 * posición viven en `circuitStopVersions` y cambian con vigencia.
 *
 * Las paradas son **referencias con nombre, no la unidad de cálculo**: en
 * Juárez el camión se detiene donde el pasajero lo pide, así que la llegada se
 * calcula proyectando la unidad sobre el trazado. Un circuito funciona con
 * pocas paradas o con ninguna.
 */
export const circuitStops = pgTable(
  "circuit_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    qrSlug: text("qr_slug").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Retirar una parada tampoco borra: se marca y deja de publicarse. */
    retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("circuit_stops_circuit_idx").on(table.circuitId)],
);

/**
 * Versión de una parada: su nombre y su lugar, con vigencia.
 *
 * Mover o renombrar **no sobrescribe**: cierra la versión anterior con su
 * `validTo` y abre una nueva. Misma forma que la política del contrato y las
 * variantes de trazado — cambia hacia adelante, el pasado no se reescribe, y el
 * pasajero siempre ve la vigente.
 *
 * Existe porque las paradas cambian seguido en la vida real: obra en una
 * avenida, calle cerrada, ajuste de operación.
 */
export const circuitStopVersions = pgTable(
  "circuit_stop_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stopId: uuid("stop_id")
      .notNull()
      .references(() => circuitStops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orden: integer("orden").notNull(),
    /** NULL = sirve en los dos sentidos. */
    sentido: sentidoCircuitoEnum("sentido"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    /** Por qué cambió, cuando quien la movió se molesta en decirlo. */
    motivo: text("motivo"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("circuit_stop_versions_stop_idx").on(table.stopId, table.validTo),
    /**
     * Una sola versión vigente por parada. La garantía de que «la parada 7 de
     * hoy» nunca sea ambigua la da la base, no el código de turno.
     */
    uniqueIndex("circuit_stop_versions_una_vigente")
      .on(table.stopId)
      .where(sql`${table.validTo} IS NULL`),
  ],
);

/**
 * Qué unidad corre qué circuito y bajo qué carrier.
 *
 * Para el pasajero es invisible. Para el sistema es la puerta de entrada de los
 * concesionarios invitados, y **el filtro que decide qué unidades se publican**:
 * fuera de asignación o fuera de horario, una unidad no existe para el público.
 */
export const circuitUnitAssignments = pgTable(
  "circuit_unit_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    /**
     * Por qué TERMINÓ la asignación. Se escribe al cerrar, no al abrir: al
     * abrir todavía no hay nada que explicar. Es lo que convierte una fecha en
     * historial de la concesión.
     */
    motivo: text("motivo"),
    /** Quién abrió (id de usuario). Nulo en lo anterior a la 0048. */
    asignadaPor: text("asignada_por"),
    /**
     * Quién cerró: al soltar, o al reasignar la unidad a otro circuito. Nulo en
     * lo anterior a la 0048 o si la cerró un guion. Existe porque el carrier
     * puede jalar su camión de un circuito de otra concesión, y esa concesión
     * tiene que poder leer quién se lo llevó.
     */
    cerradaPor: text("cerrada_por"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("circuit_unit_assignments_circuit_idx").on(table.circuitId, table.validTo),
    index("circuit_unit_assignments_unit_idx").on(table.unitId, table.validTo),
    /**
     * Una sola asignación vigente por unidad. Un camión corre un circuito a la
     * vez, y sin este candado una unidad con dos filas abiertas se publica en
     * dos circuitos — el filtro del endpoint público la vería en ambos. La
     * garantía la da la base, no el código de turno.
     */
    uniqueIndex("circuit_unit_assignments_una_vigente")
      .on(table.unitId)
      .where(sql`${table.validTo} IS NULL`),
  ],
);

/**
 * **El registro de las reglas de la medición** (0051, A4b — ASAV, 21-sep-2026):
 * quién cambió qué regla de un circuito, cuándo, de qué valor a qué valor y
 * por qué. Las reglas son las que deciden qué cuenta como «pasó»: los ajustes
 * de medición, la tolerancia de llegada, los minutos fuera del corredor, el
 * tiempo estimado, y el horario, la zona y la fecha de arranque. El nombre y el
 * color no entran: no cambian la medición.
 *
 * **El «antes» sale de la base, no del formulario** (ASAV): se lee la fila
 * dentro de la misma transacción que escribe, y sólo se registra lo que de
 * verdad cambió. El motivo es obligatorio también aquí (CHECK), no sólo en la
 * pantalla. Nada de lo anterior a la 0051 tiene renglón: no se inventa.
 */
export const circuitRuleChanges = pgTable(
  "circuit_rule_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    /** El nombre de la columna del circuito que cambió. */
    regla: text("regla").notNull(),
    valorAntes: text("valor_antes"),
    valorDespues: text("valor_despues"),
    motivo: text("motivo").notNull(),
    cambiadoPor: text("cambiado_por").notNull(),
    cambiadoEn: timestamp("cambiado_en", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // El CHECK del motivo vive en la 0051, como los demás CHECK del esquema.
    index("circuit_rule_changes_circuito_idx").on(table.circuitId, table.cambiadoEn),
  ],
);

/**
 * El resumen de los **recorridos por tramo** de un circuito (0053; Marco 8.16.5).
 *
 * De una parada a la siguiente, en un sentido: cuánto tarda, agregado sobre los
 * últimos días. Lo escribe el cron `/api/cron/recorridos`, que es el único que
 * lee los pasos del detector para esto; lo lee la app del pasajero, que **nunca
 * toca esa evidencia** (muro de cuenta, 9.14 — camino escogido por ASAV el
 * 22-sep).
 *
 * **Sin unidad y sin transportista**: lo que no se guarda no se puede filtrar.
 * Un renglón por tramo (unicidad), que el cron reemplaza en cada corrida. Los
 * CHECK (travesías > 0, el rango ordenado, la ventana con sentido, paradas
 * distintas) viven en la 0053, como los demás del esquema.
 */
export const circuitLegTimes = pgTable(
  "circuit_leg_times",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    sentido: sentidoCircuitoEnum("sentido").notNull(),
    deStopId: uuid("de_stop_id")
      .notNull()
      .references(() => circuitStops.id, { onDelete: "cascade" }),
    aStopId: uuid("a_stop_id")
      .notNull()
      .references(() => circuitStops.id, { onDelete: "cascade" }),
    travesias: integer("travesias").notNull(),
    desdeSeg: integer("desde_seg").notNull(),
    medianaSeg: integer("mediana_seg").notNull(),
    hastaSeg: integer("hasta_seg").notNull(),
    ventanaDesde: timestamp("ventana_desde", { withTimezone: true, mode: "date" }).notNull(),
    ventanaHasta: timestamp("ventana_hasta", { withTimezone: true, mode: "date" }).notNull(),
    detectorVersion: text("detector_version").notNull(),
    calculadoEn: timestamp("calculado_en", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("circuit_leg_times_un_tramo_idx").on(table.circuitId, table.sentido, table.deStopId, table.aStopId),
    index("circuit_leg_times_circuito_idx").on(table.circuitId, table.sentido),
  ],
);

/**
 * Los avisos de la concesión al pasajero, por circuito (0052; Marco 8.13b).
 *
 * J-Staff los captura en el expediente del circuito, de parte de la
 * concesión; en Ontoy se leen «según la concesión», con su fecha. Firmados.
 * **No se editan: se retiran con motivo**, para que quede qué se le dijo al
 * pasajero y cuándo. Los CHECK (título 1–80, detalle ≤280, vigencia, retiro
 * completo o nada) viven en la 0052, como los demás CHECK del esquema.
 */
export const circuitNotices = pgTable(
  "circuit_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    detalle: text("detalle"),
    vigenteDesde: timestamp("vigente_desde", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    vigenteHasta: timestamp("vigente_hasta", { withTimezone: true, mode: "date" }),
    capturadoPor: text("capturado_por").notNull(),
    capturadoEn: timestamp("capturado_en", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    retiradoEn: timestamp("retirado_en", { withTimezone: true, mode: "date" }),
    retiradoPor: text("retirado_por"),
    motivoRetiro: text("motivo_retiro"),
  },
  (table) => [index("circuit_notices_circuito_idx").on(table.circuitId, table.vigenteDesde)],
);

/**
 * La promesa de un circuito por franja horaria (Marco 9.1c, 0044).
 *
 * **La identidad de la promesa: el conjunto, no la franja.** Decisión de Asav
 * (20-sep-2026): «la promesa se lee completa, y la pregunta que importa es
 * qué prometíamos tal día». Versionar por franja permitiría una promesa
 * Frankenstein mezclando dos versiones —una franja corregida hoy junto a otra
 * que sigue de la semana pasada—, y «la promesa del 12 de octubre» dejaría de
 * tener una sola respuesta. Por eso la vigencia vive AQUÍ, en la tabla que
 * agrupa, no en `circuit_promise_bands`: cambiar una sola franja cierra esta
 * fila entera y abre otra, con todas sus franjas de nuevo.
 *
 * Misma forma que ya usa la casa —`circuit_stop_versions`, la política del
 * contrato—: cambiar no sobrescribe, cierra la vigente y abre la nueva.
 */
export const circuitPromiseTables = pgTable(
  "circuit_promise_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    /** Por qué TERMINÓ esta versión de la promesa. Se escribe al cerrar. */
    motivo: text("motivo"),
    /**
     * Quién capturó esta versión (id de usuario, 0049). Quien la cerró es quien
     * capturó la siguiente: guardar una promesa nueva es lo único que cierra la
     * vigente. Nulo en lo anterior a la 0049.
     */
    capturadaPor: text("capturada_por"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("circuit_promise_tables_circuit_idx").on(table.circuitId, table.validTo),
    /**
     * Una sola tabla de promesa vigente por circuito. Sin este candado, dos
     * filas abiertas a la vez volverían ambigua «la promesa vigente hoy» —
     * exactamente lo que 9.1c existe para que nunca lo sea.
     */
    uniqueIndex("circuit_promise_tables_una_vigente")
      .on(table.circuitId)
      .where(sql`${table.validTo} IS NULL`),
  ],
);

/**
 * Una franja dentro de una versión de la promesa: «cada N minutos, de tal
 * hora a tal hora, tal tipo de día, tal sentido».
 *
 * **No lleva vigencia propia** — la de `circuitPromiseTables` es la única que
 * cuenta, a propósito (ver el comentario de esa tabla).
 *
 * **El horario de servicio del circuito manda** (decisión de Asav, 20-sep):
 * una franja fuera de `circuits.service_start_local`/`service_end_local` se
 * rechaza al capturar, con su razón en pantalla — la base no lo impide con un
 * CHECK porque cruza tablas, y `franjaDentroDelHorario` en `@jtel/domain` es
 * quien lo decide antes de insertar. Y un hueco del horario que ninguna
 * franja cubra es «sin promesa declarada» para ese tramo: `promesaEnInstante`
 * lo dice así, y no se rellena con la franja vecina.
 */
export const circuitPromiseBands = pgTable(
  "circuit_promise_bands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promiseTableId: uuid("promise_table_id")
      .notNull()
      .references(() => circuitPromiseTables.id, { onDelete: "cascade" }),
    diaTipo: tipoDeDiaCircuitoEnum("dia_tipo").notNull(),
    /** NULL = promete igual en los dos sentidos. */
    sentido: sentidoCircuitoEnum("sentido"),
    desdeLocal: time("desde_local").notNull(),
    hastaLocal: time("hasta_local").notNull(),
    frequencyMinutes: integer("frequency_minutes").notNull(),
  },
  (table) => [index("circuit_promise_bands_table_idx").on(table.promiseTableId)],
  /*
   * Dos CHECK viven en la migración SQL, no aquí — como el resto de la casa
   * (`circuits_frecuencia_positiva` y compañía nunca se declaran con drizzle):
   * frecuencia positiva, y que la franja no cruce medianoche
   * (`desde_local < hasta_local`; ver `franjaDentroDelHorario` en
   * `@jtel/domain` sobre por qué es la simplificación de esta primera
   * versión).
   */
);

/**
 * Un cruce de una unidad sobre la abscisa de una parada (Marco 9.2 / 9.11,
 * 0045) — el eslabón 2 de la cadena del arranque.
 *
 * **Detección por cruce sobre el trazado** (decisión de Asav, 19-sep): no por
 * radio. Medido: los FTC927 dan 15–61 m entre puntos con el camión andando,
 * pero los huecos siguen ahí (hasta 75 h en una semana), y el hueco es
 * justo donde está la parada — donde el camión se detiene. El cruce no se
 * salta ninguna, porque ocurre entre los dos puntos que encierran el hueco.
 *
 * **EL PASO ES UN RANGO, no un instante.** No hay `passed_at`: el instante
 * no existe —el instrumento no lo mide—, y darle una columna propia invita a
 * leerlo como si existiera. `paso_desde`/`paso_hasta` son los dos pings que
 * encierran el cruce; `hueco_segundos` es su ancho, guardado calculado
 * además de derivable porque filtrar «pasos con hueco < 1 min» sin él pelea
 * con el plan de la consulta — que en esta casa ya costó caro una vez.
 *
 * **La evidencia se guarda, no el resumen**: los dos pings de origen, para
 * poder recalcular sin perder el día si el detector mejora.
 *
 * **No lleva veredicto.** En esta etapa nada se sella (9.3): la comparación
 * banda contra banda contra la promesa (`circuit_promise_bands`) se calcula
 * al leer, contra la franja vigente en `paso_desde` — no se guarda aquí.
 *
 * **`detector_version` es lo que permite apilar, no pisar** (principio de la
 * casa): si el detector se corrige y se vuelve a correr sobre los mismos
 * días, la corrida nueva no borra la anterior. Sin candado de unicidad a
 * propósito: dos corridas de la MISMA versión sobre los mismos pings sí
 * producirían pasos duplicados, y eso se decide cuándo se construya el
 * orquestador que llama al detector — aquí sólo vive el hecho.
 */
export const circuitStopPasses = pgTable(
  "circuit_stop_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    stopId: uuid("stop_id")
      .notNull()
      .references(() => circuitStops.id, { onDelete: "cascade" }),
    /** La parada COMO ESTABA cuando se detectó — no se sigue a la vigente de hoy. */
    stopVersionId: uuid("stop_version_id")
      .notNull()
      .references(() => circuitStopVersions.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    sentido: sentidoCircuitoEnum("sentido").notNull(),
    pasoDesde: timestamp("paso_desde", { withTimezone: true, mode: "date" }).notNull(),
    pasoHasta: timestamp("paso_hasta", { withTimezone: true, mode: "date" }).notNull(),
    huecoSegundos: integer("hueco_segundos").notNull(),
    /**
     * `set null` y no `cascade`: si un punto se purga del archivo, el paso
     * detectado —el hecho de que la unidad cruzó ahí— no debe desaparecer con
     * él. Lo que se pierde es sólo el enlace a la evidencia cruda.
     */
    pingPrevioId: uuid("ping_previo_id").references(() => telemetryPoints.id, { onDelete: "set null" }),
    pingSiguienteId: uuid("ping_siguiente_id").references(() => telemetryPoints.id, {
      onDelete: "set null",
    }),
    detectorVersion: text("detector_version").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("circuit_stop_passes_stop_idx").on(table.stopId, table.pasoDesde),
    index("circuit_stop_passes_unit_idx").on(table.unitId, table.pasoDesde),
    index("circuit_stop_passes_circuit_idx").on(table.circuitId, table.pasoDesde),
    /*
     * CHECK `paso_hasta >= paso_desde` vive en la migración SQL, como el
     * resto de la casa (ver el comentario de `circuit_promise_bands` arriba).
     */
  ],
);

/**
 * Hasta dónde ya detectó pasos el orquestador, por circuito, unidad y versión
 * del detector (0047).
 *
 * **No es «hasta qué hora corrió»: es el `recorded_at` del ÚLTIMO PING
 * CONSUMIDO.** Un cruce es el par de pings consecutivos que lo encierran. Con
 * un marcador en la hora de la ronda, el par formado por el último ping de una
 * ventana y el primero de la siguiente no cae en ninguna de las dos, y el
 * cruce se pierde sin decirlo. Con el marcador en el último ping, la ventana
 * siguiente arranca EN ese ping (inclusive): el par se detecta una vez, ni
 * perdido ni repetido.
 *
 * **`detector_version` va en la llave.** Subir la versión arranca limpio, sin
 * borrar nada de lo anterior — es como se re-corre sin pisar (los pasos apilan
 * por esa misma versión).
 *
 * **No es** `telemetry_watermarks` (la del recolector) ni
 * `telemetry_imei_watermarks` (la del relleno): compartir marcador es como el
 * relleno le brincaba ventanas al archivador (lección del 15-sep).
 */
export const circuitDetectionMarks = pgTable(
  "circuit_detection_marks",
  {
    circuitId: uuid("circuit_id")
      .notNull()
      .references(() => circuits.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    detectorVersion: text("detector_version").notNull(),
    lastPingAt: timestamp("last_ping_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.circuitId, table.unitId, table.detectorVersion] })],
);

/**
 * Hasta dónde le preguntó el archivador al proveedor por cada aparato (0037).
 *
 * **No es el último punto del aparato**: es el fin de la última ventana que el
 * proveedor contestó para él, con puntos o sin ellos. Sólo avanza cuando esa
 * lectura salió bien, así que un aparato que no contesta, o que se quedó sin
 * leer porque la corrida se acabó, conserva su marca y la corrida siguiente lo
 * retoma desde ahí.
 *
 * No es `telemetryImeiWatermarks`: ésa la mueve el relleno de huecos hasta el
 * final de cada hueco revisado, y compartirla haría que el relleno le brincara
 * ventanas al archivador.
 */
export const telemetryArchiveMarks = pgTable(
  "telemetry_archive_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    imei: text("imei").notNull(),
    readUntil: timestamp("read_until", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("telemetry_archive_marks_carrier_imei_idx").on(
      table.carrierAccountId,
      table.imei,
    ),
  ],
);

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

/** Estado de una aportación del transportista. `resuelta` = la planta contestó. */
export const aportacionEstadoEnum = pgEnum("aportacion_estado", [
  "enviada",
  "vista",
  "resuelta",
  "retirada",
]);

/**
 * La versión del transportista sobre un servicio — el frente de reconciliación.
 *
 * Hoy el árbitro dice «no pude» y ahí se acaba: el auditado mira una acusación
 * que **el sistema mismo admite no poder sostener** y no puede aportar nada.
 * Esto es donde la pone.
 *
 * ⚠ **Agrega CONTEXTO. Nunca cambia un veredicto**, y la forma de la tabla lo
 * hace cumplir: **no referencia `complianceFacts`** ni guarda estado de
 * cumplimiento. Cuelga de la OCURRENCIA —el servicio—, no del hecho. Si algún
 * día alguien quiere que una aportación mueva el resultado, tiene que escribir
 * una migración nueva, que es justo la fricción que se busca: si el auditado
 * puede cambiar su calificación, J-Telemetry deja de ser árbitro.
 *
 * ⚠ **Y `resuelta` NO significa «aceptada»:** significa que la planta contestó.
 * Qué consecuencia tiene es enforcement, y está sin decidir.
 *
 * **No se borra nada.** Retirar es un estado, no un `DELETE`: lo que se dijo se
 * dijo, y una reconciliación que se puede borrar no reconcilia nada.
 *
 * **Es hermana de `occurrenceGroundTruth` y no la misma cosa:** aquélla guarda
 * el veredicto del OPERADOR y ésta la versión del TRANSPORTISTA. Misma forma,
 * otra voz — juntarlas sería C20 otra vez.
 */
export const carrierAportaciones = pgTable(
  "carrier_aportaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceOccurrenceId: uuid("service_occurrence_id")
      .notNull()
      .references(() => serviceOccurrences.id, { onDelete: "cascade" }),
    carrierAccountId: uuid("carrier_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    /**
     * Código del excusable que **la política del contrato ya define** — hoy 6 en
     * un contrato y 5 en el otro. Se valida contra ella al escribir, no aquí: un
     * catálogo en la base sería un segundo lugar donde vive la misma lista.
     * Nullable a propósito: se puede aportar contexto sin que ninguno aplique.
     */
    motivo: text("motivo"),
    nota: text("nota"),
    /** La unidad que el transportista DICE que fue. No acredita nada: es su dicho. */
    declaredUnitId: uuid("declared_unit_id").references(() => units.id, {
      onDelete: "set null",
    }),
    /** Referencias a archivos. Dónde viven es otra decisión y otra migración. */
    adjuntos: jsonb("adjuntos")
      .$type<Array<{ nombre: string; url: string }>>()
      .notNull()
      .default([]),
    estado: aportacionEstadoEnum("estado").notNull().default("enviada"),
    /** Quién firma. Sin firma no sirve para reconciliar nada. */
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    resueltaPorKind: text("resuelta_por_kind"),
    resueltaPorId: text("resuelta_por_id"),
    resueltaAt: timestamp("resuelta_at", { withTimezone: true, mode: "date" }),
    resolucionNota: text("resolucion_nota"),
  },
  (table) => [
    index("carrier_aportaciones_occurrence_idx").on(
      table.serviceOccurrenceId,
      table.createdAt,
    ),
    index("carrier_aportaciones_carrier_idx").on(table.carrierAccountId, table.estado),
  ],
);

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
  // El cotejo entre Compás y J-Tel, desde la 0035. Ver `cotejarCompas` en
  // `packages/services/src/collector.ts`.
  "aparato_sin_dueno",
  "aparato_otro_proveedor",
  "aparato_fuera_de_compas",
  "imei_en_dos_cuentas",
  // Desde la 0036: un aparato dado de baja que vuelve a transmitir a Compás.
  "aparato_de_baja_transmite",
]);

/** Los valores de `ingest_alert_kind`, para tipar sin repetir la lista. */
export type IngestAlertKind = (typeof ingestAlertKindEnum.enumValues)[number];

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
