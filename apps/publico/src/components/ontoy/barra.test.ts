import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { miradaHacia } from "./barra";

/*
 * **LA BARRA DEL UNIVERSO** (app-v1, 25-sep). Que se vea como el diseño **se
 * mira**; aquí se cercan las decisiones que una edición distraída deshace.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const barra = readFileSync(path.join(AQUI, "barra.tsx"), "utf8");
const css = readFileSync(path.join(AQUI, "..", "..", "app", "ontoy.css"), "utf8");
const reglaDe = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf("}", css.indexOf(`${selector} {`)));

describe("regla 2b: la barra entera mira hacia donde estás", () => {
  it("el activo mira al frente y los demás voltean hacia él", () => {
    /* Activo = Ir a (2): Inicio y Mapa miran a la derecha, Pase a la izquierda. */
    expect([0, 1, 2, 3].map((i) => miradaHacia(i, 2))).toEqual(["0.9px", "0.9px", "0px", "-0.9px"]);
    expect([0, 1, 2, 3].map((i) => miradaHacia(i, 0))).toEqual(["0px", "-0.9px", "-0.9px", "-0.9px"]);
  });

  it("el CSS corre las pupilas con --mx", () => {
    expect(reglaDe(".ontoy-barra .glifo-pupilas")).toContain("translate(var(--mx, 0px), 0)");
  });
});

describe("la palabra, en tipo oración", () => {
  it("sin mayúsculas forzadas ni espaciado", () => {
    const palabra = reglaDe(".ontoy-barra-palabra");
    expect(palabra).not.toContain("text-transform");
    expect(palabra).not.toContain("letter-spacing");
    expect(barra).toContain('palabra: "Inicio"');
  });
});

describe("los íconos son los objetos del universo", () => {
  it("la barra no dibuja íconos de línea propios", () => {
    expect(barra).not.toContain("<path");
    expect(barra).toMatch(/GlifoCasa[\s\S]*GlifoMapa[\s\S]*GlifoIra[\s\S]*GlifoPase/);
  });
});
