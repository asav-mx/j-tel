import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { numeroDeLaRuta } from "./vista-avisos";

describe("la placa es sólo para el número de la ruta (ASAV, 26-sep)", () => {
  it("con número, el número", () => {
    expect(numeroDeLaRuta("Ruta 51 · Centro–Tecnológico")).toBe("51");
  });

  it("sin número, nada: la ruta va con su franja y su nombre como texto", () => {
    expect(numeroDeLaRuta("Oasis – Parroquia Santa Teresa de Jesús")).toBeNull();
    expect(numeroDeLaRuta("Zaragoza–Centro")).toBeNull();
    /* Un nombre corto no es un número aunque quepa en una placa. */
    expect(numeroDeLaRuta("Centro")).toBeNull();
    expect(numeroDeLaRuta("Km 20")).toBeNull();
  });

  it("el aviso sin número no mete el nombre en una placa", () => {
    const vista = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "vista-avisos.tsx"), "utf8");
    expect(vista).not.toContain("nombreEnLaPlaca");
    expect(vista).toMatch(/className="ontoy-aviso-ruta"[\s\S]*className="ontoy-franja"/);
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
