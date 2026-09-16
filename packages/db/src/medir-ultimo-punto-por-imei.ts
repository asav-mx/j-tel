/**
 * ¿Cuánto cuesta «la última señal archivada» de los dispositivos, y la forma
 * nueva devuelve lo mismo que la vieja?
 *
 * SOLO LECTURA. Existe por un caso con fecha: el 16 de septiembre de 2026 Flota
 * en vivo tardaba segundos en cargar, y la causa era `ultimoPuntoPorImei`
 * barriendo `telemetry_points` completa (ver `ultimo-punto-por-imei.ts`). C2 del
 * cuarto de Compás usa la misma consulta, así que esto se corre antes de
 * construir encima de ella y cada vez que alguien la toque.
 *
 * Corre las dos formas sobre los IMEIs de `devices` y reporta, para cada una,
 * el tiempo real (`EXPLAIN ANALYZE`), cuántas filas leyó y si usó el índice.
 * Después compara las respuestas IMEI por IMEI. **Una forma más rápida que
 * contesta distinto no es un arreglo**: si difieren, el guion sale con error.
 *
 * La forma vieja está copiada aquí a propósito, como referencia fija; la nueva
 * se importa del mismo archivo que usa el repositorio.
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 *
 *   pnpm --filter @jtel/db medir-ultimo-punto-por-imei
 */
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { consultaUltimoPuntoPorImei } from "./ultimo-punto-por-imei.js";

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

type Plan = { ms: number; filasLeidas: number; usaIndice: boolean; texto: string[] };

function leerPlan(filas: { "QUERY PLAN": string }[]): Plan {
  const texto = filas.map((f) => f["QUERY PLAN"]);
  const ms = Number(/Execution Time: ([\d.]+) ms/.exec(texto.join("\n"))?.[1] ?? NaN);
  // Filas leídas de la tabla: suma de `rows=N loops=M` de los nodos que tocan
  // telemetry_points (Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan).
  let filasLeidas = 0;
  for (let i = 0; i < texto.length; i++) {
    const linea = texto[i]!;
    if (!/on telemetry_points/.test(linea)) continue;
    const m = /actual time=[\d.]+\.\.[\d.]+ rows=(\d+) loops=(\d+)/.exec(linea);
    if (m) filasLeidas += Number(m[1]) * Number(m[2]);
    // Lo que el filtro descartó también se leyó.
    const quitadas = /Rows Removed by Filter: (\d+)/.exec(texto[i + 1] ?? "");
    if (quitadas) filasLeidas += Number(quitadas[1]);
  }
  const usaIndice = texto.some((l) => /Index (Only )?Scan.*telemetry_points_imei_recorded_idx/.test(l));
  return { ms, filasLeidas, usaIndice, texto };
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Sin ella esta lectura correría con el usuario dueño.",
    );
  }
  const cliente = postgres(url, { max: 1 });
  const db = drizzle(cliente);

  try {
    const [{ total }] = await cliente<{ total: string }[]>`
      SELECT count(*)::text AS total FROM telemetry_points`;
    const imeis = (await cliente<{ imei: string }[]>`SELECT DISTINCT imei FROM devices ORDER BY imei`).map(
      (f) => f.imei,
    );
    console.log(`telemetry_points: ${Number(total).toLocaleString("es-MX")} filas`);
    console.log(`IMEIs en devices: ${imeis.length}\n`);
    if (imeis.length === 0) return;

    const lista = sql.join(
      imeis.map((i) => sql`${i}`),
      sql`, `,
    );
    const vieja = sql`
      SELECT imei, max(recorded_at) AS ultimo
        FROM telemetry_points
       WHERE imei IN (${lista})
       GROUP BY imei`;
    const nueva = consultaUltimoPuntoPorImei(imeis);

    const planes: Record<string, Plan> = {};
    for (const [nombre, consulta] of [["vieja", vieja], ["nueva", nueva]] as const) {
      // Una corrida de calentamiento para no comparar caché fría contra caliente.
      await db.execute(consulta);
      const filas = await db.execute<{ "QUERY PLAN": string }>(
        sql`EXPLAIN (ANALYZE, BUFFERS) ${consulta}`,
      );
      planes[nombre] = leerPlan([...filas]);
    }

    for (const [nombre, p] of Object.entries(planes)) {
      console.log(
        `${nombre.padEnd(6)} ${p.ms.toFixed(1).padStart(9)} ms · ` +
          `${p.filasLeidas.toLocaleString("es-MX").padStart(11)} filas leídas · ` +
          `índice (imei, recorded_at): ${p.usaIndice ? "sí" : "NO"}`,
      );
    }
    if (process.argv.includes("--planes")) {
      for (const [nombre, p] of Object.entries(planes)) {
        console.log(`\n── plan ${nombre} ──\n${p.texto.join("\n")}`);
      }
    }

    const aMapa = (filas: Iterable<{ imei: string; ultimo: Date | string }>) =>
      new Map([...filas].map((f) => [f.imei, new Date(f.ultimo).toISOString()]));
    const rv = aMapa(await db.execute<{ imei: string; ultimo: Date | string }>(vieja));
    const rn = aMapa(await db.execute<{ imei: string; ultimo: Date | string }>(nueva));
    const distintos = imeis.filter((i) => rv.get(i) !== rn.get(i));
    console.log(
      `\nIMEIs con historia: ${rv.size} (vieja) · ${rn.size} (nueva) · respuestas distintas: ${distintos.length}`,
    );
    if (distintos.length > 0) {
      for (const i of distintos) console.log(`  ${i}: vieja ${rv.get(i)} · nueva ${rn.get(i)}`);
      process.exitCode = 1;
    }
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
