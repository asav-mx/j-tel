/**
 * ⛔ SOLO PARA BASES LOCALES O DESECHABLES. Nunca contra producción.
 *
 * Producción no tiene la tabla de bitácora del migrador: nunca ha corrido ahí.
 * Este script vería una base virgen e intentaría aplicar las migraciones desde
 * la 0000 contra una base con 37 tablas y 846 hechos sellados — revienta en la
 * primera y deja su bitácora a medio escribir.
 *
 * Además envuelve cada migración en una transacción (`session.transaction`), y
 * hay sentencias que no pueden ir en una: la 0014 lleva
 * `CREATE INDEX CONCURRENTLY`, que es lo que evita bloquear la ingesta de
 * telemetría mientras el índice se construye.
 *
 * El procedimiento real —el que se usa— está en
 * `docs/Procedimiento-Migraciones.md`.
 */
import { sql } from "drizzle-orm";
import { existsSync } from "node:fs";
import { createDb } from "./index.js";

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

async function migrate() {
  const db = createDb(
    process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel",
  );

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  const { migrate: runMigrate } = await import("drizzle-orm/postgres-js/migrator");
  const { default: path } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  await runMigrate(db, { migrationsFolder: path.join(__dirname, "../drizzle") });

  console.log("Migraciones aplicadas.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
