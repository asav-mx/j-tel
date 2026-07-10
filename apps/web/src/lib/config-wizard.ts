import type { OperationalUnit } from "@jtel/domain";
import { withAccount } from "./account-context";
import {
  unitConfigHubHref,
  unitConfigStepHref,
  unitDashboardHref,
} from "./unit-routes";

/** Pasos de configuración dentro de una unidad operativa (planta o campus). */
export const UNIT_CONFIG_STEPS = [
  {
    id: "geocercas",
    n: 1,
    title: "Geocercas",
    desc: "Destino / fin de la ruta.",
    segment: "geocercas",
  },
  {
    id: "turnos",
    n: 2,
    title: "Turnos",
    desc: "Horarios de entrada del personal.",
    segment: "turnos",
  },
  {
    id: "rutas",
    n: 3,
    title: "Rutas",
    desc: "Trazado KML por turno (ruta = turno + KML).",
    segment: "rutas",
  },
  {
    id: "servicios",
    n: 4,
    title: "Perfiles",
    desc: "Contrato + ruta + geocerca → ocurrencias.",
    segment: "servicios",
  },
] as const;

export type UnitConfigStepId = (typeof UNIT_CONFIG_STEPS)[number]["id"];

/** @deprecated Usar UNIT_CONFIG_STEPS dentro de una unidad operativa. */
export const CONFIG_STEPS = [
  {
    id: "plantas",
    n: 0,
    title: "Plantas",
    desc: "Plantas y campus (grupos operativos).",
    path: "/cliente/plantas",
  },
  ...UNIT_CONFIG_STEPS.map((s, i) => ({
    id: s.id,
    n: i + 1,
    title: s.title,
    desc: s.desc,
    path: `/cliente/configuracion/${s.segment}`,
  })),
] as const;

export type ConfigStepId = (typeof CONFIG_STEPS)[number]["id"];

export function unitConfigStepHrefFor(
  unit: OperationalUnit,
  clientSlug: string,
  stepId: UnitConfigStepId,
): string {
  return unitConfigStepHref(unit, clientSlug, stepId);
}

export function unitConfigHubHrefFor(unit: OperationalUnit, clientSlug: string): string {
  return unitConfigHubHref(unit, clientSlug);
}

export function unitDashboardHrefFor(unit: OperationalUnit, clientSlug: string): string {
  return unitDashboardHref(unit, clientSlug);
}

/** @deprecated */
export function configStepHref(slug: string, stepId: ConfigStepId): string {
  const step = CONFIG_STEPS.find((s) => s.id === stepId);
  return step ? withAccount(step.path, slug) : withAccount("/cliente", slug);
}

/** @deprecated */
export function configHubHref(slug: string): string {
  return withAccount("/cliente/configuracion", slug);
}
