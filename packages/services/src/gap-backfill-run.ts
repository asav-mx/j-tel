/**
 * CLI: escanea huecos y rellena (Fase 5).
 *   pnpm --filter @jtel/services run gap-backfill
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { GapBackfillService } from "./gap-backfill.js";

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

function normalizeUmbrellaBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /\/openapi$/i.test(trimmed) ? trimmed : `${trimmed}/openapi`;
}

async function main() {
  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const svc = new GapBackfillService(
    repos,
    {
      umbrellaBaseUrl: normalizeUmbrellaBaseUrl(
        process.env.UMBRELLA_GPS_URL ??
          process.env.UMBRELLA_GPS_BASE_URL ??
          "http://gps2.umbrellasoluciones.com/openapi",
      ),
      umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
      umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
    },
    {
      gapMinutes: Number(process.env.GAP_MINUTES ?? 15),
      lookbackHours: Number(process.env.LOOKBACK_HOURS ?? 6),
      maxGapsPerRun: Number(process.env.MAX_GAPS ?? 6),
    },
  );
  const summary = await svc.fillGaps();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
