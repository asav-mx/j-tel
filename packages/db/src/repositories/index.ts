import { eq, and, or, gte, lte, isNull, inArray, sql, ne } from "drizzle-orm";
import { computeExpectedDeadline, computeEvidenceWindow, suggestProfileCode } from "@jtel/domain";
import type { OperationalScope, OperationalUnit } from "@jtel/domain";
import { operationalScopeColumns } from "@jtel/domain";
import type { Database } from "../index.js";
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
  clientCarrierAuthorizations,
} from "../schema/index.js";
import type { ComplianceFact } from "../schema/index.js";
import type { ContractPolicy, CreateContractInput, CreateServiceProfileInput } from "@jtel/domain";
import { localDateIso, JTTEL_TZ, civilDatesInRange, addDaysIso } from "@jtel/domain";

function suggestProfileCodeFromName(name: string): string {
  return suggestProfileCode(name);
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

  async getMaintenanceForCarrier(carrierAccountId: string) {
    return this.db.query.maintenanceRecords.findMany({
      where: eq(maintenanceRecords.carrierAccountId, carrierAccountId),
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

  async updateShift(
    id: string,
    clientAccountId: string,
    scope: OperationalScope,
    data: { name: string; startTime: string },
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

    await this.db
      .update(shifts)
      .set({ name: data.name, startTime: data.startTime })
      .where(eq(shifts.id, id));
    return { ok: true };
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

  async updatePolicy(id: string, policy: ContractPolicy) {
    const [contract] = await this.db
      .update(serviceContracts)
      .set({ policy, updatedAt: new Date() })
      .where(eq(serviceContracts.id, id))
      .returning();
    return contract!;
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
      const deadline = computeExpectedDeadline(serviceDate, shift.startTime, anticipation);
      const { windowStart, windowEnd } = computeEvidenceWindow(deadline, policy);
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

  async findPendingVerification(now: Date) {
    const deadlinePassed = lte(
      sql`${serviceOccurrences.expectedDeadline} + (${serviceContracts.policy}->>'verificationGraceMinutes')::int * interval '1 minute'`,
      now.toISOString(),
    );

    // 1) Nunca verificados
    // 2) Pendientes por evidencia con GPS indisponible → reintento (p. ej. cuando
    //    la memoria propia ya se puso al día).
    const rows = await this.db
      .select({
        occurrence: serviceOccurrences,
        contract: serviceContracts,
        trip: trips,
      })
      .from(serviceOccurrences)
      .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          deadlinePassed,
          or(
            isNull(complianceFacts.id),
            and(
              eq(complianceFacts.status, "pendiente_evidencia"),
              eq(trips.evidenceStatus, "indisponible"),
            ),
          ),
        ),
      );

    return rows;
  }

  async findForPlant(plantId: string, from?: Date, to?: Date) {
    const contracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.plantId, plantId),
    });
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const conditions = [inArray(serviceOccurrences.contractId, contractIds)];
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, localDateIso(from, JTTEL_TZ)));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, localDateIso(to, JTTEL_TZ)));

    return this.queryOccurrencesWithRelations(conditions);
  }

  async findForPlantGroup(plantGroupId: string, from?: Date, to?: Date) {
    const contracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.plantGroupId, plantGroupId),
    });
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const conditions = [inArray(serviceOccurrences.contractId, contractIds)];
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, localDateIso(from, JTTEL_TZ)));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, localDateIso(to, JTTEL_TZ)));

    return this.queryOccurrencesWithRelations(conditions);
  }

  async findForScope(scope: OperationalScope, from?: Date, to?: Date) {
    if (scope.kind === "plant") return this.findForPlant(scope.plantId, from, to);
    return this.findForPlantGroup(scope.plantGroupId, from, to);
  }

  private async queryOccurrencesWithRelations(conditions: unknown[]) {
    return this.db.query.serviceOccurrences.findMany({
      where: and(...(conditions as Parameters<typeof and>)),
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
    const contracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.clientAccountId, clientAccountId),
    });
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const conditions = [inArray(serviceOccurrences.contractId, contractIds)];
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, localDateIso(from, JTTEL_TZ)));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, localDateIso(to, JTTEL_TZ)));

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
    });
  }

  async findForContract(contractId: string, from?: Date, to?: Date) {
    const conditions = [eq(serviceOccurrences.contractId, contractId)];
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, localDateIso(from, JTTEL_TZ)));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, localDateIso(to, JTTEL_TZ)));

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
    });
  }

  async findById(id: string) {
    return this.db.query.serviceOccurrences.findFirst({
      where: eq(serviceOccurrences.id, id),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: { with: { evidencePoints: true } },
        profile: { with: { contract: true, geofence: true, routeShift: true } },
      },
    });
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
  }) {
    const [fact] = await this.db
      .insert(complianceFacts)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return fact!;
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
    const rows = await this.db
      .insert(evidencePoints)
      .values(points.map((p) => ({ tripId, ...p })))
      .returning();
    return rows;
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
    status: "disponible" | "parcial" | "en_espera" | "indisponible",
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
    const rows = await this.db
      .insert(telemetryPoints)
      .values(
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
      )
      .onConflictDoNothing()
      .returning();
    return rows;
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
      where: isNull(ingestAlerts.resolvedAt),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit,
    });
  }
}

export function createRepositories(db: Database) {
  return {
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
    groundTruth: new GroundTruthRepository(db),
    occurrenceGroundTruth: new OccurrenceGroundTruthRepository(db),
    ingestAlerts: new IngestAlertRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
