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

/**
 * Los márgenes contra los que se dibuja la curva, en puntos de B.
 *
 * No es una propuesta de valor: es el eje de la gráfica. El margen se decide
 * con la curva enfrente, igual que el piso de densidad del paso 4 — y por la
 * misma razón, que un margen sin medir es un umbral escondido.
 */
const MARGENES = [0, 1, 2, 5, 10] as const;

/**
 * La mitad que faltaba: cuántas candidatas PIERDEN la atribución.
 *
 * ── Por qué esto no existía hasta hoy ───────────────────────────────────────
 *
 * El #314 midió el alcance del paso 3 y solo pudo medir una de sus dos
 * direcciones. La que SUMA —candidatas que hoy pasan B y las tumba A— se lee de
 * los números ya sellados en cada candidata. La que RESTA necesita saber contra
 * qué OTRAS rutas encajaba el recorrido, y eso no existía: el paso 2 se había
 * mergeado minutos antes y había cero rankings sellados.
 *
 * Este archivo quedó con la rama del cero escrita y la otra no. Al haber
 * rankings, imprimía el conteo y seguía de largo — un instrumento que declara
 * su propio hueco y luego lo deja sin llenar. Esta función lo llena.
 *
 * ── Qué se mide, exactamente ────────────────────────────────────────────────
 *
 * Para cada candidata que el paso 2 rankeó, se compara su B contra la ruta del
 * servicio con la mejor B contra CUALQUIER otra ruta del turno:
 *
 *   · la propia gana          → el paso 3 le mantendría la atribución
 *   · gana otra               → el paso 3 se la quita: el recorrido encaja
 *                               mejor en otra ruta, y atribuir por B ya no la
 *                               elige a ella
 *
 * Y de esas, se separa **la que hoy acredita**: perder la atribución de una
 * candidata que hoy no acredita no le cambia el veredicto a nadie. La cifra que
 * duele es la otra.
 *
 * ⚠ El empate NO es un volado. Cuando la propia gana por menos que el margen,
 * la atribución no se hace: es `pendiente`, la misma ley del piso aplicada al
 * empate. Por eso la curva de márgenes cuenta esos casos aparte.
 */
async function direccionQueResta(sql: ReturnType<typeof postgres>) {
  const filas = await sql<Array<{
    contrato: string;
    rankeadas: number;
    emparejadas: number;
    acreditan_hoy: number;
    sin_propia: number;
    propia_gana: number;
    pierde: number;
    pierde_y_hoy_acredita: number;
  }>>`
    WITH ult AS (
      SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
        FROM ledger_entries le
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'ranking_rutas')
       ORDER BY le.service_occurrence_id, le.created_at DESC),
    /* Una fila por candidata rankeada: su B contra la ruta del servicio, y la
     * mejor B contra cualquier otra ruta del mismo turno. */
    rk AS (
      SELECT ult.occ,
             r->>'unidadId' AS unidad,
             max((lug->>'corridorPct')::float)
               FILTER (WHERE (lug->>'esLaDelServicio')::boolean)     AS b_propia,
             max((lug->>'corridorPct')::float)
               FILTER (WHERE NOT (lug->>'esLaDelServicio')::boolean) AS b_otra
        FROM ult
        CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
        CROSS JOIN LATERAL jsonb_array_elements(s->'details'->'rankings') r
        CROSS JOIN LATERAL jsonb_array_elements(r->'ranking') lug
       WHERE s->>'step' = 'ranking_rutas'
       GROUP BY 1, 2),
    /* Si esa misma candidata acredita HOY, segun su propio paso candidata. */
    acred AS (
      SELECT ult.occ,
             s->'details'->>'unidadId' AS unidad,
             (s->>'result' = 'sirvio_ruta') AS acredita
        FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE s->>'step' = 'candidata' AND s->'details' ? 'unidadId')
    SELECT sc.name AS contrato,
           count(*)::int AS rankeadas,
           /* Cuántas rankeadas encontraron SU paso candidata. Si esto no iguala
            * a rankeadas, el join se está comiendo filas y cualquier cifra que
            * dependa de acreditar es un cero por no encontrar, no un cero
            * medido. Se cuenta y se enseña: un join mudo miente igual que un
            * chequeo mudo. */
           count(*) FILTER (WHERE a.acredita IS NOT NULL)::int AS emparejadas,
           count(*) FILTER (WHERE a.acredita)::int AS acreditan_hoy,
           /* La ruta del servicio no entró al ranking (sin trazado): no se
            * puede comparar, y contarla como "gana" o "pierde" sería inventar. */
           count(*) FILTER (WHERE rk.b_propia IS NULL)::int AS sin_propia,
           count(*) FILTER (WHERE rk.b_propia IS NOT NULL
                              AND (rk.b_otra IS NULL OR rk.b_propia >= rk.b_otra))::int AS propia_gana,
           count(*) FILTER (WHERE rk.b_propia IS NOT NULL
                              AND rk.b_otra IS NOT NULL
                              AND rk.b_otra > rk.b_propia)::int AS pierde,
           count(*) FILTER (WHERE rk.b_propia IS NOT NULL
                              AND rk.b_otra IS NOT NULL
                              AND rk.b_otra > rk.b_propia
                              AND a.acredita)::int AS pierde_y_hoy_acredita
      FROM rk
      JOIN service_occurrences o ON o.id = rk.occ
      JOIN service_contracts sc ON sc.id = o.contract_id
      JOIN accounts cli ON cli.id = sc.client_account_id
      JOIN accounts car ON car.id = sc.carrier_account_id
      LEFT JOIN acred a ON a.occ = rk.occ AND a.unidad = rk.unidad
     WHERE cli.is_demo = false AND car.is_demo = false
     GROUP BY 1 ORDER BY 1`;

  console.log(
    `\n  ${"contrato".padEnd(28)}${"rankeadas".padStart(11)}${"emparej.".padStart(10)}` +
      `${"acred.hoy".padStart(11)}${"propia gana".padStart(13)}${"PIERDE".padStart(9)}` +
      `${"y hoy acredita".padStart(16)}`,
  );
  for (const f of filas) {
    console.log(
      `  ${f.contrato.slice(0, 26).padEnd(28)}${String(f.rankeadas).padStart(11)}` +
        `${String(f.emparejadas).padStart(10)}${String(f.acreditan_hoy).padStart(11)}` +
        `${String(f.propia_gana).padStart(13)}${String(f.pierde).padStart(9)}` +
        `${String(f.pierde_y_hoy_acredita).padStart(16)}`,
    );
    if (f.emparejadas !== f.rankeadas) {
      console.log(
        `  ⚠ ${f.contrato.slice(0, 26)}: ${f.rankeadas - f.emparejadas} rankeadas sin su paso ` +
          `candidata. Las cifras de "acredita" describen solo las emparejadas.`,
      );
    }
  }
  if (filas.length === 0) {
    console.log(`  (ninguna candidata rankeada en cuentas reales)`);
  }

  /*
   * Cómo se lee esta tabla, dicho aquí porque el número grande engaña.
   *
   * "PIERDE" es enorme y no significa lo que parece: son candidatas cuyo
   * recorrido encaja mejor en otra ruta del turno, y **la enorme mayoría no
   * acredita hoy** — son camiones de otras rutas que entraron a la misma
   * geocerca. Perder una atribución que nunca tuvieron no le mueve el veredicto
   * a nadie.
   *
   * La columna que describe el riesgo del paso 3 es la última.
   */
  const acreditanHoy = filas.reduce((s, f) => s + f.acreditan_hoy, 0);
  const pierdenAcreditando = filas.reduce((s, f) => s + f.pierde_y_hoy_acredita, 0);
  console.log(
    `\n  Lectura: de las ${acreditanHoy} candidatas que HOY acreditan, ${pierdenAcreditando} perderían la\n` +
      `  atribución con el paso 3. El "PIERDE" grande son candidatas que no acreditan\n` +
      `  —camiones de otras rutas dentro de la misma geocerca—; quitarles una ruta que\n` +
      `  nunca tuvieron no mueve ningún veredicto.`,
  );

  /*
   * La curva del margen: de las que la propia gana, cuántas ganan por MENOS que
   * cada margen. Ésas no se atribuyen — se van a pendiente, no a un volado.
   */
  const curva = await sql<Array<{
    contrato: string;
    margen: number;
    bajo_margen: number;
    bajo_margen_acredita: number;
  }>>`
    WITH ult AS (
      SELECT DISTINCT ON (le.service_occurrence_id) le.service_occurrence_id AS occ, le.steps
        FROM ledger_entries le
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'ranking_rutas')
       ORDER BY le.service_occurrence_id, le.created_at DESC),
    rk AS (
      SELECT ult.occ,
             r->>'unidadId' AS unidad,
             max((lug->>'corridorPct')::float)
               FILTER (WHERE (lug->>'esLaDelServicio')::boolean)     AS b_propia,
             max((lug->>'corridorPct')::float)
               FILTER (WHERE NOT (lug->>'esLaDelServicio')::boolean) AS b_otra
        FROM ult
        CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
        CROSS JOIN LATERAL jsonb_array_elements(s->'details'->'rankings') r
        CROSS JOIN LATERAL jsonb_array_elements(r->'ranking') lug
       WHERE s->>'step' = 'ranking_rutas'
       GROUP BY 1, 2),
    acred AS (
      SELECT ult.occ,
             s->'details'->>'unidadId' AS unidad,
             (s->>'result' = 'sirvio_ruta') AS acredita
        FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE s->>'step' = 'candidata' AND s->'details' ? 'unidadId')
    SELECT sc.name AS contrato,
           m.margen::float AS margen,
           count(*) FILTER (WHERE rk.b_propia IS NOT NULL
                              AND rk.b_otra IS NOT NULL
                              AND rk.b_propia >= rk.b_otra
                              AND rk.b_propia - rk.b_otra < m.margen)::int AS bajo_margen,
           /* La cifra que decide: de las que HOY acreditan, cuántas se irían a
            * pendiente por no ganar por suficiente. Un margen que solo toca
            * candidatas que nunca acreditaron no le cuesta nada a nadie. */
           count(*) FILTER (WHERE rk.b_propia IS NOT NULL
                              AND rk.b_otra IS NOT NULL
                              AND rk.b_propia >= rk.b_otra
                              AND rk.b_propia - rk.b_otra < m.margen
                              AND a.acredita)::int AS bajo_margen_acredita
      FROM rk
      JOIN service_occurrences o ON o.id = rk.occ
      JOIN service_contracts sc ON sc.id = o.contract_id
      JOIN accounts cli ON cli.id = sc.client_account_id
      JOIN accounts car ON car.id = sc.carrier_account_id
      LEFT JOIN acred a ON a.occ = rk.occ AND a.unidad = rk.unidad
      CROSS JOIN unnest(${sql.array([...MARGENES])}::float[]) AS m(margen)
     WHERE cli.is_demo = false AND car.is_demo = false
     GROUP BY 1, 2 ORDER BY 1, 2`;

  if (curva.length > 0) {
    console.log(`\n  ── La curva del margen ─────────────────────────────────────────────`);
    console.log(`  Candidatas que quedarían SIN atribuir (pendiente) por ganar la propia`);
    console.log(`  por menos que el margen. Entre paréntesis, las que HOY acreditan —`);
    console.log(`  que son las únicas a las que el margen les cambia el veredicto:\n`);
    const porContrato = new Map<string, string[]>();
    for (const c of curva) {
      const lista = porContrato.get(c.contrato) ?? [];
      lista.push(
        `${String(c.margen).padStart(3)} pts → ${String(c.bajo_margen).padStart(3)}` +
          ` (${String(c.bajo_margen_acredita)})`,
      );
      porContrato.set(c.contrato, lista);
    }
    for (const [contrato, lista] of porContrato) {
      console.log(`  ${contrato.slice(0, 26).padEnd(28)}${lista.join("  ")}`);
    }
  }

  console.log(
    `\n  ⚠ Muestra: estos rankings son los sellados desde que el paso 2 entró.\n` +
      `  El motor sella 48 servicios al día, así que una cifra chica aquí es una\n` +
      `  ventana corta, no un patrón raro. Se declara para que nadie la lea como\n` +
      `  si describiera toda la flota.`,
  );
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
    } else {
      await direccionQueResta(sql);
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
