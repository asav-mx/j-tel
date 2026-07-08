/**
 * Configuración del proveedor GPS Umbrella leída de variables de entorno.
 * Acepta UMBRELLA_GPS_URL (nombre que usamos en Vercel/.env) y también
 * UMBRELLA_GPS_BASE_URL por compatibilidad.
 */
export function getUmbrellaConfig() {
  return {
    umbrellaBaseUrl:
      process.env.UMBRELLA_GPS_URL ??
      process.env.UMBRELLA_GPS_BASE_URL ??
      "http://gps2.umbrellasoluciones.com",
    umbrellaUserId: process.env.UMBRELLA_GPS_USERID ?? "",
    umbrellaPassword: process.env.UMBRELLA_GPS_PASSWORD ?? "",
  };
}
