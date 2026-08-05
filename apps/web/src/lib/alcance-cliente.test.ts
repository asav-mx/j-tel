import { describe, it, expect } from "vitest";
import type { UserMembership } from "@jtel/auth-rbac";
import type { OperationalUnit } from "@jtel/domain";
import { unidadesVisibles, vistaCubreLaCuenta } from "./alcance-cliente";

/**
 * El filtro de sitios por membresía — pieza 1.d.
 *
 * Lo que estas pruebas fijan no es "enseña lo correcto": es que **no enseñe
 * todo cuando no sabe**. La mitad de arriba mide lo que se ve; la de abajo mide
 * que la ausencia de un dato no se lea como permiso, que es la forma exacta del
 * fallo que cerró el #222 en `resolveAccountByType`.
 */

const CUENTA = "cuenta-tecma";
const OTRA_CUENTA = "cuenta-honeywell";

const PLANTA_SUELTA: OperationalUnit = {
  kind: "plant",
  id: "planta-47",
  name: "Planta 47",
  code: "47",
};

const OTRA_PLANTA_SUELTA: OperationalUnit = {
  kind: "plant",
  id: "planta-88",
  name: "Planta 88",
  code: "88",
};

const CAMPUS: OperationalUnit = {
  kind: "plant_group",
  id: "campus-sd",
  name: "Campus Santos Dumont",
  memberPlants: [
    { id: "planta-20", name: "Planta 20", code: "20" },
    { id: "planta-21", name: "Planta 21", code: "21" },
  ],
};

const TODAS = [PLANTA_SUELTA, OTRA_PLANTA_SUELTA, CAMPUS];

function membresía(extra: Partial<UserMembership>): UserMembership {
  return {
    accountId: CUENTA,
    clerkUserId: "user-x",
    role: "usuario_planta",
    scopeType: "plant",
    scopeId: null,
    ...extra,
  };
}

const nombres = (us: OperationalUnit[]) => us.map((u) => u.name);

describe("quien alcanza la cuenta entera ve todo", () => {
  it("alcance global", () => {
    const global = membresía({
      accountId: "cuenta-jstaff",
      role: "admin_plataforma",
      scopeType: "global",
    });
    expect(unidadesVisibles(TODAS, [global], CUENTA)).toEqual(TODAS);
    expect(vistaCubreLaCuenta([global], CUENTA)).toBe(true);
  });

  it("alcance de cuenta", () => {
    const deCuenta = membresía({ role: "admin_corporativo", scopeType: "account", scopeId: CUENTA });
    expect(unidadesVisibles(TODAS, [deCuenta], CUENTA)).toEqual(TODAS);
    expect(vistaCubreLaCuenta([deCuenta], CUENTA)).toBe(true);
  });
});

describe("quien alcanza un sitio ve ese sitio, y nada más de la cuenta", () => {
  it("una planta suelta", () => {
    const dePlanta = membresía({ scopeType: "plant", scopeId: "planta-47" });

    expect(nombres(unidadesVisibles(TODAS, [dePlanta], CUENTA))).toEqual(["Planta 47"]);
    // La otra planta de la MISMA cuenta no sale: la ley es entre operaciones,
    // no entre cuentas.
    expect(nombres(unidadesVisibles(TODAS, [dePlanta], CUENTA))).not.toContain("Planta 88");
    expect(vistaCubreLaCuenta([dePlanta], CUENTA)).toBe(false);
  });

  it("un campus por su propio id", () => {
    const deCampus = membresía({ scopeType: "plant_group", scopeId: "campus-sd" });
    expect(nombres(unidadesVisibles(TODAS, [deCampus], CUENTA))).toEqual(["Campus Santos Dumont"]);
  });

  /**
   * `Ficha-Diseno-Permisos.md` §2.2 y §2.3, confirmado por Asav el 31 de julio
   * de 2026: el transporte compartido es del campus, no de la planta. Y hay una
   * razón mecánica además de la de producto — `getOperationalUnits` no lista
   * como sitio propio a una planta agrupada, así que buscar solo por id de
   * unidad le dejaría la pantalla vacía a quien sí tiene dónde mirar.
   */
  it("una planta DENTRO de un campus ve el campus entero", () => {
    const dePlanta20 = membresía({ scopeType: "plant", scopeId: "planta-20" });
    expect(nombres(unidadesVisibles(TODAS, [dePlanta20], CUENTA))).toEqual([
      "Campus Santos Dumont",
    ]);
  });

  it("dos membresías suman sitios, no los pisan", () => {
    const dos = [
      membresía({ scopeType: "plant", scopeId: "planta-47" }),
      membresía({ scopeType: "plant_group", scopeId: "campus-sd" }),
    ];
    expect(nombres(unidadesVisibles(TODAS, dos, CUENTA))).toEqual([
      "Planta 47",
      "Campus Santos Dumont",
    ]);
  });
});

/**
 * La mitad que importa. Cada uno de estos casos devolvería **la cuenta entera**
 * si el filtro fallara abierto, y ninguno daría error ni prueba roja en otra
 * parte: se vería igual que un filtro que funciona.
 */
describe("falla cerrado — la ausencia de alcance no es permiso", () => {
  it("sin membresías, ningún sitio", () => {
    expect(unidadesVisibles(TODAS, [], CUENTA)).toEqual([]);
    expect(vistaCubreLaCuenta([], CUENTA)).toBe(false);
  });

  it("membresía de otra cuenta, ningún sitio de ésta", () => {
    const deOtra = membresía({ accountId: OTRA_CUENTA, scopeType: "account", scopeId: OTRA_CUENTA });
    expect(unidadesVisibles(TODAS, [deOtra], CUENTA)).toEqual([]);
  });

  /*
   * Sale de una prueba de mutación: quitarle a la función el filtro por cuenta
   * —`m.accountId === clientAccountId`— dejaba las trece pruebas en verde. Un
   * id de planta que se repita entre dos cuentas habría abierto el sitio ajeno,
   * y nada lo habría dicho. Es la pared entre cuentas, medida donde se rompe.
   */
  it("una membresía de OTRA cuenta no abre un sitio de ésta, aunque el id coincida", () => {
    const deOtraConMismoId = membresía({
      accountId: OTRA_CUENTA,
      scopeType: "plant",
      scopeId: "planta-47",
    });
    expect(unidadesVisibles(TODAS, [deOtraConMismoId], CUENTA)).toEqual([]);
  });

  it("lo mismo con un campus: el id ajeno no cruza la pared de la cuenta", () => {
    const deOtraConCampus = membresía({
      accountId: OTRA_CUENTA,
      scopeType: "plant_group",
      scopeId: "campus-sd",
    });
    expect(unidadesVisibles(TODAS, [deOtraConCampus], CUENTA)).toEqual([]);
  });

  it("alcance de planta apuntando a una planta que no es de esta cuenta", () => {
    const ajena = membresía({ scopeType: "plant", scopeId: "planta-de-otro-lado" });
    expect(unidadesVisibles(TODAS, [ajena], CUENTA)).toEqual([]);
  });

  it("alcance de planta sin id no abre nada", () => {
    const sinId = membresía({ scopeType: "plant", scopeId: null });
    expect(unidadesVisibles(TODAS, [sinId], CUENTA)).toEqual([]);
  });

  /*
   * `contract` apunta a un contrato y `fleet` no tiene caso de uso (ficha §5).
   * Ninguno de los dos sabe traducirse a un sitio, así que no adivinan: la
   * respuesta a "no sé" es vacío, nunca todo.
   */
  it("alcance de contrato no resuelve sitios", () => {
    const deContrato = membresía({ scopeType: "contract", scopeId: "contrato-1" });
    expect(unidadesVisibles(TODAS, [deContrato], CUENTA)).toEqual([]);
  });

  it("alcance de flota no resuelve sitios", () => {
    const deFlota = membresía({ scopeType: "fleet", scopeId: "flota-1" });
    expect(unidadesVisibles(TODAS, [deFlota], CUENTA)).toEqual([]);
  });
});

/**
 * La advertencia 3 del archivo, fijada como prueba para que deje de ser cierta
 * con ruido y no en silencio.
 *
 * Hoy `/cliente` resuelve su cuenta con `canAccessClientAccount`, que un usuario
 * de planta NO pasa — así que este filtro no le cambia la pantalla a nadie
 * todavía. El día que 1.h abra la puerta por alcance, esta prueba se cae y
 * obliga a leer el comentario antes de borrarla.
 */
describe("el límite conocido, mientras 1.h no exista", () => {
  it("un usuario de planta no alcanza la cuenta, así que hoy ni siquiera llega a este filtro", () => {
    const dePlanta = membresía({ scopeType: "plant", scopeId: "planta-47" });
    expect(vistaCubreLaCuenta([dePlanta], CUENTA)).toBe(false);
  });
});
