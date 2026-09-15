import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Todo guion que fabrica datos pasa por un candado.
 *
 * El 7 de julio de 2026 `seed.ts` pobló producción, y el 8 `real-e2e.ts` le
 * agregó una cuenta de prueba con veredictos sellados. Los candados llegaron
 * después y uno por uno, así que el 14 de septiembre todavía había tres
 * caminos abiertos. Esta prueba lee los guiones de `packages/*\/src` y hace
 * nacer en rojo al que cree cuentas o vacíe tablas sin candado.
 *
 * Mira cuentas y `TRUNCATE` porque son la firma de un guion que fabrica un
 * mundo entero: todos los que sembraron datos inventados empiezan por ahí. Las
 * herramientas que corrigen datos reales —rellenos de GPS, re-verificaciones—
 * no crean cuentas, y su riesgo es otro.
 */

const PACKAGES = path.join(fileURLToPath(new URL("../..", import.meta.url)));

/** Lo que fabrica. Sobre el código sin comentarios. */
const FABRICA = /\.accounts\.create\(|insert\(accounts\)|TRUNCATE TABLE/;
/** Lo que cuenta como candado. */
const CANDADO = /\brevisarDesechable\(|\bresolveSeedDatabaseUrl\(/;

/** Excepciones, con nombre y motivo. */
const EXENTOS: Record<string, string> = {
  "db/src/seed-guard.ts": "Es el candado del seed, no un guion que siembre.",
};

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada === "dist") continue;
    const completa = path.join(dir, entrada);
    if (statSync(completa).isDirectory()) salida.push(...archivos(completa));
    else if (/\.ts$/.test(entrada) && !/\.test\.ts$/.test(entrada)) salida.push(completa);
  }
  return salida;
}

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("cobertura del candado en los guiones que fabrican datos", () => {
  const fuentes = readdirSync(PACKAGES)
    .map((p) => path.join(PACKAGES, p, "src"))
    .filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(archivos)
    // Los repositorios definen `accounts.create`; no son guiones.
    .filter((f) => !f.includes(`${path.sep}repositories${path.sep}`));

  const fabricantes = fuentes
    .map((f) => ({ f, rel: path.relative(PACKAGES, f), codigo: sinComentarios(readFileSync(f, "utf8")) }))
    .filter((x) => FABRICA.test(x.codigo));

  it("encuentra a los que fabrican (si esto da cero, la prueba no está mirando nada)", () => {
    const nombres = fabricantes.map((x) => x.rel);
    expect(nombres).toContain(path.join("db", "src", "seed.ts"));
    expect(nombres).toContain(path.join("services", "src", "real-e2e.ts"));
  });

  it("cada guion que crea cuentas o vacía tablas llama a un candado, o está exento con su motivo", () => {
    const sinCandado = fabricantes
      .filter((x) => !EXENTOS[x.rel.split(path.sep).join("/")])
      .filter((x) => !CANDADO.test(x.codigo))
      .map((x) => x.rel);
    expect(sinCandado).toEqual([]);
  });
});
