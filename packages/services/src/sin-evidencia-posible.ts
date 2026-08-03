/**
 * Cuándo un servicio deja de esperar evidencia que no va a llegar.
 *
 * EL PROBLEMA QUE RESUELVE. Cinco servicios de junio llevaban desde el 10 de
 * julio reintentándose **cada minuto**: 31 400 verificaciones cada uno, 31 400
 * entradas de ledger, 31 400 notificaciones al cliente, y una llamada al
 * proveedor de GPS por minuto por cada uno. Su ventana de evidencia es del
 * 22–26 de junio y la memoria propia empieza el 28: no hay dato que los pueda
 * resolver, y no lo iba a haber nunca. La cola no tenía forma de saberlo.
 *
 * ESTO NO ES UN CUARTO VEREDICTO. Los veredictos son tres y es ley del
 * producto: `cumplido`, `no_cumplido`, `pendiente_evidencia`. Sin evidencia
 * NO es incumplimiento, y este archivo no lo convierte en uno. El veredicto se
 * queda en `pendiente_evidencia` — lo que cambia es el estado de la EVIDENCIA,
 * que describe qué se pudo observar y no qué hizo el transportista.
 *
 * ES REVERSIBLE A PROPÓSITO. Es un estado de cola, no una sentencia: una
 * re-verificación con `force` lo ignora, y si mañana un relleno de huecos trae
 * los datos que faltaban, el servicio se puede volver a juzgar. Por eso se
 * registra en el ledger con su razón: para que alguien pueda discutirla.
 */

/** Intentos previos antes de retirar algo de la cola. Un fallo transitorio no basta. */
export const MIN_INTENTOS_ANTES_DE_RETIRAR = 30;

/**
 * Cuánto se espera a que la evidencia aparezca por otras vías (relleno de
 * huecos, archivador) antes de aceptar que no va a aparecer. Generoso a
 * propósito: equivocarse aquí es dejar sin juicio un servicio que sí tenía
 * cómo juzgarse, y eso es peor que reintentar de más unos días.
 */
export const DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA = 14;

export type RazonSinEvidencia =
  /** La ventana termina antes de que exista memoria propia del carrier. */
  | "ventana_anterior_a_la_memoria"
  /** Pasaron semanas y ni la memoria ni el proveedor la trajeron. */
  | "plazo_vencido_sin_evidencia";

export interface EntradaSinEvidencia {
  /** Fin de la ventana de evidencia del viaje. */
  finDeVentana: Date;
  /**
   * Primer punto de telemetría propia que existe para ese carrier, o `null` si
   * el carrier todavía no tiene ni un punto guardado.
   */
  horizonteDeMemoria: Date | null;
  /**
   * Verificaciones automáticas previas de esta ocurrencia. Se usa como cota
   * INFERIOR de intentos fallidos: solo se consulta cuando el estado actual ya
   * es `pendiente_evidencia` con la evidencia indisponible, así que cada
   * entrada anterior fue un intento que tampoco encontró nada.
   */
  intentosPrevios: number;
  ahora: Date;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Devuelve la razón por la que este servicio ya no puede resolverse, o `null`
 * si todavía tiene sentido reintentarlo.
 *
 * Ninguna razón dispara sin intentos previos: el propósito es cortar lazos
 * infinitos, no rendirse en el primer minuto.
 */
export function razonSinEvidenciaPosible(
  entrada: EntradaSinEvidencia,
): RazonSinEvidencia | null {
  if (entrada.intentosPrevios < MIN_INTENTOS_ANTES_DE_RETIRAR) return null;

  // La memoria propia empieza después de que la ventana terminó: ningún punto
  // guardado puede caer dentro de ella, ni hoy ni nunca. Es una afirmación
  // sobre lo que existe, no una estimación.
  if (
    entrada.horizonteDeMemoria &&
    entrada.finDeVentana.getTime() < entrada.horizonteDeMemoria.getTime()
  ) {
    return "ventana_anterior_a_la_memoria";
  }

  // Sin esta segunda razón, un servicio cuya ventana SÍ cae dentro de la
  // memoria pero que nunca tuvo señal se reintentaría para siempre igual: el
  // mismo lazo, nada más que sin fecha de inicio conocida.
  const diasVencido = (entrada.ahora.getTime() - entrada.finDeVentana.getTime()) / DIA_MS;
  if (diasVencido > DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA) {
    return "plazo_vencido_sin_evidencia";
  }

  return null;
}

/** Cómo se cuenta en el ledger, para que un humano pueda discutirlo. */
export function explicarRazon(razon: RazonSinEvidencia): string {
  switch (razon) {
    case "ventana_anterior_a_la_memoria":
      return "La ventana de evidencia de este servicio termina antes del primer dato de telemetría que existe para este transportista. No hay ni puede haber un punto que la cubra.";
    case "plazo_vencido_sin_evidencia":
      return `Pasaron más de ${DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA} días desde el fin de la ventana sin que apareciera evidencia, ni en memoria propia ni por el proveedor de GPS.`;
  }
}
