import { MAXIMO_RUTAS } from "@/lib/rutas-pedidas";

/**
 * Qué rutas pide la **consulta única de la raíz** (PR 4b, decisión de ASAV,
 * 22-sep): tus favoritas y la ruta que tengas abierta, en UNA consulta cada
 * 15 s. De ella salen Inicio, el Mapa, el hilo y la campana — 4 peticiones por
 * minuto en toda la app, y los avisos al día en cualquier pantalla.
 *
 * La abierta va primero: si las favoritas pasan del tope de la consulta
 * (`MAXIMO_RUTAS`), la que el pasajero está mirando nunca se queda fuera.
 */
export function rutasDeLaConsulta(favoritas: string[], abierta: string | null): string[] {
  const todas = [...new Set([...(abierta ? [abierta] : []), ...favoritas])];
  return todas.slice(0, MAXIMO_RUTAS);
}
