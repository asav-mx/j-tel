import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb, createRepositories } from "./index.js";
import { units, validatorAssignments, validators } from "./schema/index.js";

/**
 * **Dar de alta un lector** en la rama desechable — Ontoy 3.0 · PR P3.5.
 *
 *   pnpm --filter @jtel/db escenario-lector --llave <64 hex>
 *   pnpm --filter @jtel/db escenario-lector --llave <64 hex> --unidad 2120
 *   pnpm --filter @jtel/db escenario-lector --listar
 *   pnpm --filter @jtel/db escenario-lector --baja <id> --motivo "se perdió"
 *
 * Hasta que exista la pantalla de «Lectores» (P4), ésta es la única forma de
 * registrar uno, y por eso existe: sin alta, el lector lee y quema pero no
 * puede entregar nada, y la prueba física no cierra.
 *
 * **La llave la enseña el propio aparato.** Se abre `/validador` en el
 * teléfono, aparece «este lector no está registrado» con sus 64 caracteres, y
 * se copian aquí. El aparato se entera de su nombre solo, en cuanto tenga
 * señal: no hay que reiniciarlo.
 *
 * Sólo contra la desechable, como los demás escenarios. Y **sin nombres
 * propios en el código**: la unidad se pasa por bandera y se busca por su
 * etiqueta, que es un dato de la base, no una constante de aquí.
 */

function archivosDeAmbiente(): string[] {
  const base = ["../../.env", ".env"];
  try {
    const comun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
    }).trim();
    base.push(join(dirname(comun), ".env"));
  } catch {
    /* fuera de un repo, los dos de arriba bastan */
  }
  return base;
}
for (const p of archivosDeAmbiente()) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      if (process.env.DATABASE_URL_TEST) break;
    } catch {
      /* ignore */
    }
  }
}

const args = process.argv.slice(2);
const bandera = (nombre: string): string | undefined => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};

const iBase = args.indexOf("--base");
const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});
if (!veredicto.ok) {
  console.error(`\n  ✗ [escenario-lector] ${veredicto.motivo}\n`);
  process.exit(1);
}
console.log(`[escenario-lector] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}`);

const db = createDb(process.env.DATABASE_URL_TEST!);
const repos = createRepositories(db);
const libro = repos.libroDeBoletos;

async function listar() {
  const filas = await db
    .select({
      id: validators.id,
      label: validators.label,
      llave: validators.llavePublica,
      bajaEn: validators.bajaEn,
      unidad: units.label,
    })
    .from(validators)
    .leftJoin(
      validatorAssignments,
      and(eq(validatorAssignments.validatorId, validators.id), isNull(validatorAssignments.validTo)),
    )
    .leftJoin(units, eq(units.id, validatorAssignments.unitId));

  if (filas.length === 0) {
    console.log("[escenario-lector] no hay lectores registrados en esta rama.");
    return;
  }
  for (const f of filas) {
    const dónde = f.bajaEn ? `DE BAJA ${f.bajaEn.toISOString().slice(0, 10)}` : (f.unidad ?? "en bodega");
    console.log(`  ${f.label}  ${f.id}  ${dónde}`);
    console.log(`     llave ${f.llave}`);
  }
}

async function alta(llave: string, etiquetaDeUnidad: string | undefined) {
  const r = await libro.altaDeLector({
    carrierAccountId: await cuentaDeLaUnidad(etiquetaDeUnidad),
    llavePublica: llave,
    por: "escenario-lector",
  });
  if (!r.ok) {
    console.error(`\n  ✗ [escenario-lector] ${r.error}\n`);
    process.exit(1);
  }
  console.log(`[escenario-lector] alta: ${r.lector.label} · ${r.lector.id}`);

  if (!etiquetaDeUnidad) {
    console.log("[escenario-lector] sin unidad: el libro va a decir «no consta» en cada quemado.");
    return;
  }
  const unidad = await unidadPorEtiqueta(etiquetaDeUnidad);
  await libro.asignarLector(r.lector.id, unidad.id, new Date(), "escenario-lector");
  console.log(`[escenario-lector] asignado a la unidad ${unidad.label}`);
}

/**
 * La cuenta sale de la unidad, no de una constante: un lector es de la cuenta
 * del camión donde va montado. Sin unidad, se toma la del primer carrier que
 * haya — en la desechable eso es el escenario que se acabe de sembrar.
 */
async function cuentaDeLaUnidad(etiqueta: string | undefined): Promise<string> {
  if (etiqueta) return (await unidadPorEtiqueta(etiqueta)).carrierAccountId;
  const [alguna] = await db.select().from(units).limit(1);
  if (!alguna) {
    console.error(
      "\n  ✗ [escenario-lector] no hay ni una unidad en esta rama." +
        "\n    Siembra primero:  pnpm --filter @jtel/db escenario-ontoy\n",
    );
    process.exit(1);
  }
  return alguna.carrierAccountId;
}

async function unidadPorEtiqueta(etiqueta: string) {
  const [unidad] = await db.select().from(units).where(eq(units.label, etiqueta)).limit(1);
  if (!unidad) {
    console.error(`\n  ✗ [escenario-lector] no hay ninguna unidad «${etiqueta}» en esta rama.\n`);
    process.exit(1);
  }
  return unidad;
}

async function baja(id: string, motivo: string | undefined) {
  if (!motivo) {
    console.error("\n  ✗ [escenario-lector] la baja lleva --motivo. Sin motivo no es una baja (6.5).\n");
    process.exit(1);
  }
  const r = await libro.bajaDeLector(id, { at: new Date(), por: "escenario-lector", motivo });
  if (!r) {
    console.error("\n  ✗ [escenario-lector] ese lector no existe o ya estaba de baja.\n");
    process.exit(1);
  }
  console.log(`[escenario-lector] ${r.lector.label} de baja. Su llave queda revocada AHORA.`);
  if (r.soltada) console.log("[escenario-lector] estaba montado: se soltó en la misma transacción.");
}

const llave = bandera("--llave");
const idDeBaja = bandera("--baja");

if (args.includes("--listar")) await listar();
else if (idDeBaja) await baja(idDeBaja, bandera("--motivo"));
else if (llave) await alta(llave, bandera("--unidad"));
else {
  console.error(
    "\n  Uso:" +
      "\n    escenario-lector --llave <64 hex> [--unidad <etiqueta>]" +
      "\n    escenario-lector --listar" +
      "\n    escenario-lector --baja <id> --motivo <texto>\n",
  );
  process.exit(1);
}
process.exit(0);
