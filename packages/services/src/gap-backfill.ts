/**
 * Gap-directed backfill (Fase 5): escanea huecos en memoria propia y rellena
 * desde Umbrella sin avanzar la watermark de carrier (sí actualiza por IMEI).
 *
 * Uso CLI:
 *   FROM=2026-07-09T00:00:00Z TO=2026-07-10T00:00:00Z \
 *     pnpm --filter @jtel/services run gap-backfill
 *
 * Opcional: MAX_GAP_MINUTES=15 CARRIER=juarez IMEI=… MAX_GAPS=20
 */
import type { Repositories } from "@jtel/db";
import { clearUmbrellaTokenCache } from "@jtel/gps-umbrella";
import type { GpsBackendConfig } from "./providers.js";
import { getProviderForCarrier } from "./providers.js";

export type GapBackfillOptions = {
  from: Date;
  to: Date;
  maxGapMinutes?: number;
  /** Tope de huecos a rellenar por corrida (cron). */
  maxGaps?: number;
  imeiBatchSize?: number;
  carrierNameFilter?: string;
  imeiFilter?: string;
};

export type GapBackfillResult = {
  carriers: number;
  gapsFound: number;
  gapsFilled: number;
  pointsSaved: number;
  errors: string[];
};

function isQuotaError(msg: string) {
  return /exceeded|quota|too many|429|503/i.test(msg);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class GapBackfillService {
  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
  ) {}

  async run(opts: GapBackfillOptions): Promise<GapBackfillResult> {
    const maxGapMinutes = opts.maxGapMinutes ?? 15;
    const maxGaps = opts.maxGaps ?? 40;
    const result: GapBackfillResult = {
      carriers: 0,
      gapsFound: 0,
      gapsFilled: 0,
      pointsSaved: 0,
      errors: [],
    };

    let carriers = await this.repos.accounts.listByType("carrier");
    if (opts.carrierNameFilter) {
      const f = opts.carrierNameFilter.toLowerCase();
      carriers = carriers.filter((c) => c.name.toLowerCase().includes(f) || c.slug?.includes(f));
    }

    for (const carrier of carriers) {
      result.carriers += 1;
      const creds = await this.repos.carriers.getGpsCredentials(carrier.id);
      if (!creds) continue;

      const devices = await this.repos.fleet.getDevicesForCarrier(carrier.id);
      let imeis = devices.map((d) => d.imei).filter(Boolean);
      if (opts.imeiFilter) imeis = imeis.filter((i) => i === opts.imeiFilter);
      if (imeis.length === 0) continue;

      const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));
      const provider = await getProviderForCarrier(this.repos, this.config, carrier.id);
      let token = await provider.login();

      const work: Array<{ imei: string; from: Date; to: Date; gapMinutes: number }> = [];
      for (const imei of imeis) {
        const gaps = await this.repos.telemetry.findGapsForImei(
          imei,
          opts.from,
          opts.to,
          maxGapMinutes,
        );
        for (const g of gaps) work.push({ imei, ...g });
      }
      work.sort((a, b) => b.gapMinutes - a.gapMinutes);
      result.gapsFound += work.length;

      for (const gap of work.slice(0, Math.max(0, maxGaps - result.gapsFilled))) {
        try {
          let points;
          try {
            points = await provider.getHistoryLocations(token, {
              imeis: [gap.imei],
              beginGmt: gap.from,
              endGmt: gap.to,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (isQuotaError(msg)) {
              clearUmbrellaTokenCache();
              await sleep(70_000);
              token = await provider.login();
              points = await provider.getHistoryLocations(token, {
                imeis: [gap.imei],
                beginGmt: gap.from,
                endGmt: gap.to,
              });
            } else {
              throw err;
            }
          }

          if (points.length === 0) {
            // Sin puntos reales: no avanzamos watermark de carrier; sí marcamos IMEI
            // al fin del hueco para no reintentar el mismo vacío cada hora.
            await this.repos.telemetry.setImeiWatermark(carrier.id, gap.imei, gap.to);
            result.gapsFilled += 1;
            continue;
          }

          const resolved = await Promise.all(
            points.map(async (p) => {
              const device = imeiToDevice.get(p.imei);
              let unitId: string | null = null;
              if (device) {
                const assignment = await this.repos.fleet.resolveUnitAtTime(
                  device.id,
                  p.timestamp,
                );
                if (assignment) unitId = assignment.unitId;
              }
              return {
                carrierAccountId: carrier.id,
                imei: p.imei,
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed,
                recordedAt: p.timestamp,
                deviceId: device?.id ?? null,
                unitId,
                source: provider.name,
              };
            }),
          );
          const saved = await this.repos.telemetry.savePoints(resolved);
          result.pointsSaved += saved.length;

          let latest = gap.from;
          for (const p of points) {
            if (p.timestamp > latest) latest = p.timestamp;
          }
          await this.repos.telemetry.setImeiWatermark(carrier.id, gap.imei, latest);
          result.gapsFilled += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`${carrier.name}/${gap.imei}: ${msg}`);
          if (isQuotaError(msg)) {
            try {
              await this.repos.ingestAlerts.create({
                carrierAccountId: carrier.id,
                kind: "rate_limit",
                severity: "warning",
                message: `Rate limit Umbrella durante gap-backfill: ${msg.slice(0, 180)}`,
                metadata: { imei: gap.imei, from: gap.from.toISOString(), to: gap.to.toISOString() },
              });
            } catch (alertErr) {
              // El error original ya quedó en result.errors; registramos que
              // tampoco se pudo persistir la alerta en lugar de descartarlo.
              console.error(
                `[gap-backfill] no se pudo crear alerta rate_limit para ${carrier.id}:`,
                alertErr,
              );
            }
            break;
          }
        }
      }
    }

    return result;
  }
}
