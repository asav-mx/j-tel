/**
 * Ventana de observación derivada de la duración real de la ruta.
 *
 * El ancho de la ventana era una constante de política: el motor abría los
 * ojos N minutos antes del deadline sin que nadie hubiera derivado ese N de
 * nada. Como la ruta corre ANTES del deadline, cualquier recorrido más largo
 * que ese N arranca con el motor ciego, y después se califica al carrier
 * contra el trazado completo — incluido el tramo que nunca se miró.
 *
 * Aquí se deriva el lado de "antes" de la duración real del recorrido. Medir
 * cuánto dura una ruta es un hecho, no una calibración: ningún umbral de
 * cumplimiento se toca. El lado de "después" (gracia + margen) tampoco.
 *
 * Esto vive en el dominio y no en el motor porque `computeEvidenceWindow` —la
 * ventana que la generación de ocurrencias graba en cada viaje— es política,
 * y el motor (`@jtel/verification`) ya depende del dominio: al revés sería un
 * ciclo. `@jtel/verification` re-exporta todo lo de aquí, así que sigue
 * habiendo una sola implementación, no dos.
 */

/** Holgura (%) que se le suma a la duración de la ruta para dimensionar la ventana. */
export const DEFAULT_WINDOW_SLACK_PCT = 25;
/** Percentil de las duraciones históricas: la ventana cubre el día lento, no el típico. */
export const DEFAULT_ROUTE_DURATION_PERCENTILE = 90;
/** Muestras mínimas para creerle a la historia; por debajo, no hay duración medida. */
export const DEFAULT_ROUTE_DURATION_MIN_SAMPLES = 3;
/** Techo duro del lado "antes" (min): una medición loca no abre una ventana absurda. */
export const DEFAULT_MAX_WINDOW_BEFORE_MINUTES = 360;
/**
 * Velocidad promedio (km/h) para estimar la duración de una ruta sin historia.
 *
 * 20 y no 25: es una ruta de recolección de personal, con paradas y colonia,
 * no flujo libre. Contra el diagnóstico del 30 de julio, 25 km/h estimaba
 * 89 min para Huertas-B (dura 96) y dejaba el arranque afuera otra vez; 20
 * estima 111 y sí lo cubre. Es perilla de contrato: donde la operación sea
 * más rápida, se sube.
 */
export const DEFAULT_ROUTE_AVG_SPEED_KMH = 20;

const EARTH_RADIUS_KM = 6371;

/** Distancia entre dos coordenadas (km). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export type RouteDurationSample = {
  durationMinutes: number;
  /** La muestra venía recortada por la ventana: la ruta duró al menos esto. */
  lowerBound?: boolean;
};

export type RouteDurationSummary = {
  /** Duración con la que dimensionar la ventana (min); null si no hay historia suficiente. */
  minutes: number | null;
  sampleCount: number;
  lowerBoundCount: number;
  percentile: number;
};

/**
 * Resume las duraciones observadas de una ruta.
 *
 * Percentil alto, no promedio: la ventana tiene que cubrir el día lento, no
 * el día típico — si cubre el típico, la mitad de los días vuelve a haber
 * arranque no observado.
 *
 * Las muestras marcadas como cota inferior levantan un piso: una medición
 * recortada prueba que la ruta dura AL MENOS eso, así que el resumen nunca
 * queda por debajo de la mayor de ellas. Así el ancho converge subiendo —
 * se mide, se abre más, se vuelve a medir sin recorte — en vez de quedarse
 * atrapado en la ventana angosta que produjo las mediciones.
 */
export function summarizeRouteDuration(
  samples: RouteDurationSample[],
  opts: { percentile?: number; minSamples?: number } = {},
): RouteDurationSummary {
  const percentile = Math.min(
    100,
    Math.max(1, opts.percentile ?? DEFAULT_ROUTE_DURATION_PERCENTILE),
  );
  const minSamples = Math.max(1, opts.minSamples ?? DEFAULT_ROUTE_DURATION_MIN_SAMPLES);

  const valid = samples.filter(
    (s) => Number.isFinite(s.durationMinutes) && s.durationMinutes > 0,
  );
  const lowerBoundCount = valid.filter((s) => s.lowerBound).length;
  if (valid.length < minSamples) {
    return { minutes: null, sampleCount: valid.length, lowerBoundCount, percentile };
  }

  const sorted = valid.map((s) => s.durationMinutes).sort((a, b) => a - b);
  // Rango más cercano, sin interpolar: el valor devuelto es siempre una
  // duración que de verdad ocurrió, no un promedio de dos días distintos.
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const value = sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]!;

  const lowerBoundFloor = valid
    .filter((s) => s.lowerBound)
    .reduce((max, s) => Math.max(max, s.durationMinutes), 0);

  return {
    minutes: Math.max(value, lowerBoundFloor),
    sampleCount: valid.length,
    lowerBoundCount,
    percentile,
  };
}

/** Largo total del trazado (km) siguiendo sus waypoints en orden. */
export function routeLengthKm(waypoints: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineKm(
      waypoints[i - 1]!.lat,
      waypoints[i - 1]!.lng,
      waypoints[i]!.lat,
      waypoints[i]!.lng,
    );
  }
  return total;
}

/**
 * Duración estimada de una ruta sin historia: largo del trazado sobre una
 * velocidad promedio configurable. Es el arranque en frío — una ruta nueva de
 * 30 km no debe empezar su vida con una ventana de 60 minutos.
 */
export function estimateRouteDurationMinutes(
  lengthKm: number,
  avgSpeedKmh: number = DEFAULT_ROUTE_AVG_SPEED_KMH,
): number | null {
  if (!Number.isFinite(lengthKm) || lengthKm <= 0) return null;
  if (!Number.isFinite(avgSpeedKmh) || avgSpeedKmh <= 0) return null;
  return (lengthKm / avgSpeedKmh) * 60;
}

/** De dónde salió el ancho de la ventana. Se declara; no se adivina después. */
export type ObservationWindowBasis = "medida" | "estimada_geometria" | "politica";

export type ObservationWindowParams = {
  /** Duración resumida de la historia de esta ruta (min); null si no alcanza. */
  measuredDurationMinutes?: number | null;
  /** Trazado, para el arranque en frío. Alternativa a `routeLengthKm`. */
  kmlWaypoints?: Array<{ lat: number; lng: number }>;
  /** Largo del trazado (km) si ya viene calculado. */
  routeLengthKm?: number | null;
  /** Velocidad promedio para la estimación geométrica (km/h). */
  avgSpeedKmh?: number;
  /** Holgura (%) sobre la duración de la ruta. */
  slackPct?: number;
  /**
   * Piso del lado "antes": el margen que ya trae la política del contrato.
   * La ventana derivada nunca queda más angosta que la configurada.
   */
  minBeforeMinutes: number;
  /** Techo del lado "antes" (min). */
  maxBeforeMinutes?: number;
  /** Lado "después" (gracia + margen posterior). Este arreglo no lo toca. */
  afterMinutes: number;
};

export type DerivedObservationWindow = {
  windowStart: Date;
  windowEnd: Date;
  beforeMinutes: number;
  afterMinutes: number;
  widthMinutes: number;
  basis: ObservationWindowBasis;
  /** Duración de ruta con la que se dimensionó (min); null si mandó la política. */
  routeDurationMinutes: number | null;
  /** El techo recortó lo que la duración pedía: la ventana puede seguir corta. */
  cappedByMax: boolean;
};

/**
 * Ventana de observación de una ocurrencia, con el lado de "antes" derivado
 * de cuánto dura de verdad la ruta.
 *
 *   antes = acotar( duración × (1 + holgura), pisoDePolítica, techo )
 *   después = gracia + margen posterior (sin cambios)
 *
 * La duración sale, en orden: de la historia medida de la ruta, de la
 * geometría del trazado, o —si no hay ninguna de las dos— de la política tal
 * como está hoy. Cuál de las tres mandó viaja en `basis`, para que el
 * expediente pueda declarar sobre qué se abrió la ventana.
 */
export function deriveObservationWindow(
  deadline: Date,
  params: ObservationWindowParams,
): DerivedObservationWindow {
  const slackPct = Math.max(0, params.slackPct ?? DEFAULT_WINDOW_SLACK_PCT);
  const floor = Math.max(0, params.minBeforeMinutes);
  // Un techo por debajo del piso configurado no puede angostar la ventana: la
  // política del contrato es el mínimo, siempre.
  const ceiling = Math.max(
    floor,
    params.maxBeforeMinutes ?? DEFAULT_MAX_WINDOW_BEFORE_MINUTES,
  );
  const afterMinutes = Math.max(0, params.afterMinutes);

  const measured =
    params.measuredDurationMinutes != null &&
    Number.isFinite(params.measuredDurationMinutes) &&
    params.measuredDurationMinutes > 0
      ? params.measuredDurationMinutes
      : null;

  const lengthKm =
    params.routeLengthKm ??
    (params.kmlWaypoints && params.kmlWaypoints.length > 1
      ? routeLengthKm(params.kmlWaypoints)
      : null);
  const estimated =
    measured === null && lengthKm !== null
      ? estimateRouteDurationMinutes(lengthKm, params.avgSpeedKmh)
      : null;

  const routeDurationMinutes = measured ?? estimated;
  const basis: ObservationWindowBasis =
    measured !== null ? "medida" : estimated !== null ? "estimada_geometria" : "politica";

  const required =
    routeDurationMinutes === null
      ? floor
      : Math.ceil(routeDurationMinutes * (1 + slackPct / 100));
  const beforeMinutes = Math.min(ceiling, Math.max(floor, required));

  return {
    windowStart: new Date(deadline.getTime() - beforeMinutes * 60_000),
    windowEnd: new Date(deadline.getTime() + afterMinutes * 60_000),
    beforeMinutes,
    afterMinutes,
    widthMinutes: beforeMinutes + afterMinutes,
    basis,
    routeDurationMinutes,
    cappedByMax: required > ceiling,
  };
}
