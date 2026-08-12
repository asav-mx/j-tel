/**
 * Qué puede ver el cliente de un servicio sin atribución sin romper la Ley 3.
 *
 * SOLO LECTURA. No diseña la pantalla y no propone arreglo: contesta, con
 * números, si cada dato que se quiere enseñar **expone o no la operación del
 * transportista o la de otro cliente**.
 *
 * ---
 *
 * **La ley que se está probando.** El Marco: *el cliente jamás ve la operación
 * interna del carrier — candidatas evaluadas, flota completa, diagnósticos*. Y:
 * *si una unidad entra a la geocerca de otro cliente, el nombre del otro
 * cliente no entra a ningún expediente*.
 *
 * **Por qué hay que medirlo y no razonarlo.** «Cuántas llegadas hubo» suena
 * inofensivo hasta que se pregunta **de quién eran esas unidades**. Si las que
 * llegan a la geocerca de un cliente son unidades que ese mismo día sirven a
 * OTRO cliente, entonces un conteo —y sobre todo un trazo— empieza a hablar de
 * una operación que no es la de quien mira. Eso no se puede saber leyendo el
 * Marco: hay que ir a ver de quién son.
 *
 * Cada bloque devuelve un veredicto de exposición, no una opinión:
 *
 *   CABE          — el dato es del servicio del cliente y no identifica a nadie.
 *   CABE ACOTADO  — cabe con una regla explícita que quita lo que expone.
 *   NO CABE       — no hay forma de mostrarlo sin revelar flota u otro cliente.
 *
 *   pnpm --filter @jtel/db que-ve-el-cliente
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION, observableRouteSpan } from "@jtel/verification";
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
  contract_id: string;
  client_account_id: string;
  service_date: string;
  policy_sellada: ContractPolicy;
  steps: PasoLedger[];
};

function veredicto(clave: string, texto: string) {
  console.log(`\n  ${clave}\n  ${texto}`);
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });
  const repos = createRepositories(createDb(url));

  try {
    console.log(`\n  Qué puede ver el cliente sin romper la Ley 3`);
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
             o.contract_id::text   AS contract_id,
             sc.client_account_id::text AS client_account_id,
             o.service_date::text  AS service_date,
             cf.contract_policy_snapshot AS policy_sellada,
             ult.steps
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
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
    console.log(`  población: ${num(N)} servicios acusados con una llegada registrada`);

    const claveDe = (s: PasoLedger) => {
      const d = (s.details ?? {}) as Record<string, unknown>;
      return ((d.unidadId ?? d.imei) as string | null) ?? null;
    };
    const llegadasDe = (f: Fila) =>
      f.steps.filter((s) => s.step === "candidata" && "arrivalAt" in (s.details ?? {}));

    /*
     * De quién es cada unidad que acreditó algo ese día: contrato y cuenta
     * cliente. Es lo que decide si un conteo habla de la operación de quien
     * mira o de la de un tercero.
     */
    const acreditaciones = await sql<Array<{
      service_date: string;
      clave: string;
      contract_id: string;
      client_account_id: string;
    }>>`
      WITH ult AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id AS occ, le.steps
          FROM ledger_entries le
         WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(le.steps) s WHERE s->>'step' = 'decision')
         ORDER BY le.service_occurrence_id, le.created_at DESC
      )
      SELECT o.service_date::text AS service_date,
             COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') AS clave,
             o.contract_id::text AS contract_id,
             sc.client_account_id::text AS client_account_id
        FROM ult
        JOIN service_occurrences o ON o.id = ult.occ
        JOIN service_contracts sc ON sc.id = o.contract_id
        CROSS JOIN LATERAL jsonb_array_elements(ult.steps) s
       WHERE s->>'step' = 'candidata' AND s->>'result' = 'sirvio_ruta'
         AND COALESCE(s->'details'->>'unidadId', s->'details'->>'imei') IS NOT NULL`;

    type Acred = { contratos: Set<string>; clientes: Set<string> };
    const acredPorDiaUnidad = new Map<string, Acred>();
    for (const a of acreditaciones) {
      const k = `${a.service_date}|${a.clave}`;
      const e = acredPorDiaUnidad.get(k) ?? { contratos: new Set(), clientes: new Set() };
      e.contratos.add(a.contract_id);
      e.clientes.add(a.client_account_id);
      acredPorDiaUnidad.set(k, e);
    }

    // ── 1 · «Hubo llegadas, y cuántas» ───────────────────────────────────────
    console.log(`\n  ── 1 · «Hubo llegadas a su geocerca, y cuántas» ────────────────────`);
    const unidadesQueLlegaron = filas.map(
      (f) => new Set(llegadasDe(f).map(claveDe).filter((k): k is string => k !== null)).size,
    );
    console.log(
      `  unidades distintas que llegaron, por servicio: p10 ${num(percentil(unidadesQueLlegaron, 10))} · ` +
        `p50 ${num(percentil(unidadesQueLlegaron, 50))} · p90 ${num(percentil(unidadesQueLlegaron, 90))} · máx ${num(Math.max(...unidadesQueLlegaron))}`,
    );

    /*
     * La pregunta que decide: de las unidades que llegaron a la geocerca de
     * ESTE cliente, ¿cuántas estaban ese día sirviendo a OTRO cliente? Si son
     * muchas, el conteo deja de hablar del servicio de quien mira.
     */
    let servAlgunaDeOtroCliente = 0;
    let servTodasDelMismo = 0;
    let servNingunaAcredito = 0;
    const unidadesTotal = { mismoContrato: 0, mismoClienteOtroContrato: 0, otroCliente: 0, sinAcreditar: 0 };
    for (const f of filas) {
      const claves = new Set(
        llegadasDe(f).map(claveDe).filter((k): k is string => k !== null),
      );
      let hayOtroCliente = false;
      let hayAlguna = false;
      for (const k of claves) {
        const a = acredPorDiaUnidad.get(`${f.service_date}|${k}`);
        if (!a) {
          unidadesTotal.sinAcreditar++;
          continue;
        }
        hayAlguna = true;
        if (a.clientes.size > 1 || !a.clientes.has(f.client_account_id)) {
          unidadesTotal.otroCliente++;
          hayOtroCliente = true;
        } else if (a.contratos.has(f.contract_id) && a.contratos.size === 1) {
          unidadesTotal.mismoContrato++;
        } else {
          unidadesTotal.mismoClienteOtroContrato++;
        }
      }
      if (hayOtroCliente) servAlgunaDeOtroCliente++;
      else if (hayAlguna) servTodasDelMismo++;
      else servNingunaAcredito++;
    }
    const totalUnidades =
      unidadesTotal.mismoContrato +
      unidadesTotal.mismoClienteOtroContrato +
      unidadesTotal.otroCliente +
      unidadesTotal.sinAcreditar;
    console.log(`\n  De quién eran esas unidades, ese mismo día (pares servicio×unidad: ${num(totalUnidades)}):`);
    console.log(`    acreditaron ESTE contrato                    ${num(unidadesTotal.mismoContrato).padStart(6)}   ${pct(unidadesTotal.mismoContrato, totalUnidades)}`);
    console.log(`    acreditaron otro contrato del MISMO cliente  ${num(unidadesTotal.mismoClienteOtroContrato).padStart(6)}   ${pct(unidadesTotal.mismoClienteOtroContrato, totalUnidades)}`);
    console.log(`    acreditaron algo de OTRO cliente             ${num(unidadesTotal.otroCliente).padStart(6)}   ${pct(unidadesTotal.otroCliente, totalUnidades)}`);
    console.log(`    no acreditaron nada ese día                  ${num(unidadesTotal.sinAcreditar).padStart(6)}   ${pct(unidadesTotal.sinAcreditar, totalUnidades)}`);
    console.log(`\n  Servicios con al menos una unidad de OTRO cliente entre las que llegaron:`);
    console.log(`    ${num(servAlgunaDeOtroCliente).padStart(6)} de ${num(N)}   ${pct(servAlgunaDeOtroCliente, N)}`);

    // ── 2 · «A qué hora ocurrieron» ──────────────────────────────────────────
    console.log(`\n  ── 2 · «A qué hora ocurrieron» ─────────────────────────────────────`);
    const conHora = filas.filter((f) =>
      llegadasDe(f).every((s) => typeof (s.details ?? {}).arrivalAt === "string"),
    ).length;
    console.log(`  servicios con la hora de TODAS sus llegadas       ${num(conHora).padStart(6)}   ${pct(conHora, N)}`);
    /*
     * Una hora sola no identifica a nadie. Lo que identifica es el CONJUNTO:
     * enseñar cuatro horas distintas es enseñar que hubo cuatro unidades, y eso
     * es el mismo dato del bloque 1 dicho de otra forma.
     */
    console.log(
      `  ⚠ enseñar N horas distintas ES enseñar que hubo N unidades: este bloque\n` +
        `    no agrega exposición sobre el 1, pero tampoco es independiente de él.`,
    );

    // ── 3 · «Por qué no se pudo acreditar ninguna» ───────────────────────────
    console.log(`\n  ── 3 · «Por qué no se pudo acreditar ninguna» ──────────────────────`);
    const motivos = new Map<string, number>();
    for (const f of filas) {
      const d = f.steps.find((s) => s.step === "decision");
      const r = ((d?.details ?? {}) as Record<string, unknown>).reason as string | undefined;
      motivos.set(r ?? "—", (motivos.get(r ?? "—") ?? 0) + 1);
    }
    for (const [k, n] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(46)}${num(n).padStart(6)}   ${pct(n, N)}`);
    }
    console.log(
      `\n  ⚠ Ése es el único motivo guardado, y es una TAUTOLOGÍA: «ninguna unidad\n` +
        `    coincidió con la ruta» dice lo mismo que «no se pudo atribuir». No\n` +
        `    explica nada, y es exactamente lo que la Parte 2 viene a partir.`,
    );

    /*
     * Lo que sí se puede decir hoy, y sin nombrar a nadie: la FAMILIA de la
     * causa. Sale de comparar los números sellados de la mejor candidata con
     * sus umbrales — un enunciado agregado, sin unidad y sin puntaje.
     */
    let sinTramo = 0;
    let sinCobertura = 0;
    let sinPrecision = 0;
    let ambas = 0;
    let indeterminado = 0;
    for (const f of filas) {
      let mejor: PasoLedger | null = null;
      let puntaje = -Infinity;
      for (const s of llegadasDe(f)) {
        const d = (s.details ?? {}) as Record<string, unknown>;
        const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : -Infinity;
        const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : -Infinity;
        if (Math.min(a, b) > puntaje) {
          puntaje = Math.min(a, b);
          mejor = s;
        }
      }
      const d = (mejor?.details ?? {}) as Record<string, unknown>;
      const piso =
        1 - (f.policy_sellada?.kmlOriginToleranceFraction ?? DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION);
      const frac = typeof d.observableFraction === "number" ? d.observableFraction : null;
      const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : null;
      const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : null;
      const minA = typeof d.minKmlPct === "number" ? d.minKmlPct : null;
      const minB = typeof d.minCorridorPct === "number" ? d.minCorridorPct : null;
      if (frac !== null && frac + 1e-9 < piso) sinTramo++;
      else if (a !== null && minA !== null && b !== null && minB !== null) {
        const fa = a < minA;
        const fb = b < minB;
        if (fa && fb) ambas++;
        else if (fa) sinCobertura++;
        else if (fb) sinPrecision++;
        else indeterminado++;
      } else indeterminado++;
    }
    console.log(`\n  La FAMILIA de la causa, sin nombrar unidad ni puntaje:`);
    console.log(`    no se le vio suficiente ruta a ninguna        ${num(sinTramo).padStart(6)}   ${pct(sinTramo, N)}`);
    console.log(`    ninguna recorrió suficiente del trazado       ${num(sinCobertura).padStart(6)}   ${pct(sinCobertura, N)}`);
    console.log(`    ninguna se mantuvo sobre el trazado           ${num(sinPrecision).padStart(6)}   ${pct(sinPrecision, N)}`);
    console.log(`    las dos cosas                                 ${num(ambas).padStart(6)}   ${pct(ambas, N)}`);
    console.log(`    indeterminable con lo sellado                 ${num(indeterminado).padStart(6)}   ${pct(indeterminado, N)}`);

    // ── 3b · ¿La causa sellada es la causa verdadera? ────────────────────────
    /*
     * La pregunta que decide si el bloque 3 se puede construir hoy, y no es de
     * confidencialidad: **la familia que sale de lo sellado puede ser la
     * equivocada**. C25 dice que la compuerta del tramo observable se evade por
     * grano, así que un servicio cuya candidata ni siquiera fue observada en
     * suficiente ruta sale clasificado como «no recorrió suficiente del
     * trazado» — que en la cara del cliente se lee como conducta del
     * transportista.
     *
     * Se recalcula el tramo observable con la MISMA función del motor, sobre la
     * misma evidencia y la misma ventana, y se cruza contra la familia sellada.
     */
    const evid = await sql<Array<{
      occurrence_id: string;
      unit_id: string | null;
      imei: string;
      latitude: number;
      longitude: number;
      recorded_at: Date;
    }>>`
      SELECT t.service_occurrence_id::text AS occurrence_id,
             ep.unit_id::text AS unit_id, ep.imei,
             ep.latitude, ep.longitude, ep.recorded_at
        FROM evidence_points ep
        JOIN trips t ON t.id = ep.trip_id
       WHERE t.service_occurrence_id = ANY(${filas.map((f) => f.occurrence_id)}::uuid[])
       ORDER BY t.service_occurrence_id, ep.recorded_at`;
    const puntosPorOcc = new Map<string, GpsPoint[]>();
    for (const e of evid) {
      const arr = puntosPorOcc.get(e.occurrence_id) ?? [];
      arr.push({
        imei: e.imei,
        unitId: e.unit_id ?? undefined,
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
        timestamp: new Date(e.recorded_at),
      } as GpsPoint);
      puntosPorOcc.set(e.occurrence_id, arr);
    }
    const rutas = await sql<Array<{ occurrence_id: string; route_id: string; deadline: Date }>>`
      SELECT o.id::text AS occurrence_id, rs.route_id::text AS route_id, o.expected_deadline AS deadline
        FROM service_occurrences o
        JOIN route_shifts rs ON rs.id = o.route_shift_id
       WHERE o.id = ANY(${filas.map((f) => f.occurrence_id)}::uuid[])`;
    const rutaDe = new Map(rutas.map((r) => [r.occurrence_id, r]));
    const cacheVar = new Map<string, Array<{ waypoints: Array<{ lat: number; lng: number }> }>>();

    let selladaDiceConducta = 0;
    let peroFueObservacion = 0;
    for (const f of filas) {
      // Solo interesa la familia que suena a conducta del transportista.
      let mejor: PasoLedger | null = null;
      let puntaje = -Infinity;
      for (const s of llegadasDe(f)) {
        const d = (s.details ?? {}) as Record<string, unknown>;
        const a = typeof d.routeMatchPct === "number" ? d.routeMatchPct : -Infinity;
        const b = typeof d.corridorPrecisionPct === "number" ? d.corridorPrecisionPct : -Infinity;
        if (Math.min(a, b) > puntaje) {
          puntaje = Math.min(a, b);
          mejor = s;
        }
      }
      const d = (mejor?.details ?? {}) as Record<string, unknown>;
      const piso =
        1 - (f.policy_sellada?.kmlOriginToleranceFraction ?? DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION);
      const fracSellada = typeof d.observableFraction === "number" ? d.observableFraction : null;
      if (fracSellada !== null && fracSellada + 1e-9 < piso) continue; // ya dice observación
      selladaDiceConducta++;

      const r = rutaDe.get(f.occurrence_id);
      if (!r) continue;
      const clave = `${r.route_id}|${f.service_date}`;
      let variantes = cacheVar.get(clave);
      if (!variantes) {
        variantes = await repos.routes.getActiveVariantVersionsForDate(r.route_id, new Date(r.deadline));
        cacheVar.set(clave, variantes);
      }
      const claveCand = ((d.unidadId ?? d.imei) as string | null) ?? null;
      const todos = puntosPorOcc.get(f.occurrence_id) ?? [];
      const suyos = claveCand === null ? [] : todos.filter((p) => p.unitId === claveCand || p.imei === claveCand);
      if (suyos.length === 0) continue;
      const corredorKm = Math.min(
        0.5,
        Math.max(0.01, (f.policy_sellada?.kmlCorridorMeters ?? 120) / 1000),
      );
      let frac: number | null = null;
      for (const v of variantes) {
        if (!Array.isArray(v.waypoints) || v.waypoints.length === 0) continue;
        const span = observableRouteSpan(suyos, v.waypoints, corredorKm);
        if (frac === null || span.observableFraction > frac) frac = span.observableFraction;
      }
      if (frac !== null && frac + 1e-9 < piso) peroFueObservacion++;
    }
    console.log(`\n  ── 3b · ¿La causa sellada es la verdadera? ─────────────────────────`);
    console.log(
      `  servicios cuya familia SELLADA suena a conducta del transportista   ${num(selladaDiceConducta).padStart(5)}\n` +
        `    de ésos, la candidata ni siquiera fue observada en suficiente ruta  ${num(peroFueObservacion).padStart(5)}   ${pct(peroFueObservacion, selladaDiceConducta)}`,
    );
    console.log(
      `\n  ⚠ Ahí está el riesgo real del bloque 3, y NO es de confidencialidad:\n` +
        `    decirle al cliente la causa sellada le imputaría al transportista una\n` +
        `    conducta cuando lo que hubo fue un fallo de OBSERVACIÓN (C25).`,
    );

    // ── 4 · «El trazado contratado contra el trazo real» ─────────────────────
    console.log(`\n  ── 4 · «El trazo real» — lo que revelaría ──────────────────────────`);
    /*
     * Un trazo real es el recorrido de UNA unidad. Si esa unidad estaba
     * sirviendo a otro cliente, su recorrido es el trazado de OTRO CLIENTE
     * dibujado en el mapa de éste. Eso no es «revelar flota»: es peor.
     */
    let servTrazoDeOtroCliente = 0;
    let servTrazoDeOtroContrato = 0;
    for (const f of filas) {
      const claves = new Set(llegadasDe(f).map(claveDe).filter((k): k is string => k !== null));
      let otroCliente = false;
      let otroContrato = false;
      for (const k of claves) {
        const a = acredPorDiaUnidad.get(`${f.service_date}|${k}`);
        if (!a) continue;
        if (a.clientes.size > 1 || !a.clientes.has(f.client_account_id)) otroCliente = true;
        for (const c of a.contratos) if (c !== f.contract_id) otroContrato = true;
      }
      if (otroCliente) servTrazoDeOtroCliente++;
      if (otroContrato) servTrazoDeOtroContrato++;
    }
    console.log(
      `  servicios donde alguna traza a dibujar sería de OTRO CLIENTE   ${num(servTrazoDeOtroCliente).padStart(5)}   ${pct(servTrazoDeOtroCliente, N)}`,
    );
    console.log(
      `  servicios donde sería de otro CONTRATO (mismo o no)            ${num(servTrazoDeOtroContrato).padStart(5)}   ${pct(servTrazoDeOtroContrato, N)}`,
    );

    // ── 5 · Los veredictos de exposición ─────────────────────────────────────
    console.log(`\n  ── 5 · Veredictos ──────────────────────────────────────────────────`);
    veredicto(
      `1 · «hubo llegadas, y cuántas»`,
      unidadesTotal.otroCliente === 0
        ? `CABE. Ninguna de las unidades que llegaron acreditó algo de otro cliente\n  ese día: el conteo habla de la operación de quien mira.`
        : `CABE ACOTADO. ${num(unidadesTotal.otroCliente)} pares servicio×unidad son de unidades que ese\n  día acreditaron a otro cliente. El conteo se puede dar; la identidad no.`,
    );
    veredicto(
      `2 · «a qué hora ocurrieron»`,
      `CABE. Una hora de llegada a la geocerca del propio cliente es evidencia de\n  su servicio. No identifica unidad — pero N horas distintas dicen que hubo N\n  unidades, así que su exposición es la del bloque 1, no una nueva.`,
    );
    veredicto(
      `3 · «por qué no se pudo acreditar ninguna»`,
      `CABE por confidencialidad — Y HOY DIRÍA UNA FALSEDAD, que es peor.\n` +
        `  La familia de la causa no nombra unidad ni puntaje, así que no roza la Ley 3.\n` +
        `  Pero el único motivo GUARDADO es una tautología (${pct(motivos.get("ninguna_unidad_coincidio_ruta") ?? 0, N)}), y la familia\n` +
        `  derivada de lo sellado **se equivoca de causa en ${num(peroFueObservacion)} de ${num(selladaDiceConducta)} (${pct(peroFueObservacion, selladaDiceConducta)})**:\n` +
        `  dice conducta del transportista donde hubo fallo de OBSERVACIÓN (C25).\n` +
        `  El bloqueo NO es la Ley 3 — es que el dato honesto no existe. Es la Parte 2.`,
    );
    veredicto(
      `4 · «el trazo real»`,
      servTrazoDeOtroCliente === 0
        ? `NO CABE IGUAL. Aunque hoy ninguna traza sería de otro cliente, un trazo es el\n  recorrido de una unidad, y el recorrido ES la ruta que servía.`
        : `NO CABE. En ${num(servTrazoDeOtroCliente)} servicios (${pct(servTrazoDeOtroCliente, N)}) alguna traza a dibujar es de una\n  unidad que ese día servía a OTRO CLIENTE: dibujarla enseña la ruta de un\n  tercero en el mapa de éste. No es revelar flota — es peor.`,
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
