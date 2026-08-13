/**
 * Re-dimensiona la ventana de evidencia de las ocurrencias que todavía no se
 * han juzgado — la mitad que el Frente A dejó explícitamente en manos de Asav.
 *
 * El detector (`ventanas-desalineadas.ts`) avisa y no corrige, y eso sigue
 * siendo cierto: **esto no corre solo ni lo llama ningún cron.** Es una
 * herramienta que se dispara a mano, una vez, sobre una decisión tomada.
 *
 *   pnpm --filter @jtel/db corregir-ventanas                    # simulacro
 *   pnpm --silent --filter @jtel/db corregir-ventanas --sql > v.sql
 *   pnpm --silent --filter @jtel/db corregir-ventanas --sql --solo-ensanchan > v.sql
 *
 * **`--silent` no es opcional al redirigir.** Sin él, pnpm escribe su propio
 * encabezado —`> @jtel/db@0.0.1 corregir-ventanas …`— en stdout, queda como
 * segunda línea del archivo y Postgres muere con `syntax error at or near ">"`.
 * Se descubrió pegando el archivo en la base desechable, que es exactamente
 * para lo que existe pegarlo ahí primero.
 *
 * ## No tiene `--aplicar`, y es a propósito
 *
 * Su hermano `corregir-deadlines` sí lo tiene, y aquí se quitó: quien tiene
 * permiso de escritura sobre producción trabaja desde la consola de Neon, y
 * dejar un camino de escritura en un binario local que se corre con la
 * `DATABASE_URL` que haya en el ambiente es una palanca esperando un dedo. El
 * SQL lleva las mismas guardas dentro del `WHERE`, va en transacción y termina
 * en una verificación antes del COMMIT.
 *
 * ## La guarda que decide si esto arregla o rompe
 *
 * **Ensanchar la ventana de un viaje que ya tiene puntos anclados empeora su
 * cobertura.** La cobertura se mide sobre la ventana: si la ventana abre 35
 * minutos antes y esos 35 minutos están vacíos —porque la ingesta nunca ancló
 * nada ahí—, el mismo viaje pasa a medirse contra más tiempo con los mismos
 * puntos. Corregir sin mirar esto fabricaría exactamente las acusaciones falsas
 * que la corrección existe para evitar.
 *
 * Por eso la ventana solo se mueve donde **no hay nada anclado todavía**. Lo
 * que ya tiene puntos se reporta con su bloqueo y no se toca — y decir cuántas
 * quedaron fuera es parte del resultado, no una nota al pie: un corrector que
 * calla lo que no pudo tocar se lee como si hubiera tocado todo.
 */

import { existsSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import type { Database } from "./index.js";
import { createRepositories } from "./repositories/index.js";
import {
  agruparPorRutaTurno,
  revisarVentanas,
  type VentanaDesalineada,
} from "./ventanas-desalineadas.js";

export type FilaDeVentana = VentanaDesalineada & {
  tripId: string | null;
  /** `null` = no se puede tocar, con el motivo escrito. */
  bloqueo: string | null;
};

export type PlanDeVentanas = {
  /** Cuántas ocurrencias sin sellar se examinaron. Un cero aquí es lectura rota. */
  revisadas: number;
  filas: FilaDeVentana[];
};

/**
 * Cruza lo que el detector midió con el estado del viaje.
 *
 * La detección **no se reimplementa**: se llama a `revisarVentanas` tal cual, la
 * misma que usa el cron. Así el corrector no puede derivar una ventana distinta
 * de la que se avisó por correo.
 */
export async function planear(db: Database): Promise<PlanDeVentanas> {
  const repos = createRepositories(db);
  const { revisadas, desalineadas } = await revisarVentanas(repos);

  const estados = await repos.occurrences.estadoDeViajeDeOcurrencias(
    desalineadas.map((d) => d.ocurrenciaId),
  );
  const porOcurrencia = new Map(estados.map((e) => [e.occurrenceId, e]));

  const filas = desalineadas.map((d): FilaDeVentana => {
    const e = porOcurrencia.get(d.ocurrenciaId);
    let bloqueo: string | null = null;
    if (!e) bloqueo = "no tiene viaje";
    else if (e.puntos > 0) bloqueo = "tiene puntos de evidencia anclados";
    else if (e.evidenceStatus !== "en_espera") bloqueo = `viaje en '${e.evidenceStatus}'`;
    return { ...d, tripId: e?.tripId ?? null, bloqueo };
  });

  return { revisadas, filas };
}

/** Literal timestamptz para SQL, siempre en UTC y sin ambigüedad de zona. */
function ts(d: Date): string {
  return `'${d.toISOString()}'::timestamptz`;
}

/**
 * El SQL de la corrección, para pegarse en la consola de Neon.
 *
 * Las guardas viajan DENTRO del `WHERE` y no solo en el plan: entre que esto se
 * genera y que alguien lo pega, una ocurrencia puede sellarse o recibir su
 * primer punto. No basta con que el plan fuera seguro cuando se calculó.
 */
export function generarSql(
  filas: FilaDeVentana[],
  { soloEnsanchan = false }: { soloEnsanchan?: boolean } = {},
): string {
  const aTocar = filas
    .filter((f) => !f.bloqueo && f.tripId)
    .filter((f) => !soloEnsanchan || f.difMinutos > 0);
  if (aTocar.length === 0) return "-- No hay ninguna ventana que se pueda mover.";

  const L: string[] = [];
  L.push("-- ═══════════════════════════════════════════════════════════════════");
  L.push("-- Re-dimensionado de ventanas — @jtel/db corregir-ventanas");
  L.push(`-- Viajes a mover: ${aTocar.length}`);
  L.push(`-- Bloqueados, NO se tocan: ${filas.filter((f) => f.bloqueo).length}`);
  if (soloEnsanchan) {
    const fuera = filas.filter((f) => !f.bloqueo && f.tripId && f.difMinutos < 0).length;
    L.push(`-- --solo-ensanchan: ${fuera} que se ANGOSTARÍAN quedaron fuera a propósito.`);
  }
  L.push("--");
  L.push("-- Las guardas viajan DENTRO del WHERE. En particular la de los puntos");
  L.push("-- anclados: ensanchar una ventana con puntos dentro empeora su");
  L.push("-- cobertura, porque se mide más tiempo contra la misma evidencia.");
  L.push("-- Revisa los conteos de la verificación ANTES de hacer COMMIT.");
  L.push("-- ═══════════════════════════════════════════════════════════════════");
  L.push("");
  L.push("BEGIN;");
  L.push("");
  L.push("-- 1 · La ventana de los viajes sin sellar y sin puntos");
  L.push("WITH nuevas(id, inicio, fin) AS (VALUES");
  L.push(
    aTocar
      .map((f) => `  ('${f.tripId}'::uuid, ${ts(f.ventanaHoy.inicio)}, ${ts(f.ventanaHoy.fin)})`)
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
  L.push(`SELECT count(*) AS viajes_movidos FROM aplicado;  -- se esperan ${aTocar.length}`);
  L.push("");
  L.push("-- 2 · Verificación. Los TRES números, no solo el de los errores:");
  L.push(`--     encontrados  = ${aTocar.length}   (si es 0, la lista no casó con nada)`);
  L.push(`--     con_la_nueva = ${aTocar.length}`);
  L.push("--     sin_mover    = 0");
  L.push("--");
  L.push("--     'sin_mover = 0' por sí solo NO prueba nada: da 0 igual si todos");
  L.push("--     se movieron que si el JOIN no encontró ni un viaje. Es el mismo");
  L.push("--     cero ciego que el cron contesta con 503 en vez de «todo bien».");
  L.push("SELECT count(*) AS encontrados,");
  L.push("       count(*) FILTER (WHERE t.evidence_window_start = n.inicio) AS con_la_nueva,");
  L.push(
    "       count(*) FILTER (WHERE t.evidence_window_start IS DISTINCT FROM n.inicio) AS sin_mover",
  );
  L.push("  FROM trips t");
  L.push(
    `  JOIN (VALUES\n${aTocar.map((f) => `    ('${f.tripId}'::uuid, ${ts(f.ventanaHoy.inicio)})`).join(",\n")}\n  ) AS n(id, inicio) ON n.id = t.id;`,
  );
  L.push("");
  L.push("-- Si los tres números cuadran:");
  L.push("COMMIT;");
  L.push("-- Si no:");
  L.push("-- ROLLBACK;");
  L.push("");
  return L.join("\n");
}

/** Bajo `--sql`, stdout es del SQL y de nadie más. */
let narrar: (linea?: string) => void = (l = "") => console.log(l);

export function resumir(plan: PlanDeVentanas): void {
  const { revisadas, filas } = plan;
  const mueve = filas.filter((f) => !f.bloqueo && f.tripId);
  const bloqueadas = filas.filter((f) => f.bloqueo);

  narrar(`\n${"=".repeat(78)}`);
  narrar("  RE-DIMENSIONADO DE VENTANAS — SIMULACRO (no escribe nada)");
  narrar(`${"=".repeat(78)}`);
  narrar(`\n  ocurrencias sin sellar revisadas: ${revisadas}`);
  narrar(`  con la ventana desalineada:      ${filas.length}`);
  narrar(`  SE PUEDEN MOVER:                 ${mueve.length}`);
  narrar(`  bloqueadas:                      ${bloqueadas.length}`);

  if (bloqueadas.length) {
    const porQue = new Map<string, number>();
    for (const f of bloqueadas) porQue.set(f.bloqueo!, (porQue.get(f.bloqueo!) ?? 0) + 1);
    for (const [b, n] of [...porQue].sort((a, b) => b[1] - a[1])) {
      narrar(`    ${String(n).padStart(4)} — ${b}`);
    }
  }

  /*
   * Ensanchar y angostar se cuentan por separado, y NO se suman.
   *
   * Ensanchar hace que el árbitro mire MÁS recorrido; angostar hace que mire
   * MENOS, y mirar menos es la mecánica exacta de las acusaciones que este
   * frente existe para cerrar. Un solo total de «843 corregidas» escondería que
   * unas cuantas van en la dirección contraria a la razón por la que se decidió
   * corregir.
   */
  const ensanchan = mueve.filter((f) => f.difMinutos > 0);
  const angostan = mueve.filter((f) => f.difMinutos < 0);
  narrar(`\n  de las que se pueden mover:`);
  narrar(`    se ENSANCHAN (el árbitro mira más): ${ensanchan.length}`);
  narrar(`    se ANGOSTAN  (el árbitro mira menos): ${angostan.length}`);

  /*
   * Se agrupa con `agruparPorRutaTurno`, la misma del aviso, y no con una
   * agrupación propia. La primera versión de esto tenía su propio `Map` que
   * guardaba la congelada del PRIMER servicio y la presentaba como la del
   * grupo: decía «2 grupos se angostan» mientras el conteo por servicio decía
   * 106. Dos agrupaciones son dos oportunidades de que una mienta.
   */
  narrar(`\n  ruta                          turno        n    congelada → hoy       base`);
  narrar("  " + "-".repeat(88));
  for (const g of agruparPorRutaTurno(mueve)) {
    const cong =
      g.congeladaMin === g.congeladaMax
        ? `${g.congeladaMin}`
        : `${g.congeladaMin}–${g.congeladaMax}`;
    const dir = g.angostan === 0 ? "" : g.ensanchan === 0 ? "  ANGOSTA" : `  ${g.angostan} angostan`;
    narrar(
      `  ${g.rutaNombre.slice(0, 28).padEnd(30)}${g.turnoNombre.slice(0, 11).padEnd(13)}${String(g.ocurrencias).padStart(3)}    ${cong.padStart(7)} → ${String(g.derivadaMinutos).padStart(3)} min  ${g.baseHoy}${dir}`,
    );
  }
  narrar("  " + "-".repeat(88));

  narrar(`\n  === ejemplo del cambio ===`);
  for (const f of mueve.slice(0, 3)) {
    narrar(`  ${f.rutaNombre} · ${f.turnoNombre} · ${f.serviceDate}`);
    narrar(
      `     ventana ${f.ventanaHoy.inicio.toISOString().slice(0, 16).replace("T", " ")} → ${f.ventanaHoy.fin.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    );
  }
  narrar(`\n  SIMULACRO. No se escribió nada. Con --sql sale el SQL para la consola.\n`);
}

export async function main() {
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
  const soloSql = process.argv.includes("--sql");
  /*
   * Deja fuera las que se ANGOSTARÍAN. Existe porque las dos direcciones no son
   * el mismo acto: ensanchar hace que el árbitro mire más recorrido; angostar,
   * que mire menos — y mirar menos es la mecánica de las acusaciones que no se
   * sostienen. Cuál de las dos se aplica es decisión de Asav, y esta bandera
   * hace que las dos sean un comando, no un cambio de código.
   */
  const soloEnsanchan = process.argv.includes("--solo-ensanchan");
  /*
   * Lee por la conexión de solo lectura si existe. Este instrumento no escribe
   * nunca, y pedir la de escritura para leer es dejar puesta una llave que no
   * se necesita.
   */
  const url = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY (o DATABASE_URL)");

  const cliente = postgres(url, { max: 1 });
  const db = drizzle(cliente, { schema }) as unknown as Database;
  try {
    if (soloSql) narrar = (l = "") => console.error(l);
    const plan = await planear(db);
    resumir(plan);
    if (soloSql) {
      narrar("  (el SQL va a stdout; este resumen va a stderr)\n");
      console.log(generarSql(plan.filas, { soloEnsanchan }));
    }
  } finally {
    await cliente.end();
  }
}

// Solo corre si se invoca directamente, no al importarlo desde una prueba
// (regla 23): un módulo que corre `main()` al importarse leyó producción desde
// una prueba, y en CI falló por no tener con qué.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
