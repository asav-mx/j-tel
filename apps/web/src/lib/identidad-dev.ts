import { createHash, timingSafeEqual } from "node:crypto";

/**
 * El bypass de desarrollo, sin base de datos ni encabezados.
 *
 * Vive aparte de `auth.ts` a propósito: es la única parte del arranque de
 * auth-rbac donde un error se convierte en un agujero, así que tiene que
 * poder probarse sola. Mismo patrón que `diagnostico-lectura.ts` — la decisión
 * pura de un lado, lo que toca la base del otro.
 */

/**
 * De dónde salió la identidad. Se muestra en pantalla a propósito: mientras
 * esto no diga `clerk` para todos, auth-rbac no está terminado.
 */
export type OrigenDeIdentidad =
  | "clerk"
  | "encabezado-dev"
  | "variable-dev"
  | "default-heredado";

/** El usuario que el código asume cuando no hay ninguna otra señal. */
export const USUARIO_HEREDADO = "tecma_admin";

export type Resuelto = {
  userId: string;
  origen: OrigenDeIdentidad;
  encabezadoRechazado: boolean;
};

export type EntornoDeIdentidad = {
  /** Lo que pidió el encabezado `x-jtel-user`. */
  pedido: string | null;
  /** Lo que trajo `x-jtel-dev-token`. */
  token: string | null;
  /** `true` cuando corre en producción. */
  enProduccion: boolean;
  /** `JTEL_DEV_TOKEN` del servidor. */
  secretoEsperado: string | undefined;
  /** `JTEL_DEV_USER` del servidor. */
  usuarioPorVariable: string | undefined;
};

/**
 * Comparación en tiempo constante. Se compara el digest y no el texto para que
 * dos largos distintos no hagan lanzar a `timingSafeEqual`, que exige búferes
 * del mismo tamaño — y para que el largo del secreto tampoco se filtre.
 */
function igualEnTiempoConstante(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

/**
 * ¿Se puede elegir identidad con un encabezado en esta petición?
 *
 * Antes la respuesta era «siempre», y eso convertía `x-jtel-user` en un
 * selector de usuario abierto a quien supiera el nombre del encabezado. Hoy
 * todavía no era una escalación de privilegios —no había nada que comprobara
 * membresías— pero se volvía una el día que empezáramos a confiar en esto. Por
 * eso se cierra ahora, antes de conectar la sesión, y no después.
 *
 * Fuera de producción sigue abierto: es la herramienta con la que se prueban
 * varios usuarios sin redesplegar. En producción exige un secreto de servidor,
 * que es lo que nos permite seguir cambiando de usuario en un preview sin
 * dejarle esa palanca a cualquiera que llegue a la URL.
 */
export function bypassPorEncabezadoPermitido(
  e: Pick<EntornoDeIdentidad, "token" | "enProduccion" | "secretoEsperado">,
): boolean {
  if (!e.enProduccion) return true;
  if (!e.secretoEsperado || !e.token) return false;
  return igualEnTiempoConstante(e.token, e.secretoEsperado);
}

/** La decisión completa del bypass. */
export function resolverIdentidadDeDesarrollo(e: EntornoDeIdentidad): Resuelto {
  const porVariable = e.usuarioPorVariable;

  if (e.pedido) {
    if (bypassPorEncabezadoPermitido(e)) {
      return { userId: e.pedido, origen: "encabezado-dev", encabezadoRechazado: false };
    }
    // Se ignora entero y se deja constancia; nunca se acepta a medias.
    return {
      userId: porVariable || USUARIO_HEREDADO,
      origen: porVariable ? "variable-dev" : "default-heredado",
      encabezadoRechazado: true,
    };
  }

  if (porVariable) {
    return { userId: porVariable, origen: "variable-dev", encabezadoRechazado: false };
  }

  /*
   * El default heredado. Se conserva porque quitarlo hoy dejaría sin identidad
   * a todas las pantallas que hoy funcionan, y este paso no cierra puertas —
   * pero sale nombrado en `/quien-soy` para que se vea que es una muleta y no
   * una decisión.
   */
  return { userId: USUARIO_HEREDADO, origen: "default-heredado", encabezadoRechazado: false };
}
