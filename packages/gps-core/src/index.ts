import type { GpsPoint } from "@jtel/domain";

export interface GpsCredentials {
  userId: string;
  password: string;
}

export interface HistoryLocationQuery {
  imeis?: string[];
  beginGmt: Date;
  endGmt: Date;
  startIdx?: number;
  limit?: number;
}

export interface DeviceInfo {
  imei: string;
  label?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  lastUpdate?: Date;
}

export interface GpsProvider {
  readonly name: string;
  login(credentials: GpsCredentials): Promise<string>;
  getDevices(token: string): Promise<DeviceInfo[]>;
  getLastLocations(token: string, imeis?: string[]): Promise<GpsPoint[]>;
  getHistoryLocations(token: string, query: HistoryLocationQuery): Promise<GpsPoint[]>;
}

export interface GpsProviderConfig {
  baseUrl: string;
  credentials: GpsCredentials;
}
