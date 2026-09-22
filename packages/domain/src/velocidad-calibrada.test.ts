import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { paradasHasta, velocidadCalibrada } from "./llegada.js";

/*
 * «Calibrado» se define en UN solo lugar (8.9b; ficha de Ontoy 2.0, PR 2).
 *
 * Ontoy decide con esto entre minutos y «a N paradas», y J-Staff dice con esto
 * en qué modo está Ontoy. Dos lecturas del interruptor en dos sitios son dos
 * definiciones esperando a separarse: el día que una cambie —que «calibrado»
 * pida además, por ejemplo, N días de pasos medidos— la otra seguiría diciendo
 * lo de antes, y la pantalla de J-Staff mentiría sobre lo que ve el pasajero.
 */

describe("velocidadCalibrada — la regla", () => {
  it("es la decisión firmada de J-Staff: encendido es calibrado, apagado no", () => {
    expect(velocidadCalibrada({ arrivalRangeEnabledAt: new Date() })).toBe(true);
    expect(velocidadCalibrada({ arrivalRangeEnabledAt: null })).toBe(false);
  });
});

describe("velocidadCalibrada — la valla: nadie más lee el interruptor", () => {
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

  /*
   * Quién SÍ puede tocar la columna, y por qué. Todo lo demás pasa por la función.
   */
  const PERMITIDOS = [
    // La definición.
    "packages/domain/src/llegada.ts",
    // El interruptor mismo: lo prende, lo apaga y firma el cambio.
    "packages/db/src/repositories/index.ts",
    "packages/db/src/schema/index.ts",
    // La pantalla vieja de circuitos: se retira entera en el PR D (después del 28-sep).
    "apps/web/src/app/jstaff/circuitos/[id]/page.tsx",
  ];
  const esSiembra = (f: string) => /^packages\/db\/src\/escenario-[^/]+\.ts$/.test(f);
  const esPrueba = (f: string) => /\.test\.tsx?$/.test(f);

  it("ningún otro archivo de código lee arrivalRangeEnabledAt", () => {
    let salida = "";
    try {
      salida = execFileSync("git", ["grep", "-l", "arrivalRangeEnabledAt", "--", "apps", "packages"], {
        cwd: REPO,
        encoding: "utf8",
      });
    } catch {
      salida = ""; // git grep sale con 1 cuando no encuentra nada
    }
    const fuera = salida
      .split("\n")
      .filter(Boolean)
      .filter((f) => /\.(tsx?|mjs|js)$/.test(f))
      .filter((f) => !PERMITIDOS.includes(f) && !esSiembra(f) && !esPrueba(f));
    expect(fuera, "usa velocidadCalibrada() de @jtel/domain en vez de leer la columna").toEqual([]);
  });
});

describe("paradasHasta — «a N paradas»", () => {
  // Paradas a 100, 300, 600 y 900 m sobre el trazado de un sentido.
  const PARADAS = [100, 300, 600, 900];

  it("cuenta las que le faltan, incluida la tuya", () => {
    expect(paradasHasta(150, 900, PARADAS)).toBe(3); // 300, 600, 900
  });

  it("«a 1 parada»: la siguiente es la tuya", () => {
    expect(paradasHasta(650, 900, PARADAS)).toBe(1);
  });

  it("una unidad detenida EN una parada anterior no la cuenta: ya está ahí", () => {
    expect(paradasHasta(300, 600, PARADAS)).toBe(1);
  });

  it("si ya pasó tu parada, no hay número: volver es especulación", () => {
    expect(paradasHasta(950, 900, PARADAS)).toBeNull();
    expect(paradasHasta(900, 900, PARADAS)).toBeNull();
  });

  it("tu parada cuenta aunque no venga en la lista", () => {
    expect(paradasHasta(650, 800, PARADAS)).toBe(1);
  });
});
