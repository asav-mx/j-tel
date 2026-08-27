import { metrosEntre } from "./kml-circuito.js";

/**
 * Geometría de un trazado: proyectar un punto sobre el recorrido.
 *
 * **Esta función es el corazón del Tramo JB, y sirve para tres cosas a la vez:**
 *
 * 1. Pegar una parada al trazado cuando alguien la pica en el mapa.
 * 2. Decir dónde va una unidad sobre el circuito, y si va dentro o fuera.
 * 3. Calcular la llegada: `avanceMetros` del camión contra `avanceMetros` del
 *    pasajero es exactamente cuánto falta para que pase por donde él está.
 *
 * Que las tres salgan del mismo cálculo no es economía de código: es la razón
 * por la que la app puede prometer una llegada en cualquier esquina y no solo
 * en un paradero. En Juárez el camión se detiene donde el pasajero lo pide.
 *
 * **Punto-a-segmento, no punto-a-vértice.** El KML del circuito 1 tiene huecos
 * de hasta 224 m entre vértices; midiendo contra el vértice más cercano, una
 * unidad a media cuadra de un tramo largo se vería a 112 m fuera de ruta sin
 * estarlo.
 */

export interface ProyeccionEnTrazado {
  /** El punto pegado al trazado. */
  lat: number;
  lon: number;
  /** A qué distancia estaba el punto original del trazado. */
  distanciaMetros: number;
  /** Índice del segmento donde cayó, para depurar. */
  indiceSegmento: number;
  /** Metros recorridos desde el inicio del trazado hasta el punto pegado. */
  avanceMetros: number;
  /** El mismo avance como fracción del largo total, entre 0 y 1. */
  fraccion: number;
}

/**
 * Proyecta un punto sobre la polilínea y devuelve dónde cae.
 *
 * Devuelve `null` solo si el trazado no tiene al menos dos puntos: un trazado
 * de un punto no es un recorrido.
 */
export function proyectarSobreTrazado(
  punto: { lat: number; lon: number },
  trazado: Array<[number, number]>,
): ProyeccionEnTrazado | null {
  if (trazado.length < 2) return null;

  // Plano local: a escala de ciudad el error de tratar grados como plano es
  // despreciable, y evita trigonometría dentro del bucle.
  const latRef = (punto.lat * Math.PI) / 180;
  const mPorGradoLat = 111_132.92 - 559.82 * Math.cos(2 * latRef);
  const mPorGradoLon = 111_412.84 * Math.cos(latRef);
  const x = (lon: number) => lon * mPorGradoLon;
  const y = (lat: number) => lat * mPorGradoLat;

  const px = x(punto.lon);
  const py = y(punto.lat);

  let mejor = {
    d2: Number.POSITIVE_INFINITY,
    lat: trazado[0][1],
    lon: trazado[0][0],
    indice: 0,
    tramo: 0,
  };

  for (let i = 0; i < trazado.length - 1; i++) {
    const ax = x(trazado[i][0]);
    const ay = y(trazado[i][1]);
    const bx = x(trazado[i + 1][0]);
    const by = y(trazado[i + 1][1]);
    const dx = bx - ax;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;

    // Vértices repetidos: el segmento es un punto y `t` sería 0/0.
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;

    if (d2 < mejor.d2) {
      mejor = {
        d2,
        lat: cy / mPorGradoLat,
        lon: cx / mPorGradoLon,
        indice: i,
        tramo: t * Math.sqrt(largo2),
      };
    }
  }

  let avanceMetros = 0;
  for (let i = 0; i < mejor.indice; i++) {
    avanceMetros += metrosEntre(
      { lat: trazado[i][1], lon: trazado[i][0] },
      { lat: trazado[i + 1][1], lon: trazado[i + 1][0] },
    );
  }
  avanceMetros += mejor.tramo;

  const largoTotal = largoDeTrazado(trazado);

  return {
    lat: mejor.lat,
    lon: mejor.lon,
    distanciaMetros: metrosEntre(punto, { lat: mejor.lat, lon: mejor.lon }),
    indiceSegmento: mejor.indice,
    avanceMetros,
    fraccion: largoTotal > 0 ? Math.min(1, avanceMetros / largoTotal) : 0,
  };
}

export function largoDeTrazado(trazado: Array<[number, number]>): number {
  let total = 0;
  for (let i = 0; i < trazado.length - 1; i++) {
    total += metrosEntre(
      { lat: trazado[i][1], lon: trazado[i][0] },
      { lat: trazado[i + 1][1], lon: trazado[i + 1][0] },
    );
  }
  return total;
}

export interface ResultadoPegado {
  proyeccion: ProyeccionEnTrazado;
  /** Si la distancia superó la tolerancia del circuito. */
  fueraDeTolerancia: boolean;
  /**
   * Qué mostrar a quien edita antes de que confirme. Nunca decide por él: el
   * pegado a la fuerza sin explicación es lo que vuelve incomprensible una
   * pantalla.
   */
  aviso: string | null;
}

/**
 * Decide qué ofrecer cuando alguien pica en el mapa para poner una parada.
 *
 * **No pega a la fuerza y en silencio.** Devuelve dónde quedaría pegada para
 * que la pantalla lo dibuje ANTES de confirmar, y cuando el pico se aleja más
 * de la tolerancia del circuito, avisa y deja soltar el pegado.
 *
 * La tolerancia es un campo del circuito, no un número aquí: una avenida ancha
 * y una calle del Centro no admiten el mismo margen.
 */
export function pegarAlTrazado(
  punto: { lat: number; lon: number },
  trazado: Array<[number, number]>,
  toleranciaMetros: number,
): ResultadoPegado | null {
  const proyeccion = proyectarSobreTrazado(punto, trazado);
  if (!proyeccion) return null;

  const fueraDeTolerancia = proyeccion.distanciaMetros > toleranciaMetros;
  return {
    proyeccion,
    fueraDeTolerancia,
    aviso: fueraDeTolerancia
      ? `Picaste a ${Math.round(proyeccion.distanciaMetros)} m del recorrido, más de los ` +
        `${toleranciaMetros} m de tolerancia de este circuito. Se va a pegar al trazado; ` +
        `si la parada va de verdad ahí, suelta el pegado.`
      : null,
  };
}
