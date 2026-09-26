import { distanciaM } from "./distancia";
import type { ParadaPorDelante } from "./llegadas";

/**
 * **Lo que dice la hoja de Cami**, fuera del `.tsx` para poder probarlo sin
 * montar la pantalla. La lámina es `6-prototipo/04-hoja-de-cami`.
 */

/**
 * El título: «La 2120 va hacia Centro».
 *
 * Con dato viejo va en pasado —«iba»—, igual que la escalera (8.9): es por
 * dónde se le vio, no por dónde está. Sin sentido conocido no se inventa uno:
 * queda sólo «La 2120», y la lista de abajo ya dice lo que se sabe.
 */
export function tituloDeCami(economico: string, hacia: string | null, fresca: boolean): string {
  if (!hacia) return `La ${economico}`;
  return `La ${economico} ${fresca ? "va" : "iba"} ${hacia}`;
}

export interface RenglonDeCami extends ParadaPorDelante {
  /** «la siguiente», «la más cerca de ti» o «en camino». */
  nota: string;
  /** La más cerca de ti: va resaltada, como en la lámina. */
  resaltada: boolean;
}

/**
 * **La más cerca de ti, de entre las que le faltan a este camión.**
 *
 * Sólo entre ésas: si tu parada de siempre ya quedó atrás, resaltar otra que
 * sí le falta es lo útil —es donde lo alcanzas—, y resaltar una que ya pasó
 * mandaría a esperar un camión que no va a volver.
 *
 * Sin ubicación no hay «más cerca»: devuelve `null` y ningún renglón se
 * resalta. No se sustituye por tu parada guardada, porque «la más cerca de ti»
 * es una afirmación sobre dónde estás.
 */
export function laMasCercanaDeTi(
  proximas: ParadaPorDelante[],
  coordenadas: Array<{ id: string; lat: number; lon: number }>,
  yo: { lat: number; lon: number } | null,
): string | null {
  if (!yo) return null;
  let mejor: string | null = null;
  let d = Infinity;
  for (const p of proximas) {
    const c = coordenadas.find((x) => x.id === p.id);
    if (!c) continue;
    const dp = distanciaM(yo, c);
    if (dp < d) {
      d = dp;
      mejor = p.id;
    }
  }
  return mejor;
}

/**
 * Las notas de cada renglón, las de la lámina.
 *
 * Si la siguiente es también la más cerca de ti, gana «la más cerca de ti»:
 * que es la siguiente ya lo dice el «1 parada» de su derecha, y que es la tuya
 * no lo dice nada más.
 */
export function renglonesDeCami(proximas: ParadaPorDelante[], masCercana: string | null): RenglonDeCami[] {
  return proximas.map((p, i) => {
    const resaltada = p.id === masCercana;
    return {
      ...p,
      resaltada,
      nota: resaltada ? "la más cerca de ti" : i === 0 ? "la siguiente" : "en camino",
    };
  });
}
