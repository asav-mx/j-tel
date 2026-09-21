import { describe, expect, it } from "vitest";
import { destinoDeVuelta } from "./volver";

const con = (v: string) => {
  const f = new FormData();
  f.set("volver", v);
  return f;
};

describe("destinoDeVuelta — sólo de regreso al cuarto nuevo", () => {
  it("acepta el cuarto y el expediente de un circuito", () => {
    expect(destinoDeVuelta(con("/casa/jstaff/circuitos"))).toBe("/casa/jstaff/circuitos");
    expect(destinoDeVuelta(con("/casa/jstaff/circuitos/3f2a-9c1b"))).toBe("/casa/jstaff/circuitos/3f2a-9c1b");
  });

  it("sin campo, la ruta regresa a donde siempre", () => {
    expect(destinoDeVuelta(new FormData())).toBeNull();
  });

  it("nada fuera del cuarto: ni otro sitio, ni `//`, ni otra casa, ni parámetros colados", () => {
    for (const v of [
      "https://otro.sitio/casa/jstaff/circuitos",
      "//otro.sitio/casa/jstaff/circuitos",
      "/casa/transportista/circuitos",
      "/casa/jstaff/circuitos/../cuentas-y-demos",
      "/casa/jstaff/circuitos?x=1",
      "/casa/jstaff/circuitosfalso",
    ]) {
      expect(destinoDeVuelta(con(v)), v).toBeNull();
    }
  });
});
