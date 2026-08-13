/**
 * El nulo de los hechos viejos sigue intacto.
 *
 * SOLO LECTURA. Es la valla de la tercera decisión de la Parte 2, y existe
 * porque **ese nulo no se puede recuperar**: es la única forma de saber que a
 * las candidatas de un servicio viejo nunca se les preguntó por qué no
 * acreditaron. Si algo lo rellena —una migración con default, un guion
 * "servicial", un UPDATE de consola—, la distinción se pierde para siempre y
 * ninguna lectura posterior puede reconstruirla.
 *
 *   NULL  = no se preguntó (el motor de entonces no registraba el porqué)
 *   '[]'  = se preguntó y no hubo ninguna candidata
 *
 * ---
 *
 * **Las tres comprobaciones, y la tercera es la que de verdad vigila.**
 *
 *   1. Cuántos hechos tienen la columna en nulo y cuántos con dato.
 *   2. Que ninguno traiga `[]` **antes** de que exista el código que lo escribe:
 *      un `[]` en esta época solo puede venir de un default o de un relleno.
 *   3. Que los que traen dato sean **un sufijo por fecha de sellado**. Los
 *      hechos se sellan hacia adelante, así que a partir del despliegue de la
 *      Parte 2 todos los nuevos traen dato y ninguno viejo debería. **Si aparece
 *      un hecho con dato más antiguo que otro sin dato, alguien rellenó hacia
 *      atrás** — y eso es exactamente lo que esta valla existe para atrapar.
 *
 * Sale con código 1 si algo no cuadra, para que sirva en CI o antes de un
 * despliegue.
 *
 *   pnpm --filter @jtel/db verificar-candidatas-nulas
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";

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

function num(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("es-MX");
}

export type EstadoDeLaColumna = {
  /** `column_default` del catálogo. Cualquier cosa distinta de null es un problema. */
  columnDefault: string | null;
  total: number;
  nulos: number;
  conDato: number;
  /** Hechos con `[]` pelón: el armador nunca produce eso. */
  vacios: number;
  ultimoNulo: Date | null;
  primeroConDato: Date | null;
  /** Hechos con dato sellados ANTES del primero con dato. Solo un relleno los crea. */
  viejosConDato: number;
};

/**
 * El veredicto de la valla, separado de la consulta para poder **verla ponerse
 * roja** sin escribir en producción (regla 8). Devuelve un renglón por
 * problema; vacío significa que el nulo sigue intacto.
 */
export function evaluarNulos(e: EstadoDeLaColumna): string[] {
  const problemas: string[] = [];

  if (e.columnDefault !== null) {
    problemas.push(
      `la columna tiene default (${e.columnDefault}): todo lo ya sellado afirmaría algo que nadie midió`,
    );
  }
  if (e.vacios > 0) {
    problemas.push(`${e.vacios} hechos traen '[]' pelón, que el armador no produce`);
  }
  if (e.viejosConDato > 0) {
    problemas.push(`${e.viejosConDato} hechos con dato por debajo del corte: alguien rellenó hacia atrás`);
  }
  /*
   * Los hechos se sellan hacia adelante, así que lo que trae expediente tiene
   * que ser un sufijo. Un hecho SIN dato sellado después de uno CON dato
   * significa o que el motor dejó de escribirlo, o que se rellenó hacia atrás.
   */
  if (
    e.conDato > 0 &&
    e.ultimoNulo !== null &&
    e.primeroConDato !== null &&
    e.ultimoNulo > e.primeroConDato
  ) {
    problemas.push(
      "hay hechos SIN expediente sellados DESPUÉS del primero que sí lo trae",
    );
  }
  return problemas;
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });
  let problemas = 0;

  try {
    console.log(`\n  El nulo de los hechos viejos — valla de la Parte 2`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura\n`);

    const [existe] = await sql<Array<{ hay: boolean; def: string | null }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'compliance_facts'
           AND column_name = 'candidatas_snapshot') AS hay,
      (SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'compliance_facts'
          AND column_name = 'candidatas_snapshot') AS def`;

    if (!existe?.hay) {
      console.log(`  ✗ La columna no existe. ¿Se aplicó la 0021?\n`);
      await sql.end();
      process.exit(1);
    }

    // El default tiene que estar vacío. Con uno puesto, lo viejo mentiría.
    if (existe.def !== null) {
      console.log(`  ✗ La columna TIENE default: ${existe.def}`);
      console.log(`    Un default hace que todo lo ya sellado afirme algo que nadie midió.`);
      problemas++;
    } else {
      console.log(`  ✓ sin default — «no se preguntó» sigue siendo distinguible`);
    }

    const [c] = await sql<Array<{ total: string; nulos: string; con_dato: string; vacios: string }>>`
      SELECT count(*)                                                        AS total,
             count(*) FILTER (WHERE candidatas_snapshot IS NULL)             AS nulos,
             count(*) FILTER (WHERE candidatas_snapshot IS NOT NULL)         AS con_dato,
             count(*) FILTER (WHERE candidatas_snapshot = '[]'::jsonb)       AS vacios
        FROM compliance_facts`;

    console.log(`\n  hechos sellados            ${num(c!.total).padStart(8)}`);
    console.log(`    en NULL (no se preguntó) ${num(c!.nulos).padStart(8)}`);
    console.log(`    con expediente           ${num(c!.con_dato).padStart(8)}`);

    /*
     * Un `[]` a secas en la columna sería un snapshot mal armado: el armador
     * devuelve `null` cuando no hubo candidatas que evaluar, nunca un arreglo
     * pelón — la forma guardada es un objeto con `evaluadas` adentro.
     */
    if (Number(c!.vacios) > 0) {
      console.log(`  ✗ ${num(c!.vacios)} hechos traen '[]' pelón, que el armador no produce.`);
      problemas++;
    }

    // ── La que vigila: lo que trae dato tiene que ser un sufijo por sellado ──
    const [orden] = await sql<Array<{
      ultimo_nulo: Date | null;
      primero_con_dato: Date | null;
      viejos_con_dato: string;
    }>>`
      WITH corte AS (
        SELECT min(materialized_at) AS desde
          FROM compliance_facts WHERE candidatas_snapshot IS NOT NULL
      )
      SELECT (SELECT max(materialized_at) FROM compliance_facts
               WHERE candidatas_snapshot IS NULL)          AS ultimo_nulo,
             (SELECT desde FROM corte)                     AS primero_con_dato,
             (SELECT count(*) FROM compliance_facts, corte
               WHERE candidatas_snapshot IS NOT NULL
                 AND materialized_at < corte.desde)::text  AS viejos_con_dato`;

    if (Number(c!.con_dato) === 0) {
      console.log(
        `\n  ✓ ningún hecho trae expediente todavía — el código de la Parte 2 no ha\n` +
          `    sellado nada. Es lo esperado antes de su despliegue.`,
      );
    } else {
      const ultimoNulo = orden?.ultimo_nulo ?? null;
      const primero = orden?.primero_con_dato ?? null;
      console.log(`\n  el más nuevo SIN expediente   ${ultimoNulo?.toISOString() ?? "—"}`);
      console.log(`  el más viejo CON expediente   ${primero?.toISOString() ?? "—"}`);

      /*
       * Los hechos se sellan hacia adelante. Si un hecho CON dato es más viejo
       * que el corte, no pudo haberlo escrito el motor: lo escribió alguien
       * hacia atrás.
       */
      if (Number(orden?.viejos_con_dato ?? 0) > 0) {
        console.log(`  ✗ ${num(orden!.viejos_con_dato)} hechos con dato por debajo del corte.`);
        problemas++;
      }

      if (ultimoNulo && primero && ultimoNulo > primero) {
        console.log(
          `  ✗ Hay hechos SIN expediente sellados DESPUÉS del primero que sí lo trae.\n` +
            `    O el motor dejó de escribirlo, o alguien rellenó hacia atrás. Las dos\n` +
            `    cosas hay que mirarlas antes de seguir sellando.`,
        );
        problemas++;
      } else {
        console.log(`  ✓ lo que trae expediente es un sufijo limpio: nadie rellenó hacia atrás`);
      }
    }

    console.log(
      problemas === 0
        ? `\n  ✓ el nulo sigue intacto\n`
        : `\n  ✗ ${problemas} problema(s) — el nulo NO se puede recuperar una vez perdido\n`,
    );

    await sql.end();
    process.exit(problemas === 0 ? 0 : 1);
  } catch (e) {
    await sql.end();
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
