import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **«MÁS RUTAS» NO QUEDA DEBAJO DE LA HOJA** (auditoría a1, 25-sep).
 *
 * El panel y la hoja de parada viven en el mismo `z-index`, y la hoja se pinta
 * después: con la asomada puesta, tapaba la mitad del panel. No monta la
 * pantalla; cerca la condición que lo evita.
 */
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ontoy = readFileSync(path.join(AQUI, "ontoy.tsx"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("«Más rutas» y la hoja de parada", () => {
  it("con el panel abierto, la hoja no se pinta", () => {
    expect(sinComentarios(ontoy)).toContain("!campanaAbierta && !panelAbierto && enElMapa && parada && rutaDeLaHoja");
  });
});
