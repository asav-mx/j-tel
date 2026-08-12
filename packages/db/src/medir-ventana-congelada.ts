/**
 * La ventana congelada: qué se juzgó con ella, y qué habría visto la de hoy.
 *
 * SOLO LECTURA. Es el insumo de dos frentes hermanos —«la ventana se congela y
 * nadie la revisa» y «el arranque real fuera de la ventana»— y contesta las
 * tres preguntas que hay que tener contestadas ANTES de diseñar cualquiera de
 * los dos.
 *
 * ---
 *
 * **El mecanismo, dicho corto.** `trips.evidence_window_start` se calcula al
 * crear el viaje y **no lo vuelve a mirar nadie**. La derivación
 * (`deriveObservationWindow`) usa la historia de la ruta, y esa historia crece:
 * la ventana que hoy se derivaría para un servicio del 12 de julio **no es la
 * que se le congeló entonces**. Es la forma de C21 —*congelar sin forma de
 * revisar es el patrón, no el campo*— en un tercer campo, después de la hora
 * límite y la geocerca.
 *
 * ⚠ **Lo que esta corrida NO establece, y va primero porque cambia cómo se lee
 * todo lo demás: NINGUNA cifra de aquí dice que un veredicto cambiaría.** Para
 * saber eso hay que volver a correr el árbitro sobre otra ventana —otra
 * evidencia, otro emparejamiento entre candidatas, otro sello— y eso es
 * **simulación**: D4 / Tramo 6, con la firma que pide la ley 2. Lo que sí se
 * mide aquí es **cuántos se juzgarían sobre evidencia distinta**, que es la
 * cota superior de lo otro y una pregunta que sí se puede contestar leyendo.
 *
 *   pnpm --filter @jtel/db medir-ventana-congelada
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import {
  computeEvidenceWindow,
  routeLengthKm,
  summarizeRouteDuration,
  type ContractPolicy,
  type RouteDurationSample,
} from "@jtel/domain";

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
 * Cuánto rato sin un punto rompe la continuidad de un rastro (min).
 *
 * No es un umbral de política: es la lectura de que dos puntos separados por
 * media hora no prueban un camión andando entre ellos. Con `evidenceMaxGapMinutes`
 * en 10 en los dos contratos, 20 deja pasar un hueco de cobertura sin dejar
 * pasar un estacionamiento.
 */
const HUECO_QUE_ROMPE_MIN = 20;
/** Velocidad (km/h) por encima de la cual un punto es movimiento y no un motor encendido. */
const VELOCIDAD_DE_MOVIMIENTO = 5;
/** Hasta dónde atrás se busca rastro: el techo duro de la ventana, 360 min. */
const HORAS_ATRAS = 6;

function num(n: number | null | undefined, d = 0): string {
  return n === null || n === undefined
    ? "—"
    : n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function pct(parte: number, total: number): string {
  return total === 0 ? "—" : `${((parte / total) * 100).toFixed(1)} %`;
}

function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[i]!;
}

type FilaHecho = {
  occurrence_id: string;
  contrato: string;
  contract_id: string;
  service_date: string;
  deadline: Date;
  window_start: Date;
  route_shift_id: string;
  route_id: string;
  policy: ContractPolicy;
};

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  La ventana congelada — insumo de los dos frentes`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    /*
     * Los hechos no cumplidos de los contratos reales, con la ventana que de
     * verdad se les aplicó. `no_cumplido` y no todos: la pregunta es sobre
     * acusaciones, y un cumplido no se vuelve más cumplido con más ventana.
     */
    const hechos = await sql<FilaHecho[]>`
      SELECT o.id                AS occurrence_id,
             sc.name             AS contrato,
             sc.id               AS contract_id,
             o.service_date::text AS service_date,
             o.expected_deadline AS deadline,
             t.evidence_window_start AS window_start,
             o.route_shift_id,
             rs.route_id,
             sc.policy
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN trips t              ON t.service_occurrence_id = o.id
        JOIN route_shifts rs      ON rs.id = o.route_shift_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cf.status = 'no_cumplido'
         AND cli.is_demo = false AND car.is_demo = false
       ORDER BY sc.name, o.service_date`;

    // La historia de duración de cada ruta×turno, TAL COMO ESTÁ HOY.
    const medRaw = await sql<Array<{ route_shift_id: string; duration_minutes: number; lower_bound: boolean }>>`
      SELECT route_shift_id, duration_minutes, lower_bound
        FROM route_traversal_measurements`;
    const porRutaTurno = new Map<string, RouteDurationSample[]>();
    for (const m of medRaw) {
      const arr = porRutaTurno.get(m.route_shift_id) ?? [];
      arr.push({ durationMinutes: Number(m.duration_minutes), lowerBound: m.lower_bound });
      porRutaTurno.set(m.route_shift_id, arr);
    }

    /*
     * El largo del trazado, para el arranque en frío: sin historia medida, la
     * derivación estima la duración sobre la geometría. Se toma la versión
     * vigente de cada ruta — la comparación es «la que hoy se derivaría».
     */
    const kml = await sql<Array<{ route_id: string; waypoints: Array<{ lat: number; lng: number }> }>>`
      SELECT DISTINCT ON (route_id) route_id, waypoints
        FROM route_kml_versions
       WHERE valid_to IS NULL
       ORDER BY route_id, valid_from DESC`;
    const largoDeRuta = new Map<string, number>();
    for (const k of kml) {
      if (Array.isArray(k.waypoints) && k.waypoints.length > 1) {
        largoDeRuta.set(k.route_id, routeLengthKm(k.waypoints));
      }
    }

    // ── 1 · La población: acusados a los que la ventana abrió tarde ──────────
    type Anotado = FilaHecho & {
      antesCongelado: number;
      p50Ruta: number | null;
      maxRuta: number | null;
      antesHoy: number;
      baseHoy: string;
    };

    const anotados: Anotado[] = hechos.map((h) => {
      const muestras = porRutaTurno.get(h.route_shift_id) ?? [];
      const duraciones = muestras.map((m) => m.durationMinutes);
      const resumen = summarizeRouteDuration(muestras, {
        percentile: h.policy.routeDurationPercentile,
        minSamples: h.policy.routeDurationMinSamples,
      });
      const hoy = computeEvidenceWindow(new Date(h.deadline), h.policy, {
        measuredDurationMinutes: resumen.minutes,
        routeLengthKm: largoDeRuta.get(h.route_id) ?? null,
      });
      return {
        ...h,
        antesCongelado: Math.round(
          (new Date(h.deadline).getTime() - new Date(h.window_start).getTime()) / 60_000,
        ),
        p50Ruta: percentil(duraciones, 50),
        maxRuta: duraciones.length > 0 ? Math.max(...duraciones) : null,
        antesHoy: hoy.beforeMinutes,
        baseHoy: hoy.basis,
      };
    });

    console.log(`  ── 1 · Acusados a los que su ventana abrió después de que la ruta ya andaba ──`);
    console.log(
      `  ${"contrato".padEnd(32)}${"no cumpl.".padStart(10)}${"con mediana".padStart(13)}${"con máxima".padStart(12)}`,
    );
    const contratos = [...new Set(anotados.map((a) => a.contrato))].sort();
    const conMaxima = new Map<string, Anotado[]>();
    for (const c of contratos) {
      const del = anotados.filter((a) => a.contrato === c);
      const mediana = del.filter((a) => a.p50Ruta !== null && a.p50Ruta > a.antesCongelado);
      const maxima = del.filter((a) => a.maxRuta !== null && a.maxRuta > a.antesCongelado);
      conMaxima.set(c, maxima);
      console.log(
        `  ${c.slice(0, 30).padEnd(32)}${num(del.length).padStart(10)}` +
          `${num(mediana.length).padStart(13)}${num(maxima.length).padStart(12)}`,
      );
    }
    console.log(
      `\n  «con mediana» = la duración MEDIANA de su ruta×turno ya excede los minutos que\n` +
        `  su ventana abrió antes. «con máxima» = lo mismo con la duración máxima medida.\n` +
        `  La segunda es la población de la que hablan las tres preguntas de abajo.\n`,
    );

    // La población de trabajo: los «con máxima» de todos los contratos reales.
    const poblacion = contratos.flatMap((c) => conMaxima.get(c) ?? []);
    const ids = poblacion.map((p) => p.occurrence_id);
    if (ids.length === 0) {
      console.log("  Sin población que medir.\n");
      await sql.end();
      return;
    }

    // ── 2 · ¿Cuántos se juzgarían sobre evidencia distinta con la ventana de hoy? ──
    const masAncha = poblacion.filter((p) => p.antesHoy > p.antesCongelado);
    const igual = poblacion.filter((p) => p.antesHoy === p.antesCongelado);
    const masAngosta = poblacion.filter((p) => p.antesHoy < p.antesCongelado);
    const ganados = masAncha.map((p) => p.antesHoy - p.antesCongelado);

    /*
     * El mismo conteo sobre TODOS los no cumplidos, no solo sobre la población.
     *
     * Va primero porque el de la población está contaminado por construcción:
     * §1 la selecciona justo por «la ruta dura más que lo que su ventana abrió»,
     * que es casi el mismo criterio con el que la derivación de hoy decide
     * ensanchar. Su 100 % no es un hallazgo, es la definición mirándose al
     * espejo. **La cifra que sí compara algo es ésta.**
     */
    const todosMasAncha = anotados.filter((a) => a.antesHoy > a.antesCongelado);
    console.log(`  ── 2 · La ventana de hoy contra la que se les congeló ──────────────`);
    console.log(
      `  ${"TODOS los no cumplidos".padEnd(46)}${num(anotados.length).padStart(8)}`,
    );
    console.log(
      `  ${"  de ésos, la de hoy abre ANTES".padEnd(46)}${num(todosMasAncha.length).padStart(8)}   ${pct(todosMasAncha.length, anotados.length)}`,
    );
    console.log(`  ${"población (los «con máxima»)".padEnd(46)}${num(poblacion.length).padStart(8)}`);
    console.log(
      `  ${"  de ésos, la de hoy abre ANTES".padEnd(46)}${num(masAncha.length).padStart(8)}   ${pct(masAncha.length, poblacion.length)}`,
    );
    console.log(`  ${"  la de hoy es idéntica".padEnd(46)}${num(igual.length).padStart(8)}   ${pct(igual.length, poblacion.length)}`);
    console.log(`  ${"  la de hoy abre DESPUÉS".padEnd(46)}${num(masAngosta.length).padStart(8)}   ${pct(masAngosta.length, poblacion.length)}`);
    if (ganados.length > 0) {
      console.log(
        `\n  minutos que se abrirían de más:  p50 ${num(percentil(ganados, 50))} · p90 ${num(percentil(ganados, 90))} · máx ${num(Math.max(...ganados))}`,
      );
      for (const c of contratos) {
        const g = masAncha
          .filter((p) => p.contrato === c)
          .map((p) => p.antesHoy - p.antesCongelado);
        if (g.length === 0) continue;
        console.log(
          `    ${c.slice(0, 30).padEnd(32)}n ${num(g.length).padStart(4)} · p50 ${num(percentil(g, 50))} · p90 ${num(percentil(g, 90))} · máx ${num(Math.max(...g))}`,
        );
      }
    }
    const porBase = new Map<string, number>();
    for (const p of poblacion) porBase.set(p.baseHoy, (porBase.get(p.baseHoy) ?? 0) + 1);
    console.log(
      `  de dónde sale la ventana de hoy: ${[...porBase.entries()].map(([b, n]) => `${b} ${n}`).join(" · ")}`,
    );

    /*
     * El tramo que la ventana de hoy abriría y la congelada no: ¿hay ahí
     * evidencia propia que el árbitro no miró? Se pregunta por los aparatos que
     * SÍ aparecieron dentro de la ventana de ese viaje — son las candidatas que
     * el motor de verdad tuvo enfrente, no la flota entera.
     */
    /*
     * ¿Hay evidencia propia en el tramo que la ventana de hoy abriría de más?
     *
     * Se pregunta por LA MEJOR CANDIDATA de ese servicio —la que el ledger dejó
     * con más coincidencia de trazado—, no por los aparatos que aparecen en el
     * viaje. Esa distinción no es un detalle: un `trip` de Planta 47 guarda
     * puntos de CINCUENTA Y UN aparatos, que es la flota entera del carrier, y
     * preguntar «¿alguno se movía?» sobre la flota entera contesta que sí
     * siempre. Sería un 100 % que no dice nada.
     */
    const mejorCandidata = await sql<Array<{ occurrence_id: string; imei: string }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE le.service_occurrence_id = ANY(${ids}::uuid[])
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      ),
      mejor AS (
        SELECT DISTINCT ON (ult.occ) ult.occ, s->'details'->>'imei' AS quien
          FROM ult CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
         WHERE s->>'step' = 'candidata' AND s->'details' ? 'imei'
         ORDER BY ult.occ, (s->'details'->>'routeMatchPct')::float DESC NULLS LAST
      )
      /*
       * C15 en carne viva: el campo se llama «imei» y guarda DOS identidades
       * según la época — un id de unidad en los asientos viejos, el IMEI de
       * verdad en los nuevos. Se resuelven las dos, porque quedarse con una
       * dejaría fuera media población sin avisar.
       */
      SELECT m.occ AS occurrence_id, d.imei
        FROM mejor m
        JOIN devices d
          ON (m.quien ~ '^[0-9]+$' AND d.imei = m.quien)
          OR (m.quien ~ '^[0-9a-f-]{36}$' AND EXISTS (
                SELECT 1 FROM device_assignments da
                 WHERE da.device_id = d.id AND da.unit_id = m.quien::uuid))`;

    const imeisPorOcurrencia = new Map<string, string[]>();
    for (const m of mejorCandidata) {
      const arr = imeisPorOcurrencia.get(m.occurrence_id) ?? [];
      arr.push(m.imei);
      imeisPorOcurrencia.set(m.occurrence_id, arr);
    }
    // Pares (ocurrencia, aparato) aplanados: es como viajan a SQL sin armar
    // una consulta por servicio.
    const parOcc: string[] = [];
    const parImei: string[] = [];
    for (const [occ, lista] of imeisPorOcurrencia) {
      for (const imei of lista) {
        parOcc.push(occ);
        parImei.push(imei);
      }
    }
    console.log(
      `  con mejor candidata identificable: ${num(imeisPorOcurrencia.size)} de ${num(poblacion.length)} (${pct(imeisPorOcurrencia.size, poblacion.length)})`,
    );

    const idsMasAncha = masAncha.map((p) => p.occurrence_id);
    const ganadosPorId = masAncha.map((p) => p.antesHoy - p.antesCongelado);
    const enElTramo =
      idsMasAncha.length === 0
        ? []
        : await sql<Array<{ occurrence_id: string; puntos: number; en_movimiento: number }>>`
            WITH par AS (
              SELECT * FROM unnest(${parOcc}::uuid[], ${parImei}::text[]) AS p(occ, imei)
            ),
            obj AS (
              SELECT u.id, u.ganados, t.evidence_window_start AS ini
                FROM unnest(${idsMasAncha}::uuid[], ${ganadosPorId}::int[]) AS u(id, ganados)
                JOIN trips t ON t.service_occurrence_id = u.id
            )
            SELECT obj.id AS occurrence_id,
                   COUNT(tp.id)::int AS puntos,
                   COALESCE(SUM(CASE WHEN tp.speed > ${VELOCIDAD_DE_MOVIMIENTO} THEN 1 ELSE 0 END), 0)::int AS en_movimiento
              FROM obj
              JOIN par ON par.occ = obj.id
              LEFT JOIN telemetry_points tp
                     ON tp.imei = par.imei
                    AND tp.recorded_at <  obj.ini
                    AND tp.recorded_at >= obj.ini - MAKE_INTERVAL(mins => obj.ganados)
             GROUP BY obj.id`;

    const conEvidenciaNueva = enElTramo.filter((e) => e.puntos > 0);
    const conMovimientoNuevo = enElTramo.filter((e) => e.en_movimiento > 0);
    const medidos = enElTramo.length;
    console.log(
      `\n  De los ${num(masAncha.length)} que hoy se juzgarían con ventana más ancha (${num(medidos)} con\n` +
        `  candidata identificable), en el tramo que se abriría de más YA HAY evidencia\n` +
        `  propia guardada de esa misma candidata:\n` +
        `    con algún punto             ${num(conEvidenciaNueva.length).padStart(6)}   ${pct(conEvidenciaNueva.length, medidos)}\n` +
        `    con puntos EN MOVIMIENTO    ${num(conMovimientoNuevo.length).padStart(6)}   ${pct(conMovimientoNuevo.length, medidos)}   (> ${VELOCIDAD_DE_MOVIMIENTO} km/h)\n`,
    );
    console.log(
      `  ⚠ «se juzgarían sobre otra evidencia» NO es «cambiarían de veredicto». Más\n` +
        `  evidencia puede confirmar la acusación igual de bien que tumbarla. Saber cuál\n` +
        `  exige correr el árbitro otra vez, y eso es re-verificar: D4 / Tramo 6.\n`,
    );

    // ── 3 · El solape con los acusados que sí tuvieron una llegada registrada ──
    /*
     * Del ÚLTIMO asiento con decisión, no de todo el ledger. Un servicio
     * re-verificado tiene varias corridas guardadas, y contar sobre todas
     * mezcla el veredicto vigente con los que ya fueron reemplazados: el
     * conteo sale más grande y ya no describe lo que hoy se le imputa a nadie.
     */
    const conLlegada = await sql<Array<{ occurrence_id: string }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT ult.occ AS occurrence_id
        FROM ult
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(ult.steps) s
          WHERE s->>'step' = 'candidata' AND s->'details' ? 'arrivalAt')`;
    const setLlegada = new Set(conLlegada.map((c) => c.occurrence_id));

    console.log(`  ── 3 · El solape: acusados con una llegada registrada en el ledger ──`);
    console.log(
      `  ${"contrato".padEnd(32)}${"no cumpl.".padStart(10)}${"con llegada".padStart(13)}${"y en la pobl.".padStart(15)}`,
    );
    let totalConLlegada = 0;
    for (const c of contratos) {
      const del = anotados.filter((a) => a.contrato === c);
      const conLl = del.filter((a) => setLlegada.has(a.occurrence_id));
      const solape = (conMaxima.get(c) ?? []).filter((a) => setLlegada.has(a.occurrence_id));
      totalConLlegada += conLl.length;
      console.log(
        `  ${c.slice(0, 30).padEnd(32)}${num(del.length).padStart(10)}${num(conLl.length).padStart(13)}${num(solape.length).padStart(15)}`,
      );
    }
    const solapeTotal = poblacion.filter((p) => setLlegada.has(p.occurrence_id));
    console.log(
      `\n  Acusados con llegada registrada, en total: ${num(totalConLlegada)}.\n` +
        `  De la población de §1: ${num(solapeTotal.length)} de ${num(poblacion.length)} (${pct(solapeTotal.length, poblacion.length)}).\n`,
    );

    // ── 4 · El arranque real fuera de la ventana ─────────────────────────────
    /*
     * ¿A qué hora arrancó de verdad la unidad?
     *
     * Tres preguntas encadenadas, y van en ese orden a propósito porque cada
     * una vale menos que la siguiente:
     *
     *   1. ¿HAY dato? — puntos propios de la candidata antes de su ventana.
     *      Contesta «el dato ya está y solo falta mirarlo», nada más.
     *   2. ¿VENÍA RODANDO? — movimiento en los últimos minutos antes de que la
     *      ventana abriera Y movimiento después. Un camión estacionado con el
     *      GPS prendido cumple la 1 y no la 2.
     *   3. ¿CUÁNTO ANTES arrancó? — el inicio de la corrida de movimiento
     *      vigente, que es lo que queda después de la última parada larga. Sin
     *      cortar por paradas, esto mide «cuándo prendieron el aparato» y no
     *      «cuándo salió el camión», y satura contra el borde de la búsqueda.
     */
    const VENTANA_DE_CONTINUIDAD_MIN = 15;
    const PARADA_QUE_CORTA_MIN = 10;

    const puntosAntes = await sql<Array<{
      occurrence_id: string;
      puntos_antes: number;
      rodando_antes: boolean | null;
      rodando_dentro: boolean | null;
    }>>`
      WITH par AS (
        SELECT * FROM unnest(${parOcc}::uuid[], ${parImei}::text[]) AS p(occ, imei)
      ),
      ven AS (
        SELECT t.service_occurrence_id AS occ, t.evidence_window_start AS ini
          FROM trips t WHERE t.service_occurrence_id = ANY(${ids}::uuid[])
      )
      SELECT ven.occ AS occurrence_id,
             COUNT(tp.id) FILTER (WHERE tp.recorded_at < ven.ini)::int AS puntos_antes,
             BOOL_OR(tp.speed > ${VELOCIDAD_DE_MOVIMIENTO}
                     AND tp.recorded_at <  ven.ini
                     AND tp.recorded_at >= ven.ini - MAKE_INTERVAL(mins => ${VENTANA_DE_CONTINUIDAD_MIN})) AS rodando_antes,
             BOOL_OR(tp.speed > ${VELOCIDAD_DE_MOVIMIENTO}
                     AND tp.recorded_at >= ven.ini
                     AND tp.recorded_at <  ven.ini + MAKE_INTERVAL(mins => ${VENTANA_DE_CONTINUIDAD_MIN})) AS rodando_dentro
        FROM ven
        JOIN par ON par.occ = ven.occ
        LEFT JOIN telemetry_points tp
               ON tp.imei = par.imei
              AND tp.recorded_at >= ven.ini - MAKE_INTERVAL(hours => ${HORAS_ATRAS})
              AND tp.recorded_at <  ven.ini + MAKE_INTERVAL(mins => ${VENTANA_DE_CONTINUIDAD_MIN})
       GROUP BY ven.occ`;

    const arranques = await sql<Array<{ occurrence_id: string; arranque_min: number | null }>>`
      WITH par AS (
        SELECT * FROM unnest(${parOcc}::uuid[], ${parImei}::text[]) AS p(occ, imei)
      ),
      ven AS (
        SELECT t.service_occurrence_id AS occ, t.evidence_window_start AS ini
          FROM trips t WHERE t.service_occurrence_id = ANY(${ids}::uuid[])
      ),
      pts AS (
        SELECT par.occ, par.imei, ven.ini, tp.recorded_at,
               (tp.speed > ${VELOCIDAD_DE_MOVIMIENTO}) AS mov
          FROM par
          JOIN ven ON ven.occ = par.occ
          JOIN telemetry_points tp
            ON tp.imei = par.imei
           AND tp.recorded_at >= ven.ini - MAKE_INTERVAL(hours => ${HORAS_ATRAS})
           AND tp.recorded_at <  ven.ini
      ),
      -- Islas de puntos del mismo tipo: la diferencia entre las dos numeraciones
      -- es constante mientras el estado de movimiento no cambie.
      islas AS (
        SELECT occ, imei, ini, recorded_at, mov,
               ROW_NUMBER() OVER (PARTITION BY occ, imei ORDER BY recorded_at)
             - ROW_NUMBER() OVER (PARTITION BY occ, imei, mov ORDER BY recorded_at) AS isla
          FROM pts
      ),
      paradas AS (
        SELECT occ, imei, MAX(recorded_at) AS fin
          FROM islas
         WHERE NOT mov
         GROUP BY occ, imei, isla
        HAVING EXTRACT(EPOCH FROM (MAX(recorded_at) - MIN(recorded_at))) / 60.0
               >= ${PARADA_QUE_CORTA_MIN}
      ),
      ultima_parada AS (
        SELECT occ, imei, MAX(fin) AS fin FROM paradas GROUP BY 1, 2
      )
      SELECT i.occ AS occurrence_id,
             MAX(EXTRACT(EPOCH FROM (i.ini - i.recorded_at)) / 60.0)
               FILTER (WHERE i.mov) AS arranque_min
        FROM islas i
        LEFT JOIN ultima_parada u ON u.occ = i.occ AND u.imei = i.imei
       WHERE u.fin IS NULL OR i.recorded_at > u.fin
       GROUP BY i.occ`;

    const arranquePorId = new Map(
      arranques.map((a) => [a.occurrence_id, a.arranque_min === null ? null : Number(a.arranque_min)]),
    );
    const medidos4 = puntosAntes.length;
    const conRastro = puntosAntes.filter((a) => a.puntos_antes > 0);
    const yaRodando = puntosAntes.filter((a) => a.rodando_antes && a.rodando_dentro);
    const minutos = yaRodando
      .map((a) => arranquePorId.get(a.occurrence_id) ?? null)
      .filter((m): m is number => m !== null);

    const contratoDe = new Map(poblacion.map((p) => [p.occurrence_id, p.contrato]));
    console.log(`  ── 4 · El arranque real, antes de que el árbitro abriera los ojos ──`);
    console.log(`  ${"población de §1".padEnd(50)}${num(poblacion.length).padStart(6)}`);
    console.log(`  ${"con mejor candidata identificable (lo medible)".padEnd(50)}${num(medidos4).padStart(6)}   ${pct(medidos4, poblacion.length)}`);
    console.log(
      `  ${"1 · con puntos propios antes de su ventana".padEnd(50)}${num(conRastro.length).padStart(6)}   ${pct(conRastro.length, medidos4)}`,
    );
    console.log(
      `  ${"2 · YA VENÍA RODANDO cuando la ventana abrió".padEnd(50)}${num(yaRodando.length).padStart(6)}   ${pct(yaRodando.length, medidos4)}`,
    );
    for (const c of contratos) {
      const medibles = puntosAntes.filter((a) => contratoDe.get(a.occurrence_id) === c);
      if (medibles.length === 0) continue;
      const rastro = medibles.filter((a) => a.puntos_antes > 0).length;
      const rodando = medibles.filter((a) => a.rodando_antes && a.rodando_dentro).length;
      console.log(
        `    ${c.slice(0, 30).padEnd(32)}medibles ${num(medibles.length).padStart(4)} · con puntos ${num(rastro).padStart(4)} · rodando ${num(rodando).padStart(4)}`,
      );
    }
    if (minutos.length > 0) {
      console.log(
        `\n  3 · cuántos minutos antes arrancó:  p50 ${num(percentil(minutos, 50))} · p90 ${num(percentil(minutos, 90))} · máx ${num(Math.max(...minutos))}`,
      );
      const topan = minutos.filter((m) => m >= HORAS_ATRAS * 60 - 1).length;
      if (topan > 0) {
        console.log(
          `      ⚠ ${num(topan)} topan con el borde de la búsqueda (${HORAS_ATRAS} h): ahí la cifra es un piso.`,
        );
      }
    }
    console.log(
      `\n  «ya venía rodando» = movimiento (> ${VELOCIDAD_DE_MOVIMIENTO} km/h) en los ${VENTANA_DE_CONTINUIDAD_MIN} min anteriores al inicio\n` +
        `  de la ventana Y en los ${VENTANA_DE_CONTINUIDAD_MIN} posteriores: el camión cruzó ese borde andando.\n` +
        `  «arrancó» = el primer punto en movimiento después de su última parada de ${PARADA_QUE_CORTA_MIN} min\n` +
        `  o más. Sin ese corte se estaría midiendo cuándo se prendió el aparato.\n`,
    );
    console.log(
      `  ⚠ Este dato es EVIDENCIA FUERA DE LA VENTANA CONGELADA. Sirve para avisar y\n` +
        `  para explicar; no entra a ningún veredicto. La ventana es la frontera de lo\n` +
        `  que se juzgó, y un árbitro que decide con datos de fuera la vuelve un adorno.\n`,
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
