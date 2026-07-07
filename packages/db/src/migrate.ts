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
