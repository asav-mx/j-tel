/**
 * Umbrales de la torre que el servidor mide y el cliente dibuja.
 *
 * Viven aparte de `monitoreo-data.ts` a propósito: ese módulo abre la base de
 * datos, y la torre es un componente de cliente. Importar la constante desde
 * ahí arrastraría el driver al bundle del navegador.
 */

/**
 * Cuántos minutos sin punto GPS convierten a una unidad en "sin señal".
 *
 * El mismo umbral del dead-man switch de ingesta (`IngestHealthService`,
 * `DEFAULT_STALE_MINUTES`): si el sistema da por caída la ingesta a los 15
 * minutos, una unidad callada 15 minutos está igual de callada. Un segundo
 * número aquí haría que la torre y las alertas discreparan sobre lo mismo.
 */
export const SIN_SENAL_MINUTOS = 15;
