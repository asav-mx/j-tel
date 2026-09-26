import { createHash, timingSafeEqual } from "node:crypto";
import { yaArrancoElServicio } from "@jtel/domain/publico";

/**
 * **La llave de ensayo** — un teléfono ve las rutas como si ya hubieran
 * arrancado; el público, no (decisión de ASAV, 25-sep-2026, para el ensayo
 * general del martes 29 con un camión real y la ruta arrancando el 1 de octubre).
 *
 * Antes de su fecha de arranque, el servidor no manda ningún camión de una ruta
 * (`unidadesDeLaRuta`): publicar el camión de un ensayo lo volvería un servicio,
 * y a alguien parado en la banqueta le diría que ya puede subirse. Esa regla NO
 * cambia. Lo que esta llave agrega es **una puerta aparte**
 * (`/api/circuitos/en-vivo/ensayo`) que se salta la fecha — y sólo la fecha —
 * para quien traiga la llave.
 *
 * ## Las cuatro cosas que la hacen segura, y ninguna sobra
 *
 * 1. **Es un secreto, no una palabra.** Vive en la variable de entorno
 *    `ONTOY_LLAVE_ENSAYO` de Vercel y en ningún otro lado: ni en el repo, ni en
 *    el PR, ni en una captura. Una llave de menos de 32 caracteres cuenta como
 *    apagada: una palabra que se adivina no es una llave.
 * 2. **Viaja en una cabecera, nunca en una dirección.** Una dirección se
 *    queda en bitácoras y en historiales. El teléfono la recibe en el
 *    fragmento (`#ensayo=…`), que el navegador no manda al servidor, y de ahí
 *    en adelante sólo sale en la cabecera `x-ontoy-ensayo`.
 * 3. **La respuesta de ensayo no se guarda en ningún lado.** `private,
 *    no-store` para el navegador y `no-store` explícito para el CDN de Vercel.
 *    La consulta pública, en cambio, sí se comparte 15 s en el CDN entre todos
 *    los teléfonos: si una respuesta de ensayo se colara ahí, el público vería
 *    camiones antes del arranque. Lo cuida `en-vivo/ensayo/route.test.ts`.
 * 4. **Llave mala y llave apagada contestan lo mismo**: 404, sin cuerpo que
 *    distinga. Quien pruebe llaves no aprende si la puerta existe.
 *
 * ## Qué NO cambia
 *
 * **Nada después de la fecha de arranque**: pasada la fecha, la ruta ya arrancó
 * para todos y la llave no agrega nada (`arrancoParaEstaConsulta`). Tampoco
 * cambian el horario, la frescura del dato, el corredor ni la publicación: una
 * ruta sin publicar sigue sin existir, con o sin llave.
 *
 * ## Cómo se apaga
 *
 * Borrando `ONTOY_LLAVE_ENSAYO` en Vercel y volviendo a desplegar. Desde ese
 * despliegue la puerta contesta 404 a todos, y el teléfono que tenía la llave la
 * olvida solo en su siguiente consulta.
 */

/** El nombre exacto de la variable de entorno. El valor lo pone ASAV en Vercel. */
export const VARIABLE_DE_LA_LLAVE = "ONTOY_LLAVE_ENSAYO";

/** La cabecera en la que el teléfono manda la llave. */
export const CABECERA_DE_LA_LLAVE = "x-ontoy-ensayo";

/** Por debajo de esto, la llave cuenta como apagada. */
export const LARGO_MINIMO_DE_LA_LLAVE = 32;

/**
 * Lo que lleva **toda** respuesta de la puerta de ensayo —la buena y el 404—:
 * que no se guarde en ningún lado.
 *
 * - `cache-control: private, no-store`: el navegador y cualquier intermediario.
 * - `cdn-cache-control` y `vercel-cdn-cache-control: no-store`: el CDN de
 *   Vercel lee éstas **antes** que `cache-control`; se ponen explícitas para que
 *   ninguna regla futura del proyecto pueda volver a prender la caché del CDN
 *   sobre esta dirección por la puerta de atrás.
 */
export const CABECERAS_DE_ENSAYO: Readonly<Record<string, string>> = {
  "cache-control": "private, no-store, max-age=0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

const huella = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * ¿Abre esta cabecera la puerta de ensayo?
 *
 * Se comparan las huellas, no las cadenas, y con `timingSafeEqual`: comparar
 * texto se detiene en el primer carácter distinto, y el tiempo de respuesta
 * dejaría adivinar la llave de a un carácter.
 */
export function llaveDeEnsayoValida(
  cabecera: string | null,
  entorno: Record<string, string | undefined> = process.env,
): boolean {
  const llave = (entorno[VARIABLE_DE_LA_LLAVE] ?? "").trim();
  if (llave.length < LARGO_MINIMO_DE_LA_LLAVE) return false;
  if (!cabecera) return false;
  return timingSafeEqual(huella(cabecera.trim()), huella(llave));
}

/**
 * ¿Ya arrancó la ruta, **para esta consulta**?
 *
 * La de ensayo la da por arrancada; la pública pregunta a la fecha. Pasada la
 * fecha las dos dicen lo mismo, y ésa es la promesa de «nada cambia después del
 * arranque» escrita en una línea.
 */
export function arrancoParaEstaConsulta(
  ahora: Date,
  fechaDeArranque: string | null,
  zona: string,
  ensayo: boolean,
): boolean {
  return ensayo || yaArrancoElServicio(ahora, fechaDeArranque, zona);
}
