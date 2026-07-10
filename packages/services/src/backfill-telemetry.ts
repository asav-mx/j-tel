/**
 * Rellena telemetría de una ventana pasada desde Umbrella sin mover la marca de agua.
 *
 * Uso:
 *   FROM=2026-07-09T10:00:00.000Z TO=2026-07-09T13:00:00.000Z \
 *     pnpm --filter @jtel/services run backfill-telemetry
 *
 * Opcional: IMEI=8689... (un solo equipo). CARRIER=juarez (filtro por nombre).
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import { clearUmbrellaTokenCache } from "@jtel/gps-umbrella";
import { getProviderForCarrier } from "./providers.js";

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
    console.error(`Falta ${name} (ISO, p. ej. 2026-07-09T10:00:00.000Z)`);
    process.exit(1);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    console.error(`${name} inválido: ${raw}`);
    process.exit(1);
  }
  return d;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isQuotaError(msg: string) {
  return /exceeded|quota|too many|429/i.test(msg);
}

function isInvalidImei(msg: string) {
  return /imei invalid/i.test(msg);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL en el .env");
    process.exit(1);
  }

  const from = parseIso("FROM");
  const to = parseIso("TO");
  if (to <= from) {
    console.error("TO debe ser posterior a FROM");
    process.exit(1);
  }

  const onlyImei = process.env.IMEI?.trim() || null;
  const carrierFilter = (process.env.CARRIER ?? "juarez").trim().toLowerCase();
  const imeiBatchSize = Math.max(1, Number(process.env.IMEI_BATCH ?? 3));
  const chunkHours = Math.max(0.25, Number(process.env.CHUNK_HOURS ?? 1));

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

  const carriers = await repos.accounts.listByType("carrier");
  const carrier =
    carriers.find((c) => c.name.toLowerCase().includes(carrierFilter)) ??
    carriers.find((c) => /juárez|juarez/i.test(c.name));
  if (!carrier) {
    console.error(`No se encontró carrier con filtro "${carrierFilter}"`);
    process.exit(1);
  }

  const devices = await repos.fleet.getDevicesForCarrier(carrier.id);
  const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));
  let imeis = devices.map((d) => d.imei).filter(Boolean);
  if (onlyImei) {
    if (!imeis.includes(onlyImei)) {
      console.error(`IMEI ${onlyImei} no está en la flota de ${carrier.name}`);
      process.exit(1);
    }
    imeis = [onlyImei];
  }

  // IMEIs que Umbrella rechaza como inválidos (no reintentar).
  const badImeis = new Set<string>();

  console.log(
    `Relleno ${carrier.name}: ${imeis.length} IMEI(s) · ${from.toISOString()} → ${to.toISOString()}`,
  );
  console.log("(no se modifica telemetry_watermarks)");

  const provider = await getProviderForCarrier(repos, config, carrier.id);
  let token = await provider.login();

  async function fetchBatch(batch: string[], beginGmt: Date, endGmt: Date) {
    const usable = batch.filter((i) => !badImeis.has(i));
    if (usable.length === 0) return [];

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await provider.getHistoryLocations(token, {
          imeis: usable,
          beginGmt,
          endGmt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isInvalidImei(msg) && usable.length > 1) {
          // Un IMEI malo envenena el lote → 1×1.
          const all = [];
          for (const imei of usable) {
            try {
              const one = await provider.getHistoryLocations(token, {
                imeis: [imei],
                beginGmt,
                endGmt,
              });
              all.push(...one);
            } catch (oneErr) {
              const oneMsg = oneErr instanceof Error ? oneErr.message : String(oneErr);
              if (isInvalidImei(oneMsg)) {
                badImeis.add(imei);
                console.warn(`      IMEI inválido permanente: ${imei}`);
              } else if (isQuotaError(oneMsg)) {
                clearUmbrellaTokenCache();
                console.warn(`      cuota agotada; esperando 70s y nuevo login…`);
                await sleep(70_000);
                token = await provider.login();
                const retry = await provider.getHistoryLocations(token, {
                  imeis: [imei],
                  beginGmt,
                  endGmt,
                });
                all.push(...retry);
              } else {
                console.warn(`      omitido ${imei}: ${oneMsg}`);
              }
            }
          }
          return all;
        }
        if (isInvalidImei(msg) && usable.length === 1) {
          badImeis.add(usable[0]!);
          console.warn(`      IMEI inválido permanente: ${usable[0]}`);
          return [];
        }
        if (isQuotaError(msg)) {
          clearUmbrellaTokenCache();
          console.warn(`    cuota/token; esperando 70s y nuevo login (intento ${attempt + 1})…`);
          await sleep(70_000);
          token = await provider.login();
          continue;
        }
        throw err;
      }
    }
    return [];
  }

  const chunkMs = chunkHours * 60 * 60_000;
  let fetched = 0;
  let saved = 0;
  let cursor = from;

  while (cursor < to) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + chunkMs, to.getTime()));
    console.log(`  trozo ${cursor.toISOString()} → ${chunkEnd.toISOString()}`);

    for (let i = 0; i < imeis.length; i += imeiBatchSize) {
      const batch = imeis.slice(i, i + imeiBatchSize);
      const points = await fetchBatch(batch, cursor, chunkEnd);
      fetched += points.length;
      if (points.length === 0) continue;

      const resolved = await Promise.all(
        points.map(async (p) => {
          const device = imeiToDevice.get(p.imei);
          let unitId: string | null = null;
          const deviceId: string | null = device?.id ?? null;
          if (device) {
            const assignment = await repos.fleet.resolveUnitAtTime(device.id, p.timestamp);
            if (assignment) unitId = assignment.unitId;
          }
          return {
            carrierAccountId: carrier.id,
            imei: p.imei,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed,
            recordedAt: p.timestamp,
            deviceId,
            unitId,
            source: provider.name,
          };
        }),
      );

      const rows = await repos.telemetry.savePoints(resolved);
      saved += rows.length;
      console.log(
        `    lote ${Math.floor(i / imeiBatchSize) + 1}: traídos=${points.length} nuevos=${rows.length}`,
      );
    }

    cursor = chunkEnd;
  }

  if (badImeis.size) {
    console.log(`\nIMEIs inválidos omitidos (${badImeis.size}): ${[...badImeis].join(", ")}`);
  }
  console.log(`\nListo. Traídos=${fetched} · nuevos=${saved} · ya existían=${fetched - saved}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
