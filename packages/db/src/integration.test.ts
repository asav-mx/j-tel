import { describe, it, expect, beforeAll } from "vitest";
import { createDb, createRepositories, serviceOccurrences, trips } from "../src/index.js";
import { eq } from "drizzle-orm";
import type { ContractPolicy } from "@jtel/domain";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel";

const TECMA_POLICY: ContractPolicy = {
  toleranceMinutes: 5,
  verificationGraceMinutes: 15,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
  excusableReasons: ["lluvia_nieve"],
  enforcementRules: [{ type: "no_pago_viaje", toleranceMinutes: 5 }],
  evidenceMarginMinutesBefore: 60,
  evidenceMarginMinutesAfter: 30,
  arrivalAnticipationMinutes: 15,
  maxRouteDurationMinutes: 60,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  timeZone: "America/Ciudad_Juarez",
};

const HONEYWELL_POLICY: ContractPolicy = {
  toleranceMinutes: 10,
  verificationGraceMinutes: 20,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
  excusableReasons: [],
  enforcementRules: [
    {
      type: "rebate_escalonado",
      toleranceMinutes: 10,
      baseRebatePercent: 2,
      baseFailureCount: 2,
      additionalRebatePercent: 1,
    },
  ],
  evidenceMarginMinutesBefore: 90,
  evidenceMarginMinutesAfter: 45,
  arrivalAnticipationMinutes: 10,
  maxRouteDurationMinutes: 60,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  timeZone: "America/Ciudad_Juarez",
};

let dbAvailable = false;

beforeAll(async () => {
  try {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    await repos.accounts.findBySlug("tecma");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

describe("multi-cuenta e contratos", () => {
  it("planta A no ve ocurrencias de planta B", async () => {
    if (!dbAvailable) return;

    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const tecma = await repos.accounts.findBySlug("tecma");
    const honeywell = await repos.accounts.findBySlug("honeywell");
    if (!tecma || !honeywell) return;

    const tecmaPlants = await repos.clients.getPlantsForAccount(tecma.id);
    const honeywellPlants = await repos.clients.getPlantsForAccount(honeywell.id);
    expect(tecmaPlants.length).toBeGreaterThan(0);
    expect(honeywellPlants.length).toBeGreaterThan(0);

    const tecmaOccs = await repos.occurrences.findForPlant(tecmaPlants[0]!.id);
    const honeywellOccs = await repos.occurrences.findForPlant(honeywellPlants[0]!.id);

    const tecmaContractIds = new Set(tecmaOccs.map((o) => o.contractId));
    for (const o of honeywellOccs) {
      expect(tecmaContractIds.has(o.contractId)).toBe(false);
    }
  });

  it("contratos tienen tolerancias distintas", async () => {
    if (!dbAvailable) return;

    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const tecma = await repos.accounts.findBySlug("tecma");
    const honeywell = await repos.accounts.findBySlug("honeywell");
    if (!tecma || !honeywell) return;

    const tecmaContracts = await repos.contracts.findForClient(tecma.id);
    const honeywellContracts = await repos.contracts.findForClient(honeywell.id);

    const tecmaPolicy = tecmaContracts[0]?.policy as ContractPolicy;
    const honeywellPolicy = honeywellContracts[0]?.policy as ContractPolicy;

    expect(tecmaPolicy.toleranceMinutes).toBe(5);
    expect(honeywellPolicy.toleranceMinutes).toBe(10);
  });
});

describe("contract policy validation", () => {
  it("políticas de fixture son válidas", () => {
    expect(TECMA_POLICY.toleranceMinutes).toBe(5);
    expect(HONEYWELL_POLICY.toleranceMinutes).toBe(10);
    expect(HONEYWELL_POLICY.enforcementRules[0]?.type).toBe("rebate_escalonado");
  });
});

describe("deleteBeyondHorizon — guarda de compliance_fact", () => {
  /**
   * Inserta ocurrencias directamente (sin pasar por generateForProfile ni sus
   * restricciones de validTo). Así el test es autosuficiente.
   *
   * Usa claves foráneas de un perfil real del seed para satisfacer las FK
   * de la tabla, pero inserta con fechas de servicio muy lejanas (hoy+200)
   * que no chocan con el horizonte normal de la ventana rodante.
   */
  it("no borra ocurrencias que ya tienen compliance_fact", async () => {
    if (!dbAvailable) return;

    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    // Obtenemos un perfil real del seed para reutilizar sus FK.
    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    // Fecha de servicio muy lejana → bien más allá del horizonte de 50 días.
    const serviceDate = "2099-01-15";
    const deadline = new Date("2099-01-15T08:00:00Z");
    const windowStart = new Date("2099-01-15T07:00:00Z");
    const windowEnd = new Date("2099-01-15T09:00:00Z");

    // Insertar ocurrencia A (será protegida con hecho) y B (sin hecho).
    const [occA, occB] = await db
      .insert(serviceOccurrences)
      .values([
        {
          serviceProfileId: profile.id,
          contractId: profile.contractId,
          routeShiftId: profile.routeShiftId,
          serviceDate,
          expectedDeadline: deadline,
          expectedGeofenceId: profile.geofenceId,
        },
        {
          serviceProfileId: profile.id,
          contractId: profile.contractId,
          routeShiftId: profile.routeShiftId,
          serviceDate: "2099-01-16",
          expectedDeadline: new Date("2099-01-16T08:00:00Z"),
          expectedGeofenceId: profile.geofenceId,
        },
      ])
      .returning();

    if (!occA || !occB) throw new Error("No se pudieron insertar ocurrencias de test");

    // Insertar un trip para occA (compliance_fact lo requiere).
    const [tripA] = await db
      .insert(trips)
      .values({
        serviceOccurrenceId: occA.id,
        evidenceWindowStart: windowStart,
        evidenceWindowEnd: windowEnd,
        evidenceStatus: "en_espera",
      })
      .returning();

    if (!tripA) throw new Error("No se pudo insertar el trip de test");

    // Crear el compliance_fact para occA.
    await repos.compliance.saveFact({
      serviceOccurrenceId: occA.id,
      tripId: tripA.id,
      expectedDeadline: deadline,
      expectedGeofenceId: profile.geofenceId,
      referenceUnitId: null,
      observedUnitId: null,
      observedArrivalAt: null,
      observedRouteMatchPct: null,
      servedVariantId: null,
      status: "no_cumplido",
      timing: null,
      lateExcusable: false,
      excusableReason: null,
      routeStrictnessApplied: "destino_only",
      contractPolicySnapshot: TECMA_POLICY,
    });

    // Ejecutar la guarda con horizonte de 50 días.
    // occA y occB están en 2099 → ambas son candidatas, pero occA tiene hecho.
    const result = await repos.occurrences.deleteBeyondHorizon(50);

    // occA debe sobrevivir (tiene hecho).
    const stillExists = await repos.occurrences.findById(occA.id);
    expect(stillExists).not.toBeNull();
    expect(result.skipped).toBeGreaterThanOrEqual(1);

    // occB debe haber sido borrada (sin hecho).
    const gone = await repos.occurrences.findById(occB.id);
    expect(gone).toBeNull();

    // Limpieza: borrar el hecho y luego la ocurrencia A.
    await repos.compliance.deleteFactForOccurrence(occA.id);
    await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occA.id));
  });

  it("ocurrencias sin compliance_fact sí se borran", async () => {
    if (!dbAvailable) return;

    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    // Insertar dos ocurrencias sin hecho en fecha lejana.
    const [occC, occD] = await db
      .insert(serviceOccurrences)
      .values([
        {
          serviceProfileId: profile.id,
          contractId: profile.contractId,
          routeShiftId: profile.routeShiftId,
          serviceDate: "2099-02-10",
          expectedDeadline: new Date("2099-02-10T08:00:00Z"),
          expectedGeofenceId: profile.geofenceId,
        },
        {
          serviceProfileId: profile.id,
          contractId: profile.contractId,
          routeShiftId: profile.routeShiftId,
          serviceDate: "2099-02-11",
          expectedDeadline: new Date("2099-02-11T08:00:00Z"),
          expectedGeofenceId: profile.geofenceId,
        },
      ])
      .returning();

    if (!occC || !occD) throw new Error("No se pudieron insertar ocurrencias de test");

    const result = await repos.occurrences.deleteBeyondHorizon(50);

    expect(result.deleted).toBeGreaterThanOrEqual(2);

    const goneC = await repos.occurrences.findById(occC.id);
    const goneD = await repos.occurrences.findById(occD.id);
    expect(goneC).toBeNull();
    expect(goneD).toBeNull();
  });
});
