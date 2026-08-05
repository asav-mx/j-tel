import { describe, it, expect } from "vitest";
import {
  ROLES_DECLARADOS,
  ROLES_PARQUEADOS,
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

/**
 * Los roles parqueados — D10 del plan.
 *
 * Esto es la regla 8 aplicada a los roles. `hasPermission` resuelve
 * `ROLE_PERMISSIONS[rol] ?? []`, así que **un rol no declarado y uno declarado
 * sin permisos son indistinguibles desde el código**: los dos contestan «no» a
 * todo. Si la declaración no se prueba, declarar no significa nada — es una
 * defensa que ninguna prueba distingue de su ausencia.
 *
 * Estas pruebas son lo que le da sentido a la declaración. Miden las dos
 * mitades por separado:
 *
 *  1. **Que estén declarados** — lo que `hasPermission` no puede decir.
 *  2. **Que no puedan nada** — y que darle un permiso a uno rompa esto.
 */
describe("roles parqueados: declarados a propósito, y sin poder hacer nada", () => {
  it("los dos están declarados — que es justo lo que hasPermission no distingue", () => {
    // Sin esta aserción, borrar el rol de la tabla no rompería nada: seguiría
    // contestando «no» a todo, exactamente igual que ahora.
    for (const rol of ROLES_PARQUEADOS) {
      expect(ROLES_DECLARADOS).toContain(rol);
    }
    expect(ROLES_PARQUEADOS.length).toBeGreaterThan(0);
  });

  it("ninguno puede nada, ni siquiera lo suyo", () => {
    const permisos = [
      "*",
      "self.read",
      "client.manage",
      "client.read",
      "plant.read",
      "compliance.read",
      "fleet.read",
      "report.read",
      "inspection.manage",
    ];

    for (const rol of ROLES_PARQUEADOS) {
      const m: UserMembership = { ...plantMembership, role: rol };
      for (const p of permisos) {
        expect(hasPermission(m, p), `${rol} no debería poder ${p}`).toBe(false);
      }
    }
  });

  /**
   * `chofer` traía `["self.read"]` mientras `Ficha-Diseno-Permisos.md` §5 decía
   * «sin permisos activos». Ganó la ficha: ahí vive la decisión de producto, y
   * el permiso nunca fue una decisión — era un marcador de sitio sin un solo
   * llamador. Esta prueba es lo que impide que vuelva a colarse.
   */
  it("chofer no recupera self.read por descuido", () => {
    const m: UserMembership = { ...plantMembership, role: "chofer" };
    expect(hasPermission(m, "self.read")).toBe(false);
  });

  /**
   * El alcance no reparte permisos. Un rol parqueado con alcance global sigue
   * sin poder nada: `permisos = rol × alcance`, y el rol aporta cero.
   */
  it("el alcance global no le presta permisos a un rol parqueado", () => {
    for (const rol of ROLES_PARQUEADOS) {
      const m: UserMembership = { ...global, role: rol };
      expect(hasPermission(m, "client.manage")).toBe(false);
      // Pero el alcance sí sigue siendo alcance: eso no lo toca el rol.
      expect(tieneAlcanceGlobal([m])).toBe(true);
    }
  });
});
