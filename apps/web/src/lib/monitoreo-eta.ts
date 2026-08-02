import {
  SIN_SENAL_MINUTOS,
  summarizeRouteDuration,
  type EtaBasis,
  type RouteDurationSample,
} from "@jtel/domain";

/**
 * La llegada estimada de una unidad en camino.
 *
 * **Es inferencia, no medición**, y todo en este archivo existe para que eso no
 * se olvide al leerla. Va en acero en la pantalla, se muestra como estimación y
 * declara de dónde salió. La llegada MEDIDA es otra cosa: la entrada real a la
 * geocerca, que ya vive en `arrivalAt`.
 *
 * Vive aparte de `monitoreo-data.ts` y como función pura por la misma razón que
 * `monitoreo-umbrales.ts`: encierra una ley, no una conveniencia, y se prueba
 * sin abrir la base de datos.
 */

/**
 * Percentil de la historia con el que se estima la llegada.
 *
 * **50 y no 90, aunque la ventana de observación use 90.** No es descuido: son
 * dos preguntas distintas sobre los mismos datos. La ventana quiere no perderse
 * nada, así que cubre el día lento. La estimación quiere **acertar**, así que
 * usa el día típico — una ETA en p90 diría sistemáticamente "más tarde de lo
 * normal" y la torre se volvería el reloj que siempre adelanta.
 */
export const PERCENTIL_ETA = 50;

/**
 * Fracción de ruta que hay que llevar cubierta antes de creerle al ritmo de
 * este viaje.
 *
 * El ritmo observado se dispara justo cuando la fracción cubierta es chica: una
 * unidad que lleva veinte minutos levantando gente en el origen va al 3 % de la
 * ruta, y extrapolar eso proyecta horas de camino que no existen. El dato es
 * correcto —de verdad lleva veinte minutos y de verdad va en el 3 %— y aun así
 * la conclusión sería falsa. Por debajo de este umbral esa base no responde y
 * la cascada sigue de largo.
 */
export const AVANCE_MINIMO_PARA_RITMO = 0.25;

export type Estimacion = {
  /** Minutos que faltan para llegar, desde ahora. */
  minutosRestantes: number;
  base: EtaBasis;
};

export type EntradaEta = {
  /** El servicio ya tiene hecho sellado. */
  cerrado: boolean;
  /** La unidad ya entró a la geocerca de destino. */
  llego: boolean;
  /**
   * Hace cuánto se recibió el último punto GPS de esta unidad, en minutos.
   * `null` cuando no hay unidad de la cual preguntarlo.
   */
  edadSenalMinutos: number | null;
  /** Fracción del trazado ya recorrida (0–1). */
  avanceFraccion: number | null;
  /** Kilómetros que faltan sobre el trazado contratado. */
  restanteKm: number | null;
  /** Minutos transcurridos desde el primer punto en corredor de ESTE viaje. */
  transcurridoMinutos: number | null;
  /** Duraciones ya medidas de esta ruta×turno. */
  muestras: RouteDurationSample[];
  /** Velocidad promedio contratada (km/h) para el arranque en frío. */
  avgSpeedKmh: number;
};

/** Redondeo a minuto entero, sin fingir precisión de segundos que no hay. */
function minutos(valor: number): number | null {
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor);
}

/**
 * Cuánto falta para que llegue — o `null` cuando estimarlo sería inventar.
 *
 * Dos negativas antes de cualquier cuenta:
 *
 * 1. **Señal vieja o sin unidad → `null`.** Una hora calculada sobre el último
 *    punto de hace media hora se lee igual de firme que una calculada sobre el
 *    de hace un minuto, y no lo es. El umbral es el MISMO con el que la banda
 *    marca la unidad en ámbar (`SIN_SENAL_MINUTOS`, del dominio): si la torre
 *    dice "sin señal", no puede a la vez decir "llega a las 14:32".
 * 2. **Ya llegó, o el servicio está cerrado → `null`.** No se estima lo que ya
 *    ocurrió; para eso está la llegada medida.
 *
 * Después, la cascada. Gana la primera fuente que pueda responder, y cuál fue
 * viaja en `base` para que la pantalla lo pueda decir.
 */
export function estimarLlegada(entrada: EntradaEta): Estimacion | null {
  if (entrada.cerrado || entrada.llego) return null;
  if (entrada.edadSenalMinutos === null) return null;
  if (entrada.edadSenalMinutos >= SIN_SENAL_MINUTOS) return null;

  const avance = entrada.avanceFraccion;
  if (avance === null || !Number.isFinite(avance)) return null;
  // Acotado a [0,1]: una fracción fuera de rango produciría un "falta" negativo
  // o mayor que la ruta entera.
  const cubierto = Math.min(1, Math.max(0, avance));
  const falta = 1 - cubierto;
  // Ya está sobre el destino pero la geocerca no lo ha registrado: no hay camino
  // que estimar, y decir "0 min" afirmaría una llegada que nadie midió.
  if (falta <= 0) return null;

  // ── 1 · La historia medida de esta ruta ─────────────────────────────────
  // Cuando existe, es la mejor fuente: son recorridos completos de esta misma
  // ruta y turno, no una extrapolación de lo que va del viaje de hoy.
  const historia = summarizeRouteDuration(entrada.muestras, {
    percentile: PERCENTIL_ETA,
  });
  if (historia.minutes !== null && historia.minutes > 0) {
    const m = minutos(historia.minutes * falta);
    if (m !== null) return { minutosRestantes: m, base: "medida" };
  }

  // ── 2 · El ritmo de este viaje ──────────────────────────────────────────
  // Mide el tráfico y el chofer de hoy, que la historia no conoce. Solo cuando
  // ya se recorrió lo suficiente para que el arranque no domine la cuenta.
  if (
    cubierto >= AVANCE_MINIMO_PARA_RITMO &&
    entrada.transcurridoMinutos !== null &&
    entrada.transcurridoMinutos > 0
  ) {
    const duracionProyectada = entrada.transcurridoMinutos / cubierto;
    const m = minutos(duracionProyectada * falta);
    if (m !== null) return { minutosRestantes: m, base: "ritmo_observado" };
  }

  // ── 3 · La geometría del trazado ────────────────────────────────────────
  // El arranque en frío: los km que faltan sobre la velocidad promedio que el
  // contrato declara. Es la misma cuenta con la que se dimensiona la ventana de
  // observación cuando tampoco hay historia.
  if (
    entrada.restanteKm !== null &&
    entrada.restanteKm > 0 &&
    Number.isFinite(entrada.avgSpeedKmh) &&
    entrada.avgSpeedKmh > 0
  ) {
    const m = minutos((entrada.restanteKm / entrada.avgSpeedKmh) * 60);
    if (m !== null) return { minutosRestantes: m, base: "estimada_geometria" };
  }

  return null;
}

/** Cómo se lee cada procedencia en la pantalla, sin palabras de motor. */
export const LECTURA_BASE_ETA: Record<EtaBasis, string> = {
  medida: "sobre lo que esta ruta ha tardado otros días",
  ritmo_observado: "sobre el avance de la unidad en este viaje",
  estimada_geometria: "sobre la distancia que falta del trazado contratado",
};
