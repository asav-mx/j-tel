import type { GpsBackendConfig } from "@jtel/services";
import { getUmbrellaConfig } from "@/lib/umbrella-config";

/**
 * La conexión de plataforma a Compás, leída del ambiente.
 *
 * Una sola para todas las cuentas: Compás es el servidor de J-Tel. Ausente si
 * falta cualquiera de las tres variables, y entonces las cuentas en Compás
 * fallan con un error que las nombra — nunca caen a otro proveedor en silencio.
 */
export function getCompasConfig(): GpsBackendConfig["compas"] {
  const baseUrl = process.env.COMPAS_GPS_URL?.trim().replace(/\/+$/, "");
  const userId = process.env.COMPAS_GPS_USERID?.trim();
  const password = process.env.COMPAS_GPS_PASSWORD;
  if (!baseUrl || !userId || !password) return undefined;
  return { baseUrl, userId, password };
}

/** Todo lo que los crones de GPS necesitan del ambiente. */
export function getGpsBackendConfig(): GpsBackendConfig {
  return { ...getUmbrellaConfig(), compas: getCompasConfig() };
}
