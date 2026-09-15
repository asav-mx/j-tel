/**
 * CLI gap-backfill (Fase 5).
 *
 *   FROM=2026-07-09T00:00:00Z TO=2026-07-10T00:00:00Z \
 *     pnpm --filter @jtel/services run gap-backfill
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories, pedirAplicar } from "@jtel/db";
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

function parseIso(name: string): Date {
  const raw = process.env[name];
  if (!raw) {
    console.error(`Falta ${name} (ISO)`);
    process.exit(1);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    console.error(`${name} inválido: ${raw}`);
    process.exit(1);
  }
  return d;
}

async function main() {
  const from = parseIso("FROM");
  const to = parseIso("TO");
  if (
    !pedirAplicar({
      guion: "gap-backfill",
      queEscribe: "Rellena huecos de telemetría en telemetry_points y mueve marcas de agua por IMEI.",
      url: process.env.DATABASE_URL,
      alcance: {
        FROM: from.toISOString(),
        TO: to.toISOString(),
        CARRIER: process.env.CARRIER,
        IMEI: process.env.IMEI,
        MAX_GAPS: process.env.MAX_GAPS ?? 40,
      },
    })
  ) {
    process.exit(0);
  }
  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);
  const service = new GapBackfillService(repos, {
    umbrellaBaseUrl: normalizeUmbrellaBaseUrl(
      process.env.UMBRELLA_GPS_URL ??
        process.env.UMBRELLA_GPS_BASE_URL ??
        "http://gps2.umbrellasoluciones.com/openapi",
    ),
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  });

  const summary = await service.run({
    from,
    to,
    maxGapMinutes: Number(process.env.MAX_GAP_MINUTES ?? 15),
    maxGaps: Number(process.env.MAX_GAPS ?? 40),
    carrierNameFilter: process.env.CARRIER,
    imeiFilter: process.env.IMEI,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
