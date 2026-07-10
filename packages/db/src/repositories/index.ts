import { eq, and, or, gte, lte, isNull, inArray, sql } from "drizzle-orm";
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
  routeKmlVersions,
  serviceContracts,
  serviceProfiles,
  serviceProfileUnits,
  serviceOccurrences,
  trips,
  complianceFacts,
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
  clientCarrierAuthorizations,
} from "../schema/index.js";
import type { ContractPolicy, CreateContractInput, CreateServiceProfileInput } from "@jtel/domain";

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

  async listByType(type: "carrier" | "client" | "jstaff") {
    return this.db.query.accounts.findMany({
      where: eq(accounts.type, type),
      orderBy: (table, { asc }) => [asc(table.name)],
    });
  }

  async listAll() {
    return this.db.query.accounts.findMany({
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
    kmlContent: string;
    waypoints?: Array<{ lat: number; lng: number }>;
    validFrom?: Date;
  }) {
    const existing = await this.db.query.routeKmlVersions.findMany({
      where: eq(routeKmlVersions.routeId, data.routeId),
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

  async findRouteShiftByNameAndShift(scope: OperationalScope, name: string, shiftId: string) {
    const cols = operationalScopeColumns(scope);
    const rsWhere =
      scope.kind === "plant"
        ? and(eq(routeShifts.plantId, cols.plantId!), eq(routeShifts.shiftId, shiftId))
        : and(eq(routeShifts.plantGroupId, cols.plantGroupId!), eq(routeShifts.shiftId, shiftId));
    const linked = await this.db.query.routeShifts.findMany({
      where: rsWhere,
      with: { route: true },
    });
    return linked.find((rs) => rs.route?.name === name) ?? null;
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

  async findShiftByNameAndTime(scope: OperationalScope, name: string, startTime: string) {
    const cols = operationalScopeColumns(scope);
    const where =
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
    return this.db.query.shifts.findFirst({ where });
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

  private toIsoDate(d: Date): string {
    return d.toISOString().split("T")[0]!;
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
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (activeDays.includes(dayOfWeek)) {
        const serviceDate = this.toIsoDate(current);
        const deadline = computeExpectedDeadline(
          serviceDate,
          shift.startTime,
          anticipation,
        );
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
      current.setDate(current.getDate() + 1);
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
    const today = this.startOfDay(new Date());
    const todayIso = this.toIsoDate(today);
    const horizon = this.addDays(today, days);
    const horizonIso = this.toIsoDate(horizon);

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
        from: this.toIsoDate(from),
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
   */
  async deleteBeyondHorizon(days: number = OccurrenceRepository.ROLLING_DAYS, plantGroupId?: string) {
    const lastKept = this.toIsoDate(this.addDays(new Date(), days));

    let ids: string[];
    if (plantGroupId) {
      const rows = await this.db
        .select({ id: serviceOccurrences.id })
        .from(serviceOccurrences)
        .innerJoin(serviceContracts, eq(serviceOccurrences.contractId, serviceContracts.id))
        .where(
          and(
            eq(serviceContracts.plantGroupId, plantGroupId),
            sql`${serviceOccurrences.serviceDate} > ${lastKept}`,
          ),
        );
      ids = rows.map((r) => r.id);
    } else {
      const rows = await this.db
        .select({ id: serviceOccurrences.id })
        .from(serviceOccurrences)
        .where(sql`${serviceOccurrences.serviceDate} > ${lastKept}`);
      ids = rows.map((r) => r.id);
    }

    if (ids.length === 0) return { cutoff: lastKept, deleted: 0 };

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
    return { cutoff: lastKept, deleted };
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
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, from.toISOString().split("T")[0]!));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, to.toISOString().split("T")[0]!));

    return this.queryOccurrencesWithRelations(conditions);
  }

  async findForPlantGroup(plantGroupId: string, from?: Date, to?: Date) {
    const contracts = await this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.plantGroupId, plantGroupId),
    });
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) return [];

    const conditions = [inArray(serviceOccurrences.contractId, contractIds)];
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, from.toISOString().split("T")[0]!));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, to.toISOString().split("T")[0]!));

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
        profile: { with: { routeShift: { with: { route: true, shift: true } } } },
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
    if (from) conditions.push(gte(serviceOccurrences.serviceDate, from.toISOString().split("T")[0]!));
    if (to) conditions.push(lte(serviceOccurrences.serviceDate, to.toISOString().split("T")[0]!));

    return this.db.query.serviceOccurrences.findMany({
      where: and(...conditions),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: true,
        profile: { with: { routeShift: { with: { route: true, shift: true } } } },
        contract: { with: { plant: true, plantGroup: true, carrier: true, client: true } },
      },
      orderBy: (o, { desc }) => [desc(o.serviceDate)],
    });
  }

  async findForContract(contractId: string) {
    return this.db.query.serviceOccurrences.findMany({
      where: eq(serviceOccurrences.contractId, contractId),
      with: {
        complianceFact: { with: { observedUnit: true } },
        trip: true,
        profile: { with: { routeShift: { with: { route: true, shift: true } } } },
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

  /** Borra el hecho de cumplimiento (p. ej. para reintentar pendiente_evidencia). */
  async deleteFactForOccurrence(serviceOccurrenceId: string) {
    await this.db
      .delete(complianceFacts)
      .where(eq(complianceFacts.serviceOccurrenceId, serviceOccurrenceId));
  }

  async addLedgerEntry(data: {
    tripId: string;
    serviceOccurrenceId: string;
    action: string;
    steps: import("@jtel/domain").LedgerStep[];
    actorUserId?: string;
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
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
