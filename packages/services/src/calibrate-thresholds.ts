/**
 * Calibración semanal vs ground truth (Fase 5).
 *
 * Uso:
 *   pnpm --filter @jtel/services exec tsx src/calibrate-thresholds.ts
 *
 * Imprime recall por día GT y sugiere apretar umbrales solo si recall > 95%.
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { computeDayRecall } from "./ingest-health.js";

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

async function main() {
  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const rows = await repos.groundTruth.listRecent(14);

  if (rows.length === 0) {
    console.log("Sin ground truth registrado. Usa /jstaff/verificacion.");
    process.exit(0);
  }

  let okDays = 0;
  let totalDays = 0;
  for (const gt of rows) {
    if (!gt.expectedAllCumplido) continue;
    totalDays += 1;
    const m = await computeDayRecall(repos, gt.contractId, gt.serviceDate);
    const recallPct = m.recall == null ? null : Math.round(m.recall * 100);
    console.log(
      `${gt.serviceDate} · total=${m.total} cumplido=${m.cumplido} no=${m.noCumplido} pend=${m.pendienteEvidencia} recall=${recallPct ?? "—"}% FN=${m.falseNegatives}`,
    );
    if (m.recall != null && m.recall >= 0.95) okDays += 1;
  }

  console.log("\n---");
  if (totalDays === 0) {
    console.log("No hay días con expectedAllCumplido=true.");
  } else if (okDays === totalDays) {
    console.log(
      `Recall ≥95% en ${okDays}/${totalDays} días. Seguro apretar umbrales (corredor / match) de forma gradual.`,
    );
  } else {
    console.log(
      `Recall ≥95% solo en ${okDays}/${totalDays} días. NO apretar umbrales; priorizar cobertura (gaps/backfill) o desambiguación.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
