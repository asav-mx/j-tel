import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { destinoLegible, quiereAplicar } from "./permiso-de-escritura.js";

/**
 * Nada que escriba en producción corre sin pedirlo — y el que no lo pida nace
 * en rojo.
 *
 * Regla de Asav del 14 de septiembre de 2026. Esta prueba lee los guiones de
 * `packages/*\/src` y exige que todo el que abra la base con
 * el usuario DUEÑO (`DATABASE_URL`) pase por una puerta explícita: `--aplicar`
 * (`pedirAplicar`), el sí tecleado del resello (`modoDeResello`), `--ejecutar`,
 * o el candado de las bases desechables. Los que
 * sólo leen, que entren con `DATABASE_URL_READONLY` y no aparecen aquí.
 */

const RAIZ = path.join(fileURLToPath(new URL("../../..", import.meta.url)));

/** Abre la base como dueño. `DATABASE_URL_READONLY` y `DATABASE_URL_TEST` no cuentan. */
const DUENO = /process\.env\.DATABASE_URL\b(?!_)/;
/** Lo que cuenta como pedirlo explícitamente. Sobre el código sin comentarios. */
const PUERTA =
  /\bpedirAplicar\(|\bmodoDeResello\(|["']--aplicar["']|["']--ejecutar["']|\brevisarDesechable\(|\bresolveSeedDatabaseUrl\(/;

/** Excepciones, con nombre y motivo. */
const EXENTOS: Record<string, string> = {
  "packages/db/src/migrate.ts":
    "Aplica migraciones con drizzle-kit; el procedimiento real es pegar el SQL en Neon (docs/Procedimiento-Migraciones.md), y el migrador se atora en la 0014.",
  "packages/db/src/verificar-solo-lectura.ts":
    "No escribe: compara DATABASE_URL contra la de solo lectura para negarse si son la misma.",
};

function archivos(dir: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return [];
  }
  const salida: string[] = [];
  for (const entrada of entradas) {
    if (entrada === "node_modules" || entrada === "dist") continue;
    const completa = path.join(dir, entrada);
    if (statSync(completa).isDirectory()) salida.push(...archivos(completa));
    else if (/\.ts$/.test(entrada) && !/\.test\.ts$/.test(entrada)) salida.push(completa);
  }
  return salida;
}

const sinComentarios = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("el permiso de escribir", () => {
  it("sólo --aplicar lo da", () => {
    expect(quiereAplicar(["node", "x.ts", "--aplicar"])).toBe(true);
    for (const otro of [[], ["-y"], ["--force"], ["--apply"], ["--aplicar=no"], ["aplicar"]]) {
      expect(quiereAplicar(["node", "x.ts", ...otro])).toBe(false);
    }
  });

  it("el destino se imprime sin usuario ni contraseña", () => {
    const d = destinoLegible("postgresql://dueno:secreto@ep-prod-111.neon.tech/neondb?sslmode=require");
    expect(d).toBe("ep-prod-111.neon.tech/neondb");
    expect(d).not.toContain("secreto");
    expect(d).not.toContain("dueno");
  });
});

describe("cobertura: quien abre la base como dueño pide permiso", () => {
  const paquetes = readdirSync(path.join(RAIZ, "packages")).map((p) => path.join(RAIZ, "packages", p, "src"));
  const fuentes = paquetes
    .flatMap(archivos)
    .filter((f) => !f.includes(`${path.sep}repositories${path.sep}`));

  const comoDueno = fuentes
    .map((f) => ({ rel: path.relative(RAIZ, f).split(path.sep).join("/"), codigo: sinComentarios(readFileSync(f, "utf8")) }))
    .filter((x) => DUENO.test(x.codigo));

  it("encuentra a los que abren como dueño (si da cero, no está mirando)", () => {
    const nombres = comoDueno.map((x) => x.rel);
    expect(nombres).toContain("packages/services/src/archive-run.ts");
    expect(nombres).toContain("packages/services/src/backfill-telemetry.ts");
  });

  it("cada uno pasa por una puerta explícita, o está exento con su motivo", () => {
    const sinPuerta = comoDueno.filter((x) => !EXENTOS[x.rel] && !PUERTA.test(x.codigo)).map((x) => x.rel);
    expect(sinPuerta).toEqual([]);
  });

  it("ningún exento sobra: si ya no abre como dueño, se quita de la lista", () => {
    const nombres = new Set(comoDueno.map((x) => x.rel));
    for (const r of Object.keys(EXENTOS)) expect(nombres.has(r), r).toBe(true);
  });
});
