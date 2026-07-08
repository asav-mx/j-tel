/**
 * Configuración del proveedor GPS Umbrella leída de variables de entorno.
 *
 * La API de Umbrella vive bajo el prefijo `/openapi` (ej.
 * http://gps2.umbrellasoluciones.com/openapi/api/Login). Normalizamos la URL
 * para que funcione aunque la variable se configure sin ese sufijo.
 */
function normalizeUmbrellaBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/\/openapi$/i.test(trimmed)) return trimmed;
  return `${trimmed}/openapi`;
}

export function getUmbrellaConfig() {
  const rawUrl =
    process.env.UMBRELLA_GPS_URL ??
    process.env.UMBRELLA_GPS_BASE_URL ??
    "http://gps2.umbrellasoluciones.com/openapi";

  return {
    umbrellaBaseUrl: normalizeUmbrellaBaseUrl(rawUrl),
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  };
}
