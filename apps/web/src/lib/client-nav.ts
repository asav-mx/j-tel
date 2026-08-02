import { withAccount } from "./account-context";

/** Navegación corporativa (hub Tecma). */
export function clientNavLinks(slug: string) {
  return [
    { href: withAccount("/cliente", slug), label: "Sitios" },
    { href: withAccount("/cliente/plantas", slug), label: "Administrar plantas" },
    { href: withAccount("/cliente/reportes", slug), label: "Reportes" },
    { href: withAccount("/cliente/notificaciones", slug), label: "Notificaciones" },
  ];
}
