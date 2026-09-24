import { describe, it, expect } from "vitest";
import {
  LARGO_DE_LA_HUELLA,
  PALABRAS_DE_ERROR_DE_LECTOR,
  PREFIJO_DE_LECTOR,
  huellaDeLlave,
  llavePublicaBienFormada,
  nombreDeLector,
  procedeAsignarLector,
  procedeBajaDeLector,
  procedeSoltarLector,
} from "./lector-acciones.js";

const enBodega = { bajaEn: null, unidadVigenteId: null };
const montado = { bajaEn: null, unidadVigenteId: "u-1" };
const deBaja = { bajaEn: new Date("2026-09-23T00:00:00Z"), unidadVigenteId: null };
const unidad = { id: "u-1", active: true };

describe("el nombre de un lector", () => {
  it("lleva su prefijo y tres cifras", () => {
    expect(nombreDeLector(9)).toBe("LEC-009");
    expect(nombreDeLector(1)).toBe(`${PREFIJO_DE_LECTOR}-001`);
  });

  /* Truncar el 1000 a 100 le pondría a un lector el nombre de otro. */
  it("no trunca cuando pasa de tres cifras", () => {
    expect(nombreDeLector(1000)).toBe("LEC-1000");
  });

  it("un consecutivo que no es número no da nombre", () => {
    expect(() => nombreDeLector(0)).toThrow();
    expect(() => nombreDeLector(1.5)).toThrow();
  });
});

describe("la llave del lector", () => {
  it("son 64 hexadecimales en minúscula, y nada más", () => {
    expect(llavePublicaBienFormada("a".repeat(64))).toBe(true);
    expect(llavePublicaBienFormada("A".repeat(64))).toBe(false);
    expect(llavePublicaBienFormada("a".repeat(63))).toBe(false);
    expect(llavePublicaBienFormada("z".repeat(64))).toBe(false);
    expect(llavePublicaBienFormada("")).toBe(false);
  });
});

describe("la huella que se compara a ojo", () => {
  it("son los últimos seis caracteres de la llave", () => {
    expect(huellaDeLlave("a".repeat(58) + "9f3c1d")).toBe("9f3c1d");
    expect(LARGO_DE_LA_HUELLA).toBe(6);
  });

  /* Una huella de una llave que no es llave no se enseña: sería decir «éste es
     el aparato» de algo que ni siquiera se pudo registrar. */
  it("una llave mal formada no tiene huella", () => {
    expect(huellaDeLlave("no-es-hex")).toBe("");
    expect(huellaDeLlave("a".repeat(63))).toBe("");
    expect(huellaDeLlave("")).toBe("");
  });

  it("dos llaves distintas casi nunca comparten huella, y cuando la comparten no es la llave", () => {
    const una = "a".repeat(58) + "9f3c1d";
    const otra = "b".repeat(58) + "9f3c1d";
    expect(huellaDeLlave(una)).toBe(huellaDeLlave(otra));
    /* Por eso lo que se guarda y se compara de verdad es la llave entera. */
    expect(una).not.toBe(otra);
  });
});

describe("cuándo procede cada acción", () => {
  it("un lector en bodega se asigna a una unidad activa", () => {
    expect(procedeAsignarLector(enBodega, unidad)).toEqual({ ok: true });
  });

  it("un lector de baja no se asigna: su llave ya no vale", () => {
    expect(procedeAsignarLector(deBaja, unidad)).toEqual({ ok: false, error: "lector_de_baja" });
  });

  it("una unidad inactiva no recibe lector", () => {
    expect(procedeAsignarLector(enBodega, { id: "u-1", active: false })).toEqual({
      ok: false,
      error: "unidad_inactiva",
    });
  });

  it("asignarlo donde ya está no parte su historia en dos", () => {
    expect(procedeAsignarLector(montado, unidad)).toEqual({ ok: false, error: "ya_asignado_ahi" });
  });

  it("soltar: sólo lo que está montado", () => {
    expect(procedeSoltarLector(montado)).toEqual({ ok: true });
    expect(procedeSoltarLector(enBodega)).toEqual({ ok: false, error: "no_esta_montado" });
  });

  it("dar de baja: una sola vez, montado o no", () => {
    expect(procedeBajaDeLector(montado)).toEqual({ ok: true });
    expect(procedeBajaDeLector(enBodega)).toEqual({ ok: true });
    expect(procedeBajaDeLector(deBaja)).toEqual({ ok: false, error: "ya_de_baja" });
  });
});

describe("las palabras del error", () => {
  /* Un camión trae GPS y lector: decir «dispositivo» manda a revisar el otro. */
  it("hablan del lector, nunca del dispositivo", () => {
    for (const frase of Object.values(PALABRAS_DE_ERROR_DE_LECTOR)) {
      expect(frase.toLowerCase()).not.toContain("dispositivo");
    }
    expect(PALABRAS_DE_ERROR_DE_LECTOR.lector_de_baja).toContain("lector");
  });
});
