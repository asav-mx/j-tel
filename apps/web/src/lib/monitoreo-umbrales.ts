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
 * El valor ya no vive aquí: vive una sola vez en `@jtel/domain`, porque la
 * banda, el mapa, la llegada estimada y el dead-man switch de ingesta tienen
 * que afirmar lo mismo sobre el mismo silencio. Se re-exporta —que no es
 * copiar— para que los call sites de la torre no cambien de ruta y el
 * componente de cliente lo siga importando desde aquí.
 */
export { SIN_SENAL_MINUTOS } from "@jtel/domain";

/**
 * Hace cuánto se calló una unidad — o `null` cuando preguntarlo no tiene
 * sentido.
 *
 * Vive aparte y como función pura porque encierra una ley, no una conveniencia:
 * **después de entrar a la geocerca no hay señal que esperar.** La traza se
 * corta ahí porque la geocerca es la frontera de la evidencia, así que el
 * silencio posterior es la ley funcionando y no una unidad callada. Medirlo
 * igual acusaba al carrier de perder señal justo donde el sistema deja de mirar
 * a propósito — con el dato correcto al minuto.
 *
 * Igual en un servicio cerrado: su evidencia ya está congelada.
 */
export function edadSenalMinutos(input: {
  /** El servicio ya tiene hecho sellado. */
  cerrado: boolean;
  /** La unidad ya entró a la geocerca de destino. */
  llego: boolean;
  /** Marca de tiempo del último punto GPS, o null si no hay unidad. */
  ultimoPuntoAt: Date | string | null | undefined;
  ahora: Date;
}): number | null {
  if (input.cerrado || input.llego || !input.ultimoPuntoAt) return null;
  const at = new Date(input.ultimoPuntoAt).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.round((input.ahora.getTime() - at) / 60_000));
}
