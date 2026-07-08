/**
 * Utilidades geográficas para la UI de configuración.
 *
 * La verificación usa "punto dentro de polígono", así que una geocerca de
 * destino se guarda como un polígono. Para que el usuario no tenga que dibujar
 * nada, capturamos un centro (lat, lng) + un radio en metros y generamos un
 * polígono circular aproximado.
 */

const EARTH_METERS_PER_DEGREE_LAT = 111_320;

/**
 * Genera un polígono (aprox. circular) alrededor de un centro.
 * @param lat latitud del centro en grados
 * @param lng longitud del centro en grados
 * @param radiusMeters radio en metros
 * @param points número de vértices (más = más redondo)
 */
export function circlePolygon(
  lat: number,
  lng: number,
  radiusMeters: number,
  points = 24,
): Array<{ lat: number; lng: number }> {
  const latDelta = radiusMeters / EARTH_METERS_PER_DEGREE_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusMeters / (EARTH_METERS_PER_DEGREE_LAT * (cosLat || 1e-6));

  const polygon: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    polygon.push({
      lat: lat + latDelta * Math.sin(angle),
      lng: lng + lngDelta * Math.cos(angle),
    });
  }
  return polygon;
}

/** Parsea un número desde texto de formulario, aceptando coma o punto decimal. */
export function parseNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
