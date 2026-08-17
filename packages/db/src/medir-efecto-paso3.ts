/**
 * El efecto del paso 3, PAREADO POR SERVICIO y por contrato.
 *
 * SOLO LECTURA. Corre después de que el paso 3 esté desplegado y compara, sobre
 * los hechos que él selló, qué habría pasado con la atribución vieja.
 *
 * ---
 *
 * **Por qué pareado y no dos agregados.** La ficha de construcción lo pide
 * explícito: «cuántas candidatas atribuyen antes y después, pareado por
 * servicio — no dos agregados». Dos totales de dos corridas distintas se pueden
 * mover porque cambió la población, no porque cambió la regla; pareado, cada
 * hecho se compara consigo mismo.
 *
 * **Por qué por contrato, siempre.** Planta 47 corre en `destino_only` y el
 * Campus en `kml_full`. Son dos regímenes: un promedio no describe a ninguno.
 *
 * **De dónde sale el «antes».** Del propio hecho. Cada candidata sellada desde
 * el paso 3 trae su bloque `atribucion` con la B de la propia, la mejor ajena y
 * el margen aplicado. Con eso se reconstruye la decisión vieja —B contra su
 * umbral, sin comparar— sin re-correr el árbitro y sin tocar nada.
 *
 *   pnpm --filter @jtel/db efecto-paso3
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

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  Efecto del paso 3 — la atribución pasa al corredor`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    const filas = await sql<Array<{
      contrato: string;
      candidatas: number;
      comparadas: number;
      atribuye_hoy: number;
      atribuiria_antes: number;
      solo_antes: number;
      empates: number;
    }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC),
      cand AS (
        SELECT ult.occ,
               s->'details'->>'unidadId' AS unidad,
               (s->'details'->'atribucion'->>'propia')::float      AS propia,
               (s->'details'->'atribucion'->>'mejorAjena')::float  AS ajena,
               (s->'details'->'atribucion'->>'margen')::float      AS margen,
               (s->'details'->'atribucion'->>'gana')::boolean      AS gana,
               (s->'details'->'atribucion'->>'comparada')::boolean AS comparada,
               (s->'details'->>'minCorridorPct')::float            AS min_b
          FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
         WHERE s->>'step' = 'candidata'
           AND s->'details' ? 'atribucion')
      SELECT sc.name AS contrato,
             count(*)::int AS candidatas,
             count(*) FILTER (WHERE c.comparada)::int AS comparadas,
             /* Hoy: la decisión que el motor tomó de verdad. */
             count(*) FILTER (WHERE c.gana)::int AS atribuye_hoy,
             /* Antes del paso 3: B contra su umbral, sin comparar con nadie. */
             count(*) FILTER (WHERE c.propia >= c.min_b)::int AS atribuiria_antes,
             /* El pareado que importa: la MISMA candidata que antes atribuía y
              * hoy no. Es la dirección que RESTA, ya no estimada sino sellada. */
             count(*) FILTER (WHERE c.propia >= c.min_b AND NOT c.gana)::int AS solo_antes,
             /* De ésas, cuántas se cayeron por el MARGEN y no por perder: la
              * propia iba arriba pero no por suficiente. Separarlas importa
              * porque son las únicas que mover el margen recupera. */
             count(*) FILTER (
               WHERE c.propia >= c.min_b AND NOT c.gana
                 AND c.ajena IS NOT NULL AND c.propia >= c.ajena)::int AS empates
        FROM cand c
        JOIN service_occurrences o ON o.id = c.occ
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false
       GROUP BY 1 ORDER BY 1`;

    if (filas.length === 0) {
      console.log(
        `  ⚠ Ninguna candidata sellada trae el bloque \`atribucion\`.\n\n` +
          `  Eso NO es «el paso 3 no movió nada»: es que todavía no ha sellado\n` +
          `  ningún hecho con él, o que no llegó a producción. Un cero aquí y un\n` +
          `  «sin efecto» se ven igual si nadie los separa — la misma trampa que\n` +
          `  costó C21.\n`,
      );
      await sql.end();
      return;
    }

    console.log(
      `  ${"contrato".padEnd(28)}${"candidatas".padStart(12)}${"comparadas".padStart(12)}` +
        `${"atribuye hoy".padStart(14)}${"atribuía antes".padStart(16)}${"solo antes".padStart(12)}` +
        `${"de ésas, empate".padStart(17)}`,
    );
    for (const f of filas) {
      console.log(
        `  ${f.contrato.slice(0, 26).padEnd(28)}${String(f.candidatas).padStart(12)}` +
          `${String(f.comparadas).padStart(12)}${String(f.atribuye_hoy).padStart(14)}` +
          `${String(f.atribuiria_antes).padStart(16)}${String(f.solo_antes).padStart(12)}` +
          `${String(f.empates).padStart(17)}`,
      );
    }

    const solo = filas.reduce((s, f) => s + f.solo_antes, 0);
    const emp = filas.reduce((s, f) => s + f.empates, 0);
    console.log(
      `\n  Lectura: «solo antes» son las candidatas que la atribución vieja habría\n` +
        `  aceptado y la nueva no — ${solo} en total, de las cuales ${emp} se cayeron por el\n` +
        `  MARGEN (iban arriba, pero no por suficiente) y ${solo - emp} porque otra ruta del\n` +
        `  turno les encaja mejor. Solo las primeras las recupera mover el margen.`,
    );

    console.log(
      `\n  ⚠ Esto NO dice cuántos veredictos cambiaron. Una candidata que deja de\n` +
        `  atribuir puede no ser la que sostenía el veredicto del servicio: eso lo\n` +
        `  decide \`verifyService\` entre todas. Aquí se mide la ATRIBUCIÓN, que es\n` +
        `  el término que el paso 3 movió, y nada más.\n`,
    );

    await sql.end();
  } catch (e) {
    await sql.end();
    throw e;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
