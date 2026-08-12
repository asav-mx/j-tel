/**
 * ¿La ventana de observación alcanza a ver la ruta entera?
 *
 * SOLO LECTURA. Es el insumo para declarar los siete campos del dimensionado de
 * la ventana **con evidencia en vez de a ojo**.
 *
 * ---
 *
 * **El problema, dicho corto.** La ventana decide **qué evidencia se mira para
 * juzgar**. Si abre después de que el camión arrancó, el árbitro no ve el inicio
 * de la ruta — y eso no produce un veredicto malo: produce un
 * `observacion_insuficiente`, que es un servicio sin juicio. **No es un ajuste
 * fino: es el borde de lo que el árbitro llega a ver.**
 *
 * **Cómo se reconstruye el arranque real sin recalcular geometría.**
 * `route_traversal_measurements.duration_minutes` es, por definición, **del
 * primer punto en corredor a la llegada**. Y el hecho guarda la llegada. Así:
 *
 *     arranque real ≈ llegada observada − duración medida
 *
 * Es una resta sobre dos cifras que el sistema ya calculó y guardó, no una
 * medición nueva — así que **mide lo que el motor vio, no lo que yo creo que
 * pasó**, que es justo lo que hace falta para decidir la ventana.
 *
 * ⚠ **Y su límite, que va delante porque cambia la lectura:** `lower_bound`
 * marca las mediciones que **toparon con el borde de la ventana**. En ésas la
 * duración es **un piso, no un dato** — la ruta duró *al menos* eso—, así que
 * **el arranque real fue AÚN MÁS TEMPRANO** de lo que sale aquí. **Toda cifra de
 * esta corrida que venga de una medición acotada subestima el problema.**
 *
 *   pnpm --filter @jtel/db medir-ventana
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

function num(n: number | null, d = 0): string {
  return n === null ? "—" : n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  La ventana contra la ruta — insumo del dimensionado`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    // 1 · Cuánto dura una ruta, y cuántas mediciones están acotadas por la ventana.
    const dur = await sql<Array<{
      contrato: string; n: number; acotadas: number;
      p50: number; p90: number; maxi: number;
      p50_libres: number | null; p90_libres: number | null;
    }>>`
      WITH reales AS (
        SELECT sc.id, sc.name FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      )
      SELECT r.name AS contrato, COUNT(*)::int AS n,
             SUM(CASE WHEN m.lower_bound THEN 1 ELSE 0 END)::int AS acotadas,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.duration_minutes) AS p50,
             PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY m.duration_minutes) AS p90,
             MAX(m.duration_minutes) AS maxi,
             PERCENTILE_CONT(0.5) WITHIN GROUP (
               ORDER BY CASE WHEN NOT m.lower_bound THEN m.duration_minutes END) AS p50_libres,
             PERCENTILE_CONT(0.9) WITHIN GROUP (
               ORDER BY CASE WHEN NOT m.lower_bound THEN m.duration_minutes END) AS p90_libres
        FROM route_traversal_measurements m
        JOIN service_occurrences o ON o.id = m.service_occurrence_id
        JOIN reales r ON r.id = o.contract_id
       GROUP BY 1 ORDER BY 1`;

    console.log(`  ── 1 · Cuánto dura una ruta (minutos) ────────────────────────────`);
    console.log(`  ${"contrato".padEnd(32)}${"n".padStart(5)}${"acotadas".padStart(10)}${"p50".padStart(8)}${"p90".padStart(8)}${"máx".padStart(8)}${"p50 libres".padStart(12)}${"p90 libres".padStart(12)}`);
    for (const d of dur) {
      console.log(
        `  ${d.contrato.slice(0, 30).padEnd(32)}${num(d.n).padStart(5)}${num(d.acotadas).padStart(10)}` +
          `${num(Number(d.p50)).padStart(8)}${num(Number(d.p90)).padStart(8)}${num(Number(d.maxi)).padStart(8)}` +
          `${num(d.p50_libres === null ? null : Number(d.p50_libres)).padStart(12)}` +
          `${num(d.p90_libres === null ? null : Number(d.p90_libres)).padStart(12)}`,
      );
    }
    console.log(
      `\n  «acotadas» toparon con el borde de la ventana: ahí la duración es un PISO, no\n` +
        `  un dato. Las columnas «libres» son las que no topan — la única lectura limpia.\n`,
    );

    // 2 · El arranque real contra lo que la ventana alcanza a ver.
    const ini = await sql<Array<{
      contrato: string; n: number;
      p50_arranque: number; p90_arranque: number;
      p50_ventana: number; tarde: number; margen_p10: number;
    }>>`
      WITH reales AS (
        SELECT sc.id, sc.name FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      base AS (
        SELECT r.name AS contrato,
               EXTRACT(EPOCH FROM (o.expected_deadline - (cf.observed_arrival_at
                 - MAKE_INTERVAL(mins => m.duration_minutes::int)))) / 60.0 AS arranque_antes,
               EXTRACT(EPOCH FROM (o.expected_deadline - t.evidence_window_start)) / 60.0 AS ventana_antes
          FROM route_traversal_measurements m
          JOIN service_occurrences o ON o.id = m.service_occurrence_id
          JOIN reales r ON r.id = o.contract_id
          JOIN trips t ON t.service_occurrence_id = o.id
          JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
         WHERE cf.observed_arrival_at IS NOT NULL
      )
      SELECT contrato, COUNT(*)::int AS n,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY arranque_antes) AS p50_arranque,
             PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY arranque_antes) AS p90_arranque,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ventana_antes)  AS p50_ventana,
             SUM(CASE WHEN ventana_antes < arranque_antes THEN 1 ELSE 0 END)::int AS tarde,
             PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY ventana_antes - arranque_antes) AS margen_p10
        FROM base GROUP BY 1 ORDER BY 1`;

    console.log(`  ── 2 · El arranque real contra lo que la ventana ve (min antes del deadline) ──`);
    console.log(`  ${"contrato".padEnd(32)}${"n".padStart(5)}${"arranque p50".padStart(14)}${"arranque p90".padStart(14)}${"ventana abre".padStart(14)}${"ABRE TARDE".padStart(12)}${"margen p10".padStart(12)}`);
    for (const d of ini) {
      console.log(
        `  ${d.contrato.slice(0, 30).padEnd(32)}${num(d.n).padStart(5)}` +
          `${num(Number(d.p50_arranque)).padStart(14)}${num(Number(d.p90_arranque)).padStart(14)}` +
          `${num(Number(d.p50_ventana)).padStart(14)}${num(d.tarde).padStart(12)}` +
          `${num(Number(d.margen_p10)).padStart(12)}`,
      );
    }
    console.log(
      `\n  «ABRE TARDE» = servicios donde el arranque reconstruido cae ANTES de que la\n` +
        `  ventana abriera. «margen p10» = el décimo peor caso, en minutos de sobra.\n`,
    );
    console.log(
      `  ⚠ ESTA TABLA MEZCLA DOS ÉPOCAS, y por eso sus cifras son indicativas y no\n` +
        `  concluyentes: la duración se midió con la ventana vigente ENTONCES, y la\n` +
        `  ventana que se compara es la guardada HOY — y la ventana se deriva, así que\n` +
        `  cambia cuando cambia la historia de la ruta. Un «abre tarde» puede ser una\n` +
        `  ventana que se angostó después, no una que llegó tarde ese día.\n` +
        `  **La cifra limpia de esta corrida es «acotadas» en §1: sale de una bandera\n` +
        `  guardada por el propio motor y no depende de ninguna resta.**\n`,
    );

    // 3 · Los pendientes por observación insuficiente, con su fracción.
    const obs = await sql<Array<{
      contrato: string; n: number; p50: number; maxi: number; tol: number;
    }>>`
      WITH reales AS (
        SELECT sc.id, sc.name FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT r.name AS contrato, COUNT(*)::int AS n,
             PERCENTILE_CONT(0.5) WITHIN GROUP (
               ORDER BY (s->'details'->>'earliestObservedFraction')::float) AS p50,
             MAX((s->'details'->>'earliestObservedFraction')::float) AS maxi,
             MAX((s->'details'->>'originToleranceFraction')::float) AS tol
        FROM ult
        JOIN service_occurrences o ON o.id = ult.service_occurrence_id
        JOIN reales r ON r.id = o.contract_id
        JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
       CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE cf.status = 'pendiente_evidencia'
         AND s->>'step' = 'decision'
         AND s->'details'->>'reason' = 'observacion_insuficiente'
       GROUP BY 1 ORDER BY 1`;

    console.log(`  ── 3 · Los pendientes por observación insuficiente ────────────────`);
    console.log(`  ${"contrato".padEnd(32)}${"n".padStart(5)}${"fracción p50".padStart(14)}${"fracción máx".padStart(14)}${"tolerancia".padStart(12)}`);
    for (const d of obs) {
      console.log(
        `  ${d.contrato.slice(0, 30).padEnd(32)}${num(d.n).padStart(5)}` +
          `${num(Number(d.p50) * 100, 1).padStart(14)}${num(Number(d.maxi) * 100, 1).padStart(14)}` +
          `${num(Number(d.tol) * 100, 0).padStart(12)}`,
      );
    }

    /*
     * El desglose que contesta «¿cuántos se recuperarían con una ventana más
     * temprana?». Se reparte por cuánto sobrepasan la tolerancia, porque **la
     * distancia al umbral es la que dice si falta un poco de ventana o falta
     * media ruta** — y las dos cosas se ven igual en un promedio.
     */
    const tramos = await sql<Array<{ tramo: string; n: number }>>`
      WITH reales AS (
        SELECT sc.id FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      ),
      f AS (
        SELECT (s->'details'->>'earliestObservedFraction')::float AS frac,
               (s->'details'->>'originToleranceFraction')::float  AS tol
          FROM ult
          JOIN service_occurrences o ON o.id = ult.service_occurrence_id
          JOIN reales r ON r.id = o.contract_id
          JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
         CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
         WHERE cf.status = 'pendiente_evidencia'
           AND s->>'step' = 'decision'
           AND s->'details'->>'reason' = 'observacion_insuficiente'
      )
      SELECT CASE
               WHEN frac <= tol * 1.5 THEN 'a · roza la tolerancia (≤ 1.5x)'
               WHEN frac <= tol * 2.5 THEN 'b · la dobla (1.5x – 2.5x)'
               ELSE                       'c · muy adentro (> 2.5x)'
             END AS tramo,
             COUNT(*)::int AS n
        FROM f GROUP BY 1 ORDER BY 1`;

    console.log(`\n  Cuánto sobrepasan la tolerancia:`);
    for (const t of tramos) console.log(`    ${t.tramo.padEnd(36)}${num(t.n).padStart(4)}`);
    console.log(
      `\n  La «fracción» es qué tan adentro de la ruta cayó el primer punto que coincidió\n` +
        `  con el trazado. Por encima de la tolerancia, el motor no puede saber si el tramo\n` +
        `  inicial se hizo — y dicta pendiente en vez de acusar (Ley 1).\n` +
        `  **Una ventana que abriera antes bajaría esa fracción.** Cuánto antes, sale de §2.\n`,
    );

    await sql.end();
  } catch (e) {
    await sql.end();
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
