import type {
  GpsProvider,
  GpsCredentials,
  HistoryLocationQuery,
  DeviceInfo,
  GpsProviderConfig,
} from "@jtel/gps-core";
import type { GpsPoint } from "@jtel/domain";
import { fullJitterMs, sleep, umbrellaTokenBucket } from "./rate-limit.js";

/** Todas las respuestas de la API de Umbrella vienen envueltas así. */
interface UmbrellaEnvelope<T> {
  state: boolean;
  message: string;
  value: T;
}

interface UmbrellaGpsInfo {
  l_datetime?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  gps_valid?: boolean;
}

interface UmbrellaLocation {
  sn_imei_id?: string;
  r_datetime?: string;
  gps_info?: UmbrellaGpsInfo;
}

interface UmbrellaDevice {
  sn_imei_id?: string;
  tracker_name?: string;
}

/**
 * Cache de token compartido entre instancias. Sobrevive invocaciones "warm"
 * del serverless, evitando pedir login en cada corrida del cron (lo que
 * provocaba 429 Too Many Requests en Umbrella).
 */
const sharedTokenCache = new Map<string, { token: string; expiresAt: number }>();

/** Invalida tokens cacheados (p. ej. tras "Token has exceeded the use…"). */
export function clearUmbrellaTokenCache() {
  sharedTokenCache.clear();
}

export class UmbrellaGpsProvider implements GpsProvider {
  readonly name = "umbrella";

  constructor(private config: GpsProviderConfig) {}

  private get baseUrl() {
    // La API de Umbrella vive bajo /openapi. Normalizamos de forma idempotente
    // para que funcione tanto con la URL base como con la ya completa.
    const trimmed = this.config.baseUrl.replace(/\/+$/, "");
    return /\/openapi$/i.test(trimmed) ? trimmed : `${trimmed}/openapi`;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    // Token bucket ~8/min + backoff full-jitter ante 429/503.
    const maxAttempts = 6;
    let lastStatus = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await umbrellaTokenBucket.take();
      const response = await fetch(url);
      if (response.ok) {
        return response.json() as Promise<T>;
      }
      lastStatus = response.status;
      const retryable = response.status === 429 || response.status === 503;
      if (!retryable || attempt === maxAttempts - 1) {
        const body = await response.text().catch(() => "");
        const snippet = body.slice(0, 200).replace(/\s+/g, " ").trim();
        throw new Error(
          `Umbrella API error: ${response.status} ${response.statusText}${snippet ? ` — ${snippet}` : ""}`,
        );
      }
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
      const wait = Number.isFinite(retryAfterMs)
        ? Math.min(60_000, Math.max(0, retryAfterMs))
        : fullJitterMs(attempt, 1000, 60_000);
      await sleep(wait);
    }

    throw new Error(`Umbrella API error: ${lastStatus}`);
  }

  async login(credentials?: GpsCredentials): Promise<string> {
    const creds = credentials ?? this.config.credentials;
    const cacheKey = `${this.baseUrl}|${creds.userId}`;

    const cached = sharedTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const url = `${this.baseUrl}/api/Login?userid=${encodeURIComponent(creds.userId)}&password=${encodeURIComponent(creds.password)}`;
    const env = await this.fetchJson<UmbrellaEnvelope<string>>(url);
    const token = env?.state ? env.value : undefined;
    if (!token) {
      throw new Error(
        `No se obtuvo token de Umbrella GPS: ${env?.message ?? "respuesta inválida"}`,
      );
    }

    sharedTokenCache.set(cacheKey, { token, expiresAt: Date.now() + 30 * 60 * 1000 });
    return token;
  }

  async getDevices(token: string): Promise<DeviceInfo[]> {
    const url = `${this.baseUrl}/api/Tracker?Token=${encodeURIComponent(token)}`;
    const env = await this.fetchJson<UmbrellaEnvelope<UmbrellaDevice[]>>(url);
    const devices = env?.value ?? [];

    return devices
      .map((d) => ({ imei: d.sn_imei_id ?? "", label: d.tracker_name }))
      .filter((d) => d.imei);
  }

  async getLastLocations(token: string, imeis?: string[]): Promise<GpsPoint[]> {
    let url = `${this.baseUrl}/api/LastLocation?Token=${encodeURIComponent(token)}`;
    if (imeis?.length) {
      url += `&Imeis=${encodeURIComponent(imeis.join(","))}`;
    }
    const env = await this.fetchJson<UmbrellaEnvelope<UmbrellaLocation[]>>(url);
    const locations = env?.value ?? [];
    return locations.map((loc) => this.toGpsPoint(loc)).filter(Boolean) as GpsPoint[];
  }

  async getHistoryLocations(token: string, query: HistoryLocationQuery): Promise<GpsPoint[]> {
    const allPoints: GpsPoint[] = [];
    let startIdx = query.startIdx ?? 0;
    // Umbrella rechaza consultas con más de 100 registros por página
    // ("Query records can not be more than 100"). Si se pide más, la API
    // responde state:false y no llega ningún punto.
    const limit = Math.min(query.limit ?? 100, 100);
    const maxPages = 50;

    for (let page = 0; page < maxPages; page++) {
      // El token bucket en fetchJson espacia las llamadas (~8/min).

      let url = `${this.baseUrl}/api/HistoryLocation?Token=${encodeURIComponent(token)}`;
      url += `&BeginGMT=${encodeURIComponent(query.beginGmt.toISOString())}`;
      url += `&EndGMT=${encodeURIComponent(query.endGmt.toISOString())}`;
      url += `&StartIdx=${startIdx}&Limit=${limit}`;

      if (query.imeis?.length) {
        url += `&Imeis=${encodeURIComponent(query.imeis.join(","))}`;
      }

      const env = await this.fetchJson<UmbrellaEnvelope<UmbrellaLocation[]>>(url);
      if (env && env.state === false) {
        throw new Error(
          `Umbrella HistoryLocation state:false — ${env.message || "sin detalle"}`,
        );
      }
      const locations = env?.value ?? [];

      if (locations.length === 0) break;

      for (const loc of locations) {
        const point = this.toGpsPoint(loc);
        if (point) allPoints.push(point);
      }

      if (locations.length < limit) break;
      startIdx += limit;
    }

    return allPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private toGpsPoint(loc: UmbrellaLocation): GpsPoint | null {
    const imei = loc.sn_imei_id;
    const gps = loc.gps_info;
    if (!imei || !gps) return null;

    const lat = gps.latitude;
    const lng = gps.longitude;
    const timeStr = gps.l_datetime ?? loc.r_datetime;
    if (lat == null || lng == null || !timeStr) return null;

    // No descartamos por gps_valid=false: este hardware marca así los reportes
    // por celda o con el vehículo detenido, que igual traen coordenadas reales
    // (justo la evidencia de "llegó y se quedó en el destino"). Sólo se
    // descartan coordenadas nulas (0,0) que indican ausencia de posición.
    if (lat === 0 && lng === 0) return null;

    // La API entrega fechas en GMT sin sufijo de zona; las interpretamos como UTC.
    const hasTz = /[zZ]|[+-]\d\d:?\d\d$/.test(timeStr);
    const timestamp = new Date(hasTz ? timeStr : `${timeStr}Z`);
    if (Number.isNaN(timestamp.getTime())) return null;

    return {
      imei,
      latitude: lat,
      longitude: lng,
      speed: gps.speed,
      timestamp,
    };
  }
}

export function createUmbrellaProvider(config: GpsProviderConfig): UmbrellaGpsProvider {
  return new UmbrellaGpsProvider(config);
}

export interface EvidenceIngestInput {
  tripId: string;
  imeis: string[];
  windowStart: Date;
  windowEnd: Date;
  resolveUnit: (imei: string, at: Date) => Promise<{ unitId: string; deviceId: string } | null>;
  savePoints: (points: Array<{
    imei: string;
    latitude: number;
    longitude: number;
    speed?: number;
    recordedAt: Date;
    deviceId?: string;
    unitId?: string;
  }>) => Promise<void>;
  updateStatus: (status: "disponible" | "parcial" | "en_espera" | "indisponible") => Promise<void>;
}

export async function ingestEvidenceForTrip(
  provider: UmbrellaGpsProvider,
  input: EvidenceIngestInput & { imeiBatchSize?: number },
): Promise<{ pointCount: number; status: "disponible" | "parcial" | "indisponible" }> {
  const token = await provider.login();
  const batchSize = input.imeiBatchSize ?? 3;
  const allPoints: Awaited<ReturnType<UmbrellaGpsProvider["getHistoryLocations"]>> = [];

  try {
    for (let i = 0; i < input.imeis.length; i += batchSize) {
      const batch = input.imeis.slice(i, i + batchSize);
      const points = await provider.getHistoryLocations(token, {
        imeis: batch,
        beginGmt: input.windowStart,
        endGmt: input.windowEnd,
      });
      allPoints.push(...points);
    }
  } catch {
    await input.updateStatus("indisponible");
    return { pointCount: 0, status: "indisponible" };
  }

  if (allPoints.length === 0) {
    await input.updateStatus("indisponible");
    return { pointCount: 0, status: "indisponible" };
  }

  const resolved = await Promise.all(
    allPoints.map(async (p) => {
      const unit = await input.resolveUnit(p.imei, p.timestamp);
      return {
        imei: p.imei,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed,
        recordedAt: p.timestamp,
        deviceId: unit?.deviceId,
        unitId: unit?.unitId,
      };
    }),
  );

  await input.savePoints(resolved);

  const status = resolved.some((p) => p.unitId) ? "disponible" : "parcial";
  await input.updateStatus(status);

  return { pointCount: resolved.length, status };
}

export { fullJitterMs, sleep, TokenBucket, umbrellaTokenBucket } from "./rate-limit.js";
