/**
 * Etiquetas legibles de los roles de `@jtel/auth-rbac`.
 *
 * Los slugs viven en `ROLE_PERMISSIONS` (packages/auth-rbac/src/index.ts) y son
 * vocabulario de código: `coord_rutas`, `usuario_planta`. Ninguno tenía todavía
 * una forma de escribirse en pantalla, y la caja de usuario de la navegación
 * necesita una — el skill pide mostrar el rol mientras no exista el nombre
 * propio.
 *
 * Español de operación, no jerga: quien lee esto es coordinación de transporte
 * o RH de planta.
 */

const ETIQUETAS: Record<string, string> = {
  // Plataforma
  admin_plataforma: "Administración de plataforma",
  soporte: "Soporte",
  comercial: "Comercial",

  // Cara cliente — los roles funcionales que nombra el skill
  admin_corporativo: "Administración corporativa",
  coord_rutas: "Coordinación de rutas",
  cumplimiento: "Cumplimiento",
  inspecciones: "Inspecciones",
  procurement: "Contrato y escalaciones",
  usuario_planta: "Usuario de planta",

  // Cara carrier
  admin: "Administración de flota",
  coordinador: "Coordinación",
  despacho: "Despacho",
  mantenimiento: "Mantenimiento",
  chofer: "Chofer",
};

/**
 * El rol, como se escribe en pantalla.
 *
 * `userMemberships.role` es `text` libre, no un enum: la base acepta cualquier
 * cadena. Un rol desconocido se devuelve tal cual en vez de inventarle nombre
 * o de esconderlo — si alguien creó una membresía con un rol que no existe,
 * verlo es justamente lo que permite arreglarlo.
 */
export function etiquetaRol(slug: string): string {
  return ETIQUETAS[slug] ?? slug;
}
