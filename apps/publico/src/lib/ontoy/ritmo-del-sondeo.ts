/**
 * Cuánto esperar antes del siguiente sondeo de unidades.
 *
 * ## Por qué existe: el 429 del firewall
 *
 * `/api/circuitos/*` lleva un límite de peticiones por IP en el firewall de
 * Vercel (ver `docs/Procedimiento-Firewall-Publico.md`). Cuando muerde, contesta
 * **429** y no llega a la función. Insistir cada quince segundos contra un 429
 * no trae dato y sí sigue contando contra el mismo límite —que además comparte
 * todo teléfono detrás de la misma IP de la compañía celular—, así que la app
 * **se aparta**: espera lo que el servidor pida, o dobla la espera, hasta un
 * tope. Al primer éxito vuelve a los quince segundos.
 *
 * Cualquier otra falla (sin red, un 500) conserva el ritmo normal: ahí no hay
 * nadie pidiendo que se baje el paso, y el dato de hace un rato sigue en
 * pantalla con su edad (ver `ruta-en-vivo.ts`).
 *
 * Es función pura para poder probarla sin reloj ni red.
 */

/** Ritmo normal: el TTL del CDN. Más seguido no trae dato más fresco. */
export const SONDEO_MS = 15_000;

/** Tope de la espera tras un 429: nadie se queda sin preguntar más de dos minutos. */
export const TOPE_ESPERA_MS = 120_000;

/**
 * @param status      estado HTTP de la respuesta, o `null` si ni siquiera hubo respuesta
 * @param retryAfter  el encabezado `Retry-After` tal cual llegó (segundos), si llegó
 * @param esperaAntes la espera que se usó para llegar a este sondeo
 */
export function proximaEspera(
  status: number | null,
  retryAfter: string | null,
  esperaAntes: number,
): number {
  if (status !== 429) return SONDEO_MS;

  // El servidor dijo cuánto: se le hace caso, dentro de [ritmo normal, tope].
  const segundos = retryAfter === null ? NaN : Number(retryAfter.trim());
  if (Number.isFinite(segundos) && segundos > 0) {
    return Math.min(TOPE_ESPERA_MS, Math.max(SONDEO_MS, segundos * 1000));
  }

  // No lo dijo: se dobla la espera anterior, hasta el tope.
  return Math.min(TOPE_ESPERA_MS, Math.max(SONDEO_MS, esperaAntes) * 2);
}
