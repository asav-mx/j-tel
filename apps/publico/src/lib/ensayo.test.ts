import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { arrancoParaEstaConsulta, llaveDeEnsayoValida, VARIABLE_DE_LA_LLAVE } from "./ensayo";

/* Una llave de a mentiras, nueva en cada corrida: ninguna llave real vive en el repo. */
const LLAVE = randomBytes(24).toString("base64url");
const entorno = (valor: string | undefined) => ({ [VARIABLE_DE_LA_LLAVE]: valor });

describe("la llave de ensayo", () => {
  it("abre sólo con la llave exacta", () => {
    expect(llaveDeEnsayoValida(LLAVE, entorno(LLAVE))).toBe(true);
    expect(llaveDeEnsayoValida(`${LLAVE}x`, entorno(LLAVE))).toBe(false);
    expect(llaveDeEnsayoValida(LLAVE.slice(0, -1), entorno(LLAVE))).toBe(false);
    expect(llaveDeEnsayoValida("", entorno(LLAVE))).toBe(false);
    expect(llaveDeEnsayoValida(null, entorno(LLAVE))).toBe(false);
  });

  it("apagada —sin variable— no abre con nada", () => {
    expect(llaveDeEnsayoValida(LLAVE, entorno(undefined))).toBe(false);
    expect(llaveDeEnsayoValida("", entorno(""))).toBe(false);
  });

  it("una llave corta cuenta como apagada: una palabra que se adivina no es una llave", () => {
    expect(llaveDeEnsayoValida("pruebas", entorno("pruebas"))).toBe(false);
    const corta = "x".repeat(31);
    expect(llaveDeEnsayoValida(corta, entorno(corta))).toBe(false);
  });
});

describe("ya arrancó, para esta consulta", () => {
  const ZONA = "America/Ciudad_Juarez";
  const antes = new Date("2026-09-29T18:00:00Z"); // martes del ensayo
  const despues = new Date("2026-10-02T18:00:00Z");

  it("antes de la fecha: la pública dice que no, la de ensayo que sí", () => {
    expect(arrancoParaEstaConsulta(antes, "2026-10-01", ZONA, false)).toBe(false);
    expect(arrancoParaEstaConsulta(antes, "2026-10-01", ZONA, true)).toBe(true);
  });

  it("después de la fecha, las dos dicen lo mismo: la llave no cambia nada", () => {
    expect(arrancoParaEstaConsulta(despues, "2026-10-01", ZONA, false)).toBe(true);
    expect(arrancoParaEstaConsulta(despues, "2026-10-01", ZONA, true)).toBe(true);
    expect(arrancoParaEstaConsulta(antes, null, ZONA, false)).toBe(true);
  });
});
