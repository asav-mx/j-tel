import { describe, it, expect } from "vitest";
import {
  canAccessClientAccount,
  canAccessCarrierAccount,
  canAccessPlant,
  hasPermission,
  tieneAlcanceGlobal,
  type UserMembership,
} from "./index.js";

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

/**
 * El alcance global.
 *
 * Sale de un defecto concreto: la portada listaba las MEMBRESÍAS de quien
 * preguntaba, y una identidad con alcance global tiene **una sola fila** —la de
 * J-Staff— aunque su alcance sea toda la plataforma. Le enseñaba una puerta
 * teniendo derecho a todas. **La fila no es el alcance.**
 *
 * La otra mitad de estas pruebas es la que importa igual o más: que arreglar
 * eso **no le dé nada a nadie más**.
 */

const global: UserMembership = {
  accountId: "acc-jstaff",
  clerkUserId: "user-asav",
  role: "admin_plataforma",
  scopeType: "global",
  scopeId: null,
};

const deCuentaTecma: UserMembership = {
  accountId: "acc-tecma",
  clerkUserId: "user-tecma",
  role: "admin_corporativo",
  scopeType: "account",
  scopeId: "acc-tecma",
};

describe("alcance global", () => {
  it("alcanza cualquier cuenta de cliente, aunque su fila sea de otra cuenta", () => {
    expect(tieneAlcanceGlobal([global])).toBe(true);
    expect(canAccessClientAccount([global], "acc-tecma")).toBe(true);
    expect(canAccessClientAccount([global], "acc-honeywell")).toBe(true);
  });

  it("alcanza cualquier carrier", () => {
    expect(canAccessCarrierAccount([global], "acc-juarez-bus")).toBe(true);
  });

  it("alcanza cualquier planta de cualquier cuenta", () => {
    expect(canAccessPlant([global], "plant-99", "acc-tecma")).toBe(true);
  });
});

describe("lo que el alcance global NO cambia", () => {
  it("un usuario de cuenta sigue viendo solo la suya", () => {
    expect(tieneAlcanceGlobal([deCuentaTecma])).toBe(false);
    expect(canAccessClientAccount([deCuentaTecma], "acc-tecma")).toBe(true);
    expect(canAccessClientAccount([deCuentaTecma], "acc-honeywell")).toBe(false);
  });

  it("un usuario de planta sigue viendo solo su planta", () => {
    expect(tieneAlcanceGlobal([plantMembership])).toBe(false);
    expect(canAccessPlant([plantMembership], "plant-47", "acc-1")).toBe(true);
    expect(canAccessPlant([plantMembership], "plant-99", "acc-1")).toBe(false);
  });

  it("un usuario de carrier no alcanza cuentas de cliente", () => {
    const deCarrier: UserMembership = {
      accountId: "acc-juarez-bus",
      clerkUserId: "user-jb",
      role: "admin",
      scopeType: "account",
      scopeId: "acc-juarez-bus",
    };
    expect(canAccessClientAccount([deCarrier], "acc-tecma")).toBe(false);
  });

  /*
   * El alcance no reparte permisos: dice sobre QUÉ datos, no QUÉ se puede
   * hacer. `permisos = rol × alcance`, y esta función solo contesta la segunda
   * mitad. Un rol sin permiso sigue sin tenerlo por muy global que sea.
   */
  it("el alcance no le da permisos que el rol no tiene", () => {
    const choferGlobal: UserMembership = { ...global, role: "chofer" };
    expect(tieneAlcanceGlobal([choferGlobal])).toBe(true);
    expect(hasPermission(choferGlobal, "contract.manage")).toBe(false);
  });
});
