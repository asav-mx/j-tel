import { withAccount } from "./account-context";

export function clientNavLinks(slug: string) {
  return [
    { href: withAccount("/cliente", slug), label: "Panel" },
    { href: withAccount("/cliente/cumplimiento", slug), label: "Cumplimiento" },
    { href: withAccount("/cliente/plantas", slug), label: "Plantas" },
    { href: withAccount("/cliente/configuracion", slug), label: "Configuración" },
    { href: withAccount("/cliente/reportes", slug), label: "Reportes" },
    { href: withAccount("/cliente/notificaciones", slug), label: "Notificaciones" },
  ];
}
