/**
 * Recorta ocurrencias futuras lejanas (service_date >= hoy + N días).
 *
 * Uso:
 *   PLANT_GROUP_ID=<uuid> pnpm --filter @jtel/db trim-far
 *   TRIM_DAYS=30 PLANT_GROUP_ID=<uuid> pnpm --filter @jtel/db trim-far
 *   TRIM_ALL=1 pnpm --filter @jtel/db trim-far   # todas las unidades
 *
 * Requisitos:
 *   - PLANT_GROUP_ID o TRIM_ALL=1 es obligatorio.
 *   - TRIM_DAYS >= 7 (mínimo). Por defecto: 30.
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

const TRIM_DAYS_MIN = 7;

async function main() {
  const days = Number(process.env.TRIM_DAYS ?? 30);
  const trimAll = process.env.TRIM_ALL === "1";
  const plantGroupId = trimAll ? undefined : process.env.PLANT_GROUP_ID;

  // Guarda 1: alcance explícito obligatorio.
  if (!trimAll && !plantGroupId) {
    console.error(
      "ERROR: Define PLANT_GROUP_ID=<uuid> o usa TRIM_ALL=1.\n" +
        "Sin alcance explícito, trim-far se niega a correr — riesgo de borrar hechos de producción si TRIM_DAYS es bajo.",
    );
    process.exit(1);
  }

  // Guarda 2: TRIM_DAYS mínimo.
  if (Number.isNaN(days) || days < TRIM_DAYS_MIN) {
    console.error(
      `ERROR: TRIM_DAYS=${days} es menor al mínimo permitido (${TRIM_DAYS_MIN}).\n` +
        `Un valor bajo puede incluir ocurrencias recientes con hechos de cumplimiento. Piso: ${TRIM_DAYS_MIN}.`,
    );
    process.exit(1);
  }

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
  if (result.skipped > 0) {
    console.log(
      `Omitidas (tenían compliance_fact — no se tocan): ${result.skipped}`,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
