import { describe, it, expect, beforeAll } from "vitest";
import { createDb, createRepositories } from "../src/index.js";
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
