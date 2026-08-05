import { igualEnTiempoConstante } from "./comparacion-segura";

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
  /**
   * Nadie. **No es un usuario**: es la ausencia de uno.
   *
   * Reemplaza a `default-heredado`, que devolvía `tecma_admin` —un admin
   * corporativo de un cliente REAL— cuando no había ninguna señal. Pieza 1.e.
   */
  | "anonimo";

export type Resuelto = {
  /**
   * `null` cuando no hay a quién identificar, y por eso no es `string`.
   *
   * La regla ganada por las malas número 4 dice que si el default es un
   * secreto, credencial, identidad o URL de base, no lleva default: revienta.
   * Aquí «revienta» toma la forma honesta para una identidad: **no hay
   * ninguna**, dicho en el tipo, para que cada consumidor tenga que decidir qué
   * hace sin nadie en vez de recibir a alguien que nadie eligió.
   */
  userId: string | null;
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
      userId: porVariable ?? null,
      origen: porVariable ? "variable-dev" : "anonimo",
      encabezadoRechazado: true,
    };
  }

  if (porVariable) {
    return { userId: porVariable, origen: "variable-dev", encabezadoRechazado: false };
  }

  /*
   * Nadie. Aquí vivía el default heredado: sin sesión de Clerk, sin encabezado
   * válido y sin `JTEL_DEV_USER`, el código devolvía `tecma_admin` — un admin
   * corporativo de una cuenta de cliente REAL, con todas sus membresías.
   *
   * Se conservaba porque quitarlo dejaba sin identidad a pantallas que no
   * tenían guardia. Ya la tienen: las 65 de la pieza 1.c. La muleta era lo
   * único que faltaba retirar, y mientras estuvo puesta el peor fallo posible
   * —quedarse sin ninguna señal— entregaba el acceso más ancho que hay en una
   * cuenta de cliente.
   *
   * Ahora no hay nadie, y eso es lo que se devuelve. Quien no pueda funcionar
   * sin identidad, que lo diga; lo que no puede pasar es que se la inventemos.
   */
  return { userId: null, origen: "anonimo", encabezadoRechazado: false };
}
