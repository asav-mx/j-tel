/**
 * ¿Alguna suite puede correr fuera de UTC?
 *
 *   pnpm zona:check
 *
 * Sale con código 1 si un paquete que corre vitest no tiene configuración, o si
 * una configuración de vitest no importa `scripts/zona-de-las-pruebas.mjs`.
 *
 * ## Por qué
 *
 * La zona vivía sólo en los scripts (`"test": "TZ=UTC vitest run"`), y correr
 * `vitest` a mano la perdía. El costo real, el 23 de septiembre de 2026: una
 * prueba de calendario se puso roja, la reporté como un fallo de `main` en el
 * cuerpo de un PR, y no lo era. Ver
 * `docs/Diagnostico-Rango-Del-Generador-2026-09-23.md`.
 *
 * Mover la zona a las configuraciones arregla lo de hoy. **Esto es lo que
 * impide que vuelva**: un paquete nuevo que nazca sin configuración —o una
 * configuración nueva que no la importe— se lee en su propio PR, no seis meses
 * después en forma de rojo inexplicable.
 *
 * ## Lo que NO es
 *
 * No comprueba que el proceso esté en UTC: eso lo comprueba una prueba, en
 * `packages/db/src/zona-de-las-pruebas.test.ts`, que es el único lugar donde se
 * puede mirar de verdad. Esto mira **los archivos**.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORTA = "scripts/zona-de-las-pruebas.mjs";

/** Las carpetas donde viven los paquetes del monorepo. */
const CASAS = ["apps", "packages"];

/** Un paquete del espacio de trabajo, con lo que hace falta saber de él. */
export function paquetesDelRepo(raiz = RAIZ) {
  const fuera = [];
  for (const casa of CASAS) {
    const dir = join(raiz, casa);
    if (!existsSync(dir)) continue;
    for (const nombre of readdirSync(dir)) {
      const base = join(dir, nombre);
      const manifiesto = join(base, "package.json");
      if (!existsSync(manifiesto)) continue;
      const json = JSON.parse(readFileSync(manifiesto, "utf8"));
      const scripts = json.scripts ?? {};
      const correVitest = Object.values(scripts).some((s) => String(s).includes("vitest"));
      const configs = readdirSync(base).filter((f) => /^vitest.*\.config\.(ts|js|mjs)$/.test(f));
      fuera.push({ nombre: `${casa}/${nombre}`, base, correVitest, configs });
    }
  }
  return fuera;
}

/** Los reclamos, en el orden en que conviene leerlos. */
export function reclamos(paquetes) {
  const fuera = [];
  for (const p of paquetes) {
    if (!p.correVitest) continue;
    if (p.configs.length === 0) {
      fuera.push(`${p.nombre}: corre vitest y no tiene configuración, así que su zona depende del script`);
      continue;
    }
    for (const c of p.configs) {
      const texto = readFileSync(join(p.base, c), "utf8");
      if (!texto.includes(IMPORTA)) {
        fuera.push(`${p.nombre}/${c}: no importa ${IMPORTA}`);
      }
    }
  }
  return fuera;
}

/* Cuando se corre como guion (no cuando lo importa su prueba). */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paquetes = paquetesDelRepo();
  const conVitest = paquetes.filter((p) => p.correVitest);
  const malos = reclamos(paquetes);

  const configs = conVitest.reduce((n, p) => n + p.configs.length, 0);
  console.log(`Paquetes que corren vitest: ${conVitest.length}. Configuraciones: ${configs}.`);

  if (malos.length > 0) {
    console.error(`\n✗ ${malos.length} suite(s) podrían correr fuera de UTC:\n`);
    for (const m of malos) console.error(`   ${m}`);
    console.error(
      `\nCada configuración de vitest importa ${IMPORTA} en su primera línea.` +
        "\nSin eso, correr vitest a mano pierde la zona y la suite se pone roja" +
        "\npor una razón que no es del producto.",
    );
    process.exit(1);
  }
  console.log("✓ Todas importan la zona: ninguna suite puede correr fuera de UTC.");
}
