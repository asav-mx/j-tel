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

/**
 * **Cuándo la ubicación ya no alcanza para decir metros** (auditoría a1, 25-sep).
 *
 * El teléfono dice con qué margen da la posición (`coords.accuracy`, en metros,
 * radio del 95 %). Con GPS son 5–30 m; con wifi o antenas, cientos o miles.
 * Con 3 km de margen la app decía «a 50 m», que es el §D del Marco: el dato
 * correcto —la distancia al punto que dio el teléfono— presentado como un hecho
 * sobre dónde está el pasajero.
 *
 * **El corte es 100 m.** Debajo de 950 m las distancias se dicen de 50 en 50
 * (`distanciaEnPalabras`), y con un margen de más de 100 m ya no se sabe ni el
 * primer dígito de «a 350 m». Arriba del corte **no se dicen metros en ningún
 * lado de la app**: el orden por cercanía se queda, porque sigue siendo la
 * mejor apuesta, y la pantalla dice «más o menos» y el margen.
 */
export const MARGEN_QUE_ALCANZA_M = 100;

/** Imprecisa = el teléfono dio un margen mayor al corte. Sin margen (nulo) no se castiga. */
export function esImprecisa(margenM: number | null | undefined): boolean {
  return typeof margenM === "number" && Number.isFinite(margenM) && margenM > MARGEN_QUE_ALCANZA_M;
}

/**
 * La distancia que la pantalla puede decir, o `null` si no puede.
 *
 * Todas las pantallas pasan por aquí y no por `distanciaEnPalabras` directo:
 * una que se salte la regla volvería a decir «a 50 m» con 3 km de margen.
 */
export function distanciaParaDecir(m: number, margenM: number | null | undefined): string | null {
  return esImprecisa(margenM) ? null : distanciaEnPalabras(m);
}

/** «unos 600 m», «unos 3 km». Hacia arriba: un margen se dice sin achicarlo. */
export function margenEnPalabras(margenM: number): string {
  if (margenM < 950) return `unos ${Math.ceil(margenM / 50) * 50} m`;
  return `unos ${(Math.ceil(margenM / 100) / 10).toLocaleString("es-MX")} km`;
}
