import { eq, and, or, gte, lte, isNull, inArray, sql } from "drizzle-orm";
import { computeExpectedDeadline, computeEvidenceWindow } from "@jtel/domain";
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
} from "../schema/index.js";
import type { ContractPolicy, CreateContractInput, CreateServiceProfileInput } from "@jtel/domain";

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
    const [version] = await this.db
      .insert(routeKmlVersions)
      .values({
        routeId: data.routeId,
        kmlContent: data.kmlContent,
        waypoints: data.waypoints ?? [],
        validFrom: data.validFrom ?? new Date(),
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
    return this.db.query.routeKmlVersions.findFirst({
      where: and(
        eq(routeKmlVersions.routeId, routeId),
        lte(routeKmlVersions.validFrom, at),
        or(isNull(routeKmlVersions.validTo), gte(routeKmlVersions.validTo, at)),
      ),
    });
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
      with: { route: { with: { kmlVersions: true } }, shift: true },
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
      with: { profiles: true, plant: true, plantGroup: true },
    });
  }

  async findForCarrier(carrierAccountId: string) {
    return this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.carrierAccountId, carrierAccountId),
      with: { profiles: true, plant: true, plantGroup: true, client: true },
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
}

export class ServiceProfileRepository {
  constructor(private db: Database) {}

  async create(input: CreateServiceProfileInput) {
    const [profile] = await this.db
      .insert(serviceProfiles)
      .values({
        contractId: input.contractId,
        routeShiftId: input.routeShiftId,
        geofenceId: input.geofenceId,
        name: input.name,
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
}

export class OccurrenceRepository {
  constructor(private db: Database) {}

  async generateForProfile(
    profileId: string,
    fromDate: Date,
    toDate: Date,
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

    const routeShift = profile.routeShift;
    const shift = routeShift!.shift!;
    const policy = profile.contract!.policy;
    const anticipation = policy.arrivalAnticipationMinutes ?? 15;
    const activeDays = profile.activeDays ?? [1, 2, 3, 4, 5];
    const created: string[] = [];

    const current = new Date(fromDate);
    current.setHours(0, 0, 0, 0);

    while (current <= toDate) {
      const dayOfWeek = current.getDay();
      if (activeDays.includes(dayOfWeek)) {
        const serviceDate = current.toISOString().split("T")[0]!;
        const deadline = computeExpectedDeadline(
          serviceDate,
          shift.startTime,
          anticipation,
        );

        const kmlVersion = await this.db.query.routeKmlVersions.findFirst({
          where: and(
            eq(routeKmlVersions.routeId, routeShift!.routeId),
            lte(routeKmlVersions.validFrom, deadline),
            or(isNull(routeKmlVersions.validTo), gte(routeKmlVersions.validTo, deadline)),
          ),
        });

        const [occurrence] = await this.db
          .insert(serviceOccurrences)
          .values({
            serviceProfileId: profileId,
            contractId: profile.contractId,
            routeShiftId: profile.routeShiftId,
            kmlVersionId: kmlVersion?.id,
            serviceDate,
            expectedDeadline: deadline,
            expectedGeofenceId: profile.geofenceId,
            referenceUnitId: profile.referenceUnitId,
          })
          .onConflictDoNothing()
          .returning();

        if (occurrence) {
          const { windowStart, windowEnd } = computeEvidenceWindow(deadline, policy);

          await this.db.insert(trips).values({
            serviceOccurrenceId: occurrence.id,
            evidenceWindowStart: windowStart,
            evidenceWindowEnd: windowEnd,
            evidenceStatus: "en_espera",
          });

          created.push(occurrence.id);
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return created;
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
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .leftJoin(complianceFacts, eq(complianceFacts.serviceOccurrenceId, serviceOccurrences.id))
      .where(
        and(
          isNull(complianceFacts.id),
          lte(
            sql`${serviceOccurrences.expectedDeadline} + (${serviceContracts.policy}->>'verificationGraceMinutes')::int * interval '1 minute'`,
            now.toISOString(),
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

    return this.db.query.serviceOccurrences.findMany({
      where: and(...conditions),
      with: {
        complianceFact: true,
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
        complianceFact: true,
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
        complianceFact: true,
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
        complianceFact: true,
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
}

export function createRepositories(db: Database) {
  return {
    accounts: new AccountRepository(db),
    carriers: new CarrierRepository(db),
    clients: new ClientRepository(db),
    geofences: new GeofenceRepository(db),
    fleet: new FleetRepository(db),
    routes: new RouteRepository(db),
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
