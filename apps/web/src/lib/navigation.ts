import { withAccount } from "./account-context";

/** Ruta canónica de una planta (siempre con cuenta en query). */
export function plantHref(plantId: string, accountSlug?: string | null) {
  return withAccount(`/cliente/planta/${plantId}`, accountSlug);
}

export function clientHref(path: string, accountSlug?: string | null, plantId?: string | null) {
  const base = withAccount(path, accountSlug);
  if (!plantId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}plant=${encodeURIComponent(plantId)}`;
}

/** Cumplimiento con filtro opcional por planta. */
export function complianceHref(accountSlug?: string | null, plantId?: string | null) {
  return clientHref("/cliente/cumplimiento", accountSlug, plantId);
}
