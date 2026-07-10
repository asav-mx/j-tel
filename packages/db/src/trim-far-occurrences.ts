/**
 * Recorta ocurrencias futuras lejanas (service_date >= hoy + N días).
 *
 * Uso:
 *   pnpm --filter @jtel/db trim-far
 *   TRIM_DAYS=30 PLANT_GROUP_ID=<uuid> pnpm --filter @jtel/db trim-far
 *   TRIM_ALL=1 pnpm --filter @jtel/db trim-far   # todas las unidades
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "./index.js";

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

const TECMA_CAMPUS_GROUP_ID = "4c3e2cc9-4f9f-4afa-8245-06c8404bebbf";

async function main() {
  const days = Number(process.env.TRIM_DAYS ?? 30);
  const trimAll = process.env.TRIM_ALL === "1";
  const plantGroupId = trimAll
    ? undefined
    : (process.env.PLANT_GROUP_ID ?? TECMA_CAMPUS_GROUP_ID);

  const db = createDb(
    process.env.DATABASE_URL ?? "postgresql://jtel:jtel_dev@localhost:5432/jtel",
  );
  const repos = createRepositories(db);

  console.log(
    `Recortando ocurrencias con service_date >= hoy+${days}` +
      (plantGroupId ? ` (plant_group=${plantGroupId})` : " (todas)"),
  );

  const result = await repos.occurrences.deleteBeyondHorizon(days, plantGroupId);
  console.log(`Cutoff: ${result.cutoff}`);
  console.log(`Eliminadas: ${result.deleted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
