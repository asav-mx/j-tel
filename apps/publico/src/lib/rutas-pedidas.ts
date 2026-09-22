/**
 * Qué rutas pide `/api/circuitos/en-vivo`, leído del `?rutas=` — **sólo las
 * favoritas del pasajero, nunca la ciudad entera** (decisión de ASAV, 22-sep).
 *
 * El endpoint por ruta nació con una regla: «nunca una lista global, se raspa
 * entera con una llamada». Esta consulta la respeta con un TOPE: acepta una
 * lista corta y explícita de rutas, y más allá del tope contesta 400. Quien
 * quiera toda la ciudad tiene que pedir ruta por ruta, igual que antes, y el
 * firewall (prefijo `/api/circuitos/`) cuenta cada petición.
 *
 * La lista se **ordena y se depura** para que el mismo conjunto de favoritas
 * sea la misma dirección para todos: así el CDN la comparte entre teléfonos,
 * como comparte la de una ruta sola.
 */

/** Más favoritas que esto no caben en una pantalla de teléfono; y es lejos de «la ciudad». */
export const MAXIMO_RUTAS = 8;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type RutasPedidas = { ok: true; rutas: string[] } | { ok: false; error: string };

export function rutasPedidas(parametro: string | null): RutasPedidas {
  const rutas = [...new Set((parametro ?? "").split(",").map((s) => s.trim()).filter(Boolean))].sort();
  if (rutas.length === 0) return { ok: false, error: "Falta ?rutas=" };
  if (rutas.some((r) => !SLUG.test(r))) return { ok: false, error: "Ruta mal escrita" };
  if (rutas.length > MAXIMO_RUTAS) return { ok: false, error: `Como mucho ${MAXIMO_RUTAS} rutas por consulta` };
  return { ok: true, rutas };
}

/** La dirección canónica que pide el teléfono: ordenada, sin repetidas. */
export function direccionEnVivo(rutas: string[]): string {
  return `/api/circuitos/en-vivo?rutas=${[...new Set(rutas)].sort().join(",")}`;
}
