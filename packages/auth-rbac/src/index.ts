import type { ScopeType } from "@jtel/domain";

export interface UserMembership {
  accountId: string;
  clerkUserId: string;
  role: string;
  scopeType: ScopeType;
  scopeId?: string | null;
}

export interface AccessContext {
  memberships: UserMembership[];
  activeAccountId?: string;
}

/**
 * Rol → permisos. **Estar en esta tabla con lista vacía es una declaración, no
 * un olvido**, y la diferencia entre las dos cosas no la puede ver el código.
 *
 * `hasPermission` resuelve `ROLE_PERMISSIONS[rol] ?? []`, así que **un rol que
 * nadie declaró se comporta exactamente igual que uno declarado sin permisos:
 * sin ninguno.** Los dos estados son indistinguibles desde aquí — es la regla 8
 * del plan aplicada a los roles, y es la razón de fondo por la que un rol
 * parqueado se escribe en vez de dejarse fuera.
 *
 * Lo que hace legible la diferencia es la lista de abajo y su prueba, no esta
 * tabla por sí sola.
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin_plataforma: ["*"],
  soporte: ["support.read", "support.diagnose", "support.resync"],
  comercial: ["demo.create", "demo.convert", "account.read"],
  admin_corporativo: ["client.read", "client.manage", "report.read", "contract.read"],
  coord_rutas: ["routes.manage", "occurrence.read"],
  cumplimiento: ["compliance.read", "enforcement.read", "report.read"],
  inspecciones: ["inspection.manage", "compliance.read"],
  procurement: ["contract.manage", "escalation.manage"],
  usuario_planta: ["plant.read", "compliance.read", "inspection.manage"],
  /**
   * El administrador **dentro** de una planta — D10 del plan.
   *
   * Existe porque la regla 2 de D9 lo presupone: «un usuario de planta solo
   * crea usuarios de su planta». Sin este rol, la única forma de que una planta
   * administre a su gente es darle un `admin_corporativo` —que ve todas las
   * plantas de la cuenta— y eso es exactamente lo que esa regla prohíbe.
   *
   * **Parqueado: lista vacía de verdad.** Sus permisos se definen en el frente
   * del alcance fino, junto con 1.h y la pantalla de altas, no antes. Darle
   * permisos hoy sería peor que no tenerlo: un rol que puede administrar sin
   * que exista la pregunta «¿tu alcance cubre esta planta?» administra sobre
   * todo lo que alcance su cuenta.
   */
  admin_planta: [],
  admin: ["fleet.manage", "fleet.read", "compliance.read", "report.read"],
  coordinador: ["fleet.manage", "routes.manage", "compliance.read"],
  despacho: ["fleet.read", "monitor.live"],
  mantenimiento: ["maintenance.manage", "fleet.read"],
  /**
   * Parqueado por `Ficha-Diseno-Permisos.md` §5: «se crea el rol, **sin
   * permisos activos**». Hoy no entra a la aplicación.
   *
   * **Tenía `["self.read"]`, y se retira.** Documento y código decían cosas
   * distintas; **gana la ficha**, que es donde vive la decisión de producto —
   * el permiso nunca fue una decisión, era un marcador de sitio que nadie leyó
   * (cero llamadores, comprobado). Alinear al revés habría sido dejar que un
   * descuido del código reescribiera una decisión de Asav del 31 de julio.
   *
   * Sin efecto observable: ninguna identidad tiene este rol y nadie pregunta
   * por `self.read`.
   */
  chofer: [],
};

/**
 * Los roles que el sistema **declara**, tengan permisos o no.
 *
 * Existe para que «parqueado» sea comprobable. Sin esto, la única forma de
 * saber si un rol está parqueado o simplemente no existe es que alguien se
 * acuerde — y acordarse no es una propiedad del sistema.
 */
export const ROLES_DECLARADOS: readonly string[] = Object.keys(ROLE_PERMISSIONS);

/**
 * Los que existen a propósito y todavía no pueden hacer nada.
 *
 * Se listan aquí, y no se deducen de la tabla, para que **agregarle permisos a
 * uno rompa una prueba** en vez de pasar en silencio. Salir de esta lista es
 * una decisión de producto y tiene que verse como tal en un diff.
 */
export const ROLES_PARQUEADOS: readonly string[] = ["admin_planta", "chofer"];

export function hasPermission(membership: UserMembership, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[membership.role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

/**
 * ¿Esta identidad alcanza toda la plataforma?
 *
 * `global` es uno de los seis alcances del esquema, y significa literalmente
 * eso: **todas las cuentas**. No es un rol ni una excepción — es la respuesta a
 * «sobre qué datos», que la ficha de permisos separa de «qué puede hacer»
 * (`permisos = rol × alcance`). Quien lo tiene cruza cuentas porque ese es su
 * alcance, no porque se le haya hecho un hueco.
 *
 * El Marco lo contempla: las cuentas son privadas **salvo J-Staff por la
 * compuerta de soporte**. Esto es esa compuerta, escrita como regla y no como
 * caso particular — **el código no conoce nombres**, así que no hay identidad
 * ni cuenta privilegiada por su nombre en ningún punto.
 *
 * Lo que NO cambia: un alcance de cuenta sigue viendo su cuenta y nada más.
 */
export function tieneAlcanceGlobal(memberships: UserMembership[]): boolean {
  return memberships.some((m) => m.scopeType === "global");
}

export function canAccessPlant(
  memberships: UserMembership[],
  plantId: string,
  clientAccountId: string,
): boolean {
  if (tieneAlcanceGlobal(memberships)) return true;
  return memberships.some((m) => {
    if (m.accountId !== clientAccountId) return false;
    if (m.scopeType === "account" || m.role === "admin_corporativo") return true;
    if (m.scopeType === "plant" && m.scopeId === plantId) return true;
    return false;
  });
}

export function canAccessClientAccount(
  memberships: UserMembership[],
  clientAccountId: string,
): boolean {
  if (tieneAlcanceGlobal(memberships)) return true;
  return memberships.some(
    (m) =>
      m.accountId === clientAccountId &&
      (m.scopeType === "account" || m.role === "admin_corporativo"),
  );
}

export function canAccessCarrierAccount(
  memberships: UserMembership[],
  carrierAccountId: string,
): boolean {
  if (tieneAlcanceGlobal(memberships)) return true;
  return memberships.some(
    (m) =>
      m.accountId === carrierAccountId &&
      (m.scopeType === "account" || m.scopeType === "fleet"),
  );
}

export function isJStaff(memberships: UserMembership[]): boolean {
  return memberships.some((m) =>
    ["admin_plataforma", "soporte", "comercial"].includes(m.role),
  );
}

export function filterMembershipsForAccount(
  memberships: UserMembership[],
  accountId: string,
): UserMembership[] {
  return memberships.filter((m) => m.accountId === accountId);
}

export function requirePermission(
  memberships: UserMembership[],
  permission: string,
): void {
  if (!memberships.some((m) => hasPermission(m, permission))) {
    throw new Error(`Permiso denegado: ${permission}`);
  }
}
