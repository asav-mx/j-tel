import { describe, expect, it } from "vitest";
import {
  NOMBRE_DE_UNIDAD_MAX,
  choqueDeIdentidad,
  esVinValido,
  identidadCapturada,
  nombreComparable,
  normalizarVin,
} from "./unidad-acciones.js";

describe("el nombre de una unidad", () => {
  it("«2101», « 2101 » y «2101 » son el mismo nombre", () => {
    expect(nombreComparable(" 2101 ")).toBe(nombreComparable("2101"));
    expect(nombreComparable("2101 ")).toBe("2101");
  });

  it("sin mayúsculas y con los espacios de en medio contados como uno", () => {
    expect(nombreComparable("AB  1")).toBe(nombreComparable("ab 1"));
    expect(nombreComparable("Jeep")).toBe("jeep");
  });

  it("se guarda limpio pero con sus mayúsculas: como lo escribe el transportista", () => {
    const r = identidadCapturada({ nombre: "  Jeep   Rojo ", placa: null, vin: null });
    expect(r).toEqual({ ok: true, identidad: { nombre: "Jeep Rojo", placa: null, vin: null } });
  });

  it("vacío o larguísimo no es nombre", () => {
    expect(identidadCapturada({ nombre: "   ", placa: null, vin: null })).toEqual({ ok: false, error: "nombre_vacio" });
    expect(identidadCapturada({ nombre: "x".repeat(NOMBRE_DE_UNIDAD_MAX + 1), placa: null, vin: null })).toEqual({
      ok: false,
      error: "nombre_largo",
    });
  });
});

describe("el VIN", () => {
  it("se normaliza: mayúsculas, sin espacios ni guiones", () => {
    expect(normalizarVin(" 1hgcm8263 3a-004352 ")).toBe("1HGCM82633A004352");
  });

  it("vacío es «sin VIN», no un VIN inválido: es opcional", () => {
    expect(normalizarVin("")).toBeNull();
    expect(normalizarVin("  - ")).toBeNull();
    expect(identidadCapturada({ nombre: "2101", placa: "", vin: "" })).toEqual({
      ok: true,
      identidad: { nombre: "2101", placa: null, vin: null },
    });
  });

  it("17 letras y números, sin I, O ni Q", () => {
    expect(esVinValido("1HGCM82633A004352")).toBe(true);
    expect(esVinValido("1HGCM82633A00435")).toBe(false); // 16
    expect(esVinValido("1HGCM82633A0043521")).toBe(false); // 18
    expect(esVinValido("1HGCM8263IA004352")).toBe(false); // I
    expect(esVinValido("1HGCM8263OA004352")).toBe(false); // O
    expect(esVinValido("1HGCM8263QA004352")).toBe(false); // Q
    expect(identidadCapturada({ nombre: "2101", placa: null, vin: "ABC" })).toEqual({ ok: false, error: "vin_invalido" });
  });

  it("el dígito verificador no se exige: un VIN mexicano sin él no se rechaza", () => {
    // Posición 9 = «X» es válida en EE. UU. sólo si el cálculo da 10; aquí no se calcula.
    expect(esVinValido("3N1AB7AP5KY000001")).toBe(true);
  });
});

describe("la placa", () => {
  it("se guarda en mayúsculas y limpia; vacía es sin placa", () => {
    const r = identidadCapturada({ nombre: "2101", placa: " abc-12 34 ", vin: null });
    expect(r).toEqual({ ok: true, identidad: { nombre: "2101", placa: "ABC-12 34", vin: null } });
  });
});

describe("dos unidades no se llaman igual en la misma cuenta", () => {
  const cuenta = [
    { id: "u-2101", label: "2101", vin: null },
    { id: "u-jeep", label: "Jeep", vin: "1HGCM82633A004352" },
  ];
  const identidad = (nombre: string, vin: string | null = null) => ({ nombre, placa: null, vin });

  it("dar de alta otra 2101 choca, aunque venga con espacios o en otra caja", () => {
    expect(choqueDeIdentidad(identidad("2101"), cuenta)).toEqual({
      error: "nombre_repetido",
      mensaje: "Ya hay una unidad 2101 en esta cuenta.",
    });
    expect(choqueDeIdentidad(identidad("JEEP"), cuenta)?.error).toBe("nombre_repetido");
  });

  it("el VIN tampoco se repite dentro de la cuenta", () => {
    expect(choqueDeIdentidad(identidad("2102", "1HGCM82633A004352"), cuenta)).toEqual({
      error: "vin_repetido",
      mensaje: "El VIN 1HGCM82633A004352 ya es de otra unidad de esta cuenta.",
    });
  });

  it("corregir la 2101 sin cambiar su nombre no choca consigo misma", () => {
    expect(choqueDeIdentidad(identidad("2101"), cuenta, "u-2101")).toBeNull();
  });

  it("pero renombrarla al nombre de otra sí choca", () => {
    expect(choqueDeIdentidad(identidad("Jeep"), cuenta, "u-2101")?.error).toBe("nombre_repetido");
  });

  it("un nombre libre no choca", () => {
    expect(choqueDeIdentidad(identidad("2102"), cuenta)).toBeNull();
  });
});
