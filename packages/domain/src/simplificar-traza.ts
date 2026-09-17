import type { Ventana } from "./tiempo.js";

/**
 * Simplificación de traza **para dibujar**. La base conserva todos los puntos
 * siempre; esto sólo decide cuáles se pintan.
 *
 * Nació en el Workbench (`apps/web/src/lib/simplificar-traza.ts`, ley en
 * `Ficha-Workbench` §3.3) y se mudó aquí cuando el recorrido de Compás (C3,
 * regla 9) la necesitó: dos pantallas que simplifican la misma traza con dos
 * copias del algoritmo terminan dibujándola distinto. El Workbench la
 * reexporta y, sin opciones, se comporta exactamente como antes.
 *
 * **Douglas-Peucker y no muestreo por distancia ni por conteo**: conserva los
 * vértices donde la traza cambia de dirección, que es justo donde se ve una
 * desviación. El muestreo puede saltarse una vuelta entera — deja los puntos
 * parejos y borra la esquina.
 */

export type Punto = { lat: number; lng: number };

/**
 * Un punto en el plano local de `a`, en grados de latitud.
 *
 * La longitud se corrige por el coseno de la latitud antes de medir: sin eso,
 * en Juárez (31.7°) un grado de longitud pesaría lo mismo que uno de latitud y
 * la simplificación deformaría de más en el eje este-oeste.
 */
function enPlano(p: Punto, a: Punto, k: number): [number, number] {
  return [(p.lng - a.lng) * k, p.lat - a.lat];
}

/** Distancia perpendicular de `p` al segmento `a`–`b`, en grados proyectados. */
function distanciaPerpendicular(p: Punto, a: Punto, b: Punto): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const [px, py] = enPlano(p, a, k);
  const [bx, by] = enPlano(b, a, k);

  const largo2 = bx * bx + by * by;
  if (largo2 === 0) return Math.hypot(px, py);

  // Proyección acotada al segmento: fuera de él, la distancia es al extremo.
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / largo2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Grados de latitud que equivalen a un metro. Aproximación suficiente aquí. */
const GRADOS_POR_METRO = 1 / 111_320;

export type OpcionesDeSimplificacion = {
  /**
   * Índices que no se eliminan con ninguna tolerancia. La traza se parte en
   * ellos y cada pedazo se simplifica por su lado, así que un intocable nunca
   * compite contra otro punto para quedarse.
   */
  intocable?: (indice: number) => boolean;
  /**
   * **Un regreso no se aplana.** Douglas-Peucker sólo mide qué tan lejos de la
   * recta pasa la traza, no en qué sentido la recorre. Si el camión va 3 km al
   * oriente, regresa 2 km por la misma calle y sigue 4 km, los puntos de la
   * vuelta caen *sobre* la recta y se borran: el dibujo queda igual, pero el
   * playback mueve el marcador siempre hacia adelante y la vuelta desaparece.
   *
   * Con esta opción también cuenta cuánto retrocede la traza a lo largo de la
   * recta; si retrocede más que la tolerancia, el punto donde da la vuelta se
   * conserva. Garantía que queda: entre dos puntos dibujados, lo medido nunca
   * se aleja de la línea más que la tolerancia **ni camina hacia atrás** más
   * que la tolerancia. Una vuelta más chica que la tolerancia cabe dentro del
   * error del grado — para verla está el detalle completo.
   */
  conservarVueltas?: boolean;
};

/**
 * Douglas-Peucker con tolerancia en METROS.
 *
 * La tolerancia se expresa en metros y no en grados a propósito: quien la
 * ajusta piensa en "cuánto puede alejarse la línea dibujada de donde de verdad
 * pasó el camión", y eso es una distancia en el mundo, no una unidad de mapa.
 *
 * Iterativo y no recursivo: una traza de decenas de miles de puntos casi
 * colineales desborda la pila con la versión recursiva, y ese es exactamente el
 * caso que esta función existe para atender.
 *
 * Nunca inventa ni reordena: devuelve un subconjunto de la entrada, en orden.
 */
export function simplificarTraza<T extends Punto>(
  puntos: T[],
  toleranciaMetros: number,
  opciones: OpcionesDeSimplificacion = {},
): T[] {
  if (puntos.length <= 2 || toleranciaMetros <= 0) return puntos;
  const tolerancia = toleranciaMetros * GRADOS_POR_METRO;
  const ultimo = puntos.length - 1;

  const conservar = new Uint8Array(puntos.length);
  conservar[0] = 1;
  conservar[ultimo] = 1;
  if (opciones.intocable) {
    for (let i = 1; i < ultimo; i += 1) if (opciones.intocable(i)) conservar[i] = 1;
  }

  const pila: [number, number][] = [];
  let desde = 0;
  for (let i = 1; i <= ultimo; i += 1) {
    if (!conservar[i]) continue;
    if (i - desde > 1) pila.push([desde, i]);
    desde = i;
  }

  while (pila.length > 0) {
    const [ini, fin] = pila.pop()!;
    const a = puntos[ini]!;
    const b = puntos[fin]!;

    let rumboX = 0;
    let rumboY = 0;
    const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    if (opciones.conservarVueltas) {
      const [bx, by] = enPlano(b, a, k);
      const largo = Math.hypot(bx, by);
      if (largo > 0) {
        rumboX = bx / largo;
        rumboY = by / largo;
      }
    }

    let peorDist = 0;
    let peorIdx = -1;
    let avanceMaximo = 0;
    for (let i = ini + 1; i < fin; i += 1) {
      let d = distanciaPerpendicular(puntos[i]!, a, b);
      if (rumboX !== 0 || rumboY !== 0) {
        const [px, py] = enPlano(puntos[i]!, a, k);
        const avance = px * rumboX + py * rumboY;
        d = Math.max(d, avanceMaximo - avance);
        avanceMaximo = Math.max(avanceMaximo, avance);
      }
      if (d > peorDist) {
        peorDist = d;
        peorIdx = i;
      }
    }
    if (peorIdx !== -1 && peorDist > tolerancia) {
      conservar[peorIdx] = 1;
      pila.push([ini, peorIdx], [peorIdx, fin]);
    }
  }

  const salida: T[] = [];
  for (let i = 0; i < puntos.length; i += 1) if (conservar[i]) salida.push(puntos[i]!);
  return salida;
}

/**
 * Los grados de simplificación del recorrido, como tolerancias en metros.
 * Grado 0 es el detalle completo.
 *
 * Son los mismos escalones que usa el Workbench (`toleranciaParaTraza`), para
 * que un mismo periodo no se dibuje con dos finuras distintas en dos pantallas.
 */
export const TOLERANCIA_POR_GRADO = [0, 8, 20, 40] as const;
export type GradoDeTrazo = 0 | 1 | 2 | 3;

export function esGradoDeTrazo(n: number): n is GradoDeTrazo {
  return Number.isInteger(n) && n >= 0 && n < TOLERANCIA_POR_GRADO.length;
}

/**
 * Cadencia medida del equipo: un punto por minuto (mediana y p90 en 60 s,
 * `Ficha-Workbench` §3.3). Convierte la duración de una ventana en los puntos
 * que se esperan de ella.
 */
export const PUNTOS_POR_MINUTO_MEDIDOS = 1;

/**
 * El grado que le toca a una ventana, **antes de leer un solo punto**.
 *
 * El Workbench decide sobre el total de puntos ya leído. El recorrido no puede:
 * el grado va en la dirección de la petición, porque es parte de la clave de
 * caché (regla 10) y un trazo simplificado no debe servirse donde se pidió el
 * detalle. Así que se estima con la cadencia medida y se usan los mismos
 * umbrales de conteo que el Workbench — un día sale completo, una semana no.
 */
export function gradoParaVentana(ventana: Ventana): GradoDeTrazo {
  const esperados =
    ((ventana.hasta.getTime() - ventana.desde.getTime()) / 60_000) * PUNTOS_POR_MINUTO_MEDIDOS;
  if (esperados <= 3_000) return 0;
  if (esperados <= 20_000) return 1;
  if (esperados <= 60_000) return 2;
  return 3;
}
