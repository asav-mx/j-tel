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
  admin: ["fleet.manage", "fleet.read", "compliance.read", "report.read"],
  coordinador: ["fleet.manage", "routes.manage", "compliance.read"],
  despacho: ["fleet.read", "monitor.live"],
  mantenimiento: ["maintenance.manage", "fleet.read"],
  chofer: ["self.read"],
};

export function hasPermission(membership: UserMembership, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[membership.role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export function canAccessPlant(
  memberships: UserMembership[],
  plantId: string,
  clientAccountId: string,
): boolean {
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
