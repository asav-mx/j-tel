import { eq, and, or, not, gt, gte, lte, isNull, inArray, sql, ne, desc, count } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  computeExpectedDeadline,
  computeEvidenceWindow,
  contractPolicySchema,
  suggestProfileCode,
} from "@jtel/domain";
import type {
  OperationalScope,
  OperationalUnit,
  RouteDurationSample,
} from "@jtel/domain";
import { operationalScopeColumns } from "@jtel/domain";
import type { Database } from "../index.js";
import { escribirEnLotes, filasPorSentencia } from "../lote-de-escritura.js";
import { planDeVinculacion } from "../mapeo-identidades.js";
import { routeWindowSizing } from "../ventana-ocurrencia.js";
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
  groundTruthDays,
  occurrenceGroundTruth,
  ingestAlerts,
  routeTraversalMeasurements,
  clientCarrierAuthorizations,
} from "../schema/index.js";
import type { ComplianceFact } from "../schema/index.js";
import type {
  CandidatasSnapshot,
  ContractPolicy,
  CreateContractInput,
  CreateServiceProfileInput,
} from "@jtel/domain";
import { localDateIso, JTTEL_TZ, civilDatesInRange, addDaysIso } from "@jtel/domain";

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

  async createProfile(accountId: string, legalName: string, umbrellaUserId?: string) {
    const [profile] = await this.db
      .insert(carrierProfiles)
      .values({ accountId, legalName, umbrellaUserId })
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
      umbrellaUserId: input.userId,
    };

    if (input.password && input.password.length > 0) {
      const { encryptSecret } = await import("../crypto.js");
      values.umbrellaPasswordEncrypted = encryptSecret(input.password);
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
    if (!profile?.umbrellaUserId || !profile.umbrellaPasswordEncrypted) return null;

    const { decryptSecret } = await import("../crypto.js");
    let password: string;
    try {
      password = decryptSecret(profile.umbrellaPasswordEncrypted);
    } catch {
      return null;
    }

    return {
      provider: profile.gpsProvider ?? "umbrella",
      userId: profile.umbrellaUserId,
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

  async createDevice(carrierAccountId: string, imei: string, label?: string) {
    const [device] = await this.db
      .insert(devices)
      .values({ carrierAccountId, imei, label })
      .returning();
    return device!;
  }

  async assignDevice(unitId: string, deviceId: string, validFrom: Date = new Date()) {
    // Cierra asignaciones abiertas del mismo GPS o de la misma unidad
    await this.db
      .update(deviceAssignments)
      .set({ validTo: validFrom })
      .where(
        and(
          isNull(deviceAssignments.validTo),
          or(
            eq(deviceAssignments.deviceId, deviceId),
            eq(deviceAssignments.unitId, unitId),
          ),
        ),
      );

    const [assignment] = await this.db
      .insert(deviceAssignments)
      .values({ unitId, deviceId, validFrom })
      .returning();
    return assignment!;
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
        ),
      );

    return rows;
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
  }) {
    const [fact] = await this.db
      .insert(complianceFacts)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return fact!;
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
  ): Promise<Map<string, { rutaNombre: string; fecha: string }>> {
    const filas = await this.db.execute<{
      clave: string;
      ruta: string;
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
             r.name AS ruta
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

    const mapa = new Map<string, { rutaNombre: string; fecha: string }>();
    for (const f of filas as unknown as Array<{ clave: string; ruta: string }>) {
      if (!f.clave || mapa.has(f.clave)) continue;
      mapa.set(f.clave, { rutaNombre: f.ruta, fecha: serviceDate });
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
  async getMemoryHorizon(carrierAccountId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ primero: sql<Date | null>`min(${telemetryPoints.recordedAt})` })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrierAccountId));
    return row?.primero ? new Date(row.primero) : null;
  }

  /** Puntos de la memoria propia para un conjunto de IMEIs en una ventana. */
  async getForImeis(imeis: string[], from: Date, to: Date) {
    if (imeis.length === 0) return [];
    return this.db.query.telemetryPoints.findMany({
      where: and(
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
    kind: "heartbeat_stale" | "watermark_lag" | "archive_error" | "rate_limit";
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
    kind: "heartbeat_stale" | "watermark_lag" | "archive_error" | "rate_limit",
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
    kind: "heartbeat_stale" | "watermark_lag" | "archive_error" | "rate_limit",
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
    ingestAlerts: new IngestAlertRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
