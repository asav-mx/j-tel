import { withAccount } from "./account-context";
import {
  campusHref as campusUnitHref,
  plantHref as plantUnitHref,
  unitComplianceHref,
} from "./unit-routes";
import type { OperationalUnit } from "@jtel/domain";

/** Dashboard de una planta (unidad operativa o miembro de campus). */
export function plantHref(plantId: string, accountSlug?: string | null) {
  return plantUnitHref(plantId, accountSlug ?? "");
}

/** Dashboard de un campus (unidad operativa compartida). */
export function campusHref(groupId: string, accountSlug?: string | null) {
  return campusUnitHref(groupId, accountSlug ?? "");
}

export function clientHref(path: string, accountSlug?: string | null, plantId?: string | null) {
  const base = withAccount(path, accountSlug);
  if (!plantId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}plant=${encodeURIComponent(plantId)}`;
}

/** Cumplimiento por unidad independiente. */
export function complianceHref(accountSlug?: string | null, plantId?: string | null) {
  if (plantId) {
    const unit: OperationalUnit = {
      kind: "plant",
      id: plantId,
      name: "",
      code: "",
    };
    return unitComplianceHref(unit, accountSlug ?? "");
  }
  return clientHref("/cliente/cumplimiento", accountSlug);
}
