import type { Forma, Sentido } from "./forma";

/**
 * Qué dice la línea de abajo del mapa, sobre las fichas de ruta.
 *
 * **Invitar a tocar una parada que no existe es mentirle al pasajero**: toca el
 * mapa, no pasa nada, y concluye que la app se rompió. Por eso la invitación
 * sale sólo cuando en el sentido elegido hay al menos una parada — el mapa
 * dibuja las de ESE sentido y las que sirven a los dos (`sentido: null`), y
 * ésta es la misma regla.
 *
 * Sin paradas en ese sentido, se dice (1.E): el pasajero sabe por qué no hay a
 * dónde tocar. Mientras la ruta no ha llegado — o lo que hay en mano es la de
 * otra ruta — no se dice nada: todavía no se sabe.
 */
export function pistaDelMapa(forma: Forma | null, enfocada: string | null, sentido: Sentido): string | null {
  if (!forma || !enfocada || forma.circuito_id !== enfocada) return null;
  const hay = forma.paradas.some((p) => p.sentido === null || p.sentido === sentido);
  return hay ? "Toca una parada para ver cuándo pasa" : "Esta ruta aún no tiene paradas en este sentido";
}
