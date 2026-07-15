import { describe, it, expect } from "vitest";
import { computeEnforcement, computeMonthlyRebate } from "./enforcement.js";

describe("enforcement", () => {
  const policy = {
    toleranceMinutes: 10,
    verificationGraceMinutes: 15,
    routeStrictness: "destino_only" as const,
    kmlMatchMinPct: 60,
    kmlCorridorMeters: 120,
    kmlCorridorMinPct: 60,
    allowAlternateDestination: false,
    excusableReasons: [],
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
