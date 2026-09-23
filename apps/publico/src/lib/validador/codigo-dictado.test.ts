import { describe, it, expect } from "vitest";
import { codigoParaDictar } from "@/lib/ontoy/pase";
import { folioDelCodigoDictado } from "./codigo-dictado";

describe("el código dictado cierra el círculo", () => {
  /*
   * La prueba que importa: lo que el pase ENSEÑA para dictar tiene que volver a
   * ser el folio que el lector QUEMA. Si las dos vías se separan, el mismo
   * boleto pasa por cámara y por teclado en el mismo aparato sin que nada lo
   * note, y el «un solo uso» deja de ser cierto justo donde más falta hace.
   */
  it("lo que el pase dicta vuelve a ser el folio que el lector quema", () => {
    for (const folio of ["ONT-00042042", "ONT-99999999", "ONT-00000001"]) {
      expect(folioDelCodigoDictado(codigoParaDictar(folio))).toBe(folio);
    }
  });

  it("acepta con espacios o sin ellos", () => {
    expect(folioDelCodigoDictado("0004 2042")).toBe("ONT-00042042");
    expect(folioDelCodigoDictado("00042042")).toBe("ONT-00042042");
  });

  it("no adivina con menos ni con más de ocho dígitos", () => {
    expect(folioDelCodigoDictado("1234")).toBeNull();
    expect(folioDelCodigoDictado("123456789")).toBeNull();
    expect(folioDelCodigoDictado("")).toBeNull();
    expect(folioDelCodigoDictado("no-son-digitos")).toBeNull();
  });
});
