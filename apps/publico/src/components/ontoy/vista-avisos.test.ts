import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nombreEnLaPlaca } from "./vista-avisos";

describe("lo que dice la placa de un aviso", () => {
  it("el número, si la ruta lo trae", () => {
    expect(nombreEnLaPlaca("Ruta 51 · Centro–Tecnológico")).toBe("51");
  });

  it("sin número, el nombre entero: unas iniciales no nombran ninguna ruta", () => {
    expect(nombreEnLaPlaca("Oasis-Centro")).toBe("Oasis-Centro");
    expect(nombreEnLaPlaca("Zaragoza–Centro")).toBe("Zaragoza–Centro");
  });
});

describe("Avisos es una página de Inicio", () => {
  /*
   * La barra marcaba «Mapa» estando en Avisos: se abre desde las paradas de una
   * ruta, y el lugar se quedaba en el mapa. Lo que la barra marca es `lugar`, así
   * que abrir Avisos tiene que dejarlo en Inicio.
   */
  const AQUI = path.dirname(fileURLToPath(import.meta.url));
  const cascaron = readFileSync(path.join(AQUI, "ontoy.tsx"), "utf8");

  it("abrir Avisos pone el lugar en Inicio", () => {
    const abrir = cascaron.slice(cascaron.indexOf("const abrirCampana"), cascaron.indexOf("setCampanaAbierta(true)"));
    expect(abrir).toContain('setLugar("inicio")');
  });

  it("y la salida dice a dónde lleva: «Inicio», no «Volver»", () => {
    const vista = readFileSync(path.join(AQUI, "vista-avisos.tsx"), "utf8");
    expect(vista).not.toContain("‹ Volver");
    expect(vista).toMatch(/<\/svg>\s*Inicio\s*<\/button>/);
  });
});
