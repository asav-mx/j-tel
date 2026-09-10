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

/*
 * Las marchas atrás NO son migraciones, y hasta hoy se aplicaban.
 *
 * Este guion tomaba todo `.sql` de la carpeta en orden de nombre, y
 * `0034_credenciales_gps.reversa.sql` ordena ANTES que
 * `0034_credenciales_gps.sql` —punto, `r` antes que `s`—. O sea cada marcha
 * atrás corría justo antes de la migración que deshace.
 *
 * **Nunca rompió por suerte, no por diseño.** Todas las reversas escritas hasta
 * ahora son `DROP ... IF EXISTS` o `DROP COLUMN IF EXISTS`, así que correrlas
 * contra una base donde su migración todavía no pasó es un no-op: Postgres
 * avisa «skipping» y sigue. Los NOTICE estaban en el registro de cada corrida
 * y nadie tenía por qué leerlos.
 *
 * La primera reversa que no es un DROP lo destapó: la 0034 renombra, y
 * `ALTER TABLE ... RENAME COLUMN` **no tiene forma `IF EXISTS` en Postgres**.
 * Falló con `column "gps_user_id" does not exist`, que es correcto — a esas
 * alturas la columna todavía se llamaba como antes.
 *
 * El arreglo no es ponerle una guarda a la reversa. Una marcha atrás con
 * `IF EXISTS` es peor que una sin él: corrida en el estado equivocado no hace
 * nada y **se ve igual que una que funcionó**. El arreglo es que este guion
 * construya la base con las migraciones y con nada más, que es lo que su propio
 * encabezado dice que hace.
 */
const archivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql") && !f.endsWith(".reversa.sql"))
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
