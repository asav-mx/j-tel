import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **LA HOJA DE CAMI** (lámina `6-prototipo/04-hoja-de-cami`).
 *
 * No monta la pantalla: lo que se ve se mira. Aquí se cerca lo que ya se
 * perdió una vez sin que nada fallara.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const hoja = readFileSync(path.join(AQUI, "hoja-de-cami.tsx"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("la hoja de Cami tiene sus márgenes", () => {
  /*
   * La auditoría del 25-sep midió `padding: 0`: el texto iba de x = 0 a
   * x = 390. El margen lo pone `.ontoy-hoja-cuerpo`, el mismo de la hoja de
   * parada; sin ese envoltorio, la hoja va de orilla a orilla.
   */
  it("el contenido va dentro de .ontoy-hoja-cuerpo", () => {
    expect(sinComentarios(hoja)).toContain('className="ontoy-hoja-cuerpo"');
  });
});

describe("el encabezado de la lámina", () => {
  it("Cami de frente, el título y «Sus próximas paradas»", () => {
    const s = sinComentarios(hoja);
    expect(s).toContain("<CamiDeFrente");
    expect(s).toContain("tituloDeCami(");
    expect(s).toContain("Sus próximas paradas");
  });
  it("cada renglón abre su parada", () => {
    expect(sinComentarios(hoja)).toContain("alAbrirParada(p.id)");
  });
});
