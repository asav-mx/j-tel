/**
 * La geometría del microscopio: proyectar trazado, corredor y recorrido a un
 * dibujo donde los metros de tolerancia se vean como metros.
 *
 * Módulo puro: nada de base de datos, nada de React. Se prueba solo.
 *
 * Dos decisiones que sostienen todo lo demás:
 *
 * 1. **Proyección equirectangular local, a escala uniforme.** El dibujo no es
 *    un mapa de calles: es un instrumento. Lo que tiene que ser fiel es la
 *    relación entre el trazado, el corredor y el recorrido, y para eso una
 *    proyección local con el mismo factor en x y en y basta y sobra. Sin ella
 *    el corredor se dibujaría más ancho en un eje que en el otro y los metros
 *    dejarían de significar metros.
 *
 * 2. **El corredor no se calcula: se traza.** El corredor del motor es
 *    "todo punto a ≤ R del trazado", que es exactamente lo que dibuja una
 *    polilínea engrosada 2R con uniones y extremos redondos. Construir un
 *    polígono de offset a mano sería una segunda implementación de la misma
 *    definición, con sus propios errores en las curvas cerradas.
 */

import { cumulativeRouteFractions } from "@jtel/verification";

export type Punto = { lat: number; lng: number };

/** Metros por grado de latitud (WGS84, promedio suficiente a esta escala). */
const METROS_POR_GRADO_LAT = 110_574;

function metrosPorGradoLng(latitudRef: number): number {
  return 111_320 * Math.cos((latitudRef * Math.PI) / 180);
}

export type Proyeccion = {
  ancho: number;
  alto: number;
  /**
   * Cuántos metros del terreno mide un pixel del dibujo. De aquí sale el
   * grosor del corredor: sin este número, los metros de tolerancia serían
   * una decoración con un ancho inventado.
   */
  metrosPorPx: number;
  px(p: Punto): { x: number; y: number };
};

/**
 * Encaja todos los grupos de puntos en un lienzo, con la misma escala en los
 * dos ejes. Devuelve `null` si no hay nada que dibujar.
 */
export function proyectar(
  grupos: Array<readonly Punto[]>,
  opts: { ancho: number; alto: number; margen: number },
): Proyeccion | null {
  const todos = grupos.flat();
  if (todos.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of todos) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;

  const latRef = (minLat + maxLat) / 2;
  const mLng = metrosPorGradoLng(latRef);

  const anchoM = Math.max((maxLng - minLng) * mLng, 1);
  const altoM = Math.max((maxLat - minLat) * METROS_POR_GRADO_LAT, 1);

  const utilAncho = Math.max(opts.ancho - 2 * opts.margen, 1);
  const utilAlto = Math.max(opts.alto - 2 * opts.margen, 1);
  const pxPorMetro = Math.min(utilAncho / anchoM, utilAlto / altoM);

  // Centrado dentro del lienzo: el sobrante del eje que no manda se reparte.
  const sobraX = utilAncho - anchoM * pxPorMetro;
  const sobraY = utilAlto - altoM * pxPorMetro;

  return {
    ancho: opts.ancho,
    alto: opts.alto,
    metrosPorPx: 1 / pxPorMetro,
    px(p: Punto) {
      const xM = (p.lng - minLng) * mLng;
      const yM = (p.lat - minLat) * METROS_POR_GRADO_LAT;
      return {
        x: opts.margen + sobraX / 2 + xM * pxPorMetro,
        // La latitud crece hacia el norte y la y del SVG hacia abajo.
        y: opts.alto - opts.margen - sobraY / 2 - yM * pxPorMetro,
      };
    },
  };
}

/** Path SVG de una polilínea ya proyectada. Cadena vacía si no hay 2 puntos. */
export function trazo(puntos: readonly Punto[], proy: Proyeccion): string {
  if (puntos.length < 2) return "";
  return puntos
    .map((p, i) => {
      const { x, y } = proy.px(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

/** Path SVG cerrado de un polígono ya proyectado. */
export function poligono(puntos: readonly Punto[], proy: Proyeccion): string {
  const abierto = trazo(puntos, proy);
  return abierto ? `${abierto} Z` : "";
}

/** Distancia en km entre dos coordenadas (haversine). */
export function haversineKm(a: Punto, b: Punto): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Largo total del trazado, en kilómetros. */
export function longitudKm(waypoints: readonly Punto[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineKm(waypoints[i - 1]!, waypoints[i]!);
  }
  return total;
}

// ---------------------------------------------------------------------------
// El tramo que quedó fuera
// ---------------------------------------------------------------------------

export type TramoDeRuta = {
  /** Índice del primer waypoint con evidencia cerca. 0 = se vio desde el origen. */
  indiceInicio: number;
  /** Waypoints que la ventana nunca alcanzó a ver (el prefijo). */
  fuera: Punto[];
  /** Waypoints sobre los que sí hubo observación. */
  dentro: Punto[];
  /** Dónde arranca el tramo observado, sobre la ruta (0 = el origen). */
  fraccionInicio: number;
  /** Qué fracción de la ruta representa el tramo observado. */
  fraccionObservable: number;
  kmTotales: number;
  kmFuera: number;
};

/**
 * Parte el trazado en lo que la evidencia alcanzó a observar y lo que quedó
 * fuera, a partir del índice que el motor mismo calcula.
 *
 * El índice NO se deriva aquí: lo entrega quien llama, usando
 * `observableRouteSpan` del paquete de verificación. Volver a buscarlo con una
 * fórmula propia sería dibujar un tramo distinto al que el motor calificó, y
 * un microscopio que enseña otra cosa que la que se midió no sirve de nada.
 */
export function partirRuta(
  waypoints: readonly Punto[],
  indiceInicio: number,
): TramoDeRuta {
  const i = Math.max(0, Math.min(indiceInicio, Math.max(waypoints.length - 1, 0)));
  const fracciones = cumulativeRouteFractions([...waypoints]);
  const fraccionInicio = fracciones[i] ?? 0;
  const kmTotales = longitudKm(waypoints);

  return {
    indiceInicio: i,
    // El prefijo incluye el waypoint de corte para que las dos mitades se
    // dibujen unidas y no quede un hueco visual donde no lo hay.
    fuera: i > 0 ? waypoints.slice(0, i + 1) : [],
    dentro: waypoints.slice(i),
    fraccionInicio,
    fraccionObservable: 1 - fraccionInicio,
    kmTotales,
    kmFuera: kmTotales * fraccionInicio,
  };
}

// ---------------------------------------------------------------------------
// El riel de tiempo
// ---------------------------------------------------------------------------

export type HuecoDeSenal = { desdeMs: number; hastaMs: number; minutos: number };

/**
 * Huecos de señal dentro de la ventana: tramos sin un solo punto por más de
 * `huecoMinimoMinutos`. Se dibujan como ausencia, no como falla — un hueco no
 * es un incumplimiento (ley 7), es una pregunta sin responder.
 *
 * Los bordes cuentan: si el primer punto llega mucho después de que la ventana
 * abrió, ese silencio inicial es justo el que decide los casos donde el
 * recorrido arrancó antes de que el sistema estuviera mirando.
 */
export function huecosDeSenal(
  instantesMs: readonly number[],
  ventana: { desdeMs: number; hastaMs: number },
  huecoMinimoMinutos: number,
): HuecoDeSenal[] {
  const minimoMs = huecoMinimoMinutos * 60_000;
  const dentro = [...instantesMs]
    .filter((t) => t >= ventana.desdeMs && t <= ventana.hastaMs)
    .sort((a, b) => a - b);

  if (dentro.length === 0) {
    const minutos = (ventana.hastaMs - ventana.desdeMs) / 60_000;
    return minutos >= huecoMinimoMinutos
      ? [{ desdeMs: ventana.desdeMs, hastaMs: ventana.hastaMs, minutos }]
      : [];
  }

  const bordes = [ventana.desdeMs, ...dentro, ventana.hastaMs];
  const huecos: HuecoDeSenal[] = [];
  for (let i = 1; i < bordes.length; i++) {
    const desdeMs = bordes[i - 1]!;
    const hastaMs = bordes[i]!;
    if (hastaMs - desdeMs >= minimoMs) {
      huecos.push({ desdeMs, hastaMs, minutos: (hastaMs - desdeMs) / 60_000 });
    }
  }
  return huecos;
}

/** Posición 0–1 de un instante dentro de la ventana, acotada a los extremos. */
export function posicionEnVentana(
  instanteMs: number,
  ventana: { desdeMs: number; hastaMs: number },
): number {
  const largo = ventana.hastaMs - ventana.desdeMs;
  if (largo <= 0) return 0;
  return Math.max(0, Math.min(1, (instanteMs - ventana.desdeMs) / largo));
}

/**
 * Reduce una traza a un máximo de puntos conservando el primero y el último.
 *
 * Un servicio largo trae miles de puntos y un `path` de miles de vértices no
 * se ve mejor: se ve igual y pesa. Se conserva el orden y los extremos porque
 * el arranque y el final de la traza son justo lo que se está leyendo.
 */
export function adelgazar<T>(puntos: readonly T[], maximo: number): T[] {
  if (puntos.length <= maximo || maximo < 2) return [...puntos];
  const paso = (puntos.length - 1) / (maximo - 1);
  const salida: T[] = [];
  for (let i = 0; i < maximo; i++) {
    salida.push(puntos[Math.round(i * paso)]!);
  }
  return salida;
}
