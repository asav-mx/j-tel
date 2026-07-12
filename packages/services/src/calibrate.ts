/**
 * Calibración semanal vs ground truth (Fase 5).
 *
 *   SERVICE_DATE=2026-07-09 CONTRACT=campus \
 *     pnpm --filter @jtel/services run calibrate
 *
 * O FROM=… TO=… para un rango de días (inclusive).
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

function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(`${fromIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const filter = (process.env.CONTRACT ?? "santos dumont|campus").toLowerCase();
  const single = process.env.SERVICE_DATE;
  const from = process.env.FROM ?? single;
  const to = process.env.TO ?? single;
  if (!from || !to) {
    console.error("Falta SERVICE_DATE=YYYY-MM-DD (o FROM/TO)");
    process.exit(1);
  }

  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  for (const c of clients) {
    contracts.push(...(await repos.contracts.findForClient(c.id)));
  }
  const contract = contracts.find((c) => {
    const hay = `${c.name ?? ""} ${c.id}`.toLowerCase();
    return filter.split("|").some((f) => hay.includes(f.trim()));
  });
  if (!contract) {
    console.error("Contrato no encontrado:", filter);
    process.exit(1);
  }

  console.log(`Calibración · ${contract.name}`);
  let day = from;
  const rows = [];
  while (day <= to) {
    const recall = await computeDayRecall(repos, contract.id, day);
    rows.push({ day, ...recall });
    const rec = recall.recall;
    const flag =
      recall.groundTruth && rec != null && rec < 0.95
        ? " ⚠ recall<95%"
        : recall.pendienteEvidencia > Math.ceil(recall.total * 0.2)
          ? " ⚠ pendiente>20%"
          : "";
    console.log(
      `  ${day}: cumplido=${recall.cumplido} no=${recall.noCumplido} pend=${recall.pendienteEvidencia} recall=${
        rec == null ? "—" : `${(rec * 100).toFixed(1)}%`
      }${flag}`,
    );
    if (day === to) break;
    day = addDaysIso(day, 1);
  }

  const withGt = rows.filter((r) => r.groundTruth && r.recall != null);
  if (withGt.length) {
    const avg = withGt.reduce((s, r) => s + (r.recall ?? 0), 0) / withGt.length;
    console.log(`\nPromedio recall (días con GT): ${(avg * 100).toFixed(1)}%`);
    if (avg < 0.95) {
      console.log(
        "Sugerencia: no apretar umbrales de corredor/match; priorizar evidencia (gap-backfill) o desambiguación.",
      );
    } else {
      console.log("OK para apretar tolerancias con cuidado (recall ≥ 95%).");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
