import { proyectarSobreTrazado } from "./trazado.js";

/**
 * En cuánto llega el camión al lugar donde está parado el pasajero.
 *
 * Todo esto corre **en el teléfono**. No es un detalle de implementación: la
 * ubicación del pasajero no sale del dispositivo, y el servidor jamás la recibe.
 * Por eso el cálculo vive en el dominio y no en una ruta — para que la app lo
 * importe y lo ejecute ahí donde está el dato.
 *
 * Ningún umbral vive aquí. La velocidad y el piso del rango son **campos por
 * circuito** y entran por parámetro.
 */

export type Sentido = "ida" | "vuelta";

// ── Avance sobre el trazado ──────────────────────────────────────────────

/**
 * Cuántos metros lleva recorridos algo sobre el trazado, y a qué distancia de
 * él está. `null` si cae fuera del corredor: ahí no se puede afirmar nada.
 *
 * Reusa `proyectarSobreTrazado`, que ya resuelve punto-a-segmento y devuelve el
 * avance acumulado. No se duplica geometría: el circuito 1 tiene huecos de hasta
 * 224 m entre vértices y una versión propia «más simple» mediría distinto.
 */
export function avanceSobreTrazado(
  punto: { lat: number; lon: number },
  trazado: Array<[number, number]>,
  corredorMetros: number,
): { avanceMetros: number; distanciaMetros: number } | null {
  const p = proyectarSobreTrazado(punto, trazado);
  if (!p) return null;
  if (p.distanciaMetros > corredorMetros) return null;
  return { avanceMetros: p.avanceMetros, distanciaMetros: p.distanciaMetros };
}

// ── Velocidad del corredor ───────────────────────────────────────────────

/** Una unidad vista dos veces: de ahí sale el avance real entre sondeos. */
export interface MuestraDeAvance {
  metros: number;
  segundos: number;
}

/**
 * Cuánto tiene que avanzar una unidad, y en cuánto tiempo, para que la muestra
 * signifique algo.
 *
 * Debajo de estos números lo que se mide es el temblor del GPS, no el camión:
 * un fix salta veinte metros estando quieto, y dividido entre cinco segundos da
 * 14 km/h de un autobús estacionado.
 */
const MINIMO_SEGUNDOS = 20;
const MINIMO_METROS = 30;

/** Velocidades imposibles para un camión urbano: fix malo, no dato. */
const MAXIMO_KMH = 90;

export type OrigenDeVelocidad = "declarada" | "medida";

/**
 * La velocidad con la que se calcula el rango, **y de dónde salió**.
 *
 * Arranca con la declarada del circuito para que el primer pasajero tenga rango
 * desde el primer segundo, y la reemplaza por la medida en cuanto hay muestras
 * que lo aguanten. El origen viaja con el número porque la pantalla tiene que
 * poder decir cuál está usando: presentar una estimación como medición es la
 * misma falta que pintar un veredicto antes del cierre.
 */
export function velocidadDelCorredor(
  declaradaKmh: number,
  muestras: MuestraDeAvance[],
): { kmh: number; origen: OrigenDeVelocidad } {
  const buenas = muestras.filter(
    (m) =>
      m.segundos >= MINIMO_SEGUNDOS &&
      m.metros >= MINIMO_METROS &&
      (m.metros / m.segundos) * 3.6 <= MAXIMO_KMH,
  );
  if (buenas.length < 2) return { kmh: declaradaKmh, origen: "declarada" };

  // Mediana y no promedio: un camión atorado en un semáforo largo no debe
  // arrastrar la estimación de todos los demás.
  const kmhs = buenas.map((m) => (m.metros / m.segundos) * 3.6).sort((a, b) => a - b);
  const medio = Math.floor(kmhs.length / 2);
  const mediana =
    kmhs.length % 2 === 0 ? (kmhs[medio - 1] + kmhs[medio]) / 2 : kmhs[medio];

  return { kmh: mediana, origen: "medida" };
}

// ── El rango ─────────────────────────────────────────────────────────────

export interface RangoDeLlegada {
  /** Segundos, nunca negativos. */
  desdeSeg: number;
  hastaSeg: number;
  /** El centro, para ordenar unidades. No se enseña solo: sin su rango miente. */
  estimadoSeg: number;
  /** El rango ya incluye el ahora: el camión está llegando. */
  llegando: boolean;
  metrosDeDistancia: number;
}

/**
 * El rango de llegada de UNA unidad, o `null` si no se puede afirmar.
 *
 * Devuelve `null` cuando la unidad **ya pasó** al pasajero. Volverá dando la
 * vuelta completa, pero ese número depende de cuánto tarda el circuito entero y
 * de si la unidad sigue en servicio al llegar: es especulación, y una
 * especulación con cara de rango manda a alguien a esperar un camión que no va
 * a pasar.
 *
 * **El ancho es exactamente ± el piso del circuito.** La varianza de tráfico que
 * se sumaría encima no está medida, y hasta que la prueba de campo la mida, no
 * se inventa. Un rango angosto y honesto vale más que uno ancho y adivinado.
 */
export function rangoDeLlegada(
  avanceUnidadMetros: number,
  avancePasajeroMetros: number,
  velocidadKmh: number,
  pisoSegundos: number,
): RangoDeLlegada | null {
  if (!(velocidadKmh > 0)) return null;

  const metros = avancePasajeroMetros - avanceUnidadMetros;
  if (metros < 0) return null; // ya pasó

  const estimadoSeg = Math.round(metros / (velocidadKmh / 3.6));

  return {
    desdeSeg: Math.max(0, estimadoSeg - pisoSegundos),
    hastaSeg: estimadoSeg + pisoSegundos,
    estimadoSeg,
    // El rango ya toca el ahora. Sale del piso configurado del circuito, no de
    // un número nuevo inventado para esto.
    llegando: estimadoSeg <= pisoSegundos,
    metrosDeDistancia: Math.round(metros),
  };
}

/**
 * El rango que se enseña arriba: el de la unidad que llega primero.
 *
 * `null` cuando ninguna unidad puede afirmar llegada — y entonces la pantalla
 * cae a la frecuencia declarada, que es la respuesta honesta a «no sé».
 */
export function proximaLlegada(rangos: RangoDeLlegada[]): RangoDeLlegada | null {
  if (rangos.length === 0) return null;
  return rangos.reduce((mejor, r) => (r.estimadoSeg < mejor.estimadoSeg ? r : mejor));
}
