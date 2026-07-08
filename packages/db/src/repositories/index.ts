import { eq, and, or, gte, lte, isNull, inArray, sql } from "drizzle-orm";
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
  routeShiftKmlVersions,
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
    });
  }

  async getPlantById(id: string) {
    return this.db.query.plants.findFirst({ where: eq(plants.id, id) });
  }
}

export class GeofenceRepository {
  constructor(private db: Database) {}

  async create(data: {
    ownerType: "plant" | "carrier";
    ownerPlantId?: string;
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

  async createRoute(clientAccountId: string, name: string) {
    const [route] = await this.db
      .insert(routes)
      .values({ clientAccountId, name })
      .returning();
    return route!;
  }

  async createShift(clientAccountId: string, name: string, startTime: string) {
    const [shift] = await this.db
      .insert(shifts)
      .values({ clientAccountId, name, startTime })
      .returning();
    return shift!;
  }

  async createRouteShift(data: {
    clientAccountId: string;
    routeId: string;
    shiftId: string;
    deadlineTime: string;
    kmlContent?: string;
    waypoints?: Array<{ lat: number; lng: number }>;
  }) {
    const [routeShift] = await this.db
      .insert(routeShifts)
      .values({
        clientAccountId: data.clientAccountId,
        routeId: data.routeId,
        shiftId: data.shiftId,
        deadlineTime: data.deadlineTime,
      })
      .returning();

    if (data.kmlContent) {
      await this.db.insert(routeShiftKmlVersions).values({
        routeShiftId: routeShift!.id,
        kmlContent: data.kmlContent,
        waypoints: data.waypoints ?? [],
        validFrom: new Date(),
      });
    }

    return routeShift!;
  }

  async getKmlVersionForDate(routeShiftId: string, at: Date) {
    return this.db.query.routeShiftKmlVersions.findFirst({
      where: and(
        eq(routeShiftKmlVersions.routeShiftId, routeShiftId),
        lte(routeShiftKmlVersions.validFrom, at),
        or(
          isNull(routeShiftKmlVersions.validTo),
          gte(routeShiftKmlVersions.validTo, at),
        ),
      ),
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
      with: { profiles: true, plant: true },
    });
  }

  async findForCarrier(carrierAccountId: string) {
    return this.db.query.serviceContracts.findMany({
      where: eq(serviceContracts.carrierAccountId, carrierAccountId),
      with: { profiles: true },
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
      with: { routeShift: true, contract: true, geofence: true },
    });

    if (!profile) throw new Error("Perfil no encontrado");

    const routeShift = profile.routeShift;
    const policy = profile.contract!.policy;
    const activeDays = profile.activeDays ?? [1, 2, 3, 4, 5];
    const created: string[] = [];

    const current = new Date(fromDate);
    current.setHours(0, 0, 0, 0);

    while (current <= toDate) {
      const dayOfWeek = current.getDay();
      if (activeDays.includes(dayOfWeek)) {
        const serviceDate = current.toISOString().split("T")[0]!;
        const [hours, minutes] = routeShift!.deadlineTime.split(":").map(Number);
        const deadline = new Date(current);
        deadline.setHours(hours!, minutes!, 0, 0);

        const kmlVersion = await this.db.query.routeShiftKmlVersions.findFirst({
          where: and(
            eq(routeShiftKmlVersions.routeShiftId, profile.routeShiftId),
            lte(routeShiftKmlVersions.validFrom, deadline),
            or(
              isNull(routeShiftKmlVersions.validTo),
              gte(routeShiftKmlVersions.validTo, deadline),
            ),
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
          const windowStart = new Date(deadline);
          windowStart.setMinutes(
            windowStart.getMinutes() - policy.evidenceMarginMinutesBefore,
          );
          const windowEnd = new Date(deadline);
          windowEnd.setMinutes(
            windowEnd.getMinutes() +
              policy.verificationGraceMinutes +
              policy.evidenceMarginMinutesAfter,
          );

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
      with: { complianceFact: true, trip: true },
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
      },
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
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
