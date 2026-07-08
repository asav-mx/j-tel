import type { Repositories } from "@jtel/db";
import {
  getProviderForCarrier,
  type GpsBackendConfig,
  type GpsProviderInstance,
} from "./providers.js";

export interface ArchiverOptions {
  /** Minutos hacia atrás la primera vez que se archiva un carrier (sin watermark). */
  firstRunLookbackMinutes?: number;
  /** Minutos de traslape antes del watermark, para no perder puntos en el borde. */
  overlapMinutes?: number;
}

export interface CarrierArchiveResult {
  carrierAccountId: string;
  carrierName: string;
  imeis: number;
  fetched: number;
  saved: number;
  from: string;
  to: string;
  skipped?: string;
  error?: string;
}

/**
 * Archivador continuo de telemetría ("memoria propia"). Recorre los carriers con
 * credenciales GPS, jala del proveedor lo nuevo desde la marca de agua y lo
 * guarda en `telemetry_points`, deduplicando. Así construimos nuestro propio
 * historial sin depender del histórico del proveedor.
 */
export class ArchiverService {
  private firstRunLookbackMinutes: number;
  private overlapMinutes: number;

  constructor(
    private repos: Repositories,
    private config: GpsBackendConfig,
    options: ArchiverOptions = {},
  ) {
    this.firstRunLookbackMinutes = options.firstRunLookbackMinutes ?? 60;
    this.overlapMinutes = options.overlapMinutes ?? 5;
  }

  async archiveAll(now = new Date()): Promise<{
    carriers: CarrierArchiveResult[];
    totalSaved: number;
  }> {
    const carriers = await this.repos.accounts.listByType("carrier");
    const results: CarrierArchiveResult[] = [];

    for (const carrier of carriers) {
      try {
        results.push(await this.archiveCarrier(carrier.id, carrier.name, now));
      } catch (err) {
        results.push({
          carrierAccountId: carrier.id,
          carrierName: carrier.name,
          imeis: 0,
          fetched: 0,
          saved: 0,
          from: "",
          to: now.toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      carriers: results,
      totalSaved: results.reduce((sum, r) => sum + r.saved, 0),
    };
  }

  private async archiveCarrier(
    carrierAccountId: string,
    carrierName: string,
    now: Date,
  ): Promise<CarrierArchiveResult> {
    const base: CarrierArchiveResult = {
      carrierAccountId,
      carrierName,
      imeis: 0,
      fetched: 0,
      saved: 0,
      from: "",
      to: now.toISOString(),
    };

    // Solo archivamos carriers con credenciales GPS reales configuradas.
    const creds = await this.repos.carriers.getGpsCredentials(carrierAccountId);
    if (!creds) return { ...base, skipped: "sin credenciales GPS" };

    const devices = await this.repos.fleet.getDevicesForCarrier(carrierAccountId);
    const imeis = devices.map((d) => d.imei).filter(Boolean);
    if (imeis.length === 0) return { ...base, skipped: "sin dispositivos" };

    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));

    const watermark = await this.repos.telemetry.getWatermark(carrierAccountId);
    const from = watermark
      ? new Date(watermark.lastRecordedAt.getTime() - this.overlapMinutes * 60_000)
      : new Date(now.getTime() - this.firstRunLookbackMinutes * 60_000);

    base.imeis = imeis.length;
    base.from = from.toISOString();

    if (from >= now) return { ...base, skipped: "sin ventana nueva" };

    const provider: GpsProviderInstance = await getProviderForCarrier(
      this.repos,
      this.config,
      carrierAccountId,
    );

    const token = await provider.login();
    const points = await provider.getHistoryLocations(token, {
      imeis,
      beginGmt: from,
      endGmt: now,
    });

    base.fetched = points.length;
    if (points.length === 0) return base;

    const resolved = await Promise.all(
      points.map(async (p) => {
        const device = imeiToDevice.get(p.imei);
        let unitId: string | null = null;
        let deviceId: string | null = device?.id ?? null;
        if (device) {
          const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, p.timestamp);
          if (assignment) unitId = assignment.unitId;
        }
        return {
          carrierAccountId,
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

    const savedRows = await this.repos.telemetry.savePoints(resolved);
    base.saved = savedRows.length;

    const maxRecordedAt = points.reduce(
      (max, p) => (p.timestamp > max ? p.timestamp : max),
      points[0]!.timestamp,
    );
    // Solo avanzamos el watermark; nunca lo retrocedemos.
    if (!watermark || maxRecordedAt > watermark.lastRecordedAt) {
      await this.repos.telemetry.setWatermark(carrierAccountId, maxRecordedAt);
    }

    return base;
  }
}
