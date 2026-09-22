/**
 * Distancias en el teléfono del pasajero (8.3b).
 *
 * La lista de paradas de la ciudad baja completa y **sin nada del pasajero**;
 * su ubicación se cruza con ella aquí y no sale del aparato.
 *
 * La distancia es **en línea recta**, no caminando: no hay calles en este
 * cálculo. La pantalla lo dice, porque «a 300 m» del otro lado de una vía
 * rápida no son 300 m de camino, y afirmar lo contrario sería afirmar lo que no
 * se midió.
 *
 * ✎ **22-sep-2026 (ASAV).** Esto se llamaba `paradas-cerca.ts` y además escogía
 * las paradas cercanas para una sección propia de Inicio. Esa sección se fundió
 * con la lista de rutas —decían lo mismo, con los mismos números—, así que lo
 * que escogía paradas se fue con ella y aquí quedó sólo la aritmética. El
 * archivo se renombró en vez de quedarse con un nombre que ya no describe lo
 * que hay dentro.
 *
 * Quién escoge ahora la parada por la que se toma una ruta:
 * `lib/ontoy/rutas-cerca.ts`.
 */

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

/** «a 80 m», «a 350 m», «a 1 km». Redondeado: la ubicación de un teléfono no da para más. */
export function distanciaEnPalabras(m: number): string {
  if (m < 100) return `a ${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 950) return `a ${Math.round(m / 50) * 50} m`;
  return `a ${(Math.round(m / 100) / 10).toLocaleString("es-MX")} km`;
}
