import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **Las reglas de la medición no se cambian sin registro** (0051, A4b — ASAV,
 * 21-sep-2026). Cambiar una regla cambia qué cuenta como «pasó», y un cambio de
 * regla lleva quién, cuándo y por qué, igual que la promesa y las
 * asignaciones.
 *
 * Esta prueba lee código, no comportamiento: una escritura nueva que se salte
 * el registro pasaría verde en cualquier prueba de comportamiento que no la
 * conozca. Vigila tres cosas:
 *
 *  1. Las escrituras viejas sin firma (`updateCircuit`, `setArrivalRangeEnabled`)
 *     no vuelven: ni se definen ni se llaman.
 *  2. En el repositorio, sólo `cambiarCircuito` y `cambiarRangoDeLlegada` hacen
 *     `.update(circuits)` con una columna de regla en su `.set`.
 *  3. Fuera del repositorio nadie hace `.update(circuits)` (salvo pruebas).
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SRC, "../../..");
const REPO_DB = "packages/db/src/repositories/index.ts";
const leer = (a: string) => readFileSync(path.join(REPO, a), "utf8");
const sinComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CAMPOS_DE_REGLA = [
  "corridorToleranceMeters",
  "staleAfterSeconds",
  "serviceConfidenceMinutes",
  "avgSpeedKmh",
  "arrivalRangeFloorSeconds",
  "stopSnapToleranceMeters",
  "arrivalTolerancePct",
  "corridorExitMinutes",
  "serviceStartLocal",
  "serviceEndLocal",
  "timeZone",
  "serviceLaunchDate",
  "arrivalRangeEnabledAt",
];

function fuentes(): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(path.join(REPO, dir))) {
      const rel = `${dir}/${n}`;
      const abs = path.join(REPO, rel);
      if (statSync(abs).isDirectory()) {
        if (n !== "node_modules" && n !== "dist" && n !== ".next") recorrer(rel);
      } else if (/\.(ts|tsx)$/.test(n)) salida.push(rel);
    }
  };
  for (const g of ["packages", "apps"]) {
    for (const n of readdirSync(path.join(REPO, g))) {
      if (existsSync(path.join(REPO, g, n, "src"))) recorrer(`${g}/${n}/src`);
    }
  }
  return salida;
}

/** Los métodos del repositorio, con su cuerpo. */
function metodos(): Array<{ nombre: string; cuerpo: string }> {
  const texto = sinComentarios(leer(REPO_DB));
  const partes = texto.split(/\n  (?=async [a-zA-Z]+\s*\()/);
  return partes.slice(1).map((p) => ({ nombre: /^async ([a-zA-Z]+)/.exec(p)![1]!, cuerpo: p }));
}

describe("guardia · las reglas de la medición se firman", () => {
  it("el barrido encuentra código de verdad (guarda contra un falso verde)", () => {
    const nombres = metodos().map((m) => m.nombre);
    expect(nombres).toContain("cambiarCircuito");
    expect(nombres).toContain("cambiarRangoDeLlegada");
    expect(fuentes().length).toBeGreaterThan(100);
  });

  it("las escrituras sin firma no vuelven: ni se definen ni se llaman", () => {
    const culpables = fuentes()
      .filter((a) => !a.endsWith("guardia-reglas-de-la-medicion.test.ts"))
      .filter((a) => /\b(updateCircuit|setArrivalRangeEnabled)\s*\(/.test(sinComentarios(leer(a))));
    expect(culpables, "Una escritura del circuito sin registro volvió. Se escribe con cambiarCircuito / cambiarRangoDeLlegada.").toEqual([]);
  });

  it("en el repositorio, sólo las dos escrituras firmadas tocan una columna de regla", () => {
    const tocan = metodos()
      .filter((m) => m.cuerpo.includes(".update(circuits)"))
      .filter((m) => {
        const set = m.cuerpo.slice(m.cuerpo.indexOf(".update(circuits)"));
        return m.nombre === "cambiarCircuito" || CAMPOS_DE_REGLA.some((c) => new RegExp(`\\b${c}\\b`).test(set.slice(0, 600)));
      })
      .map((m) => m.nombre)
      .sort();
    expect(tocan).toEqual(["cambiarCircuito", "cambiarRangoDeLlegada"]);
  });

  it("fuera del repositorio nadie actualiza circuits (salvo pruebas)", () => {
    const culpables = fuentes()
      .filter((a) => a !== REPO_DB && !/\.test\.tsx?$/.test(a))
      .filter((a) => /\.update\(\s*circuits\s*\)/.test(sinComentarios(leer(a))));
    expect(culpables).toEqual([]);
  });
});
