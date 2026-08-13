/**
 * ¿A cuántos alcanza el paso 3 —la atribución pasa al corredor— y en qué
 * dirección?
 *
 * SOLO LECTURA. Se corre ANTES de construirlo, que es lo que Asav pidió: saber
 * el tamaño antes de que entre, no después.
 *
 * ---
 *
 * **Las dos direcciones, y solo una se puede medir hoy.**
 *
 *   **La que SUMA** — candidatas que hoy pasan B y las tumba A. Si la atribución
 *   pasa a B, dejan de ser rechazadas por A. **Esto sí se mide**: los números de
 *   A, B y sus umbrales están sellados en cada candidata.
 *
 *   **La que RESTA** — servicios que hoy acreditan y perderían la atribución
 *   porque el recorrido encaja MEJOR en otra ruta del turno. **Esto NO se puede
 *   medir hasta que el paso 2 haya sellado rankings**, y por eso el paso 2
 *   existe: es la medición de «antes» de este cambio. Con cero rankings
 *   sellados, construir el paso 3 sería moverse a ciegas en la mitad del efecto.
 *
 * **Se cuenta por contrato, siempre.** Planta 47 corre en `destino_only` y el
 * Campus en `kml_full`: son dos regímenes, y un promedio no describe a ninguno.
 *
 *   pnpm --filter @jtel/db alcance-paso3
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
    console.log(`\n  Alcance del paso 3 — la atribución pasa al corredor`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    const filas = await sql<Array<{
      contrato: string;
      estado: string;
      servicios: number;
      pasa_b_falla_a: number;
      y_tramo_alcanza: number;
    }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC),
      cand AS (
        SELECT ult.occ,
               (s->'details'->>'routeMatchPct')::float        AS a,
               (s->'details'->>'minKmlPct')::float            AS min_a,
               (s->'details'->>'corridorPrecisionPct')::float AS b,
               (s->'details'->>'minCorridorPct')::float       AS min_b,
               (s->'details'->>'observableFraction')::float   AS frac,
               (s->'details' ? 'arrivalAt')                   AS llego
          FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
         WHERE s->>'step' = 'candidata')
      SELECT sc.name AS contrato,
             cf.status::text AS estado,
             count(DISTINCT o.id)::int AS servicios,
             count(DISTINCT o.id) FILTER (
               WHERE EXISTS (SELECT 1 FROM cand c WHERE c.occ = o.id
                              AND c.llego AND c.b >= c.min_b AND c.a < c.min_a))::int AS pasa_b_falla_a,
             /*
              * Y con el tramo observable alcanzando su piso: sin eso, la
              * candidata la tumbaría igual la compuerta de Ley 1, y contarla
              * como «se movería» sería prometer de más.
              */
             count(DISTINCT o.id) FILTER (
               WHERE EXISTS (SELECT 1 FROM cand c WHERE c.occ = o.id
                              AND c.llego AND c.b >= c.min_b AND c.a < c.min_a
                              AND (c.frac IS NULL OR c.frac >= 0.85)))::int AS y_tramo_alcanza
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cf.observed_unit_id IS NULL
         AND cli.is_demo = false AND car.is_demo = false
       GROUP BY 1, 2 ORDER BY 1, 2`;

    console.log(`  ── La dirección que SUMA ───────────────────────────────────────────`);
    console.log(
      `  ${"contrato".padEnd(28)}${"estado".padEnd(22)}${"servicios".padStart(10)}${"pasa B, falla A".padStart(17)}${"+ tramo alcanza".padStart(17)}`,
    );
    for (const f of filas) {
      console.log(
        `  ${f.contrato.slice(0, 26).padEnd(28)}${f.estado.padEnd(22)}` +
          `${String(f.servicios).padStart(10)}${String(f.pasa_b_falla_a).padStart(17)}${String(f.y_tramo_alcanza).padStart(17)}`,
      );
    }

    const [rk] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM ledger_entries le
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s
                      WHERE s->>'step' = 'ranking_rutas')`;

    console.log(`\n  ── La dirección que RESTA ──────────────────────────────────────────`);
    console.log(`  asientos con ranking de rutas sellado (paso 2): ${rk!.n}`);
    if (rk!.n === 0) {
      console.log(
        `\n  ⚠ CERO. Sin rankings sellados **no se puede medir cuántos servicios\n` +
          `  perderían la atribución** porque su recorrido encaja mejor en otra ruta\n` +
          `  del turno. Ésa es la mitad del efecto del paso 3, y es la mitad que\n` +
          `  quita acreditaciones — la cara cara de equivocarse.\n\n` +
          `  **El paso 2 existe justo para producir este dato.** Construir el paso 3\n` +
          `  hoy sería tirar la medición de «antes» que se acaba de construir.`,
      );
    }

    console.log(
      `\n  ⚠ Y lo que ninguna cifra de aquí dice: que un hecho ya sellado se mueva.\n` +
        `  Nada de lo sellado cambia solo — mover lo de atrás es re-verificar, y eso\n` +
        `  es D4. Estos números describen CADA CUÁNTO ocurre el patrón, no cuántos\n` +
        `  servicios cambiarían al desplegar.\n`,
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
