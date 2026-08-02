/**
 * ¿El conteo que hace la base dice lo mismo que contar las filas en JavaScript?
 *
 * SOLO LECTURA. Corre los DOS caminos sobre los mismos datos reales —el viejo
 * (traer las ocurrencias con sus nueve relaciones anidadas y contarlas con
 * `.filter().length`) y el nuevo (`count(*)` agrupado por estado)— y compara
 * cifra por cifra, alcance por alcance. Sale con código 1 si hay una sola
 * diferencia.
 *
 * El contador de referencia está **escrito aquí, no importado**: dos
 * implementaciones que llegan al mismo número es la única evidencia que vale;
 * una sola compartida no probaría nada. Es el mismo criterio de
 * `verificar-resumen-telemetria.ts`, del que este script es hermano.
 *
 * De paso mide: filas transportadas y milisegundos de cada camino. El costo que
 * esto viene a quitar no está en encontrar las filas sino en traerlas y
 * materializarlas — así que las filas son la cifra que importa, no solo el
 * reloj.
 *
 * Va por `DATABASE_URL_READONLY` a propósito: una medición contra la base real
 * no debe poder tocar nada ni por accidente. Ver `verificar-solo-lectura.ts`.
 *
 *   pnpm --filter @jtel/db verificar-conteos <slug-de-cuenta-cliente>
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "./index.js";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

type Conteo = {
  total: number;
  cumplido: number;
  no_cumplido: number;
  pendiente_evidencia: number;
  sin_hecho: number;
};

/** El camino viejo, escrito aparte a propósito: es la contraparte independiente. */
function contarRecorriendo(
  occs: Array<{ complianceFact?: { status: string } | null }>,
): Conteo {
  const conteo: Conteo = {
    total: 0,
    cumplido: 0,
    no_cumplido: 0,
    pendiente_evidencia: 0,
    sin_hecho: 0,
  };
  for (const o of occs) {
    conteo.total++;
    const s = o.complianceFact?.status;
    if (s === "cumplido") conteo.cumplido++;
    else if (s === "no_cumplido") conteo.no_cumplido++;
    else if (s === "pendiente_evidencia") conteo.pendiente_evidencia++;
    else conteo.sin_hecho++;
  }
  return conteo;
}

function diferencias(esperado: Conteo, obtenido: Conteo): string[] {
  const fallas: string[] = [];
  for (const clave of Object.keys(esperado) as Array<keyof Conteo>) {
    if (esperado[clave] !== obtenido[clave]) {
      fallas.push(`${clave} ${obtenido[clave]} vs ${esperado[clave]}`);
    }
  }
  return fallas;
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Es la credencial de solo lectura: sin ella, " +
        "la medición contra producción correría con el usuario dueño.",
    );
  }

  const slug = process.argv[2];
  if (!slug) throw new Error("Uso: verificar-conteos <slug-de-cuenta-cliente>");

  const db = createDb(url);
  const repos = createRepositories(db);

  const cuenta = await repos.accounts.findBySlug(slug);
  if (!cuenta || cuenta.type !== "client") {
    throw new Error(`No hay cuenta cliente con slug "${slug}"`);
  }

  let diferentes = 0;
  let filasViejo = 0;
  let msViejo = 0;
  let msNuevo = 0;

  const comparar = async (
    etiqueta: string,
    traer: () => Promise<Array<{ complianceFact?: { status: string } | null }>>,
    contar: () => Promise<Conteo>,
  ) => {
    const t0 = Date.now();
    const filas = await traer();
    msViejo += Date.now() - t0;
    filasViejo += filas.length;

    const t1 = Date.now();
    const obtenido = await contar();
    msNuevo += Date.now() - t1;

    const fallas = diferencias(contarRecorriendo(filas), obtenido);
    if (fallas.length > 0) {
      console.log(`  ✖ ${etiqueta}: ${fallas.join(" · ")}`);
      diferentes++;
    } else {
      console.log(
        `  ✓ ${etiqueta}: ${obtenido.total} servicios ` +
          `(${obtenido.cumplido} cumplidos · ${obtenido.no_cumplido} no · ` +
          `${obtenido.pendiente_evidencia} pendientes · ${obtenido.sin_hecho} sin hecho) ` +
          `— ${filas.length} filas traídas por el camino viejo`,
      );
    }
  };

  console.log(`\n  Cuenta ${cuenta.name} (${cuenta.slug})\n`);

  await comparar(
    "toda la cuenta",
    () => repos.occurrences.findForClientAccount(cuenta.id),
    () => repos.occurrences.countByStatusForClientAccount(cuenta.id),
  );

  for (const unidad of await repos.clients.getOperationalUnits(cuenta.id)) {
    const scope =
      unidad.kind === "plant"
        ? ({ kind: "plant", plantId: unidad.id } as const)
        : ({ kind: "plant_group", plantGroupId: unidad.id } as const);
    await comparar(
      `${unidad.kind === "plant" ? "planta" : "campus"} ${unidad.name}`,
      () => repos.occurrences.findForScope(scope),
      () => repos.occurrences.countByStatusForScope(scope),
    );
  }

  for (const contrato of await repos.contracts.findForClient(cuenta.id)) {
    await comparar(
      `contrato ${contrato.id.slice(0, 8)}`,
      () => repos.occurrences.findForContract(contrato.id),
      () => repos.occurrences.countByStatusForContract(contrato.id),
    );
  }

  console.log(
    `\n  camino viejo: ${filasViejo} filas de ocurrencia transportadas en ${msViejo} ms` +
      `\n  camino nuevo: 0 filas de ocurrencia transportadas en ${msNuevo} ms\n`,
  );
  console.log(
    diferentes === 0
      ? "  ✓ cero diferencias entre el conteo de la base y el recorrido en JavaScript\n"
      : `  ${diferentes} alcances con diferencias\n`,
  );

  process.exit(diferentes === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
