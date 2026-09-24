import { eq, and, or, not, gt, gte, lte, isNull, isNotNull, inArray, sql, ne, desc, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  computeExpectedDeadline,
  computeEvidenceWindow,
  contractPolicySchema,
  suggestProfileCode,
  MOTIVO_SISTEMA,
  nombreDeDispositivo,
  validarFranjas,
  promesaEnInstante,
  tipoDeDiaLocal,
  localTimeHHMM,
  detectarPasosEnRecorrido,
} from "@jtel/domain";
import type {
  PrefijoDeModelo,
  OperationalScope,
  OperationalUnit,
  RouteDurationSample,
  FranjaCapturada,
  FranjaRechazada,
  PromesaEnInstante,
  PasoDetectado,
} from "@jtel/domain";
import { operationalScopeColumns, cambioDeColorRechazado } from "@jtel/domain";
import type { Database } from "../index.js";
import { escribirEnLotes, filasPorSentencia } from "../lote-de-escritura.js";
import { planDeVinculacion } from "../mapeo-identidades.js";
import { routeWindowSizing } from "../ventana-ocurrencia.js";
import { consultaUltimoPuntoPorImei } from "../ultimo-punto-por-imei.js";
import { VernierRepository } from "./vernier.js";
import { PausasRepository, fueraPorPausa } from "./pausas.js";
import {
  resumirUnidadDia,
  HUECO_MINUTOS_POR_DEFECTO,
  SALTO_KMH_POR_DEFECTO,
  type BloqueObservado,
  type ResumenUnidadDia,
} from "../resumen-telemetria.js";
import {
  accounts,
  carrierProfiles,
  clientProfiles,
  plants,
  plantGroups,
  geofences,
  units,
  devices,
  deviceAssignments,
  routes,
  shifts,
  shiftHistory,
  routeShifts,
  routeKmlVariants,
  routeKmlVersions,
  serviceContracts,
  serviceProfiles,
  serviceProfileUnits,
  serviceOccurrences,
  trips,
  complianceFacts,
  complianceFactHistory,
  contractPolicyHistory,
  ledgerEntries,
  evidencePoints,
  userMemberships,
  fuelRecords,
  maintenanceRecords,
  inspections,
  notifications,
  demoTemplates,
  telemetryPoints,
  telemetryWatermarks,
  telemetryImeiWatermarks,
  telemetryArchiveMarks,
  groundTruthDays,
  occurrenceGroundTruth,
  carrierAportaciones,
  ingestAlerts,
  routeTraversalMeasurements,
  clientCarrierAuthorizations,
  livePositions,
  circuits,
  circuitOpens,
  circuitPaths,
  circuitStops,
  circuitStopVersions,
  circuitUnitAssignments,
  circuitDetectionMarks,
  circuitPromiseTables,
  circuitRuleChanges,
  circuitNotices,
  circuitLegTimes,
  circuitPromiseBands,
  circuitStopPasses,
  concessionCarriers,
  concessionProfiles,
  markets,
  documentTypes,
  documentTypeRules,
  documents,
  documentVersions,
  drivers,
  driverCredentials,
  driverAssignments,
} from "../schema/index.js";
import type { ComplianceFact, IngestAlertKind } from "../schema/index.js";
import type {
  CandidatasSnapshot,
  ContractPolicy,
  CreateContractInput,
  CreateServiceProfileInput,
} from "@jtel/domain";
import { routeLengthKm } from "@jtel/domain";
import { localDateIso, JTTEL_TZ, civilDatesInRange, addDaysIso } from "@jtel/domain";
import { fechaDeVencimientoAGuardar, type ReglaDeTipo } from "@jtel/domain";
import { caeEnPausa, intervalosDePausa } from "@jtel/domain";

function suggestProfileCodeFromName(name: string): string {
  return suggestProfileCode(name);
}

/**
 * «Esta fila pertenece a una cuenta real, no a una de ejemplo.»
 *
 * **El filtro de cuentas demo vive AQUÍ y en ningún otro lugar.** Antes estaba
 * repartido —un `includeDemo: false` en `listByType`, un filtro a mano sobre las
 * marcas de agua dentro de `/api/salud`, y **nada** en los otros dos contadores—,
 * y el resultado fue el que se esperaría: **el chequeo más nuevo no heredó el
 * filtro que ya vivía dos líneas más arriba en el mismo archivo.**
 *
 * Lo que costó: `/api/salud` reportó «6 servicios vencidos SIN veredicto, el más
 * viejo hace 49.8 h» durante días. El número era **correcto** —esas ocurrencias
 * existen— y la afirmación era **falsa**: todas eran de Honeywell y PRUEBA REAL,
 * que desde que la llave demo se cerró (#206) **no se juzgan nunca**. Ninguna era
 * de una cuenta real. Es §D del Marco aplicado a un instrumento: lo falso lo puso
 * el ALCANCE, no el dato.
 *
 * **Un filtro que no está en un solo lugar es un filtro que alguien va a
 * olvidar** — y el que lo olvide no va a ser quien lo escribió, sino quien añada
 * el chequeo siguiente.
 *
 * Una fila sin cuenta (`NULL`) cuenta como real: es de plataforma, no de nadie.
 */
function deCuentaReal(columnaCuenta: AnyPgColumn) {
  return sql`(${columnaCuenta} IS NULL OR EXISTS (
    SELECT 1 FROM ${accounts} cta
     WHERE cta.id = ${columnaCuenta} AND cta.is_demo = false))`;
}

export class AccountRepository {
  constructor(private db: Database) {}

  async create(data: {
    type: "carrier" | "client" | "jstaff";
    name: string;
    slug: string;
    isDemo?: boolean;
    clerkOrgId?: string;
  }) {
    const [account] = await this.db
      .insert(accounts)
      .values(data)
      .returning();
    return account!;
  }

  async findBySlug(slug: string) {
    return this.db.query.accounts.findFirst({ where: eq(accounts.slug, slug) });
  }

  async findById(id: string) {
    return this.db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  }

  /**
   * `includeDemo` va en `true` por omisión A PROPÓSITO.
   *
   * De estas listas cuelgan tanto pantallas como el pipeline (archivador,
   * relleno de huecos, ingesta, re-verificación). Si el default excluyera las
   * cuentas demo, esas cuentas dejarían de ingerirse y de verificarse sin que
   * nadie lo pidiera — archivar es sacarlas de la vista, no apagarles el motor.
   * Quien quiera ocultarlas lo dice explícitamente.
   */
  async listByType(
    type: "carrier" | "client" | "jstaff",
    opts: { includeDemo?: boolean } = {},
  ) {
    const soloReales = opts.includeDemo === false;
    return this.db.query.accounts.findMany({
      where: soloReales
        ? and(eq(accounts.type, type), eq(accounts.isDemo, false))
        : eq(accounts.type, type),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  }

  async listAll(opts: { includeDemo?: boolean } = {}) {
    const soloReales = opts.includeDemo === false;
    return this.db.query.accounts.findMany({
      where: soloReales ? eq(accounts.isDemo, false) : undefined,
      orderBy: (table, { asc }) => [asc(table.type), asc(table.name)],
    });
  }
}

export class CarrierRepository {
  constructor(private db: Database) {}

  async createProfile(accountId: string, legalName: string, gpsUserId?: string) {
    // `compas` escrito aquí y no sólo como default de la columna: si el código
    // se despliega antes de aplicar la 0035, la base todavía diría `umbrella`
    // y la cuenta nacería ciega. Con el valor explícito, el orden no importa.
    const [profile] = await this.db
      .insert(carrierProfiles)
      .values({ accountId, legalName, gpsUserId, gpsProvider: "compas" })
      .returning();
    return profile!;
  }

  async getProfileByAccountId(accountId: string) {
    return this.db.query.carrierProfiles.findFirst({
      where: eq(carrierProfiles.accountId, accountId),
    });
  }

  /**
   * Guarda las credenciales del proveedor GPS del carrier. La contraseña se
   * cifra en reposo; si se envía vacía, se conserva la contraseña anterior.
   */
  async saveGpsCredentials(
    accountId: string,
    input: { provider: string; userId: string; password?: string; baseUrl?: string | null },
  ) {
    const values: Partial<typeof carrierProfiles.$inferInsert> = {
      gpsProvider: input.provider,
      gpsBaseUrl: input.baseUrl ?? null,
      gpsUserId: input.userId,
    };

    if (input.password && input.password.length > 0) {
      const { encryptSecret } = await import("../crypto.js");
      values.gpsPasswordEncrypted = encryptSecret(input.password);
    }

    await this.db
      .update(carrierProfiles)
      .set(values)
      .where(eq(carrierProfiles.accountId, accountId));
  }

  /**
   * Devuelve las credenciales GPS del carrier con la contraseña descifrada,
   * o null si el carrier todavía no configuró credenciales.
   */
  async getGpsCredentials(accountId: string): Promise<{
    provider: string;
    userId: string;
    password: string;
    baseUrl: string | null;
  } | null> {
    const profile = await this.getProfileByAccountId(accountId);
    if (!profile?.gpsUserId || !profile.gpsPasswordEncrypted) return null;

    const { decryptSecret } = await import("../crypto.js");
    let password: string;
    try {
      password = decryptSecret(profile.gpsPasswordEncrypted);
    } catch {
      return null;
    }

    return {
      provider: profile.gpsProvider ?? "umbrella",
      userId: profile.gpsUserId,
      password,
      baseUrl: profile.gpsBaseUrl ?? null,
    };
  }
}

export class ClientRepository {
  constructor(private db: Database) {}

  async createProfile(accountId: string, legalName: string) {
    const [profile] = await this.db
      .insert(clientProfiles)
      .values({ accountId, legalName })
      .returning();
    return profile!;
  }

  async createPlant(data: {
    clientAccountId: string;
    name: string;
    code: string;
    plantGroupId?: string;
  }) {
    const [plant] = await this.db.insert(plants).values(data).returning();
    return plant!;
  }

  async createPlantGroup(clientAccountId: string, name: string) {
    const [group] = await this.db
      .insert(plantGroups)
      .values({ clientAccountId, name })
      .returning();
    return group!;
  }

  async getPlantsForAccount(clientAccountId: string) {
    return this.db.query.plants.findMany({
      where: eq(plants.clientAccountId, clientAccountId),
      orderBy: (p, { asc }) => [asc(p.name)],
    });
  }

  async getPlantGroupsForAccount(clientAccountId: string) {
    return this.db.query.plantGroups.findMany({
      where: eq(plantGroups.clientAccountId, clientAccountId),
      orderBy: (g, { asc }) => [asc(g.name)],
    });
  }

  async findPlantByCode(clientAccountId: string, code: string) {
    return this.db.query.plants.findFirst({
      where: and(eq(plants.clientAccountId, clientAccountId), eq(plants.code, code)),
    });
  }

  async getPlantById(id: string) {
    return this.db.query.plants.findFirst({ where: eq(plants.id, id) });
  }

  async getPlantGroupById(id: string) {
    return this.db.query.plantGroups.findFirst({ where: eq(plantGroups.id, id) });
  }

  /** Plantas sueltas + grupos como unidades operativas (rutas, turnos, contratos). */
  async getOperationalUnits(clientAccountId: string): Promise<OperationalUnit[]> {
    const [allPlants, groups] = await Promise.all([
      this.getPlantsForAccount(clientAccountId),
      this.getPlantGroupsForAccount(clientAccountId),
    ]);

    const units: OperationalUnit[] = [];

    for (const p of allPlants.filter((plant) => !plant.plantGroupId)) {
      units.push({ kind: "plant", id: p.id, name: p.name, code: p.code });
    }

    for (const g of groups) {
      const memberPlants = allPlants
        .filter((p) => p.plantGroupId === g.id)
        .map((p) => ({ id: p.id, name: p.name, code: p.code }));
      units.push({ kind: "plant_group", id: g.id, name: g.name, memberPlants });
    }

    return units.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async resolveOperationalScope(
    clientAccountId: string,
    scope: OperationalScope,
  ): Promise<OperationalScope | null> {
    if (scope.kind === "plant") {
      const plant = await this.getPlantById(scope.plantId);
      if (!plant || plant.clientAccountId !== clientAccountId) return null;
      return scope;
    }
    const group = await this.getPlantGroupById(scope.plantGroupId);
    if (!group || group.clientAccountId !== clientAccountId) return null;
    return scope;
  }

  async updatePlant(
    plantId: string,
    clientAccountId: string,
    data: { name?: string; plantGroupId?: string | null },
  ) {
    const [plant] = await this.db
      .update(plants)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.plantGroupId !== undefined ? { plantGroupId: data.plantGroupId } : {}),
      })
      .where(and(eq(plants.id, plantId), eq(plants.clientAccountId, clientAccountId)))
      .returning();
    return plant ?? null;
  }
}

export class GeofenceRepository {
  constructor(private db: Database) {}

  async create(data: {
    ownerType: "plant" | "plant_group" | "carrier";
    ownerPlantId?: string;
    ownerPlantGroupId?: string;
    ownerCarrierAccountId?: string;
    role: "destino" | "base" | "caseta" | "otro";
    name: string;
    polygon: Array<{ lat: number; lng: number }>;
  }) {
    const [geofence] = await this.db.insert(geofences).values(data).returning();
    return geofence!;
  }

  async findById(id: string) {
    return this.db.query.geofences.findFirst({ where: eq(geofences.id, id) });
  }

  async findForPlant(plantId: string) {
    return this.db.query.geofences.findMany({
      where: eq(geofences.ownerPlantId, plantId),
      orderBy: (g, { asc }) => [asc(g.name)],
    });
  }

  async findForPlantGroup(plantGroupId: string) {
    return this.db.query.geofences.findMany({
      where: eq(geofences.ownerPlantGroupId, plantGroupId),
      orderBy: (g, { asc }) => [asc(g.name)],
    });
  }

  /** Geocercas del alcance: campus + plantas miembro (excepciones) si es grupo. */
  async findForScope(scope: OperationalScope, clientAccountId: string) {
    if (scope.kind === "plant") {
      return this.findForPlant(scope.plantId);
    }

    const [groupGeofences, clientPlants] = await Promise.all([
      this.findForPlantGroup(scope.plantGroupId),
      this.db.query.plants.findMany({
        where: eq(plants.clientAccountId, clientAccountId),
      }),
    ]);
    const memberIds = clientPlants
      .filter((p) => p.plantGroupId === scope.plantGroupId)
      .map((p) => p.id);

    if (memberIds.length === 0) return groupGeofences;

    const plantGeofences =
      memberIds.length > 0
        ? await this.db.query.geofences.findMany({
            where: inArray(geofences.ownerPlantId, memberIds),
            orderBy: (g, { asc }) => [asc(g.name)],
          })
        : [];

    const seen = new Set<string>();
    return [...groupGeofences, ...plantGeofences].filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }

  /** Geocercas de plantas y grupos del cliente (para perfiles de servicio). */
  async findForClient(clientAccountId: string) {
    const clientPlants = await this.db.query.plants.findMany({
      where: eq(plants.clientAccountId, clientAccountId),
    });
    const plantIds = clientPlants.map((p) => p.id);

    const groups = await this.db.query.plantGroups.findMany({
      where: eq(plantGroups.clientAccountId, clientAccountId),
    });
    const groupIds = groups.map((g) => g.id);

    if (plantIds.length === 0 && groupIds.length === 0) return [];

    const conditions = [];
    if (plantIds.length > 0) conditions.push(inArray(geofences.ownerPlantId, plantIds));
    if (groupIds.length > 0) conditions.push(inArray(geofences.ownerPlantGroupId, groupIds));

    return this.db.query.geofences.findMany({
      where: or(...conditions),
      orderBy: (g, { asc }) => [asc(g.name)],
    });
  }

  async update(
    id: string,
    data: {
      role?: "destino" | "base" | "caseta" | "otro";
      name?: string;
      polygon?: Array<{ lat: number; lng: number }>;
    },
  ) {
    const patch: Record<string, unknown> = {};
    if (data.role !== undefined) patch.role = data.role;
    if (data.name !== undefined) patch.name = data.name;
    if (data.polygon !== undefined) patch.polygon = data.polygon;
    if (Object.keys(patch).length === 0) return null;

    const [row] = await this.db
      .update(geofences)
      .set(patch)
      .where(eq(geofences.id, id))
      .returning();
    return row ?? null;
  }

  /** Perfiles u ocurrencias ya generadas bloquean borrado. */
  async deleteBlockReason(
    geofenceId: string,
  ): Promise<"profiles" | "occurrences" | null> {
    const profile = await this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.geofenceId, geofenceId),
      columns: { id: true },
    });
    if (profile) return "profiles";

    const occ = await this.db.query.serviceOccurrences.findFirst({
      where: eq(serviceOccurrences.expectedGeofenceId, geofenceId),
      columns: { id: true },
    });
    if (occ) return "occurrences";
    return null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(geofences).where(eq(geofences.id, id)).returning();
    return rows.length > 0;
  }

  /**
   * Los lugares que la flota de un carrier puede visitar, para el cuarto de
   * Compás (decisión 1 del 16 de septiembre de 2026): las geocercas **propias
   * del carrier**, con cualquier rol, y las de las **plantas de sus contratos**
   * —la planta del contrato, o el campus y sus plantas miembro—.
   *
   * Los contratos en borrador no cuentan: todavía no son operación.
   */
  async lugaresDeCarrier(carrierAccountId: string) {
    const filas = await this.db.execute<{
      id: string;
      name: string;
      role: "destino" | "base" | "caseta" | "otro";
      polygon: Array<{ lat: number; lng: number }>;
    }>(sql`
      WITH contratos AS (
        SELECT plant_id, plant_group_id
          FROM service_contracts
         WHERE carrier_account_id = ${carrierAccountId}
           AND status <> 'draft'
      ),
      plantas AS (
        SELECT plant_id AS id FROM contratos WHERE plant_id IS NOT NULL
        UNION
        SELECT p.id FROM plants p JOIN contratos c ON c.plant_group_id = p.plant_group_id
      )
      SELECT g.id, g.name, g.role, g.polygon
        FROM geofences g
       WHERE g.owner_carrier_account_id = ${carrierAccountId}
          OR g.owner_plant_id IN (SELECT id FROM plantas)
          OR g.owner_plant_group_id IN (SELECT plant_group_id FROM contratos WHERE plant_group_id IS NOT NULL)
       ORDER BY g.name
    `);
    return [...filas];
  }

  /** Verifica que la geocerca pertenezca al cliente (planta o campus). */
  async belongsToClient(geofenceId: string, clientAccountId: string): Promise<boolean> {
    const g = await this.findById(geofenceId);
    if (!g) return false;
    if (g.ownerPlantId) {
      const plant = await this.db.query.plants.findFirst({
        where: eq(plants.id, g.ownerPlantId),
        columns: { clientAccountId: true },
      });
      return plant?.clientAccountId === clientAccountId;
    }
    if (g.ownerPlantGroupId) {
      const group = await this.db.query.plantGroups.findFirst({
        where: eq(plantGroups.id, g.ownerPlantGroupId),
        columns: { clientAccountId: true },
      });
      return group?.clientAccountId === clientAccountId;
    }
    return false;
  }
}

export class FleetRepository {
  constructor(private db: Database) {}

  async createUnit(carrierAccountId: string, label: string, plateNumber?: string) {
    const [unit] = await this.db
      .insert(units)
      .values({ carrierAccountId, label, plateNumber })
      .returning();
    return unit!;
  }

  /**
   * La identidad de las unidades de una cuenta —nombre y VIN—, para revisar
   * choques antes de dar de alta o corregir (C4-e). Sólo de esa cuenta: el
   * nombre y el VIN son únicos por cuenta, y lo de las otras no se mira.
   */
  async identidadesDeUnidades(carrierAccountId: string) {
    return this.db
      .select({ id: units.id, label: units.label, vin: units.vin })
      .from(units)
      .where(eq(units.carrierAccountId, carrierAccountId));
  }

  /** Da de alta una unidad (C4-e). El choque de nombre o VIN lo rechaza la base (0040) si el código no lo vio. */
  async darDeAltaUnidad(datos: { carrierAccountId: string; label: string; plateNumber: string | null; vin: string | null }) {
    const [unidad] = await this.db
      .insert(units)
      .values({ carrierAccountId: datos.carrierAccountId, label: datos.label, plateNumber: datos.plateNumber, vin: datos.vin })
      .returning();
    return unidad!;
  }

  /**
   * Corrige la identidad de una unidad de ESA cuenta (C4-e): nombre, placa y
   * VIN. `null` si la unidad no es de la cuenta — el muro, igual que un id que
   * no existe.
   *
   * **Sobrescribe, sin historia** (decisión de Asav, 18 sep 2026). La bitácora
   * de correcciones es un pendiente con nombre: renombrar un número económico
   * cambia cómo se lee toda su historia, y hoy no queda rastro de cómo se
   * llamaba antes.
   */
  async corregirUnidad(
    carrierAccountId: string,
    unitId: string,
    datos: { label: string; plateNumber: string | null; vin: string | null },
  ) {
    const [unidad] = await this.db
      .update(units)
      .set({ label: datos.label, plateNumber: datos.plateNumber, vin: datos.vin })
      .where(and(eq(units.id, unitId), eq(units.carrierAccountId, carrierAccountId)))
      .returning();
    return unidad ?? null;
  }

  async createDevice(carrierAccountId: string, imei: string, label?: string) {
    const [device] = await this.db
      .insert(devices)
      .values({ carrierAccountId, imei, label })
      .returning();
    return device!;
  }

  /**
   * Da de alta un dispositivo con el nombre que genera el sistema (Marco 6.3,
   * C4): marca + modelo + consecutivo global de `devices_consecutivo_seq`.
   *
   * El IMEI se busca en **todas** las cuentas antes de pedir número. El índice
   * único global quedó para después (decisión del 16 sep 2026), pero un IMEI
   * dado de alta en dos cuentas detiene su posición en vivo y abre
   * `imei_en_dos_cuentas`: moverlo de cuenta es cosa de J-Staff (6.14), no un
   * alta nueva. Buscar antes también evita gastar un número en un alta que el
   * índice de la cuenta iba a rechazar — la secuencia no regresa.
   *
   * Si dos altas del mismo IMEI corren a la vez, el índice por cuenta rechaza
   * la segunda y ese número queda sin usar: un hueco, nunca una repetición.
   */
  async darDeAltaDispositivo(datos: {
    carrierAccountId: string;
    imei: string;
    prefijo: PrefijoDeModelo;
  }): Promise<
    | { ok: true; dispositivo: typeof devices.$inferSelect }
    | { ok: false; error: "imei_ya_en_la_cuenta" | "imei_en_otra_cuenta" }
  > {
    return this.db.transaction(async (tx) => {
      const [ya] = await tx
        .select({ carrierAccountId: devices.carrierAccountId })
        .from(devices)
        .where(eq(devices.imei, datos.imei))
        .limit(1);
      if (ya) {
        return {
          ok: false as const,
          error: ya.carrierAccountId === datos.carrierAccountId ? "imei_ya_en_la_cuenta" : "imei_en_otra_cuenta",
        };
      }

      const [fila] = await tx.execute<{ n: number }>(sql`SELECT nextval('devices_consecutivo_seq')::integer AS n`);
      const consecutivo = Number(fila!.n);
      const [dispositivo] = await tx
        .insert(devices)
        .values({
          carrierAccountId: datos.carrierAccountId,
          imei: datos.imei,
          consecutivo,
          label: nombreDeDispositivo(datos.prefijo, consecutivo),
        })
        .returning();
      return { ok: true as const, dispositivo: dispositivo! };
    });
  }

  /**
   * Asigna un dispositivo a una unidad, cerrando lo que estorbe — todo en una
   * transacción.
   *
   * Cierra la asignación abierta del mismo dispositivo (se va de su unidad) y
   * la de la misma unidad (suelta a su dispositivo), cada una con el motivo que
   * escribe el sistema (`MOTIVO_SISTEMA`): quien asignó no tecleó «soltar el
   * 005», pero eso fue lo que le pasó al 005 y su historia lo dice.
   *
   * Los candados de la 0039 (`…_una_vigente`) son la garantía de fondo: si otra
   * asignación entra entre el cierre y la apertura, la base rechaza la segunda
   * en vez de dejar dos vigentes.
   *
   * `por` es opcional sólo por los guiones y el alta vieja, que no traen
   * sesión; la pantalla nueva siempre lo manda.
   */
  async assignDevice(
    unitId: string,
    deviceId: string,
    validFrom: Date = new Date(),
    por: string | null = null,
  ) {
    return this.db.transaction(async (tx) => {
      const [unidad] = await tx.select({ label: units.label }).from(units).where(eq(units.id, unitId));
      const [dispositivo] = await tx
        .select({ label: devices.label, imei: devices.imei })
        .from(devices)
        .where(eq(devices.id, deviceId));
      const nombreUnidad = unidad?.label ?? unitId;
      const nombreDispositivo = dispositivo?.label ?? dispositivo?.imei ?? deviceId;

      await tx
        .update(deviceAssignments)
        .set({ validTo: validFrom, cerradaPor: por, motivoCierre: MOTIVO_SISTEMA.dispositivoReasignado(nombreUnidad) })
        .where(and(isNull(deviceAssignments.validTo), eq(deviceAssignments.deviceId, deviceId)));

      await tx
        .update(deviceAssignments)
        .set({ validTo: validFrom, cerradaPor: por, motivoCierre: MOTIVO_SISTEMA.unidadRecibioOtro(nombreDispositivo) })
        .where(and(isNull(deviceAssignments.validTo), eq(deviceAssignments.unitId, unitId)));

      const [assignment] = await tx
        .insert(deviceAssignments)
        .values({ unitId, deviceId, validFrom, asignadaPor: por })
        .returning();
      return assignment!;
    });
  }

  /**
   * Suelta un dispositivo de su unidad: cierra su asignación vigente con quién
   * y por qué. Devuelve la asignación cerrada, o null si no estaba montado.
   */
  async soltarDispositivo(deviceId: string, datos: { at: Date; por: string; motivo: string }) {
    const [cerrada] = await this.db
      .update(deviceAssignments)
      .set({ validTo: datos.at, cerradaPor: datos.por, motivoCierre: datos.motivo })
      .where(and(isNull(deviceAssignments.validTo), eq(deviceAssignments.deviceId, deviceId)))
      .returning();
    return cerrada ?? null;
  }

  /**
   * Da de baja un dispositivo (Marco 6.5): fecha, motivo y quién. La fila no se
   * borra. Si estaba montado, se suelta en la misma transacción: «de baja y
   * montado» es la anomalía que la flota ya acusa, y no se escribe una.
   *
   * Devuelve null si ya estaba de baja — la condición va en el `WHERE`, así que
   * dos bajas simultáneas no se pisan el motivo.
   */
  async darDeBajaDispositivo(deviceId: string, datos: { at: Date; por: string; motivo: string }) {
    return this.db.transaction(async (tx) => {
      const [dispositivo] = await tx
        .update(devices)
        .set({ retiredAt: datos.at, retiredReason: datos.motivo, retiredBy: datos.por })
        .where(and(eq(devices.id, deviceId), isNull(devices.retiredAt)))
        .returning();
      if (!dispositivo) return null;

      const [soltada] = await tx
        .update(deviceAssignments)
        .set({ validTo: datos.at, cerradaPor: datos.por, motivoCierre: MOTIVO_SISTEMA.baja(datos.motivo) })
        .where(and(isNull(deviceAssignments.validTo), eq(deviceAssignments.deviceId, deviceId)))
        .returning();
      return { dispositivo, soltada: soltada ?? null };
    });
  }

  async resolveUnitAtTime(deviceId: string, at: Date) {
    const result = await this.db.query.deviceAssignments.findFirst({
      where: and(
        eq(deviceAssignments.deviceId, deviceId),
        lte(deviceAssignments.validFrom, at),
        or(isNull(deviceAssignments.validTo), gte(deviceAssignments.validTo, at)),
      ),
    });
    return result;
  }

  async getUnitsForCarrier(carrierAccountId: string) {
    return this.db.query.units.findMany({
      where: eq(units.carrierAccountId, carrierAccountId),
      orderBy: (table, { asc }) => [asc(table.label)],
    });
  }

  /**
   * Todos los aparatos de todas las cuentas, sólo con lo necesario para saber
   * de quién es cada IMEI.
   *
   * Es la lectura del recolector de una sola pasada: Compás entrega las
   * posiciones de toda la plataforma juntas y J-Tel las reparte. **A qué cuenta
   * va cada posición lo decide esta tabla**, no el servidor GPS — que es el
   * muro entre clientes.
   */
  async listDeviceOwners() {
    return this.db
      .select({
        id: devices.id,
        imei: devices.imei,
        carrierAccountId: devices.carrierAccountId,
        retiredAt: devices.retiredAt,
      })
      .from(devices);
  }

  async getDevicesForCarrier(carrierAccountId: string) {
    return this.db.query.devices.findMany({
      where: eq(devices.carrierAccountId, carrierAccountId),
      orderBy: (table, { asc }) => [asc(table.label), asc(table.imei)],
    });
  }

  /** Asignaciones vigentes (sin validTo) del carrier, con unidad + GPS. */
  async getActiveAssignmentsForCarrier(carrierAccountId: string) {
    const carrierUnits = await this.getUnitsForCarrier(carrierAccountId);
    const unitIds = carrierUnits.map((u) => u.id);
    if (unitIds.length === 0) return [];

    return this.db.query.deviceAssignments.findMany({
      where: and(
        inArray(deviceAssignments.unitId, unitIds),
        isNull(deviceAssignments.validTo),
      ),
      with: {
        unit: true,
        device: true,
      },
    });
  }

  async addFuelRecord(data: {
    unitId: string;
    carrierAccountId: string;
    liters: number;
    cost?: number;
    odometerKm?: number;
    recordedAt: Date;
  }) {
    const [record] = await this.db.insert(fuelRecords).values(data).returning();
    return record!;
  }

  async addMaintenanceRecord(data: {
    unitId: string;
    carrierAccountId: string;
    description: string;
    scheduledAt?: Date;
  }) {
    const [record] = await this.db.insert(maintenanceRecords).values(data).returning();
    return record!;
  }

  /**
   * Todos los rastreadores que ha traído una unidad, con sus periodos.
   *
   * Es la ley del expediente hecha consulta: **el rastreador no es la identidad
   * de la unidad.** Una unidad puede traer varios aparatos a lo largo de su
   * vida, y su historia es una sola — no se parte cuando el equipo se cambia.
   *
   * Trae las cerradas y la vigente, en orden de instalación. Medido el
   * 2026-08-02: de 82 unidades de esta flota, ninguna ha cambiado de equipo, lo
   * cual no es un hueco del modelo sino un hecho que todavía no ocurre.
   */
  async asignacionesDeUnidad(unitId: string) {
    return this.db
      .select({
        deviceId: devices.id,
        imei: devices.imei,
        etiqueta: devices.label,
        desde: deviceAssignments.validFrom,
        hasta: deviceAssignments.validTo,
      })
      .from(deviceAssignments)
      .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
      .where(eq(deviceAssignments.unitId, unitId))
      .orderBy(deviceAssignments.validFrom);
  }

  async getMaintenanceForCarrier(carrierAccountId: string) {
    return this.db.query.maintenanceRecords.findMany({
      where: eq(maintenanceRecords.carrierAccountId, carrierAccountId),
    });
  }

  /**
   * Las cargas de diésel del transportista, opcionalmente desde una fecha.
   *
   * El filtro va en la base y no en memoria: la tabla crece con cada carga de
   * cada unidad, y el explorador solo mira un periodo.
   */
  async getFuelForCarrier(carrierAccountId: string, desde?: Date) {
    return this.db.query.fuelRecords.findMany({
      where: desde
        ? and(
            eq(fuelRecords.carrierAccountId, carrierAccountId),
            gte(fuelRecords.recordedAt, desde),
          )
        : eq(fuelRecords.carrierAccountId, carrierAccountId),
    });
  }
}

export class RouteRepository {
  constructor(private db: Database) {}

  private scopeWhere(scope: OperationalScope) {
    const cols = operationalScopeColumns(scope);
    if (scope.kind === "plant") return eq(routes.plantId, cols.plantId!);
    return eq(routes.plantGroupId, cols.plantGroupId!);
  }

  async createRoute(data: {
    clientAccountId: string;
    plantId?: string | null;
    plantGroupId?: string | null;
    name: string;
  }) {
    const [route] = await this.db
      .insert(routes)
      .values(data)
      .returning();
    return route!;
  }

  async createShift(data: {
    clientAccountId: string;
    plantId?: string | null;
    plantGroupId?: string | null;
    name: string;
    startTime: string;
  }) {
    const [shift] = await this.db.insert(shifts).values(data).returning();
    return shift!;
  }

  async addKmlVersion(data: {
    routeId: string;
    variantId?: string;
    kmlContent: string;
    waypoints?: Array<{ lat: number; lng: number }>;
    validFrom?: Date;
  }) {
    // Si no se pasa variantId, usar (o crear) la variante "Principal".
    let variantId = data.variantId;
    if (!variantId) {
      const principal = await this.db.query.routeKmlVariants.findFirst({
        where: and(
          eq(routeKmlVariants.routeId, data.routeId),
          eq(routeKmlVariants.name, "Principal"),
        ),
      });
      if (principal) {
        variantId = principal.id;
      } else {
        const [created] = await this.db
          .insert(routeKmlVariants)
          .values({ routeId: data.routeId, name: "Principal" })
          .returning();
        variantId = created!.id;
      }
    }

    const existing = await this.db.query.routeKmlVersions.findMany({
      where: and(
        eq(routeKmlVersions.routeId, data.routeId),
        eq(routeKmlVersions.variantId, variantId),
      ),
      orderBy: (v, { asc }) => [asc(v.validFrom)],
    });

    // Primera versión: aplicar desde la creación de la ruta (cubre historial).
    // Versiones siguientes: cierran la anterior y empiezan "ahora".
    let validFrom = data.validFrom;
    if (!validFrom) {
      if (existing.length === 0) {
        const route = await this.db.query.routes.findFirst({
          where: eq(routes.id, data.routeId),
        });
        validFrom = route?.createdAt ?? new Date(0);
      } else {
        validFrom = new Date();
        const previous = existing[existing.length - 1]!;
        if (!previous.validTo || previous.validTo > validFrom) {
          await this.db
            .update(routeKmlVersions)
            .set({ validTo: validFrom })
            .where(eq(routeKmlVersions.id, previous.id));
        }
      }
    }

    const [version] = await this.db
      .insert(routeKmlVersions)
      .values({
        routeId: data.routeId,
        variantId,
        kmlContent: data.kmlContent,
        waypoints: data.waypoints ?? [],
        validFrom,
      })
      .returning();
    return version!;
  }

  async createRouteShift(data: {
    clientAccountId: string;
    plantId?: string | null;
    plantGroupId?: string | null;
    routeId: string;
    shiftId: string;
  }) {
    const [routeShift] = await this.db.insert(routeShifts).values(data).returning();
    return routeShift!;
  }

  async getKmlVersionForDate(routeId: string, at: Date) {
    const exact = await this.db.query.routeKmlVersions.findFirst({
      where: and(
        eq(routeKmlVersions.routeId, routeId),
        lte(routeKmlVersions.validFrom, at),
        or(isNull(routeKmlVersions.validTo), gte(routeKmlVersions.validTo, at)),
      ),
      orderBy: (v, { desc }) => [desc(v.validFrom)],
    });
    if (exact) return exact;

    // Si el KML se subió después del servicio, usar la versión más antigua
    // (el trazado describe la ruta aunque se haya cargado tarde).
    const earliest = await this.db.query.routeKmlVersions.findFirst({
      where: eq(routeKmlVersions.routeId, routeId),
      orderBy: (v, { asc }) => [asc(v.validFrom)],
    });
    if (earliest && earliest.validFrom > at) return earliest;

    return null;
  }

  /**
   * Obtener todas las variantes ACTIVAS con su versión vigente en una fecha.
   *
   * VARIANTE = caminos alternos que coexisten hoy (ej. MEX-45 o Panamericana).
   * VERSIÓN  = historia temporal de una variante (el trazado cambió → versión nueva).
   *
   * Reutiliza la misma lógica temporal de getKmlVersionForDate por variante.
   */
  /**
   * El largo del trazado vigente de cada ruta, en km.
   *
   * Es el arranque en frío de la derivación de ventana: sin historia medida, la
   * duración se estima sobre la geometría. Se trae de una vez porque
   * preguntarlo por ocurrencia haría mil consultas para las mismas rutas.
   */
  async largoDeTrazadoVigente(): Promise<Map<string, number>> {
    const filas = await this.db
      .selectDistinctOn([routeKmlVersions.routeId], {
        routeId: routeKmlVersions.routeId,
        waypoints: routeKmlVersions.waypoints,
      })
      .from(routeKmlVersions)
      .where(isNull(routeKmlVersions.validTo))
      .orderBy(routeKmlVersions.routeId, desc(routeKmlVersions.validFrom));

    const mapa = new Map<string, number>();
    for (const f of filas) {
      const wp = f.waypoints as Array<{ lat: number; lng: number }> | null;
      if (Array.isArray(wp) && wp.length > 1) mapa.set(f.routeId, routeLengthKm(wp));
    }
    return mapa;
  }

  /**
   * Las rutas del MISMO turno, con su trazado vigente a la fecha — Paso 2.
   *
   * **Es la carga de datos que el paso 2 necesita y que el motor no tenía:**
   * hasta ahora se le entregaba el trazado de UNA ruta —la contratada— porque
   * era la única contra la que medía. Para preguntar «¿contra cuál encaja
   * mejor?» hacen falta todas las del turno.
   *
   * Se acota al **contrato** además del turno: dos contratos pueden compartir
   * nombre de turno —ya pasó, es C20— y mezclarlos pondría rutas de otro cliente
   * en el ranking de éste.
   *
   * Devuelve la variante **principal vigente** de cada ruta, no todas: el
   * ranking contesta «cuál ruta», no «cuál variante». Esa segunda pregunta ya la
   * resuelve la evaluación multi-variante del servicio.
   */
  async rutasDelTurnoParaFecha(
    contractId: string,
    shiftId: string,
    at: Date,
  ): Promise<
    Array<{ routeShiftId: string; routeId: string; nombre: string; waypoints: Array<{ lat: number; lng: number }> }>
  > {
    const perfiles = await this.db
      .select({
        routeShiftId: routeShifts.id,
        routeId: routeShifts.routeId,
        nombre: routes.name,
      })
      .from(serviceProfiles)
      .innerJoin(routeShifts, eq(routeShifts.id, serviceProfiles.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .where(
        and(
          eq(serviceProfiles.contractId, contractId),
          eq(routeShifts.shiftId, shiftId),
          eq(serviceProfiles.active, true),
        ),
      );

    const salida: Array<{
      routeShiftId: string;
      routeId: string;
      nombre: string;
      waypoints: Array<{ lat: number; lng: number }>;
    }> = [];
    const vistas = new Set<string>();
    for (const p of perfiles) {
      if (vistas.has(p.routeShiftId)) continue;
      vistas.add(p.routeShiftId);
      const variantes = await this.getActiveVariantVersionsForDate(p.routeId, at);
      const principal =
        variantes.find((v) => v.variantName === "Principal") ?? variantes[0];
      if (!principal || !Array.isArray(principal.waypoints) || principal.waypoints.length === 0) {
        continue;
      }
      salida.push({
        routeShiftId: p.routeShiftId,
        routeId: p.routeId,
        nombre: p.nombre,
        waypoints: principal.waypoints,
      });
    }
    return salida;
  }

  async getActiveVariantVersionsForDate(routeId: string, at: Date) {
    const variants = await this.db.query.routeKmlVariants.findMany({
      where: and(
        eq(routeKmlVariants.routeId, routeId),
        eq(routeKmlVariants.status, "activa"),
      ),
    });

    const results: Array<{
      variantId: string;
      variantName: string;
      kmlVersionId: string;
      waypoints: Array<{ lat: number; lng: number }>;
    }> = [];

    for (const variant of variants) {
      // Misma lógica temporal que getKmlVersionForDate, filtrada por variante.
      const exact = await this.db.query.routeKmlVersions.findFirst({
        where: and(
          eq(routeKmlVersions.variantId, variant.id),
          lte(routeKmlVersions.validFrom, at),
          or(isNull(routeKmlVersions.validTo), gte(routeKmlVersions.validTo, at)),
        ),
        orderBy: (v, { desc }) => [desc(v.validFrom)],
      });

      if (exact) {
        results.push({
          variantId: variant.id,
          variantName: variant.name,
          kmlVersionId: exact.id,
          waypoints: exact.waypoints,
        });
        continue;
      }

      // Fallback: KML cargado después de la fecha del servicio.
      const earliest = await this.db.query.routeKmlVersions.findFirst({
        where: eq(routeKmlVersions.variantId, variant.id),
        orderBy: (v, { asc }) => [asc(v.validFrom)],
      });
      if (earliest && earliest.validFrom > at) {
        results.push({
          variantId: variant.id,
          variantName: variant.name,
          kmlVersionId: earliest.id,
          waypoints: earliest.waypoints,
        });
      }
      // Variante activa sin ninguna versión KML → no se incluye (sin trazado).
    }

    return results;
  }

  /**
   * Cuántas veces se ha medido el recorrido de cada ruta×turno.
   *
   * No devuelve una duración: devuelve **con cuánta evidencia se podría
   * calcular una**. Medido el 2026-08-02: las 48 combinaciones ruta×turno de
   * esta operación tienen **exactamente una medición cada una**.
   *
   * Un percentil sobre una sola muestra no es un percentil, es esa muestra con
   * nombre de estadística. El motor ya se niega a resumir con tan poco
   * (`routeDurationMinSamples`); esto existe para que la pantalla pueda decir
   * **por qué** el renglón no está, en vez de dejarlo en blanco.
   */
  async medicionesDeRecorridoPorRutaTurno(routeShiftIds: string[]) {
    if (routeShiftIds.length === 0) return [];
    return this.db
      .select({
        routeShiftId: routeTraversalMeasurements.routeShiftId,
        muestras: count(),
      })
      .from(routeTraversalMeasurements)
      .where(inArray(routeTraversalMeasurements.routeShiftId, routeShiftIds))
      .groupBy(routeTraversalMeasurements.routeShiftId);
  }

  /**
   * Todas las duraciones medidas, sin agrupar.
   *
   * La revisión de ventanas necesita las MUESTRAS, no un conteo: el resumen usa
   * un percentil y un piso de cotas inferiores, y eso no se puede reconstruir
   * desde `count()`. Se traen de una vez —son cientos de filas, no millones— en
   * vez de una consulta por ocurrencia.
   */
  async todasLasDuraciones() {
    const filas = await this.db
      .select({
        routeShiftId: routeTraversalMeasurements.routeShiftId,
        durationMinutes: routeTraversalMeasurements.durationMinutes,
        lowerBound: routeTraversalMeasurements.lowerBound,
      })
      .from(routeTraversalMeasurements);
    return filas.map((f) => ({
      routeShiftId: f.routeShiftId,
      durationMinutes: Number(f.durationMinutes),
      lowerBound: Boolean(f.lowerBound),
    }));
  }

  async getVariantsForRoute(routeId: string) {
    return this.db.query.routeKmlVariants.findMany({
      where: eq(routeKmlVariants.routeId, routeId),
      with: { kmlVersions: { columns: { id: true, validFrom: true, validTo: true } } },
      orderBy: (v, { asc }) => [asc(v.createdAt)],
    });
  }

  async createVariant(
    clientAccountId: string,
    scope: OperationalScope,
    data: {
      routeId: string;
      name: string;
      status?: "activa" | "legacy";
      origin?: "manual" | "promovida_de_viaje";
      originTripId?: string | null;
    },
  ) {
    const cols = operationalScopeColumns(scope);
    const ownerWhere =
      scope.kind === "plant"
        ? and(
            eq(routes.id, data.routeId),
            eq(routes.clientAccountId, clientAccountId),
            eq(routes.plantId, cols.plantId!),
          )
        : and(
            eq(routes.id, data.routeId),
            eq(routes.clientAccountId, clientAccountId),
            eq(routes.plantGroupId, cols.plantGroupId!),
          );
    const route = await this.db.query.routes.findFirst({
      where: ownerWhere,
      columns: { id: true },
    });
    if (!route) return null;

    const [variant] = await this.db
      .insert(routeKmlVariants)
      .values({
        routeId: data.routeId,
        name: data.name,
        status: data.status ?? "activa",
        origin: data.origin ?? "manual",
        originTripId: data.originTripId ?? null,
      })
      .returning();
    return variant!;
  }

  async updateVariantStatus(
    variantId: string,
    clientAccountId: string,
    scope: OperationalScope,
    status: "activa" | "legacy",
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "last_active" }> {
    const cols = operationalScopeColumns(scope);

    const variant = await this.db.query.routeKmlVariants.findFirst({
      where: eq(routeKmlVariants.id, variantId),
      columns: { id: true, routeId: true, status: true },
      with: {
        route: { columns: { clientAccountId: true, plantId: true, plantGroupId: true } },
      },
    });

    const owned =
      variant &&
      (scope.kind === "plant"
        ? variant.route.clientAccountId === clientAccountId &&
          variant.route.plantId === cols.plantId
        : variant.route.clientAccountId === clientAccountId &&
          variant.route.plantGroupId === cols.plantGroupId);
    if (!owned) return { ok: false, reason: "not_found" };

    if (status === "legacy") {
      const otherActives = await this.db.query.routeKmlVariants.findMany({
        where: and(
          eq(routeKmlVariants.routeId, variant.routeId),
          eq(routeKmlVariants.status, "activa"),
          ne(routeKmlVariants.id, variantId),
        ),
        columns: { id: true },
      });
      if (otherActives.length === 0) return { ok: false, reason: "last_active" };
    }

    const [updated] = await this.db
      .update(routeKmlVariants)
      .set({ status, updatedAt: new Date() })
      .where(eq(routeKmlVariants.id, variantId))
      .returning();
    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true };
  }

  async getRoutesForScope(scope: OperationalScope) {
    return this.db.query.routes.findMany({
      where: this.scopeWhere(scope),
      with: { kmlVersions: true },
      orderBy: (r, { asc }) => [asc(r.name)],
    });
  }

  async getShiftsForScope(scope: OperationalScope) {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? eq(shifts.plantId, cols.plantId!)
        : eq(shifts.plantGroupId, cols.plantGroupId!);
    return this.db.query.shifts.findMany({
      where,
      orderBy: (s, { asc }) => [asc(s.startTime)],
    });
  }

  async getRouteShiftsForScope(scope: OperationalScope) {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? eq(routeShifts.plantId, cols.plantId!)
        : eq(routeShifts.plantGroupId, cols.plantGroupId!);
    return this.db.query.routeShifts.findMany({
      where,
      with: {
        route: { with: { kmlVersions: { columns: { id: true } } } },
        shift: true,
      },
      orderBy: (rs, { asc }) => [asc(rs.createdAt)],
    });
  }

  /** @deprecated Usar getRoutesForScope */
  async getRoutesForPlant(plantId: string) {
    return this.getRoutesForScope({ kind: "plant", plantId });
  }

  /** @deprecated Usar getShiftsForScope */
  async getShiftsForPlant(plantId: string) {
    return this.getShiftsForScope({ kind: "plant", plantId });
  }

  /** @deprecated Usar getRouteShiftsForScope */
  async getRouteShiftsForPlant(plantId: string) {
    return this.getRouteShiftsForScope({ kind: "plant", plantId });
  }

  /** @deprecated Usar getRoutesForPlant — mantiene compat con contadores del hub. */
  async getRoutesForClient(clientAccountId: string) {
    return this.db.query.routes.findMany({
      where: eq(routes.clientAccountId, clientAccountId),
      orderBy: (r, { asc }) => [asc(r.name)],
    });
  }

  async getShiftsForClient(clientAccountId: string) {
    return this.db.query.shifts.findMany({
      where: eq(shifts.clientAccountId, clientAccountId),
      orderBy: (s, { asc }) => [asc(s.startTime)],
    });
  }

  async getRouteShiftsForClient(clientAccountId: string) {
    return this.db.query.routeShifts.findMany({
      where: eq(routeShifts.clientAccountId, clientAccountId),
      with: { route: { with: { kmlVersions: true } }, shift: true },
    });
  }

  async findRouteShiftById(id: string) {
    return this.db.query.routeShifts.findFirst({
      where: eq(routeShifts.id, id),
      with: { route: { with: { kmlVersions: true } }, shift: true },
    });
  }

  async findShiftInScope(id: string, clientAccountId: string, scope: OperationalScope) {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? and(
            eq(shifts.id, id),
            eq(shifts.clientAccountId, clientAccountId),
            eq(shifts.plantId, cols.plantId!),
          )
        : and(
            eq(shifts.id, id),
            eq(shifts.clientAccountId, clientAccountId),
            eq(shifts.plantGroupId, cols.plantGroupId!),
          );
    return this.db.query.shifts.findFirst({ where });
  }

  async findRouteShiftByNameAndShift(
    scope: OperationalScope,
    name: string,
    shiftId: string,
    excludeRouteShiftId?: string,
  ) {
    const cols = operationalScopeColumns(scope);
    const rsWhere =
      scope.kind === "plant"
        ? and(eq(routeShifts.plantId, cols.plantId!), eq(routeShifts.shiftId, shiftId))
        : and(eq(routeShifts.plantGroupId, cols.plantGroupId!), eq(routeShifts.shiftId, shiftId));
    const linked = await this.db.query.routeShifts.findMany({
      where: rsWhere,
      with: { route: true },
    });
    return (
      linked.find(
        (rs) => rs.route?.name === name && rs.id !== excludeRouteShiftId,
      ) ?? null
    );
  }

  async updateRouteShift(
    routeShiftId: string,
    clientAccountId: string,
    scope: OperationalScope,
    data: { name: string; shiftId: string },
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "not_found" | "duplicate" | "invalid_shift" }
  > {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? and(
            eq(routeShifts.id, routeShiftId),
            eq(routeShifts.clientAccountId, clientAccountId),
            eq(routeShifts.plantId, cols.plantId!),
          )
        : and(
            eq(routeShifts.id, routeShiftId),
            eq(routeShifts.clientAccountId, clientAccountId),
            eq(routeShifts.plantGroupId, cols.plantGroupId!),
          );

    const routeShift = await this.db.query.routeShifts.findFirst({
      where,
      with: { route: true },
    });
    if (!routeShift?.route) return { ok: false, reason: "not_found" };

    const shift = await this.findShiftInScope(data.shiftId, clientAccountId, scope);
    if (!shift) return { ok: false, reason: "invalid_shift" };

    const duplicate = await this.findRouteShiftByNameAndShift(
      scope,
      data.name,
      data.shiftId,
      routeShiftId,
    );
    if (duplicate) return { ok: false, reason: "duplicate" };

    await this.db.update(routes).set({ name: data.name }).where(eq(routes.id, routeShift.routeId));
    await this.db
      .update(routeShifts)
      .set({ shiftId: data.shiftId })
      .where(eq(routeShifts.id, routeShiftId));

    return { ok: true };
  }

  async createRouteWithShift(data: {
    clientAccountId: string;
    plantId?: string | null;
    plantGroupId?: string | null;
    name: string;
    shiftId: string;
    kmlContent?: string;
    waypoints?: Array<{ lat: number; lng: number }>;
  }) {
    const route = await this.createRoute({
      clientAccountId: data.clientAccountId,
      plantId: data.plantId,
      plantGroupId: data.plantGroupId,
      name: data.name,
    });
    if (data.kmlContent) {
      await this.addKmlVersion({
        routeId: route.id,
        kmlContent: data.kmlContent,
        waypoints: data.waypoints,
      });
    }
    const routeShift = await this.createRouteShift({
      clientAccountId: data.clientAccountId,
      plantId: data.plantId,
      plantGroupId: data.plantGroupId,
      routeId: route.id,
      shiftId: data.shiftId,
    });
    return { route, routeShift };
  }

  async findShiftByNameAndTime(
    scope: OperationalScope,
    name: string,
    startTime: string,
    excludeShiftId?: string,
  ) {
    const cols = operationalScopeColumns(scope);
    const base =
      scope.kind === "plant"
        ? and(
            eq(shifts.plantId, cols.plantId!),
            eq(shifts.name, name),
            eq(shifts.startTime, startTime),
          )
        : and(
            eq(shifts.plantGroupId, cols.plantGroupId!),
            eq(shifts.name, name),
            eq(shifts.startTime, startTime),
          );
    const where = excludeShiftId ? and(base, sql`${shifts.id} <> ${excludeShiftId}`) : base;
    return this.db.query.shifts.findFirst({ where });
  }

  /**
   * Mueve o renombra un turno, dejando quién lo hizo.
   *
   * ## Quién escribe la historia, y por qué no es este método
   *
   * La fila de `shift_history` la escribe un **trigger de Postgres**, no este
   * código. La diferencia importa y la enseñó C13: ahí el registro sí vive en
   * `updatePolicy`, en la misma transacción, desde el 31 de julio — y al 7 de
   * agosto la tabla seguía en cero filas, porque la única edición real de una
   * política la hizo un guion con `UPDATE` crudo que no pasa por ahí. Cerrar el
   * camino bueno no cierra la puerta de atrás.
   *
   * Lo que este método hace es **declarar quién está editando**, con
   * `set_config(..., true)` —transaccional, se limpia solo al terminar—, para
   * que el trigger pueda firmar la fila. Una escritura que no lo declare queda
   * firmada `sql_directo`, que es la verdad sobre ella.
   *
   * Va en transacción por eso: `set_config` con el tercer argumento en `true`
   * vale solo dentro de una, y fuera de una no habría forma de garantizar que
   * el `UPDATE` viaja por la misma conexión que la declaración.
   *
   * Mover un turno **no alcanza a las ocurrencias ya generadas** — su hora
   * límite quedó congelada al crearse. Eso es C21 y no se arregla aquí: lo
   * avisa `/api/cron/revisar-horas-limite`.
   */
  async updateShift(
    id: string,
    clientAccountId: string,
    scope: OperationalScope,
    data: { name: string; startTime: string },
    edicion: { actorKind: string; actorId?: string | null; note?: string | null },
  ): Promise<
    | { ok: true }
    | { ok: false; reason: "not_found" | "duplicate" }
  > {
    const existing = await this.findShiftInScope(id, clientAccountId, scope);
    if (!existing) return { ok: false, reason: "not_found" };

    const duplicate = await this.findShiftByNameAndTime(
      scope,
      data.name,
      data.startTime,
      id,
    );
    if (duplicate) return { ok: false, reason: "duplicate" };

    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('jtel.actor_kind', ${edicion.actorKind}, true),
                   set_config('jtel.actor_id', ${edicion.actorId ?? ""}, true),
                   set_config('jtel.note', ${edicion.note?.trim() ?? ""}, true)`,
      );
      await tx
        .update(shifts)
        .set({ name: data.name, startTime: data.startTime })
        .where(eq(shifts.id, id));
    });
    return { ok: true };
  }

  /** La historia de un turno, de la edición más reciente hacia atrás. */
  async getShiftHistory(shiftId: string) {
    return this.db.query.shiftHistory.findMany({
      where: eq(shiftHistory.shiftId, shiftId),
      orderBy: (h, { desc }) => [desc(h.changedAt)],
    });
  }

  private async routeShiftDeleteBlockReason(
    routeShiftIds: string[],
  ): Promise<"profiles" | "occurrences" | null> {
    if (routeShiftIds.length === 0) return null;
    const profiles = await this.db.query.serviceProfiles.findMany({
      where: inArray(serviceProfiles.routeShiftId, routeShiftIds),
      columns: { id: true },
    });
    if (profiles.length === 0) return null;
    const occ = await this.db.query.serviceOccurrences.findFirst({
      where: inArray(
        serviceOccurrences.serviceProfileId,
        profiles.map((p) => p.id),
      ),
      columns: { id: true },
    });
    return occ ? "occurrences" : "profiles";
  }

  async deleteShift(
    id: string,
    clientAccountId: string,
    scope: OperationalScope,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "profiles" | "occurrences" }> {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? and(
            eq(shifts.id, id),
            eq(shifts.clientAccountId, clientAccountId),
            eq(shifts.plantId, cols.plantId!),
          )
        : and(
            eq(shifts.id, id),
            eq(shifts.clientAccountId, clientAccountId),
            eq(shifts.plantGroupId, cols.plantGroupId!),
          );

    const shift = await this.db.query.shifts.findFirst({ where, columns: { id: true } });
    if (!shift) return { ok: false, reason: "not_found" };

    const linked = await this.db.query.routeShifts.findMany({
      where: eq(routeShifts.shiftId, id),
      columns: { id: true },
    });
    const block = await this.routeShiftDeleteBlockReason(linked.map((r) => r.id));
    if (block) return { ok: false, reason: block };

    await this.db.delete(shifts).where(eq(shifts.id, id));
    return { ok: true };
  }

  async deleteRouteShift(
    id: string,
    clientAccountId: string,
    scope: OperationalScope,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "profiles" | "occurrences" }> {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? and(
            eq(routeShifts.id, id),
            eq(routeShifts.clientAccountId, clientAccountId),
            eq(routeShifts.plantId, cols.plantId!),
          )
        : and(
            eq(routeShifts.id, id),
            eq(routeShifts.clientAccountId, clientAccountId),
            eq(routeShifts.plantGroupId, cols.plantGroupId!),
          );

    const routeShift = await this.db.query.routeShifts.findFirst({
      where,
      columns: { id: true, routeId: true },
    });
    if (!routeShift) return { ok: false, reason: "not_found" };

    const block = await this.routeShiftDeleteBlockReason([routeShift.id]);
    if (block) return { ok: false, reason: block };

    await this.db.delete(routeShifts).where(eq(routeShifts.id, routeShift.id));

    const remaining = await this.db.query.routeShifts.findFirst({
      where: eq(routeShifts.routeId, routeShift.routeId),
      columns: { id: true },
    });
    if (!remaining) {
      await this.db.delete(routes).where(eq(routes.id, routeShift.routeId));
    }
    return { ok: true };
  }

  async deleteRoute(
    id: string,
    clientAccountId: string,
    scope: OperationalScope,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "profiles" | "occurrences" }> {
    const cols = operationalScopeColumns(scope);
    const where =
      scope.kind === "plant"
        ? and(
            eq(routes.id, id),
            eq(routes.clientAccountId, clientAccountId),
            eq(routes.plantId, cols.plantId!),
          )
        : and(
            eq(routes.id, id),
            eq(routes.clientAccountId, clientAccountId),
            eq(routes.plantGroupId, cols.plantGroupId!),
          );

    const route = await this.db.query.routes.findFirst({ where, columns: { id: true } });
    if (!route) return { ok: false, reason: "not_found" };

    const linked = await this.db.query.routeShifts.findMany({
      where: eq(routeShifts.routeId, id),
      columns: { id: true },
    });
    const block = await this.routeShiftDeleteBlockReason(linked.map((r) => r.id));
    if (block) return { ok: false, reason: block };

    await this.db.delete(routes).where(eq(routes.id, id));
    return { ok: true };
  }
}

export class CommercialRepository {
  constructor(private db: Database) {}

  async authorize(data: {
    clientAccountId: string;
    carrierAccountId: string;
    notes?: string;
  }) {
    const existing = await this.db.query.clientCarrierAuthorizations.findFirst({
      where: and(
        eq(clientCarrierAuthorizations.clientAccountId, data.clientAccountId),
        eq(clientCarrierAuthorizations.carrierAccountId, data.carrierAccountId),
      ),
    });

    if (existing) {
      const [row] = await this.db
        .update(clientCarrierAuthorizations)
        .set({
          status: "active",
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        })
        .where(eq(clientCarrierAuthorizations.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await this.db
      .insert(clientCarrierAuthorizations)
      .values({
        clientAccountId: data.clientAccountId,
        carrierAccountId: data.carrierAccountId,
        notes: data.notes,
        status: "active",
      })
      .returning();
    return row!;
  }

  async suspend(clientAccountId: string, carrierAccountId: string) {
    const [row] = await this.db
      .update(clientCarrierAuthorizations)
      .set({ status: "suspended" })
      .where(
        and(
          eq(clientCarrierAuthorizations.clientAccountId, clientAccountId),
          eq(clientCarrierAuthorizations.carrierAccountId, carrierAccountId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async isAuthorized(clientAccountId: string, carrierAccountId: string) {
    const row = await this.db.query.clientCarrierAuthorizations.findFirst({
      where: and(
        eq(clientCarrierAuthorizations.clientAccountId, clientAccountId),
        eq(clientCarrierAuthorizations.carrierAccountId, carrierAccountId),
        eq(clientCarrierAuthorizations.status, "active"),
      ),
    });
    return !!row;
  }

  /** Carriers que J-Staff autorizó para este cliente (lista corta para contratos). */
  async getAuthorizedCarriersForClient(clientAccountId: string) {
    const rows = await this.db.query.clientCarrierAuthorizations.findMany({
      where: and(
        eq(clientCarrierAuthorizations.clientAccountId, clientAccountId),
        eq(clientCarrierAuthorizations.status, "active"),
      ),
      with: { carrier: true },
      orderBy: (a, { asc }) => [asc(a.createdAt)],
    });
    return rows.map((r) => r.carrier!).filter(Boolean);
  }

  async listForClient(clientAccountId: string) {
    return this.db.query.clientCarrierAuthorizations.findMany({
      where: eq(clientCarrierAuthorizations.clientAccountId, clientAccountId),
      with: { carrier: true, client: true },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
  }

  async listForCarrier(carrierAccountId: string) {
    return this.db.query.clientCarrierAuthorizations.findMany({
      where: and(
        eq(clientCarrierAuthorizations.carrierAccountId, carrierAccountId),
        eq(clientCarrierAuthorizations.status, "active"),
      ),
      with: { client: true },
      orderBy: (a, { asc }) => [asc(a.createdAt)],
    });
  }
}

export class ContractRepository {
  constructor(private db: Database) {}

  async create(input: CreateContractInput) {
    const [contract] = await this.db
      .insert(serviceContracts)
      .values({
        carrierAccountId: input.carrierAccountId,
        clientAccountId: input.clientAccountId,
        plantId: input.plantId,
        plantGroupId: input.plantGroupId,
        name: input.name,
        validFrom: input.validFrom,
        validTo: input.validTo,
        policy: input.policy,
        status: input.status ?? "draft",
      })
      .returning();
    return contract!;
  }

  async findById(id: string) {
    return this.db.query.serviceContracts.findFirst({
      where: eq(serviceContracts.id, id),
      with: { profiles: true, plant: true, plantGroup: true },
    });
  }

  async findForClient(clientAccountId: string) {
    return this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.clientAccountId, clientAccountId),
      with: { profiles: true, plant: true, plantGroup: true, carrier: true },
    });
  }

  async findForCarrier(carrierAccountId: string) {
    return this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.carrierAccountId, carrierAccountId),
      with: { profiles: true, plant: true, plantGroup: true, client: true },
    });
  }

  /** Borrador, demo o activo para la misma unidad operativa + carrier (no suspendido). */
  async findOpenForScopeAndCarrier(
    clientAccountId: string,
    carrierAccountId: string,
    scope: { plantId?: string | null; plantGroupId?: string | null },
  ) {
    const scopeCond = scope.plantId
      ? and(eq(serviceContracts.plantId, scope.plantId), isNull(serviceContracts.plantGroupId))
      : scope.plantGroupId
        ? and(eq(serviceContracts.plantGroupId, scope.plantGroupId), isNull(serviceContracts.plantId))
        : undefined;
    if (!scopeCond) return null;

    return this.db.query.serviceContracts.findFirst({
      where: and(
        eq(serviceContracts.clientAccountId, clientAccountId),
        eq(serviceContracts.carrierAccountId, carrierAccountId),
        scopeCond,
        inArray(serviceContracts.status, ["draft", "demo", "active"]),
      ),
      with: { carrier: true },
    });
  }

  async activate(id: string) {
    const [contract] = await this.db
      .update(serviceContracts)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(serviceContracts.id, id))
      .returning();
    return contract!;
  }

  async updateValidity(id: string, validFrom: string, validTo: string) {
    const [contract] = await this.db
      .update(serviceContracts)
      .set({ validFrom, validTo, updatedAt: new Date() })
      .where(eq(serviceContracts.id, id))
      .returning();
    return contract!;
  }

  /**
   * JSON con las llaves ordenadas, para comparar dos políticas.
   *
   * `JSON.stringify` depende del orden de las llaves, y la misma política
   * llega con órdenes distintos según de dónde venga: Postgres guarda un jsonb
   * con SU orden (por longitud y luego por bytes) y zod devuelve el del
   * esquema. Sin canonizar, dos objetos idénticos se dan por distintos y cada
   * guardado registraría una edición fantasma.
   */
  private static canonizar(valor: unknown): unknown {
    if (Array.isArray(valor)) return valor.map((v) => ContractRepository.canonizar(v));
    if (valor && typeof valor === "object") {
      return Object.fromEntries(
        Object.keys(valor as object)
          .sort()
          .map((k) => [k, ContractRepository.canonizar((valor as Record<string, unknown>)[k])]),
      );
    }
    return valor;
  }

  /**
   * Cambia la política del contrato y deja el registro de la edición.
   *
   * Las dos escrituras van en UNA transacción, y el registro se hace aquí y no
   * en quien llama a propósito: si dejar rastro fuera responsabilidad del
   * llamador, tarde o temprano alguien agrega un camino de edición y se olvida.
   * Así editar sin registrar deja de ser posible.
   *
   * ## Y aun así no bastaba — lo que este método aprendió el 7 de agosto
   *
   * Todo lo de arriba lleva cierto desde el 31 de julio, y al 7 de agosto
   * `contract_policy_history` seguía en CERO filas. No porque nadie editara:
   * porque la única edición real de una política en ese periodo la hizo un
   * guion con `UPDATE` crudo, que no pasa por aquí. **Cerrar el camino bueno no
   * cierra la puerta de atrás.**
   *
   * Desde la migración 0020 la red es un trigger de Postgres, que alcanza
   * también a los guiones y a la consola. Este método sigue siendo el camino
   * bueno y le CEDE el paso al trigger declarando `jtel.registrado`: aquí la
   * comparación es la de la política EFECTIVA —con los defaults del esquema
   * aplicados—, y un trigger solo puede comparar bytes. Ver la migración.
   *
   * La política nueva aplica solo hacia adelante. Ningún hecho ya sellado se
   * toca: cada uno congeló su propia foto al verificarse.
   */
  async updatePolicy(
    id: string,
    policy: ContractPolicy,
    edicion: { actorKind: string; actorId?: string | null; note?: string | null },
  ) {
    return this.db.transaction(async (tx) => {
      /*
       * Va ANTES del UPDATE porque el trigger dispara con él. Declara dos
       * cosas: que este camino se hace cargo del registro, y quién edita —lo
       * segundo por si el trigger llegara a escribir de todas formas, para que
       * nunca firme como `sql_directo` algo que sí vino de una persona.
       *
       * `set_config(..., true)` es transaccional: se limpia al terminar, así
       * que la firma no se pega a la conexión ni se filtra a la escritura
       * siguiente.
       */
      await tx.execute(
        sql`select set_config('jtel.registrado', '1', true),
                   set_config('jtel.actor_kind', ${edicion.actorKind}, true),
                   set_config('jtel.actor_id', ${edicion.actorId ?? ""}, true),
                   set_config('jtel.note', ${edicion.note?.trim() ?? ""}, true)`,
      );

      const actual = await tx.query.serviceContracts.findFirst({
        where: eq(serviceContracts.id, id),
        columns: { policy: true },
      });
      if (!actual) throw new Error(`updatePolicy: contrato ${id} no encontrado`);

      const [contract] = await tx
        .update(serviceContracts)
        .set({ policy, updatedAt: new Date() })
        .where(eq(serviceContracts.id, id))
        .returning();

      /*
       * Se compara la política EFECTIVA, no la guardada tal cual.
       *
       * Un contrato anterior a una perilla no trae esa llave en su jsonb, pero
       * el motor la resuelve con el default del esquema al leerla: o sea que
       * ese default ya era el valor vigente. Comparar en crudo hacía que el
       * primer guardado de un contrato viejo registrara seis "cambios" que
       * nadie hizo —«Aprender el ancho de la ventana: sin configurar →
       * encendido», cuando llevaba encendida desde siempre— y una historia que
       * arranca con cambios falsos no se vuelve a creer.
       *
       * Lo que este registro cuenta son cambios en la LEY, no en cómo se
       * serializa. Por eso el "antes" que se guarda es el efectivo: es la regla
       * con la que de verdad se estaba juzgando.
       *
       * Y una edición que no cambió nada no genera fila: el formulario manda
       * las 24 perillas en cada guardado, así que abrir y guardar sin tocar
       * nada es común. Registrarlo escondería las ediciones que sí cambiaron
       * algo entre entradas vacías.
       */
      const previa = contractPolicySchema.safeParse(actual.policy);
      const efectivaAntes: ContractPolicy = previa.success ? previa.data : actual.policy;

      const canonico = (p: unknown) => JSON.stringify(ContractRepository.canonizar(p));
      const huboCambio = canonico(efectivaAntes) !== canonico(policy);
      if (huboCambio) {
        await tx.insert(contractPolicyHistory).values({
          contractId: id,
          policyBefore: efectivaAntes,
          policyAfter: policy,
          actorKind: edicion.actorKind,
          actorId: edicion.actorId ?? null,
          note: edicion.note?.trim() ? edicion.note.trim() : null,
        });
      }

      return contract!;
    });
  }

  /**
   * Las ediciones de política de un contrato, de la más reciente a la más
   * antigua. Solo lectura: nada de aquí alimenta al motor.
   */
  async getPolicyHistory(contractId: string) {
    return this.db.query.contractPolicyHistory.findMany({
      where: eq(contractPolicyHistory.contractId, contractId),
      orderBy: (h, { desc }) => [desc(h.changedAt)],
    });
  }

  async deleteDraft(id: string, clientAccountId: string) {
    const contract = await this.db.query.serviceContracts.findFirst({
      where: eq(serviceContracts.id, id),
      with: { profiles: true },
    });
    if (!contract || contract.clientAccountId !== clientAccountId) return null;
    if (contract.status !== "draft") return null;
    if (contract.profiles.length > 0) return null;

    const [deleted] = await this.db
      .delete(serviceContracts)
      .where(eq(serviceContracts.id, id))
      .returning();
    return deleted ?? null;
  }
}

export class ServiceProfileRepository {
  constructor(private db: Database) {}

  async create(input: CreateServiceProfileInput) {
    const baseCode = input.code && input.code.length > 0
      ? input.code
      : suggestProfileCodeFromName(input.name);

    let code = baseCode;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const existing = await this.db.query.serviceProfiles.findFirst({
        where: eq(serviceProfiles.code, code),
        columns: { id: true },
      });
      if (!existing) break;
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      code = `${baseCode.slice(0, 19)}-${suffix}`.slice(0, 24);
    }

    const [profile] = await this.db
      .insert(serviceProfiles)
      .values({
        contractId: input.contractId,
        routeShiftId: input.routeShiftId,
        geofenceId: input.geofenceId,
        name: input.name,
        code,
        referenceUnitId: input.referenceUnitId,
        activeDays: input.activeDays,
      })
      .returning();

    if (input.possibleUnitIds.length > 0) {
      await this.db.insert(serviceProfileUnits).values(
        input.possibleUnitIds.map((unitId) => ({
          serviceProfileId: profile!.id,
          unitId,
        })),
      );
    }

    return profile!;
  }

  async findById(id: string) {
    return this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, id),
      with: { possibleUnits: true, contract: true, routeShift: true, geofence: true },
    });
  }

  async getPossibleUnitIds(profileId: string): Promise<string[]> {
    const rows = await this.db.query.serviceProfileUnits.findMany({
      where: eq(serviceProfileUnits.serviceProfileId, profileId),
    });
    return rows.map((r) => r.unitId);
  }

  /** Perfiles de un contrato (con routeShift para corpus TF-IDF). */
  async findForContract(contractId: string) {
    return this.db.query.serviceProfiles.findMany({
      where: eq(serviceProfiles.contractId, contractId),
      with: {
        contract: true,
        geofence: true,
        possibleUnits: true,
        routeShift: { with: { route: true, shift: true } },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });
  }

  /** Perfiles de servicio de todos los contratos de un cliente. */
  async findForClient(clientAccountId: string) {
    const clientContracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.clientAccountId, clientAccountId),
    });
    const contractIds = clientContracts.map((c) => c.id);
    if (contractIds.length === 0) return [];
    return this.db.query.serviceProfiles.findMany({
      where: inArray(serviceProfiles.contractId, contractIds),
      with: {
        contract: true,
        geofence: true,
        possibleUnits: true,
        routeShift: { with: { route: true, shift: true } },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });
  }

  async profileIdsWithOccurrences(profileIds: string[]): Promise<Set<string>> {
    if (profileIds.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ profileId: serviceOccurrences.serviceProfileId })
      .from(serviceOccurrences)
      .where(inArray(serviceOccurrences.serviceProfileId, profileIds));
    return new Set(rows.map((r) => r.profileId));
  }

  /** Resumen de cobertura de ocurrencias por perfil (count + rango), opcionalmente en [from, to]. */
  async occurrenceCoverageByProfile(
    profileIds: string[],
    range?: { fromDate: string; toDate: string },
  ): Promise<
    Map<string, { count: number; fromDate: string; toDate: string }>
  > {
    const map = new Map<string, { count: number; fromDate: string; toDate: string }>();
    if (profileIds.length === 0) return map;

    const conditions = [inArray(serviceOccurrences.serviceProfileId, profileIds)];
    if (range) {
      conditions.push(gte(serviceOccurrences.serviceDate, range.fromDate));
      conditions.push(lte(serviceOccurrences.serviceDate, range.toDate));
    }

    const rows = await this.db
      .select({
        profileId: serviceOccurrences.serviceProfileId,
        count: sql<number>`count(*)::int`,
        fromDate: sql<string>`min(${serviceOccurrences.serviceDate})`,
        toDate: sql<string>`max(${serviceOccurrences.serviceDate})`,
      })
      .from(serviceOccurrences)
      .where(and(...conditions))
      .groupBy(serviceOccurrences.serviceProfileId);

    for (const row of rows) {
      map.set(row.profileId, {
        count: Number(row.count),
        fromDate: String(row.fromDate).slice(0, 10),
        toDate: String(row.toDate).slice(0, 10),
      });
    }
    return map;
  }

  async deleteProfile(id: string, clientAccountId: string) {
    const profile = await this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, id),
      with: { contract: true },
    });
    if (!profile || profile.contract?.clientAccountId !== clientAccountId) return null;

    const existing = await this.db.query.serviceOccurrences.findFirst({
      where: eq(serviceOccurrences.serviceProfileId, id),
      columns: { id: true },
    });
    if (existing) return null;

    const [deleted] = await this.db
      .delete(serviceProfiles)
      .where(eq(serviceProfiles.id, id))
      .returning();
    return deleted ?? null;
  }

  /**
   * J-Staff: borra perfiles (y por FK cascada sus ocurrencias/hechos/ledger)
   * de todos los contratos de una planta. No borra el contrato ni la planta.
   * Opcionalmente limpia geocercas de la planta que ya no estén en ningún perfil.
   */
  async purgePlantProfiles(plantId: string): Promise<{
    plantName: string;
    plantCode: string;
    contracts: number;
    profilesDeleted: number;
    occurrencesDeleted: number;
    geofencesDeleted: number;
    profileCodes: string[];
  }> {
    const plant = await this.db.query.plants.findFirst({
      where: eq(plants.id, plantId),
    });
    if (!plant) {
      throw new Error("Planta no encontrada");
    }

    const plantContracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.plantId, plantId),
      columns: { id: true },
    });
    const contractIds = plantContracts.map((c) => c.id);
    if (contractIds.length === 0) {
      return {
        plantName: plant.name,
        plantCode: plant.code,
        contracts: 0,
        profilesDeleted: 0,
        occurrencesDeleted: 0,
        geofencesDeleted: 0,
        profileCodes: [],
      };
    }

    const profiles = await this.db.query.serviceProfiles.findMany({
      where: inArray(serviceProfiles.contractId, contractIds),
      columns: { id: true, code: true },
    });
    const profileIds = profiles.map((p) => p.id);
    const profileCodes = profiles.map((p) => p.code);

    let occurrencesDeleted = 0;
    if (profileIds.length > 0) {
      const occCount = await this.db
        .select({ id: serviceOccurrences.id })
        .from(serviceOccurrences)
        .where(inArray(serviceOccurrences.serviceProfileId, profileIds));
      occurrencesDeleted = occCount.length;

      // Borrar perfiles: DB cascade elimina ocurrencias → trips → facts → ledger → GT.
      await this.db
        .delete(serviceProfiles)
        .where(inArray(serviceProfiles.id, profileIds));
    }

    // Geocercas de la planta sin perfil que las referencie.
    const plantGeofences = await this.db.query.geofences.findMany({
      where: eq(geofences.ownerPlantId, plantId),
      columns: { id: true },
    });
    let geofencesDeleted = 0;
    for (const g of plantGeofences) {
      const stillUsed = await this.db.query.serviceProfiles.findFirst({
        where: eq(serviceProfiles.geofenceId, g.id),
        columns: { id: true },
      });
      if (stillUsed) continue;
      const occGeofence = await this.db.query.serviceOccurrences.findFirst({
        where: eq(serviceOccurrences.expectedGeofenceId, g.id),
        columns: { id: true },
      });
      if (occGeofence) continue;
      const removed = await this.db
        .delete(geofences)
        .where(eq(geofences.id, g.id))
        .returning({ id: geofences.id });
      geofencesDeleted += removed.length;
    }

    return {
      plantName: plant.name,
      plantCode: plant.code,
      contracts: contractIds.length,
      profilesDeleted: profiles.length,
      occurrencesDeleted,
      geofencesDeleted,
      profileCodes,
    };
  }

  /** Perfiles de una planta (para soporte J-Staff: borrar uno de prueba). */
  async listForPlant(plantId: string) {
    const plantContracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.plantId, plantId),
      columns: { id: true, name: true },
    });
    const contractIds = plantContracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const profiles = await this.db.query.serviceProfiles.findMany({
      where: inArray(serviceProfiles.contractId, contractIds),
      with: {
        contract: { columns: { id: true, name: true } },
        geofence: { columns: { id: true, name: true } },
        routeShift: { with: { route: true, shift: true } },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });

    const counts = await this.occurrenceCoverageByProfile(profiles.map((p) => p.id));
    return profiles.map((p) => ({
      ...p,
      occurrenceCount: counts.get(p.id)?.count ?? 0,
    }));
  }

  /**
   * J-Staff: borra UN perfil aunque tenga ocurrencias (cascada DB).
   * No borra rutas/turnos/contrato/planta. Limpia geocerca huérfana si aplica.
   */
  async purgeProfileById(profileId: string): Promise<{
    profileCode: string;
    profileName: string;
    plantCode: string | null;
    plantName: string | null;
    occurrencesDeleted: number;
    geofenceDeleted: boolean;
  }> {
    const profile = await this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, profileId),
      with: {
        contract: { with: { plant: true } },
      },
    });
    if (!profile) {
      throw new Error("Perfil no encontrado");
    }

    const occCount = await this.db
      .select({ id: serviceOccurrences.id })
      .from(serviceOccurrences)
      .where(eq(serviceOccurrences.serviceProfileId, profileId));
    const occurrencesDeleted = occCount.length;
    const geofenceId = profile.geofenceId;

    await this.db.delete(serviceProfiles).where(eq(serviceProfiles.id, profileId));

    let geofenceDeleted = false;
    if (geofenceId) {
      const stillUsed = await this.db.query.serviceProfiles.findFirst({
        where: eq(serviceProfiles.geofenceId, geofenceId),
        columns: { id: true },
      });
      const occGeofence = await this.db.query.serviceOccurrences.findFirst({
        where: eq(serviceOccurrences.expectedGeofenceId, geofenceId),
        columns: { id: true },
      });
      if (!stillUsed && !occGeofence) {
        const removed = await this.db
          .delete(geofences)
          .where(eq(geofences.id, geofenceId))
          .returning({ id: geofences.id });
        geofenceDeleted = removed.length > 0;
      }
    }

    return {
      profileCode: profile.code,
      profileName: profile.name,
      plantCode: profile.contract?.plant?.code ?? null,
      plantName: profile.contract?.plant?.name ?? null,
      occurrencesDeleted,
      geofenceDeleted,
    };
  }

  async updateProfile(
    id: string,
    clientAccountId: string,
    data: {
      name: string;
      code?: string;
      routeShiftId: string;
      geofenceId: string;
      activeDays: number[];
    },
  ): Promise<
    | { ok: true; profile: typeof serviceProfiles.$inferSelect }
    | { ok: false; reason: "not_found" | "duplicate_code" }
  > {
    const profile = await this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, id),
      with: { contract: true },
    });
    if (!profile?.contract || profile.contract.clientAccountId !== clientAccountId) {
      return { ok: false, reason: "not_found" };
    }

    let code = profile.code;
    if (data.code !== undefined && data.code.trim().length > 0) {
      code = data.code.trim().toUpperCase();
      const existing = await this.db.query.serviceProfiles.findFirst({
        where: eq(serviceProfiles.code, code),
        columns: { id: true },
      });
      if (existing && existing.id !== id) {
        return { ok: false, reason: "duplicate_code" };
      }
    }

    const [updated] = await this.db
      .update(serviceProfiles)
      .set({
        name: data.name,
        code,
        routeShiftId: data.routeShiftId,
        geofenceId: data.geofenceId,
        activeDays: data.activeDays,
      })
      .where(eq(serviceProfiles.id, id))
      .returning();

    if (!updated) return { ok: false, reason: "not_found" };
    return { ok: true, profile: updated };
  }

  /**
   * Cambia la geocerca de destino de TODOS los perfiles de los contratos
   * de una planta. El motor lee la geocerca viva del perfil al verificar.
   */
  async bulkSetGeofenceForPlant(
    plantId: string,
    clientAccountId: string,
    geofenceId: string,
  ): Promise<{ updated: number }> {
    const plant = await this.db.query.plants.findFirst({
      where: and(eq(plants.id, plantId), eq(plants.clientAccountId, clientAccountId)),
    });
    if (!plant) return { updated: 0 };

    const plantContracts = await this.db.query.serviceContracts.findMany({
      where: and(
        eq(serviceContracts.plantId, plantId),
        eq(serviceContracts.clientAccountId, clientAccountId),
      ),
      columns: { id: true },
    });
    const contractIds = plantContracts.map((c) => c.id);
    if (contractIds.length === 0) return { updated: 0 };

    const updated = await this.db
      .update(serviceProfiles)
      .set({ geofenceId })
      .where(inArray(serviceProfiles.contractId, contractIds))
      .returning({ id: serviceProfiles.id });

    return { updated: updated.length };
  }
}

/**
 * Cuántos servicios hay de cada estado en un alcance.
 *
 * `sin_hecho` va nombrado aparte y NO sumado a ninguno de los tres: un servicio
 * que el árbitro todavía no juzgó no es un cuarto veredicto, es ausencia de
 * veredicto. Repartirlo entre los otros tres —o esconderlo dentro de `total`
 * sin nombre— convierte una cifra correcta en una afirmación falsa.
 */
export type ConteoPorEstado = {
  total: number;
  cumplido: number;
  no_cumplido: number;
  pendiente_evidencia: number;
  sin_hecho: number;
};

export class OccurrenceRepository {
  constructor(private db: Database) {}

  /**
   * El servicio especial vigente de cada unidad de un carrier en `ahora` — la
   * mitad «especial» del servicio vigente (Marco 7.7, reglas aprobadas el 16 de
   * septiembre de 2026).
   *
   * Una unidad da un servicio especial ahora si es **unidad posible de un
   * perfil** con una **ocurrencia cuya ventana de evidencia incluye `ahora`**.
   * La ventana es la de `trips`, la misma con la que el motor juzga: EN DESTINO
   * no puede encenderse con otra ventana que la del sello que protege.
   *
   * Sólo lo que el árbitro va a sellar: contrato activo y cliente que no es
   * cuenta de ejemplo. Donde no habrá sello no hay nada que proteger (7.4).
   *
   * El filtro por `expected_deadline` a ±1 día es para el índice: una ventana
   * de evidencia dura horas, no días.
   */
  async especialesVigentesDeCarrier(carrierAccountId: string, ahora: Date) {
    const desde = new Date(ahora.getTime() - 24 * 3_600_000);
    const hasta = new Date(ahora.getTime() + 24 * 3_600_000);
    return this.db
      .select({
        unitId: serviceProfileUnits.unitId,
        occurrenceId: serviceOccurrences.id,
        expectedGeofenceId: serviceOccurrences.expectedGeofenceId,
        ventanaDesde: trips.evidenceWindowStart,
        ventanaHasta: trips.evidenceWindowEnd,
      })
      .from(serviceOccurrences)
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(
        serviceProfileUnits,
        eq(serviceProfileUnits.serviceProfileId, serviceOccurrences.serviceProfileId),
      )
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
          gte(serviceOccurrences.expectedDeadline, desde),
          lte(serviceOccurrences.expectedDeadline, hasta),
          lte(trips.evidenceWindowStart, ahora),
          gte(trips.evidenceWindowEnd, ahora),
        ),
      );
  }

  /**
   * Los tramos de servicio especial de UNA unidad que tocan una ventana: la
   * pregunta de `especialesVigentesDeCarrier` hecha para un periodo en vez de
   * un instante, para cortar el recorrido (C3) con la misma regla que enciende
   * EN DESTINO en Flota en vivo. Los mismos filtros, a propósito: si Flota dice
   * que la unidad está en destino de un especial, el recorrido de ese momento
   * tiene que cortarse ahí, y al revés.
   *
   * Las horas son las de `trips` de cada ocurrencia —lo declarado para ese
   * día—, nunca las del perfil vigente hoy.
   */
  async especialesDeUnidadEnVentana(
    carrierAccountId: string,
    unitId: string,
    desde: Date,
    hasta: Date,
  ) {
    return this.db
      .select({
        ventanaDesde: trips.evidenceWindowStart,
        ventanaHasta: trips.evidenceWindowEnd,
      })
      .from(serviceOccurrences)
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(
        serviceProfileUnits,
        eq(serviceProfileUnits.serviceProfileId, serviceOccurrences.serviceProfileId),
      )
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(serviceProfileUnits.unitId, unitId),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
          gte(serviceOccurrences.expectedDeadline, new Date(desde.getTime() - 24 * 3_600_000)),
          lte(serviceOccurrences.expectedDeadline, new Date(hasta.getTime() + 24 * 3_600_000)),
          lte(trips.evidenceWindowStart, hasta),
          gte(trips.evidenceWindowEnd, desde),
        ),
      );
  }

  /** Horizonte operativo por defecto (días hacia adelante desde hoy). */
  static readonly ROLLING_DAYS = 30;

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private addDays(d: Date, days: number): Date {
    const x = this.startOfDay(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  /**
   * Fecha civil YYYY-MM-DD en zona del despliegue.
   * Operaciones del sistema (cron, rolling window) no tienen contrato
   * en contexto → usan JTTEL_TZ.
   */
  private toIsoDate(d: Date): string {
    return localDateIso(d, JTTEL_TZ);
  }

  /**
   * Genera ocurrencias para un perfil en [fromDate, toDate].
   * Siempre acota a la vigencia del contrato.
   * Si `rollingDays` está definido, también acota el fin a hoy + rollingDays.
   */
  async generateForProfile(
    profileId: string,
    fromDate: Date,
    toDate: Date,
    options?: { rollingDays?: number },
  ) {
    const profile = await this.db.query.serviceProfiles.findFirst({
      where: eq(serviceProfiles.id, profileId),
      with: {
        routeShift: { with: { route: true, shift: true } },
        contract: true,
        geofence: true,
      },
    });

    if (!profile) throw new Error("Perfil no encontrado");
    if (!profile.contract) throw new Error("Contrato no encontrado");

    const routeShift = profile.routeShift;
    const shift = routeShift!.shift!;
    const policy = profile.contract.policy;
    const anticipation = policy.arrivalAnticipationMinutes ?? 15;
    const activeDays = profile.activeDays ?? [1, 2, 3, 4, 5];

    const contractFrom = new Date(`${profile.contract.validFrom}T00:00:00`);
    const contractTo = new Date(`${profile.contract.validTo}T00:00:00`);
    const rangeStart = this.startOfDay(fromDate);
    let rangeEnd = this.startOfDay(toDate);

    if (options?.rollingDays != null) {
      const rollingEnd = this.addDays(new Date(), options.rollingDays);
      if (rangeEnd > rollingEnd) rangeEnd = rollingEnd;
    }

    const start = rangeStart < contractFrom ? contractFrom : rangeStart;
    const end = rangeEnd > contractTo ? contractTo : rangeEnd;
    if (start > end) {
      return { createdIds: [] as string[], skippedExisting: 0, clamped: true as const };
    }

    const kmlVersion = await this.db.query.routeKmlVersions.findFirst({
      where: and(
        eq(routeKmlVersions.routeId, routeShift!.routeId),
        lte(routeKmlVersions.validFrom, end),
        or(isNull(routeKmlVersions.validTo), gte(routeKmlVersions.validTo, start)),
      ),
      orderBy: (v, { desc }) => [desc(v.validFrom)],
    });

    // La ventana de observación se dimensiona con la ruta, no con una
    // constante: cuánto ha durado de verdad este recorrido (historia medida) y,
    // si no hay historia suficiente, qué tan largo es el trazado. Se resuelve
    // UNA vez por perfil — ni el KML ni la historia cambian entre las fechas
    // de una misma corrida.
    const durationSamples = await new RouteTraversalRepository(this.db).recentSamples(
      profile.routeShiftId,
    );
    const windowSizing = routeWindowSizing(kmlVersion?.waypoints, durationSamples, policy);

    type Row = {
      serviceProfileId: string;
      contractId: string;
      routeShiftId: string;
      kmlVersionId: string | undefined;
      serviceDate: string;
      expectedDeadline: Date;
      expectedGeofenceId: string;
      referenceUnitId: string | null | undefined;
      windowStart: Date;
      windowEnd: Date;
    };

    // La pausa de la verificación (0041): lo que cae en una pausa no se genera,
    // ni ahora ni al reanudar. Lo no medido durante la pausa jamás se inventa
    // hacia atrás. Es la única puerta de generación: la usan la renovación
    // diaria y el botón «generar» de la pantalla.
    const pausas = intervalosDePausa(await new PausasRepository(this.db).eventosDe(profile.contractId));

    const rows: Row[] = [];
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);
    for (const serviceDate of civilDatesInRange(startIso, endIso, activeDays)) {
      // La zona SIEMPRE explícita. Sin ella el deadline sale distinto según
      // dónde corra el generador —una laptop en Juárez o un cron de Vercel en
      // UTC— y esas seis horas produjeron 294 hechos sellados a la hora
      // equivocada, con un solo cumplido entre todos.
      const deadline = computeExpectedDeadline(
        serviceDate,
        shift.startTime,
        anticipation,
        policy.timeZone,
      );
      if (caeEnPausa(pausas, deadline)) continue;
      const { windowStart, windowEnd } = computeEvidenceWindow(
        deadline,
        policy,
        windowSizing,
      );
      rows.push({
        serviceProfileId: profileId,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        kmlVersionId: kmlVersion?.id,
        serviceDate,
        expectedDeadline: deadline,
        expectedGeofenceId: profile.geofenceId,
        referenceUnitId: profile.referenceUnitId,
        windowStart,
        windowEnd,
      });
    }

    if (rows.length === 0) {
      return { createdIds: [] as string[], skippedExisting: 0, clamped: false as const };
    }

    const inserted = await this.db
      .insert(serviceOccurrences)
      .values(rows.map(({ windowStart: _ws, windowEnd: _we, ...occ }) => occ))
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      const byDate = new Map(rows.map((r) => [r.serviceDate, r]));
      await this.db.insert(trips).values(
        inserted.map((occ) => {
          const row = byDate.get(occ.serviceDate)!;
          return {
            serviceOccurrenceId: occ.id,
            evidenceWindowStart: row.windowStart,
            evidenceWindowEnd: row.windowEnd,
            evidenceStatus: "en_espera" as const,
          };
        }),
      );
    }

    return {
      createdIds: inserted.map((o) => o.id),
      skippedExisting: rows.length - inserted.length,
      clamped:
        rangeStart.getTime() !== start.getTime() ||
        this.startOfDay(toDate).getTime() !== end.getTime(),
    };
  }

  /**
   * Renueva la ventana rodante de todos los perfiles activos:
   * genera el tramo faltante hasta min(hoy+days, vigencia del contrato).
   */
  async renewRollingWindow(days: number = OccurrenceRepository.ROLLING_DAYS) {
    // localDateIso(new Date(), JTTEL_TZ): fecha civil Juárez en el instante exacto
    // en que corre la función — correcto en verano (00:00 Juárez = 06:00 UTC)
    // y en invierno (23:00 Juárez = 06:00 UTC, un día antes del UTC date).
    // addDaysIso: aritmética puramente UTC (setUTCDate), sin setHours ni TZ local.
    const todayIso = localDateIso(new Date(), JTTEL_TZ);
    const horizonIso = addDaysIso(todayIso, days);
    const today = new Date(`${todayIso}T00:00:00.000Z`); // solo para comparación Date con `from`

    const profiles = await this.db.query.serviceProfiles.findMany({
      where: eq(serviceProfiles.active, true),
      with: { contract: true },
    });

    const summary: Array<{
      profileId: string;
      profileName: string;
      created: number;
      skipped: number;
      from?: string;
      to?: string;
    }> = [];

    for (const profile of profiles) {
      const contract = profile.contract;
      if (!contract) continue;
      if (contract.status !== "active" && contract.status !== "demo") continue;
      if (contract.validTo < todayIso) continue;
      if (contract.validFrom > horizonIso) continue;

      const targetIso =
        contract.validTo < horizonIso ? contract.validTo : horizonIso;
      const target = new Date(`${targetIso}T00:00:00`);

      const [maxRow] = await this.db
        .select({
          maxDate: sql<string>`max(${serviceOccurrences.serviceDate})`,
        })
        .from(serviceOccurrences)
        .where(eq(serviceOccurrences.serviceProfileId, profile.id));

      let from = today;
      if (maxRow?.maxDate) {
        const next = this.addDays(new Date(`${String(maxRow.maxDate).slice(0, 10)}T00:00:00`), 1);
        if (next > from) from = next;
      }

      if (from > target) {
        summary.push({
          profileId: profile.id,
          profileName: profile.name,
          created: 0,
          skipped: 0,
        });
        continue;
      }

      const result = await this.generateForProfile(profile.id, from, target, {
        rollingDays: days,
      });
      summary.push({
        profileId: profile.id,
        profileName: profile.name,
        created: result.createdIds.length,
        skipped: result.skippedExisting,
        from: from.toISOString().slice(0, 10),
        to: targetIso,
      });
    }

    return {
      days,
      today: todayIso,
      horizon: horizonIso,
      profiles: summary,
      totalCreated: summary.reduce((n, s) => n + s.created, 0),
    };
  }

  /**
   * Las ocurrencias que todavía se pueden juzgar, con lo necesario para
   * comparar su hora límite congelada contra la que hoy se derivaría.
   *
   * Es la contraparte de lectura de `renewRollingWindow`: aquél congela la hora
   * límite al crear la fila y no vuelve a mirarla nunca; esto la vuelve a
   * mirar. Ninguna de las dos escribe la corrección — eso es decisión de Asav,
   * no de un programa.
   *
   * Tres recortes, y ninguno es de rendimiento:
   *
   *  - **Sin hecho sellado.** Una ocurrencia ya sellada no se corrige: se
   *    re-verifica, y eso es otra decisión con otra firma. Avisar de ella sería
   *    pedir algo que este aviso no puede sostener.
   *  - **Hora límite en el futuro.** Una ocurrencia cuya hora límite ya pasó
   *    está en la cola de verificación o se quedó fuera de ella; lo segundo ya
   *    lo avisa `sin-veredicto`. Aquí interesa lo que todavía se puede evitar.
   *  - **Contratos vivos y cuentas reales.** Un contrato suspendido dejó de
   *    esperarse a propósito, y una cuenta de ejemplo no entra en ningún
   *    conteo.
   *
   * Devuelve columnas sueltas y no el árbol de nueve relaciones: quien llama
   * necesita seis campos por fila, y traer el árbol para descartarlo es el
   * costo que `verificar-conteos` ya midió una vez.
   */
  /**
   * Las ocurrencias sin sellar, con su ventana congelada — Frente A de la
   * ventana congelada.
   *
   * Hermana de `futurasSinSellarParaRevision`, y distinta en dos cosas que
   * importan: trae `evidence_window_start` del viaje —el campo que se revisa— y
   * el `route_shift_id`, porque **la ventana se deriva por ruta×turno** y es
   * también como se agrupa el aviso.
   *
   * **Solo lo que no tiene hecho:** un sello ya decidió con su ventana, y
   * moverla sería reescribir el marco del juicio. Eso es D4.
   */
  async sinSellarParaRevisionDeVentana() {
    return this.db
      .select({
        id: serviceOccurrences.id,
        serviceDate: serviceOccurrences.serviceDate,
        expectedDeadline: serviceOccurrences.expectedDeadline,
        evidenceWindowStart: trips.evidenceWindowStart,
        contractId: serviceContracts.id,
        contractName: serviceContracts.name,
        policy: serviceContracts.policy,
        clientName: accounts.name,
        routeShiftId: routeShifts.id,
        routeId: routeShifts.routeId,
        routeName: routes.name,
        shiftName: shifts.name,
      })
      .from(serviceOccurrences)
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(serviceProfiles, eq(serviceProfiles.id, serviceOccurrences.serviceProfileId))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(routeShifts, eq(routeShifts.id, serviceProfiles.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .leftJoin(
        complianceFacts,
        eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id),
      )
      .where(
        and(
          isNull(complianceFacts.id),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
        ),
      );
  }

  /**
   * El estado del viaje de cada ocurrencia, para decidir si su ventana **se
   * puede** mover. Compañero de `sinSellarParaRevisionDeVentana`, separado a
   * propósito: detectar no necesita esto, y corregir no puede sin ello.
   *
   * El conteo de puntos anclados es la guarda que más importa. Ensanchar la
   * ventana de un viaje que ya tiene puntos **empeora su cobertura**: se mide
   * más tiempo contra los mismos puntos, y el tramo nuevo entra vacío. Corregir
   * sin mirar esto convertiría un arreglo en la fábrica de acusaciones que el
   * arreglo existe para cerrar.
   */
  async estadoDeViajeDeOcurrencias(ocurrenciaIds: string[]) {
    if (ocurrenciaIds.length === 0) return [];
    return this.db
      .select({
        occurrenceId: trips.serviceOccurrenceId,
        tripId: trips.id,
        evidenceStatus: trips.evidenceStatus,
        puntos: count(evidencePoints.id),
      })
      .from(trips)
      .leftJoin(evidencePoints, eq(evidencePoints.tripId, trips.id))
      .where(inArray(trips.serviceOccurrenceId, ocurrenciaIds))
      .groupBy(trips.serviceOccurrenceId, trips.id, trips.evidenceStatus);
  }

  async futurasSinSellarParaRevision() {
    return this.db
      .select({
        id: serviceOccurrences.id,
        serviceDate: serviceOccurrences.serviceDate,
        expectedDeadline: serviceOccurrences.expectedDeadline,
        contractId: serviceContracts.id,
        contractName: serviceContracts.name,
        policy: serviceContracts.policy,
        clientName: accounts.name,
        routeName: routes.name,
        shiftId: shifts.id,
        shiftName: shifts.name,
        shiftStartTime: shifts.startTime,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceProfiles, eq(serviceProfiles.id, serviceOccurrences.serviceProfileId))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(routeShifts, eq(routeShifts.id, serviceProfiles.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .leftJoin(
        complianceFacts,
        eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id),
      )
      .where(
        and(
          isNull(complianceFacts.id),
          gt(serviceOccurrences.expectedDeadline, new Date()),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
        ),
      );
  }

  /**
   * Borra ocurrencias futuras lejanas (service_date > hoy + days).
   * Conserva hasta hoy+days inclusive (ventana rodante).
   * Cascada limpia trips / compliance / ledger.
   * Si `plantGroupId` se pasa, solo ese campus; si no, todas.
   *
   * GUARDA: nunca borra una ocurrencia que ya tenga un compliance_fact.
   * Los hechos se calculan una vez y se congelan — son inmutables.
   * Devuelve { cutoff, deleted, skipped } donde skipped = ocurrencias
   * protegidas por la guarda (tenían hecho de cumplimiento).
   */
  async deleteBeyondHorizon(days: number = OccurrenceRepository.ROLLING_DAYS, plantGroupId?: string) {
    const lastKept = this.toIsoDate(this.addDays(new Date(), days));

    let candidates: { id: string; factId: string | null }[];
    if (plantGroupId) {
      const rows = await this.db
        .select({
          id: serviceOccurrences.id,
          factId: complianceFacts.id,
        })
        .from(serviceOccurrences)
        .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
        .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
        .where(
          and(
            eq(serviceContracts.plantGroupId, plantGroupId),
            sql`${serviceOccurrences.serviceDate} > ${lastKept}`,
          ),
        );
      candidates = rows;
    } else {
      const rows = await this.db
        .select({
          id: serviceOccurrences.id,
          factId: complianceFacts.id,
        })
        .from(serviceOccurrences)
        .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
        .where(sql`${serviceOccurrences.serviceDate} > ${lastKept}`);
      candidates = rows;
    }

    const ids = candidates.filter((c) => c.factId === null).map((c) => c.id);
    const skipped = candidates.length - ids.length;

    if (ids.length === 0) return { cutoff: lastKept, deleted: 0, skipped };

    // Borrar en lotes para no saturar el IN.
    const batchSize = 500;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const removed = await this.db
        .delete(serviceOccurrences)
        .where(inArray(serviceOccurrences.id, batch))
        .returning({ id: serviceOccurrences.id });
      deleted += removed.length;
    }
    return { cutoff: lastKept, deleted, skipped };
  }

  /**
   * Las dos condiciones que ponen a un servicio en la cola del motor.
   * Compartidas por `findPendingVerification` y por el conteo de lo que esa
   * consulta excluye, para que ambos midan **lo mismo** y no dos cosas parecidas.
   */
  private condicionesDeCola(now: Date) {
    const deadlinePassed = lte(
      sql`${serviceOccurrences.expectedDeadline} + (${serviceContracts.policy}->>'verificationGraceMinutes')::int * interval '1 minute'`,
      now.toISOString(),
    );

    // 1) Nunca verificados
    // 2) Pendientes por evidencia con GPS indisponible → reintento (p. ej. cuando
    //    la memoria propia ya se puso al día).
    return and(
      deadlinePassed,
      or(
        isNull(complianceFacts.id),
        and(
          eq(complianceFacts.status, "pendiente_evidencia"),
          eq(trips.evidenceStatus, "indisponible"),
        ),
      ),
    );
  }

  /**
   * Los dos cerrojos de cuenta de ejemplo, en SQL.
   *
   * Es la misma regla que `motivoCuentaDemo` en services, escrita aquí para
   * poder excluirlos sin traerlos. Si una cambia y la otra no, la valla de
   * integración se pone roja: sella sobre demo o deja pasar lo real.
   */
  private esDeCuentaDeEjemplo() {
    return or(eq(accounts.isDemo, true), eq(serviceContracts.status, "demo"));
  }

  async findPendingVerification(now: Date) {
    const rows = await this.db
      .select({
        occurrence: serviceOccurrences,
        contract: serviceContracts,
        trip: trips,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          this.condicionesDeCola(now),
          // El motor no sella sobre cuentas de ejemplo. Se excluyen aquí, antes
          // de cargarlas, y `verifyOccurrence` vuelve a comprobarlo por si
          // alguien llega por otra puerta. Cuántas se quedaron fuera lo dice
          // `contarVencidasDeCuentaDemo` — excluir en silencio es lo que ya nos
          // costó 35 días.
          not(this.esDeCuentaDeEjemplo()!),
          // La pausa de la verificación (0041): ni lo que cae en una pausa ni
          // nada de un contrato en pausa ahora entra a la cola. Cuántos se
          // quedaron fuera lo dice `contarVencidasEnPausa`; `verifyOccurrence`
          // vuelve a preguntar por si alguien llega por otra puerta.
          not(fueraPorPausa(now)),
        ),
      );

    return rows;
  }

  /**
   * Cuántos servicios vencidos NO entraron a la cola por la pausa de su contrato
   * (0041). Igual que el de cuentas de ejemplo: un filtro que no se enuncia se
   * ve idéntico a uno que no filtra.
   */
  async contarVencidasEnPausa(now: Date): Promise<number> {
    const [fila] = await this.db
      .select({ total: count() })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(and(this.condicionesDeCola(now), not(this.esDeCuentaDeEjemplo()!), fueraPorPausa(now)));

    return Number(fila?.total ?? 0);
  }

  /**
   * Cuántos servicios vencidos NO entraron a la cola por ser de cuenta de ejemplo.
   *
   * Existe para que el número se pueda enunciar en vez de esconderlo: un filtro
   * mudo y un filtro que no filtra se ven idénticos desde afuera.
   */
  async contarVencidasDeCuentaDemo(now: Date): Promise<number> {
    const [fila] = await this.db
      .select({ total: count() })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(and(this.condicionesDeCola(now), this.esDeCuentaDeEjemplo()));

    return Number(fila?.total ?? 0);
  }

  /**
   * El `where` de CUALQUIER consulta de ocurrencias por alcance: los contratos
   * que le pertenecen, más el rango de fecha civil.
   *
   * Existe como un solo lugar porque el fetch y el conteo tienen que filtrar
   * **idéntico**. Un `count()` con su propia copia del alcance no falla ruidoso
   * el día que una de las dos cambie: devuelve un número más grande, con
   * ocurrencias de plantas que ese usuario no debe ver. Una cifra de más es una
   * fuga, y se lee como dato correcto. Que sean el mismo código es lo que hace
   * imposible que uno filtre y el otro no.
   *
   * `null` significa "no hay contratos en este alcance" — cero filas y cero
   * conteo, sin ir a la base a preguntar por una lista vacía.
   */
  private async occurrenceConditions(
    target:
      | { kind: "plant"; plantId: string }
      | { kind: "plant_group"; plantGroupId: string }
      | { kind: "client"; clientAccountId: string }
      | { kind: "contract"; contractId: string }
      /**
       * Todos los contratos de un transportista. Es el alcance de la sala de
       * control del carrier: un transportista con tres clientes no puede tener
       * tres pantallas abiertas.
       *
       * Resultó ser una extensión, no un motor nuevo: la resolución de varios
       * contratos ya existía aquí para planta y grupo, y este caso solo cambia
       * por dónde se buscan.
       *
       * `incluirDemo` es explícito y por omisión falso. Un contrato de prueba
       * en la sala del transportista mete servicios que nadie declaró entre los
       * que sí tienen consecuencia — el hallazgo abierto de Ola 2. La pantalla
       * que use esto tiene que ENUNCIAR lo que excluyó: quien opera tiene
       * derecho a saber que no está viendo todo.
       */
      | { kind: "carrier"; carrierAccountId: string; incluirDemo?: boolean },
    from?: Date,
    to?: Date,
  ) {
    const conditions = [];

    if (target.kind === "contract") {
      conditions.push(eq(serviceOccurrences.contractId, target.contractId));
    } else if (target.kind === "carrier") {
      const contratos = await this.db
        .select({ id: serviceContracts.id })
        .from(serviceContracts)
        .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
        .where(
          and(
            eq(serviceContracts.carrierAccountId, target.carrierAccountId),
            ...(target.incluirDemo ? [] : [eq(accounts.isDemo, false)]),
          ),
        );
      if (contratos.length === 0) return null;
      conditions.push(
        inArray(
          serviceOccurrences.contractId,
          contratos.map((c) => c.id),
        ),
      );
    } else {
      const where =
        target.kind === "plant"
          ? eq(serviceContracts.plantId, target.plantId)
          : target.kind === "plant_group"
            ? eq(serviceContracts.plantGroupId, target.plantGroupId)
            : eq(serviceContracts.clientAccountId, target.clientAccountId);
      const contracts = await this.db.query.serviceContracts.findMany({ where });
      const contractIds = contracts.map((c) => c.id);
      if (contractIds.length === 0) return null;
      conditions.push(inArray(serviceOccurrences.contractId, contractIds));
    }

    // La fecha civil la resuelve `localDateIso`, no una segunda aritmética de
    // zona escrita en SQL: esa cuenta ya vive resuelta y probada en un lugar.
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, localDateIso(from, JTTEL_TZ)));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, localDateIso(to, JTTEL_TZ)));

    return conditions;
  }

  async findForPlant(plantId: string, from?: Date, to?: Date) {
    const conditions = await this.occurrenceConditions({ kind: "plant", plantId }, from, to);
    if (!conditions) return [];
    return this.queryOccurrencesWithRelations(conditions);
  }

  async findForPlantGroup(plantGroupId: string, from?: Date, to?: Date) {
    const conditions = await this.occurrenceConditions(
      { kind: "plant_group", plantGroupId },
      from,
      to,
    );
    if (!conditions) return [];
    return this.queryOccurrencesWithRelations(conditions);
  }

  /**
   * Los servicios de TODOS los contratos de un transportista, en una ventana.
   *
   * Devuelve además qué contratos quedaron fuera por ser de prueba, para que la
   * pantalla lo pueda enunciar en vez de esconderlo.
   */
  async findForCarrier(
    carrierAccountId: string,
    from?: Date,
    to?: Date,
    opts: { incluirDemo?: boolean } = {},
  ) {
    const conditions = await this.occurrenceConditions(
      { kind: "carrier", carrierAccountId, incluirDemo: opts.incluirDemo },
      from,
      to,
    );
    const excluidos = opts.incluirDemo
      ? 0
      : (
          await this.db
            .select({ id: serviceContracts.id })
            .from(serviceContracts)
            .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
            .where(
              and(
                eq(serviceContracts.carrierAccountId, carrierAccountId),
                eq(accounts.isDemo, true),
              ),
            )
        ).length;
    if (!conditions) return { ocurrencias: [], contratosDePruebaExcluidos: excluidos };
    return {
      ocurrencias: await this.queryOccurrencesWithRelations(conditions),
      contratosDePruebaExcluidos: excluidos,
    };
  }

  /**
   * El siguiente servicio que abre para este transportista, después de `desde`.
   *
   * Es lo que vuelve honesto el estado vacío de la sala de control. "Sin
   * servicios programados hoy" a secas deja a quien mira sin saber si el
   * sistema está roto o si de verdad no hay nada; con la hora del próximo
   * turno, el vacío se explica solo.
   *
   * Un `min()` en la base, sin traer filas: la sala se abre a cada rato.
   */
  async proximoServicioParaCarrier(carrierAccountId: string, desde: Date) {
    const [fila] = await this.db
      .select({ expectedDeadline: serviceOccurrences.expectedDeadline })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(accounts.isDemo, false),
          gte(serviceOccurrences.expectedDeadline, desde),
        ),
      )
      .orderBy(serviceOccurrences.expectedDeadline)
      .limit(1);
    return fila ?? null;
  }

  async findForScope(scope: OperationalScope, from?: Date, to?: Date) {
    if (scope.kind === "plant") return this.findForPlant(scope.plantId, from, to);
    return this.findForPlantGroup(scope.plantGroupId, from, to);
  }

  /**
   * Sonda de esquema para el vigilante de salud. Una fila, sin filtros.
   *
   * Ejerce **exactamente** `queryOccurrencesWithRelations`, que es la consulta
   * que sirve a monitoreo, cierre, cumplimiento, pendiente-por-evidencia y el
   * expediente. No una parecida: la misma.
   *
   * Por qué existe: el 2026-08-02 la cara cliente entera devolvió 500 con
   * `column compliance_facts.declared_driver_name does not exist`, y
   * `/api/salud` **siguió respondiendo 200 durante todo el episodio**. Vigilaba
   * cuentas, marcas de agua y alertas, todas leídas con listas explícitas de
   * columnas — el estilo que no explota cuando falta una columna. La API
   * relacional de Drizzle pide TODAS las columnas de la tabla, y solo ahí
   * revienta el hueco.
   *
   * Un vigilante que no puede ver la falla es peor que no tener vigilante:
   * da tranquilidad falsa. `limit: 1` para que verlo no cueste.
   */
  async sondaDeEsquema(): Promise<void> {
    await this.queryOccurrencesWithRelations([], 1);
  }

  /**
   * ⚠️ EL TECHO NO ES OPCIONAL. ⚠️
   *
   * Estas dos consultas cuentan lo que le FALTA veredicto al motor. El
   * generador de ocurrencias trabaja por adelantado —hoy hay 1 161 ocurrencias
   * futuras creadas, hasta el 2026-09-02—, así que una consulta sin techo las
   * cuenta a todas como si les faltara juicio y el instrumento nace mintiendo.
   * Eso ya costó dos investigaciones.
   *
   * El techo es el propio umbral: `plazo + gracia <= ahora − umbral`. Una sola
   * condición cierra las dos puertas —el futuro y lo recién vencido—, y por eso
   * no puede haber una llamada sin umbral.
   */

  /**
   * Servicios que YA deberían tener veredicto y no tienen NINGUNO.
   *
   * No es lo mismo que "pendiente por evidencia": un servicio sin señal sí
   * escribe su hecho. Sin hecho significa que la verificación **reventó** y
   * nadie se enteró — el fallo mudo que escondió ocho servicios 35 días.
   *
   * Umbral por omisión 2 h: el camino sano escribe el primer hecho en menos de
   * 5 minutos (785 de 926 medidos), y la caída más larga que no fue de
   * credenciales duró 101 min. 2 h la despeja con margen.
   */
  async contarFallosMudos(umbralHoras = 2): Promise<{ total: number; masAntiguoHoras: number | null }> {
    // Entero finito y no negativo: el intervalo viaja como parámetro, nunca
    // interpolado en el SQL.
    const horas = Number.isFinite(umbralHoras) ? Math.max(0, Math.floor(umbralHoras)) : 0;
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        masViejo: sql<Date | null>`min(${serviceOccurrences.expectedDeadline})`,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          isNull(complianceFacts.id),
          // Las cuentas de ejemplo NO se vigilan. Sin esto, este contador leía
          // las ocurrencias de Honeywell y PRUEBA REAL —que desde que la llave
          // demo se cerró (#206) no se juzgan nunca— y las reportaba como
          // «servicios sin veredicto»: crecían 3 al día, para siempre.
          deCuentaReal(serviceContracts.clientAccountId),
          sql`${serviceOccurrences.expectedDeadline}
              + COALESCE((${serviceContracts.policy}->>'verificationGraceMinutes')::int, 0) * interval '1 minute'
              <= now() - make_interval(hours => ${horas})`,
        ),
      );
    const total = Number(row?.total ?? 0);
    const masAntiguoHoras = row?.masViejo
      ? (Date.now() - new Date(row.masViejo).getTime()) / 3_600_000
      : null;
    return { total, masAntiguoHoras };
  }

  /**
   * Servicios atascados en `pendiente_evidencia` desde hace demasiado, sin
   * haber sido retirados de la cola.
   *
   * Umbral por omisión 48 h y no 2: aquí el piso de ruido es el archivador, que
   * tarda una media de ~7 h y un p95 de ~30 h en cubrir una ventana. Medir esto
   * con el umbral del otro contador lo dejaría rojo de forma permanente, y un
   * instrumento que siempre grita es un instrumento apagado.
   *
   * Los ya retirados (`sin_evidencia_posible`) NO cuentan: ya se declaró que no
   * tienen arreglo y salieron de la cola a propósito.
   */
  async contarPendientesEstancados(
    umbralHoras = 48,
  ): Promise<{ total: number; masAntiguoHoras: number | null }> {
    // Entero finito y no negativo: el intervalo viaja como parámetro, nunca
    // interpolado en el SQL.
    const horas = Number.isFinite(umbralHoras) ? Math.max(0, Math.floor(umbralHoras)) : 0;
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        masViejo: sql<Date | null>`min(${serviceOccurrences.expectedDeadline})`,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          eq(complianceFacts.status, "pendiente_evidencia"),
          ne(trips.evidenceStatus, "sin_evidencia_posible"),
          sql`${serviceOccurrences.expectedDeadline}
              + COALESCE((${serviceContracts.policy}->>'verificationGraceMinutes')::int, 0) * interval '1 minute'
              <= now() - make_interval(hours => ${horas})`,
        ),
      );
    const total = Number(row?.total ?? 0);
    const masAntiguoHoras = row?.masViejo
      ? (Date.now() - new Date(row.masViejo).getTime()) / 3_600_000
      : null;
    return { total, masAntiguoHoras };
  }

  /**
   * Los pendientes estancados, uno por uno, con el motivo que el motor dejó
   * escrito en el ledger de su última verificación.
   *
   * El motivo (`memoria_no_alcanza` vs `sin_senal`) es instrumental interno:
   * esta consulta la usa la cara J-Staff y nadie más. La planta ve
   * `pendiente_evidencia` y nada más.
   */
  async listarPendientesEstancados(umbralHoras = 48, limite = 50) {
    const horas = Number.isFinite(umbralHoras) ? Math.max(0, Math.floor(umbralHoras)) : 0;
    const rows = await this.db
      .select({
        occurrenceId: serviceOccurrences.id,
        serviceDate: serviceOccurrences.serviceDate,
        expectedDeadline: serviceOccurrences.expectedDeadline,
        contrato: serviceContracts.name,
        evidenceStatus: trips.evidenceStatus,
        motivo: sql<string | null>`(
          SELECT le.metadata->>'motivoSinEvidencia'
            FROM ${ledgerEntries} le
           WHERE le.service_occurrence_id = ${serviceOccurrences.id}
             AND le.action = 'verificacion_automatica'
           ORDER BY le.created_at DESC
           LIMIT 1)`,
        intentos: sql<number>`(
          SELECT count(*)::int FROM ${ledgerEntries} le
           WHERE le.service_occurrence_id = ${serviceOccurrences.id}
             AND le.action = 'verificacion_automatica')`,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          eq(complianceFacts.status, "pendiente_evidencia"),
          ne(trips.evidenceStatus, "sin_evidencia_posible"),
          sql`${serviceOccurrences.expectedDeadline}
              + COALESCE((${serviceContracts.policy}->>'verificationGraceMinutes')::int, 0) * interval '1 minute'
              <= now() - make_interval(hours => ${horas})`,
        ),
      )
      .orderBy(serviceOccurrences.expectedDeadline)
      .limit(limite);
    return rows;
  }

  private async queryOccurrencesWithRelations(conditions: unknown[], limit?: number) {
    return this.db.query.serviceOccurrences.findMany({
      where: and(...(conditions as Parameters<typeof and>)),
      ...(limit === undefined ? {} : { limit }),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: true,
        profile: {
          with: {
            geofence: true,
            routeShift: { with: { route: true, shift: true } },
          },
        },
        contract: { with: { plant: true, plantGroup: true, carrier: true, client: true } },
      },
      orderBy: (o, { desc }) => [desc(o.serviceDate)],
    });
  }

  async findForClientAccount(clientAccountId: string, from?: Date, to?: Date) {
    const conditions = await this.occurrenceConditions(
      { kind: "client", clientAccountId },
      from,
      to,
    );
    if (!conditions) return [];
    return this.queryOccurrencesWithRelations(conditions);
  }

  async findForContract(contractId: string, from?: Date, to?: Date) {
    const conditions = await this.occurrenceConditions({ kind: "contract", contractId }, from, to);
    if (!conditions) return [];
    return this.queryOccurrencesWithRelations(conditions);
  }

  /**
   * Las mismas ocurrencias, pero solo las N más recientes — con `LIMIT` en la
   * base y no un `.slice()` después de traerlas todas.
   */
  async findRecentForContract(contractId: string, limit: number) {
    const conditions = await this.occurrenceConditions({ kind: "contract", contractId });
    if (!conditions) return [];
    return this.db.query.serviceOccurrences.findMany({
      where: and(...conditions),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: true,
        profile: {
          with: {
            geofence: true,
            routeShift: { with: { route: true, shift: true } },
          },
        },
        contract: { with: { plant: true, plantGroup: true, carrier: true, client: true } },
      },
      orderBy: (o, { desc }) => [desc(o.serviceDate)],
      limit,
    });
  }

  /**
   * Cuántas ocurrencias hay de cada estado, contadas por la base.
   *
   * Contra el camino que reemplaza —traer las filas con sus nueve relaciones
   * anidadas, sin límite, y contarlas con `.filter().length`— aquí no viaja ni
   * una fila de ocurrencia: viajan cinco números. El precedente medido del repo
   * dice dónde estaba el costo (`resumenDiarioPorUnidad`): no en encontrar las
   * filas sino en transportarlas y materializarlas en JavaScript.
   */
  private async countByStatus(conditions: unknown[] | null): Promise<ConteoPorEstado> {
    const vacio: ConteoPorEstado = {
      total: 0,
      cumplido: 0,
      no_cumplido: 0,
      pendiente_evidencia: 0,
      sin_hecho: 0,
    };
    if (!conditions) return vacio;

    const rows = await this.db
      .select({
        status: complianceFacts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceOccurrences)
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(and(...(conditions as Parameters<typeof and>)))
      .groupBy(complianceFacts.status);

    const conteo = { ...vacio };
    for (const row of rows) {
      const n = Number(row.count);
      conteo.total += n;
      // Sin hecho: el árbitro todavía no juzgó ese servicio. NO es un cuarto
      // veredicto, y por eso se nombra aparte en vez de sumarse a ninguno.
      if (row.status === null) conteo.sin_hecho += n;
      else if (row.status === "cumplido") conteo.cumplido += n;
      else if (row.status === "no_cumplido") conteo.no_cumplido += n;
      else if (row.status === "pendiente_evidencia") conteo.pendiente_evidencia += n;
    }
    return conteo;
  }

  async countByStatusForScope(scope: OperationalScope, from?: Date, to?: Date) {
    const target =
      scope.kind === "plant"
        ? ({ kind: "plant", plantId: scope.plantId } as const)
        : ({ kind: "plant_group", plantGroupId: scope.plantGroupId } as const);
    return this.countByStatus(await this.occurrenceConditions(target, from, to));
  }

  /**
   * El sello más reciente del alcance: cuándo se selló y de qué día de servicio.
   *
   * Solo lee. Existe para que el inicio pueda decir "último cierre 06:50:00"
   * sin traerse las ocurrencias del día entero para mirar la última — que es lo
   * que costaba antes de tener esto, y el inicio es la pantalla que más se
   * abre.
   *
   * Devuelve `null` cuando el alcance no tiene un solo hecho sellado: una
   * unidad recién configurada no tiene último cierre, y la pantalla debe poder
   * decir eso en vez de pintar una hora falsa.
   */
  async ultimoSelloForScope(
    scope: OperationalScope,
  ): Promise<{ selladoEn: Date; serviceDate: string } | null> {
    const target =
      scope.kind === "plant"
        ? ({ kind: "plant", plantId: scope.plantId } as const)
        : ({ kind: "plant_group", plantGroupId: scope.plantGroupId } as const);
    const conditions = await this.occurrenceConditions(target);
    if (!conditions) return null;

    const [fila] = await this.db
      .select({
        selladoEn: complianceFacts.materializedAt,
        serviceDate: serviceOccurrences.serviceDate,
      })
      .from(serviceOccurrences)
      .innerJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(desc(complianceFacts.materializedAt))
      .limit(1);

    if (!fila?.selladoEn) return null;
    return { selladoEn: fila.selladoEn, serviceDate: String(fila.serviceDate).slice(0, 10) };
  }

  async countByStatusForClientAccount(clientAccountId: string, from?: Date, to?: Date) {
    return this.countByStatus(
      await this.occurrenceConditions({ kind: "client", clientAccountId }, from, to),
    );
  }

  /**
   * Servicios acreditados a cada unidad, y en cuántos días distintos.
   *
   * Los cuenta la base y devuelve una fila por unidad. Con 82 unidades por 30
   * días, traer los hechos para contarlos en JavaScript es el patrón que este
   * repositorio ya midió y desterró: el costo no está en encontrarlos, está en
   * transportarlos.
   *
   * **Solo cuenta hechos con unidad acreditada**, que por diseño del motor son
   * los `cumplido`: un `no_cumplido` nunca tiene unidad observada, así que una
   * tabla construida sobre esto no puede —ni debe— nombrar unidad para lo que
   * no se cumplió.
   */
  async serviciosPorUnidad(
    carrierAccountId: string,
    desde: Date,
    hasta: Date,
  ): Promise<Map<string, { servicios: number; dias: number }>> {
    const filas = await this.db
      .select({
        unitId: complianceFacts.observedUnitId,
        servicios: sql<number>`count(*)::int`,
        dias: sql<number>`count(distinct ${serviceOccurrences.serviceDate})::int`,
      })
      .from(complianceFacts)
      .innerJoin(
        serviceOccurrences,
        eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId),
      )
      .innerJoin(units, eq(units.id, complianceFacts.observedUnitId))
      .where(
        and(
          eq(units.carrierAccountId, carrierAccountId),
          gte(serviceOccurrences.serviceDate, localDateIso(desde, JTTEL_TZ)),
          lte(serviceOccurrences.serviceDate, localDateIso(hasta, JTTEL_TZ)),
        ),
      )
      .groupBy(complianceFacts.observedUnitId);

    const porUnidad = new Map<string, { servicios: number; dias: number }>();
    for (const f of filas) {
      if (!f.unitId) continue;
      porUnidad.set(f.unitId, { servicios: Number(f.servicios), dias: Number(f.dias) });
    }
    return porUnidad;
  }

  /**
   * En cuántos días del periodo hubo servicios contratados para este
   * transportista, y cuántos fueron.
   *
   * Es el denominador honesto de "N de M días con servicio". El calendario NO
   * sirve como denominador: medido el 2026-08-02 sobre treinta días civiles,
   * el cliente contratado solo tenía servicios en **20** de ellos. Contra 30,
   * una unidad que trabajó todos los días de operación se lee como si hubiera
   * faltado diez.
   *
   * Es el mismo cuidado que la tira de catorce días: "sin servicios
   * programados" y "sin datos" no son lo mismo, y contarlos juntos convierte
   * un dato correcto en una afirmación falsa (§D del Marco, eje del ALCANCE).
   *
   * Las cuentas de demostración quedan fuera **del denominador**, no de los
   * datos. Sus contratos aportan 9 días de operación que nadie operó: contarlos
   * infla el denominador de 20 a 29 y vuelve a hundir la cifra de cada unidad.
   * Que el árbitro sí selle sobre esas cuentas es el hallazgo abierto de Ola 2
   * (Ficha-Diagnostico-Datos-No-Declarados) — aquí solo se evita construir un
   * denominador con ellas.
   */
  async diasConServicioContratado(
    carrierAccountId: string,
    desde: Date,
    hasta: Date,
  ): Promise<{ dias: number; ocurrencias: number }> {
    const [fila] = await this.db
      .select({
        dias: sql<number>`count(distinct ${serviceOccurrences.serviceDate})::int`,
        ocurrencias: sql<number>`count(*)::int`,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(accounts.isDemo, false),
          gte(serviceOccurrences.serviceDate, localDateIso(desde, JTTEL_TZ)),
          lte(serviceOccurrences.serviceDate, localDateIso(hasta, JTTEL_TZ)),
        ),
      );
    return { dias: Number(fila?.dias ?? 0), ocurrencias: Number(fila?.ocurrencias ?? 0) };
  }

  async countByStatusForContract(contractId: string, from?: Date, to?: Date) {
    return this.countByStatus(
      await this.occurrenceConditions({ kind: "contract", contractId }, from, to),
    );
  }

  /**
   * Cuándo se selló el pendiente por evidencia más viejo que sigue abierto.
   *
   * Es la mitad que le falta a "22 servicios sin poder juzgarse": un conteo sin
   * antigüedad alarma sin informar, porque no dice de cuándo (§D del Marco).
   *
   * Un `min()` en la base, sin traer filas: la pantalla de inicio es la que más
   * se abre y no puede pagar el costo de materializar los pendientes para mirar
   * el primero.
   *
   * Devuelve `null` cuando el alcance no tiene un solo pendiente abierto — que
   * es la respuesta buena, y la pantalla debe poder decirla en vez de pintar
   * una antigüedad de cero.
   */
  async pendienteMasViejoForClientAccount(clientAccountId: string): Promise<Date | null> {
    const conditions = await this.occurrenceConditions({ kind: "client", clientAccountId });
    if (!conditions) return null;

    const [fila] = await this.db
      .select({ selladoEn: sql<Date | null>`min(${complianceFacts.materializedAt})` })
      .from(serviceOccurrences)
      .innerJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          ...(conditions as Parameters<typeof and>),
          eq(complianceFacts.status, "pendiente_evidencia"),
        ),
      );

    return fila?.selladoEn ? new Date(fila.selladoEn) : null;
  }

  /**
   * Un renglón por día civil con servicios programados, contado por la base.
   *
   * **Un día sin renglón es un día sin servicios programados** — no un día sin
   * datos. Esa distinción es la que decide si la tira de 14 días se puede
   * dibujar: un cuadro que significa dos cosas distintas es peor que ninguno.
   * Se sostiene porque las ocurrencias se generan por adelantado, así que la
   * ausencia de ocurrencia en un día pasado significa que no se programó.
   *
   * `sin_hecho` es su propia columna, no se reparte entre los veredictos: un
   * servicio programado que el árbitro todavía no juzgó no es un cuarto
   * veredicto.
   */
  async tiraDiariaForScope(
    scope: OperationalScope,
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      dia: string;
      cumplido: number;
      no_cumplido: number;
      pendiente_evidencia: number;
      sin_hecho: number;
    }>
  > {
    const target =
      scope.kind === "plant"
        ? ({ kind: "plant", plantId: scope.plantId } as const)
        : ({ kind: "plant_group", plantGroupId: scope.plantGroupId } as const);
    const conditions = await this.occurrenceConditions(target, from, to);
    if (!conditions) return [];

    const filas = await this.db
      .select({
        dia: serviceOccurrences.serviceDate,
        status: complianceFacts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceOccurrences)
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(and(...(conditions as Parameters<typeof and>)))
      .groupBy(serviceOccurrences.serviceDate, complianceFacts.status);

    const porDia = new Map<string, ReturnType<typeof vacio>>();
    function vacio() {
      return { cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0, sin_hecho: 0 };
    }
    for (const f of filas) {
      const dia = String(f.dia).slice(0, 10);
      const acc = porDia.get(dia) ?? vacio();
      const n = Number(f.count);
      if (f.status === null) acc.sin_hecho += n;
      else if (f.status === "cumplido") acc.cumplido += n;
      else if (f.status === "no_cumplido") acc.no_cumplido += n;
      else if (f.status === "pendiente_evidencia") acc.pendiente_evidencia += n;
      porDia.set(dia, acc);
    }

    return [...porDia.entries()]
      .map(([dia, c]) => ({ dia, ...c }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }

  /**
   * El conteo de un contrato en UN día civil, comparando la columna
   * `serviceDate` tal cual.
   *
   * Aparte de `countByStatusForContract(id, from, to)` a propósito: ese recibe
   * `Date` y los convierte con `localDateIso`, y quien ya tiene la fecha como
   * `YYYY-MM-DD` no debe darse la vuelta por un `Date` para volver a la misma
   * cadena. Esa ida y vuelta es exactamente donde se cuela un día de
   * corrimiento.
   */
  async countByStatusForContractDate(contractId: string, serviceDate: string) {
    return this.countByStatus([
      eq(serviceOccurrences.contractId, contractId),
      eq(serviceOccurrences.serviceDate, serviceDate),
    ]);
  }

  async findById(id: string) {
    return this.db.query.serviceOccurrences.findFirst({
      where: eq(serviceOccurrences.id, id),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: { with: { evidencePoints: true } },
        profile: { with: { contract: true, geofence: true, routeShift: true } },
        // El contrato PROPIO de la ocurrencia (no el del perfil) con su cuenta
        // cliente: es lo que el motor lee para saber si esta cuenta es de
        // ejemplo antes de sellar nada. Se trae aquí porque `verifyOccurrence`
        // ya hace esta lectura y no hay razón para pagar una segunda.
        contract: { with: { client: true } },
      },
    });
  }

  /**
   * El periodo día por día de UNA ruta, contado por resultado.
   *
   * Es la tira de días del expediente de ruta. Se agrega en la base porque la
   * alternativa —traer las ocurrencias del cliente con todas sus relaciones y
   * filtrar por ruta en el proceso— lee más de mil filas con sus contratos,
   * perfiles y geocercas para pintar treinta cuadritos.
   *
   * Cuenta también los que **no tienen hecho**: un día sin sellar y un día
   * cumplido no son el mismo día, y la tira que los pinta igual borra la
   * distinción que el producto existe para sostener.
   */
  async diasDeRuta(routeId: string, desdeFecha: string, hastaFecha: string) {
    return this.db
      .select({
        fecha: serviceOccurrences.serviceDate,
        status: complianceFacts.status,
        total: count(),
      })
      .from(serviceOccurrences)
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .leftJoin(
        complianceFacts,
        eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id),
      )
      .where(
        and(
          eq(routeShifts.routeId, routeId),
          gte(serviceOccurrences.serviceDate, desdeFecha),
          // El techo NO es opcional. El generador crea ocurrencias por
          // adelantado, así que sin él la tira pinta días que todavía no
          // ocurren como "sin sellar" — y un día futuro sin sellar se ve
          // idéntico a uno pasado que el árbitro no alcanzó a juzgar.
          lte(serviceOccurrences.serviceDate, hastaFecha),
        ),
      )
      .groupBy(serviceOccurrences.serviceDate, complianceFacts.status)
      .orderBy(serviceOccurrences.serviceDate);
  }

  /**
   * Los últimos servicios de una ruta, con lo que hace falta para leerlos.
   *
   * **Acotado a hoy.** El generador crea ocurrencias con semanas de
   * anticipación, así que ordenar por fecha descendente sin techo devuelve el
   * futuro: una lista llamada "últimos servicios" encabezada por el 1 de
   * septiembre, todos sin sellar. Es correcto como consulta y falso como
   * afirmación.
   */
  async ultimosServiciosDeRuta(routeId: string, limite: number, hastaFecha: string) {
    return this.db
      .select({
        ocurrenciaId: serviceOccurrences.id,
        fecha: serviceOccurrences.serviceDate,
        deadline: serviceOccurrences.expectedDeadline,
        turno: shifts.name,
        status: complianceFacts.status,
        timing: complianceFacts.timing,
        llegada: complianceFacts.observedArrivalAt,
        cobertura: complianceFacts.observedRouteMatchPct,
        excusable: complianceFacts.lateExcusable,
      })
      .from(serviceOccurrences)
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .leftJoin(
        complianceFacts,
        eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id),
      )
      .where(
        and(
          eq(routeShifts.routeId, routeId),
          lte(serviceOccurrences.serviceDate, hastaFecha),
        ),
      )
      .orderBy(desc(serviceOccurrences.serviceDate))
      .limit(limite);
  }

  /**
   * Los servicios que una unidad cubrió, contados por resultado.
   *
   * **Solo cuenta hechos donde el árbitro ACREDITÓ a esta unidad.** Un
   * `no_cumplido` nunca tiene unidad acreditada, así que este conteo no puede
   * traer ninguno — y eso es correcto, no un filtro escondido: la unidad no
   * tiene resultado propio, los servicios que cubrió sí tienen el suyo.
   *
   * Se agrega en la base porque el expediente mira meses, y la alternativa
   * —traer las ocurrencias de todos los contratos y filtrar en el proceso—
   * lee miles de filas para contar decenas.
   */
  async serviciosCubiertosPorUnidad(unitId: string, desdeFecha: string) {
    return this.db
      .select({
        status: complianceFacts.status,
        total: count(),
      })
      .from(complianceFacts)
      .innerJoin(
        serviceOccurrences,
        eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId),
      )
      .where(
        and(
          eq(complianceFacts.observedUnitId, unitId),
          gte(serviceOccurrences.serviceDate, desdeFecha),
        ),
      )
      .groupBy(complianceFacts.status);
  }

  /** Los últimos servicios que cubrió esta unidad, para poder abrirlos. */
  async ultimosServiciosDeUnidad(unitId: string, limite: number) {
    return this.db
      .select({
        ocurrenciaId: serviceOccurrences.id,
        fecha: serviceOccurrences.serviceDate,
        status: complianceFacts.status,
        timing: complianceFacts.timing,
        deadline: serviceOccurrences.expectedDeadline,
        ruta: routes.name,
        turno: shifts.name,
      })
      .from(complianceFacts)
      .innerJoin(
        serviceOccurrences,
        eq(serviceOccurrences.id, complianceFacts.serviceOccurrenceId),
      )
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .where(eq(complianceFacts.observedUnitId, unitId))
      .orderBy(desc(serviceOccurrences.serviceDate))
      .limit(limite);
  }

  /**
   * La fecha civil de una ocurrencia, **solo si es de este transportista**.
   *
   * Existe para que el Workbench pueda abrir un servicio por su identificador
   * sin pagar `findById`, que arrastra los puntos de evidencia del viaje
   * entero — miles de filas para leer una fecha.
   *
   * La pertenencia se resuelve en el `where` y no después en el proceso web:
   * un identificador de otro carrier no devuelve fecha, así que no hay camino
   * por el que la pantalla se entere de que existe. Es la ley 3 hecha consulta.
   */
  async serviceDateForCarrier(id: string, carrierAccountId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ serviceDate: serviceOccurrences.serviceDate })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .where(
        and(
          eq(serviceOccurrences.id, id),
          eq(serviceContracts.carrierAccountId, carrierAccountId),
        ),
      )
      .limit(1);
    return fila?.serviceDate ?? null;
  }
}

/**
 * La versión del transportista sobre un servicio — el frente de reconciliación.
 *
 * ⚠ **Este repositorio NO puede tocar un hecho, y no por disciplina: por
 * construcción.** No importa `complianceFacts`, no lo escribe y no lo
 * referencia. La tabla tampoco (migración `0022`, comprobada con cero llaves
 * foráneas hacia hechos). Si el auditado pudiera cambiar su calificación,
 * J-Telemetry deja de ser árbitro.
 */
export class AportacionesRepository {
  constructor(private db: Database) {}

  /**
   * Registra la versión del transportista.
   *
   * `actorKind`/`actorId` son la firma y van obligados: **sin firma no sirve
   * para reconciliar nada** — una aportación anónima no la puede sostener nadie
   * después.
   */
  async crear(data: {
    serviceOccurrenceId: string;
    carrierAccountId: string;
    motivo?: string | null;
    nota?: string | null;
    declaredUnitId?: string | null;
    adjuntos?: Array<{ nombre: string; url: string }>;
    actorKind: string;
    actorId?: string | null;
  }) {
    const [fila] = await this.db
      .insert(carrierAportaciones)
      .values({
        serviceOccurrenceId: data.serviceOccurrenceId,
        carrierAccountId: data.carrierAccountId,
        motivo: data.motivo ?? null,
        nota: data.nota ?? null,
        declaredUnitId: data.declaredUnitId ?? null,
        adjuntos: data.adjuntos ?? [],
        actorKind: data.actorKind,
        actorId: data.actorId ?? null,
      })
      .returning();
    return fila!;
  }

  /** Las de un servicio, la más reciente primero. Incluye las retiradas. */
  async listarPorOcurrencia(serviceOccurrenceId: string) {
    return this.db
      .select()
      .from(carrierAportaciones)
      .where(eq(carrierAportaciones.serviceOccurrenceId, serviceOccurrenceId))
      .orderBy(desc(carrierAportaciones.createdAt));
  }

  /**
   * Retirar es un ESTADO, no un borrado.
   *
   * Lo que se dijo se dijo: una reconciliación que se puede borrar no
   * reconcilia nada, y el registro tiene que poder mostrar que hubo una versión
   * y que su autor la retiró.
   */
  async retirar(id: string, carrierAccountId: string) {
    const [fila] = await this.db
      .update(carrierAportaciones)
      .set({ estado: "retirada" })
      .where(
        and(
          eq(carrierAportaciones.id, id),
          eq(carrierAportaciones.carrierAccountId, carrierAccountId),
        ),
      )
      .returning();
    return fila ?? null;
  }
}

export class ComplianceRepository {
  constructor(private db: Database) {}

  async saveFact(data: {
    serviceOccurrenceId: string;
    tripId: string;
    expectedDeadline: Date;
    expectedGeofenceId: string;
    referenceUnitId?: string | null;
    observedUnitId?: string | null;
    observedArrivalAt?: Date | null;
    observedRouteMatchPct?: number | null;
    servedVariantId?: string | null;
    status: "cumplido" | "no_cumplido" | "pendiente_evidencia";
    timing?: "temprano" | "a_tiempo" | "tarde" | null;
    lateExcusable: boolean;
    excusableReason?: string | null;
    routeStrictnessApplied: "destino_only" | "kml_full";
    contractPolicySnapshot: ContractPolicy;
    /**
     * El expediente de candidatas — Parte 2. Opcional a propósito.
     *
     * ⚠ **Solo entra por aquí, que es un INSERT.** No existe —y no debe
     * existir— ningún camino que lo escriba sobre un hecho ya sellado: los
     * anteriores a la Parte 2 se quedan en `null` para siempre, y ese `null` es
     * la única forma de saber que a esas candidatas nunca se les preguntó.
     * Rellenarlo lo borraría sin dejar rastro.
     */
    candidatasSnapshot?: CandidatasSnapshot | null;
    /**
     * La densidad con la que se juzgó — Paso 1. Solo entra por este INSERT, y
     * como `candidatasSnapshot`, **nunca se escribe sobre un hecho ya sellado**:
     * su `null` significa «no se midió» y rellenarlo lo borraría.
     */
    densidadSnapshot?: {
      huecoMedianaS: number | null;
      huecoPeorS: number | null;
      aparatos: number;
      puntos: number;
    } | null;
    /**
     * Cuándo se materializó este veredicto. Por omisión, ahora.
     *
     * Se pasa explícito cuando un reintento **no cambió nada**: el hecho se
     * borra y se vuelve a insertar en cada pasada, y dejar que la fecha se
     * corriera hacía que un veredicto del 7 de septiembre dijera haberse
     * materializado hoy. Además de falso, rompía el acta: `ledger-pairing.ts`
     * busca el sello posterior a esta fecha, y si avanza sin que se escriba un
     * sello nuevo, no queda nada que emparejar.
     */
    materializedAt?: Date;
  }) {
    const [fact] = await this.db
      .insert(complianceFacts)
      .values(data)
      .onConflictDoNothing()
      .returning();
    if (fact) return fact;

    /*
     * AQUÍ MURIÓ EL MOTOR 13 702 VECES, y el `!` de antes es quien lo escondía.
     *
     * `service_occurrence_id` es único y el cron corre cada minuto. Cuando dos
     * pasadas se enciman sobre el mismo servicio —medido el 19-sep-2026: el
     * 41 % de los sellos consecutivos de una misma ocurrencia caen a menos de
     * 45 s, con mínimo de 0 s— la segunda borra, inserta, y choca contra la
     * fila que la primera acaba de escribir. `onConflictDoNothing` entonces
     * **no devuelve ninguna fila**, y el `return fact!` afirmaba que sí.
     *
     * El `undefined` viajaba hasta `verification.ts`, que unas líneas después
     * lee `fact.status` y revienta con «Cannot read properties of undefined
     * (reading 'status')». Ese mensaje, 13 702 veces en 412 servicios, es la
     * huella exacta de esta línea. El `!` no era un descuido de tipos: era la
     * única afirmación del camino que la base no garantizaba.
     *
     * Qué se hace ahora: se devuelve **el hecho que ganó la carrera**. Las dos
     * pasadas juzgan la misma evidencia y llegan al mismo veredicto, así que
     * el que quedó es el mismo que habríamos escrito. Lo que NO se hace es
     * fingir que no pasó nada: queda en consola para poder contarlo.
     *
     * ⚠ Esto quita el reventón, NO la carrera. Que dos pasadas del cron
     * trabajen a la vez sobre el mismo servicio sigue siendo cierto, y es
     * decisión aparte — ver `docs/Diagnostico-Cadencia-Del-Motor-2026-09-19.md`.
     */
    const [gano] = await this.db
      .select()
      .from(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, data.serviceOccurrenceId));

    if (!gano) {
      /*
       * Ni insertó ni hay fila. No es la carrera: es otra cosa, y tiene que
       * doler aquí y no tres funciones más adelante disfrazada de TypeError.
       */
      throw new Error(
        `No se pudo guardar el hecho de la ocurrencia ${data.serviceOccurrenceId}: ` +
          `el INSERT no devolvió fila y tampoco existe una previa.`,
      );
    }

    console.warn(
      `[verify] carrera sobre la ocurrencia ${data.serviceOccurrenceId}: ` +
        `otra pasada del cron selló primero (${gano.status}). Se usa el hecho que ganó.`,
    );
    return gano;
  }

  /**
   * Qué unidades ACREDITARON otra ruta ese mismo día, para este transportista.
   *
   * Es el empalme del expediente sin atribución, y **es lectura de hoy**: no hay
   * campo que lo guarde, se deriva cruzando el ledger del día consigo mismo. La
   * pantalla tiene que declararlo como tal.
   *
   * ⚠ Se pregunta por la candidata que llegó, no por «alguna candidata»: la
   * lista de candidatas de un servicio es la flota entera —mediana de 50— y
   * preguntar «¿alguna acreditó otra ruta?» contesta que sí siempre (regla 21).
   * Aquí eso se respeta devolviendo un mapa POR UNIDAD, para que quien llama
   * consulte solo las que le interesan.
   */
  async unidadesQueAcreditaronEnFecha(
    carrierAccountId: string,
    serviceDate: string,
    excluirOccurrenceId: string,
    /**
     * El cliente de ESTE servicio. Cuando la otra ruta es de otro cliente, el
     * nombre **no sale**: decirlo contaría la operación de un tercero (Ley 3).
     * Está medido que el caso existe — en 49 de 397 servicios (12.3 %) la unidad
     * que llegó acreditó a otro cliente—, así que no es una hipótesis.
     */
    clientAccountId?: string,
  ): Promise<Map<string, { rutaNombre: string | null; fecha: string }>> {
    const filas = await this.db.execute<{
      clave: string;
      ruta: string;
      cliente: string;
    }>(sql`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (
           SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') AS clave,
             r.name AS ruta,
             sc.client_account_id::text AS cliente
        FROM ult
        JOIN service_occurrences o ON o.id = ult.occ
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN route_shifts rs ON rs.id = o.route_shift_id
        JOIN routes r ON r.id = rs.route_id
        CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE o.service_date = ${serviceDate}
         AND sc.carrier_account_id = ${carrierAccountId}
         AND o.id <> ${excluirOccurrenceId}
         AND s->>'step' = 'candidata'
         AND s->>'result' = 'sirvio_ruta'
         AND COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') IS NOT NULL
    `);

    const mapa = new Map<string, { rutaNombre: string | null; fecha: string }>();
    for (const f of filas as unknown as Array<{
      clave: string;
      ruta: string;
      cliente: string;
    }>) {
      if (!f.clave || mapa.has(f.clave)) continue;
      /*
       * El HECHO de que hubo empalme sí es del interés de esta planta; **de
       * quién era el otro servicio, no**. Cuando el cliente difiere, el nombre
       * se cae aquí — en el repositorio y no en la pantalla, para que ninguna
       * vista futura lo reciba y tenga que acordarse de filtrarlo.
       */
      const esDelMismoCliente =
        clientAccountId === undefined || f.cliente === clientAccountId;
      mapa.set(f.clave, {
        rutaNombre: esDelMismoCliente ? f.ruta : null,
        fecha: serviceDate,
      });
    }
    return mapa;
  }

  /** Borra el hecho sin archivar — para retries de pendiente y limpieza en tests. */
  async deleteFactForOccurrence(serviceOccurrenceId: string) {
    await this.db
      .delete(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, serviceOccurrenceId));
  }

  /**
   * Copia el hecho vigente a compliance_fact_history y luego lo borra de
   * compliance_facts. Llama ANTES de saveFact en cualquier re-juicio.
   * Devuelve el id de la fila de historial para poder actualizar
   * replaced_by_fact_id una vez que el hecho sucesor existe.
   */
  async archiveAndDeleteFact(
    serviceOccurrenceId: string,
    actorKind: string,
    actorId: string | null,
  ): Promise<string> {
    const current = await this.db.query.complianceFacts.findFirst({
      where: eq(complianceFacts.serviceOccurrenceId, serviceOccurrenceId),
    });
    if (!current) {
      throw new Error(`archiveAndDeleteFact: no hay hecho vigente para ${serviceOccurrenceId}`);
    }

    const [historyRow] = await this.db
      .insert(complianceFactHistory)
      .values({
        serviceOccurrenceId,
        status: current.status,
        timing: current.timing,
        factSnapshot: current as unknown as Record<string, unknown>,
        replacedByFactId: null,
        actorKind,
        actorId,
      })
      .returning({ id: complianceFactHistory.id });

    await this.db
      .delete(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, serviceOccurrenceId));

    return historyRow!.id;
  }

  /**
   * Inserta en historial usando datos de un hecho ya cargado en memoria.
   * No relee de DB ni borra el hecho vigente — úsalo cuando ya eliminaste el hecho
   * y sólo necesitas archivar retroactivamente si el estado cambió.
   *
   * `existingFact` es el hecho COMPLETO (no un subconjunto): la foto de fact_snapshot
   * debe ser fiel a la fila, y tiparlo así evita que un caller futuro archive de menos.
   */
  async insertHistoryEntry(
    existingFact: ComplianceFact,
    actorKind: string,
    actorId: string | null,
  ): Promise<string> {
    const [historyRow] = await this.db
      .insert(complianceFactHistory)
      .values({
        serviceOccurrenceId: existingFact.serviceOccurrenceId,
        status: existingFact.status,
        timing: existingFact.timing,
        factSnapshot: existingFact as unknown as Record<string, unknown>,
        actorKind,
        actorId,
      })
      .returning({ id: complianceFactHistory.id });
    return historyRow!.id;
  }

  /** Actualiza el vínculo al hecho sucesor en la fila de historial recién creada. */
  async updateHistorySuccessor(historyId: string, newFactId: string) {
    await this.db
      .update(complianceFactHistory)
      .set({ replacedByFactId: newFactId })
      .where(eq(complianceFactHistory.id, historyId));
  }

  /** Devuelve el historial de versiones de una ocurrencia en orden cronológico. */
  async getFactHistory(serviceOccurrenceId: string) {
    return this.db.query.complianceFactHistory.findMany({
      where: eq(complianceFactHistory.serviceOccurrenceId, serviceOccurrenceId),
      orderBy: (h, { asc }) => [asc(h.replacedAt)],
    });
  }

  /**
   * Las salidas de `pendiente_evidencia` en un periodo, con quién las causó.
   *
   * Solo lee. Una fila de `compliance_fact_history` guarda la foto del hecho
   * VIEJO junto con el actor de la verificación NUEVA que lo reemplaza — así
   * que una fila con `status = "pendiente_evidencia"` es exactamente eso: un
   * pendiente que dejó de serlo, firmado por quien lo causó.
   *
   * Devuelve las filas crudas en vez de un conteo porque separar "se resolvió
   * solo" de "alguien lo pidió" depende del mapa de actores, que vive en la
   * capa de pantalla. Un conteo único aquí obligaría a decidir esa semántica
   * en la base, donde no se puede leer.
   */
  async getSalidasDePendiente(
    serviceOccurrenceIds: string[],
    desde: Date,
  ): Promise<Array<{ serviceOccurrenceId: string; actorKind: string; replacedAt: Date }>> {
    if (serviceOccurrenceIds.length === 0) return [];
    return this.db
      .select({
        serviceOccurrenceId: complianceFactHistory.serviceOccurrenceId,
        actorKind: complianceFactHistory.actorKind,
        replacedAt: complianceFactHistory.replacedAt,
      })
      .from(complianceFactHistory)
      .where(
        and(
          inArray(complianceFactHistory.serviceOccurrenceId, serviceOccurrenceIds),
          eq(complianceFactHistory.status, "pendiente_evidencia"),
          gte(complianceFactHistory.replacedAt, desde),
        ),
      );
  }

  async addLedgerEntry(data: {
    tripId: string;
    serviceOccurrenceId: string;
    actorKind: string;
    actorId?: string | null;
    action: string;
    steps: import("@jtel/domain").LedgerStep[];
    metadata?: Record<string, unknown>;
  }) {
    const [entry] = await this.db.insert(ledgerEntries).values(data).returning();
    return entry!;
  }

  /**
   * Cuántas verificaciones automáticas se le han corrido a una ocurrencia.
   *
   * Se cuenta en la base y no trayendo las filas: uno de los servicios atorados
   * acumuló 31 424 entradas, y materializarlas para contarlas es justo el tipo
   * de lectura sin tope que dejó al motor sin memoria.
   *
   * Es cota INFERIOR de intentos fallidos, no la cifra exacta: quien la usa
   * solo la consulta cuando el estado ya es `pendiente_evidencia` con la
   * evidencia indisponible, y en ese caso cada entrada previa fue un intento
   * que tampoco encontró nada.
   */
  async countAutomaticVerifications(serviceOccurrenceId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.serviceOccurrenceId, serviceOccurrenceId),
          eq(ledgerEntries.action, "verificacion_automatica"),
        ),
      );
    return Number(row?.n ?? 0);
  }

  /**
   * Cuándo escribió el motor por última vez, sea lo que sea que haya escrito.
   *
   * Es el latido: el cron corre cada minuto, así que un silencio largo aquí
   * significa que el árbitro dejó de dictar. Hubo 810 interrupciones en 14 días
   * sin que nadie se enterara porque nada miraba esto.
   */
  async ultimoLatidoDelMotor(): Promise<Date | null> {
    const [row] = await this.db
      .select({ ultimo: sql<Date | null>`max(${ledgerEntries.createdAt})` })
      .from(ledgerEntries)
      .where(
        inArray(ledgerEntries.action, [
          "verificacion_automatica",
          "sin_evidencia_posible",
          "verificacion_fallida",
        ]),
      );
    return row?.ultimo ? new Date(row.ultimo) : null;
  }

  /** Verificaciones que reventaron y dejaron rastro. Cara J-Staff. */
  async listarFallosDeVerificacion(limite = 20) {
    return this.db
      .select({
        id: ledgerEntries.id,
        serviceOccurrenceId: ledgerEntries.serviceOccurrenceId,
        createdAt: ledgerEntries.createdAt,
        error: sql<string | null>`${ledgerEntries.steps}->0->'details'->>'error'`,
        tipo: sql<string | null>`${ledgerEntries.metadata}->>'tipo'`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.action, "verificacion_fallida"))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limite);
  }

  async getLedgerForTrip(tripId: string) {
    return this.db.query.ledgerEntries.findMany({
      where: eq(ledgerEntries.tripId, tripId),
      orderBy: (entries, { asc }) => [asc(entries.createdAt)],
    });
  }

  /**
   * Ledger de UNA ocurrencia, no de todo el viaje.
   *
   * `getLedgerForTrip` trae el historial completo del viaje; para leer la
   * medición de un servicio eso es traer de más —la tabla ronda las 120 mil
   * filas— y además obliga a filtrar por ocurrencia en memoria. Aquí se filtra
   * en la base, apoyado en `ledger_entries_occurrence_idx`.
   *
   * `sinceMaterializedAt` acota a las entradas que pueden pertenecer al hecho
   * vigente: el motor escribe el hecho antes que su entrada, así que nada
   * anterior al sello puede ser suyo. Quién es exactamente lo decide
   * `pairLedgerEntryWithFact`, que es puro y se prueba aparte.
   */
  async getLedgerForOccurrence(
    serviceOccurrenceId: string,
    opts: { sinceMaterializedAt?: Date } = {},
  ) {
    return this.db.query.ledgerEntries.findMany({
      where: opts.sinceMaterializedAt
        ? and(
            eq(ledgerEntries.serviceOccurrenceId, serviceOccurrenceId),
            gte(ledgerEntries.createdAt, opts.sinceMaterializedAt),
          )
        : eq(ledgerEntries.serviceOccurrenceId, serviceOccurrenceId),
      orderBy: (entries, { asc }) => [asc(entries.createdAt)],
    });
  }
}

export class EvidenceRepository {
  constructor(private db: Database) {}

  async savePoints(
    tripId: string,
    points: Array<{
      imei: string;
      latitude: number;
      longitude: number;
      speed?: number;
      recordedAt: Date;
      deviceId?: string;
      unitId?: string;
    }>,
  ) {
    if (points.length === 0) return [];
    // En lotes: una ventana de evidencia de un carrier entero pasa de 12 000
    // puntos, y eso en una sola sentencia excede el techo de parámetros de
    // Postgres y la rechaza completa. Ver `lote-de-escritura.ts`.
    return escribirEnLotes(
      points.map((p) => ({ tripId, ...p })),
      filasPorSentencia(evidencePoints),
      (lote) => this.db.insert(evidencePoints).values(lote).returning(),
    );
  }

  async getPointsForTrip(tripId: string) {
    return this.db.query.evidencePoints.findMany({
      where: eq(evidencePoints.tripId, tripId),
      orderBy: (points, { asc }) => [asc(points.recordedAt)],
    });
  }

  async clearPointsForTrip(tripId: string) {
    await this.db.delete(evidencePoints).where(eq(evidencePoints.tripId, tripId));
  }

  async updateTripStatus(
    tripId: string,
    status: "disponible" | "parcial" | "en_espera" | "indisponible" | "sin_evidencia_posible",
  ) {
    await this.db.update(trips).set({ evidenceStatus: status }).where(eq(trips.id, tripId));
  }

  /**
   * Cuenta un intento de verificación de este viaje y devuelve la cuenta.
   *
   * **Estado, no historia** (Marco 3.10e). Es lo que sustituyó a escribir una
   * entrada de ledger por intento — 4 163 318 de ellas sobre 1 008 servicios,
   * medidas el 19 de septiembre de 2026. El ledger existe para ser la
   * historia, y una historia no se reescribe cada minuto; una cuenta sí.
   *
   * Se hace en la base y no leyendo-sumando-escribiendo: con dos pasadas del
   * cron encimadas, leer y después escribir pierde intentos, y este contador
   * es justo el que decide cuándo el motor deja de insistir.
   *
   * `primer_intento_at` se pone una sola vez y no se vuelve a tocar: con
   * `ultimo_intento_at` es lo que conserva «se intentó N veces, de tal fecha a
   * tal fecha» sin un renglón por intento.
   */
  async registrarIntentoDeVerificacion(tripId: string): Promise<{
    intentos: number;
    primerIntentoAt: Date | null;
    ultimoIntentoAt: Date | null;
  }> {
    const ahora = new Date();
    const [fila] = await this.db
      .update(trips)
      .set({
        intentosDeVerificacion: sql`${trips.intentosDeVerificacion} + 1`,
        primerIntentoAt: sql`coalesce(${trips.primerIntentoAt}, ${ahora.toISOString()}::timestamptz)`,
        ultimoIntentoAt: ahora,
      })
      .where(eq(trips.id, tripId))
      .returning({
        intentos: trips.intentosDeVerificacion,
        primerIntentoAt: trips.primerIntentoAt,
        ultimoIntentoAt: trips.ultimoIntentoAt,
      });

    /*
     * Sin fila el viaje no existe, y eso no es un contador en cero: es que
     * alguien pidió verificar algo que no está. Se dice, en vez de devolver un
     * cero que el freno leería como «apenas va empezando» — el mismo tipo de
     * mentira cómoda que costó los 4.16 millones.
     */
    if (!fila) throw new Error(`No existe el viaje ${tripId}: no se pudo contar el intento.`);
    return fila;
  }
}

export class MembershipRepository {
  constructor(private db: Database) {}

  async create(data: {
    accountId: string;
    clerkUserId: string;
    role: string;
    scopeType: "global" | "account" | "plant" | "plant_group" | "contract" | "fleet";
    scopeId?: string;
  }) {
    const [membership] = await this.db.insert(userMemberships).values(data).returning();
    return membership!;
  }

  async findForUser(clerkUserId: string) {
    return this.db.query.userMemberships.findMany({
      where: eq(userMemberships.clerkUserId, clerkUserId),
    });
  }

  /**
   * Copia las membresías de una identidad hacia otra — Paso 2 de auth-rbac.
   *
   * **Solo inserta.** No actualiza ni borra nada del origen: la cadena del seed
   * conserva sus filas porque es lo que sostiene el bypass de desarrollo
   * (`JTEL_DEV_USER`). Reemplazarlas dejaría al producto sin ninguna forma de
   * entrar, y en silencio — las pantallas abrirían vacías, no con un error.
   *
   * Idempotente: el plan sale de `planDeVinculacion`, que deduplica a mano
   * porque el índice único no puede hacerlo cuando `scope_id` es nulo.
   */
  async vincular(desde: string, hacia: string) {
    const [origen, destino] = await Promise.all([
      this.findForUser(desde),
      this.findForUser(hacia),
    ]);

    const plan = planDeVinculacion(origen, destino);
    if (plan.length === 0) return { insertadas: [], yaExistian: origen.length };

    const insertadas = await this.db
      .insert(userMemberships)
      .values(
        plan.map((f) => ({
          accountId: f.accountId,
          clerkUserId: hacia,
          role: f.role,
          scopeType: f.scopeType,
          scopeId: f.scopeId ?? undefined,
        })),
      )
      .returning();

    return { insertadas, yaExistian: origen.length - plan.length };
  }
}

export class InspectionRepository {
  constructor(private db: Database) {}

  async create(data: {
    contractId: string;
    plantId: string;
    carrierAccountId: string;
    notes?: string;
  }) {
    const [inspection] = await this.db.insert(inspections).values(data).returning();
    return inspection!;
  }

  async findForPlant(plantId: string) {
    return this.db.query.inspections.findMany({
      where: eq(inspections.plantId, plantId),
    });
  }
}

export class NotificationRepository {
  constructor(private db: Database) {}

  async create(data: {
    accountId: string;
    type: "tarde" | "sin_evidencia" | "reporte_listo" | "requiere_revision" | "inspeccion";
    title: string;
    body: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const [notification] = await this.db.insert(notifications).values(data).returning();
    return notification!;
  }

  async findForAccount(accountId: string) {
    return this.db.query.notifications.findMany({
      where: eq(notifications.accountId, accountId),
    });
  }

  /**
   * Notificaciones de una cuenta dentro de una ventana, las más recientes
   * primero y con tope.
   *
   * `findForAccount` las trae TODAS. Cuando el motor llevaba meses generando
   * un aviso por reintento, eso eran 159 815 filas materializadas en memoria
   * para pintar una lista de veintitantas: la página murió por falta de
   * memoria el 2 de agosto de 2026.
   *
   * La ventana se acota en la base y el filtro fino por día civil se sigue
   * haciendo arriba —la zona horaria del cliente decide qué día es cada fila—,
   * así que aquí se pide un poco de más a propósito: los bordes de ±1 día
   * cubren cualquier huso sin cambiar qué se muestra.
   *
   * Devuelve también `hayMas`, y no es un adorno: quien pinta el total tiene
   * que poder decir si está contando todo o solo lo que cupo. Un número
   * correcto bajo un rótulo que promete el total es un número que miente.
   */
  async findForAccountInWindow(
    accountId: string,
    desde: Date,
    hasta: Date,
    limite: number,
  ): Promise<{ filas: Array<typeof notifications.$inferSelect>; hayMas: boolean }> {
    const filas = await this.db.query.notifications.findMany({
      where: and(
        eq(notifications.accountId, accountId),
        gte(notifications.createdAt, desde),
        lte(notifications.createdAt, hasta),
      ),
      orderBy: (n, { desc: d }) => [d(n.createdAt)],
      // Uno de más: si vuelve, es que había más de los que caben.
      limit: limite + 1,
    });
    return { filas: filas.slice(0, limite), hayMas: filas.length > limite };
  }
}

export class DemoRepository {
  constructor(private db: Database) {}

  async createTemplate(name: string, config: Record<string, unknown>) {
    const [template] = await this.db
      .insert(demoTemplates)
      .values({ name, config })
      .returning();
    return template!;
  }

  async getTemplates() {
    return this.db.query.demoTemplates.findMany();
  }
}

export class TelemetryRepository {
  constructor(private db: Database) {}

  /**
   * Guarda puntos crudos de telemetría deduplicando por (imei, recordedAt).
   * Devuelve las filas efectivamente insertadas (las repetidas se ignoran).
   */
  async savePoints(
    points: Array<{
      carrierAccountId: string;
      imei: string;
      latitude: number;
      longitude: number;
      speed?: number;
      recordedAt: Date;
      deviceId?: string | null;
      unitId?: string | null;
      source?: string;
    }>,
  ) {
    if (points.length === 0) return [];
    // En lotes por la misma razón que `evidence.savePoints`: el archivador y el
    // relleno de huecos traen tandas grandes, y una sentencia que excede el
    // techo de parámetros de Postgres no se recorta — se rechaza entera.
    return escribirEnLotes(
      points.map((p) => ({
        carrierAccountId: p.carrierAccountId,
        imei: p.imei,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed,
        recordedAt: p.recordedAt,
        deviceId: p.deviceId ?? undefined,
        unitId: p.unitId ?? undefined,
        source: p.source ?? "umbrella",
      })),
      filasPorSentencia(telemetryPoints),
      (lote) => this.db.insert(telemetryPoints).values(lote).onConflictDoNothing().returning(),
    );
  }

  async getWatermark(carrierAccountId: string) {
    return this.db.query.telemetryWatermarks.findFirst({
      where: eq(telemetryWatermarks.carrierAccountId, carrierAccountId),
    });
  }

  async setWatermark(carrierAccountId: string, lastRecordedAt: Date) {
    await this.db
      .insert(telemetryWatermarks)
      .values({ carrierAccountId, lastRecordedAt })
      .onConflictDoUpdate({
        target: telemetryWatermarks.carrierAccountId,
        set: { lastRecordedAt, updatedAt: new Date() },
      });
  }

  /**
   * Hasta dónde ya se leyó cada aparato de la cuenta, por IMEI (0037).
   * Un aparato que no aparece no se ha leído nunca con la marca por aparato.
   */
  async getArchiveMarks(carrierAccountId: string): Promise<Map<string, Date>> {
    const filas = await this.db
      .select({ imei: telemetryArchiveMarks.imei, readUntil: telemetryArchiveMarks.readUntil })
      .from(telemetryArchiveMarks)
      .where(eq(telemetryArchiveMarks.carrierAccountId, carrierAccountId));
    return new Map(filas.map((f) => [f.imei, f.readUntil]));
  }

  /**
   * Anota que el aparato ya se leyó hasta `readUntil`. **Sólo avanza**: si ya
   * había una marca posterior, se queda la posterior. Dos corridas del cron
   * empalmadas pueden terminar en cualquier orden, y la lenta no debe
   * regresar la marca de la rápida.
   */
  async setArchiveMark(carrierAccountId: string, imei: string, readUntil: Date) {
    await this.db
      .insert(telemetryArchiveMarks)
      .values({ carrierAccountId, imei, readUntil })
      .onConflictDoUpdate({
        target: [telemetryArchiveMarks.carrierAccountId, telemetryArchiveMarks.imei],
        set: {
          readUntil: sql`greatest(${telemetryArchiveMarks.readUntil}, excluded.read_until)`,
          updatedAt: new Date(),
        },
      });
  }

  async countForCarrier(carrierAccountId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrierAccountId));
    return row?.count ?? 0;
  }

  async getForImei(imei: string, from?: Date, to?: Date) {
    const conditions = [eq(telemetryPoints.imei, imei)];
    if (from) conditions.push(gte(telemetryPoints.recordedAt, from));
    if (to) conditions.push(lte(telemetryPoints.recordedAt, to));
    return this.db.query.telemetryPoints.findMany({
      where: and(...conditions),
      orderBy: (p, { asc }) => [asc(p.recordedAt)],
    });
  }

  /**
   * El punto de telemetría propia MÁS ANTIGUO que existe para un carrier, o
   * `null` si todavía no hay ninguno.
   *
   * Es el horizonte de la memoria: una ventana de evidencia que termina antes
   * de esta fecha no puede ser cubierta por ningún punto guardado, ni hoy ni
   * después. Sirve para dejar de reintentar servicios irresolubles.
   *
   * Va por el índice (carrier_account_id, recorded_at), así que es una lectura
   * del extremo del índice y no un recorrido de la tabla.
   */
  /**
   * La llave de la corrida del motor. Devuelve `false` si otra ya la tiene.
   *
   * **Por qué existe.** Vercel dispara el cron sin preguntar si la pasada
   * anterior terminó, y `processPending` no tomaba ninguna llave. Medido el 19
   * de septiembre de 2026: el **41 %** de los sellos consecutivos de una misma
   * ocurrencia caían a menos de 45 s —con mínimo de 0 s— y en seis horas no
   * hubo un solo hueco de 20 s. Dos pasadas trabajando el mismo servicio a la
   * vez es lo que reventaba `saveFact` 13 702 veces.
   *
   * Bajar la cadencia a 5 minutos hace el choque **improbable**; esto lo hace
   * **imposible**. Son dos cosas distintas y hacen falta las dos: una cola que
   * crezca —el arranque del 28, ocho unidades— vuelve a estirar la pasada.
   *
   * **Por qué un candado de Postgres y no una tabla.** Un candado consultivo
   * de sesión no necesita limpieza: si el proceso muere, se cae la conexión y
   * el candado se suelta solo. Una tabla de «corrida en curso» habría que
   * limpiarla a mano después de cada muerte por falta de memoria — y este
   * motor ya murió así, cinco semanas sin que nadie se enterara.
   *
   * **`try` y no `wait`.** Si otra pasada va corriendo, ésta no hace cola: se
   * va. La siguiente sale en cinco minutos y la cola no se mueve mientras
   * tanto. Esperar sólo apilaría pasadas contra el reloj del cron.
   *
   * ⚠ Quien la toma **tiene que soltarla** (`soltarLlaveDelMotor`), en un
   * `finally`. Vive en la SESIÓN, no en la transacción.
   */
  async tomarLlaveDelMotor(): Promise<boolean> {
    // El número es arbitrario y constante: identifica a esta llave y a ninguna
    // otra. Cambiarlo dejaría correr dos motores a la vez sin avisar.
    const [fila] = await this.db.execute<{ tomada: boolean }>(
      sql`SELECT pg_try_advisory_lock(8_140_919) AS tomada`,
    );
    return fila?.tomada === true;
  }

  /** Suelta la llave de la corrida. Siempre en un `finally`. */
  async soltarLlaveDelMotor(): Promise<void> {
    await this.db.execute(sql`SELECT pg_advisory_unlock(8_140_919)`);
  }

  async getMemoryHorizon(carrierAccountId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ primero: sql<Date | null>`min(${telemetryPoints.recordedAt})` })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrierAccountId));
    return row?.primero ? new Date(row.primero) : null;
  }

  /**
   * Puntos de UNA cuenta para un conjunto de IMEIs en una ventana — **la única
   * forma de leer `telemetry_points` por IMEI**.
   *
   * **El IMEI no es el muro; la cuenta sí** (Pieza 1.C). Un dispositivo que
   * cambió de cuenta (6.14) conserva su IMEI, y sus puntos de antes del cambio
   * se quedaron archivados en la cuenta anterior. Leer sólo por IMEI le dibuja
   * a la cuenta nueva los recorridos de la anterior — y en el motor, sella un
   * hecho falso pero creíble con el recorrido de otro transportista.
   *
   * Hasta el 18 de septiembre de 2026 existía a su lado una gemela sin cuenta.
   * Las pantallas la dejaron en el #435, el motor en el #441, y ahí se borró:
   * mientras la puerta siga en la pared alguien la vuelve a abrir sin querer, y
   * no rompe nada al hacerlo. Por eso la cuenta es obligatoria —parámetro, no
   * filtro que quien llama se acuerde de poner— y por eso ya no hay una
   * variante que lo permita.
   *
   * Lo vigila `packages/services/src/guardia-muro-cuenta.test.ts`, que además
   * de exigir el muro en el camino del veredicto pone en rojo cualquier
   * lectura sin cuenta que se reintroduzca en el repositorio o en cualquier
   * paquete.
   */
  async getForImeisDeCuenta(carrierAccountId: string, imeis: string[], from: Date, to: Date) {
    if (imeis.length === 0) return [];
    return this.db.query.telemetryPoints.findMany({
      where: and(
        eq(telemetryPoints.carrierAccountId, carrierAccountId),
        inArray(telemetryPoints.imei, imeis),
        gte(telemetryPoints.recordedAt, from),
        lte(telemetryPoints.recordedAt, to),
      ),
      orderBy: (p, { asc }) => [asc(p.recordedAt)],
    });
  }

  async listWatermarks() {
    return this.db.query.telemetryWatermarks.findMany({
      where: deCuentaReal(telemetryWatermarks.carrierAccountId),
      orderBy: (w, { asc }) => [asc(w.lastRecordedAt)],
    });
  }

  async getImeiWatermark(carrierAccountId: string, imei: string) {
    return this.db.query.telemetryImeiWatermarks.findFirst({
      where: and(
        eq(telemetryImeiWatermarks.carrierAccountId, carrierAccountId),
        eq(telemetryImeiWatermarks.imei, imei),
      ),
    });
  }

  async setImeiWatermark(carrierAccountId: string, imei: string, lastRecordedAt: Date) {
    await this.db
      .insert(telemetryImeiWatermarks)
      .values({ carrierAccountId, imei, lastRecordedAt })
      .onConflictDoUpdate({
        target: [
          telemetryImeiWatermarks.carrierAccountId,
          telemetryImeiWatermarks.imei,
        ],
        set: { lastRecordedAt, updatedAt: new Date() },
      });
  }

  /**
   * Detecta huecos > maxGapMinutes en la memoria propia de un IMEI.
   * Devuelve ventanas [gapStart, gapEnd] a rellenar.
   */
  async findGapsForImei(
    imei: string,
    from: Date,
    to: Date,
    maxGapMinutes: number,
  ): Promise<Array<{ from: Date; to: Date; gapMinutes: number }>> {
    const points = await this.getForImei(imei, from, to);
    const maxGapMs = Math.max(1, maxGapMinutes) * 60_000;
    const anchors: number[] = [from.getTime()];
    for (const p of points) anchors.push(p.recordedAt.getTime());
    anchors.push(to.getTime());
    anchors.sort((a, b) => a - b);

    const gaps: Array<{ from: Date; to: Date; gapMinutes: number }> = [];
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1]!;
      const b = anchors[i]!;
      const gap = b - a;
      if (gap > maxGapMs) {
        gaps.push({
          from: new Date(a),
          to: new Date(b),
          gapMinutes: gap / 60_000,
        });
      }
    }
    return gaps;
  }

  /** Edad del punto más reciente por carrier (minutos). */
  async latestPointAgeMinutes(carrierAccountId: string): Promise<number | null> {
    const [row] = await this.db
      .select({
        latest: sql<Date | null>`max(${telemetryPoints.recordedAt})`,
      })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrierAccountId));
    if (!row?.latest) return null;
    const latest = row.latest instanceof Date ? row.latest : new Date(row.latest);
    return Math.max(0, (Date.now() - latest.getTime()) / 60_000);
  }

  async countPointsSince(carrierAccountId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          gte(telemetryPoints.recordedAt, since),
        ),
      );
    return row?.count ?? 0;
  }

  /**
   * Puntos de un carrier en una ventana, para observar su propia flota.
   *
   * Nativo al índice `telemetry_points_carrier_recorded_idx`: medido el
   * 2026-07-28, 16 487 filas de una ventana de 6 h en 22 ms. Solo las columnas
   * que la pantalla dibuja — traer las demás multiplica el payload sin usarlas.
   *
   * El filtro es por `carrierAccountId`, que es columna de la propia fila y no
   * un join: no existe camino por el que se cuele el dato de otro carrier.
   *
   * Se lee `unitId` tal como quedó estampado al ingerir, sin volver a resolver
   * la asignación vigente. Un GPS que cambió de camión no reescribe el pasado.
   */
  async getForCarrierWindow(carrierAccountId: string, from: Date, to: Date) {
    return this.db
      .select({
        unitId: telemetryPoints.unitId,
        imei: telemetryPoints.imei,
        latitude: telemetryPoints.latitude,
        longitude: telemetryPoints.longitude,
        recordedAt: telemetryPoints.recordedAt,
      })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          gte(telemetryPoints.recordedAt, from),
          lte(telemetryPoints.recordedAt, to),
        ),
      );
  }

  /**
   * Puntos de UNAS unidades en una ventana — la traza del Workbench.
   *
   * Distinta de `getForCarrierWindow` en tres cosas, y las tres importan:
   *
   * 1. **Filtra por unidad.** Nativo al índice `(unit_id, recorded_at)` de la
   *    migración 0014: pedir un día de una unidad leía 58 464 filas sin él y
   *    lee las suyas con él.
   * 2. **Trae `speed`.** Sin velocidad no hay forma de derivar dónde estuvo
   *    quieta una unidad, y las paradas son capa del mapa.
   * 3. **Viene ordenada por unidad y tiempo.** Las medidas del Workbench
   *    —huecos, paradas, kilómetros— son todas sobre puntos consecutivos, y
   *    ordenar 124 396 puntos en el proceso web es trabajo que la base ya hace
   *    con el índice.
   *
   * El filtro por `carrierAccountId` se conserva aunque las unidades ya lo
   * impliquen: es la fila la que declara de quién es, y no depende de que quien
   * llame haya resuelto bien la lista de unidades.
   */
  async getForUnitsWindow(
    carrierAccountId: string,
    unitIds: string[],
    from: Date,
    to: Date,
  ) {
    if (unitIds.length === 0) return [];
    return this.db
      .select({
        unitId: telemetryPoints.unitId,
        imei: telemetryPoints.imei,
        latitude: telemetryPoints.latitude,
        longitude: telemetryPoints.longitude,
        speed: telemetryPoints.speed,
        recordedAt: telemetryPoints.recordedAt,
      })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          inArray(telemetryPoints.unitId, unitIds),
          gte(telemetryPoints.recordedAt, from),
          lte(telemetryPoints.recordedAt, to),
        ),
      )
      .orderBy(telemetryPoints.unitId, telemetryPoints.recordedAt);
  }

  /**
   * Cuántos puntos reportó cada unidad en la ventana.
   *
   * Es lo que llena el campo "Quién" del Workbench: elegir a ciegas entre
   * ochenta y dos unidades no es elegir. Con esto, la lista dice cuáles
   * reportaron algo en el rango que se está mirando y cuáles no — y la
   * diferencia es la misma que enseñó el censo: una unidad muda no es una
   * unidad quieta.
   *
   * Agrega en la base a propósito. Traer los puntos para contarlos serían
   * cientos de miles de filas cruzando la red para producir un número por
   * unidad.
   */
  /**
   * Huecos de señal de UNA unidad, agregados por mes civil.
   *
   * Es el motor de la sección más valiosa del expediente de unidad. Se agrega
   * **en la base y no en el proceso web** por una razón de tamaño: dos meses de
   * una unidad son del orden de cincuenta mil filas, y todas viajarían por la
   * red para producir cinco renglones.
   *
   * El umbral entra como parámetro y no horneado aquí: es el mismo
   * `SIN_SENAL_MINUTOS` que usa el resto del producto, y dos definiciones de
   * "hueco" en dos pantallas destruyen la credibilidad de las dos.
   *
   * El mes se corta en el reloj de la operación, no en UTC. Un turno que
   * termina a la 1 de la mañana del día 1 pertenece al mes anterior en la
   * cabeza de quien opera, y a este en UTC.
   */
  async huecosPorMesDeUnidad(
    carrierAccountId: string,
    unitId: string,
    desde: Date,
    opts: { timeZone: string; umbralMinutos: number },
  ): Promise<
    Array<{
      mes: string;
      puntos: number;
      huecos: number;
      minutosSinVer: number;
      primero: Date;
      ultimo: Date;
    }>
  > {
    const filas = await this.db.execute<{
      mes: string;
      puntos: string | number;
      huecos: string | number;
      minutos_sin_ver: string | number;
      primero: Date | string;
      ultimo: Date | string;
    }>(sql`
      WITH d AS (
        SELECT
          recorded_at,
          lag(recorded_at) OVER (ORDER BY recorded_at) AS previo
        FROM telemetry_points
        WHERE carrier_account_id = ${carrierAccountId}
          AND unit_id = ${unitId}
          -- El controlador HTTP no sabe enlazar un Date en SQL crudo: viaja
          -- como ISO y se castea aquí. Un timestamptz enlazado mal no falla
          -- devolviendo de más, falla no devolviendo nada.
          AND recorded_at >= ${desde.toISOString()}::timestamptz
      )
      SELECT
        to_char(recorded_at AT TIME ZONE ${opts.timeZone}, 'YYYY-MM') AS mes,
        count(*)::int AS puntos,
        count(*) FILTER (
          WHERE previo IS NOT NULL
            AND recorded_at - previo > make_interval(mins => ${opts.umbralMinutos}::int)
        )::int AS huecos,
        coalesce(sum(
          CASE
            WHEN previo IS NOT NULL
              AND recorded_at - previo > make_interval(mins => ${opts.umbralMinutos}::int)
            THEN extract(epoch FROM (recorded_at - previo)) / 60
            ELSE 0
          END
        ), 0)::int AS minutos_sin_ver,
        min(recorded_at) AS primero,
        max(recorded_at) AS ultimo
      FROM d
      GROUP BY 1
      ORDER BY 1
    `);

    return [...filas].map((f) => ({
      mes: f.mes,
      puntos: Number(f.puntos),
      huecos: Number(f.huecos),
      minutosSinVer: Number(f.minutos_sin_ver),
      primero: f.primero instanceof Date ? f.primero : new Date(f.primero),
      ultimo: f.ultimo instanceof Date ? f.ultimo : new Date(f.ultimo),
    }));
  }

  /**
   * El punto más viejo del carrier: hasta dónde llega el archivo.
   *
   * Sin esto, un expediente de unidad enseñaría "dos meses" y quien lo lea
   * supondría que antes no hubo huecos. No hubo ARCHIVO — que es otra cosa, y
   * es la misma distinción que hace la marca de agua en el censo.
   */
  async primerPuntoDeCarrier(carrierAccountId: string): Promise<Date | null> {
    const [fila] = await this.db
      .select({ primero: telemetryPoints.recordedAt })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrierAccountId))
      .orderBy(telemetryPoints.recordedAt)
      .limit(1);
    return fila?.primero ?? null;
  }

  async countPointsPerUnit(
    carrierAccountId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, number>> {
    const filas = await this.db
      .select({ unitId: telemetryPoints.unitId, total: count() })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          gte(telemetryPoints.recordedAt, from),
          lte(telemetryPoints.recordedAt, to),
        ),
      )
      .groupBy(telemetryPoints.unitId);
    const salida = new Map<string, number>();
    for (const f of filas) if (f.unitId) salida.set(f.unitId, f.total);
    return salida;
  }

  /**
   * Último punto conocido por unidad, en toda la historia del carrier.
   *
   * Es lo que separa "dejó de reportar el 25 de julio" de "nunca ha reportado
   * un solo punto". Sin esta consulta las dos se ven idénticas, y son
   * problemas distintos con dueños distintos.
   *
   * CARA A PROPÓSITO. No hay índice por `unit_id`, así que barre las filas del
   * carrier: medido el 2026-07-28, **462 ms sobre 2 276 884 filas**. Se aceptó
   * el costo porque acotarla mentiría — con un horizonte de 7 días, 2 de las 9
   * unidades que sí tienen historia aparecerían como "nunca reportó", que es
   * justamente la confusión que esta pantalla existe para deshacer.
   *
   * Crece ~51 000 filas por día. Cuando deje de ser tolerable, la salida es un
   * índice `(carrier_account_id, unit_id, recorded_at DESC)`, no recortar la
   * ventana. Quien la llame debe saltársela si no hay unidades mudas.
   */
  /**
   * El último punto archivado de cada IMEI, sin importar a qué cuenta o unidad
   * se archivó.
   *
   * Es la mitad de «la última señal» de un dispositivo (la otra es su posición
   * viva): sin esto, un dispositivo con historia archivada y sin fila en
   * `live_positions` saldría «nunca reportó».
   *
   * La forma de la consulta es la que la hace barata; ver
   * `consultaUltimoPuntoPorImei`.
   */
  async ultimoPuntoPorImei(imeis: string[]): Promise<Map<string, Date>> {
    const porImei = new Map<string, Date>();
    if (imeis.length === 0) return porImei;
    const filas = await this.db.execute<{ imei: string; ultimo: Date | string }>(
      consultaUltimoPuntoPorImei(imeis),
    );
    for (const r of filas) {
      porImei.set(r.imei, r.ultimo instanceof Date ? r.ultimo : new Date(r.ultimo));
    }
    return porImei;
  }

  async getLastPointPerUnit(carrierAccountId: string): Promise<Map<string, Date>> {
    const rows = await this.db
      .select({
        unitId: telemetryPoints.unitId,
        ultimo: sql<Date>`max(${telemetryPoints.recordedAt})`,
      })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          sql`${telemetryPoints.unitId} is not null`,
        ),
      )
      .groupBy(telemetryPoints.unitId);

    const porUnidad = new Map<string, Date>();
    for (const r of rows) {
      if (!r.unitId || !r.ultimo) continue;
      porUnidad.set(r.unitId, r.ultimo instanceof Date ? r.ultimo : new Date(r.ultimo));
    }
    return porUnidad;
  }

  /**
   * Los puntos de UNA unidad en una ventana.
   *
   * Existe porque filtrar la unidad en memoria significa traer la ventana
   * entera del carrier: medido en producción, 58 464 filas para devolver 744.
   * Con la igualdad en `unit_id` la consulta entra por el índice
   * `(carrier_account_id, unit_id, recorded_at)` y lee solo lo suyo — 8.3 ms
   * de ejecución bajan a 0.4 ms, y 1922 buffers a 117.
   */
  async getForUnitWindow(
    carrierAccountId: string,
    unitId: string,
    from: Date,
    to: Date,
  ) {
    // El caso de una unidad es el de varias con la lista de uno. Se delega en
    // vez de repetir la consulta: dos lecturas casi iguales del mismo índice
    // son dos lugares donde arreglar el siguiente problema de rendimiento, y
    // uno de los dos se queda sin arreglar.
    return this.getForUnitsWindow(carrierAccountId, [unitId], from, to);
  }

  /**
   * El día ya resumido, una fila por unidad y por ventana.
   *
   * Contra pedir los puntos crudos: 58 464 filas y ~3.5 s de reloj se vuelven
   * 52 filas y menos de 200 ms. La base **encontraba** esas filas en 14 ms; el
   * tiempo se iba transportándolas y materializándolas en JavaScript, así que
   * el arreglo no era un índice sino dejar de traerlas.
   *
   * El `LATERAL` por unidad no es adorno: le da al planificador la igualdad en
   * `unit_id` que hace usable el índice por unidad. La versión con `GROUP BY`
   * plano elige el índice por fecha y termina ordenando 3.8 MB **en disco**.
   *
   * Las ventanas llegan ya calculadas. Aquí no se hace aritmética de fecha
   * civil ni de zona horaria: esa cuenta ya vive resuelta y probada en un solo
   * lugar, y una segunda versión en SQL es exactamente el bug que corrió 294
   * hechos a la hora equivocada.
   */
  async resumenDiarioPorUnidad(
    carrierAccountId: string,
    ventanas: Array<{ fecha: string; desde: Date; hasta: Date }>,
    reglas?: { huecoMinutos?: number; saltoKmh?: number },
  ): Promise<ResumenUnidadDia[]> {
    if (ventanas.length === 0) return [];
    const huecoMinutos = Math.max(0, reglas?.huecoMinutos ?? HUECO_MINUTOS_POR_DEFECTO);
    const saltoKmh = Math.max(1, reglas?.saltoKmh ?? SALTO_KMH_POR_DEFECTO);

    const porVentana = await Promise.all(
      ventanas.map(async (ventana) => {
        const filas = await this.db.execute<{
          unit_id: string;
          bloque: number;
          desde: Date;
          hasta: Date;
          puntos: number;
          km: number;
          saltos: number;
          equipos: number;
        }>(sql`
          SELECT b.unit_id,
                 b.bloque,
                 min(b.recorded_at) AS desde,
                 max(b.recorded_at) AS hasta,
                 count(*)::int      AS puntos,
                 COALESCE(sum(b.km_prev) FILTER (
                   WHERE b.min_prev IS NOT NULL
                     AND b.min_prev <= ${huecoMinutos}
                     AND b.min_prev > 0
                     AND b.km_prev / (b.min_prev / 60) <= ${saltoKmh}
                 ), 0)::double precision AS km,
                 count(*) FILTER (
                   WHERE b.min_prev IS NOT NULL
                     AND b.min_prev <= ${huecoMinutos}
                     AND b.min_prev > 0
                     AND b.km_prev / (b.min_prev / 60) > ${saltoKmh}
                 )::int AS saltos,
                 count(DISTINCT b.imei)::int AS equipos
            FROM (
              SELECT t.*,
                     sum(CASE WHEN t.min_prev IS NULL OR t.min_prev > ${huecoMinutos}
                              THEN 1 ELSE 0 END)
                       OVER (PARTITION BY t.unit_id ORDER BY t.recorded_at) AS bloque
                FROM (
                  SELECT p.unit_id, p.imei, p.recorded_at,
                         EXTRACT(EPOCH FROM p.recorded_at - p.prev_at) / 60 AS min_prev,
                         2 * 6371 * asin(sqrt(
                           power(sin(radians(p.latitude - p.prev_lat) / 2), 2) +
                           cos(radians(p.prev_lat)) * cos(radians(p.latitude)) *
                           power(sin(radians(p.longitude - p.prev_lng) / 2), 2)
                         )) AS km_prev
                    FROM units u
                    CROSS JOIN LATERAL (
                      SELECT tp.unit_id, tp.imei, tp.recorded_at, tp.latitude, tp.longitude,
                             lag(tp.recorded_at) OVER w AS prev_at,
                             lag(tp.latitude)    OVER w AS prev_lat,
                             lag(tp.longitude)   OVER w AS prev_lng
                        FROM telemetry_points tp
                       WHERE tp.carrier_account_id = ${carrierAccountId}
                         AND tp.unit_id = u.id
                         AND tp.recorded_at >= ${ventana.desde.toISOString()}::timestamptz
                         AND tp.recorded_at <= ${ventana.hasta.toISOString()}::timestamptz
                      WINDOW w AS (ORDER BY tp.recorded_at)
                    ) p
                   WHERE u.carrier_account_id = ${carrierAccountId}
                ) t
            ) b
           GROUP BY b.unit_id, b.bloque
           ORDER BY b.unit_id, desde
        `);

        const porUnidad = new Map<
          string,
          { equipos: number; bloques: BloqueObservado[] }
        >();
        for (const f of filas as unknown as Array<Record<string, unknown>>) {
          const unitId = String(f.unit_id);
          const acc = porUnidad.get(unitId) ?? { equipos: 0, bloques: [] };
          acc.bloques.push({
            desde: new Date(f.desde as string),
            hasta: new Date(f.hasta as string),
            puntos: Number(f.puntos),
            kmAproximados: Number(f.km),
            saltosDescartados: Number(f.saltos),
          });
          // Un equipo puede reportar en varios bloques del mismo día; el conteo
          // por bloque no se suma, se toma el mayor como piso del día.
          acc.equipos = Math.max(acc.equipos, Number(f.equipos));
          porUnidad.set(unitId, acc);
        }

        return [...porUnidad].map(([unitId, { equipos, bloques }]) =>
          resumirUnidadDia({
            unitId,
            fecha: ventana.fecha,
            desde: ventana.desde,
            hasta: ventana.hasta,
            equipos,
            bloques,
          }),
        );
      }),
    );

    return porVentana.flat();
  }
}

export class GroundTruthRepository {
  constructor(private db: Database) {}

  async upsert(data: {
    contractId: string;
    serviceDate: string;
    expectedAllCumplido?: boolean;
    declaredCumplidoCount?: number | null;
    notes?: string | null;
    recordedBy?: string | null;
  }) {
    const [row] = await this.db
      .insert(groundTruthDays)
      .values({
        contractId: data.contractId,
        serviceDate: data.serviceDate,
        expectedAllCumplido: data.expectedAllCumplido ?? true,
        declaredCumplidoCount: data.declaredCumplidoCount ?? null,
        notes: data.notes ?? null,
        recordedBy: data.recordedBy ?? null,
      })
      .onConflictDoUpdate({
        target: [groundTruthDays.contractId, groundTruthDays.serviceDate],
        set: {
          expectedAllCumplido: data.expectedAllCumplido ?? true,
          declaredCumplidoCount: data.declaredCumplidoCount ?? null,
          notes: data.notes ?? null,
          recordedBy: data.recordedBy ?? null,
        },
      })
      .returning();
    return row;
  }

  async listRecent(limit = 30) {
    return this.db.query.groundTruthDays.findMany({
      orderBy: (g, { desc }) => [desc(g.serviceDate), desc(g.createdAt)],
      limit,
    });
  }

  async findForContractDate(contractId: string, serviceDate: string) {
    return this.db.query.groundTruthDays.findFirst({
      where: and(
        eq(groundTruthDays.contractId, contractId),
        eq(groundTruthDays.serviceDate, serviceDate),
      ),
    });
  }
}

export class OccurrenceGroundTruthRepository {
  constructor(private db: Database) {}

  async upsert(data: {
    occurrenceId: string;
    operatorVerdict: "cumplido" | "no_hecho";
    operatorUnitId?: string | null;
    primaryCause?: string | null;
    notes?: string | null;
    recordedBy?: string | null;
  }) {
    const [row] = await this.db
      .insert(occurrenceGroundTruth)
      .values({
        occurrenceId: data.occurrenceId,
        operatorVerdict: data.operatorVerdict,
        operatorUnitId: data.operatorUnitId ?? null,
        primaryCause: data.primaryCause ?? null,
        notes: data.notes ?? null,
        recordedBy: data.recordedBy ?? null,
        recordedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [occurrenceGroundTruth.occurrenceId],
        set: {
          operatorVerdict: data.operatorVerdict,
          operatorUnitId: data.operatorUnitId ?? null,
          primaryCause: data.primaryCause ?? null,
          notes: data.notes ?? null,
          recordedBy: data.recordedBy ?? null,
          recordedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async findByOccurrence(occurrenceId: string) {
    return this.db.query.occurrenceGroundTruth.findFirst({
      where: eq(occurrenceGroundTruth.occurrenceId, occurrenceId),
    });
  }

  async listForDates(occurrenceIds: string[]) {
    if (occurrenceIds.length === 0) return [];
    return this.db.query.occurrenceGroundTruth.findMany({
      where: inArray(occurrenceGroundTruth.occurrenceId, occurrenceIds),
    });
  }
}

/**
 * Mediciones de cuánto duró de verdad cada recorrido de una ruta×turno.
 *
 * No juzga nada: es el instrumento del que sale el ancho de la ventana de
 * observación de las ocurrencias futuras.
 */
export class RouteTraversalRepository {
  constructor(private db: Database) {}

  /** Una medición por ocurrencia: re-verificar reemplaza, no acumula. */
  async record(data: {
    routeShiftId: string;
    serviceOccurrenceId: string;
    serviceDate: string;
    kmlVersionId?: string | null;
    durationMinutes: number;
    lowerBound?: boolean;
    pointsInCorridor?: number;
    unitId?: string | null;
  }) {
    const values = {
      routeShiftId: data.routeShiftId,
      serviceOccurrenceId: data.serviceOccurrenceId,
      serviceDate: data.serviceDate,
      kmlVersionId: data.kmlVersionId ?? null,
      durationMinutes: data.durationMinutes,
      lowerBound: data.lowerBound ?? false,
      pointsInCorridor: data.pointsInCorridor ?? 0,
      unitId: data.unitId ?? null,
      measuredAt: new Date(),
    };
    const [row] = await this.db
      .insert(routeTraversalMeasurements)
      .values(values)
      .onConflictDoUpdate({
        target: [routeTraversalMeasurements.serviceOccurrenceId],
        set: values,
      })
      .returning();
    return row;
  }

  /**
   * Las mediciones más recientes de una ruta×turno, en el formato que
   * `summarizeRouteDuration` espera. Ventana móvil: la operación de hace medio
   * año no debe dimensionar la ventana de mañana.
   */
  async recentSamples(
    routeShiftId: string,
    opts: { limit?: number } = {},
  ): Promise<RouteDurationSample[]> {
    const rows = await this.db
      .select({
        durationMinutes: routeTraversalMeasurements.durationMinutes,
        lowerBound: routeTraversalMeasurements.lowerBound,
      })
      .from(routeTraversalMeasurements)
      .where(eq(routeTraversalMeasurements.routeShiftId, routeShiftId))
      .orderBy(desc(routeTraversalMeasurements.serviceDate))
      .limit(Math.max(1, opts.limit ?? 30));
    return rows.map((r) => ({
      durationMinutes: r.durationMinutes,
      lowerBound: r.lowerBound,
    }));
  }

  /**
   * Lo mismo, pero para varias rutas×turno de una sola vez.
   *
   * La torre necesita las muestras de las catorce rutas del turno para estimar
   * llegadas. Pedirlas de a una son catorce viajes a la base en una pantalla que
   * ya carga de más; esto es uno.
   *
   * El tope por ruta es el MISMO de `recentSamples` — treinta— y se aplica aquí
   * después de agrupar, no en la consulta: son decenas de filas por ruta, no
   * miles, y un `LATERAL` por ruta costaría más de lo que ahorra. Si esta tabla
   * crece a millones habrá que moverlo al SQL, y entonces el tope tiene que
   * seguir siendo uno solo para las dos.
   */
  async recentSamplesForRouteShifts(
    routeShiftIds: string[],
    opts: { limitPorRuta?: number } = {},
  ): Promise<Map<string, RouteDurationSample[]>> {
    const porRuta = new Map<string, RouteDurationSample[]>();
    const ids = [...new Set(routeShiftIds)];
    if (ids.length === 0) return porRuta;

    const limite = Math.max(1, opts.limitPorRuta ?? 30);
    const rows = await this.db
      .select({
        routeShiftId: routeTraversalMeasurements.routeShiftId,
        durationMinutes: routeTraversalMeasurements.durationMinutes,
        lowerBound: routeTraversalMeasurements.lowerBound,
      })
      .from(routeTraversalMeasurements)
      .where(inArray(routeTraversalMeasurements.routeShiftId, ids))
      .orderBy(desc(routeTraversalMeasurements.serviceDate));

    for (const r of rows) {
      const lista = porRuta.get(r.routeShiftId) ?? [];
      if (lista.length >= limite) continue;
      lista.push({ durationMinutes: r.durationMinutes, lowerBound: r.lowerBound });
      porRuta.set(r.routeShiftId, lista);
    }
    return porRuta;
  }
}

export class IngestAlertRepository {
  constructor(private db: Database) {}

  async create(data: {
    carrierAccountId?: string | null;
    kind: IngestAlertKind;
    severity?: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(ingestAlerts)
      .values({
        carrierAccountId: data.carrierAccountId ?? null,
        kind: data.kind,
        severity: data.severity ?? "warning",
        message: data.message,
        metadata: data.metadata ?? {},
      })
      .returning();
    return row;
  }

  async findOpenByKind(
    kind: IngestAlertKind,
    carrierAccountId?: string | null,
  ) {
    const conditions = [eq(ingestAlerts.kind, kind), isNull(ingestAlerts.resolvedAt)];
    if (carrierAccountId) {
      conditions.push(eq(ingestAlerts.carrierAccountId, carrierAccountId));
    }
    return this.db.query.ingestAlerts.findFirst({
      where: and(...conditions),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
  }

  async resolveOpen(
    kind: IngestAlertKind,
    carrierAccountId?: string | null,
  ) {
    const conditions = [eq(ingestAlerts.kind, kind), isNull(ingestAlerts.resolvedAt)];
    if (carrierAccountId) {
      conditions.push(eq(ingestAlerts.carrierAccountId, carrierAccountId));
    }
    await this.db
      .update(ingestAlerts)
      .set({ resolvedAt: new Date() })
      .where(and(...conditions));
  }

  async listRecent(limit = 40) {
    return this.db.query.ingestAlerts.findMany({
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit,
    });
  }

  async listUnresolved(limit = 40) {
    return this.db.query.ingestAlerts.findMany({
      where: and(isNull(ingestAlerts.resolvedAt), deCuentaReal(ingestAlerts.carrierAccountId)),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit,
    });
  }
}

/**
 * De quién es un recurso — y **nada más que eso**.
 *
 * Existe para invertir el orden de leer y autorizar. Hoy una pantalla como
 * `/cliente/servicio/[id]` carga el expediente completo —veredicto, evidencia,
 * puntos GPS, ledger, telemetría— **antes** de que nadie pregunte quién está
 * mirando. Autorizar después de leer no es autorizar: es leer y luego decidir
 * si se enseña lo que ya se leyó.
 *
 * Cada método de aquí devuelve **una columna**: el id de la cuenta dueña. Ni un
 * campo más. Es lo único que hace falta para decidir, y lo único que se puede
 * leer sin haber decidido.
 *
 * Devuelve `null` cuando el recurso no existe. Quien llama trata «no existe» y
 * «no es tuyo» **igual**, para que la forma de la negativa no revele cuáles ids
 * existen.
 */
export class ProcedenciaRepository {
  constructor(private db: Database) {}

  async dePlanta(plantId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: plants.clientAccountId })
      .from(plants)
      .where(eq(plants.id, plantId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  async deCampus(plantGroupId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: plantGroups.clientAccountId })
      .from(plantGroups)
      .where(eq(plantGroups.id, plantGroupId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  async deContrato(contractId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: serviceContracts.clientAccountId })
      .from(serviceContracts)
      .where(eq(serviceContracts.id, contractId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  async deRuta(routeId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: routes.clientAccountId })
      .from(routes)
      .where(eq(routes.id, routeId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  /**
   * El único que salta, y salta una vez: la ocurrencia guarda `contractId`
   * como columna propia, así que basta un join con el contrato. No se toca la
   * ocurrencia entera —`findById` arrastra el hecho, el viaje y sus puntos de
   * evidencia—, solo la arista de propiedad.
   */
  async deServicio(occurrenceId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: serviceContracts.clientAccountId })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .where(eq(serviceOccurrences.id, occurrenceId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  /*
   * ── El lado del transportista ──────────────────────────────────────────
   *
   * Los cinco de arriba devuelven la cuenta CLIENTE dueña de la fila. Los de
   * abajo devuelven la cuenta CARRIER. Son consultas distintas sobre las
   * mismas tablas, y confundirlas no da error: da una guardia que compara
   * contra la pared equivocada y se ve idéntica a una que funciona.
   *
   * Un contrato y un servicio tienen DOS dueños —cliente y carrier— y por eso
   * llevan las dos versiones. Una unidad tiene uno solo: es del carrier y de
   * nadie más, así que `deUnidad` no necesita apellido.
   */

  /** La unidad es del carrier y de nadie más. */
  async deUnidad(unitId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: units.carrierAccountId })
      .from(units)
      .where(eq(units.id, unitId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  async carrierDeContrato(contractId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: serviceContracts.carrierAccountId })
      .from(serviceContracts)
      .where(eq(serviceContracts.id, contractId))
      .limit(1);
    return f?.cuenta ?? null;
  }

  /** Salta una vez, igual que `deServicio`: la ocurrencia guarda `contractId`. */
  async carrierDeServicio(occurrenceId: string): Promise<string | null> {
    const [f] = await this.db
      .select({ cuenta: serviceContracts.carrierAccountId })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .where(eq(serviceOccurrences.id, occurrenceId))
      .limit(1);
    return f?.cuenta ?? null;
  }
}

/**
 * Posición viva — la última posición conocida de cada aparato.
 *
 * Deliberadamente pequeño: escribir y leer. Toda la lógica de qué se publica y
 * qué no vive en el endpoint público, no aquí.
 */
export class LivePositionRepository {
  constructor(private db: Database) {}

  /**
   * Guarda la posición de un aparato **solo si es más nueva que la guardada**.
   *
   * Esa condición es la que vuelve inofensivo el desorden. El recolector hace
   * varios sondeos por minuto y uno lento puede llegar después de otro más
   * nuevo; sin el `where`, el sondeo atrasado pisaría la posición buena con una
   * vieja y el pasajero vería al camión brincar hacia atrás.
   *
   * Con él, un sondeo tardío no hace nada. Escribir dos veces sale igual que
   * escribir una, y en desorden sale igual que en orden.
   */
  async upsertMany(
    posiciones: Array<{
      imei: string;
      carrierAccountId: string;
      deviceId?: string | null;
      unitId?: string | null;
      latitude: number;
      longitude: number;
      speed?: number | null;
      heading?: number | null;
      recordedAt: Date;
      collectedAt?: Date;
    }>,
  ) {
    if (posiciones.length === 0) return [];
    const ahora = new Date();
    return escribirEnLotes(
      posiciones.map((p) => ({
        imei: p.imei,
        carrierAccountId: p.carrierAccountId,
        deviceId: p.deviceId ?? undefined,
        unitId: p.unitId ?? undefined,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed ?? undefined,
        heading: p.heading ?? undefined,
        recordedAt: p.recordedAt,
        collectedAt: p.collectedAt ?? ahora,
        updatedAt: ahora,
      })),
      filasPorSentencia(livePositions),
      (lote) =>
        this.db
          .insert(livePositions)
          .values(lote)
          .onConflictDoUpdate({
            target: livePositions.imei,
            set: {
              carrierAccountId: sql`excluded.carrier_account_id`,
              deviceId: sql`excluded.device_id`,
              unitId: sql`excluded.unit_id`,
              latitude: sql`excluded.latitude`,
              longitude: sql`excluded.longitude`,
              speed: sql`excluded.speed`,
              heading: sql`excluded.heading`,
              recordedAt: sql`excluded.recorded_at`,
              collectedAt: sql`excluded.collected_at`,
              updatedAt: sql`excluded.updated_at`,
            },
            where: sql`${livePositions.recordedAt} < excluded.recorded_at`,
          })
          .returning(),
    );
  }

  /** Posiciones vivas de un carrier. El filtro de frescura lo aplica quien lee. */
  async listForCarrier(carrierAccountId: string) {
    return this.db
      .select()
      .from(livePositions)
      .where(eq(livePositions.carrierAccountId, carrierAccountId));
  }

  async getByImei(imei: string) {
    const [fila] = await this.db.select().from(livePositions).where(eq(livePositions.imei, imei));
    return fila ?? null;
  }
}

/**
 * Una unidad del plan de un circuito, con lo último que se sabe de dónde está.
 *
 * `latitude`, `longitude`, `heading` y `recordedAt` llegan en `null` cuando de
 * esa unidad no se sabe nada: la asignación manda y la posición es opcional,
 * porque una unidad asignada sin aparato es justo el renglón que el operador
 * necesita ver. **Quién está fresco lo decide quien lee**, contra los umbrales
 * del circuito (`medirUnidad`, en `@jtel/domain/publico`) — hornear aquí un
 * umbral lo volvería constante.
 */
export interface UnidadDelPlanConPosicion {
  assignmentId: string;
  unitId: string;
  /** El número económico: lo que el operador dice por el radio. */
  unitLabel: string;
  plateNumber: string | null;
  assignedFrom: Date;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  /**
   * km/h del último fix. **Contexto del ritmo, nunca una orden** (9.2b): la
   * torre muestra a qué va un camión; J-Tel no manda velocidades. `null` sin
   * posición, y también cuando el aparato no la reporta — que no es cero.
   */
  speed: number | null;
  recordedAt: Date | null;
}

/** La misma unidad, más de quién es. Sólo la concesión dueña la recibe así. */
export interface UnidadDelPlanConCarrier extends UnidadDelPlanConPosicion {
  /**
   * El id además del nombre: un circuito puede correrlo más de un
   * transportista, y contar nombres en vez de cuentas fundiría dos que se
   * llamen igual en uno solo.
   */
  carrierAccountId: string;
  carrierName: string;
}

/**
 * Lo que una cuenta puede ver del plan de un circuito — **el alcance viaja con
 * el dato** (Paso 1.A de la torre).
 *
 * Es una unión discriminada y no una lista a secas porque el alcance cambia
 * qué se puede afirmar: quien lee `carrier` está viendo SU flota dentro de un
 * circuito que puede correr alguien más, y escribir «3 unidades en el
 * circuito» con eso en la mano es la afirmación falsa del alcance (Marco §D).
 * Con la unión, el compilador no deja leer `carrierName` donde no existe, y el
 * total que se pueda escribir es el del alcance que se está leyendo.
 *
 * `ninguno` es la respuesta para una cuenta ajena **y** para un circuito que no
 * existe: indistinguibles a propósito.
 */
export type PlanDelCircuitoParaCuenta =
  | { alcance: "concesion"; unidades: UnidadDelPlanConCarrier[] }
  | { alcance: "carrier"; unidades: UnidadDelPlanConPosicion[] }
  | { alcance: "ninguno"; unidades: [] };


/**
 * Concesión, circuito y parada — el registro interno del transporte concesionado.
 *
 * **La regla de vigencia vive aquí dentro, no en quien llama.** Mover o
 * renombrar una parada cierra su versión y abre otra en la misma transacción:
 * si eso dependiera de que cada pantalla se acuerde, el día que alguien no se
 * acuerde el pasado se reescribe en silencio.
 */
/**
 * Las reglas de la medición de un circuito (0051, A4b): lo que decide qué cuenta
 * como «pasó». Cambiar una exige motivo y deja renglón en `circuit_rule_changes`.
 * El nombre y el color NO están: son identidad, no cambian la medición (ASAV).
 */
export const REGLAS_DE_LA_MEDICION = [
  { campo: "corridorToleranceMeters", columna: "corridor_tolerance_meters" },
  { campo: "staleAfterSeconds", columna: "stale_after_seconds" },
  { campo: "serviceConfidenceMinutes", columna: "service_confidence_minutes" },
  { campo: "avgSpeedKmh", columna: "avg_speed_kmh" },
  { campo: "arrivalRangeFloorSeconds", columna: "arrival_range_floor_seconds" },
  { campo: "stopSnapToleranceMeters", columna: "stop_snap_tolerance_meters" },
  { campo: "arrivalTolerancePct", columna: "arrival_tolerance_pct" },
  { campo: "corridorExitMinutes", columna: "corridor_exit_minutes" },
  { campo: "serviceStartLocal", columna: "service_start_local" },
  { campo: "serviceEndLocal", columna: "service_end_local" },
  { campo: "timeZone", columna: "time_zone" },
  { campo: "serviceLaunchDate", columna: "service_launch_date" },
] as const satisfies ReadonlyArray<{ campo: keyof typeof circuits.$inferSelect; columna: string }>;

/**
 * ¿Es el mismo valor? Se compara lo que la base guarda contra lo que llega, en
 * la forma en que la base lo devuelve: una hora `time` vuelve como «05:00:00»
 * y el formulario manda «05:00»; un número puede venir como texto. Mandar el
 * valor de hoy no es un cambio y no deja renglón.
 */
export function mismoValorDeRegla(guardado: unknown, nuevo: unknown): boolean {
  if (guardado === null || guardado === undefined || nuevo === null || nuevo === undefined) {
    return (guardado ?? null) === (nuevo ?? null);
  }
  if (typeof guardado === "number" || typeof nuevo === "number") return Number(guardado) === Number(nuevo);
  const a = String(guardado);
  const b = String(nuevo);
  const hora = /^\d{2}:\d{2}(:\d{2})?$/;
  if (hora.test(a) && hora.test(b)) return a.slice(0, 5) === b.slice(0, 5) && (a.slice(6) || "00") === (b.slice(6) || "00");
  return a === b;
}

/** El valor de una regla, como texto para el registro. Una hora sin sus segundos en cero. */
export function textoDeRegla(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v);
  return /^\d{2}:\d{2}:00$/.test(t) ? t.slice(0, 5) : t;
}

export class CircuitRepository {
  constructor(private db: Database) {}

  async listConcessions() {
    return this.db
      .select({
        accountId: accounts.id,
        name: accounts.name,
        slug: accounts.slug,
        legalName: concessionProfiles.legalName,
        numeroConcesion: concessionProfiles.numeroConcesion,
      })
      .from(accounts)
      .leftJoin(concessionProfiles, eq(concessionProfiles.accountId, accounts.id))
      .where(eq(accounts.type, "concesion"));
  }

  /**
   * Da de alta una concesión: la cuenta y su perfil, en la misma transacción.
   *
   * La concesión es un `accounts` de tipo `concesion` — no una tabla aparte—
   * para heredar membresías, alcance y ledger. Crear la cuenta sin su perfil
   * dejaría una concesión sin razón social, así que van juntas o no van.
   */
  async createConcession(datos: {
    name: string;
    slug: string;
    legalName: string;
    numeroConcesion?: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [cuenta] = await tx
        .insert(accounts)
        .values({ name: datos.name, slug: datos.slug, type: "concesion" })
        .returning();
      const [perfil] = await tx
        .insert(concessionProfiles)
        .values({
          accountId: cuenta.id,
          legalName: datos.legalName,
          numeroConcesion: datos.numeroConcesion ?? null,
        })
        .returning();
      return { cuenta, perfil };
    });
  }

  /**
   * Los transportistas ligados a una concesión, vigentes e históricos.
   *
   * Esta liga es la que abre el universo de unidades asignables: sin ella, la
   * pantalla del circuito no tiene de dónde escoger. Lleva vigencia por la
   * misma razón que la asignación — un transportista puede dejar de correr para
   * una concesión sin que su historia se borre.
   */
  async listConcessionCarriers(concessionAccountId: string) {
    return this.db
      .select({
        id: concessionCarriers.id,
        carrierAccountId: concessionCarriers.carrierAccountId,
        carrierName: accounts.name,
        validFrom: concessionCarriers.validFrom,
        validTo: concessionCarriers.validTo,
      })
      .from(concessionCarriers)
      .innerJoin(accounts, eq(accounts.id, concessionCarriers.carrierAccountId))
      .where(eq(concessionCarriers.concessionAccountId, concessionAccountId))
      .orderBy(accounts.name);
  }

  /**
   * Liga un transportista a una concesión. Idempotente: si ya hay una liga
   * vigente, la devuelve en vez de abrir una segunda.
   *
   * Sin candado en la base para esto —a diferencia de la asignación de unidad—
   * porque dos ligas abiertas del mismo par no publican nada mal: solo duplican
   * un renglón. Se evita aquí, donde cuesta una consulta.
   */
  async linkCarrierToConcession(concessionAccountId: string, carrierAccountId: string) {
    const [yaEsta] = await this.db
      .select()
      .from(concessionCarriers)
      .where(
        and(
          eq(concessionCarriers.concessionAccountId, concessionAccountId),
          eq(concessionCarriers.carrierAccountId, carrierAccountId),
          isNull(concessionCarriers.validTo),
        ),
      );
    if (yaEsta) return yaEsta;

    const [fila] = await this.db
      .insert(concessionCarriers)
      .values({ concessionAccountId, carrierAccountId })
      .returning();
    return fila;
  }

  /**
   * Termina la liga. No borra, y **no toca las asignaciones vigentes de sus
   * unidades**: cerrarlas en cascada decidiría por el despachador qué motivo
   * llevan y a partir de cuándo. Lo que sí ocurre es que esas unidades dejan de
   * aparecer como asignables para nuevas asignaciones.
   */
  async unlinkCarrierFromConcession(id: string) {
    const [fila] = await this.db
      .update(concessionCarriers)
      .set({ validTo: new Date() })
      .where(and(eq(concessionCarriers.id, id), isNull(concessionCarriers.validTo)))
      .returning();
    return fila ?? null;
  }

  /** Todos los circuitos, con el nombre de su concesión. Para la lista. */
  async listAllCircuits() {
    return this.db
      .select({
        id: circuits.id,
        name: circuits.name,
        publicSlug: circuits.publicSlug,
        active: circuits.active,
        concessionAccountId: circuits.concessionAccountId,
        concessionName: accounts.name,
      })
      .from(circuits)
      .innerJoin(accounts, eq(accounts.id, circuits.concessionAccountId))
      .orderBy(accounts.name, circuits.name);
  }

  /**
   * La cadena de TODOS los circuitos, para la lista de J-Staff en su casa
   * nueva (21-sep-2026): lo que cada uno tiene de trazado, paradas, promesa y
   * unidades, y si está publicado. **Sin muro, porque es de J-Staff** — igual
   * que `listAllCircuits`, y la misma valla la amarra a esa cara
   * (`guardia-muro-cuenta`).
   *
   * Cinco lecturas planas y el cruce en memoria: son decenas de circuitos, y
   * una sola consulta con cuatro LEFT JOIN multiplicaría filas por cada
   * combinación de trazado × parada × unidad.
   */
  /**
   * El color que ya tiene cada OTRO circuito, para poder avisar si se repite.
   *
   * **Avisa, no bloquea** (ASAV, 23-sep-2026): el color de una ruta es el que los
   * camiones traen pintados en la calle, y si dos concesionarios pintaron el
   * mismo azul, la app no puede inventar que son distintos. Lo que sí puede es
   * decírselo a quien captura, que es el que sabe si es a propósito.
   *
   * Consulta propia y chica en vez de colgarse de `resumenDeCircuitosParaJStaff`:
   * ése trae trazados, paradas, asignaciones y promesas en cinco consultas, y
   * aquí sólo hacen falta dos columnas.
   */
  async coloresDeOtrosCircuitos(exceptoCircuitId: string) {
    return this.db
      .select({ id: circuits.id, name: circuits.name, colorHex: circuits.colorHex })
      .from(circuits)
      .where(ne(circuits.id, exceptoCircuitId))
      .orderBy(circuits.name);
  }

  async resumenDeCircuitosParaJStaff() {
    const [lista, trazados, paradas, asignadas, promesas] = await Promise.all([
      this.db
        .select({
          id: circuits.id,
          name: circuits.name,
          publicSlug: circuits.publicSlug,
          active: circuits.active,
          publishedAt: circuits.publishedAt,
          serviceStartLocal: circuits.serviceStartLocal,
          serviceEndLocal: circuits.serviceEndLocal,
          concessionAccountId: circuits.concessionAccountId,
          concessionName: accounts.name,
        })
        .from(circuits)
        .innerJoin(accounts, eq(accounts.id, circuits.concessionAccountId))
        .orderBy(accounts.name, circuits.name),
      this.db
        .select({ circuitId: circuitPaths.circuitId, sentido: circuitPaths.sentido, puntos: circuitPaths.pointCount })
        .from(circuitPaths),
      this.db
        .select({ circuitId: circuitStops.circuitId, sentido: circuitStopVersions.sentido })
        .from(circuitStops)
        .innerJoin(circuitStopVersions, eq(circuitStopVersions.stopId, circuitStops.id))
        .where(and(isNull(circuitStops.retiredAt), isNull(circuitStopVersions.validTo))),
      this.db
        .select({ circuitId: circuitUnitAssignments.circuitId, n: sql<number>`count(*)::int` })
        .from(circuitUnitAssignments)
        .where(isNull(circuitUnitAssignments.validTo))
        .groupBy(circuitUnitAssignments.circuitId),
      this.db
        .select({
          circuitId: circuitPromiseTables.circuitId,
          franjas: sql<number>`(SELECT count(*)::int FROM circuit_promise_bands b WHERE b.promise_table_id = circuit_promise_tables.id)`,
        })
        .from(circuitPromiseTables)
        .where(isNull(circuitPromiseTables.validTo)),
    ]);

    return lista.map((c) => ({
      ...c,
      trazados: trazados
        .filter((t) => t.circuitId === c.id)
        .map((t) => ({ sentido: t.sentido as "ida" | "vuelta", puntos: t.puntos })),
      paradas: paradas
        .filter((p) => p.circuitId === c.id)
        .map((p) => ({ sentido: p.sentido as "ida" | "vuelta" | null })),
      unidadesAsignadas: asignadas.find((a) => a.circuitId === c.id)?.n ?? 0,
      /** `null`: nunca se capturó una promesa. 0: la vigente no tiene franjas. */
      franjasDeLaPromesa: promesas.find((p) => p.circuitId === c.id)?.franjas ?? null,
    }));
  }

  async getCircuit(id: string) {
    const [fila] = await this.db.select().from(circuits).where(eq(circuits.id, id));
    return fila ?? null;
  }

  /**
   * El circuito, **para esta cuenta** — o `null`, que es lo mismo que decir que
   * no existe (Enmiendas de la Pieza 9, 9.14). Un circuito de otra cuenta no se
   * distingue de uno que nunca hubo.
   *
   * Existe para dos cuentas y sólo dos:
   *
   *  - **La concesión dueña** (`circuits.concession_account_id`).
   *  - **Un carrier LIGADO a esa concesión** por un `concession_carriers`
   *    vigente. Entrada agregada el 21-sep-2026, y sin ella el carrier no puede
   *    asignar su primera unidad: las otras dos entradas exigen que YA corra
   *    algo ahí, así que un carrier recién ligado no veía el circuito, no
   *    llegaba a la pantalla, y nunca hacía la primera asignación. Es el huevo
   *    y la gallina del muro. Lo que ve de más es lo público —paradas, promesa,
   *    trazado (9.14)— y cero unidades, porque la compuerta de flujo de la
   *    torre sigue siendo la suya.
   *  - **Un carrier con unidades suyas en él**: alguna unidad de la que es dueño
   *    (`units.carrier_account_id`) que él mismo asignó a este circuito
   *    (`circuit_unit_assignments.carrier_account_id`) **en cualquier momento**,
   *    no sólo hoy — su historial es suyo. Las dos cerraduras, porque nada en la
   *    base obliga a que coincidan: hoy coinciden por convención, y una fila que
   *    no cuadra no le abre el circuito a nadie más que a la concesión.
   *
   * Es la misma regla que `pasosVisiblesParaCuenta`, a nivel de circuito; las dos
   * las vigila `guardia-muro-cuenta.test.ts`. **No es `getCircuit`**: aquel sigue
   * sin cuenta porque lo usa J-Staff, que ve todo.
   */
  async getCircuitVisibleParaCuenta(cuentaId: string, circuitId: string) {
    const [fila] = await this.db
      .select()
      .from(circuits)
      .where(
        and(
          eq(circuits.id, circuitId),
          or(
            eq(circuits.concessionAccountId, cuentaId),
            sql`EXISTS (
              SELECT 1 FROM ${concessionCarriers}
              WHERE ${concessionCarriers.concessionAccountId} = ${circuits.concessionAccountId}
                AND ${concessionCarriers.carrierAccountId} = ${cuentaId}
                AND ${concessionCarriers.validTo} IS NULL
            )`,
            sql`EXISTS (
              SELECT 1 FROM ${circuitUnitAssignments}
              INNER JOIN ${units} ON ${units.id} = ${circuitUnitAssignments.unitId}
              WHERE ${circuitUnitAssignments.circuitId} = ${circuits.id}
                AND ${circuitUnitAssignments.carrierAccountId} = ${cuentaId}
                AND ${units.carrierAccountId} = ${cuentaId}
            )`,
          ),
        ),
      );
    return fila ?? null;
  }

  /**
   * Los circuitos que existen **para esta cuenta** — la lista del cuarto, y la
   * hermana a nivel cuenta de `getCircuitVisibleParaCuenta`.
   *
   * Mismas dos entradas y mismas cerraduras, por la misma razón: la concesión
   * dueña ve los suyos; un carrier ve aquellos donde alguna unidad **suya** fue
   * asignada **por él** —en cualquier momento, su historial es suyo—; nadie más
   * ve nada. Es `getCircuitVisibleParaCuenta` sin el `id`, y se escribe aparte
   * en vez de traer todos y filtrar arriba porque un filtro en la pantalla es
   * una línea que alguien puede borrar sin que se rompa ninguna prueba.
   *
   * **También contesta si la cuenta opera transporte público**, que es cómo el
   * menú decide si dibujar el cuarto Circuitos (mapa, regla 4). La respuesta
   * sale de esta misma consulta y no de una bandera aparte: una bandera y una
   * lista son dos definiciones de «opera público», y el día que se separen el
   * menú enseñaría un cuarto vacío o escondería uno lleno.
   *
   * `active` viene y no se filtra aquí: un circuito dado de baja sigue siendo
   * suyo y su historial se puede abrir. Quién se dibuja apagado lo decide la
   * pantalla, que es donde se puede decir por qué.
   */
  async listarCircuitosVisiblesParaCuenta(cuentaId: string) {
    return this.db
      .select({
        id: circuits.id,
        name: circuits.name,
        publicSlug: circuits.publicSlug,
        /** Identidad del circuito, nunca estado (Pieza 8.8c). El nombre siempre lo acompaña. */
        colorHex: circuits.colorHex,
        active: circuits.active,
        serviceStartLocal: circuits.serviceStartLocal,
        serviceEndLocal: circuits.serviceEndLocal,
        timeZone: circuits.timeZone,
        esDeLaConcesion: sql<boolean>`${circuits.concessionAccountId} = ${cuentaId}`,
        /*
         * Si HOY corre alguna unidad suya aquí. Desde la liga (21-sep) un
         * carrier ve circuitos donde todavía no corre nada, y la pieza no puede
         * decir «corres unidades aquí» de uno así: sería la afirmación falsa
         * del alcance (Marco §D). Mismas dos cerraduras que la entrada de abajo.
         */
        /*
         * Nombres escritos a mano y no con `${tabla.columna}`: dentro de la
         * proyección Drizzle quita el nombre de la tabla a las columnas, y
         * `"id" = "unit_id"` es ambiguo (lo enseñó la matriz sembrada).
         */
        correUnidadesHoy: sql<boolean>`EXISTS (
          SELECT 1 FROM circuit_unit_assignments cua
          INNER JOIN units u ON u.id = cua.unit_id
          WHERE cua.circuit_id = circuits.id
            AND cua.carrier_account_id = ${cuentaId}
            AND u.carrier_account_id = ${cuentaId}
            AND cua.valid_to IS NULL
        )`,
      })
      .from(circuits)
      .where(
        or(
          eq(circuits.concessionAccountId, cuentaId),
          /* La liga vigente con la concesión: ver `getCircuitVisibleParaCuenta`. */
          sql`EXISTS (
            SELECT 1 FROM ${concessionCarriers}
            WHERE ${concessionCarriers.concessionAccountId} = ${circuits.concessionAccountId}
              AND ${concessionCarriers.carrierAccountId} = ${cuentaId}
              AND ${concessionCarriers.validTo} IS NULL
          )`,
          sql`EXISTS (
            SELECT 1 FROM ${circuitUnitAssignments}
            INNER JOIN ${units} ON ${units.id} = ${circuitUnitAssignments.unitId}
            WHERE ${circuitUnitAssignments.circuitId} = ${circuits.id}
              AND ${circuitUnitAssignments.carrierAccountId} = ${cuentaId}
              AND ${units.carrierAccountId} = ${cuentaId}
          )`,
        ),
      )
      .orderBy(circuits.name);
  }


  async getCircuitByPublicSlug(slug: string) {
    const [fila] = await this.db.select().from(circuits).where(eq(circuits.publicSlug, slug));
    return fila ?? null;
  }

  /**
   * El circuito **publicado** de ese slug, o `null`.
   *
   * Ésta es la única puerta del endpoint público, y por eso el filtro va en la
   * consulta y no arriba: un circuito sin publicar tiene que ser
   * indistinguible de un slug inventado, y si el `published_at IS NOT NULL`
   * viviera en el handler, bastaría borrar una línea para abrir la fuga. Aquí
   * la línea que habría que borrar deja la función sin sentido.
   */
  async getPublishedCircuitBySlug(slug: string) {
    const [fila] = await this.db
      .select()
      .from(circuits)
      .where(and(eq(circuits.publicSlug, slug), isNotNull(circuits.publishedAt)));
    return fila ?? null;
  }

  /**
   * Los circuitos que la app del pasajero puede enseñar.
   *
   * Solo lo publicado, y solo lo que un pasajero necesita para escoger: nombre
   * y slug. Ni el uuid, ni la concesión, ni quién los corre.
   */
  async listPublishedCircuits() {
    return this.db
      .select({
        publicSlug: circuits.publicSlug,
        name: circuits.name,
        /*
         * El color, la frecuencia y el horario entraron con Ontoy: la vista de
         * ciudad los necesita para pintar cada ruta con su identidad (8.8c) y
         * para decir su promesa aunque no haya una sola unidad en vivo (8.2).
         *
         * Son **públicos** y por eso pueden salir por aquí: la ruta, sus
         * paradas y sus horarios están en el primer cajón del 9.14. Lo que
         * sigue sin salir es el uuid, la concesión y quién los corre.
         */
        colorHex: circuits.colorHex,
        serviceStartLocal: circuits.serviceStartLocal,
        serviceEndLocal: circuits.serviceEndLocal,
        timeZone: circuits.timeZone,
        serviceLaunchDate: circuits.serviceLaunchDate,
      })
      .from(circuits)
      .where(isNotNull(circuits.publishedAt))
      .orderBy(circuits.name);
  }

  /**
   * Registra UNA apertura de la app, deduplicando por aparato y por día.
   *
   * **La deduplicación la hace la BASE, no este código**, y es deliberado:
   * entre un `SELECT` y un `INSERT` cabe la otra petición del mismo aparato
   * —dos pestañas, un reintento de red— y saldrían dos filas donde hubo un
   * aparato. Con el índice único y `ON CONFLICT`, el segundo intento incrementa
   * en vez de insertar, y «contar filas» sigue siendo una definición.
   *
   * El `open_count` que incrementa es el crudo, y **no se enseña**: es la señal
   * de raspado. Ver el encabezado de la tabla.
   */
  async registrarApertura(entrada: {
    circuitId: string;
    localDate: string;
    fingerprint: string;
  }) {
    await this.db
      .insert(circuitOpens)
      .values({
        circuitId: entrada.circuitId,
        localDate: entrada.localDate,
        fingerprint: entrada.fingerprint,
      })
      .onConflictDoUpdate({
        target: [circuitOpens.circuitId, circuitOpens.localDate, circuitOpens.fingerprint],
        set: {
          openCount: sql`${circuitOpens.openCount} + 1`,
          lastOpenAt: new Date(),
        },
      });
  }

  /**
   * El resumen por día de un circuito: cuántos aparatos distinguibles y cuántas
   * veces en crudo.
   *
   * Devuelve **sólo los días que tienen filas**, y quien lo lee arma la serie:
   * un día sin filas no es lo mismo antes y después de que el contador
   * existiera, y esa distinción no la puede hacer una consulta. Ver
   * `resumen-de-aperturas.ts`.
   */
  async resumenDeAperturas(circuitId: string, desde: string) {
    return this.db
      .select({
        localDate: circuitOpens.localDate,
        aparatos: count(),
        crudo: sql<number>`sum(${circuitOpens.openCount})::int`,
      })
      .from(circuitOpens)
      .where(and(eq(circuitOpens.circuitId, circuitId), gte(circuitOpens.localDate, desde)))
      .groupBy(circuitOpens.localDate)
      .orderBy(desc(circuitOpens.localDate));
  }

  /**
   * El primer día con registro de este circuito. **Es lo que separa un cero de
   * un hueco**: antes de esa fecha el contador no existía para esta ruta, y
   * dibujar «0 aperturas» ahí afirmaría que nadie abrió cuando lo cierto es que
   * nadie estaba contando. `null` si nunca se ha registrado ninguna.
   */
  async primerDiaConAperturas(circuitId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ dia: sql<string | null>`min(${circuitOpens.localDate})` })
      .from(circuitOpens)
      .where(eq(circuitOpens.circuitId, circuitId));
    return fila?.dia ?? null;
  }

  /** Prende o apaga la publicación. Apagar no borra nada del circuito. */
  async setCircuitPublished(id: string, publicado: boolean) {
    const [fila] = await this.db
      .update(circuits)
      .set({ publishedAt: publicado ? new Date() : null, updatedAt: new Date() })
      .where(eq(circuits.id, id))
      .returning();
    return fila ?? null;
  }

  /**
   * Prende y apaga el RANGO de llegada. Hermano del interruptor de publicación
   * y por la misma razón marca de tiempo: «desde cuándo se calibró» sale gratis.
   *
   * Apagado no esconde el circuito ni las unidades — el pasajero sigue viendo
   * el camión moverse en el mapa. Lo que se calla es el minuto estimado, que
   * depende de una velocidad que todavía no se midió en esta calle.
   */
  /**
   * Prender o apagar el tiempo estimado de llegada, **firmado** (0051, A4b): es
   * una regla de lo que se le dice al pasajero. Mismo trato que
   * `cambiarCircuito`: el estado de antes sale de la base, sin motivo o sin
   * quién no se escribe nada, y pedir el estado que ya tiene no deja renglón ni
   * mueve su fecha.
   */
  async cambiarRangoDeLlegada(
    id: string,
    activo: boolean,
    firma: { motivo: string | null; por: string | null },
  ): Promise<
    | { ok: true; circuito: typeof circuits.$inferSelect; registrados: number }
    | { ok: false; error: "no_existe" | "falta_motivo" | "falta_quien" }
  > {
    return this.db.transaction(async (tx) => {
      const [antes] = await tx.select().from(circuits).where(eq(circuits.id, id)).for("update");
      if (!antes) return { ok: false as const, error: "no_existe" as const };
      if ((antes.arrivalRangeEnabledAt !== null) === activo) return { ok: true as const, circuito: antes, registrados: 0 };
      const motivo = firma.motivo?.trim() ?? "";
      if (!motivo) return { ok: false as const, error: "falta_motivo" as const };
      if (!firma.por) return { ok: false as const, error: "falta_quien" as const };
      const [despues] = await tx
        .update(circuits)
        .set({ arrivalRangeEnabledAt: activo ? new Date() : null, updatedAt: new Date() })
        .where(eq(circuits.id, id))
        .returning();
      await tx.insert(circuitRuleChanges).values({
        circuitId: id,
        regla: "arrival_range_enabled_at",
        valorAntes: antes.arrivalRangeEnabledAt ? "encendido" : "apagado",
        valorDespues: despues!.arrivalRangeEnabledAt ? "encendido" : "apagado",
        motivo,
        cambiadoPor: firma.por,
      });
      return { ok: true as const, circuito: despues!, registrados: 1 };
    });
  }

  // ── Los recorridos por tramo, agregados (0053; Marco 8.16.5) ──────────

  /**
   * Reemplaza el resumen de un circuito: un renglón por tramo. En una
   * transacción, borrando lo anterior — un tramo que dejó de tener travesías
   * suficientes **desaparece**, en vez de quedarse con el número de la semana
   * pasada.
   */
  async guardarRecorridos(
    circuitId: string,
    tramos: Array<{
      sentido: "ida" | "vuelta";
      deStopId: string;
      aStopId: string;
      travesias: number;
      desdeSeg: number;
      medianaSeg: number;
      hastaSeg: number;
      ventanaDesde: Date;
      ventanaHasta: Date;
      detectorVersion: string;
    }>,
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      await tx.delete(circuitLegTimes).where(eq(circuitLegTimes.circuitId, circuitId));
      if (tramos.length === 0) return 0;
      await tx.insert(circuitLegTimes).values(tramos.map((t) => ({ circuitId, ...t })));
      return tramos.length;
    });
  }

  /**
   * Los recorridos publicables de TODOS los circuitos publicados, para la app
   * del pasajero. Sólo lo que la 8.16.5 autoriza: el tramo por sus paradas
   * públicas, su sentido, cuántas travesías lo sostienen y el rango. **Ni
   * unidad ni transportista: la tabla no los tiene.**
   */
  async recorridosPublicados() {
    const de = alias(circuitStops, "de_stop");
    const a = alias(circuitStops, "a_stop");
    return this.db
      .select({
        ruta: circuits.publicSlug,
        sentido: circuitLegTimes.sentido,
        de: de.qrSlug,
        a: a.qrSlug,
        travesias: circuitLegTimes.travesias,
        desdeSeg: circuitLegTimes.desdeSeg,
        medianaSeg: circuitLegTimes.medianaSeg,
        hastaSeg: circuitLegTimes.hastaSeg,
        ventanaHasta: circuitLegTimes.ventanaHasta,
      })
      .from(circuitLegTimes)
      .innerJoin(circuits, eq(circuits.id, circuitLegTimes.circuitId))
      .innerJoin(de, eq(de.id, circuitLegTimes.deStopId))
      .innerJoin(a, eq(a.id, circuitLegTimes.aStopId))
      .where(isNotNull(circuits.publishedAt))
      .orderBy(circuits.publicSlug, circuitLegTimes.sentido);
  }

  // ── Los avisos de la concesión al pasajero (0052; Marco 8.13b) ────────

  /**
   * Capturar un aviso, **firmado**. La validación en palabras vive en
   * `validarAviso` (@jtel/domain) y la llama la API antes de llegar aquí; aquí
   * sólo se exige el quién, que no puede venir de otro lado que la sesión.
   */
  async crearAviso(
    circuitId: string,
    aviso: { titulo: string; detalle: string | null; vigenteDesde: Date; vigenteHasta: Date | null },
    por: string | null,
  ): Promise<{ ok: true; aviso: typeof circuitNotices.$inferSelect } | { ok: false; error: "no_existe" | "falta_quien" }> {
    if (!por) return { ok: false, error: "falta_quien" };
    const [c] = await this.db.select({ id: circuits.id }).from(circuits).where(eq(circuits.id, circuitId));
    if (!c) return { ok: false, error: "no_existe" };
    const [fila] = await this.db
      .insert(circuitNotices)
      .values({ circuitId, ...aviso, capturadoPor: por })
      .returning();
    return { ok: true, aviso: fila! };
  }

  /**
   * Retirar un aviso, **con motivo y firmado**. No se edita ni se borra: un
   * aviso dicho queda en la historia. Retirar uno que ya estaba retirado no
   * mueve nada, y uno de OTRO circuito no existe desde aquí.
   */
  async retirarAviso(
    circuitId: string,
    avisoId: string,
    firma: { motivo: string | null; por: string | null },
  ): Promise<{ ok: true; retirado: boolean } | { ok: false; error: "no_existe" | "falta_motivo" | "falta_quien" }> {
    const motivo = firma.motivo?.trim() ?? "";
    if (!motivo) return { ok: false, error: "falta_motivo" };
    if (!firma.por) return { ok: false, error: "falta_quien" };
    return this.db.transaction(async (tx) => {
      const [antes] = await tx
        .select()
        .from(circuitNotices)
        .where(and(eq(circuitNotices.id, avisoId), eq(circuitNotices.circuitId, circuitId)))
        .for("update");
      if (!antes) return { ok: false as const, error: "no_existe" as const };
      if (antes.retiradoEn) return { ok: true as const, retirado: false };
      await tx
        .update(circuitNotices)
        .set({ retiradoEn: new Date(), retiradoPor: firma.por, motivoRetiro: motivo })
        .where(eq(circuitNotices.id, avisoId));
      return { ok: true as const, retirado: true };
    });
  }

  /** Todos los avisos de un circuito, para su expediente en J-Staff: los recientes primero. */
  async listAvisos(circuitId: string) {
    return this.db
      .select()
      .from(circuitNotices)
      .where(eq(circuitNotices.circuitId, circuitId))
      .orderBy(desc(circuitNotices.capturadoEn));
  }

  /**
   * Los que el pasajero ve AHORA: no retirados, ya empezados y sin terminar.
   * Sólo lo que la app necesita —ni quién capturó ni el motivo de nada—, y como
   * mucho cinco: más que eso ya no es un aviso, es un tablero.
   */
  async listAvisosVigentes(circuitId: string, ahora: Date) {
    return this.db
      .select({
        id: circuitNotices.id,
        titulo: circuitNotices.titulo,
        detalle: circuitNotices.detalle,
        vigenteDesde: circuitNotices.vigenteDesde,
        vigenteHasta: circuitNotices.vigenteHasta,
      })
      .from(circuitNotices)
      .where(
        and(
          eq(circuitNotices.circuitId, circuitId),
          isNull(circuitNotices.retiradoEn),
          lte(circuitNotices.vigenteDesde, ahora),
          or(isNull(circuitNotices.vigenteHasta), gt(circuitNotices.vigenteHasta, ahora)),
        ),
      )
      .orderBy(desc(circuitNotices.vigenteDesde))
      .limit(5);
  }

  /**
   * Dónde va cada unidad que corre este circuito, ahora.
   *
   * **La posición NO se une por `unit_id`.** El recolector escribe `unitId:
   * null` en `live_positions` —se comprobó contra producción el 26 de agosto de
   * 2026: 78 de 78 filas con `unit_id` vacío y `device_id` lleno—, así que la
   * cadena real es asignación → aparato vigente → posición del aparato. Unir
   * por `unit_id` compila, corre, y devuelve cero filas para siempre con todo
   * bien configurado: el peor modo de falla, el que se ve normal.
   *
   * Devuelve el dato crudo con su `recordedAt`. **Quién está fresco y quién no
   * lo decide el llamador contra el umbral del circuito**, no esta consulta:
   * el umbral es un campo por circuito y hornearlo aquí lo volvería constante.
   */
  async listLivePositionsForCircuit(circuitId: string) {
    return this.db
      .select({
        unitId: circuitUnitAssignments.unitId,
        /*
         * **El número económico, y esto es un cambio con fecha: 21-sep-2026.**
         *
         * Esta consulta NO lo traía, a propósito. El porqué del cambio importa
         * más que el campo:
         *
         * La **Pieza 8.5** lo pide por su nombre —«el pasajero ve la unidad en
         * vivo, su número económico incluido: *viene la 2120* es parte de la
         * confianza»— y el número **está pintado en el costado del camión**:
         * cualquiera parado en la esquina lo lee. Esconderlo no protegía nada
         * que la calle no enseñe.
         *
         * Lo que sí protegía el identificador opaco que esto reemplaza era otra
         * cosa: que nadie armara el historial diario de un camión raspando el
         * endpoint. Esa protección **no se abandona, cambia de lugar** (ASAV,
         * 21-sep): el endpoint sirve sólo la posición ACTUAL y nunca historia, y
         * el raspado se corta con un límite de peticiones por teléfono, que
         * todavía no existe y está anotado en el endpoint.
         *
         * **La placa y el transportista siguen sin salir por aquí**, y ése era
         * siempre el fondo de la separación con la consulta del operador.
         */
        unitLabel: units.label,
        latitude: livePositions.latitude,
        longitude: livePositions.longitude,
        heading: livePositions.heading,
        recordedAt: livePositions.recordedAt,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(
        deviceAssignments,
        and(
          eq(deviceAssignments.unitId, circuitUnitAssignments.unitId),
          isNull(deviceAssignments.validTo),
        ),
      )
      .innerJoin(livePositions, eq(livePositions.deviceId, deviceAssignments.deviceId))
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
        ),
      );
  }

  /**
   * El plan del circuito con lo último que se sabe de cada unidad — **la
   * consulta del operador, y es OTRA consulta a propósito.**
   *
   * No es `listLivePositionsForCircuit` con dos columnas más, y esa separación
   * es estructura, no estilo: aquélla sirve al endpoint público, donde **la
   * placa y el transportista no deben existir**. Si las dos caras compartieran
   * consulta, el día que alguien agregara un campo aquí lo agregaría también
   * allá, y el filtro que lo quita sería una línea que alguien puede borrar sin
   * que se rompa nada. Aquí la línea no existe.
   *
   * ✎ **Corregido el 21-sep-2026.** Este párrafo decía que el económico tampoco
   * debía existir allá, y que «la consulta pública no trae `label` y nunca lo
   * trajo». Desde hoy sí lo trae: la Pieza 8.5 lo pide por su nombre y el
   * número está pintado en el costado del camión (el porqué completo está en el
   * comentario de `listLivePositionsForCircuit`). Lo que no cambió —y es el
   * fondo de esta separación— es la placa y el transportista.
   *
   * ## Parte de la ASIGNACIÓN, no de la posición
   *
   * `listLivePositionsForCircuit` une con `INNER JOIN`, así que una unidad
   * asignada sin aparato vigente —o con aparato y sin una sola fila en
   * `live_positions`— **desaparece de la lista sin decir nada**. Para el
   * pasajero da igual: no hay nada que dibujar. Para el operador es justo el
   * renglón que necesita ver, y desaparecido se lee como que la unidad no está
   * asignada. Por eso aquí la asignación manda y la posición es opcional:
   * `latitude`, `longitude`, `heading` y `recordedAt` llegan en `null` cuando
   * de esa unidad no se sabe nada, y eso **se enuncia**, no se omite.
   *
   * La cadena de la posición es la misma y no se reinventa: asignación →
   * aparato vigente → posición del aparato. Unir por `live_positions.unit_id`
   * compila, corre y devuelve cero filas para siempre.
   *
   * ## Una fila por unidad
   *
   * Dos filas de la misma unidad envenenarían el conteo: «4 de 3 en el plan».
   *
   * **De la asignación ya no vienen, y este comentario decía que sí.** Desde la
   * 0039 la base tiene sus dos candados de una-sola-vigente —uno por unidad y
   * otro por dispositivo—, así que el caso que aquí se describía es imposible;
   * se descubrió el 20 de septiembre de 2026, cuando la matriz sembrada del
   * Paso 1.A intentó sembrarlo y chocó contra
   * `device_assignments_unidad_una_vigente`. Un comentario que justifica código
   * con un hecho que dejó de ser cierto es la clase de afirmación falsa que se
   * defiende sola en una discusión.
   *
   * **De donde sí vienen es de `live_positions`**, que se lleva por IMEI y
   * **no tiene candado por `device_id`**: un aparato reregistrado deja su fila
   * vieja apuntando al mismo aparato, y salen dos posiciones para la misma
   * unidad. El desempate se queda, con su razón verdadera. Hacerlo en la
   * pantalla sería dejar la garantía en el código de turno, que es el que
   * cambia.
   */
  async listPlanDelCircuitoConPosicion(circuitId: string) {
    const filas = await this.db
      .select({
        assignmentId: circuitUnitAssignments.id,
        unitId: circuitUnitAssignments.unitId,
        /** El número económico: lo que el operador dice por el radio. */
        unitLabel: units.label,
        plateNumber: units.plateNumber,
        carrierAccountId: circuitUnitAssignments.carrierAccountId,
        carrierName: accounts.name,
        assignedFrom: circuitUnitAssignments.validFrom,
        latitude: livePositions.latitude,
        longitude: livePositions.longitude,
        heading: livePositions.heading,
        recordedAt: livePositions.recordedAt,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(accounts, eq(accounts.id, circuitUnitAssignments.carrierAccountId))
      .leftJoin(
        deviceAssignments,
        and(
          eq(deviceAssignments.unitId, circuitUnitAssignments.unitId),
          isNull(deviceAssignments.validTo),
        ),
      )
      .leftJoin(livePositions, eq(livePositions.deviceId, deviceAssignments.deviceId))
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
        ),
      )
      .orderBy(units.label);

    const porUnidad = new Map<string, (typeof filas)[number]>();
    for (const fila of filas) {
      const previa = porUnidad.get(fila.unitId);
      // Sin fecha no hay con qué comparar: cualquier fila con fix le gana a una
      // sin él, y entre dos sin él da igual cuál quede.
      const gana =
        !previa ||
        (fila.recordedAt !== null &&
          (previa.recordedAt === null || fila.recordedAt > previa.recordedAt));
      if (gana) porUnidad.set(fila.unitId, fila);
    }
    return [...porUnidad.values()];
  }

  /**
   * El plan del circuito con posición viva, **para UNA cuenta** — la puerta de
   * la torre (Paso 1.A), y es muro.
   *
   * `listPlanDelCircuitoConPosicion` **no se reusa para el carrier**: aquélla
   * trae todas las unidades del circuito con el nombre de su transportista, y
   * es la vista de J-Staff y de la concesión. Filtrarla en la pantalla dejaría
   * la garantía en el código de turno —el que cambia—, y lo que se abre en un
   * muro de cuenta se abre para siempre. Es la misma separación por la que esa
   * consulta ya no es la del pasajero: tres caras, tres consultas.
   *
   * ## Las tres respuestas
   *
   * - **La concesión dueña** ve el plan completo, con transportista: es su
   *   circuito, y un circuito puede correrlo más de uno.
   * - **Un carrier** ve **sólo sus propias unidades**, y sin columna de
   *   transportista: todas las filas son suyas, así que no distinguiría nada y
   *   sólo sería un campo esperando a que alguien lo llene con el de otro.
   * - **Cualquier otra cuenta** recibe `ninguno` — lo mismo que un circuito que
   *   no existe, indistinguibles a propósito.
   *
   * ## Las cerraduras van en el WHERE, no arriba
   *
   * Para el carrier son las dos del muro de pasos, juntas con `AND`: la unidad
   * es suya (`units.carrier_account_id`) **y** él la asignó a este circuito
   * (`circuit_unit_assignments.carrier_account_id`). Nada en la base obliga a
   * que coincidan —hoy coinciden por convención— y con `OR` bastaría una. Aquí
   * la fila ES la asignación, así que las dos se miden sobre ella sin `EXISTS`,
   * a diferencia del paso, que no lleva cuenta y necesita derivarla.
   *
   * La comprobación del circuito de arriba **no hace sobrante al WHERE**: son
   * la misma regla a dos granos. `getCircuitVisibleParaCuenta` contesta «¿este
   * circuito existe para ti?» y cuenta el historial; el WHERE contesta «¿esta
   * fila es tuya?». Quitar cualquiera de los dos abre algo: sin el de arriba,
   * un uuid ajeno se distinguiría de uno inventado por el tiempo de respuesta
   * y por lo que devuelve en el borde; sin el de abajo, la concesión y el
   * carrier leerían el mismo plan.
   *
   * **No se filtra por `live_positions.carrier_account_id`** aunque la columna
   * exista y sea cómoda: la escribe el recolector, no el alta, y sería una
   * TERCERA fuente de verdad sobre de quién es una unidad. El muro de esta casa
   * son el alta y la asignación; tres definiciones de lo mismo se separan igual
   * que dos, nada más que más rápido.
   *
   * ## Lo que se hereda de la consulta del operador y no se reinventa
   *
   * La cadena de la posición —asignación → aparato vigente → posición del
   * aparato— porque unir por `live_positions.unit_id` compila, corre y devuelve
   * cero filas para siempre; la asignación mandando sobre la posición, con
   * `null` que **se enuncia, no se omite**; y **una sola fila por unidad**,
   * porque `live_positions` se lleva por IMEI y no por aparato, y dos filas de
   * la misma unidad dirían «4 de 3 en el plan» (ver el desempate de la consulta
   * de J-Staff, que también explica de dónde NO vienen).
   *
   * ## El plan es lo VIGENTE; el historial es otra pregunta
   *
   * Sólo asignaciones abiertas (`valid_to IS NULL`). Una asignación ya cerrada
   * le sigue abriendo al carrier los pasos de entonces —su historial es suyo—
   * pero no lo pone en el plan de hoy: «quién corre este circuito ahora» y «qué
   * puedo leer de lo que corrí» son dos preguntas, y contestarlas igual pondría
   * camiones en la torre que hace un mes que no están.
   */
  async planDelCircuitoParaCuenta(
    cuentaId: string,
    circuitId: string,
  ): Promise<PlanDelCircuitoParaCuenta> {
    const circuito = await this.getCircuitVisibleParaCuenta(cuentaId, circuitId);
    if (!circuito) return { alcance: "ninguno", unidades: [] };

    const filas = await this.db
      .select({
        assignmentId: circuitUnitAssignments.id,
        unitId: circuitUnitAssignments.unitId,
        unitLabel: units.label,
        plateNumber: units.plateNumber,
        carrierAccountId: circuitUnitAssignments.carrierAccountId,
        carrierName: accounts.name,
        assignedFrom: circuitUnitAssignments.validFrom,
        latitude: livePositions.latitude,
        longitude: livePositions.longitude,
        heading: livePositions.heading,
        speed: livePositions.speed,
        recordedAt: livePositions.recordedAt,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(accounts, eq(accounts.id, circuitUnitAssignments.carrierAccountId))
      .leftJoin(
        deviceAssignments,
        and(
          eq(deviceAssignments.unitId, circuitUnitAssignments.unitId),
          isNull(deviceAssignments.validTo),
        ),
      )
      .leftJoin(livePositions, eq(livePositions.deviceId, deviceAssignments.deviceId))
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
          or(
            sql`EXISTS (
              SELECT 1 FROM ${circuits}
              WHERE ${circuits.id} = ${circuitUnitAssignments.circuitId}
                AND ${circuits.concessionAccountId} = ${cuentaId}
            )`,
            and(
              eq(circuitUnitAssignments.carrierAccountId, cuentaId),
              eq(units.carrierAccountId, cuentaId),
            ),
          ),
        ),
      )
      .orderBy(units.label);

    const porUnidad = new Map<string, (typeof filas)[number]>();
    for (const fila of filas) {
      const previa = porUnidad.get(fila.unitId);
      // Sin fecha no hay con qué comparar: cualquier fila con fix le gana a una
      // sin él, y entre dos sin él da igual cuál quede.
      const gana =
        !previa ||
        (fila.recordedAt !== null &&
          (previa.recordedAt === null || fila.recordedAt > previa.recordedAt));
      if (gana) porUnidad.set(fila.unitId, fila);
    }
    const unidades = [...porUnidad.values()];

    if (circuito.concessionAccountId === cuentaId) {
      return { alcance: "concesion", unidades };
    }

    /*
     * La proyección del carrier se escribe campo por campo, no con un `rest`
     * que quite dos: así, la columna que alguien agregue arriba el mes que
     * viene NO cae sola del otro lado del muro — hay que venir aquí y
     * escribirla, que es justo el momento de preguntarse si le toca.
     */
    return {
      alcance: "carrier",
      unidades: unidades.map((u) => ({
        assignmentId: u.assignmentId,
        unitId: u.unitId,
        unitLabel: u.unitLabel,
        plateNumber: u.plateNumber,
        assignedFrom: u.assignedFrom,
        latitude: u.latitude,
        longitude: u.longitude,
        heading: u.heading,
        speed: u.speed,
        recordedAt: u.recordedAt,
      })),
    };
  }


  /**
   * ¿A este circuito lo corre más de un transportista? — **la compuerta del
   * 9.14**, y devuelve un booleano y nada más.
   *
   * Ni cuántos son, ni quiénes. Es todo lo que la torre necesita para saber si
   * lo que un carrier puede ver es el servicio completo o un pedazo, y es lo
   * único que se le puede decir sin cruzar el muro: «hay alguien más» es una
   * condición de su propia medición; «son tres y se llaman así» es el negocio
   * de otro (9.14, privado del carrier). Un número también delata —dos
   * transportistas hoy y tres mañana dice que alguien entró— y por eso no sale.
   *
   * **Se cuenta desde un instante, no sobre lo vigente de ahora.** Un carrier
   * que cerró su asignación a media mañana dejó pasos de hoy, y su flujo sigue
   * faltando en lo que la franja midió; preguntar sólo por las asignaciones
   * abiertas diría «un solo carrier» de un servicio que hoy corrieron dos, y la
   * torre mediría contra un flujo incompleto creyéndolo completo. Es el
   * ATRASADA falso entrando por la puerta de atrás.
   *
   * Sin cuenta a propósito: no lee nada de nadie — cuenta cuentas sobre un
   * circuito que quien llama ya abrió con su propio muro.
   */
  async circuitoTieneMasDeUnCarrier(circuitId: string, desde: Date) {
    const filas = await this.db
      .selectDistinct({ carrierAccountId: circuitUnitAssignments.carrierAccountId })
      .from(circuitUnitAssignments)
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          or(
            isNull(circuitUnitAssignments.validTo),
            gt(circuitUnitAssignments.validTo, desde),
          ),
        ),
      )
      .limit(2);
    return filas.length > 1;
  }


  /**
   * El HISTORIAL de un día para las unidades de un circuito — el insumo del
   * reporte de comportamiento.
   *
   * Es la tercera consulta de este frente y otra vez es OTRA consulta: la del
   * pasajero pide la última posición, la del operador pide el plan con su
   * última posición, y ésta pide **el archivo**. Ninguna se puede reusar como
   * las otras dos sin arrastrarle a alguien columnas que no le tocan.
   *
   * ## Se une por IMEI y no por `unit_id`, y está medido
   *
   * `telemetry_points.unit_id` **no siempre viene lleno**: medido contra
   * producción el 3 de septiembre de 2026, 355 798 filas de 368 498 en siete
   * días — **3.4% en nulo**, con `imei` y `device_id` al 100%. Una consulta por
   * `unit_id` compila, corre, y **devuelve de menos en silencio**: el peor modo
   * de falla, porque un reporte incompleto que se ve completo se defiende en una
   * discusión. Es la misma cadena que ya usa el resto del frente, y por la misma
   * razón.
   *
   * ## La asignación se resuelve AL MOMENTO OBSERVADO
   *
   * `device_assignments` se une contra `recorded_at`, no contra «la vigente
   * hoy». Es la ley de la Pieza 1 —la evidencia entra por el aparato que la
   * unidad traía puesto en ese momento— y sin ella un cambio de aparato a media
   * mañana le regalaría a la unidad nueva los puntos de toda la mañana, o los
   * perdería. Cambiar de aparato no reescribe el historial.
   *
   * Devuelve el punto crudo con su hora. **Quién estaba en el corredor y quién
   * dio vueltas lo decide el dominio**, contra los umbrales del circuito: aquí
   * no se filtra por geometría, porque el corredor es columna del circuito y
   * hornearlo en el SQL lo volvería constante.
   */
  async listHistorialDelCircuito(circuitId: string, desde: Date, hasta: Date) {
    return this.db
      .select({
        unitId: circuitUnitAssignments.unitId,
        unitLabel: units.label,
        latitude: telemetryPoints.latitude,
        longitude: telemetryPoints.longitude,
        recordedAt: telemetryPoints.recordedAt,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(
        deviceAssignments,
        eq(deviceAssignments.unitId, circuitUnitAssignments.unitId),
      )
      .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
      .innerJoin(
        telemetryPoints,
        and(
          eq(telemetryPoints.imei, devices.imei),
          gte(telemetryPoints.recordedAt, desde),
          lte(telemetryPoints.recordedAt, hasta),
          /* La asignación que estaba viva cuando el aparato tomó ese fix. */
          lte(deviceAssignments.validFrom, telemetryPoints.recordedAt),
          or(
            isNull(deviceAssignments.validTo),
            gt(deviceAssignments.validTo, telemetryPoints.recordedAt),
          ),
        ),
      )
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
        ),
      )
      .orderBy(units.label, telemetryPoints.recordedAt);
  }

  /**
   * Hasta qué instante llega el archivo de estas unidades.
   *
   * **El reporte tiene que poder decir dónde se corta.** El archivador corre
   * cada diez minutos y mete su propio retraso —p99 de 12.84 min medido el 26 de
   * agosto de 2026, 1 min 44 s medido el 3 de septiembre—, así que «las vueltas de hoy»
   * es siempre «hasta donde el archivo alcanzó». Sin este dato la pantalla
   * afirmaría sobre el día completo lo que sólo vale hasta el último punto
   * archivado, que es §D en su forma de alcance.
   *
   * `null` cuando de estas unidades no hay un solo punto en el rango: un hueco
   * declarado, nunca la hora del reloj.
   */
  async ultimoPuntoArchivado(circuitId: string, desde: Date, hasta: Date) {
    const [fila] = await this.db
      .select({ ultimo: sql<Date | null>`max(${telemetryPoints.recordedAt})` })
      .from(circuitUnitAssignments)
      .innerJoin(
        deviceAssignments,
        eq(deviceAssignments.unitId, circuitUnitAssignments.unitId),
      )
      .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
      .innerJoin(
        telemetryPoints,
        and(
          eq(telemetryPoints.imei, devices.imei),
          gte(telemetryPoints.recordedAt, desde),
          lte(telemetryPoints.recordedAt, hasta),
        ),
      )
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
        ),
      );
    return fila?.ultimo ?? null;
  }

  async listCircuitsForConcession(concessionAccountId: string) {
    return this.db
      .select()
      .from(circuits)
      .where(eq(circuits.concessionAccountId, concessionAccountId));
  }

  async createCircuit(datos: typeof circuits.$inferInsert) {
    const [fila] = await this.db.insert(circuits).values(datos).returning();
    return fila;
  }

  /**
   * **Cambiar un circuito, firmando cada regla de la medición que cambie**
   * (0051, A4b — ASAV, 21-sep-2026). Es la ÚNICA escritura de los campos del
   * circuito; `updateCircuit` se borró para que no quede una puerta sin
   * registro (la valla `guardia-reglas-de-la-medicion` lo vigila).
   *
   * - **El «antes» sale de la base**, no del formulario: la fila se lee con
   *   `FOR UPDATE` dentro de la misma transacción que escribe. El «después», del
   *   `RETURNING`. Sólo se registra lo que de verdad cambió: mandar el valor de
   *   hoy no deja renglón.
   * - **Una regla que cambia exige motivo y quién.** Sin alguno de los dos no se
   *   escribe NADA — ni la regla ni lo demás del envío —: todo o nada.
   * - El nombre y el color no son reglas (no cambian la medición) y se guardan
   *   sin renglón.
   */
  async cambiarCircuito(
    id: string,
    cambios: Partial<typeof circuits.$inferInsert>,
    firma: { motivo: string | null; por: string | null },
  ): Promise<
    | { ok: true; circuito: typeof circuits.$inferSelect; registrados: number }
    | { ok: false; error: "no_existe" | "falta_motivo" | "falta_quien" }
    | { ok: false; error: "color_prohibido"; razon: string }
  > {
    return this.db.transaction(async (tx) => {
      const [antes] = await tx.select().from(circuits).where(eq(circuits.id, id)).for("update");
      if (!antes) return { ok: false as const, error: "no_existe" as const };
      /*
       * **El color prohibido se rechaza sólo si CAMBIA** (ASAV, 24-sep-2026).
       *
       * La primera versión lo rechazaba siempre, y eso dejaba encerrado a todo
       * circuito ya capturado con un tono del naranja: no se le podía corregir
       * ni el nombre, porque el formulario manda el color en cada guardado. La
       * regla es sobre lo que se escoge, no sobre lo que ya está escrito — y lo
       * que ya está escrito se señala en la pantalla, en grande, para que se
       * corrija.
       *
       * **Va aquí y no en la ruta** porque aquí el «antes» viene bajo
       * `FOR UPDATE`: comparar contra una lectura suelta deja la rendija de dos
       * guardados a la vez leyendo el mismo color permitido y escribiendo uno
       * prohibido.
       */
      const razonDelColor = cambioDeColorRechazado(
        String(antes.colorHex),
        cambios.colorHex === undefined ? undefined : String(cambios.colorHex),
      );
      if (razonDelColor) {
        return { ok: false as const, error: "color_prohibido" as const, razon: razonDelColor };
      }
      const cambian = REGLAS_DE_LA_MEDICION.filter(
        (r) => r.campo in cambios && !mismoValorDeRegla(antes[r.campo], cambios[r.campo]),
      );
      const motivo = firma.motivo?.trim() ?? "";
      if (cambian.length > 0 && !motivo) return { ok: false as const, error: "falta_motivo" as const };
      if (cambian.length > 0 && !firma.por) return { ok: false as const, error: "falta_quien" as const };
      const [despues] = await tx
        .update(circuits)
        .set({ ...cambios, updatedAt: new Date() })
        .where(eq(circuits.id, id))
        .returning();
      if (cambian.length > 0) {
        await tx.insert(circuitRuleChanges).values(
          cambian.map((r) => ({
            circuitId: id,
            regla: r.columna,
            valorAntes: textoDeRegla(antes[r.campo]),
            valorDespues: textoDeRegla(despues![r.campo]),
            motivo,
            cambiadoPor: firma.por!,
          })),
        );
      }
      return { ok: true as const, circuito: despues!, registrados: cambian.length };
    });
  }

  /** El registro de las reglas de un circuito, lo más nuevo primero. */
  async listRuleChanges(circuitId: string) {
    return this.db
      .select()
      .from(circuitRuleChanges)
      .where(eq(circuitRuleChanges.circuitId, circuitId))
      .orderBy(desc(circuitRuleChanges.cambiadoEn));
  }

  async getPaths(circuitId: string) {
    return this.db.select().from(circuitPaths).where(eq(circuitPaths.circuitId, circuitId));
  }

  /**
   * Guarda el trazado de un sentido. Reemplaza el que hubiera: un KML corregido
   * sustituye al anterior, y el `sourceLayerName` deja constancia de qué capa
   * escogió la persona que lo subió.
   */
  async upsertPath(datos: typeof circuitPaths.$inferInsert) {
    const [fila] = await this.db
      .insert(circuitPaths)
      .values(datos)
      .onConflictDoUpdate({
        target: [circuitPaths.circuitId, circuitPaths.sentido],
        set: {
          coordinates: datos.coordinates,
          pointCount: datos.pointCount,
          lengthMeters: datos.lengthMeters,
          sourceLayerName: datos.sourceLayerName ?? null,
          sourceFileName: datos.sourceFileName ?? null,
          uploadedAt: new Date(),
        },
      })
      .returning();
    return fila;
  }

  /** Las paradas vigentes de un circuito, en orden. Es lo que ve el pasajero. */
  async listStopsVigentes(circuitId: string) {
    return this.db
      .select({
        stopId: circuitStops.id,
        qrSlug: circuitStops.qrSlug,
        versionId: circuitStopVersions.id,
        name: circuitStopVersions.name,
        orden: circuitStopVersions.orden,
        sentido: circuitStopVersions.sentido,
        latitude: circuitStopVersions.latitude,
        longitude: circuitStopVersions.longitude,
        validFrom: circuitStopVersions.validFrom,
      })
      .from(circuitStops)
      .innerJoin(circuitStopVersions, eq(circuitStopVersions.stopId, circuitStops.id))
      .where(
        and(
          eq(circuitStops.circuitId, circuitId),
          isNull(circuitStops.retiredAt),
          isNull(circuitStopVersions.validTo),
        ),
      )
      .orderBy(circuitStopVersions.orden);
  }

  /**
   * Las paradas como estaban EN un instante — la versión que valía entonces, de
   * las paradas que no estaban retiradas. Para juzgar un día pasado contra lo
   * que había ese día y no contra lo que hay hoy (la jornada, 21-sep-2026): una
   * parada agregada después no puede faltar en una vuelta de antes.
   */
  async listStopsEnInstante(circuitId: string, instante: Date) {
    return this.db
      .select({
        stopId: circuitStops.id,
        name: circuitStopVersions.name,
        orden: circuitStopVersions.orden,
        sentido: circuitStopVersions.sentido,
        latitude: circuitStopVersions.latitude,
        longitude: circuitStopVersions.longitude,
      })
      .from(circuitStops)
      .innerJoin(circuitStopVersions, eq(circuitStopVersions.stopId, circuitStops.id))
      .where(
        and(
          eq(circuitStops.circuitId, circuitId),
          or(isNull(circuitStops.retiredAt), gt(circuitStops.retiredAt, instante)),
          lte(circuitStopVersions.validFrom, instante),
          or(isNull(circuitStopVersions.validTo), gt(circuitStopVersions.validTo, instante)),
        ),
      )
      .orderBy(circuitStopVersions.orden);
  }

  /** Toda la historia de una parada, para poder explicar por qué se movió. */
  async getStopHistory(stopId: string) {
    return this.db
      .select()
      .from(circuitStopVersions)
      .where(eq(circuitStopVersions.stopId, stopId))
      .orderBy(circuitStopVersions.validFrom);
  }

  async createStop(datos: {
    circuitId: string;
    qrSlug: string;
    name: string;
    orden: number;
    latitude: number;
    longitude: number;
    sentido?: "ida" | "vuelta" | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [identidad] = await tx
        .insert(circuitStops)
        .values({ circuitId: datos.circuitId, qrSlug: datos.qrSlug })
        .returning();
      const [version] = await tx
        .insert(circuitStopVersions)
        .values({
          stopId: identidad.id,
          name: datos.name,
          orden: datos.orden,
          latitude: datos.latitude,
          longitude: datos.longitude,
          sentido: datos.sentido ?? null,
        })
        .returning();
      return { identidad, version };
    });
  }

  /**
   * Mover o renombrar una parada. **No sobrescribe:** cierra la versión vigente
   * y abre una nueva, las dos en la misma transacción. El QR no se toca — el
   * letrero sigue en su poste.
   */
  async reviseStop(
    stopId: string,
    cambios: {
      name?: string;
      orden?: number;
      latitude?: number;
      longitude?: number;
      sentido?: "ida" | "vuelta" | null;
      motivo?: string | null;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [vigente] = await tx
        .select()
        .from(circuitStopVersions)
        .where(and(eq(circuitStopVersions.stopId, stopId), isNull(circuitStopVersions.validTo)));
      if (!vigente) return null;

      const ahora = new Date();
      await tx
        .update(circuitStopVersions)
        .set({ validTo: ahora })
        .where(eq(circuitStopVersions.id, vigente.id));

      const [nueva] = await tx
        .insert(circuitStopVersions)
        .values({
          stopId,
          name: cambios.name ?? vigente.name,
          orden: cambios.orden ?? vigente.orden,
          latitude: cambios.latitude ?? vigente.latitude,
          longitude: cambios.longitude ?? vigente.longitude,
          sentido: cambios.sentido === undefined ? vigente.sentido : cambios.sentido,
          motivo: cambios.motivo ?? null,
          validFrom: ahora,
        })
        .returning();
      return nueva;
    });
  }

  /** Retirar no borra: deja de publicarse y su historia se conserva. */
  async retireStop(stopId: string, motivo?: string) {
    return this.db.transaction(async (tx) => {
      const ahora = new Date();
      await tx
        .update(circuitStopVersions)
        .set({ validTo: ahora, motivo: motivo ?? null })
        .where(and(eq(circuitStopVersions.stopId, stopId), isNull(circuitStopVersions.validTo)));
      const [fila] = await tx
        .update(circuitStops)
        .set({ retiredAt: ahora })
        .where(eq(circuitStops.id, stopId))
        .returning();
      return fila ?? null;
    });
  }

  /** Unidades asignadas y vigentes de un circuito: el filtro de qué se publica. */
  async listActiveAssignments(circuitId: string) {
    return this.db
      .select()
      .from(circuitUnitAssignments)
      .where(
        and(eq(circuitUnitAssignments.circuitId, circuitId), isNull(circuitUnitAssignments.validTo)),
      );
  }

  /**
   * Las asignaciones de un circuito: las vigentes **y las terminadas**.
   *
   * La historia no es un extra de esta lista, es la mitad del punto. Una
   * asignación cerrada con su motivo —«se fue a maquila»— es lo que vuelve
   * explicable la operación de la concesión meses después. Mostrar solo lo
   * vigente dejaría a quien mira sin saber si una unidad se retiró o si nunca
   * estuvo.
   *
   * Las vigentes primero y, dentro de cada grupo, lo más reciente arriba.
   */
  async listAssignments(circuitId: string) {
    return this.db
      .select({
        id: circuitUnitAssignments.id,
        unitId: circuitUnitAssignments.unitId,
        unitLabel: units.label,
        plateNumber: units.plateNumber,
        carrierAccountId: circuitUnitAssignments.carrierAccountId,
        carrierName: accounts.name,
        validFrom: circuitUnitAssignments.validFrom,
        validTo: circuitUnitAssignments.validTo,
        motivo: circuitUnitAssignments.motivo,
        // Quién abrió y quién cerró cada asignación (0048). Null en las de antes de firmar.
        asignadaPor: circuitUnitAssignments.asignadaPor,
        cerradaPor: circuitUnitAssignments.cerradaPor,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(accounts, eq(accounts.id, circuitUnitAssignments.carrierAccountId))
      .where(eq(circuitUnitAssignments.circuitId, circuitId))
      .orderBy(desc(circuitUnitAssignments.validFrom));
  }

  /**
   * Las asignaciones de un circuito **que ve esta cuenta**: las de sus propias
   * unidades, vigentes y terminadas — la versión con muro de `listAssignments`.
   *
   * `listAssignments` entrega las de todos los carriers del circuito y sirve a
   * J-Staff. Aquí van las mismas dos cerraduras que en los pasos (#472) y que en
   * `soltarAsignacionDeCuenta`: la asignación la hizo esta cuenta **y** la
   * unidad es suya. En un circuito compartido, las unidades del otro carrier no
   * existen para ésta (9.14: su negocio nunca cruza).
   *
   * La historia viene completa por lo mismo que en J-Staff: una asignación
   * cerrada con su motivo y su autor explica meses después por qué un camión
   * dejó de correr aquí.
   */
  async listAsignacionesDeCuenta(cuentaId: string, circuitId: string) {
    return this.db
      .select({
        id: circuitUnitAssignments.id,
        unitId: circuitUnitAssignments.unitId,
        unitLabel: units.label,
        plateNumber: units.plateNumber,
        validFrom: circuitUnitAssignments.validFrom,
        validTo: circuitUnitAssignments.validTo,
        motivo: circuitUnitAssignments.motivo,
        asignadaPor: circuitUnitAssignments.asignadaPor,
        cerradaPor: circuitUnitAssignments.cerradaPor,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .where(
        and(
          eq(circuitUnitAssignments.circuitId, circuitId),
          eq(circuitUnitAssignments.carrierAccountId, cuentaId),
          eq(units.carrierAccountId, cuentaId),
        ),
      )
      .orderBy(desc(circuitUnitAssignments.validFrom));
  }

  /**
   * Qué unidades se pueden asignar a un circuito, y cuál viene ocupada.
   *
   * El universo son las unidades activas de los carriers ligados a la concesión
   * por un `concession_carriers` **vigente**: quién puede correr un circuito lo
   * dice esa relación, no una lista de toda la flota del sistema.
   *
   * Cada renglón trae la asignación abierta que ya tenga, si tiene, para que la
   * pantalla pueda avisar ANTES de moverla. Reasignar en silencio una unidad
   * que estaba corriendo otro circuito es exactamente lo que no queremos.
   */
  async listUnidadesAsignables(concessionAccountId: string) {
    const vigente = this.db
      .select({
        unitId: circuitUnitAssignments.unitId,
        circuitId: circuitUnitAssignments.circuitId,
        assignmentId: circuitUnitAssignments.id,
        validFrom: circuitUnitAssignments.validFrom,
      })
      .from(circuitUnitAssignments)
      .where(isNull(circuitUnitAssignments.validTo))
      .as("vigente");

    return this.db
      .select({
        unitId: units.id,
        label: units.label,
        plateNumber: units.plateNumber,
        carrierAccountId: units.carrierAccountId,
        carrierName: accounts.name,
        // Null cuando la unidad está libre. Cuando no, es el circuito que
        // dejaría de correr si se asigna aquí. El nombre viaja junto al id
        // porque la pantalla tiene que poder decir CUÁL, no solo que hay uno.
        ocupadaEnCircuitoId: vigente.circuitId,
        ocupadaEnCircuito: circuits.name,
        ocupadaDesde: vigente.validFrom,
      })
      .from(concessionCarriers)
      .innerJoin(units, eq(units.carrierAccountId, concessionCarriers.carrierAccountId))
      .innerJoin(accounts, eq(accounts.id, units.carrierAccountId))
      .leftJoin(vigente, eq(vigente.unitId, units.id))
      .leftJoin(circuits, eq(circuits.id, vigente.circuitId))
      .where(
        and(
          eq(concessionCarriers.concessionAccountId, concessionAccountId),
          isNull(concessionCarriers.validTo),
          eq(units.active, true),
        ),
      )
      .orderBy(units.label);
  }


  /**
   * Las unidades que **este carrier** puede asignar — su universo, y por eso
   * no hay filtro que alguien pueda borrar después.
   *
   * Es la hermana por carrier de `listUnidadesAsignables`, que va por concesión
   * y sirve a J-Staff. Las dos entregan la misma forma —con `ocupadaEn…` para
   * poder avisar qué se cerraría— y las dos existen porque **el universo es lo
   * que hace el muro**: una unidad ajena no se puede asignar aunque alguien
   * mande su id, porque no sale de aquí.
   *
   * Dos cerraduras, y las dos hacen falta:
   *
   *  1. **La unidad es suya** (`units.carrier_account_id`). Sin esto asignaría
   *     camiones de otro.
   *  2. **La concesión del circuito lo tiene ligado**, con un
   *     `concession_carriers` vigente. Sin esto podría meter sus camiones al
   *     circuito de cualquiera.
   *
   * La segunda se comprueba contra el circuito que se le pasa, no contra «algún
   * circuito»: un carrier ligado a la concesión A no asigna en la B.
   */
  async listUnidadesAsignablesDelCarrier(carrierAccountId: string, circuitId: string) {
    const vigente = this.db
      .select({
        unitId: circuitUnitAssignments.unitId,
        circuitId: circuitUnitAssignments.circuitId,
        validFrom: circuitUnitAssignments.validFrom,
      })
      .from(circuitUnitAssignments)
      .where(isNull(circuitUnitAssignments.validTo))
      .as("vigente");

    return this.db
      .select({
        unitId: units.id,
        label: units.label,
        plateNumber: units.plateNumber,
        carrierAccountId: units.carrierAccountId,
        /*
         * Qué circuito dejaría de correr si se asigna aquí. Viaja el nombre y
         * no sólo el id porque la pantalla tiene que poder decir CUÁL **antes**
         * de confirmar: el candado de una-sola-vigente es global, así que esto
         * puede estar jalando el camión de un circuito de OTRA concesión, y eso
         * no puede ocurrir callado (decisión de ASAV, 21-sep).
         */
        ocupadaEnCircuitoId: vigente.circuitId,
        ocupadaEnCircuito: circuits.name,
        ocupadaDesde: vigente.validFrom,
      })
      .from(units)
      .leftJoin(vigente, eq(vigente.unitId, units.id))
      .leftJoin(circuits, eq(circuits.id, vigente.circuitId))
      .where(
        and(
          eq(units.carrierAccountId, carrierAccountId),
          eq(units.active, true),
          sql`EXISTS (
            SELECT 1 FROM ${circuits}
            INNER JOIN ${concessionCarriers}
              ON ${concessionCarriers.concessionAccountId} = ${circuits.concessionAccountId}
            WHERE ${circuits.id} = ${circuitId}
              AND ${concessionCarriers.carrierAccountId} = ${carrierAccountId}
              AND ${concessionCarriers.validTo} IS NULL
          )`,
        ),
      )
      .orderBy(units.label);
  }

  /**
   * Suelta una asignación, **para una cuenta** — la versión con muro de
   * `endAssignment`.
   *
   * `endAssignment` recibe un id y no comprueba nada, y hasta hoy daba igual
   * porque sólo la llamaba J-Staff. En cuanto un carrier puede soltar, **ésa es
   * la puerta por la que suelta la unidad de otro** con sólo adivinar un uuid:
   * los identificadores no son un secreto, y un muro que depende de que nadie
   * teclee el id correcto no es un muro.
   *
   * Las dos cerraduras van en el `WHERE`, juntas con `AND`, y las dos hacen
   * falta por la misma razón que en el #472: nada en la base obliga a que la
   * cuenta de la asignación y la de la unidad coincidan. Hoy coinciden por
   * convención, y una fila que no cuadra no le abre nada a nadie.
   *
   * Devuelve `null` cuando no le toca — indistinguible de una asignación que no
   * existe o que ya estaba cerrada, que es justo el punto.
   */
  async soltarAsignacionDeCuenta(
    cuentaId: string,
    circuitId: string,
    assignmentId: string,
    motivo?: string,
    cerradaPor?: string | null,
  ) {
    const [fila] = await this.db
      .update(circuitUnitAssignments)
      .set({ validTo: new Date(), motivo: motivo?.trim() || null, cerradaPor: cerradaPor ?? null })
      .where(
        and(
          eq(circuitUnitAssignments.id, assignmentId),
          // El circuito de la pantalla: soltar desde Ver ‹A› no cierra nada de B.
          eq(circuitUnitAssignments.circuitId, circuitId),
          isNull(circuitUnitAssignments.validTo),
          eq(circuitUnitAssignments.carrierAccountId, cuentaId),
          sql`EXISTS (
            SELECT 1 FROM ${units}
            WHERE ${units.id} = ${circuitUnitAssignments.unitId}
              AND ${units.carrierAccountId} = ${cuentaId}
          )`,
        ),
      )
      .returning();
    return fila ?? null;
  }

  /**
   * Asigna una unidad a un circuito. **No pisa: cierra y abre.**
   *
   * Si la unidad venía corriendo otro circuito —o el mismo—, esa asignación se
   * cierra con su hora y su motivo, y se abre una nueva. El pasado no se
   * reescribe: queda la fila anterior con su `validFrom` intacto.
   *
   * El orden dentro de la transacción no es cosmético. `circuit_unit_assignments_una_vigente`
   * prohíbe dos filas abiertas de la misma unidad, así que insertar antes de
   * cerrar revienta contra el candado. Cerrar primero, insertar después.
   *
   * Devuelve también **la que cerró**, para que la pantalla lo diga en voz alta
   * en vez de que el cambio ocurra callado.
   */
  async assignUnit(datos: {
    circuitId: string;
    unitId: string;
    carrierAccountId: string;
    motivoDelCierre?: string | null;
    /**
     * Quién asigna (id de usuario, 0048). Firma la fila que abre **y** la que
     * cierra, si cierra una: quien jala un camión de otro circuito es quien lo
     * sacó de ahí.
     */
    actorId?: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const ahora = new Date();
      const actor = datos.actorId ?? null;
      const [cerrada] = await tx
        .update(circuitUnitAssignments)
        .set({ validTo: ahora, motivo: datos.motivoDelCierre ?? null, cerradaPor: actor })
        .where(
          and(
            eq(circuitUnitAssignments.unitId, datos.unitId),
            isNull(circuitUnitAssignments.validTo),
          ),
        )
        .returning();

      const [abierta] = await tx
        .insert(circuitUnitAssignments)
        .values({
          circuitId: datos.circuitId,
          unitId: datos.unitId,
          carrierAccountId: datos.carrierAccountId,
          validFrom: ahora,
          asignadaPor: actor,
        })
        .returning();

      return { abierta, cerrada: cerrada ?? null };
    });
  }

  /**
   * Termina una asignación: la unidad deja de publicarse, su historia se queda.
   *
   * No borra, igual que retirar una parada no borra. El `motivo` es el que
   * escribió quien la cerró — «se fue a maquila», «entró a taller»—, y es lo
   * único de esta fila que un humano no puede reconstruir después.
   *
   * **Sin muro: sólo para J-Staff.** Recibe un id y no comprueba de quién es.
   * El carrier suelta por `soltarAsignacionDeCuenta`, y una valla vigila que
   * ninguna ruta fuera de `/api/jstaff/` llame a ésta.
   */
  async endAssignment(assignmentId: string, motivo?: string, cerradaPor?: string | null) {
    const [fila] = await this.db
      .update(circuitUnitAssignments)
      .set({ validTo: new Date(), motivo: motivo?.trim() || null, cerradaPor: cerradaPor ?? null })
      .where(
        and(eq(circuitUnitAssignments.id, assignmentId), isNull(circuitUnitAssignments.validTo)),
      )
      .returning();
    return fila ?? null;
  }

  // ── La promesa por franja horaria (Marco 9.1c, 0044) ─────────────────────

  /**
   * La historia de la promesa: cada versión con su vigencia, su motivo de
   * cierre y cuántas franjas traía, de la más reciente a la más vieja. Para que
   * el expediente enseñe desde cuándo vale lo que vale y por qué cambió — la
   * promesa se versiona, nunca se corrige encima (decisión 1 de Asav, 20-sep).
   */
  async listPromiseTables(circuitId: string) {
    return this.db
      .select({
        id: circuitPromiseTables.id,
        validFrom: circuitPromiseTables.validFrom,
        validTo: circuitPromiseTables.validTo,
        motivo: circuitPromiseTables.motivo,
        capturadaPor: circuitPromiseTables.capturadaPor,
        /*
         * Nombres escritos a mano: dentro de la proyección Drizzle quita el
         * nombre de la tabla, y `id` se resolvería CALLADO al id de la franja
         * — un conteo equivocado sin error (la trampa del #477).
         */
        franjas: sql<number>`(SELECT count(*)::int FROM circuit_promise_bands b WHERE b.promise_table_id = circuit_promise_tables.id)`,
      })
      .from(circuitPromiseTables)
      .where(eq(circuitPromiseTables.circuitId, circuitId))
      .orderBy(desc(circuitPromiseTables.validFrom));
  }

  /**
   * Las franjas vigentes de TODOS los circuitos, para la lista de J-Staff. Una
   * fila por franja; una promesa vigente sin franjas sale como una fila con
   * `diaTipo` nulo, para que la lista distinga «promesa vacía» de «nunca
   * capturada» — son dos respuestas distintas.
   */
  async listFranjasVigentesDeTodos() {
    return this.db
      .select({
        circuitId: circuitPromiseTables.circuitId,
        diaTipo: circuitPromiseBands.diaTipo,
        sentido: circuitPromiseBands.sentido,
        desdeLocal: circuitPromiseBands.desdeLocal,
        hastaLocal: circuitPromiseBands.hastaLocal,
        frequencyMinutes: circuitPromiseBands.frequencyMinutes,
      })
      .from(circuitPromiseTables)
      .leftJoin(circuitPromiseBands, eq(circuitPromiseBands.promiseTableId, circuitPromiseTables.id))
      .where(isNull(circuitPromiseTables.validTo));
  }

  /** La promesa vigente de un circuito, con sus franjas — `null` si nunca se capturó ninguna. */
  async getPromiseTableVigente(circuitId: string) {
    const [tabla] = await this.db
      .select()
      .from(circuitPromiseTables)
      .where(
        and(eq(circuitPromiseTables.circuitId, circuitId), isNull(circuitPromiseTables.validTo)),
      );
    if (!tabla) return null;
    const bandas = await this.db
      .select()
      .from(circuitPromiseBands)
      .where(eq(circuitPromiseBands.promiseTableId, tabla.id))
      .orderBy(circuitPromiseBands.diaTipo, circuitPromiseBands.desdeLocal);
    return { tabla, bandas };
  }

  /**
   * La promesa vigente EN UN INSTANTE — para juzgar un paso de hace tres
   * semanas contra lo que se prometía entonces, no contra la de hoy (9.1c).
   * Misma forma que `resolveUnitAtTime`: `validFrom <= instante <= validTo`.
   */
  async getPromiseTableAt(circuitId: string, instante: Date) {
    const [tabla] = await this.db
      .select()
      .from(circuitPromiseTables)
      .where(
        and(
          eq(circuitPromiseTables.circuitId, circuitId),
          lte(circuitPromiseTables.validFrom, instante),
          or(isNull(circuitPromiseTables.validTo), gte(circuitPromiseTables.validTo, instante)),
        ),
      );
    if (!tabla) return null;
    const bandas = await this.db
      .select()
      .from(circuitPromiseBands)
      .where(eq(circuitPromiseBands.promiseTableId, tabla.id));
    return { tabla, bandas };
  }

  /**
   * La promesa para un instante concreto, en una zona y un sentido — o la
   * declaración honesta de que ninguna franja lo cubre (decisión 3 de Asav:
   * un hueco del horario no se rellena con la franja vecina).
   *
   * Junta `getPromiseTableAt` (qué versión valía entonces) con
   * `promesaEnInstante` (qué franja de esa versión cubre la hora). **No
   * comprueba el horario de servicio** — eso es del eslabón 2, que ya sabe si
   * la unidad iba en horario antes de preguntar por la promesa.
   */
  async getPromesaEnInstante(
    circuitId: string,
    instante: Date,
    sentido: "ida" | "vuelta",
    zona: string,
  ): Promise<PromesaEnInstante> {
    const promesa = await this.getPromiseTableAt(circuitId, instante);
    if (!promesa) return { declarada: false };
    return promesaEnInstante(
      promesa.bandas.map((b) => ({
        diaTipo: b.diaTipo,
        sentido: b.sentido,
        desdeLocal: b.desdeLocal,
        hastaLocal: b.hastaLocal,
        frequencyMinutes: b.frequencyMinutes,
      })),
      { diaTipo: tipoDeDiaLocal(instante, zona), horaLocal: localTimeHHMM(instante, zona), sentido },
    );
  }

  /**
   * Guarda una promesa nueva COMPLETA: cierra la vigente (si hay) y abre otra
   * con todas sus franjas. **Nunca corrige una sola franja de la vigente** —
   * es la decisión 1 de Asav: la promesa se lee como conjunto, y versionar el
   * renglón permitiría una promesa Frankenstein mezclando dos versiones.
   *
   * **TODO O NADA.** Si una sola franja cae fuera del horario de servicio del
   * circuito, o se encima con otra (`validarFranjas`, en `@jtel/domain`), NO
   * SE GUARDA NADA: se devuelven las rechazadas para que la pantalla las
   * enseñe y quien captura corrija el conjunto entero. Guardar las válidas y
   * callar las demás sería la mitad de una promesa que nadie declaró así, y
   * es justo lo que la decisión 3 de Asav prohíbe — "nunca se ignora en
   * silencio". Esta elección de todo-o-nada es mía, no palabra textual de
   * Asav: la alternativa —guardar lo válido y avisar aparte de lo rechazado—
   * es defendible, y si la prefiere se cambia aquí, en un solo lugar.
   */
  async savePromiseTable(
    circuitId: string,
    franjas: FranjaCapturada[],
    opts: { motivo?: string; capturadaPor?: string | null } = {},
  ): Promise<{ ok: true; tableId: string } | { ok: false; rechazadas: FranjaRechazada[] }> {
    const [circuito] = await this.db
      .select({ inicio: circuits.serviceStartLocal, fin: circuits.serviceEndLocal })
      .from(circuits)
      .where(eq(circuits.id, circuitId));
    if (!circuito) throw new Error(`No existe el circuito ${circuitId}`);

    const { validas, rechazadas } = validarFranjas(franjas, {
      inicioLocal: circuito.inicio,
      finLocal: circuito.fin,
    });
    if (rechazadas.length > 0) return { ok: false, rechazadas };

    const tableId = await this.db.transaction(async (tx) => {
      const ahora = new Date();
      // Por qué TERMINÓ la vigente — se escribe al cerrar, igual que paradas
      // y asignaciones. Sin vigente previa (primera captura), no hay nada que
      // este UPDATE toque, y eso está bien.
      await tx
        .update(circuitPromiseTables)
        .set({ validTo: ahora, motivo: opts.motivo?.trim() || null })
        .where(
          and(eq(circuitPromiseTables.circuitId, circuitId), isNull(circuitPromiseTables.validTo)),
        );

      const [nueva] = await tx
        .insert(circuitPromiseTables)
        .values({ circuitId, validFrom: ahora, capturadaPor: opts.capturadaPor ?? null })
        .returning();
      if (!nueva) throw new Error("No se pudo crear la nueva versión de la promesa.");

      if (validas.length > 0) {
        await tx.insert(circuitPromiseBands).values(
          validas.map((f) => ({
            promiseTableId: nueva.id,
            diaTipo: f.diaTipo,
            sentido: f.sentido,
            desdeLocal: f.desdeLocal,
            hastaLocal: f.hastaLocal,
            frequencyMinutes: f.frequencyMinutes,
          })),
        );
      }
      return nueva.id;
    });

    return { ok: true, tableId };
  }
}

// ── El expediente: la familia de documentos (0038) ───────────────────────

/** Quién escribe. Mismo par que las historias de turno y de política. */
export interface ActorDelExpediente {
  kind: string;
  id: string | null;
  nota?: string | null;
}

export type SujetoDeFoja = { unidadId: string } | { choferId: string };

export interface DatosDeFoja {
  folio: string | null;
  emitidoEl: string | null;
  /** La fecha impresa en el papel. Si falta, se calcula con la regla cuando se puede. */
  venceElImpreso: string | null;
}

/** El papel no es del mercado de la cuenta, o no es de ese tipo de sujeto. */
export class FojaFueraDeCatalogo extends Error {}

/** Una transacción abierta: lo que recibe una escritura que va dentro de otra. */
type Transaccion = Parameters<Parameters<Database["transaction"]>[0]>[0];

function reglaDeFila(
  r: { required: boolean | null; expires: boolean | null; warningDays: number | null; periodicityMonths: number | null } | undefined,
): ReglaDeTipo | null {
  if (!r) return null;
  return {
    obligatorio: r.required,
    vence: r.expires,
    diasDeAviso: r.warningDays,
    periodicidadMeses: r.periodicityMonths,
  };
}

/**
 * Lecturas y escrituras de la familia de documentos, y las lecturas del
 * expediente que no tenían dueño.
 *
 * **Nada de aquí edita en sitio**: las reglas, las fojas y sus versiones sólo se
 * agregan, y la base rechaza el UPDATE (0038). Corregir es agregar una versión;
 * renovar es capturar una foja nueva.
 *
 * **El muro entre cuentas se revisa dos veces.** Aquí, para dar un error que se
 * entienda; y en la base, con la llave compuesta, para que un guion que se salte
 * esta clase tampoco pueda cruzarlo.
 */
export class ExpedienteRepository {
  constructor(private db: Database) {}

  // ── Mercados ──

  async mercadoDeCuenta(carrierAccountId: string) {
    const [fila] = await this.db
      .select({
        id: markets.id,
        name: markets.name,
        countryCode: markets.countryCode,
        stateCode: markets.stateCode,
        municipality: markets.municipality,
        timeZone: markets.timeZone,
      })
      .from(accounts)
      .innerJoin(markets, eq(markets.id, accounts.marketId))
      .where(eq(accounts.id, carrierAccountId));
    return fila ?? null;
  }

  async mercadoPorLugar(countryCode: string, stateCode: string, municipality: string | null) {
    const [fila] = await this.db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.countryCode, countryCode),
          eq(markets.stateCode, stateCode),
          municipality === null ? isNull(markets.municipality) : eq(markets.municipality, municipality),
        ),
      );
    return fila ?? null;
  }

  /** Sólo una cuenta de carrier puede tener mercado: la base lo sostiene con un CHECK. */
  async asignarMercado(carrierAccountId: string, marketId: string | null) {
    await this.db.update(accounts).set({ marketId, updatedAt: new Date() }).where(eq(accounts.id, carrierAccountId));
  }

  // ── El catálogo ──

  /** Los tipos de un mercado para un sujeto, cada uno con su regla vigente o `null`. */
  async catalogo(marketId: string, subject: "unidad" | "chofer") {
    const tipos = await this.db
      .select()
      .from(documentTypes)
      .where(and(eq(documentTypes.marketId, marketId), eq(documentTypes.subject, subject)))
      .orderBy(documentTypes.createdAt, documentTypes.clave);
    if (tipos.length === 0) return [];

    const reglas = await this.db
      .selectDistinctOn([documentTypeRules.documentTypeId])
      .from(documentTypeRules)
      .where(inArray(documentTypeRules.documentTypeId, tipos.map((t) => t.id)))
      .orderBy(documentTypeRules.documentTypeId, desc(documentTypeRules.createdAt), desc(documentTypeRules.id));
    const reglaPorTipo = new Map(reglas.map((r) => [r.documentTypeId, r]));

    return tipos.map((tipo) => {
      const fila = reglaPorTipo.get(tipo.id);
      return {
        tipo,
        regla: reglaDeFila(fila),
        reglaVersion: fila ? { id: fila.id, createdAt: fila.createdAt, actorKind: fila.actorKind, actorId: fila.actorId } : null,
      };
    });
  }

  async reglaVigente(documentTypeId: string): Promise<ReglaDeTipo | null> {
    const [fila] = await this.db
      .select()
      .from(documentTypeRules)
      .where(eq(documentTypeRules.documentTypeId, documentTypeId))
      .orderBy(desc(documentTypeRules.createdAt), desc(documentTypeRules.id))
      .limit(1);
    return reglaDeFila(fila);
  }

  /** Cambiar una regla agrega una versión con su autor. La anterior se queda. */
  async agregarVersionDeRegla(documentTypeId: string, regla: ReglaDeTipo, actor: ActorDelExpediente) {
    const [fila] = await this.db
      .insert(documentTypeRules)
      .values({
        documentTypeId,
        required: regla.obligatorio,
        expires: regla.vence,
        warningDays: regla.diasDeAviso,
        periodicityMonths: regla.periodicidadMeses,
        actorKind: actor.kind,
        actorId: actor.id,
        note: actor.nota ?? null,
      })
      .returning();
    return fila!;
  }

  async historialDeRegla(documentTypeId: string) {
    return this.db
      .select()
      .from(documentTypeRules)
      .where(eq(documentTypeRules.documentTypeId, documentTypeId))
      .orderBy(desc(documentTypeRules.createdAt), desc(documentTypeRules.id));
  }

  // ── Las fojas ──

  /**
   * Captura un papel: una foja nueva con su primera versión. Renovar es esto
   * mismo; la foja anterior queda en el historial.
   *
   * La fecha de vencimiento la decide `fechaDeVencimientoAGuardar`: la impresa
   * gana, y sin ella se calcula con la regla vigente cuando se puede.
   */
  async capturarFoja(entrada: {
    carrierAccountId: string;
    documentTypeId: string;
    sujeto: SujetoDeFoja;
    datos: DatosDeFoja;
    actor: ActorDelExpediente;
  }) {
    return this.db.transaction((tx) => this.capturarFojaEn(tx, entrada));
  }

  /**
   * La captura de una foja dentro de una transacción ajena. La usa el alta del
   * chofer: el chofer, sus credenciales y su «Licencia» nacen juntos o no nacen
   * (Choferes V1, enmienda 2).
   */
  private async capturarFojaEn(
    tx: Transaccion,
    entrada: {
      carrierAccountId: string;
      documentTypeId: string;
      sujeto: SujetoDeFoja;
      datos: DatosDeFoja;
      actor: ActorDelExpediente;
    },
  ) {
    const { carrierAccountId, documentTypeId, sujeto, datos, actor } = entrada;
    {
      const [tipo] = await tx.select().from(documentTypes).where(eq(documentTypes.id, documentTypeId));
      const [cuenta] = await tx
        .select({ marketId: accounts.marketId })
        .from(accounts)
        .where(eq(accounts.id, carrierAccountId));
      if (!tipo || !cuenta) throw new FojaFueraDeCatalogo("El tipo de papel o la cuenta no existen.");
      if (cuenta.marketId !== tipo.marketId) {
        throw new FojaFueraDeCatalogo("El tipo de papel no es del mercado de la cuenta.");
      }
      const esDeUnidad = "unidadId" in sujeto;
      if (tipo.subject !== (esDeUnidad ? "unidad" : "chofer")) {
        throw new FojaFueraDeCatalogo(`El tipo «${tipo.name}» es de ${tipo.subject}, no de ${esDeUnidad ? "unidad" : "chofer"}.`);
      }

      const [reglaFila] = await tx
        .select()
        .from(documentTypeRules)
        .where(eq(documentTypeRules.documentTypeId, documentTypeId))
        .orderBy(desc(documentTypeRules.createdAt), desc(documentTypeRules.id))
        .limit(1);
      const fecha = fechaDeVencimientoAGuardar({
        venceElImpreso: datos.venceElImpreso,
        emitidoEl: datos.emitidoEl,
        regla: reglaDeFila(reglaFila),
      });

      const [documento] = await tx
        .insert(documents)
        .values({
          carrierAccountId,
          documentTypeId,
          unitId: esDeUnidad ? sujeto.unidadId : null,
          driverId: esDeUnidad ? null : sujeto.choferId,
          actorKind: actor.kind,
          actorId: actor.id,
        })
        .returning();
      const [version] = await tx
        .insert(documentVersions)
        .values({
          documentId: documento!.id,
          folio: datos.folio,
          issuedOn: datos.emitidoEl,
          expiresOn: fecha.venceEl,
          expiryCalculated: fecha.calculado,
          actorKind: actor.kind,
          actorId: actor.id,
          note: actor.nota ?? null,
        })
        .returning();
      return { documento: documento!, version: version! };
    }
  }

  /**
   * Corrige una foja: una versión nueva. La anterior queda con su autor.
   * Devuelve `null` si la foja no es de esta cuenta — no hay forma de saber que
   * existe desde otra.
   */
  async corregirFoja(entrada: {
    carrierAccountId: string;
    documentId: string;
    datos: DatosDeFoja;
    actor: ActorDelExpediente;
  }) {
    const { carrierAccountId, documentId, datos, actor } = entrada;
    return this.db.transaction(async (tx) => {
      const [documento] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.carrierAccountId, carrierAccountId)));
      if (!documento) return null;
      const [reglaFila] = await tx
        .select()
        .from(documentTypeRules)
        .where(eq(documentTypeRules.documentTypeId, documento.documentTypeId))
        .orderBy(desc(documentTypeRules.createdAt), desc(documentTypeRules.id))
        .limit(1);
      const fecha = fechaDeVencimientoAGuardar({
        venceElImpreso: datos.venceElImpreso,
        emitidoEl: datos.emitidoEl,
        regla: reglaDeFila(reglaFila),
      });
      const [version] = await tx
        .insert(documentVersions)
        .values({
          documentId,
          folio: datos.folio,
          issuedOn: datos.emitidoEl,
          expiresOn: fecha.venceEl,
          expiryCalculated: fecha.calculado,
          actorKind: actor.kind,
          actorId: actor.id,
          note: actor.nota ?? null,
        })
        .returning();
      return version!;
    });
  }

  /**
   * Todas las fojas de un sujeto, de la más reciente a la más vieja, cada una
   * con TODAS sus versiones (la vigente primero).
   *
   * La foja vigente de un tipo es la capturada más recientemente; las demás son
   * su historial. Filtra por cuenta: el sujeto de otra cuenta devuelve nada.
   */
  async fojasDeSujeto(carrierAccountId: string, sujeto: SujetoDeFoja) {
    const fojas = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.carrierAccountId, carrierAccountId),
          "unidadId" in sujeto ? eq(documents.unitId, sujeto.unidadId) : eq(documents.driverId, sujeto.choferId),
        ),
      )
      .orderBy(desc(documents.createdAt), desc(documents.id));
    if (fojas.length === 0) return [];

    const versiones = await this.db
      .select()
      .from(documentVersions)
      .where(inArray(documentVersions.documentId, fojas.map((f) => f.id)))
      .orderBy(desc(documentVersions.createdAt), desc(documentVersions.id));

    return fojas.map((foja) => ({
      foja,
      versiones: versiones.filter((v) => v.documentId === foja.id),
    }));
  }

  /**
   * Las fojas de TODAS las unidades de una cuenta, cada una con su versión
   * vigente. Es la lectura del cuarto: resumir 80 unidades de una pasada, en
   * vez de armar 80 expedientes.
   */
  async fojasVigentesDeUnidadesDeCuenta(carrierAccountId: string) {
    const fojas = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.carrierAccountId, carrierAccountId), isNotNull(documents.unitId)))
      .orderBy(desc(documents.createdAt), desc(documents.id));
    if (fojas.length === 0) return [];
    const versiones = await this.db
      .selectDistinctOn([documentVersions.documentId])
      .from(documentVersions)
      .where(inArray(documentVersions.documentId, fojas.map((f) => f.id)))
      .orderBy(documentVersions.documentId, desc(documentVersions.createdAt), desc(documentVersions.id));
    const vigentePorFoja = new Map(versiones.map((v) => [v.documentId, v]));
    return fojas.map((foja) => ({ foja, version: vigentePorFoja.get(foja.id)! }));
  }

  /**
   * Las fojas de TODOS los choferes de una cuenta, cada una con su versión
   * vigente. La lectura del cuarto, como la de unidades.
   */
  async fojasVigentesDeChoferesDeCuenta(carrierAccountId: string) {
    const fojas = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.carrierAccountId, carrierAccountId), isNotNull(documents.driverId)))
      .orderBy(desc(documents.createdAt), desc(documents.id));
    if (fojas.length === 0) return [];
    const versiones = await this.db
      .selectDistinctOn([documentVersions.documentId])
      .from(documentVersions)
      .where(inArray(documentVersions.documentId, fojas.map((f) => f.id)))
      .orderBy(documentVersions.documentId, desc(documentVersions.createdAt), desc(documentVersions.id));
    const vigentePorFoja = new Map(versiones.map((v) => [v.documentId, v]));
    return fojas.map((foja) => ({ foja, version: vigentePorFoja.get(foja.id)! }));
  }

  // ── Choferes: alta y corrección (Choferes V1, 0042) ──

  /**
   * El nombre y la licencia de los choferes **activos** de una cuenta —los que
   * tienen credenciales: la baja las purga—. Es contra lo que se revisa un alta
   * o una corrección antes de escribir, para decir el choque en palabras.
   */
  async identidadesDeChoferes(carrierAccountId: string) {
    return this.db
      .select({ id: driverCredentials.driverId, nombre: driverCredentials.fullName, licencia: driverCredentials.licenseNumber })
      .from(driverCredentials)
      .where(eq(driverCredentials.carrierAccountId, carrierAccountId));
  }

  /**
   * Da de alta un chofer: la Capa 1 (`drivers`, sin datos personales) y la
   * Capa 2 (sus credenciales, purgables), y —si su mercado tiene el papel— su
   * «Licencia» con el vencimiento. **Todo o nada**, en una transacción: un
   * chofer sin credenciales, o una licencia sin chofer, no deben existir.
   *
   * `license_expires_on` no se escribe: el vencimiento vive como papel, y el §4
   * de la ficha de Expedientes lo juzga en un solo lugar (enmienda 2).
   */
  async darDeAltaChofer(entrada: {
    carrierAccountId: string;
    nombre: string;
    licencia: string;
    papelDeLicencia: { documentTypeId: string; venceEl: string | null } | null;
    actor: ActorDelExpediente;
  }) {
    const { carrierAccountId, nombre, licencia, papelDeLicencia, actor } = entrada;
    return this.db.transaction(async (tx) => {
      const [chofer] = await tx.insert(drivers).values({ carrierAccountId }).returning();
      await tx.insert(driverCredentials).values({
        driverId: chofer!.id,
        carrierAccountId,
        fullName: nombre,
        licenseNumber: licencia,
      });
      if (papelDeLicencia) {
        await this.capturarFojaEn(tx, {
          carrierAccountId,
          documentTypeId: papelDeLicencia.documentTypeId,
          sujeto: { choferId: chofer!.id },
          datos: { folio: licencia, emitidoEl: null, venceElImpreso: papelDeLicencia.venceEl },
          actor,
        });
      }
      return chofer!;
    });
  }

  /**
   * Corrige el nombre o la licencia de un chofer. **Sobrescribe**, como la
   * unidad (C4-e): la bitácora de correcciones de identidad es pendiente con
   * nombre. Devuelve `null` si el chofer no es de esta cuenta o ya no tiene
   * credenciales.
   *
   * Si cambia el número y hay una «Licencia» vigente, su folio se corrige con
   * una versión nueva de la foja —las fechas se conservan—: el número está en
   * la identidad y es el folio del papel, y los dos no pueden decir cosas
   * distintas.
   */
  async corregirChofer(
    carrierAccountId: string,
    driverId: string,
    datos: { nombre: string; licencia: string },
    papelDeLicencia: { documentTypeId: string } | null,
    actor: ActorDelExpediente,
  ) {
    return this.db.transaction(async (tx) => {
      const [antes] = await tx
        .select({ licencia: driverCredentials.licenseNumber })
        .from(driverCredentials)
        .where(and(eq(driverCredentials.driverId, driverId), eq(driverCredentials.carrierAccountId, carrierAccountId)));
      if (!antes) return null;
      const [fila] = await tx
        .update(driverCredentials)
        .set({ fullName: datos.nombre, licenseNumber: datos.licencia, updatedAt: new Date() })
        .where(and(eq(driverCredentials.driverId, driverId), eq(driverCredentials.carrierAccountId, carrierAccountId)))
        .returning();
      if (papelDeLicencia && antes.licencia !== datos.licencia) {
        const [foja] = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(
            and(
              eq(documents.carrierAccountId, carrierAccountId),
              eq(documents.driverId, driverId),
              eq(documents.documentTypeId, papelDeLicencia.documentTypeId),
            ),
          )
          .orderBy(desc(documents.createdAt), desc(documents.id))
          .limit(1);
        if (foja) {
          const [vigente] = await tx
            .select()
            .from(documentVersions)
            .where(eq(documentVersions.documentId, foja.id))
            .orderBy(desc(documentVersions.createdAt), desc(documentVersions.id))
            .limit(1);
          await tx.insert(documentVersions).values({
            documentId: foja.id,
            folio: datos.licencia,
            issuedOn: vigente?.issuedOn ?? null,
            expiresOn: vigente?.expiresOn ?? null,
            expiryCalculated: vigente?.expiryCalculated ?? false,
            actorKind: actor.kind,
            actorId: actor.id,
            note: "Número corregido desde la identidad del chofer",
          });
        }
      }
      return fila ?? null;
    });
  }

  /**
   * Las unidades **de esta cuenta** que operó un chofer según el transportista:
   * el chofer declarado en cada servicio sellado (`compliance_facts`). Es la
   * fuente de «unidades que ha operado» (Choferes V1, enmienda 5). Declarado,
   * no medido (Plan-Choferes §1).
   */
  async unidadesDeChoferDeclarado(carrierAccountId: string, driverId: string) {
    return this.db
      .select({
        unitId: units.id,
        etiqueta: units.label,
        servicios: count(complianceFacts.id),
        ultimo: sql<Date>`max(${complianceFacts.expectedDeadline})`,
      })
      .from(complianceFacts)
      .innerJoin(units, eq(units.id, complianceFacts.observedUnitId))
      .where(and(eq(complianceFacts.declaredDriverId, driverId), eq(units.carrierAccountId, carrierAccountId)))
      .groupBy(units.id, units.label)
      .orderBy(desc(sql`max(${complianceFacts.expectedDeadline})`));
  }

  /** Los choferes de una cuenta, con su nombre si las credenciales no se han purgado. */
  async choferesDeCuenta(carrierAccountId: string) {
    return this.db
      .select({
        id: drivers.id,
        deactivatedAt: drivers.deactivatedAt,
        nombre: driverCredentials.fullName,
        licencia: driverCredentials.licenseNumber,
      })
      .from(drivers)
      .leftJoin(driverCredentials, eq(driverCredentials.driverId, drivers.id))
      .where(eq(drivers.carrierAccountId, carrierAccountId))
      .orderBy(driverCredentials.fullName);
  }

  // ── El catálogo, visto desde J-Staff (D2) ──

  /** Los mercados, con cuántas cuentas pertenecen a cada uno. */
  async mercados() {
    return this.db
      .select({
        id: markets.id,
        name: markets.name,
        countryCode: markets.countryCode,
        stateCode: markets.stateCode,
        municipality: markets.municipality,
        timeZone: markets.timeZone,
        // Nombres escritos a mano a propósito: dentro de una subconsulta, Drizzle
        // escribe las columnas sin su tabla, y «market_id = id» se leía contra
        // la misma `accounts` — contaba cero siempre.
        cuentas: sql<number>`(SELECT count(*)::int FROM accounts cta WHERE cta.market_id = "markets"."id")`,
      })
      .from(markets)
      .orderBy(markets.name);
  }

  /** Un tipo de papel con su mercado. */
  async tipoDeDocumento(documentTypeId: string) {
    const [fila] = await this.db
      .select({ tipo: documentTypes, mercado: markets })
      .from(documentTypes)
      .innerJoin(markets, eq(markets.id, documentTypes.marketId))
      .where(eq(documentTypes.id, documentTypeId));
    return fila ?? null;
  }

  /**
   * Lo que un tipo juzga en todo su mercado: cada unidad activa (o cada chofer
   * activo) de las cuentas del mercado, con su foja vigente de ese tipo y la
   * versión vigente de esa foja, o `null` si nunca se capturó.
   *
   * Es la lectura de «revisar el cambio»: la regla propuesta se aplica a esto
   * antes de guardarla.
   */
  async sujetosDelTipo(documentTypeId: string) {
    const fila = await this.tipoDeDocumento(documentTypeId);
    if (!fila) return null;
    const { tipo, mercado } = fila;

    const sujetos =
      tipo.subject === "unidad"
        ? await this.db
            .select({ id: units.id, cuenta: accounts.name, carrierAccountId: accounts.id })
            .from(units)
            .innerJoin(accounts, eq(accounts.id, units.carrierAccountId))
            .where(and(eq(accounts.marketId, mercado.id), eq(units.active, true)))
        : await this.db
            .select({ id: drivers.id, cuenta: accounts.name, carrierAccountId: accounts.id })
            .from(drivers)
            .innerJoin(accounts, eq(accounts.id, drivers.carrierAccountId))
            .where(and(eq(accounts.marketId, mercado.id), isNull(drivers.deactivatedAt)));

    const fojas = await this.db
      .select()
      .from(documents)
      .innerJoin(accounts, eq(accounts.id, documents.carrierAccountId))
      .where(and(eq(documents.documentTypeId, documentTypeId), eq(accounts.marketId, mercado.id)))
      .orderBy(desc(documents.createdAt), desc(documents.id));
    const vigentePorSujeto = new Map<string, string>();
    for (const f of fojas) {
      const sujeto = f.documents.unitId ?? f.documents.driverId;
      if (sujeto && !vigentePorSujeto.has(sujeto)) vigentePorSujeto.set(sujeto, f.documents.id);
    }
    const ids = [...vigentePorSujeto.values()];
    const versiones = ids.length
      ? await this.db
          .selectDistinctOn([documentVersions.documentId])
          .from(documentVersions)
          .where(inArray(documentVersions.documentId, ids))
          .orderBy(documentVersions.documentId, desc(documentVersions.createdAt), desc(documentVersions.id))
      : [];
    const versionPorFoja = new Map(versiones.map((v) => [v.documentId, v]));

    return {
      tipo,
      mercado,
      sujetos: sujetos.map((s) => {
        const fojaId = vigentePorSujeto.get(s.id);
        return { ...s, version: fojaId ? (versionPorFoja.get(fojaId) ?? null) : null };
      }),
    };
  }

  // ── Lecturas del expediente que no tenían dueño ──

  async unidadDeCuenta(carrierAccountId: string, unitId: string) {
    const [fila] = await this.db
      .select()
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.carrierAccountId, carrierAccountId)));
    return fila ?? null;
  }

  async dispositivoDeCuenta(carrierAccountId: string, deviceId: string) {
    const [fila] = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.carrierAccountId, carrierAccountId)));
    return fila ?? null;
  }

  /** El chofer con sus credenciales, si no se han purgado. */
  async choferDeCuenta(carrierAccountId: string, driverId: string) {
    const [fila] = await this.db
      .select({ chofer: drivers, credenciales: driverCredentials })
      .from(drivers)
      .leftJoin(driverCredentials, eq(driverCredentials.driverId, drivers.id))
      .where(and(eq(drivers.id, driverId), eq(drivers.carrierAccountId, carrierAccountId)));
    return fila ?? null;
  }

  /**
   * Las unidades **de esta cuenta** que ha traído un dispositivo, en orden de
   * instalación.
   *
   * La cuenta va en la consulta, no en quien llama. Un dispositivo que cambió
   * de cuenta (6.14) conserva sus asignaciones viejas, y esas unidades son de la
   * cuenta anterior: sin este filtro, la cuenta nueva veía sus números
   * económicos y sus fechas (Pieza 1.C, el muro entre cuentas; 17 sep 2026).
   */
  async asignacionesDeDispositivo(carrierAccountId: string, deviceId: string) {
    return this.db
      .select({
        unitId: units.id,
        etiqueta: units.label,
        desde: deviceAssignments.validFrom,
        hasta: deviceAssignments.validTo,
        // Quién y por qué (0039, C4). Lo anterior a la 0039 viene en null: no
        // quedó registrado, y la pantalla lo dice así.
        asignadaPor: deviceAssignments.asignadaPor,
        cerradaPor: deviceAssignments.cerradaPor,
        motivoCierre: deviceAssignments.motivoCierre,
      })
      .from(deviceAssignments)
      .innerJoin(units, eq(units.id, deviceAssignments.unitId))
      .where(and(eq(deviceAssignments.deviceId, deviceId), eq(units.carrierAccountId, carrierAccountId)))
      .orderBy(deviceAssignments.validFrom);
  }

  /** Las rutas × turnos de un chofer. Hoy nada escribe esta tabla. */
  async asignacionesDeChofer(driverId: string) {
    return this.db
      .select({
        routeShiftId: driverAssignments.routeShiftId,
        ruta: routes.name,
        turno: shifts.name,
        desde: driverAssignments.validFrom,
        hasta: driverAssignments.validTo,
      })
      .from(driverAssignments)
      .innerJoin(routeShifts, eq(routeShifts.id, driverAssignments.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(shifts, eq(shifts.id, routeShifts.shiftId))
      .where(eq(driverAssignments.driverId, driverId))
      .orderBy(driverAssignments.validFrom);
  }

  /**
   * ¿La cuenta tiene algún contrato que no sea borrador?
   *
   * Decide si la parte «servicios con veredicto» aplica: sin contrato, Vernier
   * no está encendido y la parte no se dibuja (mapa, regla 4).
   */
  async tieneContratoEncendido(carrierAccountId: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: serviceContracts.id })
      .from(serviceContracts)
      .where(and(eq(serviceContracts.carrierAccountId, carrierAccountId), ne(serviceContracts.status, "draft")))
      .limit(1);
    return Boolean(fila);
  }

  /**
   * ¿El carrier está ligado a algo que declare servicios? Un contrato de
   * especial que el árbitro sella (activo, cliente real) o una concesión de
   * circuito vigente.
   *
   * Decide si en el recorrido (C3) existe la sección «Servicios de esta
   * unidad»: sin ninguno de los dos, la sección no existe para él — ni vacía
   * ni con mensaje. Los filtros del contrato son los mismos que dan los botones
   * (`especialesDeUnidadQueEmpiezanEntre`), para que la sección no aparezca
   * donde ningún botón podría salir.
   */
  async ligadoAServiciosDeclarados(carrierAccountId: string, ahora: Date): Promise<boolean> {
    const [contrato] = await this.db
      .select({ id: serviceContracts.id })
      .from(serviceContracts)
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
        ),
      )
      .limit(1);
    if (contrato) return true;
    const [concesion] = await this.db
      .select({ id: concessionCarriers.id })
      .from(concessionCarriers)
      .where(
        and(
          eq(concessionCarriers.carrierAccountId, carrierAccountId),
          lte(concessionCarriers.validFrom, ahora),
          or(isNull(concessionCarriers.validTo), gt(concessionCarriers.validTo, ahora)),
        ),
      )
      .limit(1);
    return Boolean(concesion);
  }

  /**
   * Los servicios especiales de una unidad que **empiezan** entre dos
   * instantes, con el nombre del cliente y de la ruta — los botones de
   * «Servicios de esta unidad» del recorrido (C3, decisión 2).
   *
   * Las horas son las de `trips` de cada ocurrencia: lo declarado para ese día,
   * congelado al generarse, nunca el perfil vigente hoy. Un nocturno de 22:00 a
   * 06:00 sale en el día en que empieza, con su ventana de dos días.
   *
   * Mismos filtros que `especialesDeUnidadEnVentana` (contrato activo, cliente
   * real, unidad posible del perfil): el botón no puede ofrecer un servicio que
   * el corte de la traza no reconoce.
   */
  async especialesDeUnidadQueEmpiezanEntre(
    carrierAccountId: string,
    unitId: string,
    desde: Date,
    hasta: Date,
  ) {
    return this.db
      .select({
        ocurrenciaId: serviceOccurrences.id,
        cliente: accounts.name,
        ruta: routes.name,
        ventanaDesde: trips.evidenceWindowStart,
        ventanaHasta: trips.evidenceWindowEnd,
      })
      .from(serviceOccurrences)
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .innerJoin(accounts, eq(accounts.id, serviceContracts.clientAccountId))
      .innerJoin(routeShifts, eq(routeShifts.id, serviceOccurrences.routeShiftId))
      .innerJoin(routes, eq(routes.id, routeShifts.routeId))
      .innerJoin(
        serviceProfileUnits,
        eq(serviceProfileUnits.serviceProfileId, serviceOccurrences.serviceProfileId),
      )
      .where(
        and(
          eq(serviceContracts.carrierAccountId, carrierAccountId),
          eq(serviceProfileUnits.unitId, unitId),
          eq(serviceContracts.status, "active"),
          eq(accounts.isDemo, false),
          gte(serviceOccurrences.expectedDeadline, new Date(desde.getTime() - 24 * 3_600_000)),
          lte(serviceOccurrences.expectedDeadline, new Date(hasta.getTime() + 48 * 3_600_000)),
          gte(trips.evidenceWindowStart, desde),
          lte(trips.evidenceWindowStart, hasta),
        ),
      )
      .orderBy(trips.evidenceWindowStart);
  }

  /**
   * Los circuitos a los que la unidad estuvo asignada en algún momento entre
   * dos instantes, con el horario de servicio **que el circuito tiene hoy**.
   *
   * Ojo: la asignación tiene historia, el horario no — vive en columnas de
   * `circuits` que se sobrescriben. Quien llama decide para qué día sirve ese
   * horario; ver `serviciosDeUnidadEnDia`.
   */
  async circuitosDeUnidadEntre(
    carrierAccountId: string,
    unitId: string,
    desde: Date,
    hasta: Date,
  ) {
    return this.db
      .select({
        circuitoId: circuits.id,
        nombre: circuits.name,
        inicioLocal: circuits.serviceStartLocal,
        finLocal: circuits.serviceEndLocal,
        zona: circuits.timeZone,
      })
      .from(circuitUnitAssignments)
      .innerJoin(circuits, eq(circuits.id, circuitUnitAssignments.circuitId))
      .where(
        and(
          eq(circuitUnitAssignments.carrierAccountId, carrierAccountId),
          eq(circuitUnitAssignments.unitId, unitId),
          lte(circuitUnitAssignments.validFrom, hasta),
          or(isNull(circuitUnitAssignments.validTo), gt(circuitUnitAssignments.validTo, desde)),
        ),
      )
      .orderBy(circuits.name);
  }
}

/**
 * **El muro de lectura de los pasos por parada** (Enmiendas de la Pieza 9, 9.14):
 * qué filas de `circuit_stop_passes` puede leer una cuenta. Es la ÚNICA puerta —
 * todo método que lea esa tabla la cruza con esto, y
 * `guardia-muro-cuenta.test.ts` lo exige y vigila que no se afloje una cerradura.
 *
 * La tabla no lleva columna de cuenta: la cuenta se deriva de los dos dueños que
 * sí existen, el del circuito y el de la unidad.
 *
 *  - **La concesión dueña del circuito** ve todos los pasos de él.
 *  - **Un carrier** ve los pasos de **sus** unidades y nada más — nunca las de
 *    otro carrier en el mismo circuito. Con dos cerraduras: la unidad es suya
 *    (`units.carrier_account_id`) **y** él mismo la asignó a ESE circuito
 *    (`circuit_unit_assignments.carrier_account_id`), en cualquier momento —el
 *    historial de sus unidades es suyo—, no sólo la asignación vigente. Nada en
 *    la base obliga a que las dos cuentas coincidan; una fila que no cuadra no se
 *    la abre a ningún carrier, sólo a la concesión.
 *  - **Cualquier otra cuenta** —cliente, J-Staff, un carrier sin unidades ahí,
 *    otra concesión— no cumple ninguna rama: lista vacía, igual que si no
 *    hubiera pasos.
 *
 * Es un fragmento SQL sin depender de los joins de quien lo usa: se lee igual en
 * cualquier consulta sobre `circuit_stop_passes`. Falla hacia cerrado — sin
 * cuenta que coincida no devuelve nada, y una cuenta mal escrita revienta en
 * vez de abrir.
 *
 * **La medición contra el flujo de OTRO carrier no pasa por aquí** (9.14: es
 * comparación, valor reservado de J-Tel, por circuito y por acuerdo). Este muro
 * es estricto a propósito, no provisional.
 */
function pasosVisiblesParaCuenta(cuentaId: string) {
  return or(
    sql`EXISTS (
      SELECT 1 FROM ${circuits}
      WHERE ${circuits.id} = ${circuitStopPasses.circuitId}
        AND ${circuits.concessionAccountId} = ${cuentaId}
    )`,
    and(
      sql`EXISTS (
        SELECT 1 FROM ${units}
        WHERE ${units.id} = ${circuitStopPasses.unitId}
          AND ${units.carrierAccountId} = ${cuentaId}
      )`,
      sql`EXISTS (
        SELECT 1 FROM ${circuitUnitAssignments}
        WHERE ${circuitUnitAssignments.circuitId} = ${circuitStopPasses.circuitId}
          AND ${circuitUnitAssignments.unitId} = ${circuitStopPasses.unitId}
          AND ${circuitUnitAssignments.carrierAccountId} = ${cuentaId}
      )`,
    ),
  );
}

/** Una unidad que el orquestador puede procesar en esta ronda, ya resuelta. */
export type UnidadParaDetectar = {
  circuitId: string;
  unitId: string;
  /**
   * La cuenta dueña de la UNIDAD (`units.carrier_account_id`) — la de su
   * telemetría. **No** la del circuito (`concession_account_id`): esa es la
   * concesión, y con ella la lectura de puntos no encontraría nada, o peor,
   * encontraría los de otro.
   */
  carrierAccountId: string;
  asignadaDesde: Date;
  /**
   * El cierre de la asignación, o `null` si sigue abierta. Una cerrada entra a
   * la ronda mientras su marcador no haya llegado a este instante («cerrada =
   * acotada»), y su ventana nunca pasa de aquí.
   */
  asignadaHasta: Date | null;
  corridorToleranceMeters: number;
  /** Los sentidos que el circuito sirve con paradas capturadas; cada uno ya tiene trazado. */
  sentidos: Array<"ida" | "vuelta">;
  /** El último ping consumido de esta versión, o `null` si nunca corrió. */
  marcaLastPingAt: Date | null;
};

export type UnidadSaltada = { circuitId: string; unitId: string; motivo: string };

export type ResultadoDeUnidad = {
  estado: "detectada" | "sin_novedad" | "ocupada";
  simulado: boolean;
  desde: Date | null;
  hasta: Date | null;
  /** Hasta dónde quedó (o habría quedado, en una simulación) el marcador. */
  marcaNueva: Date | null;
  pasosGuardados: number;
  muestra: Array<{
    stopId: string;
    sentido: "ida" | "vuelta";
    pasoDesde: Date;
    pasoHasta: Date;
    huecoSegundos: number;
  }>;
};

/** Sale de la transacción para revertirla: una simulación corre todo y no deja nada. */
class SimulacionRevertida extends Error {}

/**
 * El detector de pasos por parada (Marco 9.2 / 9.11, 0045) — eslabón 2 de la
 * cadena del arranque.
 *
 * **Por lote, sobre `telemetry_points`** (decisión G, recomendación de la
 * ficha): corre detrás del recolector, no en vivo. En vivo obliga a acertar
 * a la primera; por lote se puede volver a correr sobre los mismos días
 * cuando el detector mejore — que es justo lo que necesitan los días de
 * prueba del 22 al 25.
 */
export class PasoPorParadaRepository {
  constructor(private db: Database) {}

  /**
   * Los puntos de UNA unidad en una ventana, CON su id — es la evidencia
   * (decisión C: el hecho guarda qué dos pings usó). `getForUnitsWindow` de
   * `TelemetryRepository` no trae el id porque nadie lo había necesitado
   * hasta ahora.
   */
  async puntosDeUnidadEnVentana(carrierAccountId: string, unitId: string, desde: Date, hasta: Date) {
    return this.db
      .select({
        id: telemetryPoints.id,
        lat: telemetryPoints.latitude,
        lon: telemetryPoints.longitude,
        recordedAt: telemetryPoints.recordedAt,
      })
      .from(telemetryPoints)
      .where(
        and(
          eq(telemetryPoints.carrierAccountId, carrierAccountId),
          eq(telemetryPoints.unitId, unitId),
          gte(telemetryPoints.recordedAt, desde),
          lte(telemetryPoints.recordedAt, hasta),
        ),
      )
      .orderBy(telemetryPoints.recordedAt);
  }

  /**
   * Las paradas vigentes de un circuito que sirven a un sentido — las de ese
   * sentido más las que sirven a los dos (`sentido IS NULL`).
   */
  async paradasVigentesParaSentido(circuitId: string, sentido: "ida" | "vuelta") {
    return this.db
      .select({
        stopId: circuitStops.id,
        stopVersionId: circuitStopVersions.id,
        latitude: circuitStopVersions.latitude,
        longitude: circuitStopVersions.longitude,
      })
      .from(circuitStopVersions)
      .innerJoin(circuitStops, eq(circuitStops.id, circuitStopVersions.stopId))
      .where(
        and(
          eq(circuitStops.circuitId, circuitId),
          isNull(circuitStops.retiredAt),
          isNull(circuitStopVersions.validTo),
          or(isNull(circuitStopVersions.sentido), eq(circuitStopVersions.sentido, sentido)),
        ),
      );
  }

  /**
   * Guarda los pasos detectados. **Apila, no pisa** (decisión H): no hay
   * `onConflictDoUpdate`. Volver a correr el detector sobre el mismo tramo
   * produce filas nuevas junto a las anteriores, distinguibles por
   * `detectorVersion` — decidir qué hacer con las viejas de una corrida
   * superada es del orquestador que llame esto, no de aquí.
   */
  async guardarPasos(
    pasos: PasoDetectado[],
    contexto: { circuitId: string; unitId: string; sentido: "ida" | "vuelta"; detectorVersion: string },
  ) {
    if (pasos.length === 0) return [];
    return this.db
      .insert(circuitStopPasses)
      .values(
        pasos.map((p) => ({
          circuitId: contexto.circuitId,
          stopId: p.stopId,
          stopVersionId: p.stopVersionId,
          unitId: contexto.unitId,
          sentido: contexto.sentido,
          pasoDesde: p.pasoDesde,
          pasoHasta: p.pasoHasta,
          huecoSegundos: p.huecoSegundos,
          pingPrevioId: p.pingPrevioId,
          pingSiguienteId: p.pingSiguienteId,
          detectorVersion: contexto.detectorVersion,
        })),
      )
      .returning();
  }

  /**
   * Los pasos detectados de una parada, de todas las corridas que existan —
   * **los que esta cuenta puede ver y ninguno más**.
   *
   * El muro de cuenta (#441/#442, abierto por la unidad en 9.14):
   * `circuit_stop_passes` no lleva columna de cuenta, así que la visibilidad
   * sale de `pasosVisiblesParaCuenta` — ver ahí las dos entradas: la concesión
   * dueña del circuito ve todo; un carrier ve los pasos de sus propias unidades.
   * Un `stopId` que la cuenta no puede ver responde igual que uno que no existe:
   * lista vacía, sin distinguir. La cuenta es obligatoria a propósito — una
   * lectura por `stopId` a secas es la puerta que `guardia-muro-cuenta.test.ts`
   * vigila.
   *
   * ⚠ **Con un carrier, esto son sus filas y no el flujo del servicio.** Un
   * intervalo contra «el paso anterior» calculado sobre ellas, en un circuito con
   * más de un carrier, se salta a los demás y produciría un ATRASADA falso. Por
   * eso `compararPasosDeParada` sigue siendo exclusivo de la concesión.
   */
  /**
   * Los pasos de un circuito en una ventana, **para el resumen de recorridos**
   * (0053; 8.16.5) — la ÚNICA lectura de esta tabla sin muro de cuenta, y por
   * eso la más acotada de la casa.
   *
   * ## Por qué no lleva cuenta
   *
   * El muro (9.14) deriva la visibilidad de dos dueños: la concesión del
   * circuito y el carrier de la unidad. El resumen no es de ninguno de los dos:
   * es el recorrido **agregado del circuito**, que la 8.16.5 autoriza publicar
   * al pasajero, que no tiene cuenta. Lo que la hace segura no es una cuenta:
   *
   *  1. **No sale a internet.** La llama sólo el servicio del cron
   *     (`ResumenDeRecorridosService`), detrás de `CRON_SECRET`. Ninguna ruta
   *     de petición la toca — lo exige la valla del muro.
   *  2. **No devuelve ninguna identidad.** En vez del id de la unidad devuelve
   *     una **cadena anónima** (`dense_rank` dentro de ESTA consulta): sirve
   *     para encadenar los pasos de un mismo camión —un tramo es de un camión,
   *     no de dos— y no dice cuál es. Cambia entre consultas y no se puede
   *     cruzar con nada.
   *  3. **Lo que escribe no guarda unidad ni transportista** (0053): lo que no
   *     se guarda no se puede filtrar.
   */
  async pasosParaElResumen(circuitId: string, desde: Date, hasta: Date) {
    return this.db
      .select({
        /** Sin identidad: un número por camión dentro de esta consulta, y nada más. */
        cadena: sql<number>`dense_rank() OVER (ORDER BY ${circuitStopPasses.unitId})`.as("cadena"),
        sentido: circuitStopPasses.sentido,
        parada: circuitStops.qrSlug,
        stopId: circuitStopPasses.stopId,
        orden: circuitStopVersions.orden,
        desde: circuitStopPasses.pasoDesde,
        hasta: circuitStopPasses.pasoHasta,
        detectorVersion: circuitStopPasses.detectorVersion,
      })
      .from(circuitStopPasses)
      .innerJoin(circuitStops, eq(circuitStops.id, circuitStopPasses.stopId))
      .innerJoin(circuitStopVersions, eq(circuitStopVersions.id, circuitStopPasses.stopVersionId))
      .where(
        and(
          eq(circuitStopPasses.circuitId, circuitId),
          gte(circuitStopPasses.pasoDesde, desde),
          lte(circuitStopPasses.pasoDesde, hasta),
        ),
      )
      .orderBy(circuitStopPasses.pasoDesde);
  }

  async listarPasosDeParada(cuentaId: string, stopId: string, desde?: Date) {
    return this.db
      .select()
      .from(circuitStopPasses)
      .where(
        and(
          eq(circuitStopPasses.stopId, stopId),
          pasosVisiblesParaCuenta(cuentaId),
          /*
           * `desde` es OPCIONAL y acota, nunca abre: se suma con AND al muro,
           * que sigue siendo obligatorio. Existe porque la torre relee esta
           * parada cada pocos segundos y sólo le sirve lo de hoy; sin el corte
           * arrastraría el historial completo de la parada en cada vuelta, y
           * eso crece para siempre. Sin él, la lectura es la de antes.
           */
          ...(desde ? [gte(circuitStopPasses.pasoDesde, desde)] : []),
        ),
      )
      .orderBy(circuitStopPasses.pasoDesde);
  }

  /**
   * Los pasos de UNA unidad en UN circuito, en una ventana — la jornada.
   * Cruza el muro como todo lo que lee esta tabla: quien no es la concesión
   * dueña ni el carrier de la unidad recibe una lista vacía.
   */
  async listarPasosDeUnidad(cuentaId: string, circuitId: string, unitId: string, desde: Date, hasta: Date) {
    return this.db
      .select()
      .from(circuitStopPasses)
      .where(
        and(
          eq(circuitStopPasses.circuitId, circuitId),
          eq(circuitStopPasses.unitId, unitId),
          gte(circuitStopPasses.pasoDesde, desde),
          lte(circuitStopPasses.pasoDesde, hasta),
          pasosVisiblesParaCuenta(cuentaId),
        ),
      )
      .orderBy(circuitStopPasses.pasoDesde);
  }

  /**
   * Hasta dónde procesó el orquestador a esta unidad en este circuito, con esta
   * versión del detector. `null`: todavía nada. Lo que queda después **todavía
   * no se mide** — no es que falte.
   */
  async marcaDeDeteccion(circuitId: string, unitId: string, detectorVersion: string): Promise<Date | null> {
    const [fila] = await this.db
      .select({ lastPingAt: circuitDetectionMarks.lastPingAt })
      .from(circuitDetectionMarks)
      .where(
        and(
          eq(circuitDetectionMarks.circuitId, circuitId),
          eq(circuitDetectionMarks.unitId, unitId),
          eq(circuitDetectionMarks.detectorVersion, detectorVersion),
        ),
      );
    return fila?.lastPingAt ?? null;
  }

  /**
   * El detector completo: lee los puntos y las paradas vigentes, detecta por
   * cruce sobre el trazado y guarda. Una llamada, una unidad, un sentido, una
   * ventana — el orquestador que reparte por unidad y por día vive fuera de
   * este repositorio.
   */
  async detectarYGuardar(input: {
    carrierAccountId: string;
    circuitId: string;
    unitId: string;
    sentido: "ida" | "vuelta";
    trazado: Array<[number, number]>;
    corridorToleranceMeters: number;
    desde: Date;
    hasta: Date;
    detectorVersion: string;
  }) {
    const [puntosCrudos, paradas] = await Promise.all([
      this.puntosDeUnidadEnVentana(input.carrierAccountId, input.unitId, input.desde, input.hasta),
      this.paradasVigentesParaSentido(input.circuitId, input.sentido),
    ]);

    const puntos = puntosCrudos.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, recordedAt: p.recordedAt }));
    const paradasParaDetectar = paradas.map((p) => ({
      stopId: p.stopId,
      stopVersionId: p.stopVersionId,
      lat: p.latitude,
      lon: p.longitude,
    }));

    const pasos = detectarPasosEnRecorrido(puntos, input.trazado, paradasParaDetectar, input.corridorToleranceMeters);

    return this.guardarPasos(pasos, {
      circuitId: input.circuitId,
      unitId: input.unitId,
      sentido: input.sentido,
      detectorVersion: input.detectorVersion,
    });
  }

  /**
   * Las unidades que el orquestador puede procesar, y las que salta con su
   * motivo. **El silencio excluye**: una unidad entra sólo por su asignación
   * declarada y vigente, y sólo si todo lo demás está capturado.
   *
   * Entra si: la asignación **no ha sido recorrida hasta su final** —abierta, o
   * cerrada con el marcador todavía antes de su cierre («cerrada = acotada»,
   * 21 sep 2026)—, la cuenta de la asignación es la dueña de la unidad, el
   * circuito tiene al menos una parada vigente y hay trazado para cada sentido
   * que esas paradas sirven. Lo que no entra se dice, no se calla: un circuito
   * a medio capturar no es un error, pero tampoco es un cero.
   *
   * **Por qué entran las cerradas.** El detector va el colchón atrás (15 min),
   * así que cerrar una asignación —soltar, reasignar— dejaba sin detectar lo
   * que la unidad hizo entre su último marcador y el cierre. Minutos, callados.
   *
   * **Arranque acotado:** de las cerradas, sólo las que cerraron en las últimas
   * 24 h (`ahora`). Lo que se pierde en un cierre son minutos, no días; la
   * primera ronda no se pone a barrer meses de cierres viejos.
   *
   * **La baja no salta a una cerrada** (decisión de Asav, 21 sep): la baja es
   * el estado de HOY, y el tramo cerrado es el pasado — un camión dado de baja
   * al soltarlo perdería justo los minutos que esto recupera. A una abierta sí
   * la salta, como siempre. La regla de la cuenta vale para las dos.
   *
   * No exige dispositivo: una unidad sin telemetría sólo produce cero pasos.
   */
  async unidadesParaDetectar(detectorVersion: string, ahora: Date = new Date()): Promise<{
    elegibles: UnidadParaDetectar[];
    saltadas: UnidadSaltada[];
  }> {
    const asignaciones = await this.db
      .select({
        circuitId: circuitUnitAssignments.circuitId,
        unitId: circuitUnitAssignments.unitId,
        cuentaDeLaAsignacion: circuitUnitAssignments.carrierAccountId,
        asignadaDesde: circuitUnitAssignments.validFrom,
        asignadaHasta: circuitUnitAssignments.validTo,
        cuentaDeLaUnidad: units.carrierAccountId,
        unidadActiva: units.active,
        circuitoActivo: circuits.active,
        corridorToleranceMeters: circuits.corridorToleranceMeters,
      })
      .from(circuitUnitAssignments)
      .innerJoin(units, eq(units.id, circuitUnitAssignments.unitId))
      .innerJoin(circuits, eq(circuits.id, circuitUnitAssignments.circuitId))
      .where(
        or(
          isNull(circuitUnitAssignments.validTo),
          // Arranque acotado: sólo las cerradas en las últimas 24 h.
          gte(circuitUnitAssignments.validTo, new Date(ahora.getTime() - 24 * 3_600_000)),
        ),
      );
    if (asignaciones.length === 0) return { elegibles: [], saltadas: [] };

    const circuitIds = [...new Set(asignaciones.map((a) => a.circuitId))];
    const [paradas, trazados, marcas] = await Promise.all([
      this.db
        .select({ circuitId: circuitStops.circuitId, sentido: circuitStopVersions.sentido })
        .from(circuitStopVersions)
        .innerJoin(circuitStops, eq(circuitStops.id, circuitStopVersions.stopId))
        .where(
          and(
            inArray(circuitStops.circuitId, circuitIds),
            isNull(circuitStops.retiredAt),
            isNull(circuitStopVersions.validTo),
          ),
        ),
      this.db
        .select({ circuitId: circuitPaths.circuitId, sentido: circuitPaths.sentido })
        .from(circuitPaths)
        .where(inArray(circuitPaths.circuitId, circuitIds)),
      this.db
        .select({
          circuitId: circuitDetectionMarks.circuitId,
          unitId: circuitDetectionMarks.unitId,
          lastPingAt: circuitDetectionMarks.lastPingAt,
        })
        .from(circuitDetectionMarks)
        .where(
          and(
            inArray(circuitDetectionMarks.circuitId, circuitIds),
            eq(circuitDetectionMarks.detectorVersion, detectorVersion),
          ),
        ),
    ]);

    // Un sentido `null` en la parada la hace servir a los dos.
    const sentidosServidos = new Map<string, Set<"ida" | "vuelta">>();
    for (const p of paradas) {
      const set = sentidosServidos.get(p.circuitId) ?? new Set<"ida" | "vuelta">();
      for (const s of p.sentido === null ? (["ida", "vuelta"] as const) : [p.sentido]) set.add(s);
      sentidosServidos.set(p.circuitId, set);
    }
    const conTrazado = new Set(trazados.map((t) => `${t.circuitId}:${t.sentido}`));
    const marcaDe = new Map(marcas.map((m) => [`${m.circuitId}:${m.unitId}`, m.lastPingAt]));

    const elegibles: UnidadParaDetectar[] = [];
    const saltadas: UnidadSaltada[] = [];
    for (const a of asignaciones) {
      const salta = (motivo: string) => saltadas.push({ circuitId: a.circuitId, unitId: a.unitId, motivo });
      const marcaActual = marcaDe.get(`${a.circuitId}:${a.unitId}`) ?? null;
      const cerrada = a.asignadaHasta !== null;
      // Una cerrada cuyo marcador ya llegó a su cierre está terminada: ni entra ni se reporta.
      if (cerrada && marcaActual !== null && marcaActual.getTime() >= a.asignadaHasta!.getTime()) continue;
      if (!cerrada && !a.unidadActiva) {
        salta("la unidad está dada de baja");
        continue;
      }
      if (!cerrada && !a.circuitoActivo) {
        salta("el circuito está dado de baja");
        continue;
      }
      if (a.cuentaDeLaAsignacion !== a.cuentaDeLaUnidad) {
        salta("la cuenta de la asignación no es la dueña de la unidad");
        continue;
      }
      const sentidos = [...(sentidosServidos.get(a.circuitId) ?? [])].sort();
      if (sentidos.length === 0) {
        salta("el circuito no tiene paradas capturadas");
        continue;
      }
      const sinTrazado = sentidos.filter((s) => !conTrazado.has(`${a.circuitId}:${s}`));
      if (sinTrazado.length > 0) {
        salta(`el circuito no tiene trazado de ${sinTrazado.join(" y ")}`);
        continue;
      }
      elegibles.push({
        circuitId: a.circuitId,
        unitId: a.unitId,
        carrierAccountId: a.cuentaDeLaUnidad,
        asignadaDesde: a.asignadaDesde,
        asignadaHasta: a.asignadaHasta,
        corridorToleranceMeters: a.corridorToleranceMeters,
        sentidos,
        marcaLastPingAt: marcaActual,
      });
    }
    return { elegibles, saltadas };
  }

  /**
   * Una ronda del detector sobre UNA unidad, **entera en una transacción**:
   * candado, lectura del marcador, detección de los sentidos, inserción de los
   * pasos y avance del marcador. Todo o nada.
   *
   * Sin la transacción, morir entre guardar los pasos y mover el marcador
   * dejaba la ventana a medio hacer, y la ronda siguiente la re-detectaba y
   * DUPLICABA — la tabla de pasos no tiene candado de unicidad a propósito. Y
   * dos corridas del cron traslapadas leían el mismo marcador y escribían los
   * mismos pasos dos veces; el candado de aviso (`pg_try_advisory_xact_lock`,
   * de transacción y no de sesión: se suelta solo, aunque la corrida muera) hace
   * que la segunda se vaya sin esperar.
   *
   * **Ventana.** `desde` es el marcador (o `arranque` si nunca corrió), sin
   * bajar del inicio de la asignación. `hasta` es el último ping que existe
   * antes del **tope** —`hastaMaximo`, el colchón que da el llamador, o el
   * cierre de la asignación si llegó antes («cerrada = acotada»)—, así que el
   * marcador nuevo es siempre un ping real y la ventana siguiente arranca EN
   * él: el par de pings que cruza el borde se detecta una vez, ni perdido ni
   * repetido. Ni un ping de después del cierre se le atribuye a la asignación.
   *
   * **El detector no se toca**: se le pasa la transacción para que lea y
   * escriba dentro de ella. La cuenta con la que lee la telemetría es la de la
   * unidad (`carrierAccountId`), no la del circuito.
   *
   * `simular` corre todo y revierte al final: dice lo que escribiría sin
   * escribirlo.
   */
  async detectarUnidadEnRonda(input: {
    circuitId: string;
    unitId: string;
    carrierAccountId: string;
    asignadaDesde: Date;
    /** El cierre de la asignación, o `null` si sigue abierta: la ventana no pasa de aquí. */
    asignadaHasta?: Date | null;
    corridorToleranceMeters: number;
    sentidos: Array<"ida" | "vuelta">;
    detectorVersion: string;
    arranque: Date;
    hastaMaximo: Date;
    simular: boolean;
  }): Promise<ResultadoDeUnidad> {
    const vacio = (estado: ResultadoDeUnidad["estado"]): ResultadoDeUnidad => ({
      estado,
      simulado: input.simular,
      desde: null,
      hasta: null,
      marcaNueva: null,
      pasosGuardados: 0,
      muestra: [],
    });
    let resultado: ResultadoDeUnidad = vacio("sin_novedad");

    try {
      await this.db.transaction(async (tx) => {
        const llave = `pasos:${input.circuitId}:${input.unitId}:${input.detectorVersion}`;
        const [candado] = await tx.execute<{ tomada: boolean }>(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${llave}, 0)) AS tomada`,
        );
        if (candado?.tomada !== true) {
          resultado = vacio("ocupada");
          return;
        }

        const [marca] = await tx
          .select({ lastPingAt: circuitDetectionMarks.lastPingAt })
          .from(circuitDetectionMarks)
          .where(
            and(
              eq(circuitDetectionMarks.circuitId, input.circuitId),
              eq(circuitDetectionMarks.unitId, input.unitId),
              eq(circuitDetectionMarks.detectorVersion, input.detectorVersion),
            ),
          );
        const piso = marca?.lastPingAt ?? input.arranque;
        const desde = piso.getTime() > input.asignadaDesde.getTime() ? piso : input.asignadaDesde;
        // El tope: el colchón, o el cierre de la asignación si llegó antes.
        const cierre = input.asignadaHasta ?? null;
        const tope = cierre && cierre.getTime() < input.hastaMaximo.getTime() ? cierre : input.hastaMaximo;
        if (desde.getTime() >= tope.getTime()) return;

        // El último ping que existe en la ventana — con el muro: la cuenta de la unidad.
        const [ultimoPing] = await tx
          .select({ recordedAt: telemetryPoints.recordedAt })
          .from(telemetryPoints)
          .where(
            and(
              eq(telemetryPoints.carrierAccountId, input.carrierAccountId),
              eq(telemetryPoints.unitId, input.unitId),
              gte(telemetryPoints.recordedAt, desde),
              lte(telemetryPoints.recordedAt, tope),
            ),
          )
          .orderBy(desc(telemetryPoints.recordedAt))
          .limit(1);
        // Sin pings, o sólo el que el marcador ya consumió: nada nuevo.
        if (!ultimoPing || ultimoPing.recordedAt.getTime() <= desde.getTime()) return;
        const hasta = ultimoPing.recordedAt;

        const trazados = await tx.select().from(circuitPaths).where(eq(circuitPaths.circuitId, input.circuitId));
        // Ver `detectarYGuardar`: el repositorio, pero leyendo y escribiendo dentro de la transacción.
        const enTransaccion = new PasoPorParadaRepository(tx as unknown as Database);

        const muestra: ResultadoDeUnidad["muestra"] = [];
        let total = 0;
        for (const sentido of input.sentidos) {
          const trazado = trazados.find((t) => t.sentido === sentido)?.coordinates;
          if (!trazado) throw new Error(`El circuito ${input.circuitId} no tiene trazado de ${sentido}.`);
          const guardados = await enTransaccion.detectarYGuardar({
            carrierAccountId: input.carrierAccountId,
            circuitId: input.circuitId,
            unitId: input.unitId,
            sentido,
            trazado,
            corridorToleranceMeters: input.corridorToleranceMeters,
            desde,
            hasta,
            detectorVersion: input.detectorVersion,
          });
          total += guardados.length;
          for (const g of guardados) {
            muestra.push({
              stopId: g.stopId,
              sentido,
              pasoDesde: g.pasoDesde,
              pasoHasta: g.pasoHasta,
              huecoSegundos: g.huecoSegundos,
            });
          }
        }

        await tx
          .insert(circuitDetectionMarks)
          .values({
            circuitId: input.circuitId,
            unitId: input.unitId,
            detectorVersion: input.detectorVersion,
            lastPingAt: hasta,
          })
          .onConflictDoUpdate({
            target: [
              circuitDetectionMarks.circuitId,
              circuitDetectionMarks.unitId,
              circuitDetectionMarks.detectorVersion,
            ],
            set: { lastPingAt: hasta, updatedAt: new Date() },
          });

        resultado = {
          estado: "detectada",
          simulado: input.simular,
          desde,
          hasta,
          marcaNueva: hasta,
          pasosGuardados: total,
          muestra,
        };
        if (input.simular) throw new SimulacionRevertida();
      });
    } catch (e) {
      if (!(e instanceof SimulacionRevertida)) throw e;
    }
    return resultado;
  }
}

export function createRepositories(db: Database) {
  return {
    procedencia: new ProcedenciaRepository(db),
    accounts: new AccountRepository(db),
    carriers: new CarrierRepository(db),
    clients: new ClientRepository(db),
    geofences: new GeofenceRepository(db),
    fleet: new FleetRepository(db),
    routes: new RouteRepository(db),
    commercial: new CommercialRepository(db),
    contracts: new ContractRepository(db),
    profiles: new ServiceProfileRepository(db),
    occurrences: new OccurrenceRepository(db),
    compliance: new ComplianceRepository(db),
    evidence: new EvidenceRepository(db),
    memberships: new MembershipRepository(db),
    inspections: new InspectionRepository(db),
    notifications: new NotificationRepository(db),
    demos: new DemoRepository(db),
    telemetry: new TelemetryRepository(db),
    routeTraversals: new RouteTraversalRepository(db),
    groundTruth: new GroundTruthRepository(db),
    occurrenceGroundTruth: new OccurrenceGroundTruthRepository(db),
    aportaciones: new AportacionesRepository(db),
    ingestAlerts: new IngestAlertRepository(db),
    livePositions: new LivePositionRepository(db),
    circuits: new CircuitRepository(db),
    expedientes: new ExpedienteRepository(db),
    vernier: new VernierRepository(db),
    pausas: new PausasRepository(db),
    pasosPorParada: new PasoPorParadaRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
