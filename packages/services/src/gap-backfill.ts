/**
 * Detección de huecos + relleno dirigido (Fase 5).
 */
import type { Repositories } from "@jtel/db";
import type { GpsBackendConfig } from "./providers.js";
import { getProviderForCarrier } from "./providers.js";

export type GapWindow = {
  carrierAccountId: string;
  imei: string;
  start: Date;
  end: Date;
  gapMinutes: number;
};

export type GapBackfillSummary = {
  scannedImeis: number;
  gapsFound: number;
  gapsFilled: number;
  pointsSaved: number;
  errors: string[];
};

export class GapBackfillService {
  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
    private opts: {
      /** Hueco mínimo a rellenar (min). Default 15. */
      gapMinutes?: number;
      /** Ventana hacia atrás a escanear (horas). Default 6. */
      lookbackHours?: number;
      /** Máximo de huecos a rellenar por corrida. */
      maxGapsPerRun?: number;
    } = {},
  ) {}

  async scanGaps(now = new Date()): Promise<GapWindow[]> {
    const gapMinutes = this.opts.gapMinutes ?? 15;
    const lookbackHours = this.opts.lookbackHours ?? 6;
    const from = new Date(now.getTime() - lookbackHours * 3600_000);
    const carriers = await this.repos.accounts.listByType("carrier");
    const gaps: GapWindow[] = [];

    for (const carrier of carriers) {
      const devices = await this.repos.fleet.getDevicesForCarrier(carrier.id);
      for (const d of devices) {
        if (!d.imei) continue;
        const found = await this.repos.telemetry.findGapsForImei(
          d.imei,
          from,
          now,
          gapMinutes,
        );
        for (const g of found) {
          gaps.push({
            carrierAccountId: carrier.id,
            imei: d.imei,
            start: g.start,
            end: g.end,
            gapMinutes: g.gapMinutes,
          });
        }
      }
    }

    return gaps.sort((a, b) => b.gapMinutes - a.gapMinutes);
  }

  async fillGaps(now = new Date()): Promise<GapBackfillSummary> {
    const maxGaps = this.opts.maxGapsPerRun ?? 8;
    const gaps = (await this.scanGaps(now)).slice(0, maxGaps);
    const summary: GapBackfillSummary = {
      scannedImeis: 0,
      gapsFound: gaps.length,
      gapsFilled: 0,
      pointsSaved: 0,
      errors: [],
    };

    const carriers = await this.repos.accounts.listByType("carrier");
    summary.scannedImeis = (
      await Promise.all(
        carriers.map((c) => this.repos.fleet.getDevicesForCarrier(c.id)),
      )
    ).reduce((n, d) => n + d.length, 0);

    for (const gap of gaps) {
      try {
        const carrier = carriers.find((c) => c.id === gap.carrierAccountId);
        if (!carrier) continue;
        const provider = await getProviderForCarrier(
          this.repos,
          this.config,
          carrier.id,
        );
        const token = await provider.login();
        const devices = await this.repos.fleet.getDevicesForCarrier(carrier.id);
        const device = devices.find((d) => d.imei === gap.imei);
        const points = await provider.getHistoryLocations(token, {
          beginGmt: gap.start,
          endGmt: gap.end,
          imeis: [gap.imei],
        });
        if (points.length > 0) {
          await this.repos.telemetry.savePoints(
            points.map((p) => ({
              carrierAccountId: carrier.id,
              imei: p.imei,
              latitude: p.latitude,
              longitude: p.longitude,
              speed: p.speed,
              recordedAt: p.timestamp,
              deviceId: device?.id,
              source: "umbrella-gap-backfill",
            })),
          );
          summary.pointsSaved += points.length;
          const latest = points.reduce(
            (m, p) => (p.timestamp > m ? p.timestamp : m),
            points[0]!.timestamp,
          );
          await this.repos.telemetry.setImeiWatermark(carrier.id, gap.imei, latest);
        }
        summary.gapsFilled += 1;
      } catch (err) {
        summary.errors.push(
          `${gap.imei} ${gap.start.toISOString()}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return summary;
  }
}
