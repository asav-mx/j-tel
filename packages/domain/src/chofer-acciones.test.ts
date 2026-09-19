import { describe, expect, it } from "vitest";
import {
  PAPELES_QUE_ESPERAN_AL_ABOGADO,
  choqueDeChofer,
  identidadDeChoferCapturada,
  licenciaComparable,
  vencimientoCapturado,
} from "./chofer-acciones.js";

describe("la licencia se compara sin espacios, guiones ni mayúsculas (la expresión de la 0042)", () => {
  it("«CHIH-123 45» y «chih12345» son la misma", () => {
    expect(licenciaComparable("CHIH-123 45")).toBe(licenciaComparable("chih12345"));
    expect(licenciaComparable("  a-b  c ")).toBe("ABC");
  });
});

describe("la identidad capturada", () => {
  it("limpia el nombre y pone la licencia en mayúsculas, como viene impresa", () => {
    expect(identidadDeChoferCapturada({ nombre: "  Ana   Ruiz ", licencia: " chih-1 " })).toEqual({
      ok: true,
      identidad: { nombre: "Ana Ruiz", licencia: "CHIH-1" },
    });
  });

  it("una licencia que sólo tiene guiones y espacios está vacía", () => {
    expect(identidadDeChoferCapturada({ nombre: "Ana", licencia: " - - " })).toEqual({ ok: false, error: "licencia_vacia" });
  });
});

describe("el vencimiento del alta es opcional, pero si viene tiene que existir", () => {
  it("vacío es «la licencia no lo trae», no un error", () => {
    expect(vencimientoCapturado("  ")).toEqual({ ok: true, fecha: null });
  });
  it("el 30 de febrero no existe", () => {
    expect(vencimientoCapturado("2027-02-30")).toEqual({ ok: false, error: "fecha_invalida" });
    expect(vencimientoCapturado("2027-02-28")).toEqual({ ok: true, fecha: "2027-02-28" });
  });
});

describe("el choque con otro chofer de la cuenta", () => {
  const otros = [
    { id: "a", nombre: "Ramón Medina", licencia: "CHIH-1" },
    { id: "b", nombre: null, licencia: null },
  ];
  it("el nombre choca antes que la licencia, y dice el nombre que chocó", () => {
    expect(choqueDeChofer({ nombre: "RAMÓN medina", licencia: "chih1" }, otros)).toEqual({
      error: "nombre_repetido",
      mensaje: "Ya hay un chofer llamado «Ramón Medina» en esta cuenta.",
    });
  });
  it("la licencia repetida se dice como la tiene el otro chofer, no como se tecleó", () => {
    expect(choqueDeChofer({ nombre: "Otra Persona", licencia: "CHIH1" }, otros)).toEqual({
      error: "licencia_repetida",
      mensaje: "La licencia CHIH-1 ya es de otro chofer de esta cuenta.",
    });
  });
  it("no choca consigo mismo", () => {
    expect(choqueDeChofer({ nombre: "Ramón Medina", licencia: "CHIH-1" }, otros, "a")).toBeNull();
  });
});

describe("examen médico y antidoping esperan al abogado (enmienda 4)", () => {
  it("por su clave del catálogo, y la licencia no", () => {
    expect(PAPELES_QUE_ESPERAN_AL_ABOGADO).toEqual(["examen_medico", "antidoping"]);
    expect(PAPELES_QUE_ESPERAN_AL_ABOGADO).not.toContain("licencia");
  });
});
