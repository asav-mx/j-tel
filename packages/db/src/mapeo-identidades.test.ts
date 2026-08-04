import { describe, it, expect } from "vitest";
import {
  MAPEO,
  planDeVinculacion,
  validarVinculo,
  type FilaDeMembresia,
} from "./mapeo-identidades.js";

const CUENTA_JSTAFF = "11111111-1111-1111-1111-111111111111";
const CUENTA_TECMA = "22222222-2222-2222-2222-222222222222";
const PLANTA_47 = "33333333-3333-3333-3333-333333333333";

/** La membresía de `jstaff_admin`: global y **sin `scope_id`**. */
const global: FilaDeMembresia = {
  accountId: CUENTA_JSTAFF,
  role: "admin_plataforma",
  scopeType: "global",
};

const deCuenta: FilaDeMembresia = {
  accountId: CUENTA_TECMA,
  role: "admin_corporativo",
  scopeType: "account",
  scopeId: CUENTA_TECMA,
};

const dePlanta: FilaDeMembresia = {
  accountId: CUENTA_TECMA,
  role: "usuario_planta",
  scopeType: "plant",
  scopeId: PLANTA_47,
};

describe("plan de vinculación", () => {
  it("con el destino vacío, copia todo el origen", () => {
    expect(planDeVinculacion([global, deCuenta], [])).toEqual([global, deCuenta]);
  });

  it("no repite lo que el destino ya tiene", () => {
    expect(planDeVinculacion([global, deCuenta], [global])).toEqual([deCuenta]);
  });

  it("correrlo dos veces no inserta nada la segunda", () => {
    const primera = planDeVinculacion([global, deCuenta, dePlanta], []);
    expect(primera).toHaveLength(3);
    // El destino ya quedó con lo que la primera corrida insertó.
    expect(planDeVinculacion([global, deCuenta, dePlanta], primera)).toEqual([]);
  });

  /*
   * La trampa que la base NO atrapa. El índice único incluye `scope_id`, y en
   * Postgres dos NULL no chocan: sin esta deduplicación, la membresía global
   * —la única que se liga hoy— se podría duplicar corriendo el script dos
   * veces. La prueba falla si alguien delega esto al índice.
   */
  it("trata dos alcances sin scope_id como la misma membresía", () => {
    expect(planDeVinculacion([global], [global])).toEqual([]);
  });

  it("da igual que el alcance ausente venga como null o como undefined", () => {
    const conNull: FilaDeMembresia = { ...global, scopeId: null };
    const conUndefined: FilaDeMembresia = { ...global, scopeId: undefined };
    expect(planDeVinculacion([conNull], [conUndefined])).toEqual([]);
  });

  it("un origen con la misma fila repetida inserta una sola vez", () => {
    expect(planDeVinculacion([global, { ...global }], [])).toEqual([global]);
  });

  it("distingue dos plantas distintas dentro de la misma cuenta", () => {
    const otraPlanta: FilaDeMembresia = { ...dePlanta, scopeId: CUENTA_JSTAFF };
    expect(planDeVinculacion([dePlanta, otraPlanta], [])).toHaveLength(2);
  });

  it("nunca quita: lo que sobra en el destino no aparece en el plan", () => {
    expect(planDeVinculacion([global], [global, deCuenta])).toEqual([]);
  });
});

describe("validación del vínculo", () => {
  it("acepta un vínculo del seed hacia una identidad de Clerk", () => {
    expect(validarVinculo({ desde: "jstaff_admin", hacia: "user_2abc", nota: "Asav" })).toBeNull();
  });

  it("rechaza un destino que no viene de Clerk", () => {
    expect(validarVinculo({ desde: "jstaff_admin", hacia: "otro_admin", nota: "" })).toBe(
      "destino-no-es-de-clerk",
    );
  });

  it("rechaza ligar desde una identidad ya real", () => {
    expect(validarVinculo({ desde: "user_2abc", hacia: "user_2def", nota: "" })).toBe(
      "origen-es-de-clerk",
    );
  });

  it("rechaza el vínculo consigo mismo", () => {
    expect(validarVinculo({ desde: "jstaff_admin", hacia: "jstaff_admin", nota: "" })).toBe(
      "origen-igual-a-destino",
    );
  });

  it("rechaza los vacíos", () => {
    expect(validarVinculo({ desde: "", hacia: "user_2abc", nota: "" })).toBe("vacio");
    expect(validarVinculo({ desde: "jstaff_admin", hacia: "   ", nota: "" })).toBe("vacio");
  });
});

describe("el mapeo versionado", () => {
  /*
   * El mapeo entra al repo, así que una entrada mal escrita se despliega. Esta
   * prueba es la que impide que una línea nueva pase sin revisión.
   */
  it("todas sus entradas son válidas", () => {
    for (const v of MAPEO) {
      expect(validarVinculo(v), `vínculo inválido: ${v.desde} → ${v.hacia}`).toBeNull();
    }
  });

  it("no liga dos veces la misma identidad de Clerk", () => {
    const destinos = MAPEO.map((v) => v.hacia);
    expect(new Set(destinos).size).toBe(destinos.length);
  });

  it("cada entrada dice quién es", () => {
    for (const v of MAPEO) {
      expect(v.nota.trim().length, `el vínculo ${v.desde} no dice a quién liga`).toBeGreaterThan(0);
    }
  });
});
