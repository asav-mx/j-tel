import { NextResponse } from "next/server";
import { canAccessCarrierAccount, canAccessClientAccount, isJStaff, puedeManejarFlota } from "@jtel/auth-rbac";
import { getIdentidad, type Identidad } from "@/lib/auth";
import { getRepos } from "@/lib/db";

/**
 * La guardia de las rutas de API.
 *
 * De 34 rutas, 26 no comprobaban nada: la identidad venía del cuerpo de la
 * petición —un `clientSlug`, un `carrierSlug`, un `account`— y las rutas
 * operaban sobre lo que dijera. Varias comprobaban coherencia (que el contrato
 * fuera del carrier, que la unidad le perteneciera), pero coherencia no es
 * autorización: comprobaban contra el carrier que el atacante decía ser.
 *
 * Esto conecta por fin las funciones de `@jtel/auth-rbac`, que llevaban meses
 * escritas y sin que nadie las llamara.
 *
 * **Falla CERRADO, y es deliberado.** Si no se puede resolver la identidad —la
 * base caída, Clerk contestando raro— se niega el paso. Es lo contrario del
 * distintivo de identidad del layout, que falla abierto porque es un adorno y
 * no puede tumbar la pantalla que lo hospeda. Aquí la regla se invierte: una
 * guardia que se cae y deja pasar no es una guardia. Ante la duda, no.
 */

export type Audiencia =
  | { tipo: "jstaff" }
  | { tipo: "cliente"; slug: string }
  /**
   * El cliente dueño, identificado por id en vez de por slug. Para rutas que
   * no reciben cuenta: la cuenta se DERIVA del recurso —el contrato de un
   * perfil, por ejemplo— y se comprueba contra ella. Preguntar por el slug
   * ahí sería volver a dejar que la petición eligiera contra quién se compara.
   */
  | { tipo: "cliente-por-id"; accountId: string }
  | { tipo: "carrier"; slug: string }
  /** El carrier dueño, o J-Staff operando de su parte. */
  | { tipo: "carrier-o-jstaff"; slug: string }
  /**
   * Quien **actúa** sobre la flota del carrier: alta, asignar, soltar, baja
   * (C4). Pertenecer a la cuenta no basta — despacho pertenece y no actúa.
   * Ver `puedeManejarFlota`.
   */
  | { tipo: "carrier-maneja-flota"; slug: string };

/**
 * Cómo contestar cuando se niega el paso.
 *
 * 18 de las 26 rutas son formularios HTML que redirigen; contestarles un 403
 * en JSON deja al usuario mirando una página en blanco sin saber qué pasó. Por
 * eso la guardia respeta el estilo de cada ruta.
 */
export type AlFallar = "json" | { redirigirA: string };

export type Guardia =
  | { ok: true; identidad: Identidad }
  | { ok: false; respuesta: NextResponse };

const NEGADO = "No autorizado.";

/**
 * Construye la negativa. Vive FUERA de todo `try`: si esto lanzara desde
 * dentro de un catch, el error real quedaría enmascarado por el genérico —
 * que es justo lo que pasó al escribirlo la primera vez.
 */
function negar(
  request: Request,
  alFallar: AlFallar,
  detalle: string,
  status: 401 | 403 = 403,
): { ok: false; respuesta: NextResponse } {
  if (alFallar === "json") {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: NEGADO, detalle }, { status }),
    };
  }
  // Absoluta contra el origen de la petición, como ya hacen las rutas.
  const url = new URL(alFallar.redirigirA, request.url);
  url.searchParams.set("error", `${NEGADO} ${detalle}`);
  // 303 para que el navegador cambie el POST por un GET al volver.
  return { ok: false, respuesta: NextResponse.redirect(url, 303) };
}

/**
 * ¿La cuenta de este slug existe, es del tipo esperado, y quien pregunta
 * pertenece a ella?
 *
 * El slug se lee de donde la ruta ya lo leía —cuerpo o query—, y aquí se
 * comprueba contra las membresías. Eso cierra el agujero sin reestructurar
 * cada ruta: lo que cambia no es de dónde sale el slug, es que ahora hay que
 * demostrar que te corresponde.
 */
async function perteneceA(
  identidad: Identidad,
  slug: string,
  tipo: "client" | "carrier",
): Promise<boolean> {
  if (!slug) return false;
  const cuenta = await getRepos().accounts.findBySlug(slug);
  if (!cuenta || cuenta.type !== tipo) return false;
  return tipo === "client"
    ? canAccessClientAccount(identidad.memberships, cuenta.id)
    : canAccessCarrierAccount(identidad.memberships, cuenta.id);
}

/**
 * ¿Esta identidad sirve para entrar?
 *
 * **La hacen las dos guardias, la de páginas y la de APIs.** Hasta el 14 de
 * septiembre de 2026 sólo la hacía la de páginas, y `exigir()` preguntaba por
 * membresías sin preguntar por sesión: con `JTEL_DEV_USER` puesta en
 * producción, una petición anónima a cualquier API de J-Staff respondía 200.
 * Medido esa tarde contra `www.j-telemetry.com`. Las pantallas estaban
 * cerradas y las rutas que esas pantallas llaman, abiertas.
 *
 * Se exporta también porque **la portada la necesita sin redirigir**: la raíz
 * no niega el paso, elige qué cara enseñar —landing sin sesión, portada con
 * ella—. Si
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

export type Decision = { permitido: boolean; motivo: string };

/**
 * Quién puede ver qué. **Se exporta para que la guardia de páginas la reutilice**
 * — la regla de alcance es una sola, y dos copias se separan a la primera
 * corrección que alguien haga en una y olvide en la otra. Lo que cambia entre
 * API y página no es la decisión: es cómo se contesta un `no`.
 */
export async function decidir(identidad: Identidad, audiencia: Audiencia): Promise<Decision> {
  switch (audiencia.tipo) {
    case "jstaff":
      return {
        permitido: isJStaff(identidad.memberships),
        motivo: "Esta operación es de J-Staff.",
      };

    case "cliente":
      return {
        permitido: await perteneceA(identidad, audiencia.slug, "client"),
        motivo: "No perteneces a esa cuenta de cliente.",
      };

    case "cliente-por-id":
      return {
        permitido:
          Boolean(audiencia.accountId) &&
          canAccessClientAccount(identidad.memberships, audiencia.accountId),
        motivo: "No perteneces a esa cuenta de cliente.",
      };

    case "carrier":
      return {
        permitido: await perteneceA(identidad, audiencia.slug, "carrier"),
        motivo: "No perteneces a ese carrier.",
      };

    case "carrier-o-jstaff":
      return {
        permitido:
          isJStaff(identidad.memberships) ||
          (await perteneceA(identidad, audiencia.slug, "carrier")),
        motivo: "No perteneces a ese carrier ni eres J-Staff.",
      };

    case "carrier-maneja-flota": {
      // La cuenta se busca por el slug y el permiso se mide contra su id, en la
      // misma membresía que la alcanza.
      const cuenta = audiencia.slug ? await getRepos().accounts.findBySlug(audiencia.slug) : null;
      return {
        permitido: Boolean(cuenta && cuenta.type === "carrier" && puedeManejarFlota(identidad.memberships, cuenta.id)),
        motivo: "Dar de alta, asignar, soltar y dar de baja dispositivos es de coordinador o admin de ese carrier.",
      };
    }
  }
}

export async function exigir(
  request: Request,
  audiencia: Audiencia,
  alFallar: AlFallar,
  entorno: { enProduccion?: boolean } = {},
): Promise<Guardia> {
  let identidad: Identidad;
  try {
    identidad = await getIdentidad();
  } catch {
    // Sin poder saber quién pregunta, no se pasa. Ver la nota de arriba.
    return negar(request, alFallar, "No se pudo resolver la identidad.");
  }

  // Antes que las membresías, igual que en `decidirPagina`: sin sesión real no
  // hay a quién medirle el alcance. Y el mensaje no dice quién «entró», porque
  // sin sesión esa identidad no la eligió nadie.
  if (!sesionUtilizable(identidad, entorno)) {
    return negar(request, alFallar, "Inicia sesión.", 401);
  }

  let decision: Decision;
  try {
    decision = await decidir(identidad, audiencia);
  } catch {
    // La consulta de la cuenta falló. Mismo criterio: ante la duda, no.
    return negar(request, alFallar, "No se pudo comprobar la membresía.");
  }

  if (decision.permitido) return { ok: true, identidad };

  // Decir con quién entraste es lo que permite desatorarse sin abrir el código.
  return negar(request, alFallar, `${decision.motivo} Entraste como ${identidad.userId}.`);
}
