/**
 * Copia la memoria GPS de jrz-drone-os (telemetry_asset_history) a j-tel
 * (telemetry_points). Mapea equipos por hash determinístico del IMEI.
 *
 * Ejecutar:  pnpm --filter @jtel/services run import-jrz-memory
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createDb, createRepositories, telemetryPoints } from "@jtel/db";

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

function safeAssetId(imei: string): string {
  return "fleet-" + createHash("sha256").update(imei).digest("hex").slice(0, 16);
}

async function main() {
  const oldUrl = process.env.JRZ_OLD_MEMORY_DATABASE_URL;
  const newUrl = process.env.DATABASE_URL;
  if (!oldUrl || !newUrl) {
    console.error("Faltan JRZ_OLD_MEMORY_DATABASE_URL o DATABASE_URL en .env");
    process.exit(1);
  }

  const oldDb = createDb(oldUrl);
  const db = createDb(newUrl);
  const repos = createRepositories(db);

  const [stats] = await oldDb.execute<{
    count: number;
    oldest: Date | null;
    latest: Date | null;
  }>(sql`
    select count(*)::int as count,
           min(recorded_at) as oldest,
           max(recorded_at) as latest
    from telemetry_asset_history
    where source_kind = 'jrz_recorded_live'
  `);

  console.log("Memoria vieja (jrz-drone-os):");
  console.log(`  puntos: ${stats?.count ?? 0}`);
  if (stats?.oldest) console.log(`  desde:  ${new Date(stats.oldest).toISOString()}`);
  if (stats?.latest) console.log(`  hasta:  ${new Date(stats.latest).toISOString()}`);

  if (!stats?.count) {
    console.log("Nada que copiar.");
    process.exit(0);
  }

  const imeiByAsset = new Map<string, { imei: string; carrierId: string; deviceId: string }>();
  const carriers = await repos.accounts.listByType("carrier");
  for (const carrier of carriers) {
    const devices = await repos.fleet.getDevicesForCarrier(carrier.id);
    for (const d of devices) {
      if (d.imei) {
        imeiByAsset.set(safeAssetId(d.imei), {
          imei: d.imei,
          carrierId: carrier.id,
          deviceId: d.id,
        });
      }
    }
  }
  console.log(`Equipos en j-tel con IMEI: ${imeiByAsset.size}`);

  const BATCH = 2000;
  let offset = 0;
  let scanned = 0;
  let mapped = 0;
  let saved = 0;
  let skippedUnmapped = 0;

  while (true) {
    const rows = await oldDb.execute<{
      asset_id: string;
      lat: number;
      lon: number;
      reported_speed: number | null;
      recorded_at: Date;
    }>(sql`
      select asset_id, lat, lon, reported_speed, recorded_at
      from telemetry_asset_history
      where source_kind = 'jrz_recorded_live'
      order by recorded_at
      limit ${BATCH} offset ${offset}
    `);

    if (rows.length === 0) break;

    const points: Array<{
      carrierAccountId: string;
      imei: string;
      latitude: number;
      longitude: number;
      speed?: number;
      recordedAt: Date;
      deviceId?: string;
      source: string;
    }> = [];

    for (const row of rows) {
      scanned++;
      const match = imeiByAsset.get(row.asset_id);
      if (!match) {
        skippedUnmapped++;
        continue;
      }
      mapped++;
      points.push({
        carrierAccountId: match.carrierId,
        imei: match.imei,
        latitude: row.lat,
        longitude: row.lon,
        speed: row.reported_speed ?? undefined,
        recordedAt: new Date(row.recorded_at),
        deviceId: match.deviceId,
        source: "jrz-drone-os-import",
      });
    }

    if (points.length > 0) {
      const inserted = await repos.telemetry.savePoints(points);
      saved += inserted.length;
    }

    offset += rows.length;
    if (offset % 50000 === 0 || rows.length < BATCH) {
      console.log(`  progreso: ${offset}/${stats.count} leídos, ${saved} guardados nuevos…`);
    }
  }

  for (const carrier of carriers) {
    const [row] = await db
      .select({ max: sql<Date | null>`max(${telemetryPoints.recordedAt})` })
      .from(telemetryPoints)
      .where(eq(telemetryPoints.carrierAccountId, carrier.id));
    if (row?.max) {
      const maxDate = new Date(row.max);
      await repos.telemetry.setWatermark(carrier.id, maxDate);
      const total = await repos.telemetry.countForCarrier(carrier.id);
      console.log(`\n${carrier.name}: ${total} puntos · marca de agua ${maxDate.toISOString()}`);
    }
  }

  console.log("\nResumen de importación:");
  console.log(`  leídos:              ${scanned}`);
  console.log(`  mapeados a j-tel:    ${mapped}`);
  console.log(`  sin equipo en j-tel: ${skippedUnmapped}`);
  console.log(`  guardados (nuevos):  ${saved}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
