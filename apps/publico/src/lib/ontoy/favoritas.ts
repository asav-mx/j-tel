import type { ParadaGuardada } from "./paradas-guardadas";

/**
 * Tus rutas favoritas: las de tus paradas guardadas (8.8; PR 3b). Sólo las que
 * siguen publicadas —lo no publicado no existe (8.4)—, sin repetidas y en el
 * orden en que las guardaste.
 */
export function rutasFavoritas(guardadas: ParadaGuardada[], publicadas: string[]): string[] {
  const hay = new Set(publicadas);
  return [...new Set(guardadas.map((g) => g.ruta))].filter((r) => hay.has(r));
}

/**
 * Las que van EN VIVO en el mapa: las favoritas menos las que apagaste con su
 * botón. Sin favoritas, ninguna — y entonces no se pregunta nada al servidor.
 */
export function rutasEnVivo(favoritas: string[], apagadas: Set<string>): string[] {
  return favoritas.filter((r) => !apagadas.has(r));
}
