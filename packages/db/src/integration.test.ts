import { describe, it, expect, beforeAll } from "vitest";
import {
  createDb,
  createRepositories,
  serviceOccurrences,
  trips,
  complianceFactHistory,
} from "../src/index.js";
import { eq, inArray } from "drizzle-orm";
import type { ContractPolicy } from "@jtel/domain";

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
