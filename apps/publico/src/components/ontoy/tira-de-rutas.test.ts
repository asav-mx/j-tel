import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **La tira de rutas del Mapa.**
 *
 * ## Qué NO prueba
 *
 * **No prueba que el ojo se entienda.** Eso se mira, y se mira en un teléfono.
 * Lo que se cerca aquí es la regla que lo hizo necesario: **el estado no se
 * confía a una sola señal**, y menos al color.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const tira = readFileSync(path.join(AQUI, "tira-de-rutas.tsx"), "utf8");
const css = readFileSync(path.join(AQUI, "../../app/ontoy.css"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("prendida o apagada se dice de CUATRO formas", () => {
  /*
   * El color de ruta es identidad, nunca estado (8.8c), así que no puede ser lo
   * que distinga prendida de apagada. Y atenuar solo no basta: un chip
   * atenuado se lee tan fácil como «oculta» como «deshabilitada», y son cosas
   * distintas — una la apagó el pasajero y la puede prender.
   */
  const cuerpo = sinComentarios(tira);

  it("la clase, para atenuar", () => {
    expect(cuerpo).toContain('prendida ? "" : " apagado"');
  });

  it("el `aria-pressed`, para quien no ve la pantalla", () => {
    expect(cuerpo).toContain("aria-pressed={prendida}");
  });

  it("el rótulo, que dice qué pasa AL TOCARLO y no sólo cómo está", () => {
    expect(cuerpo).toContain("tocar para ocultar");
    expect(cuerpo).toContain("tocar para verla");
  });

  it("y el ojo, dibujado", () => {
    expect(cuerpo).toContain("<Ojo abierto={prendida} />");
  });
});

describe("el ojo", () => {
  it("usa la mirada de los personajes, no un símbolo nuevo", () => {
    /*
     * Blanco con pupila carbón abierto; el arco de dormir cerrado. El pasajero
     * ya sabe leer esos ojos en toda la app — Tino, Cami, Ontoy.
     */
    expect(tira).toContain('fill="#2A2E37"');
    expect(tira).toMatch(/q7\.6 6\.4 15\.2 0|q[\d.]+ [\d.]+ [\d.]+ 0/);
  });

  it("cerrado NO tiene pupila: no mira", () => {
    const cerrado = tira.slice(tira.indexOf("Cerrado:"));
    expect(cerrado).not.toContain("<circle");
  });

  it("va DESPUÉS del nombre", () => {
    /*
     * Primero qué ruta es —que es lo que se busca—, después cómo está. Al revés
     * la tira se vuelve una fila de ojos donde hay que leer para encontrar la
     * ruta.
     */
    const cuerpo = sinComentarios(tira);
    expect(cuerpo.indexOf("{r.nombre}")).toBeLessThan(cuerpo.indexOf("<Ojo"));
  });

  it("no le roba el rótulo al chip", () => {
    /* Lo que el estado significa ya lo dice el `aria-label`, con más palabras. */
    const i = tira.indexOf("function Ojo");
    expect(tira.slice(i)).toContain('aria-hidden="true"');
    expect(tira.slice(i)).not.toContain("aria-label");
  });
});

describe("la piel", () => {
  it("el ojo no lleva color de ruta", () => {
    /*
     * El ojo es estado; el color de ruta es identidad. Pintarlo del color de la
     * ruta juntaría las dos cosas que la 8.8c separa.
     */
    const i = css.indexOf(".ontoy-chip-ojo {");
    const bloque = css.slice(i, css.indexOf("}", i));
    expect(bloque).not.toContain("--ruta");
  });
});
