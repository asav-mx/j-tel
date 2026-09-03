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
/** El camión está a menos de `llegandoMetros`: se ve venir. */
  llegando: boolean;
  metrosDeDistancia: number;
}

/**
 * A cuántos metros un camión está «Llegando».
 *
 * **Se mide en METROS y no en minutos, y eso es del diseño aprobado.** A cuatro
 * cuadras el pasajero levanta la vista y lo ve; un umbral en minutos diría
 * «llegando» a un kilómetro de distancia cuando el tráfico está lento, y quien
 * salió corriendo a la esquina se queda parado ahí tres minutos.
 *
 * Es parámetro con default, no constante escondida: si un corredor pide otro
 * número, se vuelve columna del circuito como los demás umbrales.
 */
export const LLEGANDO_METROS = 400;

// ── El permiso para afirmar un tiempo ────────────────────────────────────

declare const marcaDePermiso: unique symbol;

/**
 * El permiso para afirmar un tiempo de llegada. **No se construye a mano.**
 *
 * Lleva un símbolo único que ningún literal puede satisfacer, así que la única
 * forma de tener uno es `permisoDeRango`, y la única forma de que
 * `permisoDeRango` lo entregue es que las dos condiciones se cumplan. Un
 * `number` con la velocidad adentro **no compila** donde va esto.
 *
 * La velocidad viaja dentro y no aparte, a propósito: separadas, alguien puede
 * pedir el permiso y después calcular con otra velocidad, y la valla quedaría
 * comprobando algo que ya no gobierna el resultado.
 */
export interface PermisoDeRango {
  readonly [marcaDePermiso]: "rango";
  readonly velocidadKmh: number;
  readonly pisoSegundos: number;
}

/**
 * Las dos condiciones que autorizan a decirle a alguien cuánto falta, y la
 * única puerta por la que se pasa. Sin permiso no hay minuto.
 *
 * **El interruptor del circuito** (`rangoActivo`). Un circuito recién dado de
 * alta trae una velocidad medida sobre OTRA flota; enseñar un minuto con eso es
 * presentar una suposición como medición. Apagado, la app sigue enseñando el
 * camión moverse —verdad observada— y se calla el número.
 *
 * **La frescura de ESA posición** (`posicionFresca`). Calcular desde una
 * posición vieja es inventar un número, y lo paga la persona parada en la
 * banqueta: se queda esperando un camión que ya pasó, o se va creyendo que
 * tarda. La condición es por unidad y no por circuito, porque en el mismo
 * sondeo llegan unidades frescas y viejas mezcladas.
 *
 * ## Por qué es un tipo y no una regla escrita
 *
 * Las dos condiciones existían y estaban documentadas. De los cinco lugares que
 * podían fabricar un minuto, **cuatro se olvidaron de una o de las dos**: el
 * hilo de paradas daba minutos con el interruptor apagado y desde camiones que
 * la propia app pintaba grises, y el verde de «Llegando» seguía encendido sobre
 * un titular que ya se había callado. Ninguna prueba lo vio, porque ningún
 * valor estaba mal: lo que faltaba era la condición en el sitio de llamada.
 *
 * Ese es exactamente el caso donde el Marco §D dice que **la valla es el
 * compilador** — cuando el error está en quién llama y no en qué hace, ninguna
 * prueba sobre una función pura lo alcanza.
 *
 * La valla que lo demuestra vive en `llegada.test.ts` y es del tipo que se
 * queja cuando DEJA de hacer falta: si alguien vuelve a ensanchar la firma para
 * aceptar un número crudo, la directiva `@ts-expect-error` queda sin usar y
 * `tsc` falla.
 */
export function permisoDeRango(entrada: {
  /** `arrival_range_enabled_at` del circuito, ya resuelto por el servidor. */
  rangoActivo: boolean;
  /** El `fresco` de ESA unidad, ya resuelto por el servidor. */
  posicionFresca: boolean;
  velocidadKmh: number;
  pisoSegundos: number;
}): PermisoDeRango | null {
  if (!entrada.rangoActivo) return null;
  if (!entrada.posicionFresca) return null;
  // Sin velocidad no hay división posible: antes se rechazaba dentro del
  // cálculo, y su lugar es aquí — es una condición para poder afirmar, no un
  // caso de borde de la aritmética.
  if (!(entrada.velocidadKmh > 0)) return null;

  return {
    velocidadKmh: entrada.velocidadKmh,
    pisoSegundos: entrada.pisoSegundos,
  } as PermisoDeRango;
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
 *
 * Pide `PermisoDeRango` y no una velocidad suelta: ver arriba.
 */
export function rangoDeLlegada(
  avanceUnidadMetros: number,
  avancePasajeroMetros: number,
  permiso: PermisoDeRango,
  llegandoMetros = LLEGANDO_METROS,
): RangoDeLlegada | null {
  const { velocidadKmh, pisoSegundos } = permiso;

  const metros = avancePasajeroMetros - avanceUnidadMetros;
  if (metros < 0) return null; // ya pasó

  const estimadoSeg = Math.round(metros / (velocidadKmh / 3.6));

  return {
    desdeSeg: Math.max(0, estimadoSeg - pisoSegundos),
    hastaSeg: estimadoSeg + pisoSegundos,
    estimadoSeg,
    llegando: metros <= llegandoMetros,
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
