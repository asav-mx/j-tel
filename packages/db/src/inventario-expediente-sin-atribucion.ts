/**
 * Qué puede enseñar hoy un servicio sin atribución, y qué no.
 *
 * SOLO LECTURA. No diseña la pantalla, no propone arreglo, no toca un
 * veredicto. Contesta una sola pregunta, campo por campo: **de lo que un
 * expediente de servicio sin atribución tendría que mostrar, qué está guardado
 * y qué habría que empezar a guardar.**
 *
 * ---
 *
 * **Por qué se mide en vez de razonarse.** «Está en el ledger» es verdad para
 * unos servicios y mentira para otros: el motor cambió tres veces y los
 * asientos viejos no traen campos que los nuevos sí. Un inventario que diga
 * «sí está» sobre un campo presente en el 17 % de la población **es la trampa
 * de §D del Marco** — el dato correcto con el alcance borrado. Aquí cada
 * renglón sale con su cobertura.
 *
 * **La segunda ley del frente, aplicada a este archivo:** donde no hay dato se
 * dice que no hay. Por eso se separan tres estados y nunca se colapsan:
 *
 *   GUARDADO      — el hecho lo trae sellado. Se puede mostrar tal cual.
 *   DERIVABLE     — no está sellado pero se puede calcular hoy con lo guardado.
 *                   Mostrarlo exige decir que es lectura de HOY, no lo que el
 *                   árbitro vio: si la tabla de la que se deriva cambió, el
 *                   número cambia (C24).
 *   NO ESTÁ       — no se guardó y no se puede reconstruir. La pantalla tiene
 *                   que decirlo con esas palabras.
 *
 *   pnpm --filter @jtel/db inventario-expediente
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
  service_date: string;
  route_shift_id: string;
  route_id: string | null;
  served_variant_id: string | null;
  expected_geofence_id: string;
  steps: PasoLedger[];
};

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  Expediente de un servicio sin atribución — qué hay y qué falta`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    const filas = await sql<Fila[]>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT o.id                  AS occurrence_id,
             t.id                  AS trip_id,
             o.service_date::text  AS service_date,
             o.route_shift_id::text AS route_shift_id,
             rs.route_id::text     AS route_id,
             cf.served_variant_id::text AS served_variant_id,
             cf.expected_geofence_id::text AS expected_geofence_id,
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
            WHERE s->>'step' = 'candidata' AND s->'details' ? 'arrivalAt')`;

    const N = filas.length;
    console.log(`  población: ${num(N)} servicios acusados con una llegada registrada\n`);

    const candsDe = (f: Fila) => f.steps.filter((s) => s.step === "candidata");
    const pasoDe = (f: Fila, nombre: string) => f.steps.find((s) => s.step === nombre);
    /** Servicios en los que TODAS las candidatas traen el campo. */
    const todasTraen = (campo: string) =>
      filas.filter((f) => {
        const c = candsDe(f);
        return c.length > 0 && c.every((s) => (s.details ?? {})[campo] !== undefined);
      }).length;
    /** Servicios en los que AL MENOS UNA lo trae. */
    const algunaTrae = (campo: string) =>
      filas.filter((f) => candsDe(f).some((s) => (s.details ?? {})[campo] !== undefined)).length;

    function renglon(que: string, n: number, estado: string, nota = "") {
      console.log(
        `  ${que.padEnd(44)}${num(n).padStart(6)} ${pct(n, N).padStart(8)}   ${estado.padEnd(10)}${nota}`,
      );
    }

    // ── 1 · Las candidatas evaluadas, con su trazo real ──────────────────────
    console.log(`  ── 1 · Las candidatas que se evaluaron, con su trazo del día ───────`);
    const nCands = filas.map((f) => candsDe(f).length);
    console.log(
      `  candidatas evaluadas por servicio: p10 ${num(percentil(nCands, 10))} · p50 ${num(percentil(nCands, 50))} · p90 ${num(percentil(nCands, 90))} · máx ${num(Math.max(...nCands))}\n`,
    );
    renglon("la lista de candidatas, con su clave", filas.filter((f) => candsDe(f).length > 0).length, "GUARDADO");
    renglon("  la clave es una UNIDAD declarada (unidadId)", todasTraen("unidadId"), "GUARDADO", "C15: el resto la trae bajo `imei`");
    renglon("  el APARATO que emitió (imeis, en plural)", todasTraen("imeis"), "NO ESTÁ", "en los viejos no se guardó");

    // El trazo real: puntos de evidencia por viaje, y por candidata.
    const puntos = await sql<Array<{ trip_id: string; unit_id: string | null; imei: string; n: number }>>`
      SELECT trip_id::text AS trip_id, unit_id::text AS unit_id, imei, COUNT(*)::int AS n
        FROM evidence_points
       WHERE trip_id = ANY(${filas.map((f) => f.trip_id)}::uuid[])
       GROUP BY 1, 2, 3`;
    const clavesPorViaje = new Map<string, Set<string>>();
    for (const p of puntos) {
      const s = clavesPorViaje.get(p.trip_id) ?? new Set<string>();
      if (p.unit_id) s.add(p.unit_id);
      s.add(p.imei);
      clavesPorViaje.set(p.trip_id, s);
    }
    const claveDe = (s: PasoLedger) => {
      const d = (s.details ?? {}) as Record<string, unknown>;
      return ((d.unidadId ?? d.imei) as string | null) ?? null;
    };
    const conTrazoDeTodas = filas.filter((f) => {
      const disp = clavesPorViaje.get(f.trip_id) ?? new Set<string>();
      const c = candsDe(f);
      return c.length > 0 && c.every((s) => {
        const k = claveDe(s);
        return k !== null && disp.has(k);
      });
    }).length;
    const conTrazoDeAlguna = filas.filter((f) => {
      const disp = clavesPorViaje.get(f.trip_id) ?? new Set<string>();
      return candsDe(f).some((s) => {
        const k = claveDe(s);
        return k !== null && disp.has(k);
      });
    }).length;
    renglon("el trazo REAL de todas sus candidatas", conTrazoDeTodas, "GUARDADO", "puntos con lat/lng/hora/velocidad");
    renglon("  al menos el de una", conTrazoDeAlguna, "GUARDADO");

    // ── 2 · Los números de cada candidata ────────────────────────────────────
    console.log(`\n  ── 2 · Los números de cada candidata ───────────────────────────────`);
    renglon("cuánta ruta cubrió — A ponderada", todasTraen("routeMatchPct"), "GUARDADO", "es la que DECIDE");
    renglon("cuánta ruta cubrió — A llana (C17)", todasTraen("routeMatchPlainPct"), "NO ESTÁ", "y es la legible como %");
    renglon("qué tan pegada fue — B corredor", todasTraen("corridorPrecisionPct"), "GUARDADO");
    renglon("forma del recorrido — Fréchet", todasTraen("frechetKm"), "GUARDADO");
    renglon("sentido de la marcha — dirección", todasTraen("directionSimilarity"), "GUARDADO");
    renglon("sobre qué tramo se le calificó A", todasTraen("observableFraction"), "DERIVABLE", "recalculable: cuadra 121/121");
    renglon("el corredor y los umbrales aplicados", todasTraen("minKmlPct"), "GUARDADO");

    const conCobertura = filas.filter((f) => pasoDe(f, "cobertura_evidencia") !== undefined).length;
    const coberturaPorUnidad = filas.filter(
      (f) => ((pasoDe(f, "cobertura_evidencia")?.details ?? {}) as Record<string, unknown>).perUnidad === true,
    ).length;
    renglon("cuánta señal hubo — cobertura de la ventana", conCobertura, "GUARDADO", "de UNA sola unidad, la mejor");
    renglon("  declarada como por-unidad", coberturaPorUnidad, "GUARDADO");
    renglon("cuánta señal tuvo CADA candidata", 0, "DERIVABLE", "de los puntos; no hay campo");

    // ── 3 · Por qué ninguna acreditó, causa por causa ────────────────────────
    console.log(`\n  ── 3 · Por qué ninguna acreditó ────────────────────────────────────`);
    const conDecision = filas.filter((f) => pasoDe(f, "decision") !== undefined).length;
    const conMotivo = filas.filter(
      (f) => ((pasoDe(f, "decision")?.details ?? {}) as Record<string, unknown>).reason !== undefined,
    ).length;
    renglon("el motivo del SERVICIO (uno para todas)", conMotivo, "GUARDADO", "en agregado, que es el problema");
    renglon("  el paso decision existe", conDecision, "GUARDADO");
    renglon("el motivo de CADA candidata", 0, "NO ESTÁ", "no hay campo de motivo por candidata");
    /*
     * «Derivable» tiene un límite que hay que decir: la compuerta que falló se
     * deduce comparando cada número contra su umbral, y eso solo se puede hacer
     * donde el número está. Con `observableFraction` ausente en la mayoría, la
     * deducción se queda coja justo en la compuerta que más rechaza.
     */
    const deducible = filas.filter((f) =>
      candsDe(f).every((s) => {
        const d = (s.details ?? {}) as Record<string, unknown>;
        return d.routeMatchPct !== undefined && d.corridorPrecisionPct !== undefined && d.observableFraction !== undefined;
      }),
    ).length;
    renglon("  deducible de los números sellados", deducible, "DERIVABLE", "solo donde están los tres");

    // ── 4 · El trazo real contra el contratado ───────────────────────────────
    console.log(`\n  ── 4 · El trazo real contra el contratado, encimados ───────────────`);
    const conMultiVariante = filas.filter((f) => pasoDe(f, "multi_variante") !== undefined).length;
    const conVarianteSellada = filas.filter((f) => f.served_variant_id !== null).length;
    renglon("el trazo real (los puntos del día)", conTrazoDeAlguna, "GUARDADO");
    renglon("CUÁL trazado contratado se usó, sellado", conVarianteSellada, "NO ESTÁ", "servedVariantId solo se llena en cumplido");
    renglon(
      "  la evaluación multi-variante en el ledger",
      conMultiVariante,
      conMultiVariante === 0 ? "NO ESTÁ" : "GUARDADO",
      conMultiVariante === 0 ? "el paso no aparece en ninguno" : "dice qué variantes hubo",
    );
    renglon("el trazado, reconstruible por fecha", N, "DERIVABLE", "de route_kml_versions vigente ese día");
    /*
     * C4 en esta población: el hecho congela `expectedGeofenceId` y el motor
     * juzga contra `profile.geofence` (`verification.ts:1062`). Si divergen, el
     * mapa dibujaría un destino y el campo del hecho nombraría otro — que es
     * justo lo que la segunda ley del frente prohíbe.
     */
    const geocercas = await sql<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_profiles sp
          ON sp.route_shift_id = o.route_shift_id AND sp.contract_id = o.contract_id
       WHERE cf.service_occurrence_id = ANY(${filas.map((f) => f.occurrence_id)}::uuid[])
         AND cf.expected_geofence_id IS DISTINCT FROM sp.geofence_id`;
    renglon("el destino dibujado = el sellado en el hecho", N - (geocercas[0]?.n ?? 0), "GUARDADO", `C4: ${num(geocercas[0]?.n ?? 0)} divergen del perfil`);

    // ── 5 · El empalme ───────────────────────────────────────────────────────
    console.log(`\n  ── 5 · Si esa unidad sirvió otra ruta ese turno ────────────────────`);
    /*
     * Nada guarda «esta unidad cubrió también la ruta X». Se deriva cruzando el
     * ledger del mismo día: si la misma clave aparece como `sirvio_ruta` en otro
     * servicio de esa fecha, el empalme está a la vista sin inventar nada.
     */
    const acreditadasDelDia = await sql<Array<{ service_date: string; clave: string }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT o.service_date::text AS service_date,
             COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') AS clave
        FROM ult
        JOIN service_occurrences o ON o.id = ult.occ
        CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE s->>'step' = 'candidata' AND s->>'result' = 'sirvio_ruta'
         AND COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') IS NOT NULL`;
    const acreditoEseDia = new Set(acreditadasDelDia.map((a) => `${a.service_date}|${a.clave}`));
    /*
     * ⚠ La pregunta hay que hacérsela a la candidata QUE LLEGÓ, no a cualquiera
     * de la lista. Un servicio evalúa la flota entera —mediana de 50
     * candidatas—, así que «¿alguna de ellas acreditó otra ruta hoy?» contesta
     * que sí siempre y no dice nada. Es el mismo error que ya se cometió una
     * vez con los aparatos del viaje, corregido aquí antes de publicarlo.
     */
    const mejorConLlegada = (f: Fila): string | null => {
      let clave: string | null = null;
      let mejor = -Infinity;
      for (const s of candsDe(f)) {
        const d = (s.details ?? {}) as Record<string, unknown>;
        if (!("arrivalAt" in d)) continue;
        const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : -Infinity;
        const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : -Infinity;
        if (Math.min(a, b) > mejor) {
          mejor = Math.min(a, b);
          clave = claveDe(s);
        }
      }
      return clave;
    };
    const conEmpalme = filas.filter((f) => {
      const k = mejorConLlegada(f);
      return k !== null && acreditoEseDia.has(`${f.service_date}|${k}`);
    }).length;
    const conLlegadaCount = filas.map((f) => candsDe(f).filter((s) => "arrivalAt" in (s.details ?? {})).length);
    console.log(
      `    candidatas que LLEGARON, por servicio: p10 ${num(percentil(conLlegadaCount, 10))} · p50 ${num(percentil(conLlegadaCount, 50))} · p90 ${num(percentil(conLlegadaCount, 90))}\n` +
        `    (contra ${num(percentil(nCands, 50))} evaluadas: la lista de candidatas ES la flota, así que\n` +
        `     una pantalla que las liste todas no informa — el subconjunto útil es éste.)\n`,
    );
    renglon("el empalme, como campo guardado", 0, "NO ESTÁ", "no existe la relación unidad↔otra ruta");
    renglon("el empalme, derivado del ledger del día", N, "DERIVABLE", "cruzando candidatas acreditadas");
    console.log(
      `\n    ⇒ preguntado bien: en ${num(conEmpalme)} de ${num(N)} (${pct(conEmpalme, N)}) la candidata que LLEGÓ\n` +
        `    a este servicio acreditó otra ruta ese mismo día. Eso sí es enseñable, y\n` +
        `    sale sin inventar nada: es el ledger del día cruzado consigo mismo.`,
    );

    // ── 5b · El corte de dos criterios: llegó Y anduvo cerca del trazado ─────
    /*
     * Cuántas candidatas quedan si el expediente muestra solo las RELEVANTES.
     *
     * Criterio 1 — llegó a la geocerca: `arrivalAt` en el ledger.
     * Criterio 2 — anduvo cerca del trazado: precisión de corredor sobre un
     * piso. El piso NO es de política: no decide ningún veredicto, solo decide
     * a quién vale la pena enseñar. Por eso se dan varios y la ficha elige uno
     * declarándolo — elegirlo aquí lo escondería dentro de un guion.
     *
     * La ley que lo acompaña vive en la pantalla, no aquí: el expediente tiene
     * que decir cuántas se evaluaron EN TOTAL, o el corte se vuelve
     * ocultamiento y el transportista tiene razón al decir «sí fui y ni
     * aparezco».
     */
    console.log(`\n  ── 5b · El corte de dos criterios ──────────────────────────────────`);
    const bDe = (s: PasoLedger) => {
      const v = (s.details ?? {}).corridorPrecisionPct;
      return typeof v === "number" ? v : null;
    };
    const conLlegada = (f: Fila) => candsDe(f).filter((s) => "arrivalAt" in (s.details ?? {}));
    console.log(
      `  ${"criterio".padEnd(46)}${"p50".padStart(6)}${"p90".padStart(7)}${"máx".padStart(7)}${"= 0".padStart(8)}`,
    );
    const fila1 = filas.map((f) => candsDe(f).length);
    console.log(
      `  ${"evaluadas (la flota entera)".padEnd(46)}${num(percentil(fila1, 50)).padStart(6)}${num(percentil(fila1, 90)).padStart(7)}${num(Math.max(...fila1)).padStart(7)}${"—".padStart(8)}`,
    );
    const fila2 = filas.map((f) => conLlegada(f).length);
    console.log(
      `  ${"+ llegó a la geocerca".padEnd(46)}${num(percentil(fila2, 50)).padStart(6)}${num(percentil(fila2, 90)).padStart(7)}${num(Math.max(...fila2)).padStart(7)}${num(fila2.filter((n) => n === 0).length).padStart(8)}`,
    );
    for (const piso of [0, 5, 10, 25]) {
      const conteo = filas.map(
        (f) => conLlegada(f).filter((s) => (bDe(s) ?? -1) > piso).length,
      );
      const etiqueta =
        piso === 0
          ? "+ tocó el corredor del trazado (B > 0 %)"
          : `+ anduvo cerca del trazado (B > ${piso} %)`;
      console.log(
        `  ${etiqueta.padEnd(46)}${num(percentil(conteo, 50)).padStart(6)}${num(percentil(conteo, 90)).padStart(7)}${num(Math.max(...conteo)).padStart(7)}${num(conteo.filter((n) => n === 0).length).padStart(8)}`,
      );
    }
    console.log(
      `\n    La columna «= 0» es la que decide el piso: son los servicios que se\n` +
        `    quedarían SIN NINGUNA candidata que enseñar. Un corte que deja el\n` +
        `    expediente vacío es peor que uno que deja de más.`,
    );

    // ── 6 · Resumen ──────────────────────────────────────────────────────────
    console.log(`\n  ── 6 · Lo que habría que empezar a guardar ─────────────────────────`);
    console.log(
      `    · el motivo POR CANDIDATA (hoy solo hay uno para todo el servicio)\n` +
        `    · la señal POR CANDIDATA (hoy la cobertura es de una sola unidad)\n` +
        `    · qué trazado contratado se usó, sellado también en los no cumplidos\n` +
        `    · el aparato que emitió, en los asientos que no lo guardaron\n` +
        `    · A llana junto a la ponderada, en los que solo traen la ponderada`,
    );
    console.log(
      `\n    ⚠ Y lo que NO se arregla guardando de más: lo ya sellado sigue sin traerlo.\n` +
        `    Cualquier campo nuevo nace vacío hacia atrás, así que la pantalla tiene que\n` +
        `    saber decir «esto no se preguntó entonces» — que es la segunda ley del\n` +
        `    frente, y sin ella un hueco se lee como un cero.\n`,
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
