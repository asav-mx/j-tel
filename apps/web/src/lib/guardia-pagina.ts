import { redirect } from "next/navigation";
import { decidir, type Audiencia, type Decision } from "@/lib/guardia-api";
import { getIdentidad, type Identidad } from "@/lib/auth";

/**
 * La guardia de las páginas — hermana de `guardia-api.ts`.
 *
 * Las 26 rutas de API están protegidas desde el #134. **Las páginas no:** llaman
 * a `getRepos()` directo y renderizan, sin pasar por ninguna guardia.
 * `middleware.ts` solo adjunta la sesión; proteger exige preguntar, y eso es lo
 * que vive aquí.
 *
 * Comparte la decisión con la guardia de API —`decidir`, importada, no copiada—
 * porque la regla de alcance es una sola. Lo único que cambia es la forma de
 * decir que no: la API contesta 403; una página **redirige**, porque un JSON de
 * error en una pestaña deja al usuario mirando texto crudo.
 *
 * ## Por qué no basta con «¿hay identidad?»
 *
 * Ésta es la parte que hay que leer antes de tocar este archivo.
 *
 * Mientras el bypass de desarrollo viva, **`getIdentidad()` siempre devuelve
 * alguien**: si no hay sesión de Clerk, cae a `JTEL_DEV_USER` y, si tampoco,
 * al heredado `tecma_admin`. En producción `JTEL_DEV_USER=jstaff_admin` está
 * puesto, así que **un visitante anónimo *es* `jstaff_admin`, con sus
 * membresías**. Una guardia que preguntara «¿hay identidad?» pasaría a todo el
 * mundo y se vería exactamente igual que una que funciona.
 *
 * Por eso en producción se exige **sesión de Clerk real** (`sesionActiva`), no
 * identidad a secas. Fuera de producción se acepta el bypass: es lo que permite
 * trabajar en local y en CI sin llaves de Clerk.
 *
 * El corte es `NODE_ENV === "production"`, la misma señal que ya usa
 * `identidad-dev.ts` para cerrar el bypass por encabezado. **No se usa
 * `clerkConfigurado`**: si alguien despliega producción sin las llaves, con esa
 * condición la guardia se abriría sola — el patrón de los defaults que fallan
 * abiertos. Con ésta, ese despliegue deja a todos fuera, que es el lado
 * correcto en el que equivocarse.
 *
 * ## Falla cerrado
 *
 * Si no se puede resolver la identidad o comprobar la membresía, no se pasa.
 * Una guardia que se cae y deja pasar no es una guardia.
 */

/** A dónde va quien no pasa. Es la pantalla que explica quién eres y ofrece entrar. */
export const DESTINO_SIN_PASO = "/quien-soy";

/**
 * Por qué no pasó. Se manda como código corto en la URL, **nunca el nombre de
 * una cuenta ni la identidad**: el destino es una pantalla que ve cualquiera,
 * y un motivo detallado ahí filtraría justo lo que la guardia protege.
 */
export type MotivoDeNegativa =
  | "identidad-irresoluble"
  | "sin-sesion"
  | "sin-alcance"
  | "membresia-irresoluble";

export type VeredictoDePagina =
  | { ok: true; identidad: Identidad }
  | { ok: false; motivo: MotivoDeNegativa };

/**
 * ¿Esta identidad sirve para entrar?
 *
 * Se exporta porque **la portada la necesita sin redirigir**: la raíz no niega
 * el paso, elige qué cara enseñar —landing sin sesión, portada con ella—. Si
 * la portada llevara su propia copia de esta condición, las dos se separarían
 * a la primera vez que alguien corrigiera una y olvidara la otra, y la que se
 * quedaría vieja sería justo la que decide si se enseñan nombres de clientes.
 *
 * En producción: sesión de Clerk real. Fuera: vale el bypass, o no se puede
 * trabajar en local ni en CI.
 */
export function sesionUtilizable(
  identidad: Identidad,
  entorno: { enProduccion?: boolean } = {},
): boolean {
  const enProduccion = entorno.enProduccion ?? process.env.NODE_ENV === "production";
  return !enProduccion || identidad.sesionActiva;
}

/**
 * La decisión, sin redirigir.
 *
 * Vive aparte de `exigirEnPagina` a propósito: `redirect()` funciona lanzando
 * una excepción que Next intercepta, así que no se puede probar en una aserción
 * normal ni llamarse desde dentro de un `try`. Mismo reparto que
 * `identidad-dev.ts` — la decisión pura de un lado, el efecto del otro.
 */
export async function decidirPagina(
  audiencia: Audiencia,
  entorno: { enProduccion?: boolean } = {},
): Promise<VeredictoDePagina> {
  let identidad: Identidad;
  try {
    identidad = await getIdentidad();
  } catch {
    return { ok: false, motivo: "identidad-irresoluble" };
  }

  // Antes que el alcance: sin sesión real no hay a quién medirle el alcance.
  if (!sesionUtilizable(identidad, entorno)) {
    return { ok: false, motivo: "sin-sesion" };
  }

  let decision: Decision;
  try {
    decision = await decidir(identidad, audiencia);
  } catch {
    return { ok: false, motivo: "membresia-irresoluble" };
  }

  if (!decision.permitido) return { ok: false, motivo: "sin-alcance" };

  return { ok: true, identidad };
}

/**
 * Lo que llaman las páginas. Devuelve la identidad, o no vuelve.
 *
 * ⚠ **`/quien-soy` no se guarda con esto.** Es el destino de la negativa, así
 * que guardarla haría un bucle de redirecciones. Es también la única pantalla
 * que tiene sentido ver sin haber entrado.
 */
export async function exigirEnPagina(audiencia: Audiencia): Promise<Identidad> {
  const veredicto = await decidirPagina(audiencia);
  if (veredicto.ok) return veredicto.identidad;

  // Fuera de cualquier `try`: `redirect()` lanza a propósito, y un catch de
  // más lo convertiría en «no pasó nada» — la página seguiría renderizando.
  redirect(`${DESTINO_SIN_PASO}?motivo=${veredicto.motivo}`);
}
