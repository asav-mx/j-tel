/**
 * Corrida manual del archivador de telemetría (la "memoria propia").
 *
 * Hace exactamente lo mismo que el cron `/api/cron/archive`: recorre los
 * carriers con credenciales GPS, jala del proveedor lo nuevo desde la marca de
 * agua y lo guarda en `telemetry_points`, deduplicando. Sirve para probar y
 * para forzar un archivado a mano.
 *
 * Ejecutar:  pnpm --filter @jtel/services run archive
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { ArchiverService } from "./archiver.js";

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
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL en el .env");
    process.exit(1);
  }

  const db = createDb(url);
  const repos = createRepositories(db);

  const config = {
    umbrellaBaseUrl: normalizeUmbrellaBaseUrl(
      process.env.UMBRELLA_GPS_URL ??
        process.env.UMBRELLA_GPS_BASE_URL ??
        "http://gps2.umbrellasoluciones.com/openapi",
    ),
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  };

  const catchUp = process.env.ARCHIVE_CATCHUP === "1";
  const archiver = new ArchiverService(repos, config, {
    chunkHours: catchUp ? 1 : 2,
    maxChunksPerRun: catchUp ? 30 : 12,
    // Lotes chicos: con muchos IMEIs Umbrella a veces responde vacío.
    imeiBatchSize: catchUp ? 3 : 5,
  });

  console.log(catchUp ? "Catch-up archivando…" : "Archivando telemetría…");
  const summary = await archiver.archiveAll();

  for (const c of summary.carriers) {
    const detail = c.skipped
      ? `omitido (${c.skipped})`
      : c.error
        ? `ERROR: ${c.error}`
        : `equipos=${c.imeis} trozos=${c.chunks ?? 0} traídos=${c.fetched} guardados=${c.saved} · ventana ${c.from} → ${c.to}`;
    console.log(`- ${c.carrierName}: ${detail}`);
    if (!c.skipped && !c.error) {
      const total = await repos.telemetry.countForCarrier(c.carrierAccountId);
      console.log(`    total acumulado en la base: ${total} puntos`);
    }
  }

  console.log(`\nTotal guardado en esta corrida: ${summary.totalSaved} puntos nuevos.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
