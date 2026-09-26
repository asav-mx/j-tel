import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * **EL PASE NO PROMETE LO QUE NADIE VA A CUMPLIR** (ASAV, 26-sep-2026).
 *
 * «Cuando tu ruta empiece, aquí aparece tu pase» era falso: la ruta arranca el
 * 1 de octubre y los pases son Ontoy 3.0. La pantalla dice sólo lo que es
 * cierto hoy, sin fecha y sin aviso.
 */
const fuente = readFileSync(new URL("./vista-pase.tsx", import.meta.url), "utf8");
const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const proximamente = sinComentarios.slice(sinComentarios.indexOf("function PaseProximamente"), sinComentarios.indexOf("function PaseDePruebas"));

describe("«Pronto podrás pagar con tu teléfono» dice sólo lo que es cierto hoy", () => {
  it("dice que ningún camión lee pases", () => {
    expect(proximamente).toContain("Todavía ningún camión lee pases.");
  });

  it("no promete cuándo: ni «cuando tu ruta empiece», ni fecha, ni aviso", () => {
    expect(proximamente).not.toMatch(/cuando tu ruta/i);
    expect(proximamente).not.toMatch(/aquí aparece/i);
    expect(proximamente).not.toMatch(/te aviso|te avisamos|octubre|jueves|arranca/i);
  });
});
