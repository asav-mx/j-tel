/**
 * Corrige el deadline y la ventana de las ocurrencias que todavía no tienen
 * veredicto, recomputándolos con la zona del contrato.
 *
 * Existe por el bug del 2026-07-28: `computeExpectedDeadline` construía la
 * fecha sin marca de zona, así que se resolvía en la zona del proceso. Las
 * ocurrencias generadas por el cron de Vercel (UTC) quedaron seis horas
 * corridas; las generadas desde una máquina en Juárez, bien.
 *
 * SIMULACRO POR OMISIÓN. Sin `--aplicar` no escribe nada: imprime el plan y
 * sale. Es la misma disciplina que evitó re-juzgar 15 pendientes que habrían
 * pasado a acusación irreversible.
 *
 *   pnpm --filter @jtel/db corregir-deadlines              # simulacro
 *   pnpm --filter @jtel/db corregir-deadlines --sql        # imprime el SQL
 *   pnpm --filter @jtel/db corregir-deadlines --aplicar    # escribe
 *   pnpm --filter @jtel/db corregir-deadlines --aplicar --con-deriva
 *
 * `--sql` existe porque quien tiene permiso de escritura trabaja desde la
 * consola de Neon, no desde una terminal. El SQL lleva las mismas guardas
 * dentro del WHERE y queda además como registro exacto de qué se cambió.
 *
 * Se corrige EN SITIO. Borrar y recrear arrastraría el viaje en cascada sin
 * ninguna necesidad: el índice único es `(service_profile_id, service_date)`,
 * que no cambia, y `expected_deadline` no participa en ninguna restricción.
 */

import { and, eq, gt, sql } from "drizzle-orm";
import { computeEvidenceWindow, JTTEL_TZ, type ContractPolicy } from "@jtel/domain";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import type { Database } from "./index.js";
import { clasificarDiferencia, type CausaDeDiferencia } from "./deadline-diff.js";
import { serviceOccurrences, complianceFacts, trips } from "./schema/index.js";

export type Fila = {
  occurrenceId: string;
  contrato: string;
  serviceDate: string;
  guardado: Date;
  correcto: Date;
  causa: CausaDeDiferencia;
  difMinutos: number;
  tripId: string | null;
  ventana: { inicio: Date; fin: Date } | null;
  bloqueo: string | null;
};

async function planear(db: Database): Promise<Fila[]> {
  const filas = await db.execute(sql`
    SELECT o.id, o.service_date::text AS service_date, o.expected_deadline,
           ct.name AS contrato, ct.policy AS policy, sh.start_time::text AS start_time,
           t.id AS trip_id, t.evidence_status,
           f.id AS fact_id,
           (SELECT count(*)::int FROM evidence_points ep WHERE ep.trip_id = t.id) AS eps
      FROM service_occurrences o
      JOIN service_profiles p ON p.id = o.service_profile_id
      JOIN service_contracts ct ON ct.id = p.contract_id
      JOIN route_shifts rs ON rs.id = p.route_shift_id
      JOIN shifts sh ON sh.id = rs.shift_id
      LEFT JOIN trips t ON t.service_occurrence_id = o.id
      LEFT JOIN compliance_facts f ON f.service_occurrence_id = o.id
     WHERE o.expected_deadline > now()
     ORDER BY ct.name, o.expected_deadline
  `);

  const plan: Fila[] = [];
  for (const r of filas as unknown as Array<Record<string, unknown>>) {
    const policy = (r.policy ?? {}) as Partial<ContractPolicy>;
    const guardado = new Date(r.expected_deadline as string);
    const { causa, correcto, difMinutos } = clasificarDiferencia({
      serviceDate: String(r.service_date),
      guardado,
      shiftStartTime: String(r.start_time),
      anticipationMinutes: policy.arrivalAnticipationMinutes ?? 15,
      timeZone: policy.timeZone ?? JTTEL_TZ,
    });
    if (causa === "ninguna") continue;

    // Las tres condiciones que hacen segura la corrección. Si alguna falla, la
    // fila se reporta con su bloqueo y NO se toca.
    let bloqueo: string | null = null;
    if (r.fact_id) bloqueo = "ya tiene hecho sellado";
    else if (!r.trip_id) bloqueo = "no tiene viaje";
    else if (Number(r.eps ?? 0) > 0) bloqueo = `tiene ${r.eps} puntos de evidencia anclados`;
    else if (r.evidence_status !== "en_espera") bloqueo = `viaje en '${r.evidence_status}'`;

    const { windowStart, windowEnd } = computeEvidenceWindow(correcto, {
      evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
      verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
      evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
    });

    plan.push({
      occurrenceId: String(r.id),
      contrato: String(r.contrato),
      serviceDate: String(r.service_date),
      guardado,
      correcto,
      causa,
      difMinutos,
      tripId: r.trip_id ? String(r.trip_id) : null,
      ventana: { inicio: windowStart, fin: windowEnd },
      bloqueo,
    });
  }
  return plan;
}

function resumir(plan: Fila[], conDeriva: boolean) {
  const grupos = new Map<string, { n: number; difs: Set<number> }>();
  for (const f of plan) {
    const k = `${f.contrato}|${f.causa}`;
    const g = grupos.get(k) ?? { n: 0, difs: new Set<number>() };
    g.n++;
    g.difs.add(f.difMinutos);
    grupos.set(k, g);
  }
  console.log("\n  contrato                              causa    n     corrimiento");
  console.log("  " + "-".repeat(74));
  for (const [k, g] of [...grupos].sort()) {
    const [c, causa] = k.split("|");
    console.log(
      `  ${c!.slice(0, 36).padEnd(38)}${causa!.padEnd(9)}${String(g.n).padStart(4)}     ${[...g.difs].sort((a, b) => a - b).join(" / ")} min`,
    );
  }
  console.log("  " + "-".repeat(74));

  const bloqueadas = plan.filter((f) => f.bloqueo);
  const zona = plan.filter((f) => f.causa === "zona" && !f.bloqueo);
  const deriva = plan.filter((f) => f.causa === "deriva" && !f.bloqueo);
  console.log(`\n  a corregir por ZONA:    ${zona.length}`);
  console.log(
    `  a corregir por DERIVA:  ${deriva.length}   ${conDeriva ? "(incluidas)" : "(NO se tocan — falta --con-deriva)"}`,
  );
  if (bloqueadas.length) {
    console.log(`\n  BLOQUEADAS, no se tocan: ${bloqueadas.length}`);
    const porQue = new Map<string, number>();
    for (const f of bloqueadas) porQue.set(f.bloqueo!, (porQue.get(f.bloqueo!) ?? 0) + 1);
    for (const [b, n] of porQue) console.log(`    ${n} — ${b}`);
  } else {
    console.log(`\n  bloqueadas: ninguna`);
  }
  return { zona, deriva };
}

/** Literal timestamptz para SQL, siempre en UTC y sin ambigüedad de zona. */
function ts(d: Date): string {
  return `'${d.toISOString()}'::timestamptz`;
}

/**
 * Imprime el SQL de la corrección en vez de ejecutarla.
 *
 * Existe porque quien tiene permiso de escritura sobre la base trabaja desde
 * la consola de Neon, no desde una terminal con el proyecto instalado. El SQL
 * lleva las MISMAS guardas que el camino programático, dentro del `WHERE`: no
 * basta con que el plan fuera seguro cuando se calculó, tiene que seguir
 * siéndolo cuando alguien lo pegue y lo corra.
 *
 * Va dentro de una transacción y termina con una verificación antes del
 * COMMIT, para que se pueda abortar si los números no cuadran.
 */
export function generarSql(filas: Fila[], conDeriva: boolean): string {
  if (filas.length === 0) return "-- No hay nada que corregir.";
  const porCausa = new Map<string, number>();
  for (const f of filas) porCausa.set(f.causa, (porCausa.get(f.causa) ?? 0) + 1);

  const L: string[] = [];
  L.push("-- ═══════════════════════════════════════════════════════════════════");
  L.push("-- Corrección de deadlines — generada por @jtel/db corregir-deadlines");
  L.push(`-- Ocurrencias a corregir: ${filas.length}`);
  for (const [c, n] of porCausa) L.push(`--   ${c}: ${n}`);
  L.push(`--   deriva incluida: ${conDeriva ? "sí" : "no"}`);
  L.push("--");
  L.push("-- Las guardas viajan DENTRO del WHERE: si una ocurrencia se selló");
  L.push("-- entre que se generó este SQL y que se corre, no se toca.");
  L.push("-- Revisa los conteos de la verificación ANTES de hacer COMMIT.");
  L.push("-- ═══════════════════════════════════════════════════════════════════");
  L.push("");
  L.push("BEGIN;");
  L.push("");

  L.push("-- 1 · Deadline de las ocurrencias");
  L.push("WITH nuevos(id, deadline) AS (VALUES");
  L.push(
    filas.map((f) => `  ('${f.occurrenceId}'::uuid, ${ts(f.correcto)})`).join(",\n"),
  );
  L.push("), aplicado AS (");
  L.push("  UPDATE service_occurrences o");
  L.push("     SET expected_deadline = n.deadline");
  L.push("    FROM nuevos n");
  L.push("   WHERE o.id = n.id");
  L.push("     AND o.expected_deadline > now()");
  L.push("     AND NOT EXISTS (");
  L.push("       SELECT 1 FROM compliance_facts cf WHERE cf.service_occurrence_id = o.id)");
  L.push("  RETURNING o.id");
  L.push(")");
  L.push("SELECT count(*) AS ocurrencias_corregidas FROM aplicado;");
  L.push("");

  const conViaje = filas.filter((f) => f.tripId && f.ventana);
  if (conViaje.length === 0) {
    // Sin viajes no se emite el bloque: un VALUES vacío es SQL inválido, y
    // esto se pega a mano en una consola.
    L.push("-- 2 · Ventana de evidencia: ninguna de estas ocurrencias tiene viaje.");
    L.push("");
  } else {
  L.push("-- 2 · Ventana de evidencia de los viajes");
  L.push("WITH nuevas(id, inicio, fin) AS (VALUES");
  L.push(
    conViaje
      .map((f) => `  ('${f.tripId}'::uuid, ${ts(f.ventana!.inicio)}, ${ts(f.ventana!.fin)})`)
      .join(",\n"),
  );
  L.push("), aplicado AS (");
  L.push("  UPDATE trips t");
  L.push("     SET evidence_window_start = n.inicio, evidence_window_end = n.fin");
  L.push("    FROM nuevas n");
  L.push("   WHERE t.id = n.id");
  L.push("     AND t.evidence_status = 'en_espera'");
  L.push("     AND NOT EXISTS (SELECT 1 FROM evidence_points ep WHERE ep.trip_id = t.id)");
  L.push("     AND NOT EXISTS (");
  L.push("       SELECT 1 FROM compliance_facts cf");
  L.push("        WHERE cf.service_occurrence_id = t.service_occurrence_id)");
  L.push("  RETURNING t.id");
  L.push(")");
  L.push("SELECT count(*) AS viajes_corregidos FROM aplicado;");
  L.push("");
  }

  L.push("-- 3 · Verificación: deadline y ventana tienen que quedar coherentes.");
  L.push("--     'descuadradas' debe ser 0. Si no lo es, ROLLBACK.");
  L.push("SELECT count(*) AS descuadradas");
  L.push("  FROM service_occurrences o");
  L.push("  JOIN trips t ON t.service_occurrence_id = o.id");
  L.push(`  JOIN (VALUES\n${filas.map((f) => `    ('${f.occurrenceId}'::uuid, ${ts(f.correcto)})`).join(",\n")}\n  ) AS n(id, deadline) ON n.id = o.id`);
  L.push(" WHERE o.expected_deadline IS DISTINCT FROM n.deadline;");
  L.push("");
  L.push("-- Si los tres números cuadran:");
  L.push("COMMIT;");
  L.push("-- Si no:");
  L.push("-- ROLLBACK;");
  L.push("");
  return L.join("\n");
}

export async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const conDeriva = process.argv.includes("--con-deriva");
  const soloSql = process.argv.includes("--sql");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  // Cliente propio en vez de createDb: hay que poder cerrarlo. Con
  // `--sql` la salida son miles de líneas, y `process.exit()` sobre una
  // tubería las corta a medias — un SQL truncado y sin COMMIT.
  const cliente = postgres(url, { max: 1 });
  const db = drizzle(cliente, { schema }) as unknown as Database;
  try {
    await correr(db, { aplicar, conDeriva, soloSql });
  } finally {
    await cliente.end();
  }
}

async function correr(
  db: Database,
  { aplicar, conDeriva, soloSql }: { aplicar: boolean; conDeriva: boolean; soloSql: boolean },
) {
  const plan = await planear(db);

  console.log(`\n${"=".repeat(76)}`);
  const modo = soloSql
    ? "SQL PARA LA CONSOLA (no escribe nada)"
    : aplicar
      ? "APLICANDO"
      : "SIMULACRO (no escribe nada)";
  console.log(`  CORRECCIÓN DE DEADLINES — ${modo}`);
  console.log(`${"=".repeat(76)}`);
  const { zona, deriva } = resumir(plan, conDeriva);

  const aTocar = conDeriva ? [...zona, ...deriva] : zona;

  if (soloSql) {
    console.log(`\n  (el SQL sale abajo; nada se escribe desde aquí)\n`);
    console.log(generarSql(aTocar, conDeriva));
    return;
  }

  console.log(`\n  === ejemplo del cambio ===`);
  for (const f of aTocar.slice(0, 3)) {
    console.log(`  ${f.contrato.slice(0, 32)} · ${f.serviceDate} · ${f.causa} (${f.difMinutos > 0 ? "+" : ""}${f.difMinutos} min)`);
    console.log(
      `     deadline ${f.guardado.toISOString().slice(0, 16).replace("T", " ")} → ${f.correcto.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    );
    console.log(
      `     ventana  ${f.ventana!.inicio.toISOString().slice(11, 16)} → ${f.ventana!.fin.toISOString().slice(11, 16)} UTC`,
    );
  }

  if (!aplicar) {
    console.log(`\n  SIMULACRO. No se escribió nada. Agrega --aplicar para ejecutar.\n`);
    return;
  }

  let occ = 0;
  let via = 0;
  for (const f of aTocar) {
    // Cinturón: la condición de seguridad se revalida DENTRO del update, así
    // que una ocurrencia que se selló entre el plan y la escritura no se toca.
    const r1 = await db
      .update(serviceOccurrences)
      .set({ expectedDeadline: f.correcto })
      .where(
        and(
          eq(serviceOccurrences.id, f.occurrenceId),
          gt(serviceOccurrences.expectedDeadline, new Date()),
          sql`not exists (select 1 from ${complianceFacts} cf where cf.service_occurrence_id = ${serviceOccurrences.id})`,
        ),
      )
      .returning({ id: serviceOccurrences.id });
    if (r1.length === 0) continue;
    occ++;

    if (f.tripId) {
      const r2 = await db
        .update(trips)
        .set({ evidenceWindowStart: f.ventana!.inicio, evidenceWindowEnd: f.ventana!.fin })
        .where(and(eq(trips.id, f.tripId), eq(trips.evidenceStatus, "en_espera")))
        .returning({ id: trips.id });
      via += r2.length;
    }
  }
  console.log(`\n  ocurrencias corregidas: ${occ}`);
  console.log(`  viajes corregidos:      ${via}\n`);
}

// Solo corre si se invoca directamente, no al importarlo desde una prueba.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}

