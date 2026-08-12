/**
 * El reparto: de las cuatro causas, cuál SOLA quita más de las 397.
 *
 * SOLO LECTURA. No re-verifica, no sella, no propone arreglo.
 *
 * ---
 *
 * **La pregunta y su trampa.** «Cuál quita más» supone que las cuatro se
 * pueden contestar con el mismo tipo de número, y NO se puede. Dos de ellas se
 * contestan leyendo, sobre la misma evidencia y la misma ventana; las otras dos
 * solo tienen techo o curva, porque su arreglo cambia lo que el árbitro
 * MIRARÍA, y saber el resultado de eso exige volver a correrlo — simulación,
 * D4 / Tramo 6. Este instrumento devuelve las cuatro con su tipo declarado, y
 * esa asimetría es parte de la respuesta, no un defecto de la medición.
 *
 *   1. GRANO — la Ley 1 evadida por grano. Cuenta EXACTA: la compuerta de
 *      observación insuficiente mandaría a `pendiente_evidencia` a todo
 *      servicio cuya CANDIDATA no alcance el piso de tramo observable. Hoy esa
 *      pregunta se hace sobre la evidencia del viaje entero — la flota.
 *      Misma ventana, misma evidencia, mismo umbral: solo cambia a quién se le
 *      pregunta. Por eso se puede contar leyendo.
 *   2. MODO — `routeStrictness` inerte (C14). Cuenta EXACTA, y sale de la
 *      distribución: la estrictez aplicada está sellada dentro de cada hecho.
 *   3. VENTANA — la ventana congelada (C21 en su tercera forma). Solo TECHO:
 *      una ventana distinta es otra evidencia y otro emparejamiento.
 *   4. DENSIDAD — C19. Solo CURVA: el piso no está decidido, así que el número
 *      es una función del umbral y darlo como cifra única sería elegirlo aquí.
 *
 * **Cómo se recalcula el tramo observable sin volverse una segunda
 * implementación.** Se importan `observableRouteSpan` del motor y
 * `getActiveVariantVersionsForDate` del repositorio: son LAS MISMAS que usó el
 * árbitro. Lo único que hace este archivo es dárselas de comer con la evidencia
 * que ya está guardada. Si mañana cambia el match, esto cambia con él.
 *
 * **Por qué hay que recalcularlo.** Solo 121 de los 397 expedientes traen
 * `observableFraction`: los sellados antes de que el motor calculara el tramo
 * no lo escribieron, y su ausencia significa «no se preguntó», no «salió bien».
 * Contar solo sobre los 121 daría un reparto que describe una época, no la
 * población.
 *
 *   pnpm --filter @jtel/db reparto-397
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { observableRouteSpan, DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION } from "@jtel/verification";
import type { ContractPolicy, GpsPoint } from "@jtel/domain";
import { createDb } from "./index.js";
import { createRepositories } from "./repositories/index.js";

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

type PasoLedger = { step: string; result?: string; details?: Record<string, unknown> };

type Fila = {
  occurrence_id: string;
  trip_id: string;
  contrato: string;
  service_date: string;
  deadline: Date;
  window_start: Date;
  route_id: string | null;
  route_strictness_applied: string;
  policy_sellada: ContractPolicy;
  steps: PasoLedger[];
};

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });
  const db = createDb(url);
  const repos = createRepositories(db);

  try {
    console.log(`\n  El reparto de las 397 — cuál causa sola quita más`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    /*
     * La población, levantada con el MISMO criterio que `separar-397`: hechos
     * `no_cumplido` de contratos reales cuyo último asiento con decisión trae
     * al menos una candidata con llegada.
     */
    const filas = await sql<Fila[]>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT o.id                     AS occurrence_id,
             t.id                     AS trip_id,
             sc.name                  AS contrato,
             o.service_date::text     AS service_date,
             o.expected_deadline      AS deadline,
             t.evidence_window_start  AS window_start,
             rs.route_id::text        AS route_id,
             cf.route_strictness_applied::text AS route_strictness_applied,
             cf.contract_policy_snapshot AS policy_sellada,
             ult.steps
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN trips t              ON t.service_occurrence_id = o.id
        JOIN route_shifts rs      ON rs.id = o.route_shift_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
        JOIN ult ON ult.occ = o.id
       WHERE cf.status = 'no_cumplido'
         AND cli.is_demo = false AND car.is_demo = false
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(ult.steps) s
            WHERE s->>'step' = 'candidata' AND s->'details' ? 'arrivalAt')
       ORDER BY sc.name, o.service_date`;

    console.log(`  población: ${num(filas.length)} acusados con una llegada registrada\n`);

    // ── 1 · MODO — la estrictez con la que se selló cada hecho ───────────────
    /*
     * Se contesta sin recalcular nada: `route_strictness_applied` está sellado
     * dentro del hecho. La compuerta de C14 —llegó y no se pudo atribuir →
     * pendiente— solo existe bajo `destino_only`. Cuántos de los 397 la
     * cruzarían es cuántos se sellaron con esa estrictez.
     */
    const porEstrictez = new Map<string, number>();
    for (const f of filas) {
      porEstrictez.set(f.route_strictness_applied, (porEstrictez.get(f.route_strictness_applied) ?? 0) + 1);
    }
    const conDestinoOnly = porEstrictez.get("destino_only") ?? 0;

    // ── 2 · GRANO — el tramo observable de la CANDIDATA, recalculado ─────────
    const evid = await sql<Array<{
      trip_id: string;
      unit_id: string | null;
      imei: string;
      latitude: number;
      longitude: number;
      recorded_at: Date;
    }>>`
      SELECT ep.trip_id, ep.unit_id::text AS unit_id, ep.imei,
             ep.latitude, ep.longitude, ep.recorded_at
        FROM evidence_points ep
       WHERE ep.trip_id = ANY(${filas.map((f) => f.trip_id)}::uuid[])
       ORDER BY ep.trip_id, ep.recorded_at`;

    const puntosPorViaje = new Map<string, GpsPoint[]>();
    for (const e of evid) {
      const arr = puntosPorViaje.get(e.trip_id) ?? [];
      arr.push({
        imei: e.imei,
        unitId: e.unit_id ?? undefined,
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
        timestamp: new Date(e.recorded_at),
      } as GpsPoint);
      puntosPorViaje.set(e.trip_id, arr);
    }
    console.log(
      `  evidencia leída: ${num(evid.length)} puntos en ${num(puntosPorViaje.size)} de ${num(filas.length)} viajes\n`,
    );

    /** Las variantes vigentes a la fecha del servicio, cacheadas por ruta×fecha. */
    const cacheVariantes = new Map<string, Array<{ waypoints: Array<{ lat: number; lng: number }> }>>();
    async function variantesDe(routeId: string, at: Date) {
      const clave = `${routeId}|${at.toISOString().slice(0, 10)}`;
      const yaEsta = cacheVariantes.get(clave);
      if (yaEsta) return yaEsta;
      const v = await repos.routes.getActiveVariantVersionsForDate(routeId, at);
      cacheVariantes.set(clave, v);
      return v;
    }

    type Medido = {
      fila: Fila;
      /** Clave de la candidata que más cerca estuvo, según el ledger. */
      candidata: string | null;
      /** Fracción observable recalculada sobre SU evidencia. null = no medible. */
      fraccion: number | null;
      /** El piso que se le aplicó (1 − tolerancia de origen sellada). */
      piso: number;
      /** Mediana del hueco entre puntos consecutivos de esa candidata (s). */
      huecoMedianoS: number | null;
      puntos: number;
    };

    const medidos: Medido[] = [];
    let sinRuta = 0;
    let sinVariante = 0;
    let sinPuntosDeLaCandidata = 0;

    for (const f of filas) {
      // La candidata que más cerca estuvo de acreditar: mayor min(A,B).
      let clave: string | null = null;
      let mejor = -Infinity;
      for (const s of f.steps) {
        if (s.step !== "candidata") continue;
        const d = (s.details ?? {}) as Record<string, unknown>;
        if (!("arrivalAt" in d)) continue;
        const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : -Infinity;
        const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : -Infinity;
        const puntaje = Math.min(a, b);
        if (puntaje > mejor) {
          mejor = puntaje;
          // C15: `unidadId` en los asientos nuevos, `imei` (que guarda una
          // unidad) en los viejos. Se acepta cualquiera de las dos y abajo se
          // empareja contra las dos columnas de `evidence_points`.
          clave = ((d.unidadId ?? d.imei) as string | null) ?? null;
        }
      }

      const piso =
        1 -
        (f.policy_sellada?.kmlOriginToleranceFraction ?? DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION);

      if (!f.route_id) {
        sinRuta++;
        medidos.push({ fila: f, candidata: clave, fraccion: null, piso, huecoMedianoS: null, puntos: 0 });
        continue;
      }
      const variantes = await variantesDe(f.route_id, new Date(f.deadline));
      if (variantes.length === 0) {
        sinVariante++;
        medidos.push({ fila: f, candidata: clave, fraccion: null, piso, huecoMedianoS: null, puntos: 0 });
        continue;
      }

      const todos = puntosPorViaje.get(f.trip_id) ?? [];
      const suyos = clave === null ? [] : todos.filter((p) => p.unitId === clave || p.imei === clave);
      if (suyos.length === 0) {
        sinPuntosDeLaCandidata++;
        medidos.push({ fila: f, candidata: clave, fraccion: null, piso, huecoMedianoS: null, puntos: 0 });
        continue;
      }

      const corredorKm = Math.min(
        0.5,
        Math.max(0.01, (f.policy_sellada?.kmlCorridorMeters ?? 120) / 1000),
      );
      /*
       * Multi-variante: el árbitro evalúa contra cada variante activa y se
       * queda con la mejor. Se replica quedándose con la fracción observable
       * MÁS ALTA — la lectura más favorable al transportista, que es la que no
       * puede inflar esta cuenta.
       */
      let fraccion: number | null = null;
      for (const v of variantes) {
        if (!Array.isArray(v.waypoints) || v.waypoints.length === 0) continue;
        const span = observableRouteSpan(suyos, v.waypoints, corredorKm);
        if (fraccion === null || span.observableFraction > fraccion) {
          fraccion = span.observableFraction;
        }
      }

      const orden = suyos.map((p) => p.timestamp.getTime()).sort((a, b) => a - b);
      const huecos: number[] = [];
      for (let i = 1; i < orden.length; i++) huecos.push((orden[i]! - orden[i - 1]!) / 1000);

      medidos.push({
        fila: f,
        candidata: clave,
        fraccion,
        piso,
        huecoMedianoS: percentil(huecos, 50),
        puntos: suyos.length,
      });
    }

    const medibles = medidos.filter((m) => m.fraccion !== null);
    const bajoPiso = medibles.filter((m) => m.fraccion! + 1e-9 < m.piso);

    console.log(`  ── 1 · GRANO — la Ley 1 preguntada por la candidata ────────────────`);
    console.log(`  ${"población".padEnd(52)}${num(filas.length).padStart(6)}`);
    console.log(`  ${"  con tramo observable recalculable".padEnd(52)}${num(medibles.length).padStart(6)}   ${pct(medibles.length, filas.length)}`);
    console.log(`  ${"  NO medible (sin ruta / sin variante / sin puntos suyos)".padEnd(52)}${num(filas.length - medibles.length).padStart(6)}`);
    console.log(`      sin ruta ${num(sinRuta)} · sin variante vigente ${num(sinVariante)} · sin puntos de la candidata ${num(sinPuntosDeLaCandidata)}`);
    console.log(
      `\n  ${"  ⇒ POR DEBAJO DEL PISO QUE SE LE APLICÓ".padEnd(52)}${num(bajoPiso.length).padStart(6)}   ${pct(bajoPiso.length, medibles.length)} de lo medible`,
    );
    const fracs = medibles.map((m) => m.fraccion!);
    console.log(
      `      fracción observable: p10 ${num(percentil(fracs, 10), 2)} · p50 ${num(percentil(fracs, 50), 2)} · p90 ${num(percentil(fracs, 90), 2)}`,
    );
    const porContrato = new Map<string, { medible: number; bajo: number }>();
    for (const m of medibles) {
      const e = porContrato.get(m.fila.contrato) ?? { medible: 0, bajo: 0 };
      e.medible++;
      if (m.fraccion! + 1e-9 < m.piso) e.bajo++;
      porContrato.set(m.fila.contrato, e);
    }
    for (const [c, e] of porContrato) {
      console.log(`      ${c.slice(0, 30).padEnd(32)}${num(e.bajo).padStart(5)} de ${num(e.medible).padStart(5)}   ${pct(e.bajo, e.medible)}`);
    }

    // Contraste con lo que el propio expediente ya decía, donde lo decía.
    const conCampo = medidos.filter((m) => {
      for (const s of m.fila.steps) {
        if (s.step === "candidata" && (s.details ?? {}).observableFraction !== undefined) return true;
      }
      return false;
    });
    const conCampoYMedible = conCampo.filter((m) => m.fraccion !== null);
    let coincide = 0;
    for (const m of conCampoYMedible) {
      let sellada: number | null = null;
      let mejor = -Infinity;
      for (const s of m.fila.steps) {
        if (s.step !== "candidata") continue;
        const d = (s.details ?? {}) as Record<string, unknown>;
        if (!("arrivalAt" in d)) continue;
        const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : -Infinity;
        const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : -Infinity;
        if (Math.min(a, b) > mejor) {
          mejor = Math.min(a, b);
          sellada = typeof d.observableFraction === "number" ? d.observableFraction : null;
        }
      }
      if (sellada !== null && Math.abs(sellada - m.fraccion!) <= 0.02) coincide++;
    }
    console.log(
      `\n      valla: de los ${num(conCampoYMedible.length)} que YA traían la fracción sellada, el recálculo\n` +
        `      coincide (±0.02) en ${num(coincide)} (${pct(coincide, conCampoYMedible.length)}). Si esto no cuadrara,\n` +
        `      el recálculo estaría midiendo otra cosa y el reparto no valdría.`,
    );

    // ── 2 · MODO ─────────────────────────────────────────────────────────────
    console.log(`\n  ── 2 · MODO — la estrictez sellada dentro del hecho ────────────────`);
    for (const [k, n] of [...porEstrictez.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(50)}${num(n).padStart(6)}   ${pct(n, filas.length)}`);
    }
    console.log(
      `\n    ⇒ la compuerta «llegó y no se pudo atribuir → pendiente» solo corre bajo\n` +
        `    destino_only: alcanzaría a ${num(conDestinoOnly)} de los ${num(filas.length)}.`,
    );

    // ── 3 · VENTANA (techo) ──────────────────────────────────────────────────
    const { computeEvidenceWindow, summarizeRouteDuration, routeLengthKm } = await import("@jtel/domain");
    const medRaw = await sql<Array<{ route_shift_id: string; duration_minutes: number; lower_bound: boolean }>>`
      SELECT route_shift_id, duration_minutes, lower_bound FROM route_traversal_measurements`;
    const porRutaTurno = new Map<string, Array<{ durationMinutes: number; lowerBound: boolean }>>();
    for (const m of medRaw) {
      const arr = porRutaTurno.get(m.route_shift_id) ?? [];
      arr.push({ durationMinutes: Number(m.duration_minutes), lowerBound: m.lower_bound });
      porRutaTurno.set(m.route_shift_id, arr);
    }
    const rutaTurnoDe = await sql<Array<{ occurrence_id: string; route_shift_id: string }>>`
      SELECT id AS occurrence_id, route_shift_id FROM service_occurrences
       WHERE id = ANY(${filas.map((f) => f.occurrence_id)}::uuid[])`;
    const rsPorOcc = new Map(rutaTurnoDe.map((r) => [r.occurrence_id, r.route_shift_id]));
    const kml = await sql<Array<{ route_id: string; waypoints: Array<{ lat: number; lng: number }> }>>`
      SELECT DISTINCT ON (route_id) route_id, waypoints
        FROM route_kml_versions WHERE valid_to IS NULL
       ORDER BY route_id, valid_from DESC`;
    const largoDeRuta = new Map<string, number>();
    for (const k of kml) {
      if (Array.isArray(k.waypoints) && k.waypoints.length > 1) {
        largoDeRuta.set(k.route_id, routeLengthKm(k.waypoints));
      }
    }

    let abreAntes = 0;
    const ganados: number[] = [];
    for (const f of filas) {
      const rs = rsPorOcc.get(f.occurrence_id);
      const muestras = rs ? (porRutaTurno.get(rs) ?? []) : [];
      const resumen = summarizeRouteDuration(muestras, {
        percentile: f.policy_sellada.routeDurationPercentile,
        minSamples: f.policy_sellada.routeDurationMinSamples,
      });
      const hoy = computeEvidenceWindow(new Date(f.deadline), f.policy_sellada, {
        measuredDurationMinutes: resumen.minutes,
        routeLengthKm: f.route_id ? (largoDeRuta.get(f.route_id) ?? null) : null,
      });
      const antesCongelado = Math.round(
        (new Date(f.deadline).getTime() - new Date(f.window_start).getTime()) / 60_000,
      );
      if (hoy.beforeMinutes > antesCongelado) {
        abreAntes++;
        ganados.push(hoy.beforeMinutes - antesCongelado);
      }
    }
    console.log(`\n  ── 3 · VENTANA — techo, no cuenta ──────────────────────────────────`);
    console.log(
      `    la ventana de hoy abre ANTES en ${num(abreAntes)} de ${num(filas.length)} (${pct(abreAntes, filas.length)})\n` +
        `      minutos de más: p50 ${num(percentil(ganados, 50))} · p90 ${num(percentil(ganados, 90))} · máx ${num(ganados.length ? Math.max(...ganados) : null)}\n` +
        `    ⇒ es TECHO: «se juzgaría sobre otra evidencia» no es «cambiaría de veredicto».\n` +
        `    Más evidencia puede sostener la acusación igual de bien que tumbarla.`,
    );

    // ── 4 · DENSIDAD (curva) ─────────────────────────────────────────────────
    console.log(`\n  ── 4 · DENSIDAD — curva, no cuenta ─────────────────────────────────`);
    const conHueco = medidos.filter((m) => m.huecoMedianoS !== null);
    console.log(
      `    con cadencia medible: ${num(conHueco.length)} de ${num(filas.length)}\n` +
        `    hueco mediano entre puntos de la candidata: p10 ${num(percentil(conHueco.map((m) => m.huecoMedianoS!), 10))} s · ` +
        `p50 ${num(percentil(conHueco.map((m) => m.huecoMedianoS!), 50))} s · p90 ${num(percentil(conHueco.map((m) => m.huecoMedianoS!), 90))} s`,
    );
    for (const umbral of [45, 60, 90, 120]) {
      const n = conHueco.filter((m) => m.huecoMedianoS! >= umbral).length;
      console.log(`      con un piso de densidad de ${String(umbral).padStart(3)} s  →  ${num(n).padStart(4)}   ${pct(n, conHueco.length)}`);
    }
    console.log(
      `    ⇒ es CURVA: el piso no está decidido (C19), y elegir uno aquí sería\n` +
        `    tomar por fuera una decisión que es de Asav.`,
    );

    // ── 5 · El reparto, y el solape ──────────────────────────────────────────
    console.log(`\n  ── 5 · El reparto ──────────────────────────────────────────────────`);
    console.log(`    ${"GRANO    (cuenta exacta)".padEnd(38)}${num(bajoPiso.length).padStart(6)} de ${num(medibles.length)} medibles`);
    console.log(`    ${"MODO     (cuenta exacta)".padEnd(38)}${num(conDestinoOnly).padStart(6)} de ${num(filas.length)}`);
    console.log(`    ${"VENTANA  (techo)".padEnd(38)}${num(abreAntes).padStart(6)} de ${num(filas.length)}`);
    console.log(`    ${"DENSIDAD (curva, a 60 s)".padEnd(38)}${num(conHueco.filter((m) => m.huecoMedianoS! >= 60).length).padStart(6)} de ${num(conHueco.length)} medibles`);

    // ¿El grano y la ventana hablan de los mismos servicios?
    const idsBajoPiso = new Set(bajoPiso.map((m) => m.fila.occurrence_id));
    let solapeGranoVentana = 0;
    for (const f of filas) {
      if (!idsBajoPiso.has(f.occurrence_id)) continue;
      const rs = rsPorOcc.get(f.occurrence_id);
      const muestras = rs ? (porRutaTurno.get(rs) ?? []) : [];
      const resumen = summarizeRouteDuration(muestras, {
        percentile: f.policy_sellada.routeDurationPercentile,
        minSamples: f.policy_sellada.routeDurationMinSamples,
      });
      const hoy = computeEvidenceWindow(new Date(f.deadline), f.policy_sellada, {
        measuredDurationMinutes: resumen.minutes,
        routeLengthKm: f.route_id ? (largoDeRuta.get(f.route_id) ?? null) : null,
      });
      const antesCongelado = Math.round(
        (new Date(f.deadline).getTime() - new Date(f.window_start).getTime()) / 60_000,
      );
      if (hoy.beforeMinutes > antesCongelado) solapeGranoVentana++;
    }
    console.log(
      `\n    solape GRANO ∩ VENTANA: ${num(solapeGranoVentana)}. No son una sola causa con dos\n` +
        `    nombres: la ventana explica POR QUÉ se vio poca ruta; el grano explica por\n` +
        `    qué eso salió como acusación en vez de como pendiente. Una es la herida, la\n` +
        `    otra es que el sistema no la reconoce como tal.`,
    );

    await sql.end();
    process.exit(0);
  } catch (e) {
    await sql.end();
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
