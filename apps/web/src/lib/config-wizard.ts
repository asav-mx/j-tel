import { withAccount } from "./account-context";

export const CONFIG_STEPS = [
  {
    id: "plantas",
    n: 1,
    title: "Plantas",
    desc: "Plantas y campus (grupos operativos).",
    path: "/cliente/plantas",
  },
  {
    id: "geocercas",
    n: 2,
    title: "Geocercas",
    desc: "Destino de llegada por planta o campus.",
    path: "/cliente/configuracion/geocercas",
  },
  {
    id: "rutas",
    n: 3,
    title: "Rutas y turnos",
    desc: "Rutas, turnos y trazado KML por unidad operativa.",
    path: "/cliente/configuracion/rutas",
  },
  {
    id: "contratos",
    n: 4,
    title: "Contratos",
    desc: "Política con el carrier por planta o campus.",
    path: "/cliente/configuracion/contratos",
  },
  {
    id: "servicios",
    n: 5,
    title: "Perfiles",
    desc: "Junta contrato + ruta + geocerca y genera ocurrencias.",
    path: "/cliente/configuracion/servicios",
  },
] as const;

export type ConfigStepId = (typeof CONFIG_STEPS)[number]["id"];

export function configStepHref(slug: string, stepId: ConfigStepId): string {
  const step = CONFIG_STEPS.find((s) => s.id === stepId);
  return step ? withAccount(step.path, slug) : withAccount("/cliente/configuracion", slug);
}

export function configHubHref(slug: string): string {
  return withAccount("/cliente/configuracion", slug);
}
