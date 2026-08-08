import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createDb,
  createRepositories,
  serviceOccurrences,
  trips,
  complianceFactHistory,
  complianceFacts,
  drivers,
  driverCredentials,
  accounts,
  serviceContracts,
  shifts,
  serviceProfiles,
  revisarHorasLimite,
} from "../src/index.js";
import { eq, inArray, sql } from "drizzle-orm";
import type { ContractPolicy, OperationalScope } from "@jtel/domain";

// Candado: falla antes de correr cualquier test si apunta a producción
const PROD_URL = process.env.DATABASE_URL;
const TEST_URL = process.env.DATABASE_URL_TEST;

if (!TEST_URL) {
  throw new Error(
    "[integration] DATABASE_URL_TEST no está definida. " +
      "Apunta a una rama de Neon de prueba antes de correr tests de integración. " +
      "Ejemplo: pnpm --filter @jtel/db test:integration",
  );
}
if (PROD_URL && TEST_URL === PROD_URL) {
  throw new Error(
    "[integration] DATABASE_URL_TEST es idéntica a DATABASE_URL (producción). " +
      "Los tests de integración se niegan a correr contra la base de datos de producción.",
  );
}

const DATABASE_URL = TEST_URL;

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
  windowDerivationEnabled: true,
  windowSlackPct: 25,
  routeAvgSpeedKmh: 20,
  maxWindowBeforeMinutes: 360,
  routeDurationPercentile: 90,
  routeDurationMinSamples: 3,
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
  windowDerivationEnabled: true,
  windowSlackPct: 25,
  routeAvgSpeedKmh: 20,
  maxWindowBeforeMinutes: 360,
  routeDurationPercentile: 90,
  routeDurationMinSamples: 3,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  timeZone: "America/Ciudad_Juarez",
};

beforeAll(async () => {
  const db = createDb(DATABASE_URL);
  const repos = createRepositories(db);
  // Verifica conectividad antes de correr los tests; falla ruidosamente si la
  // rama de Neon no está disponible (en lugar de pasar en silencio).
  await repos.accounts.findBySlug("tecma");
});

describe("multi-cuenta e contratos", () => {
  it("planta A no ve ocurrencias de planta B", async () => {
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
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const serviceDate = "2099-01-15";
    const deadline = new Date("2099-01-15T08:00:00Z");
    const windowStart = new Date("2099-01-15T07:00:00Z");
    const windowEnd = new Date("2099-01-15T09:00:00Z");

    // Pre-limpieza: eliminar datos residuales de corridas anteriores.
    const staleA = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
    });
    if (staleA) {
      await repos.compliance.deleteFactForOccurrence(staleA.id);
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, staleA.id));
    }

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

    try {
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

      const result = await repos.occurrences.deleteBeyondHorizon(50);

      const stillExists = await repos.occurrences.findById(occA.id);
      expect(stillExists).not.toBeUndefined();
      expect(result.skipped).toBeGreaterThanOrEqual(1);

      const gone = await repos.occurrences.findById(occB.id);
      expect(gone).toBeUndefined();
    } finally {
      await repos.compliance.deleteFactForOccurrence(occA.id);
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occA.id));
    }
  });

  it("ocurrencias sin compliance_fact sí se borran", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    // Pre-limpieza: eliminar residuos de corridas anteriores.
    for (const date of ["2099-02-10", "2099-02-11"]) {
      const stale = await db.query.serviceOccurrences.findFirst({
        where: (o, { and, eq: e }) =>
          and(e(o.serviceProfileId, profile.id), e(o.serviceDate, date)),
      });
      if (stale) {
        await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, stale.id));
      }
    }

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
    expect(goneC).toBeUndefined();
    expect(goneD).toBeUndefined();
  });
});

describe("generateForProfile — alineación de calendario (TZ=UTC simula Vercel)", () => {
  /**
   * Regresión del bug de zona horaria en el generador de ocurrencias.
   *
   * Código roto: el bucle itera `current: Date` en UTC midnight y llama
   * `toIsoDate(current) = localDateIso(midnight UTC, Juárez)` → da el día
   * ANTERIOR en Juárez (medianoche UTC = 18:00 Juárez del día previo en verano).
   * Resultado: domingos insertados, viernes faltantes para perfiles L-V.
   *
   * Código arreglado: ambos, el check de DOW y el service_date, salen del
   * mismo string de fecha civil (sin conversión Date → Juárez).
   *
   * El caso exacto de la simulación del diagnóstico: cron del 26-jul generando
   * desde 2026-08-22 (sáb) hasta 2026-08-24 (lun). El único día hábil L-V
   * en el rango es lun-24; el código roto insertaba "2026-08-23" (dom Juárez).
   */
  it("rango sáb-22 a lun-24 ago-2026: inserta lun-24, no dom-23", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!; // activeDays=[1,2,3,4,5] (L-V)

    // fromDate = sáb 2026-08-22T00:00:00Z, toDate = lun 2026-08-24T00:00:00Z
    // — mismos instantes que construye renewRollingWindow con startOfDay en UTC.
    const from = new Date("2026-08-22T00:00:00.000Z");
    const to = new Date("2026-08-24T00:00:00.000Z");

    const result = await repos.occurrences.generateForProfile(profile.id, from, to);

    try {
      // Solo lunes-24 es día hábil en el rango → debe generarse exactamente 1.
      expect(result.createdIds.length).toBe(1);

      const [row] = await db
        .select({ serviceDate: serviceOccurrences.serviceDate })
        .from(serviceOccurrences)
        .where(eq(serviceOccurrences.id, result.createdIds[0]!));

      // Con código roto:    row.serviceDate = "2026-08-23" (dom Juárez) → falla.
      // Con código arreglado: row.serviceDate = "2026-08-24" (lun)       → pasa.
      expect(row?.serviceDate).toBe("2026-08-24");
      expect(row?.serviceDate).not.toBe("2026-08-23");
    } finally {
      // Cascade limpia el trip asociado.
      if (result.createdIds.length > 0) {
        await db
          .delete(serviceOccurrences)
          .where(inArray(serviceOccurrences.id, result.createdIds));
      }
    }
  });
});

// ─── Pieza 1: Historia de Hechos ──────────────────────────────────────────────
// Estos tests verifican los invariantes de archiveAndDeleteFact, updateHistorySuccessor
// y getFactHistory. Toda la evidencia sale de DB real (Neon test branch).
describe("Pieza 1 — Historia de Hechos", () => {
  const POLICY_FIXTURE: ContractPolicy = {
    toleranceMinutes: 5,
    verificationGraceMinutes: 15,
    routeStrictness: "destino_only",
    kmlMatchMinPct: 60,
    kmlCorridorMeters: 120,
    kmlCorridorMinPct: 60,
    excusableReasons: [],
    enforcementRules: [],
    evidenceMarginMinutesBefore: 60,
    evidenceMarginMinutesAfter: 30,
    arrivalAnticipationMinutes: 15,
    maxRouteDurationMinutes: 60,
    windowDerivationEnabled: true,
    windowSlackPct: 25,
    routeAvgSpeedKmh: 20,
    maxWindowBeforeMinutes: 360,
    routeDurationPercentile: 90,
    routeDurationMinSamples: 3,
    evidenceMinCoveragePct: 80,
    evidenceMaxGapMinutes: 10,
    timeZone: "America/Ciudad_Juarez",
  };

  /** Crea una ocurrencia + trip + compliance_fact de prueba en el futuro lejano. */
  async function createTestFact(
    db: ReturnType<typeof createDb>,
    repos: ReturnType<typeof createRepositories>,
    serviceDate: string,
    deadlineIso: string,
    status: "cumplido" | "no_cumplido" = "no_cumplido",
  ) {
    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) throw new Error("Cuenta tecma no encontrada en test branch");
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) throw new Error("Sin perfiles en test branch");
    const profile = profiles[0]!;

    const deadline = new Date(deadlineIso);
    const windowStart = new Date(deadline.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(deadline.getTime() + 30 * 60 * 1000);

    const [occ] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate,
        expectedDeadline: deadline,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!occ) throw new Error("No se pudo insertar ocurrencia");

    const [trip] = await db
      .insert(trips)
      .values({
        serviceOccurrenceId: occ.id,
        evidenceWindowStart: windowStart,
        evidenceWindowEnd: windowEnd,
        evidenceStatus: "en_espera",
      })
      .returning();
    if (!trip) throw new Error("No se pudo insertar trip");

    await repos.compliance.saveFact({
      serviceOccurrenceId: occ.id,
      tripId: trip.id,
      expectedDeadline: deadline,
      expectedGeofenceId: profile.geofenceId,
      referenceUnitId: null,
      observedUnitId: null,
      observedArrivalAt: null,
      observedRouteMatchPct: null,
      servedVariantId: null,
      status,
      timing: null,
      lateExcusable: false,
      excusableReason: null,
      routeStrictnessApplied: "destino_only",
      contractPolicySnapshot: POLICY_FIXTURE,
    });

    return { occ, trip };
  }

  it("re-juicio: compliance_facts 1 fila, compliance_fact_history 1 fila con actor", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const { occ, trip } = await createTestFact(
      db, repos, "2099-03-01", "2099-03-01T08:00:00Z", "no_cumplido",
    );

    try {
      // Primer re-juicio
      const historyId = await repos.compliance.archiveAndDeleteFact(
        occ.id, "human", "usuario-test-123",
      );
      await repos.compliance.saveFact({
        serviceOccurrenceId: occ.id,
        tripId: trip.id,
        expectedDeadline: new Date("2099-03-01T08:00:00Z"),
        expectedGeofenceId: occ.expectedGeofenceId,
        referenceUnitId: null,
        observedUnitId: null,
        observedArrivalAt: null,
        observedRouteMatchPct: null,
        servedVariantId: null,
        status: "cumplido",
        timing: "a_tiempo",
        lateExcusable: false,
        excusableReason: null,
        routeStrictnessApplied: "destino_only",
        contractPolicySnapshot: POLICY_FIXTURE,
      });
      const newFact = await db.query.complianceFacts.findFirst({
        where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id),
      });
      if (!newFact) throw new Error("saveFact no insertó");
      await repos.compliance.updateHistorySuccessor(historyId, newFact.id);

      // compliance_facts: exactamente 1 fila (la nueva)
      const current = await db.query.complianceFacts.findFirst({
        where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id),
      });
      expect(current).not.toBeNull();
      expect(current?.status).toBe("cumplido");

      // compliance_fact_history: exactamente 1 fila
      const history = await repos.compliance.getFactHistory(occ.id);
      expect(history).toHaveLength(1);
      expect(history[0]?.actorKind).toBe("human");
      expect(history[0]?.actorId).toBe("usuario-test-123");
      expect(history[0]?.status).toBe("no_cumplido");
      expect(history[0]?.replacedByFactId).toBe(newFact.id);
    } finally {
      await repos.compliance.deleteFactForOccurrence(occ.id);
      await db.delete(complianceFactHistory).where(eq(complianceFactHistory.serviceOccurrenceId, occ.id));
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });

  it("tres re-juicios: 3 filas en historial, replaced_by_fact_id correcto", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const { occ, trip } = await createTestFact(
      db, repos, "2099-03-02", "2099-03-02T08:00:00Z", "no_cumplido",
    );

    try {
      const factData = {
        serviceOccurrenceId: occ.id,
        tripId: trip.id,
        expectedDeadline: new Date("2099-03-02T08:00:00Z"),
        expectedGeofenceId: occ.expectedGeofenceId,
        referenceUnitId: null as null,
        observedUnitId: null as null,
        observedArrivalAt: null as null,
        observedRouteMatchPct: null as null,
        servedVariantId: null as null,
        timing: null as null,
        lateExcusable: false,
        excusableReason: null as null,
        routeStrictnessApplied: "destino_only" as const,
        contractPolicySnapshot: POLICY_FIXTURE,
      };

      // Re-juicio 1
      const h1 = await repos.compliance.archiveAndDeleteFact(occ.id, "system:cli", null);
      await repos.compliance.saveFact({ ...factData, status: "cumplido" });
      const f1 = (await db.query.complianceFacts.findFirst({ where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id) }))!;
      await repos.compliance.updateHistorySuccessor(h1, f1.id);

      // Re-juicio 2
      const h2 = await repos.compliance.archiveAndDeleteFact(occ.id, "system:exclusivity-pass", null);
      await repos.compliance.saveFact({ ...factData, status: "no_cumplido" });
      const f2 = (await db.query.complianceFacts.findFirst({ where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id) }))!;
      await repos.compliance.updateHistorySuccessor(h2, f2.id);

      // Re-juicio 3
      const h3 = await repos.compliance.archiveAndDeleteFact(occ.id, "human", "admin-xyz");
      await repos.compliance.saveFact({ ...factData, status: "cumplido" });
      const f3 = (await db.query.complianceFacts.findFirst({ where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id) }))!;
      await repos.compliance.updateHistorySuccessor(h3, f3.id);

      // compliance_facts: 1 fila (la más reciente)
      const current = await db.query.complianceFacts.findFirst({
        where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id),
      });
      expect(current?.status).toBe("cumplido");

      // compliance_fact_history: 3 filas ordenadas
      const history = await repos.compliance.getFactHistory(occ.id);
      expect(history).toHaveLength(3);

      // Orden replaced_at ASC: no_cumplido → cumplido → no_cumplido
      expect(history[0]?.status).toBe("no_cumplido"); // original
      expect(history[1]?.status).toBe("cumplido");    // después del 1er re-juicio
      expect(history[2]?.status).toBe("no_cumplido"); // después del 2do re-juicio

      // replaced_by_fact_id: null en las dos más antiguas (el sucesor fue re-juzgado)
      // El 3er re-juicio (h3) apunta a f3 que aún está vigente → no-null
      expect(history[0]?.replacedByFactId).toBeNull();
      expect(history[1]?.replacedByFactId).toBeNull();
      expect(history[2]?.replacedByFactId).toBe(f3.id);
    } finally {
      await repos.compliance.deleteFactForOccurrence(occ.id);
      await db.delete(complianceFactHistory).where(eq(complianceFactHistory.serviceOccurrenceId, occ.id));
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });

  it("primera verificación (sin hecho previo): historial queda vacío", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const deadline = new Date("2099-03-03T08:00:00Z");
    const [occ] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate: "2099-03-03",
        expectedDeadline: deadline,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!occ) throw new Error("No se pudo insertar ocurrencia");

    const [trip] = await db
      .insert(trips)
      .values({
        serviceOccurrenceId: occ.id,
        evidenceWindowStart: new Date(deadline.getTime() - 3600_000),
        evidenceWindowEnd: new Date(deadline.getTime() + 1800_000),
        evidenceStatus: "en_espera",
      })
      .returning();
    if (!trip) throw new Error("No se pudo insertar trip");

    try {
      // Primera verificación: saveFact sin archiveAndDeleteFact
      await repos.compliance.saveFact({
        serviceOccurrenceId: occ.id,
        tripId: trip.id,
        expectedDeadline: deadline,
        expectedGeofenceId: occ.expectedGeofenceId,
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
        contractPolicySnapshot: POLICY_FIXTURE,
      });

      // Historial debe estar vacío — no se archivó nada
      const history = await repos.compliance.getFactHistory(occ.id);
      expect(history).toHaveLength(0);

      // El hecho vigente sí existe
      const current = await db.query.complianceFacts.findFirst({
        where: (f, { eq }) => eq(f.serviceOccurrenceId, occ.id),
      });
      expect(current?.status).toBe("no_cumplido");
    } finally {
      await repos.compliance.deleteFactForOccurrence(occ.id);
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });

  it("retry pendiente→pendiente: no archiva; retry pendiente→resuelto: sí archiva", async () => {
    // Verifica la regla: archivar solo cuando cambió algo, nunca por seguir igual.
    // Un GPS sin señal puede generar 360 reintentos/hora — archivando siempre serían
    // 360 filas idénticas. Solo se archiva en la transición real.
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    // ── Caso A: pendiente→pendiente (cron reintenta, GPS sigue sin datos) ──────
    const { occ: occA } = await createTestFact(
      db, repos, "2099-03-05", "2099-03-05T08:00:00Z",
    );
    // Simular retry: leer el hecho actual, borrarlo, insertar uno nuevo igual
    const oldFactA = await db.query.complianceFacts.findFirst({
      where: (f, { eq: e }) => e(f.serviceOccurrenceId, occA.id),
    });
    if (!oldFactA) throw new Error("setup: no fact A");

    try {
      await repos.compliance.deleteFactForOccurrence(occA.id);
      await repos.compliance.saveFact({
        serviceOccurrenceId: occA.id,
        tripId: oldFactA.tripId!,
        expectedDeadline: oldFactA.expectedDeadline,
        expectedGeofenceId: oldFactA.expectedGeofenceId,
        referenceUnitId: null, observedUnitId: null, observedArrivalAt: null,
        observedRouteMatchPct: null, servedVariantId: null,
        status: "no_cumplido", // mismo que el original
        timing: null, lateExcusable: false, excusableReason: null,
        routeStrictnessApplied: "destino_only",
        contractPolicySnapshot: POLICY_FIXTURE,
      });
      // Sin llamar a insertHistoryEntry — la condición fact.status !== oldFact.status es false
      const historyA = await repos.compliance.getFactHistory(occA.id);
      expect(historyA).toHaveLength(0);
    } finally {
      await repos.compliance.deleteFactForOccurrence(occA.id);
      await db.delete(complianceFactHistory).where(eq(complianceFactHistory.serviceOccurrenceId, occA.id));
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occA.id));
    }

    // ── Caso B: pendiente→resuelto (GPS vuelve, transición real) ───────────────
    const { occ: occB } = await createTestFact(
      db, repos, "2099-03-06", "2099-03-06T08:00:00Z",
    );
    const oldFactB = await db.query.complianceFacts.findFirst({
      where: (f, { eq: e }) => e(f.serviceOccurrenceId, occB.id),
    });
    if (!oldFactB) throw new Error("setup: no fact B");

    try {
      await repos.compliance.deleteFactForOccurrence(occB.id);
      await repos.compliance.saveFact({
        serviceOccurrenceId: occB.id,
        tripId: oldFactB.tripId!,
        expectedDeadline: oldFactB.expectedDeadline,
        expectedGeofenceId: oldFactB.expectedGeofenceId,
        referenceUnitId: null, observedUnitId: null, observedArrivalAt: null,
        observedRouteMatchPct: null, servedVariantId: null,
        status: "cumplido", // CAMBIO de estado
        timing: "a_tiempo", lateExcusable: false, excusableReason: null,
        routeStrictnessApplied: "destino_only",
        contractPolicySnapshot: POLICY_FIXTURE,
      });
      const newFactB = await db.query.complianceFacts.findFirst({
        where: (f, { eq: e }) => e(f.serviceOccurrenceId, occB.id),
      });
      if (!newFactB) throw new Error("saveFact B no insertó");

      // Archivar porque fact.status !== oldFact.status
      const historyId = await repos.compliance.insertHistoryEntry(oldFactB, "system:cron", null);
      await repos.compliance.updateHistorySuccessor(historyId, newFactB.id);

      const historyB = await repos.compliance.getFactHistory(occB.id);
      expect(historyB).toHaveLength(1);
      expect(historyB[0]?.status).toBe("no_cumplido");
      expect(historyB[0]?.actorKind).toBe("system:cron");
      expect(historyB[0]?.replacedByFactId).toBe(newFactB.id);
    } finally {
      await repos.compliance.deleteFactForOccurrence(occB.id);
      await db.delete(complianceFactHistory).where(eq(complianceFactHistory.serviceOccurrenceId, occB.id));
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occB.id));
    }
  });

  it("getFactHistory devuelve versiones en orden replaced_at ASC", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const { occ, trip } = await createTestFact(
      db, repos, "2099-03-04", "2099-03-04T08:00:00Z", "cumplido",
    );

    try {
      const factData = {
        serviceOccurrenceId: occ.id,
        tripId: trip.id,
        expectedDeadline: new Date("2099-03-04T08:00:00Z"),
        expectedGeofenceId: occ.expectedGeofenceId,
        referenceUnitId: null as null,
        observedUnitId: null as null,
        observedArrivalAt: null as null,
        observedRouteMatchPct: null as null,
        servedVariantId: null as null,
        timing: null as null,
        lateExcusable: false,
        excusableReason: null as null,
        routeStrictnessApplied: "destino_only" as const,
        contractPolicySnapshot: POLICY_FIXTURE,
      };

      await repos.compliance.archiveAndDeleteFact(occ.id, "system:cli", null);
      await repos.compliance.saveFact({ ...factData, status: "no_cumplido" });
      await repos.compliance.archiveAndDeleteFact(occ.id, "human", "auditor-1");
      await repos.compliance.saveFact({ ...factData, status: "cumplido" });

      const history = await repos.compliance.getFactHistory(occ.id);
      expect(history).toHaveLength(2);

      // replaced_at debe ser estrictamente creciente
      const [first, second] = history;
      expect(first!.replacedAt.getTime()).toBeLessThan(second!.replacedAt.getTime());

      // Primer actor: system:cli; segundo: human
      expect(first!.actorKind).toBe("system:cli");
      expect(second!.actorKind).toBe("human");
      expect(second!.actorId).toBe("auditor-1");
    } finally {
      await repos.compliance.deleteFactForOccurrence(occ.id);
      await db.delete(complianceFactHistory).where(eq(complianceFactHistory.serviceOccurrenceId, occ.id));
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });
});

/**
 * El conteo que bajó a la base tiene que decir EXACTAMENTE lo mismo que el
 * `.filter().length` que reemplaza. No "aproximadamente": si difiere en uno, es
 * que el JS filtraba algo que el SQL no replica, y eso hay que entenderlo antes
 * de reemplazar nada.
 *
 * Estas pruebas no siembran datos: corren los dos caminos sobre lo que la rama
 * de prueba ya tiene, que es la única forma de que la comparación abarque casos
 * que a nadie se le habrían ocurrido sembrar.
 */
describe("countByStatus — paridad con el conteo en JS", () => {
  /** El camino viejo, escrito aquí tal como vivía en las pantallas. */
  function contarEnJs(occs: Array<{ complianceFact?: { status: string } | null }>) {
    return {
      total: occs.length,
      cumplido: occs.filter((o) => o.complianceFact?.status === "cumplido").length,
      no_cumplido: occs.filter((o) => o.complianceFact?.status === "no_cumplido").length,
      pendiente_evidencia: occs.filter(
        (o) => o.complianceFact?.status === "pendiente_evidencia",
      ).length,
      sin_hecho: occs.filter((o) => !o.complianceFact).length,
    };
  }

  it("por planta y por campus: mismas cinco cifras que contar las filas", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    let alcancesComparados = 0;
    for (const slug of ["tecma", "honeywell"]) {
      const cuenta = await repos.accounts.findBySlug(slug);
      if (!cuenta) continue;

      for (const unidad of await repos.clients.getOperationalUnits(cuenta.id)) {
        const scope =
          unidad.kind === "plant"
            ? ({ kind: "plant", plantId: unidad.id } as const)
            : ({ kind: "plant_group", plantGroupId: unidad.id } as const);

        const filas = await repos.occurrences.findForScope(scope);
        const conteo = await repos.occurrences.countByStatusForScope(scope);

        expect(conteo).toEqual(contarEnJs(filas));
        // Los cuatro cubos reparten el total sin traslape ni sobrante: un
        // estado mal clasificado se escondería dentro de un total correcto.
        expect(
          conteo.cumplido + conteo.no_cumplido + conteo.pendiente_evidencia + conteo.sin_hecho,
        ).toBe(conteo.total);
        alcancesComparados++;
      }
    }

    // Que el bucle no se haya quedado vacío es parte de la prueba: cero
    // comparaciones pasarían en verde sin haber comparado nada.
    expect(alcancesComparados).toBeGreaterThan(0);
  });

  it("por cuenta cliente y por contrato: mismas cifras", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;

    expect(await repos.occurrences.countByStatusForClientAccount(tecma.id)).toEqual(
      contarEnJs(await repos.occurrences.findForClientAccount(tecma.id)),
    );

    const contratos = await repos.contracts.findForClient(tecma.id);
    expect(contratos.length).toBeGreaterThan(0);
    for (const c of contratos) {
      expect(await repos.occurrences.countByStatusForContract(c.id)).toEqual(
        contarEnJs(await repos.occurrences.findForContract(c.id)),
      );
    }
  });

  it("por contrato y día: la fecha se compara igual que el === que sustituye", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const contrato = (await repos.contracts.findForClient(tecma.id))[0];
    if (!contrato) return;

    const todas = await repos.occurrences.findForContract(contrato.id);
    const dias = [...new Set(todas.map((o) => o.serviceDate))].slice(0, 5);
    expect(dias.length).toBeGreaterThan(0);

    for (const dia of dias) {
      expect(await repos.occurrences.countByStatusForContractDate(contrato.id, dia)).toEqual(
        contarEnJs(todas.filter((o) => o.serviceDate === dia)),
      );
    }
  });

  /**
   * La falla que esta prueba busca no es ruidosa: un `where` de alcance que se
   * quede corto no revienta, devuelve un número MÁS GRANDE — con servicios de
   * plantas que ese usuario no debe ver. Una fuga que se lee como dato correcto.
   *
   * Por eso el contador de referencia se calcula por un camino independiente:
   * se traen las ocurrencias de toda la cuenta y se recortan a los contratos de
   * esa planta. Si el conteo se saltara el alcance devolvería el total de la
   * cuenta, y aquí se vería.
   */
  it("el alcance viaja con el conteo: una planta no cuenta las de otra", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;

    const deLaCuenta = await repos.occurrences.findForClientAccount(tecma.id);
    const plantas = await repos.clients.getPlantsForAccount(tecma.id);
    expect(plantas.length).toBeGreaterThan(0);

    for (const planta of plantas) {
      const contratos = await repos.contracts.findForClient(tecma.id);
      const idsDeLaPlanta = new Set(
        contratos.filter((c) => c.plantId === planta.id).map((c) => c.id),
      );
      const esperado = contarEnJs(
        deLaCuenta.filter((o) => idsDeLaPlanta.has(o.contractId)),
      );

      const conteo = await repos.occurrences.countByStatusForScope({
        kind: "plant",
        plantId: planta.id,
      });
      expect(conteo).toEqual(esperado);
    }

    // Y el contrapositivo: si alguna planta contara de más, su cifra superaría
    // la de la cuenta entera que la contiene.
    const cuenta = await repos.occurrences.countByStatusForClientAccount(tecma.id);
    for (const planta of plantas) {
      const conteo = await repos.occurrences.countByStatusForScope({
        kind: "plant",
        plantId: planta.id,
      });
      expect(conteo.total).toBeLessThanOrEqual(cuenta.total);
    }
  });

  it("un alcance sin contratos devuelve ceros, no error", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const cero = {
      total: 0,
      cumplido: 0,
      no_cumplido: 0,
      pendiente_evidencia: 0,
      sin_hecho: 0,
    };
    const inexistente = "00000000-0000-0000-0000-000000000000";

    expect(
      await repos.occurrences.countByStatusForScope({ kind: "plant", plantId: inexistente }),
    ).toEqual(cero);
    expect(
      await repos.occurrences.countByStatusForScope({
        kind: "plant_group",
        plantGroupId: inexistente,
      }),
    ).toEqual(cero);
    expect(await repos.occurrences.countByStatusForClientAccount(inexistente)).toEqual(cero);
    expect(await repos.occurrences.countByStatusForContract(inexistente)).toEqual(cero);
  });
});

/**
 * La invariante de la que depende todo el módulo de choferes.
 *
 * Las dos capas existen para que borrar los datos personales de una persona no
 * destruya el acta de los servicios que cubrió. Si esta prueba falla, la purga
 * rompe la historia — que es exactamente lo que el Plan-Choferes llama
 * no-negociable.
 */
describe("choferes — la purga no rompe la historia", () => {
  it("el nombre congelado sobrevive a purgar credenciales y a borrar al chofer", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    const carrier = await repos.accounts.findBySlug("juarez-bus");
    if (!tecma || !carrier) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const serviceDate = "2099-03-01";
    const deadline = new Date("2099-03-01T08:00:00Z");

    const stale = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
    });
    if (stale) {
      await repos.compliance.deleteFactForOccurrence(stale.id);
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, stale.id));
    }

    const [occ] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate,
        expectedDeadline: deadline,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!occ) throw new Error("no se pudo insertar la ocurrencia");

    try {
      const [trip] = await db
        .insert(trips)
        .values({
          serviceOccurrenceId: occ.id,
          evidenceWindowStart: new Date("2099-03-01T07:00:00Z"),
          evidenceWindowEnd: new Date("2099-03-01T09:00:00Z"),
          evidenceStatus: "en_espera",
        })
        .returning();
      if (!trip) throw new Error("no se pudo insertar el viaje");

      // Un chofer con su expediente vivo.
      const [chofer] = await db
        .insert(drivers)
        .values({ carrierAccountId: carrier.id })
        .returning();
      if (!chofer) throw new Error("no se pudo insertar el chofer");
      await db.insert(driverCredentials).values({
        driverId: chofer.id,
        fullName: "R. Medina",
        licenseNumber: "LIC-TEST-0001",
      });

      // El servicio se sella con el chofer declarado, congelado en el hecho.
      await repos.compliance.saveFact({
        serviceOccurrenceId: occ.id,
        tripId: trip.id,
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
      await db
        .update(complianceFacts)
        .set({ declaredDriverName: "R. Medina", declaredDriverId: chofer.id })
        .where(eq(complianceFacts.serviceOccurrenceId, occ.id));

      const leer = async () =>
        db.query.complianceFacts.findFirst({
          where: (f, { eq: e }) => e(f.serviceOccurrenceId, occ.id),
        });

      expect((await leer())?.declaredDriverName).toBe("R. Medina");
      expect((await leer())?.declaredDriverId).toBe(chofer.id);

      // 1 · Se purgan las credenciales: el chofer se fue, o la ley obligó.
      await db.delete(driverCredentials).where(eq(driverCredentials.driverId, chofer.id));
      expect(await db.query.driverCredentials.findFirst({
        where: (c, { eq: e }) => e(c.driverId, chofer.id),
      })).toBeUndefined();
      // El acta de ese día sigue diciendo quién manejó.
      expect((await leer())?.declaredDriverName).toBe("R. Medina");

      // 2 · El caso extremo: se borra el ancla entera.
      await db.delete(drivers).where(eq(drivers.id, chofer.id));
      const tras = await leer();
      // La referencia se anula...
      expect(tras?.declaredDriverId).toBeNull();
      // ...y el nombre NO. Esa es la invariante.
      expect(tras?.declaredDriverName).toBe("R. Medina");
    } finally {
      await repos.compliance.deleteFactForOccurrence(occ.id);
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });
});

describe("savePoints — el INSERT que no cabía", () => {
  /**
   * La regresión que este archivo existe para impedir.
   *
   * Ocho servicios de Honeywell pasaron 35 días sin veredicto con su evidencia
   * completa esperando en memoria propia: `savePoints` metía ~12 000 puntos en
   * una sola sentencia, Postgres la rechazaba por exceso de parámetros, y el
   * `catch` de `processPending` se comía el error sin dejar rastro.
   *
   * Un test de unidad no habría atrapado esto: el límite no vive en nuestro
   * código, vive en el protocolo de Postgres. Por eso este test escribe de
   * verdad, contra la rama desechable.
   */
  const PUNTOS = 12_000;

  it(`guarda ${PUNTOS} puntos de evidencia sin que la base rechace la sentencia`, async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const serviceDate = "2099-03-01";
    const ventanaIni = new Date("2099-03-01T10:50:00Z");
    const ventanaFin = new Date("2099-03-01T13:25:00Z");

    const previa = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
    });
    if (previa) await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, previa.id));

    const [occ] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate,
        expectedDeadline: new Date("2099-03-01T12:20:00Z"),
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!occ) throw new Error("No se pudo insertar la ocurrencia de test");

    try {
      const [trip] = await db
        .insert(trips)
        .values({
          serviceOccurrenceId: occ.id,
          evidenceWindowStart: ventanaIni,
          evidenceWindowEnd: ventanaFin,
          evidenceStatus: "en_espera",
        })
        .returning();
      if (!trip) throw new Error("No se pudo insertar el viaje de test");

      const puntos = Array.from({ length: PUNTOS }, (_, i) => ({
        imei: `imei-lote-${i % 82}`,
        latitude: 31.7 + i * 1e-6,
        longitude: -106.4 + i * 1e-6,
        speed: 40,
        recordedAt: new Date(ventanaIni.getTime() + i * 500),
      }));

      const guardados = await repos.evidence.savePoints(trip.id, puntos);
      expect(guardados.length).toBe(PUNTOS);

      const leidos = await repos.evidence.getPointsForTrip(trip.id);
      expect(leidos.length).toBe(PUNTOS);
    } finally {
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  });

});

describe("el techo del contador — el futuro no cuenta como faltante", () => {
  /**
   * LA VALLA DE ESTE PR.
   *
   * El generador crea ocurrencias por adelantado: al escribir esto había 1 153
   * en el futuro, hasta un mes después. Un contador de "vencidas sin veredicto"
   * sin techo las cuenta a todas como si les faltara juicio, y el instrumento
   * nace mintiendo. Ya costó dos investigaciones.
   *
   * Si alguien quita el `<= now() - umbral`, este test se pone rojo.
   */
  it("una ocurrencia futura sin hecho NO cuenta como fallo mudo", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const antes = await repos.occurrences.contarFallosMudos(2);

    const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const serviceDate = "2099-05-05";
    const previa = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
    });
    if (previa) await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, previa.id));

    const [futura] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate,
        expectedDeadline: enUnaSemana,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!futura) throw new Error("No se pudo insertar la ocurrencia futura");

    try {
      const despues = await repos.occurrences.contarFallosMudos(2);
      // Sin hecho, pero su plazo no ha llegado: el contador no se inmuta.
      expect(despues.total).toBe(antes.total);
    } finally {
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, futura.id));
    }
  });

  it("una vencida hace días SIN hecho sí cuenta, y el umbral la deja fuera si es reciente", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const tecma = await repos.accounts.findBySlug("tecma");
    if (!tecma) return;
    const profiles = await repos.profiles.findForClient(tecma.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const antes = await repos.occurrences.contarFallosMudos(2);

    // Venció hace 6 h: pasa el umbral de 2 h, no el de 24 h.
    const hace6h = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const serviceDate = "2099-05-06";
    const previa = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, serviceDate)),
    });
    if (previa) await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, previa.id));

    const [vencida] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate,
        expectedDeadline: hace6h,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!vencida) throw new Error("No se pudo insertar la ocurrencia vencida");

    try {
      expect((await repos.occurrences.contarFallosMudos(2)).total).toBe(antes.total + 1);
      // El umbral es el techo: con 24 h esta misma fila queda fuera.
      expect((await repos.occurrences.contarFallosMudos(24)).total).toBe(antes.total);
    } finally {
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, vencida.id));
    }
  });
});

describe("la llave de cuentas demo — los dos cerrojos, en SQL", () => {
  /**
   * LA VALLA DE ESTE PR, del lado de la base.
   *
   * La regla vive escrita DOS veces: en TypeScript (`motivoCuentaDemo`, que
   * ejerce `verifyOccurrence`) y en SQL (`findPendingVerification`, que decide
   * qué entra a la cola del cron). Las pruebas de unidad cubren la primera. Si
   * la segunda se rompe o se va desincronizando, solo lo ve una prueba que
   * hable con Postgres — y por eso está aquí.
   *
   * Lo que protege: el 2026-08-03 se midieron 84 hechos vinculantes sellados
   * sobre cuentas de ejemplo, 52 de ellos acusaciones formales contra
   * transportistas por servicios que nadie prestó.
   *
   * La base de prueba no trae cuentas demo, así que el test las marca él mismo
   * y las devuelve a su estado en el `finally`.
   */
  const SERVICE_DATE = "2099-06-06";

  async function conOcurrenciaVencida(
    fn: (ctx: {
      db: ReturnType<typeof createDb>;
      repos: ReturnType<typeof createRepositories>;
      ahora: Date;
      contractId: string;
      clientAccountId: string;
    }) => Promise<void>,
  ) {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const honeywell = await repos.accounts.findBySlug("honeywell");
    if (!honeywell) return;
    const profiles = await repos.profiles.findForClient(honeywell.id);
    if (profiles.length === 0) return;
    const profile = profiles[0]!;

    const contrato = await db.query.serviceContracts.findFirst({
      where: eq(serviceContracts.id, profile.contractId),
    });
    if (!contrato) return;

    const previa = await db.query.serviceOccurrences.findFirst({
      where: (o, { and, eq: e }) =>
        and(e(o.serviceProfileId, profile.id), e(o.serviceDate, SERVICE_DATE)),
    });
    if (previa) await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, previa.id));

    const vencioHace6h = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const [occ] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: profile.contractId,
        routeShiftId: profile.routeShiftId,
        serviceDate: SERVICE_DATE,
        expectedDeadline: vencioHace6h,
        expectedGeofenceId: profile.geofenceId,
      })
      .returning();
    if (!occ) throw new Error("No se pudo insertar la ocurrencia vencida");

    // `findPendingVerification` hace innerJoin con trips: sin viaje no aparece
    // ni siquiera cuando la cuenta es real, y el test mediría un espejismo.
    await db.insert(trips).values({
      serviceOccurrenceId: occ.id,
      evidenceWindowStart: new Date(vencioHace6h.getTime() - 60 * 60 * 1000),
      evidenceWindowEnd: vencioHace6h,
      evidenceStatus: "en_espera",
    });

    try {
      await fn({
        db,
        repos,
        ahora: new Date(),
        contractId: contrato.id,
        clientAccountId: contrato.clientAccountId,
      });
    } finally {
      await db.delete(serviceOccurrences).where(eq(serviceOccurrences.id, occ.id));
    }
  }

  it("cerrojo 1 · is_demo en la cuenta la saca de la cola y la cuenta aparte", async () => {
    await conOcurrenciaVencida(async ({ db, repos, ahora, clientAccountId }) => {
      // Primero se comprueba que SIN la marca sí entra. Sin esta mitad, un bug
      // que la dejara fuera por cualquier otra razón daría verde igual.
      const enCola = await repos.occurrences.findPendingVerification(ahora);
      const estabaEnCola = enCola.some((r) => r.occurrence.serviceDate === SERVICE_DATE);
      expect(estabaEnCola).toBe(true);
      const excluidasAntes = await repos.occurrences.contarVencidasDeCuentaDemo(ahora);

      await db
        .update(accounts)
        .set({ isDemo: true })
        .where(eq(accounts.id, clientAccountId));
      try {
        const despues = await repos.occurrences.findPendingVerification(ahora);
        expect(despues.some((r) => r.occurrence.serviceDate === SERVICE_DATE)).toBe(false);

        // NADA SE EVAPORA. Marcar la cuenta saca de la cola todas sus vencidas,
        // no solo la de este test, así que el número exacto no se puede predecir.
        // Lo que sí tiene que cumplirse siempre —y es la propiedad que separa
        // «excluir» de «esconder»— es que lo que salió de la cola es exactamente
        // lo que el contador recogió.
        const excluidasDespues = await repos.occurrences.contarVencidasDeCuentaDemo(ahora);
        expect(enCola.length - despues.length).toBe(excluidasDespues - excluidasAntes);
        expect(excluidasDespues).toBeGreaterThan(excluidasAntes);
      } finally {
        await db
          .update(accounts)
          .set({ isDemo: false })
          .where(eq(accounts.id, clientAccountId));
      }
    });
  });

  it("cerrojo 2 · status='demo' en el contrato la saca aunque la cuenta sea real", async () => {
    /*
     * El agujero que quedaría si solo se cerrara `is_demo`. Hoy no muerde
     * —los cuatro contratos de producción tienen `status='active'`— y por eso
     * mismo hace falta la prueba: sin ella, borrar este cerrojo pasa en verde.
     */
    await conOcurrenciaVencida(async ({ db, repos, ahora, contractId, clientAccountId }) => {
      const cuenta = await db.query.accounts.findFirst({
        where: eq(accounts.id, clientAccountId),
      });
      expect(cuenta?.isDemo).toBe(false); // la cuenta es real: solo cambia el contrato

      const enCola = await repos.occurrences.findPendingVerification(ahora);
      expect(enCola.some((r) => r.occurrence.serviceDate === SERVICE_DATE)).toBe(true);
      const excluidasAntes = await repos.occurrences.contarVencidasDeCuentaDemo(ahora);

      await db
        .update(serviceContracts)
        .set({ status: "demo" })
        .where(eq(serviceContracts.id, contractId));
      try {
        const despues = await repos.occurrences.findPendingVerification(ahora);
        expect(despues.some((r) => r.occurrence.serviceDate === SERVICE_DATE)).toBe(false);
        const excluidasDespues = await repos.occurrences.contarVencidasDeCuentaDemo(ahora);
        expect(enCola.length - despues.length).toBe(excluidasDespues - excluidasAntes);
        expect(excluidasDespues).toBeGreaterThan(excluidasAntes);
      } finally {
        await db
          .update(serviceContracts)
          .set({ status: "active" })
          .where(eq(serviceContracts.id, contractId));
      }
    });
  });

  it("sin ninguna marca, la vencida sigue en la cola y no se cuenta como demo", async () => {
    // La mitad que impide satisfacer la valla apagando el motor entero.
    await conOcurrenciaVencida(async ({ repos, ahora }) => {
      const enCola = await repos.occurrences.findPendingVerification(ahora);
      expect(enCola.some((r) => r.occurrence.serviceDate === SERVICE_DATE)).toBe(true);
      const excluidas = await repos.occurrences.contarVencidasDeCuentaDemo(ahora);
      const conMarca = await repos.occurrences.findPendingVerification(ahora);
      expect(conMarca.length + excluidas).toBeGreaterThanOrEqual(enCola.length);
    });
  });
});

/*
 * El filtro de cuentas demo, en las tres consultas de salud.
 *
 * OJO: estas pruebas NO corren en CI —`pruebas.yml` solo corre las unitarias—,
 * así que un verde de GitHub no dice nada sobre ellas. Se corren a mano con
 * `pnpm --filter @jtel/db test:integration`. Se dice en voz alta para no
 * repetir el error que motiva el arreglo: dar por probado lo que nadie ejecutó.
 *
 * El caso: `/api/salud` reportó «6 servicios vencidos SIN veredicto» durante
 * días. El número era correcto y la afirmación falsa — las seis eran de cuentas
 * de ejemplo, que desde el #206 no se juzgan nunca.
 */
describe("deCuentaReal — las cuentas de ejemplo no disparan el vigilante", () => {
  it("contarFallosMudos ignora las ocurrencias de una cuenta demo", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const antes = await repos.occurrences.contarFallosMudos(2);

    const [demo] = await db
      .insert(accounts)
      .values({ type: "client", name: "DEMO vigilante", slug: `demo-vig-${Date.now()}`, isDemo: true })
      .returning();

    // Una ocurrencia vencida hace mucho y sin hecho: exactamente la forma que
    // el contador buscaba. Si el filtro no estuviera, el total subiría.
    const ayer = new Date(Date.now() - 72 * 3_600_000);
    const [carrier] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.type, "carrier"))
      .limit(1);

    const [contrato] = await db
      .insert(serviceContracts)
      .values({
        carrierAccountId: carrier!.id,
        clientAccountId: demo!.id,
        name: "Contrato demo del vigilante",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        policy: TECMA_POLICY,
      })
      .returning();

    const despues = await repos.occurrences.contarFallosMudos(2);

    // Limpieza: la cuenta demo cae en cascada con su contrato.
    await db.delete(serviceContracts).where(eq(serviceContracts.id, contrato!.id));
    await db.delete(accounts).where(eq(accounts.id, demo!.id));

    expect(despues.total).toBe(antes.total);
    expect(ayer.getTime()).toBeLessThan(Date.now());
  });

  it("listUnresolved ignora las alertas de un carrier demo", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const abiertas = await repos.ingestAlerts.listUnresolved(100);
    // Ninguna alerta que llegue al vigilante puede venir de una cuenta demo.
    const cuentas = await db.select().from(accounts).where(eq(accounts.isDemo, true));
    const idsDemo = new Set(cuentas.map((c) => c.id));
    for (const a of abiertas) {
      expect(idsDemo.has(a.carrierAccountId ?? "")).toBe(false);
    }
  });
});


/**
 * C21 · La compuerta del arreglo: **se provoca el aviso a propósito.**
 *
 * Un detector que devuelve cero se ve idéntico a uno que no corre, y hoy el
 * mundo real devuelve cero — al 7 de agosto de 2026 no queda ninguna
 * ocurrencia sin sellar con la hora límite vieja. O sea que una corrida limpia
 * de este cron en producción **no prueba nada por sí sola**: es exactamente la
 * forma en que dos generaciones del vigilante pasaron por sanas estando mudas.
 *
 * Lo que estas pruebas hacen es lo único que cuenta: **mueven un turno de
 * verdad** en la rama desechable y comprueban que el detector lo ve, con el
 * corrimiento exacto. Y comprueban el otro lado —que con el turno en su sitio
 * no encuentra nada—, porque una prueba que solo mira que algo salga pasa
 * igual de verde cuando sale por el motivo equivocado. Es la regla 17 aplicada
 * al medidor: contrastar no es correrlo otra vez, es **cambiar algo que
 * debería cambiar el resultado**.
 *
 * El terreno lo prepara **el generador de verdad**, `renewRollingWindow`, y no
 * un `insert` a mano: la hora límite que esto revisa es exactamente la que ese
 * generador congela, y sembrarla de otra forma probaría contra una fila que el
 * sistema nunca habría escrito así.
 *
 * ## Lo que estas pruebas NO cubren, y hay que decirlo
 *
 * Aquí termina la mitad de la detección. **La otra mitad es que el correo
 * llegue a una persona**, y ésa no se puede probar desde aquí: necesita
 * `RESEND_API_KEY` y `ALERTAS_DESTINATARIOS`. Hasta que ese aviso se haya
 * visto llegar a una bandeja, el instrumento no cuenta como probado. Detectar
 * y avisar son dos cosas, y la segunda casi nunca se prueba.
 */
describe("C21 · la revisión de horas límite", () => {
  const CORRIMIENTO_MINUTOS = 90;

  /**
   * Lo que esta suite creó, para poder deshacerlo.
   *
   * La primera versión llamaba a `renewRollingWindow(30)` y no borraba nada.
   * Funcionó, y **rompió la prueba del calendario en la corrida siguiente**:
   * las 89 ocurrencias que dejó incluían el lunes 24 de agosto que aquella
   * prueba genera ella misma, así que se lo encontró ya creado y contó cero.
   * La rama es desechable, pero desechable no es "sin estado": lo que una
   * prueba deja vive hasta que otra tropieza con ello, y el fallo aparece
   * lejos de su causa.
   */
  const creadas: string[] = [];

  beforeAll(async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    // Un solo perfil y una ventana estrecha por delante, en vez de renovar la
    // ventana rodante entera: el terreno que hace falta es "hay ocurrencias
    // futuras sin sellar", no "la base entera al día".
    const [perfil] = await db.select().from(serviceProfiles).where(eq(serviceProfiles.active, true));
    expect(perfil).toBeTruthy();

    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() + 20);
    const hasta = new Date(desde);
    hasta.setUTCDate(hasta.getUTCDate() + 5);

    const generado = await repos.occurrences.generateForProfile(perfil!.id, desde, hasta);
    creadas.push(...generado.createdIds);
    // El generador de verdad tiene que haber producido algo, o todo lo de
    // abajo mide sobre vacío.
    expect(creadas.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (creadas.length === 0) return;
    const db = createDb(DATABASE_URL);
    // Los viajes caen en cascada con la ocurrencia.
    await db.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, creadas));
  });

  it("hay terreno que revisar — el control que hace legible al cero", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const candidatas = await repos.occurrences.futurasSinSellarParaRevision();

    // Sin esto, todo lo de abajo pasaría en vacío: cero desalineadas sobre cero
    // ocurrencias no dice "todo alineado", dice "no vi nada".
    expect(candidatas.length).toBeGreaterThan(0);
  });

  it("con los turnos en su sitio no inventa desalineadas", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const revision = await revisarHorasLimite(repos);

    expect(revision.revisadas).toBeGreaterThan(0);
    expect(revision.desalineadas).toHaveLength(0);
  });

  it("mover un turno hace aparecer sus ocurrencias, con el corrimiento exacto", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const antes = await revisarHorasLimite(repos);
    const candidatas = await repos.occurrences.futurasSinSellarParaRevision();
    const objetivo = candidatas[0]!;
    const cuantas = candidatas.filter((c) => c.shiftId === objetivo.shiftId).length;
    expect(cuantas).toBeGreaterThan(0);

    const [h, m, s] = objetivo.shiftStartTime.split(":").map(Number);
    const movida = new Date(0);
    movida.setUTCHours(h ?? 0, (m ?? 0) + CORRIMIENTO_MINUTOS, s ?? 0);
    const horaNueva = movida.toISOString().slice(11, 19);

    try {
      // La provocación: alguien mueve el turno, y nada revisa lo ya generado.
      await db
        .update(shifts)
        .set({ startTime: horaNueva })
        .where(eq(shifts.id, objetivo.shiftId));

      const despues = await revisarHorasLimite(repos);

      // Mismo universo revisado: lo que cambió es el turno, no la lectura.
      expect(despues.revisadas).toBe(antes.revisadas);

      const delTurno = despues.desalineadas.filter((d) => d.turnoId === objetivo.shiftId);
      expect(delTurno).toHaveLength(cuantas);
      for (const d of delTurno) {
        expect(d.difMinutos).toBe(CORRIMIENTO_MINUTOS);
        expect(d.turnoInicio).toBe(horaNueva);
        // Lo guardado sigue siendo lo viejo: eso es el defecto, no un efecto
        // de la prueba. El generador congeló y nadie volvió a mirar.
        expect(d.derivada.getTime() - d.guardada.getTime()).toBe(
          CORRIMIENTO_MINUTOS * 60_000,
        );
      }
    } finally {
      // Se devuelve a su hora aunque la prueba falle a media corrida: la rama
      // es desechable, pero dejarla mintiendo hace que la siguiente prueba
      // mida otra cosa sin avisar.
      await db
        .update(shifts)
        .set({ startTime: objetivo.shiftStartTime })
        .where(eq(shifts.id, objetivo.shiftId));
    }

    // Y el detector sigue vivo después de devolver el turno a su sitio.
    const restaurado = await revisarHorasLimite(repos);
    expect(restaurado.revisadas).toBeGreaterThan(0);
    expect(restaurado.desalineadas.filter((d) => d.turnoId === objetivo.shiftId)).toHaveLength(
      0,
    );
  });

  it("una ocurrencia ya sellada sale de la lista: eso no se corrige, se re-verifica", async () => {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);

    const antes = await repos.occurrences.futurasSinSellarParaRevision();
    const objetivo = antes[0]!;

    const [fila] = await db
      .select({
        tripId: trips.id,
        geofenceId: serviceProfiles.geofenceId,
        policy: serviceContracts.policy,
      })
      .from(serviceOccurrences)
      .innerJoin(trips, eq(trips.serviceOccurrenceId, serviceOccurrences.id))
      .innerJoin(serviceProfiles, eq(serviceProfiles.id, serviceOccurrences.serviceProfileId))
      .innerJoin(serviceContracts, eq(serviceContracts.id, serviceOccurrences.contractId))
      .where(eq(serviceOccurrences.id, objetivo.id));
    expect(fila).toBeTruthy();

    const [hecho] = await db
      .insert(complianceFacts)
      .values({
        serviceOccurrenceId: objetivo.id,
        tripId: fila!.tripId,
        expectedDeadline: objetivo.expectedDeadline,
        expectedGeofenceId: fila!.geofenceId,
        status: "pendiente_evidencia",
        routeStrictnessApplied: "destino_only",
        contractPolicySnapshot: fila!.policy as ContractPolicy,
      })
      .returning();

    try {
      const despues = await repos.occurrences.futurasSinSellarParaRevision();
      expect(despues.some((d) => d.id === objetivo.id)).toBe(false);
      // El control: el resto sigue ahí, así que la exclusión no vació la lista.
      expect(despues.length).toBe(antes.length - 1);
    } finally {
      await db.delete(complianceFacts).where(eq(complianceFacts.id, hecho!.id));
    }
  });
});

/**
 * C21 · La historia del turno, y el trigger que la hace obligatoria.
 *
 * La opción 4 de la decisión del 7 de agosto: `shifts` no tenía `updated_at`,
 * así que el cambio del Turno B no se pudo fechar — solo acotar entre dos
 * corridas del cron.
 *
 * **La prueba que importa aquí es la del `UPDATE` crudo**, y es la que
 * distingue este arreglo del de C13. Allá el registro vive dentro de
 * `updatePolicy` desde el 31 de julio, y al 7 de agosto la tabla seguía en cero
 * filas porque la única edición real la hizo un guion con SQL crudo. Cerrar el
 * camino bueno no cierra la puerta de atrás; un trigger sí. Si esa prueba se
 * pudiera quitar sin que nada se ponga en rojo, este arreglo sería el de C13
 * otra vez.
 */
describe("C21 · la historia del turno", () => {
  const creados: string[] = [];

  /** Un turno propio: mover uno de los sembrados movería lo que otras miden. */
  async function turnoDePrueba(nombre: string) {
    const db = createDb(DATABASE_URL);
    const repos = createRepositories(db);
    const [plantilla] = await db.select().from(shifts).limit(1);
    expect(plantilla).toBeTruthy();

    const creado = await repos.routes.createShift({
      clientAccountId: plantilla!.clientAccountId,
      plantId: plantilla!.plantId,
      plantGroupId: plantilla!.plantGroupId,
      name: nombre,
      startTime: "04:00:00",
    });
    creados.push(creado.id);

    const scope: OperationalScope = plantilla!.plantId
      ? { kind: "plant", plantId: plantilla!.plantId }
      : { kind: "plant_group", plantGroupId: plantilla!.plantGroupId! };

    return { db, repos, turno: creado, scope, cuenta: plantilla!.clientAccountId };
  }

  afterAll(async () => {
    if (creados.length === 0) return;
    const db = createDb(DATABASE_URL);
    // La historia cae en cascada con el turno.
    await db.delete(shifts).where(inArray(shifts.id, creados));
  });

  it("un turno nuevo no trae historia ni fecha de edición inventada", async () => {
    const { repos, turno } = await turnoDePrueba("C21 · recién creado");

    expect(turno.updatedAt).toBeNull();
    expect(await repos.routes.getShiftHistory(turno.id)).toHaveLength(0);
  });

  it("mover el turno por el camino de la aplicación deja fila firmada, con su motivo", async () => {
    const { repos, turno, scope, cuenta } = await turnoDePrueba("C21 · por la app");

    const r = await repos.routes.updateShift(
      turno.id,
      cuenta,
      scope,
      { name: "C21 · por la app", startTime: "05:30:00" },
      { actorKind: "human", actorId: null, note: "la planta confirmó la hora" },
    );
    expect(r.ok).toBe(true);

    const historia = await repos.routes.getShiftHistory(turno.id);
    expect(historia).toHaveLength(1);
    expect(historia[0]!.actorKind).toBe("human");
    expect(historia[0]!.note).toBe("la planta confirmó la hora");
    expect(historia[0]!.startTimeBefore).toBe("04:00:00");
    expect(historia[0]!.startTimeAfter).toBe("05:30:00");
  });

  it("un UPDATE CRUDO también deja fila — firmada sql_directo", async () => {
    // ESTA es la prueba del trigger. C13 tiene el camino de la aplicación
    // cerrado desde el 31 de julio y la tabla en cero, porque la edición real
    // vino por aquí. Quitar esta prueba y nada se pone en rojo significaría
    // que el arreglo volvió a ser el de C13.
    const { db, repos, turno } = await turnoDePrueba("C21 · por SQL crudo");

    await db.execute(
      sql`update shifts set start_time = '06:45:00' where id = ${turno.id}`,
    );

    const historia = await repos.routes.getShiftHistory(turno.id);
    expect(historia).toHaveLength(1);
    expect(historia[0]!.actorKind).toBe("sql_directo");
    expect(historia[0]!.actorId).toBeNull();
    expect(historia[0]!.startTimeBefore).toBe("04:00:00");
    expect(historia[0]!.startTimeAfter).toBe("06:45:00");
  });

  it("la firma no se filtra de una transacción a la siguiente", async () => {
    // `set_config(..., true)` es transaccional. Si se hubiera escrito sin ese
    // tercer argumento, la firma de la última edición por la app quedaría
    // pegada a la conexión y el siguiente UPDATE crudo saldría firmado como
    // persona — una historia que miente sobre quién, que es peor que no
    // tenerla.
    const { db, repos, turno, scope, cuenta } = await turnoDePrueba("C21 · fuga de firma");

    await repos.routes.updateShift(
      turno.id,
      cuenta,
      scope,
      { name: "C21 · fuga de firma", startTime: "05:00:00" },
      { actorKind: "human", actorId: null, note: "primera" },
    );
    await db.execute(sql`update shifts set start_time = '06:00:00' where id = ${turno.id}`);

    const historia = await repos.routes.getShiftHistory(turno.id);
    expect(historia.map((h) => h.actorKind)).toEqual(["sql_directo", "human"]);
  });

  it("guardar sin cambiar nada NO genera fila", async () => {
    const { repos, turno, scope, cuenta } = await turnoDePrueba("C21 · sin cambios");

    await repos.routes.updateShift(
      turno.id,
      cuenta,
      scope,
      { name: "C21 · sin cambios", startTime: "04:00:00" },
      { actorKind: "human", actorId: null, note: null },
    );

    // Abrir el formulario y guardar sin tocar nada es común; registrarlo
    // escondería las ediciones de verdad entre entradas vacías.
    expect(await repos.routes.getShiftHistory(turno.id)).toHaveLength(0);
  });

  it("la cadena no tiene huecos: el después de una fila es el antes de la siguiente", async () => {
    const { repos, turno, scope, cuenta } = await turnoDePrueba("C21 · cadena");

    for (const hora of ["05:00:00", "06:00:00", "07:00:00"]) {
      await repos.routes.updateShift(
        turno.id,
        cuenta,
        scope,
        { name: "C21 · cadena", startTime: hora },
        { actorKind: "human", actorId: null, note: null },
      );
    }

    // De la más reciente hacia atrás; se recorre en orden cronológico.
    const historia = (await repos.routes.getShiftHistory(turno.id)).reverse();
    expect(historia).toHaveLength(3);
    for (let i = 1; i < historia.length; i++) {
      expect(historia[i]!.startTimeBefore).toBe(historia[i - 1]!.startTimeAfter);
    }
  });

  it("el trigger fecha la edición — updated_at deja de estar vacío", async () => {
    const { db, repos, turno, scope, cuenta } = await turnoDePrueba("C21 · fechado");

    await repos.routes.updateShift(
      turno.id,
      cuenta,
      scope,
      { name: "C21 · fechado", startTime: "05:15:00" },
      { actorKind: "human", actorId: null, note: null },
    );

    const [despues] = await db.select().from(shifts).where(eq(shifts.id, turno.id));
    // Es lo que no se pudo hacer cuando se movió el Turno B: fechar el cambio
    // en vez de acotarlo entre dos corridas del cron.
    expect(despues!.updatedAt).toBeInstanceOf(Date);
  });
});
