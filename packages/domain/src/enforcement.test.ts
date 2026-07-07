import { describe, it, expect } from "vitest";
import { computeEnforcement, computeMonthlyRebate } from "./enforcement.js";

describe("enforcement", () => {
  const policy = {
    toleranceMinutes: 10,
    verificationGraceMinutes: 15,
    routeStrictness: "destino_only" as const,
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
  });
});
