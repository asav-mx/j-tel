import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

/**
 * Las paradas cerca del pasajero, **calculadas en su teléfono** (8.8, 8.3b).
 *
 * La lista de la ciudad baja completa y sin nada del pasajero; aquí se cruza con
 * su ubicación, que no sale del aparato.
 *
 * La distancia es **en línea recta**, no caminando: no hay calles aquí. La
 * pantalla lo dice, porque «a 300 m» del otro lado de una vía rápida no son
 * 300 m de camino, y afirmar lo contrario sería afirmar lo que no se midió.
 */

/** Más allá de esto, ninguna parada es «cercana» y la pantalla lo dice. */
export const RADIO_CERCA_M = 1000;
/** Suficientes para escoger; más ya es la lista de la ciudad. */
export const MAXIMO_CERCA = 5;

export interface ParadaCercana extends ParadaDeLaCiudad {
  distanciaM: number;
}

const R_TIERRA_M = 6_371_000;

/** Distancia entre dos puntos sobre la Tierra (haversine), en metros. */
export function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function paradasCerca(
  yo: { lat: number; lon: number },
  paradas: ParadaDeLaCiudad[],
  { radioM = RADIO_CERCA_M, maximo = MAXIMO_CERCA }: { radioM?: number; maximo?: number } = {},
): ParadaCercana[] {
  return paradas
    .map((p) => ({ ...p, distanciaM: distanciaM(yo, p) }))
    .filter((p) => p.distanciaM <= radioM)
    .sort((a, b) => a.distanciaM - b.distanciaM || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, maximo);
}

/** «a 80 m», «a 350 m», «a 1 km». Redondeado: la ubicación de un teléfono no da para más. */
export function distanciaEnPalabras(m: number): string {
  if (m < 100) return `a ${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 950) return `a ${Math.round(m / 50) * 50} m`;
  return `a ${(Math.round(m / 100) / 10).toLocaleString("es-MX")} km`;
}

/** El sentido en palabras, igual que en la tarjeta de una parada guardada. */
export function sentidoEnPalabras(s: ParadaDeLaCiudad["sentido"]): string {
  return s === "ida" ? "ida" : s === "vuelta" ? "vuelta" : "los dos sentidos";
}
