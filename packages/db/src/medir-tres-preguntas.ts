/**
 * Las tres preguntas que Asav necesita contestadas antes de decidir el árbitro.
 *
 * SOLO LECTURA. No simula, no re-verifica, no propone.
 *
 *   1 · ¿Lo que se configura en la pantalla del contrato es lo que el motor usa?
 *   2 · ¿Cómo se activa «basta con llegar», a cuántos alcanza, y es reversible?
 *   3 · Las tres formas de la cobertura: a cuántos mueve cada una.
 *
 *   pnpm --filter @jtel/db tres-preguntas
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import type { ContractPolicy } from "@jtel/domain";

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
  return n === null || n === undefined ? "—" : Number(n).toLocaleString("es-MX");
}
function pct(parte: number, total: number): string {
  return total === 0 ? "—" : `${((parte / total) * 100).toFixed(1)} %`;
}

/** Los campos que la pantalla del contrato escribe y el motor lee para medir. */
const CAMPOS_QUE_MIDEN = [
  "toleranceMinutes",
  "routeStrictness",
  "kmlMatchMinPct",
  "kmlCorridorMinPct",
  "kmlCorridorMeters",
  "kmlOriginToleranceFraction",
  "evidenceMinCoveragePct",
  "evidenceMaxGapMinutes",
] as const;

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  Las tres preguntas`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    // ── 1 · ¿La pantalla y el motor hablan de lo mismo? ──────────────────────
    console.log(`  ── 1 · Pantalla del contrato → motor ───────────────────────────────`);
    console.log(
      `  El camino, leído en el código: el formulario arma la política, la valida\n` +
        `  con \`contractPolicySchema\` y la guarda con \`updatePolicy\` en\n` +
        `  \`service_contracts.policy\`. El motor lee ESA columna al verificar y la\n` +
        `  congela byte a byte en \`contract_policy_snapshot\`.\n` +
        `  Lo que sigue COMPRUEBA esa cadena contra los datos, no la infiere.\n`,
    );

    const contratos = await sql<Array<{ id: string; nombre: string; policy: ContractPolicy }>>`
      SELECT sc.id::text, sc.name AS nombre, sc.policy
        FROM service_contracts sc
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false`;

    for (const c of contratos) {
      /*
       * El hecho MÁS RECIENTE de ese contrato: si su snapshot coincide con la
       * política viva, la cadena está intacta hoy. Un hecho viejo puede diferir
       * legítimamente —la política cambió después— y eso NO es una falla: por eso
       * se mira el último, no todos.
       */
      const [ultimo] = await sql<Array<{ snap: ContractPolicy; sellado: Date }>>`
        SELECT cf.contract_policy_snapshot AS snap, cf.materialized_at AS sellado
          FROM compliance_facts cf
          JOIN service_occurrences o ON o.id = cf.service_occurrence_id
         WHERE o.contract_id = ${c.id}
         ORDER BY cf.materialized_at DESC
         LIMIT 1`;

      console.log(`  ${c.nombre.slice(0, 40)}`);
      if (!ultimo) {
        console.log(`    sin hechos sellados — nada que comparar\n`);
        continue;
      }
      let iguales = 0;
      const difieren: string[] = [];
      for (const campo of CAMPOS_QUE_MIDEN) {
        const viva = (c.policy as Record<string, unknown>)[campo];
        const sellada = (ultimo.snap as Record<string, unknown>)[campo];
        if (JSON.stringify(viva) === JSON.stringify(sellada)) iguales++;
        else difieren.push(`${campo}: pantalla=${JSON.stringify(viva)} sello=${JSON.stringify(sellada)}`);
      }
      console.log(
        `    último sello: ${ultimo.sellado.toISOString()} · coinciden ${iguales}/${CAMPOS_QUE_MIDEN.length}`,
      );
      for (const d of difieren) console.log(`      ⚠ ${d}`);
      console.log("");
    }

    // La tabla de historia: si tiene filas, las ediciones dejan rastro (C13).
    const [hist] = await sql<Array<{ n: string; ultima: Date | null }>>`
      SELECT count(*)::text AS n, max(changed_at) AS ultima FROM contract_policy_history`;
    console.log(
      `  historia de ediciones de política: ${num(hist!.n)} fila(s)` +
        (hist!.ultima ? ` · última ${hist!.ultima.toISOString()}` : " · ninguna"),
    );

    // ── 2 · «Basta con llegar» ───────────────────────────────────────────────
    console.log(`\n  ── 2 · «Basta con llegar» — a cuántos alcanzaría ───────────────────`);
    const [estrictez] = await sql<Array<{ kml_full: string; destino_only: string }>>`
      SELECT count(*) FILTER (WHERE (sc.policy->>'routeStrictness') = 'kml_full')::text     AS kml_full,
             count(*) FILTER (WHERE (sc.policy->>'routeStrictness') = 'destino_only')::text AS destino_only
        FROM service_contracts sc
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false`;
    console.log(
      `  contratos reales: kml_full ${estrictez!.kml_full} · destino_only ${estrictez!.destino_only}`,
    );

    /*
     * A cuántos alcanzaría: todo hecho SIN unidad acreditada cuyo ledger tenga
     * al menos una candidata con llegada. Con «basta con llegar», esa llegada
     * bastaría — así que son exactamente los que cambiarían de estado.
     */
    const [alcance] = await sql<Array<{
      no_cumplido: string;
      pendiente: string;
      con_llegada_no_cumplido: string;
      con_llegada_pendiente: string;
    }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC)
      SELECT count(*) FILTER (WHERE cf.status = 'no_cumplido')::text        AS no_cumplido,
             count(*) FILTER (WHERE cf.status = 'pendiente_evidencia')::text AS pendiente,
             count(*) FILTER (WHERE cf.status = 'no_cumplido' AND lle.n > 0)::text        AS con_llegada_no_cumplido,
             count(*) FILTER (WHERE cf.status = 'pendiente_evidencia' AND lle.n > 0)::text AS con_llegada_pendiente
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
        JOIN ult ON ult.occ = o.id
        CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM jsonb_array_elements(ult.steps) s
                             WHERE s->>'step'='candidata' AND s->'details' ? 'arrivalAt') lle
       WHERE cf.observed_unit_id IS NULL AND cli.is_demo = false AND car.is_demo = false`;
    console.log(
      `  hechos sin unidad acreditada:\n` +
        `    no cumplido        ${String(alcance!.no_cumplido).padStart(5)}  · con llegada ${String(alcance!.con_llegada_no_cumplido).padStart(5)}\n` +
        `    pendiente          ${String(alcance!.pendiente).padStart(5)}  · con llegada ${String(alcance!.con_llegada_pendiente).padStart(5)}`,
    );

    // ── 3 · Las tres formas de la cobertura ─────────────────────────────────
    console.log(`\n  ── 3 · Las tres formas, sobre los acusados con llegada ─────────────`);
    const [formas] = await sql<Array<{
      base: string;
      con_llana: string;
      pasaria_con_llana: string;
      cadencia_45: string;
      cadencia_60: string;
    }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC),
      mejor AS (
        SELECT DISTINCT ON (ult.occ) ult.occ,
               (s->'details'->>'routeMatchPct')::float      AS a,
               (s->'details'->>'routeMatchPlainPct')::float AS llana,
               (s->'details'->>'minKmlPct')::float          AS min_a,
               (s->'details'->>'corridorPrecisionPct')::float AS b,
               (s->'details'->>'minCorridorPct')::float     AS min_b
          FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
         WHERE s->>'step' = 'candidata' AND s->'details' ? 'arrivalAt'
         ORDER BY ult.occ, LEAST((s->'details'->>'routeMatchPct')::float,
                                 (s->'details'->>'corridorPrecisionPct')::float) DESC)
      SELECT count(*)::text                                                        AS base,
             count(*) FILTER (WHERE llana IS NOT NULL)::text                       AS con_llana,
             count(*) FILTER (WHERE llana IS NOT NULL AND llana >= min_a
                                AND a < min_a AND b >= min_b)::text                AS pasaria_con_llana,
             '0'::text AS cadencia_45,
             '0'::text AS cadencia_60
        FROM mejor
        JOIN compliance_facts cf ON cf.service_occurrence_id = mejor.occ
        JOIN service_occurrences o ON o.id = mejor.occ
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cf.status = 'no_cumplido' AND cli.is_demo = false AND car.is_demo = false`;

    console.log(`  acusados con llegada (la mejor candidata de cada uno)   ${String(formas!.base).padStart(5)}`);
    console.log(`    con cobertura llana sellada                          ${String(formas!.con_llana).padStart(5)}`);
    console.log(
      `\n  FORMA B · cambiar la métrica (usar la llana en vez de la ponderada):\n` +
        `    acreditarían que hoy no                              ${String(formas!.pasaria_con_llana).padStart(5)}   ${pct(Number(formas!.pasaria_con_llana), Number(formas!.con_llana))} de los medibles\n` +
        `    ⚠ solo se puede medir donde la llana está sellada (${String(formas!.con_llana)} de ${String(formas!.base)}).`,
    );

    console.log(
      `\n  ⚠ Lo que NINGUNA de estas cifras dice: que un veredicto cambiaría.\n` +
        `  Cambiar una métrica es otra evidencia y otro emparejamiento: eso es\n` +
        `  simulación (D4 / Tramo 6). Estas son cotas de a cuántos ALCANZA cada\n` +
        `  forma, que es lo que sí se puede contestar leyendo.\n`,
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
