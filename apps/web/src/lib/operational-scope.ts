import type { OperationalScope, OperationalUnit } from "@jtel/domain";
import { contractMatchesScope as domainContractMatchesScope, operationalUnitLabel } from "@jtel/domain";

export function contractMatchesScope(
  contract: { plantId?: string | null; plantGroupId?: string | null },
  scope: OperationalScope,
): boolean {
  return domainContractMatchesScope(contract, scope);
}

export function parseScopeFromSearchParams(
  sp: Record<string, string | string[] | undefined> | undefined,
): OperationalScope | null {
  const plant = typeof sp?.plant === "string" ? sp.plant : null;
  const group = typeof sp?.group === "string" ? sp.group : null;
  if (plant && !group) return { kind: "plant", plantId: plant };
  if (group && !plant) return { kind: "plant_group", plantGroupId: group };
  return null;
}

export function scopeQueryParams(scope: OperationalScope): Record<string, string> {
  if (scope.kind === "plant") return { plant: scope.plantId };
  return { group: scope.plantGroupId };
}

export function findOperationalUnit(
  units: OperationalUnit[],
  scope: OperationalScope | null,
): OperationalUnit | null {
  if (!scope) return null;
  return units.find((u) => u.id === (scope.kind === "plant" ? scope.plantId : scope.plantGroupId)) ?? null;
}

export function unitHref(basePath: string, accountSlug: string, unit: OperationalUnit): string {
  const params = new URLSearchParams({ account: accountSlug });
  if (unit.kind === "plant") params.set("plant", unit.id);
  else params.set("group", unit.id);
  return `${basePath}?${params.toString()}`;
}

export { operationalUnitLabel };
