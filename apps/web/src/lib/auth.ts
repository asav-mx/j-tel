import type { UserMembership } from "@jtel/auth-rbac";
import { getRepos } from "./db";
import { CLERK_CONFIGURADO, clerkListoEnServidor } from "./clerk-estado";
import {
  resolverIdentidadDeDesarrollo,
  type OrigenDeIdentidad,
  type Resuelto,
} from "./identidad-dev";

export * from "./identidad-dev";

/**
 * Quién está preguntando.
 *
 * Paso 1 de auth-rbac: **identidad sin enforcement**. Este archivo aprende a
 * reconocer una sesión real de Clerk y a decir de dónde salió la identidad,
 * pero no bloquea a nadie todavía. Primero comprobamos que podemos entrar;
 * cerrar es el paso siguiente.
 *
 * El orden de preferencia, y por qué:
 *
 *  1. **Sesión de Clerk.** Si hay una, gana siempre. Es la única que no se
 *     puede pedir desde el navegador.
 *  2. **Bypass de desarrollo.** Lo que nos deja entrar mientras el mapeo de
 *     usuarios reales no existe. Ya no es un encabezado abierto — ver abajo.
 *
 * Nada de esto niega acceso. Una identidad sin membresías devuelve la lista
 * vacía y las pantallas siguen abriendo igual que hoy.
 */

const ENCABEZADO_USUARIO = "x-jtel-user";
const ENCABEZADO_TOKEN = "x-jtel-dev-token";

export type Identidad = {
  /**
   * El identificador con el que se buscan membresías, o `null` cuando no hay
   * nadie a quien identificar — pieza 1.e.
   *
   * Es `| null` en el tipo a propósito: obliga a cada pantalla a decidir qué
   * hace sin identidad. Antes esto nunca era nulo porque el código inventaba
   * `tecma_admin`, así que la pregunta no existía y la respuesta era la peor
   * posible.
   */
  userId: string | null;
  origen: OrigenDeIdentidad;
  memberships: UserMembership[];
  clerkConfigurado: boolean;
  /** Hay sesión de Clerk viva en esta petición. */
  sesionActiva: boolean;
  /**
   * Llegó el encabezado de suplantación y se rechazó. Es la señal de que
   * alguien —o algo— intentó elegir identidad desde el navegador.
   */
  encabezadoRechazado: boolean;
};

/** La sesión de Clerk, o `null` si no hay o si Clerk no está configurado. */
async function usuarioDeClerk(): Promise<string | null> {
  if (!clerkListoEnServidor()) return null;
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    /*
     * `auth()` lanza si la petición no pasó por clerkMiddleware. Pasa en rutas
     * que el matcher no cubre. No es motivo para tumbar una pantalla mientras
     * no estemos protegiendo nada: se cae al bypass y `/quien-soy` lo enseña.
     */
    return null;
  }
}

export async function getIdentidad(): Promise<Identidad> {
  const { headers } = await import("next/headers");
  const headerStore = await headers();

  const deClerk = await usuarioDeClerk();
  const resuelto: Resuelto = deClerk
    ? { userId: deClerk, origen: "clerk", encabezadoRechazado: false }
    : resolverIdentidadDeDesarrollo({
        pedido: headerStore.get(ENCABEZADO_USUARIO),
        token: headerStore.get(ENCABEZADO_TOKEN),
        enProduccion: process.env.NODE_ENV === "production",
        secretoEsperado: process.env.JTEL_DEV_TOKEN,
        usuarioPorVariable: process.env.JTEL_DEV_USER,
      });

  /*
   * Sin identificador no se consulta la base. No es una optimización: buscar
   * membresías de `null` es una pregunta sin sentido, y una consulta sin
   * sentido es la clase de cosa que un día devuelve algo.
   */
  const memberships: UserMembership[] = resuelto.userId
    ? (await getRepos().memberships.findForUser(resuelto.userId)).map((row) => ({
        accountId: row.accountId,
        clerkUserId: row.clerkUserId,
        role: row.role,
        scopeType: row.scopeType,
        scopeId: row.scopeId,
      }))
    : [];

  return {
    userId: resuelto.userId,
    origen: resuelto.origen,
    memberships,
    clerkConfigurado: CLERK_CONFIGURADO,
    sesionActiva: deClerk !== null,
    encabezadoRechazado: resuelto.encabezadoRechazado,
  };
}

/** La forma que ya consumían los llamadores existentes. */
export async function getAccessContext(): Promise<{
  clerkUserId: string | null;
  memberships: UserMembership[];
}> {
  const { userId, memberships } = await getIdentidad();
  return { clerkUserId: userId, memberships };
}

export async function getClientMemberships(accountId?: string) {
  const ctx = await getAccessContext();
  if (accountId) {
    return ctx.memberships.filter((m) => m.accountId === accountId);
  }
  const repos = getRepos();
  const accounts = await Promise.all(
    ctx.memberships.map((m) => repos.accounts.findById(m.accountId)),
  );
  return ctx.memberships.filter((_, i) => accounts[i]?.type === "client");
}

export async function getCarrierMemberships() {
  const ctx = await getAccessContext();
  const repos = getRepos();
  const memberships = [];
  for (const m of ctx.memberships) {
    const account = await repos.accounts.findById(m.accountId);
    if (account?.type === "carrier") memberships.push(m);
  }
  return memberships;
}

export async function getCarrierMembership() {
  const memberships = await getCarrierMemberships();
  return memberships[0] ?? null;
}

export async function getJStaffMemberships() {
  const ctx = await getAccessContext();
  const repos = getRepos();
  const memberships = [];
  for (const m of ctx.memberships) {
    const account = await repos.accounts.findById(m.accountId);
    if (account?.type === "jstaff") memberships.push(m);
  }
  return memberships;
}
