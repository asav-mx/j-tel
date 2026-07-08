import type {
  GpsProvider,
  GpsCredentials,
  HistoryLocationQuery,
  DeviceInfo,
  GpsProviderConfig,
} from "@jtel/gps-core";
import type { GpsPoint } from "@jtel/domain";

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

export class UmbrellaGpsProvider implements GpsProvider {
  readonly name = "umbrella";

  constructor(private config: GpsProviderConfig) {}

  private get baseUrl() {
    return this.config.baseUrl.replace(/\/$/, "");
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Umbrella API error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
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
    const limit = query.limit ?? 500;
    const maxPages = 20;

    for (let page = 0; page < maxPages; page++) {
      let url = `${this.baseUrl}/api/HistoryLocation?Token=${encodeURIComponent(token)}`;
      url += `&BeginGMT=${encodeURIComponent(query.beginGmt.toISOString())}`;
      url += `&EndGMT=${encodeURIComponent(query.endGmt.toISOString())}`;
      url += `&StartIdx=${startIdx}&Limit=${limit}`;

      if (query.imeis?.length) {
        url += `&Imeis=${encodeURIComponent(query.imeis.join(","))}`;
      }

      const env = await this.fetchJson<UmbrellaEnvelope<UmbrellaLocation[]>>(url);
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
    if (!imei || !gps || gps.gps_valid === false) return null;

    const lat = gps.latitude;
    const lng = gps.longitude;
    const timeStr = gps.l_datetime ?? loc.r_datetime;
    if (lat == null || lng == null || !timeStr) return null;

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
  input: EvidenceIngestInput,
): Promise<{ pointCount: number; status: "disponible" | "parcial" | "indisponible" }> {
  const token = await provider.login();

  let points;
  try {
    points = await provider.getHistoryLocations(token, {
      imeis: input.imeis,
      beginGmt: input.windowStart,
      endGmt: input.windowEnd,
    });
  } catch {
    await input.updateStatus("indisponible");
    return { pointCount: 0, status: "indisponible" };
  }

  if (points.length === 0) {
    await input.updateStatus("indisponible");
    return { pointCount: 0, status: "indisponible" };
  }

  const resolved = await Promise.all(
    points.map(async (p) => {
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
