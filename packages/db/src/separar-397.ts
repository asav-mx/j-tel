/**
 * Los 397: separar la acusación bien puesta del fallo de observación.
 *
 * SOLO LECTURA. No propone arreglo, no toca un veredicto, no re-verifica nada.
 *
 * ---
 *
 * **Qué son los 397.** Servicios sellados `no_cumplido` de los dos contratos
 * reales en los que el ledger guarda **al menos una candidata con llegada
 * registrada**. Es decir: el sistema SÍ vio llegar una unidad y aun así acusó.
 * La cifra se midió el 12 de agosto de 2026 (133 de Planta 47 + 264 del Campus)
 * y aquí se vuelve a levantar de cero, no se hereda.
 *
 * **Por qué separar.** El Marco dice dos cosas que esta población pone en
 * tensión: *sin evidencia no es incumplimiento* y *un servicio cumplido siempre
 * tiene unidad observada detrás*. Un `no_cumplido` con llegada registrada es
 * una de dos cosas muy distintas — el transportista falló, o el árbitro no
 * pudo ver— y hoy **se cuentan juntas**.
 *
 * **Los grupos, disjuntos y en este orden de prioridad.** El orden importa:
 * cada servicio cae en el PRIMERO que lo describe, para que la suma reconstruya
 * la población sin contar a nadie dos veces.
 *
 *   1. ACREDITADA — alguna candidata pasó A∧B (`sirvio_ruta`). La acusación
 *      tiene unidad acreditada detrás. Aquí vive «llegó tarde de verdad».
 *   2. VENTANA CORTA — ninguna acreditó, y la duración medida de su ruta×turno
 *      excede los minutos que su ventana abrió antes del deadline. El árbitro
 *      abrió los ojos con el camión ya andando.
 *   3. ATRIBUCIÓN — ninguna acreditó, y la ventana NO era corta por ese
 *      criterio. Llegó, y el emparejamiento con la ruta no cerró.
 *   4. OTRA COSA — todo lo que no encaja, desglosado. Nunca «resto».
 *
 * ⚠ **Lo que NINGUNA cifra de aquí dice.** Que un veredicto cambiaría. Para
 * saber eso hay que correr el árbitro otra vez sobre otra evidencia y sellar de
 * nuevo: eso es simulación (D4 / Tramo 6). Lo que se separa aquí es **qué
 * sostiene cada acusación**, que sí se puede contestar leyendo.
 *
 *   pnpm --filter @jtel/db separar-397
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
  service_date: string;
  deadline: Date;
  window_start: Date;
  window_end: Date;
  route_shift_id: string;
  fact_status: string;
  fact_timing: string | null;
  observed_arrival_at: Date | null;
  observed_unit_id: string | null;
  route_strictness_applied: string;
  policy_sellada: ContractPolicy;
};

type PasoLedger = {
  step: string;
  result?: string;
  details?: Record<string, unknown>;
};

type Candidata = {
  quien: string | null;
  acredito: boolean;
  llegada: Date | null;
  a: number | null;
  aLlana: number | null;
  b: number | null;
  minA: number | null;
  minB: number | null;
  fraccionObservable: number | null;
  tieneKml: boolean;
};

type Expediente = {
  decision: string | null;
  motivo: string | null;
  candidatas: Candidata[];
};

function nOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function leerExpediente(steps: PasoLedger[]): Expediente {
  const candidatas: Candidata[] = [];
  let decision: string | null = null;
  let motivo: string | null = null;

  for (const s of steps) {
    if (s.step === "candidata") {
      const d = (s.details ?? {}) as Record<string, unknown>;
      /*
       * C15 · El campo cambió de nombre el 8 de agosto y las dos épocas conviven
       * en esta población. Antes: `imei:` con un id de UNIDAD adentro. Después:
       * `unidadId` aparte y `imeis` en plural. Se leen los dos y NO se declara
       * cuál identidad es — aquí solo se cuenta, no se nombra a nadie.
       */
      const quien = (d.unidadId ?? d.imei ?? null) as string | null;
      const llegadaRaw = d.arrivalAt;
      candidatas.push({
        quien,
        acredito: s.result === "sirvio_ruta",
        llegada: typeof llegadaRaw === "string" ? new Date(llegadaRaw) : null,
        a: nOrNull(d.routeMatchPct),
        aLlana: nOrNull(d.routeMatchPlainPct),
        b: nOrNull(d.corridorPrecisionPct),
        minA: nOrNull(d.minKmlPct),
        minB: nOrNull(d.minCorridorPct),
        fraccionObservable: nOrNull(d.observableFraction),
        tieneKml: d.hasKml !== false,
      });
    } else if (s.step === "decision") {
      decision = s.result ?? null;
      motivo = ((s.details ?? {}) as Record<string, unknown>).reason as string | null;
    }
  }
  return { decision, motivo, candidatas };
}

/** La candidata que MÁS CERCA estuvo de acreditar: la de mayor min(A,B). */
function masCercana(cands: Candidata[]): Candidata | null {
  let mejor: Candidata | null = null;
  let mejorPuntaje = -Infinity;
  for (const c of cands) {
    const puntaje = Math.min(c.a ?? -Infinity, c.b ?? -Infinity);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = c;
    }
  }
  return mejor;
}

type Grupo = "acreditada" | "ventana_corta" | "atribucion" | "otra_cosa";

type Clasificado = FilaHecho & {
  exp: Expediente;
  conLlegada: Candidata[];
  antesCongelado: number;
  p50Ruta: number | null;
  maxRuta: number | null;
  muestrasRuta: number;
  grupo: Grupo;
  subgrupo: string;
};

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  Los 397 — qué sostiene cada acusación`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    const hechos = await sql<FilaHecho[]>`
      SELECT o.id                     AS occurrence_id,
             sc.name                  AS contrato,
             o.service_date::text     AS service_date,
             o.expected_deadline      AS deadline,
             t.evidence_window_start  AS window_start,
             t.evidence_window_end    AS window_end,
             o.route_shift_id,
             cf.status::text          AS fact_status,
             cf.timing::text          AS fact_timing,
             cf.observed_arrival_at,
             cf.observed_unit_id::text AS observed_unit_id,
             cf.route_strictness_applied::text AS route_strictness_applied,
             cf.contract_policy_snapshot AS policy_sellada
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN trips t              ON t.service_occurrence_id = o.id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cf.status = 'no_cumplido'
         AND cli.is_demo = false AND car.is_demo = false
       ORDER BY sc.name, o.service_date`;

    /*
     * El ÚLTIMO asiento con decisión de cada servicio, no todo el ledger. Un
     * servicio re-verificado tiene varias corridas guardadas, y contar sobre
     * todas mezcla el veredicto vigente con los que ya fueron reemplazados.
     */
    const asientos = await sql<Array<{ occurrence_id: string; steps: PasoLedger[] }>>`
      SELECT DISTINCT ON (le.service_occurrence_id)
             le.service_occurrence_id AS occurrence_id, le.steps
        FROM ledger_entries le
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
       ORDER BY le.service_occurrence_id, le.created_at DESC`;
    const expPorId = new Map<string, Expediente>();
    for (const a of asientos) expPorId.set(a.occurrence_id, leerExpediente(a.steps));

    /*
     * La historia de duración de cada ruta×turno, TAL COMO ESTÁ HOY.
     *
     * ⚠ `lower_bound` no es un detalle: una duración se mide del primer punto en
     * corredor hasta la llegada, y los dos extremos viven DENTRO de la ventana.
     * Una ruta que arrancó antes de que la ventana abriera no se puede medir
     * entera — la medición topa con el borde y sale recortada. Entonces
     * `duration_minutes` es, en esas filas, un PISO: la ruta duró al menos eso.
     */
    const medRaw = await sql<
      Array<{ route_shift_id: string; duration_minutes: number; lower_bound: boolean }>
    >`SELECT route_shift_id, duration_minutes, lower_bound FROM route_traversal_measurements`;
    const duracionesPorRutaTurno = new Map<string, number[]>();
    const recortadasPorRutaTurno = new Map<string, number>();
    for (const m of medRaw) {
      const arr = duracionesPorRutaTurno.get(m.route_shift_id) ?? [];
      arr.push(Number(m.duration_minutes));
      duracionesPorRutaTurno.set(m.route_shift_id, arr);
      if (m.lower_bound) {
        recortadasPorRutaTurno.set(
          m.route_shift_id,
          (recortadasPorRutaTurno.get(m.route_shift_id) ?? 0) + 1,
        );
      }
    }
    console.log(
      `  mediciones de duración: ${num(medRaw.length)} filas · ${num(medRaw.filter((m) => m.lower_bound).length)} recortadas por el borde de la ventana (${pct(medRaw.filter((m) => m.lower_bound).length, medRaw.length)})\n`,
    );

    // ── 0 · La población: los no cumplidos con una llegada registrada ────────
    const conExpediente = hechos.filter((h) => expPorId.has(h.occurrence_id));
    const sinExpediente = hechos.filter((h) => !expPorId.has(h.occurrence_id));

    const poblacion: Clasificado[] = [];
    const sinLlegada: FilaHecho[] = [];

    for (const h of conExpediente) {
      const exp = expPorId.get(h.occurrence_id)!;
      const conLlegada = exp.candidatas.filter((c) => c.llegada !== null);
      if (conLlegada.length === 0) {
        sinLlegada.push(h);
        continue;
      }
      const dur = duracionesPorRutaTurno.get(h.route_shift_id) ?? [];
      const antesCongelado = Math.round(
        (new Date(h.deadline).getTime() - new Date(h.window_start).getTime()) / 60_000,
      );
      poblacion.push({
        ...h,
        exp,
        conLlegada,
        antesCongelado,
        p50Ruta: percentil(dur, 50),
        maxRuta: dur.length > 0 ? Math.max(...dur) : null,
        muestrasRuta: dur.length,
        grupo: "otra_cosa",
        subgrupo: "",
      });
    }

    console.log(`  ── 0 · De dónde sale la población ──────────────────────────────────`);
    console.log(`  ${"no cumplidos sellados (contratos reales)".padEnd(50)}${num(hechos.length).padStart(6)}`);
    console.log(`  ${"  sin ningún asiento con decisión en el ledger".padEnd(50)}${num(sinExpediente.length).padStart(6)}`);
    console.log(`  ${"  con asiento, sin ninguna candidata con llegada".padEnd(50)}${num(sinLlegada.length).padStart(6)}`);
    console.log(`  ${"  CON al menos una candidata con llegada".padEnd(50)}${num(poblacion.length).padStart(6)}   ← la población\n`);

    // ── 1 · La separación ────────────────────────────────────────────────────
    for (const p of poblacion) {
      const acreditadas = p.exp.candidatas.filter((c) => c.acredito);

      if (acreditadas.length > 0) {
        p.grupo = "acreditada";
        // ¿Y la hora dio o no? La respuesta la da el hecho, no un recálculo.
        p.subgrupo = p.fact_timing ?? "sin timing";
        continue;
      }

      // Sin candidata acreditada. ¿Qué dice el asiento que decidió?
      if (p.exp.decision !== "no_cumplido") {
        p.grupo = "otra_cosa";
        p.subgrupo = `el hecho dice no_cumplido y su ledger dice ${p.exp.decision ?? "—"}`;
        continue;
      }
      if (p.conLlegada.some((c) => !c.tieneKml)) {
        p.grupo = "otra_cosa";
        p.subgrupo = "sin KML: A∧B no aplicó";
        continue;
      }
      if (p.maxRuta === null) {
        p.grupo = "otra_cosa";
        p.subgrupo = "sin una sola medición de duración de su ruta×turno";
        continue;
      }

      if (p.maxRuta > p.antesCongelado) {
        p.grupo = "ventana_corta";
        p.subgrupo =
          p.p50Ruta !== null && p.p50Ruta > p.antesCongelado
            ? "la MEDIANA ya la excede"
            : "solo la MÁXIMA la excede";
        continue;
      }

      p.grupo = "atribucion";
      p.subgrupo = "";
    }

    /**
     * Qué compuerta rechazó a la candidata que más cerca estuvo. Se calcula
     * para TODOS los grupos, no solo para el de atribución: saber que la
     * ventana era corta no dice cuál compuerta la tumbó, y son preguntas
     * distintas.
     */
    function compuerta(p: Clasificado): string {
      const c = masCercana(p.conLlegada);
      if (!c) return "sin candidata legible";
      const minObs = 1 - (p.policy_sellada?.kmlOriginToleranceFraction ?? 0.15);
      const fallaObs = c.fraccionObservable !== null && c.fraccionObservable + 1e-9 < minObs;
      const fallaA = c.a !== null && c.minA !== null && c.a < c.minA;
      const fallaB = c.b !== null && c.minB !== null && c.b < c.minB;
      if (fallaObs) return "tramo observable insuficiente";
      if (fallaA && fallaB) return "fallan A y B";
      if (fallaA) return "falla A (cobertura de trazado)";
      if (fallaB) return "falla B (precisión de corredor)";
      return "ninguna compuerta explica el rechazo";
    }
    for (const p of poblacion) {
      if (p.grupo === "atribucion") p.subgrupo = compuerta(p);
    }

    const contratos = [...new Set(poblacion.map((p) => p.contrato))].sort();
    const grupos: Array<{ clave: Grupo; titulo: string }> = [
      { clave: "acreditada", titulo: "1 · ACREDITADA — alguna candidata pasó A∧B" },
      { clave: "ventana_corta", titulo: "2 · VENTANA CORTA — la ruta dura más de lo que la ventana miró" },
      { clave: "atribucion", titulo: "3 · ATRIBUCIÓN — llegó, y el emparejamiento no cerró" },
      { clave: "otra_cosa", titulo: "4 · OTRA COSA" },
    ];

    console.log(`  ── 1 · Los cuatro grupos, disjuntos ────────────────────────────────`);
    console.log(
      `  ${"grupo".padEnd(46)}${"total".padStart(8)}${contratos.map((c) => c.slice(0, 14).padStart(16)).join("")}`,
    );
    for (const g of grupos) {
      const del = poblacion.filter((p) => p.grupo === g.clave);
      console.log(
        `  ${g.titulo.padEnd(46)}${num(del.length).padStart(8)}` +
          contratos
            .map((c) => num(del.filter((p) => p.contrato === c).length).padStart(16))
            .join(""),
      );
    }
    console.log(
      `  ${"TOTAL".padEnd(46)}${num(poblacion.length).padStart(8)}` +
        contratos
          .map((c) => num(poblacion.filter((p) => p.contrato === c).length).padStart(16))
          .join(""),
    );

    console.log(`\n  ── 2 · Adentro de cada grupo ───────────────────────────────────────`);
    for (const g of grupos) {
      const del = poblacion.filter((p) => p.grupo === g.clave);
      if (del.length === 0) continue;
      console.log(`\n  ${g.titulo}  (${num(del.length)})`);
      const sub = new Map<string, number>();
      for (const p of del) sub.set(p.subgrupo, (sub.get(p.subgrupo) ?? 0) + 1);
      for (const [s, n] of [...sub.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${s.padEnd(48)}${num(n).padStart(6)}   ${pct(n, del.length)}`);
      }
      const fechas = del.map((p) => p.service_date).sort();
      console.log(`    fechas: ${fechas[0]} → ${fechas[fechas.length - 1]}`);
    }

    // ── 3 · Qué tan cerca estuvo de acreditar la que llegó ───────────────────
    console.log(`\n  ── 3 · Qué tan lejos quedó de acreditar la candidata que llegó ─────`);
    console.log(
      `  Se toma la candidata con llegada de mayor min(A,B) — la que MÁS CERCA estuvo.\n` +
        `  «A» es la ponderada, que es la que decide; se muestra también la llana (C17).`,
    );
    for (const g of grupos) {
      const del = poblacion.filter((p) => p.grupo === g.clave);
      if (del.length === 0) continue;
      const cs = del.map((p) => masCercana(p.conLlegada)).filter((c): c is Candidata => c !== null);
      const as = cs.map((c) => c.a).filter((v): v is number => v !== null);
      const llanas = cs.map((c) => c.aLlana).filter((v): v is number => v !== null);
      const bs = cs.map((c) => c.b).filter((v): v is number => v !== null);
      if (as.length === 0 && bs.length === 0) continue;
      /*
       * El «n» va pegado a cada percentil y no en una nota al pie: A llana solo
       * existe en los asientos nuevos (C17), así que su p50 describe una
       * población distinta a la de A ponderada. Un p50 sin su n al lado es el
       * caso 4 de §D del Marco — el dato correcto con el alcance borrado.
       */
      console.log(
        `\n    ${g.titulo.slice(0, 46)}   (grupo: ${num(del.length)})\n` +
          `      A ponderada   n ${num(as.length).padStart(3)} · p50 ${num(percentil(as, 50), 1)} · p90 ${num(percentil(as, 90), 1)} · máx ${num(as.length ? Math.max(...as) : null, 1)}\n` +
          `      A llana       n ${num(llanas.length).padStart(3)} · p50 ${num(percentil(llanas, 50), 1)} · p90 ${num(percentil(llanas, 90), 1)} · máx ${num(llanas.length ? Math.max(...llanas) : null, 1)}\n` +
          `      B corredor    n ${num(bs.length).padStart(3)} · p50 ${num(percentil(bs, 50), 1)} · p90 ${num(percentil(bs, 90), 1)} · máx ${num(bs.length ? Math.max(...bs) : null, 1)}`,
      );
      const umbA = [...new Set(cs.map((c) => c.minA).filter((v) => v !== null))];
      const umbB = [...new Set(cs.map((c) => c.minB).filter((v) => v !== null))];
      console.log(`      umbrales aplicados: A ≥ ${umbA.join("/")} · B ≥ ${umbB.join("/")}`);
    }

    // ── 4 · La perilla que decide si esto es acusación o pendiente ───────────
    /*
     * C13 en la población entera: el MISMO fallo —llegó y no se pudo atribuir—
     * sale `pendiente_evidencia` con `destino_only` y `no_cumplido` con
     * `kml_full`. Si la población es 100 % `kml_full`, la acusación no la
     * produjo la conducta: la produjo la perilla.
     */
    console.log(`\n  ── 4 · Con qué estrictez se les juzgó ──────────────────────────────`);
    const porEstrictez = new Map<string, number>();
    for (const p of poblacion) {
      porEstrictez.set(
        p.route_strictness_applied,
        (porEstrictez.get(p.route_strictness_applied) ?? 0) + 1,
      );
    }
    for (const [k, n] of [...porEstrictez.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(48)}${num(n).padStart(6)}   ${pct(n, poblacion.length)}`);
    }
    const conArrivalSellado = poblacion.filter((p) => p.observed_arrival_at !== null);
    console.log(
      `    ${"con observed_arrival_at sellado en el hecho".padEnd(48)}${num(conArrivalSellado.length).padStart(6)}   ${pct(conArrivalSellado.length, poblacion.length)}`,
    );

    // ── 4b · La compuerta que rechazó, en cada grupo ─────────────────────────
    console.log(`\n  ── 4b · Qué compuerta tumbó a la candidata que llegó, por grupo ────`);
    for (const g of grupos) {
      const del = poblacion.filter((p) => p.grupo === g.clave);
      if (del.length === 0) continue;
      const sub = new Map<string, number>();
      for (const p of del) {
        const k = compuerta(p);
        sub.set(k, (sub.get(k) ?? 0) + 1);
      }
      console.log(`\n    ${g.titulo.slice(0, 50)}  (${num(del.length)})`);
      for (const [s, n] of [...sub.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`      ${s.padEnd(46)}${num(n).padStart(6)}   ${pct(n, del.length)}`);
      }
      const fracs = del
        .map((p) => masCercana(p.conLlegada)?.fraccionObservable ?? null)
        .filter((v): v is number => v !== null);
      if (fracs.length > 0) {
        console.log(
          `      fracción observable de esa candidata: n ${num(fracs.length)} de ${num(del.length)} · p10 ${num(percentil(fracs, 10), 2)} · p50 ${num(percentil(fracs, 50), 2)} · p90 ${num(percentil(fracs, 90), 2)}`,
        );
        const bajo = fracs.filter((f) => f < 0.85).length;
        console.log(
          `      de esos ${num(fracs.length)}, por debajo del piso de 0.85:            ${num(bajo).padStart(4)}   ${pct(bajo, fracs.length)}`,
        );
      }
    }

    // ── 4c · El motivo que el propio ledger escribió ─────────────────────────
    console.log(`\n  ── 4c · El motivo que el ledger escribió al decidir ────────────────`);
    const porMotivo = new Map<string, number>();
    for (const p of poblacion) porMotivo.set(p.exp.motivo ?? "—", (porMotivo.get(p.exp.motivo ?? "—") ?? 0) + 1);
    for (const [k, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(48)}${num(n).padStart(6)}   ${pct(n, poblacion.length)}`);
    }
    /*
     * La contradicción que hay que poder ver: el motor tiene una compuerta de
     * Ley 1 —«la ventana no alcanzó a cubrir el origen» → pendiente— y ninguno
     * de estos 397 salió por ahí. Se pregunta cuántos la habrían disparado si
     * la pregunta se hiciera sobre la candidata en vez de sobre la evidencia
     * entera del viaje.
     */
    const obsInsuf = poblacion.filter((p) => compuerta(p) === "tramo observable insuficiente");
    console.log(
      `\n    ⚠ ${num(obsInsuf.length)} tienen a su mejor candidata por debajo del piso de tramo\n` +
        `    observable, y NINGUNO salió por «observacion_insuficiente». La compuerta\n` +
        `    que los habría mandado a pendiente pregunta por la evidencia del VIAJE\n` +
        `    entero; la que los tumbó pregunta por la CANDIDATA. Distinto grano.`,
    );

    // ── 4d · Cuánto le faltó a la ventana ────────────────────────────────────
    const faltantes = poblacion
      .filter((p) => p.grupo === "ventana_corta" && p.maxRuta !== null)
      .map((p) => p.maxRuta! - p.antesCongelado);
    if (faltantes.length > 0) {
      console.log(`\n  ── 4d · Cuántos minutos de ruta quedaron fuera de la ventana ───────`);
      console.log(
        `    (duración medida de la ruta − minutos que la ventana abrió antes)\n` +
          `    con la MÁXIMA:  p50 ${num(percentil(faltantes, 50))} · p90 ${num(percentil(faltantes, 90))} · máx ${num(Math.max(...faltantes))}`,
      );
    }

    /*
     * Y el techo del instrumento, que es lo que hace que ese déficit sea chico:
     * si las mediciones de esa ruta vienen recortadas por el borde, «la ruta
     * dura más que la ventana» solo se puede afirmar hacia arriba. El
     * instrumento NO puede decir «la ventana alcanzaba» — no ve fuera de ella.
     */
    const cortos = poblacion.filter((p) => p.grupo === "ventana_corta");
    const conRecorte = cortos.filter((p) => (recortadasPorRutaTurno.get(p.route_shift_id) ?? 0) > 0);
    const atrib = poblacion.filter((p) => p.grupo === "atribucion");
    const atribConRecorte = atrib.filter(
      (p) => (recortadasPorRutaTurno.get(p.route_shift_id) ?? 0) > 0,
    );
    console.log(
      `    ⚠ el déficit sale chico porque el instrumento está capado: la duración se\n` +
        `    mide DENTRO de la ventana, así que no puede exceder mucho su ancho.\n` +
        `      del grupo VENTANA CORTA, con mediciones recortadas   ${num(conRecorte.length).padStart(5)} de ${num(cortos.length)}\n` +
        `      del grupo ATRIBUCIÓN, con mediciones recortadas      ${num(atribConRecorte.length).padStart(5)} de ${num(atrib.length)}\n` +
        `    Donde hay recorte, «la ventana no era corta» NO está establecido: está\n` +
        `    sin medir. La frontera entre los grupos 2 y 3 es blanda en ese sentido.`,
    );

    // ── 4f · Los umbrales con los que se selló cada uno ──────────────────────
    console.log(`\n  ── 4f · Con qué umbrales sellados se les juzgó ─────────────────────`);
    const perillas: Array<[string, (p: ContractPolicy) => unknown]> = [
      ["kmlMatchMinPct (A)", (p) => p.kmlMatchMinPct],
      ["kmlCorridorMinPct (B)", (p) => p.kmlCorridorMinPct],
      ["kmlOriginToleranceFraction", (p) => p.kmlOriginToleranceFraction],
      ["evidenceMarginMinutesBefore (piso)", (p) => p.evidenceMarginMinutesBefore],
      ["windowDerivationEnabled", (p) => p.windowDerivationEnabled],
    ];
    for (const [nombre, leer] of perillas) {
      const cuenta = new Map<string, number>();
      for (const p of poblacion) {
        const v = String(leer(p.policy_sellada) ?? "—");
        cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
      }
      const detalle = [...cuenta.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([v, n]) => `${v} → ${num(n)}`)
        .join(" · ");
      console.log(`    ${nombre.padEnd(38)}${detalle}`);
    }
    const bajoPiso = poblacion.filter((p) => {
      const c = masCercana(p.conLlegada);
      const minObs = 1 - (p.policy_sellada?.kmlOriginToleranceFraction ?? 0.15);
      return c?.fraccionObservable !== null && c !== null && c.fraccionObservable! < minObs;
    });
    const bajoPisoFabrica = poblacion.filter((p) => {
      const c = masCercana(p.conLlegada);
      return c?.fraccionObservable != null && c.fraccionObservable < 0.85;
    });
    console.log(
      `\n    candidata por debajo del piso QUE SE LE APLICÓ            ${num(bajoPiso.length).padStart(5)}\n` +
        `    candidata por debajo del piso DE FÁBRICA (0.85)          ${num(bajoPisoFabrica.length).padStart(5)}\n` +
        `    La diferencia es la tolerancia de origen aflojada: sin ella, ese tanto\n` +
        `    habría caído por «no se le vio suficiente ruta» en vez de por A∧B.`,
    );

    // ── 4g · De qué época es cada expediente ─────────────────────────────────
    /*
     * Regla de lectura de C15 / C17, aplicada aquí: los campos con los que se
     * diagnostica arriba NO existen en todos los asientos. Un asiento sellado
     * antes de que el motor calculara el tramo observable no trae
     * `observableFraction`, y su ausencia significa «no se preguntó», no «salió
     * bien». Sin esta tabla, los porcentajes de §4b se leerían como si todos
     * hubieran contestado la misma pregunta.
     */
    console.log(`\n  ── 4g · Qué campos trae el expediente de cada uno ──────────────────`);
    const campos: Array<[string, (c: Candidata) => boolean]> = [
      ["observableFraction (tramo observable)", (c) => c.fraccionObservable !== null],
      ["routeMatchPlainPct (A llana, C17)", (c) => c.aLlana !== null],
      ["routeMatchPct (A ponderada)", (c) => c.a !== null],
      ["corridorPrecisionPct (B)", (c) => c.b !== null],
    ];
    for (const [nombre, tiene] of campos) {
      const n = poblacion.filter((p) => {
        const c = masCercana(p.conLlegada);
        return c !== null && tiene(c);
      }).length;
      console.log(`    ${nombre.padEnd(42)}${num(n).padStart(6)} de ${num(poblacion.length)}   ${pct(n, poblacion.length)}`);
    }
    const sinFraccion = poblacion.filter((p) => {
      const c = masCercana(p.conLlegada);
      return c === null || c.fraccionObservable === null;
    });
    const porGrupoSinFraccion = new Map<string, number>();
    for (const p of sinFraccion) porGrupoSinFraccion.set(p.grupo, (porGrupoSinFraccion.get(p.grupo) ?? 0) + 1);
    console.log(
      `\n    ⚠ ${num(sinFraccion.length)} expedientes NO dicen qué fracción de la ruta era observable\n` +
        `    (${[...porGrupoSinFraccion.entries()].map(([g, n]) => `${g} ${n}`).join(" · ")}).\n` +
        `    En ésos, «no falló el tramo observable» es AUSENCIA DE PREGUNTA, no un\n` +
        `    aprobado: el motor de esa época no la calculaba. Los subgrupos de §4b\n` +
        `    de esos servicios dicen qué compuerta se registró, no cuál habría fallado.`,
    );

    // ── 4e · Dónde vive «llegó tarde de verdad» ──────────────────────────────
    /*
     * No está aquí, y eso es del motor: si alguna candidata acredita, el
     * veredicto es `cumplido` y «tarde» vive en `timing`. Se cuenta aparte para
     * que la ausencia sea un hecho medido y no una deducción del código.
     */
    const tardes = await sql<Array<{ contrato: string; n: number; status: string; timing: string }>>`
      SELECT sc.name AS contrato, cf.status::text AS status,
             COALESCE(cf.timing::text, '—') AS timing, COUNT(*)::int AS n
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false
         AND cf.timing = 'tarde'
       GROUP BY 1, 2, 3 ORDER BY 1, 2`;
    console.log(`\n  ── 4e · Dónde vive «llegó tarde de verdad» ─────────────────────────`);
    if (tardes.length === 0) {
      console.log(`    Ni un solo hecho sellado con timing = 'tarde' en los contratos reales.`);
    } else {
      for (const t of tardes) {
        console.log(`    ${t.contrato.slice(0, 30).padEnd(32)}${t.status.padEnd(18)}${t.timing.padEnd(10)}${num(t.n).padStart(6)}`);
      }
    }
    console.log(
      `    Un servicio con unidad acreditada sale «cumplido» y su retraso vive en\n` +
        `    «timing», no en el veredicto. Por eso «llegó tarde» no puede estar dentro\n` +
        `    de una población de no cumplidos: son poblaciones ajenas.`,
    );

    // ── 5 · El número que se le puede decir a Juárez Bus ─────────────────────
    const acreditada = poblacion.filter((p) => p.grupo === "acreditada");
    const ventana = poblacion.filter((p) => p.grupo === "ventana_corta");
    const atribucion = poblacion.filter((p) => p.grupo === "atribucion");
    const otra = poblacion.filter((p) => p.grupo === "otra_cosa");
    const porObservacion = ventana.length + atribucion.length;

    console.log(`\n  ── 5 · El número ──────────────────────────────────────────────────`);
    console.log(`  ${"población (acusados con una llegada registrada)".padEnd(50)}${num(poblacion.length).padStart(6)}`);
    console.log(`  ${"  con unidad ACREDITADA detrás".padEnd(50)}${num(acreditada.length).padStart(6)}`);
    console.log(`  ${"  sin unidad acreditada — fallo de OBSERVACIÓN".padEnd(50)}${num(porObservacion).padStart(6)}   ${pct(porObservacion, poblacion.length)}`);
    console.log(`  ${"      · la ventana no alcanzó a mirar la ruta".padEnd(50)}${num(ventana.length).padStart(6)}`);
    console.log(`  ${"      · llegó y no se pudo atribuir".padEnd(50)}${num(atribucion.length).padStart(6)}`);
    console.log(`  ${"  no clasificables por lectura".padEnd(50)}${num(otra.length).padStart(6)}`);
    console.log(
      `\n  ⚠ «falso por fallo de observación» significa que la acusación NO se sostiene\n` +
        `  sobre lo que el sistema pudo ver — NO que el transportista haya cumplido.\n` +
        `  Lo que el Marco pide para éstos es «pendiente», no «cumplido».\n`,
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
