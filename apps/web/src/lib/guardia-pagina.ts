import { notFound, redirect } from "next/navigation";
import { canAccessCarrierAccount, canAccessClientAccount } from "@jtel/auth-rbac";
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
 * Mientras el bypass de desarrollo viva, **`getIdentidad()` sigue devolviendo
 * alguien en producción**: si no hay sesión de Clerk cae a `JTEL_DEV_USER`, y
 * ahí `jstaff_admin` está puesto en Vercel — así que **un visitante anónimo
 * *es* `jstaff_admin`, con sus membresías**. Una guardia que preguntara «¿hay
 * identidad?» pasaría a todo el mundo y se vería exactamente igual que una que
 * funciona.
 *
 * (Desde la pieza 1.e ya no hay un tercer escalón: sin sesión y sin
 * `JTEL_DEV_USER`, `getIdentidad()` devuelve `userId: null`. Eso cierra el
 * caso de local y CI, **no** el de producción, donde la variable sí está
 * puesta. La razón de esta guardia no cambió ni un milímetro.)
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

/**
 * A dónde va quien no pasa.
 *
 * Era `/quien-soy` — pantalla de **diagnóstico**: origen de la identidad,
 * conteo de membresías, si el encabezado de suplantación fue rechazado. Mandar
 * ahí a quien solo quiere entrar es hacerle leer el tablero del taller para
 * abrir la puerta. Desde la pieza 1.i el destino es `/entrar`, que es una
 * puerta y nada más; `/quien-soy` sigue existiendo, y se llega a ella desde
 * ahí.
 *
 * Lo que **no** cambia: el motivo viaja como código corto, nunca el nombre de
 * una cuenta ni la identidad. El destino sigue siendo una pantalla que ve
 * cualquiera.
 */
export const DESTINO_SIN_PASO = "/entrar";

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
 * ⚠ **`/entrar` no se guarda con esto**, y `/quien-soy` tampoco. La primera es
 * el destino de la negativa —guardarla haría un bucle de redirecciones— y las
 * dos son las únicas pantallas que tienen sentido ver sin haber entrado.
 */
export async function exigirEnPagina(audiencia: Audiencia): Promise<Identidad> {
  const veredicto = await decidirPagina(audiencia);
  if (veredicto.ok) return veredicto.identidad;

  // Fuera de cualquier `try`: `redirect()` lanza a propósito, y un catch de
  // más lo convertiría en «no pasó nada» — la página seguiría renderizando.
  redirect(`${DESTINO_SIN_PASO}?motivo=${veredicto.motivo}`);
}

/**
 * Solo la sesión, sin preguntar por alcance.
 *
 * Es la pregunta que se puede contestar **sin leer un dato de nadie**, y por eso
 * sirve de puerta para una cara entera —las 41 pantallas de `/cliente`,
 * incluidas las que aún no existen— mientras el alcance se decide más adentro,
 * donde ya se sabe qué recurso se está mirando.
 *
 * No es un sustituto de la guardia de alcance: es la mitad que se puede cerrar
 * antes de saber contra qué comparar.
 */
export async function exigirSesion(): Promise<Identidad> {
  let identidad: Identidad;
  try {
    identidad = await getIdentidad();
  } catch {
    redirect(`${DESTINO_SIN_PASO}?motivo=identidad-irresoluble`);
  }

  if (!sesionUtilizable(identidad)) {
    redirect(`${DESTINO_SIN_PASO}?motivo=sin-sesion`);
  }

  return identidad;
}

export type VeredictoDeRecurso =
  | { ok: true; identidad: Identidad; cuenta: string }
  | { ok: false; motivo: "sin-sesion" | "identidad-irresoluble" }
  /** Ni existe ni es tuyo. **Son el mismo caso a propósito.** */
  | { ok: false; motivo: "inexistente-o-ajeno" };

/**
 * Contra qué pared se mide la pertenencia.
 *
 * **Va explícita y no tiene default.** Un default a `"cliente"` convertiría a
 * la pantalla de transportista que se olvide de declararla en una guardia que
 * pregunta por la tabla equivocada — y ésa es la peor forma del fallo, porque
 * **se ve exactamente igual que una que funciona**: devuelve un veredicto,
 * niega a los extraños y deja pasar al dueño. Solo se equivoca con las
 * membresías que distinguen a las dos caras, que hoy son pocas y mañana no.
 *
 * Es la misma regla de los defaults que fallan abiertos, aplicada a la
 * pregunta en vez de al valor.
 */
export type AudienciaDeRecurso = "cliente" | "carrier";

const ALCANZA: Record<
  AudienciaDeRecurso,
  (memberships: Identidad["memberships"], cuenta: string) => boolean
> = {
  cliente: canAccessClientAccount,
  carrier: canAccessCarrierAccount,
};

/**
 * La decisión para una pantalla que cuelga de un recurso, sin efectos.
 *
 * ## La cuenta sale de la fila, nunca de la URL
 *
 * Lo único que la petición aporta es un id, y **un id no dice de quién es** —
 * eso lo dice la base. `?account=` deja de participar en la decisión: antes
 * `/cliente/servicio/[id]` hacía `accountSlug ?? data.clientSlug`, o sea **el
 * parámetro ganaba sobre el recurso**, que es dejar que la petición elija
 * contra quién se la compara. Ahora el recurso manda siempre y el parámetro
 * sobrevive solo para pintar enlaces.
 *
 * ## Por qué «no existe» y «no es tuyo» contestan lo mismo
 *
 * Si se vieran distinto, un extraño podría **enumerar ids y aprender qué
 * servicios existen** sin ver ninguno. Los dos caen en `inexistente-o-ajeno`, y
 * quien llama contesta 404 a los dos. **La existencia de un servicio solo es
 * distinguible desde dentro de la cuenta que lo posee.**
 *
 * Queda un límite conocido y escrito en el plan: los dos 404 **no son
 * indistinguibles en el tiempo** —uno hace una consulta, el otro dos—. No se
 * cierra aquí.
 *
 * ## El orden
 *
 * 1. sesión — **cero consultas**
 * 2. procedencia — **una consulta, una columna**
 * 3. autorizar — ninguna
 * 4. y recién entonces, quien llama carga la pantalla
 */
export async function decidirRecurso(
  audiencia: AudienciaDeRecurso,
  duenoDelRecurso: () => Promise<string | null>,
  entorno: { enProduccion?: boolean } = {},
): Promise<VeredictoDeRecurso> {
  let identidad: Identidad;
  try {
    identidad = await getIdentidad();
  } catch {
    return { ok: false, motivo: "identidad-irresoluble" };
  }

  // Antes de tocar el recurso. Así la negativa por falta de sesión es idéntica
  // exista o no el id, y no filtra nada por sí misma.
  if (!sesionUtilizable(identidad, entorno)) return { ok: false, motivo: "sin-sesion" };

  let cuenta: string | null;
  try {
    cuenta = await duenoDelRecurso();
  } catch {
    // Ante la duda, no. Y con la misma cara que un id inexistente.
    return { ok: false, motivo: "inexistente-o-ajeno" };
  }

  if (!cuenta) return { ok: false, motivo: "inexistente-o-ajeno" };
  if (!ALCANZA[audiencia](identidad.memberships, cuenta)) {
    return { ok: false, motivo: "inexistente-o-ajeno" };
  }

  return { ok: true, identidad, cuenta };
}

/**
 * Lo que llaman las pantallas de recurso. Devuelve la cuenta dueña, o no vuelve.
 *
 * Se le pasa **cómo** obtener el dueño, no el dueño ya obtenido: así la lectura
 * de procedencia ocurre **dentro** de la guardia y no antes, que es todo el
 * punto de invertir el orden.
 */
export async function exigirRecurso(
  audiencia: AudienciaDeRecurso,
  duenoDelRecurso: () => Promise<string | null>,
): Promise<{ identidad: Identidad; cuenta: string }> {
  const v = await decidirRecurso(audiencia, duenoDelRecurso);
  if (v.ok) return { identidad: v.identidad, cuenta: v.cuenta };

  // Los dos lanzan; ninguno va dentro de un `try`.
  if (v.motivo === "inexistente-o-ajeno") notFound();
  redirect(`${DESTINO_SIN_PASO}?motivo=${v.motivo}`);
}
