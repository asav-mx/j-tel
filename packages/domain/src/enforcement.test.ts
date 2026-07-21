import { describe, it, expect } from "vitest";
import { computeEnforcement, computeMonthlyRebate } from "./enforcement.js";
import { contractPolicySchema } from "./index.js";

describe("enforcement", () => {
  const policy = {
    toleranceMinutes: 10,
    verificationGraceMinutes: 15,
    routeStrictness: "destino_only" as const,
    kmlMatchMinPct: 60,
    kmlCorridorMeters: 120,
    kmlCorridorMinPct: 60,
    excusableReasons: [],
    permitirConsolidacion: false,
    enforcementRules: [
      {
        type: "rebate_escalonado" as const,
        toleranceMinutes: 10,
        baseRebatePercent: 2,
        baseFailureCount: 2,
        additionalRebatePercent: 1,
      },
    ],
    evidenceMarginMinutesBefore: 60,
    evidenceMarginMinutesAfter: 30,
    arrivalAnticipationMinutes: 15,
    maxRouteDurationMinutes: 60,
    evidenceMinCoveragePct: 80,
    evidenceMaxGapMinutes: 10,
  };

  it("Honeywell: rebate 2% por 2 faltas, +1% cada una", () => {
    expect(computeMonthlyRebate(1, policy.enforcementRules)).toBe(0);
    expect(computeMonthlyRebate(2, policy.enforcementRules)).toBe(2);
    expect(computeMonthlyRebate(4, policy.enforcementRules)).toBe(4);
  });

  it("Tecma: no_pago cuando no cumplido", () => {
    const tecmaPolicy = {
      ...policy,
      enforcementRules: [{ type: "no_pago_viaje" as const, toleranceMinutes: 5 }],
    };
    const outcomes = computeEnforcement("no_cumplido", "tarde", false, tecmaPolicy);
    expect(outcomes[0]?.applies).toBe(true);
    expect(outcomes[0]?.description).toContain("retraso mayor a 5 min");
  });

  it("Tecma: no_pago por sin servicio (timing null) no habla de retraso", () => {
    const tecmaPolicy = {
      ...policy,
      enforcementRules: [{ type: "no_pago_viaje" as const, toleranceMinutes: 5 }],
    };
    const outcomes = computeEnforcement("no_cumplido", null, false, tecmaPolicy);
    expect(outcomes[0]?.applies).toBe(true);
    expect(outcomes[0]?.description).toContain("sin servicio detectado");
    expect(outcomes[0]?.description).not.toContain("retraso");
  });
});

describe("contractPolicySchema — permitirConsolidacion", () => {
  const base = {
    toleranceMinutes: 5,
    routeStrictness: "destino_only" as const,
  };

  it("default es false (exclusividad)", () => {
    const parsed = contractPolicySchema.parse(base);
    expect(parsed.permitirConsolidacion).toBe(false);
  });

  it("acepta true (consolidación activada)", () => {
    const parsed = contractPolicySchema.parse({ ...base, permitirConsolidacion: true });
    expect(parsed.permitirConsolidacion).toBe(true);
  });

  it("acepta false explícito", () => {
    const parsed = contractPolicySchema.parse({ ...base, permitirConsolidacion: false });
    expect(parsed.permitirConsolidacion).toBe(false);
  });
});
