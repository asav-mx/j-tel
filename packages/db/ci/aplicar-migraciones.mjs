/**
 * Construye una base desde cero con las migraciones del repo. SOLO para la
 * base desechable de CI.
 *
 * No usa `pnpm db:migrate` a propósito, y por la misma razón que
 * `docs/Procedimiento-Migraciones.md`: el migrador de Drizzle envuelve cada
 * archivo en una transacción, y `0014` lleva `CREATE INDEX CONCURRENTLY`, que
 * no puede ir dentro de una. Aquí se ejecuta sentencia por sentencia, fuera de
 * transacción, igual que se aplican a mano contra producción.
 *
 * Que CI use el mismo camino que la mano importa: una puerta que verifica algo
 * distinto de lo que se hace en serio no verifica nada.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DIR = path.join(import.meta.dirname, "..", "drizzle");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

await sql.unsafe('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

const archivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (archivos.length === 0) {
  console.error("No hay migraciones en", DIR);
  process.exit(1);
}

let total = 0;
for (const archivo of archivos) {
  const contenido = readFileSync(path.join(DIR, archivo), "utf8");
  const sentencias = contenido
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)+$/.test(s));

  for (const sentencia of sentencias) {
    try {
      await sql.unsafe(sentencia);
      total += 1;
    } catch (e) {
      console.error(`\n✗ ${archivo}\n${sentencia.slice(0, 300)}\n\n${e.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${archivo} (${sentencias.length} sentencias)`);
}

console.log(`\n${archivos.length} migraciones, ${total} sentencias aplicadas.`);
await sql.end();
