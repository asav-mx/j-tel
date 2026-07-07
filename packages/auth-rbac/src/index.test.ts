import { describe, it, expect } from "vitest";
import { canAccessPlant, hasPermission, type UserMembership } from "./index.js";

const plantMembership: UserMembership = {
  accountId: "acc-1",
  clerkUserId: "user-1",
  role: "usuario_planta",
  scopeType: "plant",
  scopeId: "plant-47",
};

describe("hasPermission", () => {
  it("allows plant user to read compliance-related permissions", () => {
    expect(hasPermission(plantMembership, "compliance.read")).toBe(true);
  });

  it("denies plant user from managing contracts", () => {
    expect(hasPermission(plantMembership, "contract.manage")).toBe(false);
  });
});

describe("canAccessPlant", () => {
  it("allows access to own plant only", () => {
    expect(canAccessPlant([plantMembership], "plant-47", "acc-1")).toBe(true);
    expect(canAccessPlant([plantMembership], "plant-99", "acc-1")).toBe(false);
  });
});
