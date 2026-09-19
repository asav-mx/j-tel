import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * El contraste de las dos pieles, comprobado contra el archivo real.
 *
 * El skill `jtel-diseno` cierra con «contraste ≥ 4.5:1» en su lista de entrega,
 * y hasta el 16 de septiembre de 2026 la piel clara no lo cumplía con sus
 * propios valores: `--tenue` daba 3.94 y el cobre 2.42 — ni el 3:1 de lo que no
 * es texto. Nadie lo notó en cinco meses porque **una lista de entrega en prosa
 * no se ejecuta**. Esto sí.
 *
 * Lee `casa.css` en vez de repetir los hexes aquí a propósito: una prueba con su
 * propia copia de la paleta pasa en verde mientras la pantalla se ve mal, que es
 * el peor resultado posible.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("./casa.css", import.meta.url)),
  "utf8",
);

/** Los tokens de un bloque, por el selector con que abre. */
function paleta(selector: string): Record<string, string> {
  const desde = CSS.indexOf(selector + " {");
  if (desde === -1) throw new Error(`No se encontró el bloque ${selector}`);
  const hasta = CSS.indexOf("}", desde);
  const bloque = CSS.slice(desde, hasta);

  const tokens: Record<string, string> = {};
  for (const [, nombre, valor] of bloque.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6});/g)) {
    tokens[nombre] = valor;
  }
  return tokens;
}

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lineal = canales.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

function contraste(frente: string, fondo: string): number {
  const a = luminancia(frente);
  const b = luminancia(fondo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PIELES = [
  { nombre: "clara", selector: ".cascaron" },
  { nombre: "oscura", selector: '[data-tema="oscuro"] .cascaron' },
];

describe("las dos pieles pasan el contraste que el propio skill exige", () => {
  for (const piel of PIELES) {
    // `--tinta` es el texto principal y `--tenue` el apoyo: los dos se leen, así
    // que los dos van al 4.5:1 de texto normal. El cobre también, porque el
    // skill lo pone sobre datos vivos — que son cifras que alguien lee.
    // Los dos del sello (Vernier V1) también: `--ladrillo` se escribe —el nombre
    // del no cumplido y la hora de su sello— y `--sello-ok` se mide igual para
    // que el día que alguien escriba en él no haya que volver a abrir esto.
    for (const token of ["tinta", "tenue", "senal", "sello-ok", "ladrillo"]) {
      for (const fondo of ["papel", "pieza"]) {
        it(`piel ${piel.nombre}: --${token} sobre --${fondo}`, () => {
          const p = paleta(piel.selector);
          expect(contraste(p[`--${token}`], p[`--${fondo}`])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    // `--vivo` es el punto del latido y nada más: una marca, no texto. Le
    // aplica el 3:1 de lo que no es texto. El día que alguien escriba una
    // palabra en verde, este umbral sube con ella.
    for (const fondo of ["papel", "pieza"]) {
      it(`piel ${piel.nombre}: --vivo sobre --${fondo} alcanza para una marca`, () => {
        const p = paleta(piel.selector);
        expect(contraste(p["--vivo"], p[`--${fondo}`])).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("las dos pieles declaran los mismos tokens", () => {
  it("ninguna tiene un color que a la otra le falte", () => {
    // La regla del skill: si falta un tinte se agrega a las DOS paletas. Un
    // token que sólo existe en una se ve bien en la piel de quien lo escribió y
    // desaparece en la otra.
    const clara = Object.keys(paleta(".cascaron")).sort();
    const oscura = Object.keys(paleta('[data-tema="oscuro"] .cascaron')).sort();
    expect(oscura).toEqual(clara);
  });
});
