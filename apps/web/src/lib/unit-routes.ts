import type { OperationalScope, OperationalUnit } from "@jtel/domain";
import { withAccount } from "./account-context";
import type { UnitConfigStepId } from "./config-wizard";

const WIZARD_STEP_PATH: Record<UnitConfigStepId, string> = {
  geocercas: "geocercas",
  turnos: "turnos",
  rutas: "rutas",
  servicios: "servicios",
};

export type ConfigRedirectStep = UnitConfigStepId | "contratos";

export function unitBasePath(unit: OperationalUnit): string {
  return unit.kind === "plant"
    ? `/cliente/planta/${unit.id}`
    : `/cliente/campus/${unit.id}`;
}

export function scopeToUnitPath(scope: OperationalScope): string {
  if (scope.kind === "plant") return `/cliente/planta/${scope.plantId}`;
  return `/cliente/campus/${scope.plantGroupId}`;
}

export function unitDashboardHref(unit: OperationalUnit, accountSlug: string): string {
  return withAccount(unitBasePath(unit), accountSlug);
}

export function unitConfigHubHref(unit: OperationalUnit, accountSlug: string): string {
  return withAccount(`${unitBasePath(unit)}/configuracion`, accountSlug);
}

export function unitConfigStepHref(
  unit: OperationalUnit,
  accountSlug: string,
  step: UnitConfigStepId,
): string {
  return withAccount(`${unitBasePath(unit)}/configuracion/${WIZARD_STEP_PATH[step]}`, accountSlug);
}

export function unitContratosHref(unit: OperationalUnit, accountSlug: string): string {
  return withAccount(`${unitBasePath(unit)}/configuracion/contratos`, accountSlug);
}

export function unitComplianceHref(unit: OperationalUnit, accountSlug: string): string {
  return withAccount(`${unitBasePath(unit)}/cumplimiento`, accountSlug);
}

/** Redirección post-API según alcance operativo. */
export function configApiRedirectPath(
  scope: OperationalScope,
  accountSlug: string,
  step: ConfigRedirectStep,
): string {
  if (step === "contratos") {
    return withAccount(`${scopeToUnitPath(scope)}/configuracion/contratos`, accountSlug);
  }
  const unit: OperationalUnit =
    scope.kind === "plant"
      ? { kind: "plant", id: scope.plantId, name: "", code: "" }
      : { kind: "plant_group", id: scope.plantGroupId, name: "", memberPlants: [] };
  return unitConfigStepHref(unit, accountSlug, step);
}

export function campusHref(groupId: string, accountSlug: string): string {
  return withAccount(`/cliente/campus/${groupId}`, accountSlug);
}

export function plantHref(plantId: string, accountSlug: string): string {
  return withAccount(`/cliente/planta/${plantId}`, accountSlug);
}
