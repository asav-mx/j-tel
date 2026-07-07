import type {
  GpsProvider,
  GpsCredentials,
  HistoryLocationQuery,
  DeviceInfo,
  GpsProviderConfig,
} from "@jtel/gps-core";
import type { GpsPoint } from "@jtel/domain";

interface UmbrellaLocation {
  Imei?: string;
  IMEI?: string;
  Latitude?: number;
  Longitude?: number;
  Speed?: number;
  GPSTime?: string;
  GpsTime?: string;
}

interface UmbrellaDevice {
  Imei?: string;
  IMEI?: string;
  Name?: string;
  DeviceName?: string;
}

export class UmbrellaGpsProvider implements GpsProvider {
  readonly name = "umbrella";
  private tokenCache: { token: string; expiresAt: number } | null = null;

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
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const creds = credentials ?? this.config.credentials;
    const url = `${this.baseUrl}/api/Login?userid=${encodeURIComponent(creds.userId)}&password=${encodeURIComponent(creds.password)}`;
    const data = await this.fetchJson<{ Token?: string; token?: string }>(url);
    const token = data.Token ?? data.token;
    if (!token) throw new Error("No se obtuvo token de Umbrella GPS");

    this.tokenCache = { token, expiresAt: Date.now() + 30 * 60 * 1000 };
    return token;
  }

  async getDevices(token: string): Promise<DeviceInfo[]> {
    const url = `${this.baseUrl}/api/Tracker?Token=${encodeURIComponent(token)}`;
    const data = await this.fetchJson<UmbrellaDevice[] | { Data?: UmbrellaDevice[] }>(url);
    const devices = Array.isArray(data) ? data : (data.Data ?? []);

    return devices.map((d) => ({
      imei: d.Imei ?? d.IMEI ?? "",
      label: d.Name ?? d.DeviceName,
    })).filter((d) => d.imei);
  }

  async getLastLocations(token: string, imeis?: string[]): Promise<GpsPoint[]> {
    let url = `${this.baseUrl}/api/LastLocation?Token=${encodeURIComponent(token)}`;
    if (imeis?.length) {
      url += `&Imeis=${encodeURIComponent(imeis.join(","))}`;
    }
    const data = await this.fetchJson<UmbrellaLocation[] | { Data?: UmbrellaLocation[] }>(url);
    const locations = Array.isArray(data) ? data : (data.Data ?? []);
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

      const data = await this.fetchJson<UmbrellaLocation[] | { Data?: UmbrellaLocation[] }>(url);
      const locations = Array.isArray(data) ? data : (data.Data ?? []);

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
    const imei = loc.Imei ?? loc.IMEI;
    const lat = loc.Latitude;
    const lng = loc.Longitude;
    const timeStr = loc.GPSTime ?? loc.GpsTime;

    if (!imei || lat == null || lng == null || !timeStr) return null;

    return {
      imei,
      latitude: lat,
      longitude: lng,
      speed: loc.Speed,
      timestamp: new Date(timeStr),
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
