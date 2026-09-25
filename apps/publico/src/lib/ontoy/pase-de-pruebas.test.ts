import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leerPaseDePruebas } from "./pase-de-pruebas";

describe("¿este teléfono ve el pase de pruebas?", () => {
  it("por omisión, no: el pasajero ve la pantalla del lanzamiento", () => {
    expect(leerPaseDePruebas("", null)).toEqual({ ver: false, guardar: null });
    expect(leerPaseDePruebas("?ruta=51", null)).toEqual({ ver: false, guardar: null });
  });

  it("`?pase=pruebas` lo prende y lo deja guardado en el teléfono", () => {
    expect(leerPaseDePruebas("?pase=pruebas", null)).toEqual({ ver: true, guardar: true });
  });

  it("prendido una vez, la app instalada lo recuerda aunque abra sin consulta", () => {
    expect(leerPaseDePruebas("", "1")).toEqual({ ver: true, guardar: null });
  });

  it("`?pase=publico` lo apaga", () => {
    expect(leerPaseDePruebas("?pase=publico", "1")).toEqual({ ver: false, guardar: false });
  });

  it("otra palabra no lo prende", () => {
    expect(leerPaseDePruebas("?pase=si", null).ver).toBe(false);
  });
});

describe("la pantalla del lanzamiento no enseña nada de R&D", () => {
  /*
   * Decisión de ASAV (25-sep): **sin la banda de R&D para el público**. La
   * banda sigue en el pase de pruebas, que es donde dice la verdad.
   */
  const AQUI = path.dirname(fileURLToPath(import.meta.url));
  const pase = readFileSync(path.join(AQUI, "../../components/ontoy/vista-pase.tsx"), "utf8");
  const pronto = pase.slice(pase.indexOf("function PaseProximamente"), pase.indexOf("**El pase de pruebas**"));

  it("encuentra la pantalla (si no, esta prueba no vigila nada)", () => {
    expect(pronto).toContain("Pronto podrás pagar con tu teléfono.");
  });

  it("ni la banda, ni compras, ni viajes", () => {
    expect(pronto).not.toContain("BandaRd");
    expect(pronto).not.toMatch(/alComprar|viajes|PAQUETES|R&amp;D|R&D/);
  });

  it("y es lo que sale mientras no se prenda el pase de pruebas", () => {
    expect(pase).toMatch(/if \(!pruebas\) return <PaseProximamente/);
  });
});
