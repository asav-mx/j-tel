/**
 * Cierre del turno — la lógica que decide qué se muestra y cómo se escribe.
 *
 * Vive aquí y no en `apps/web` porque la app no tiene corredor de pruebas
 * (ver docs/DESPUES.md). Todo lo de este archivo es puro: entra dato medido,
 * sale dato medido. Ninguna función de aquí juzga nada — el veredicto ya está
 * sellado y esta pantalla solo lo lee.
 */

/** Un punto de evidencia ya anclado, reducido a lo que necesitamos. */
export type PuntoAnclado = { at: Date };

export type Hueco = {
  /** Duración del hueco en minutos, con decimales. */
  minutos: number;
  desde: Date;
  hasta: Date;
};

/**
 * El hueco más grande dentro de la ventana de evidencia.
 *
 * Describe evidencia ya anclada; NO recalcula el veredicto. Los bordes de la
 * ventana cuentan: si el GPS empezó a reportar tarde, ese silencio inicial es
 * un hueco real y se mide desde el inicio de la ventana.
 *
 * Devuelve `null` si no hay ventana válida. Con cero puntos el hueco es la
 * ventana entera, que es exactamente lo que hay que decir.
 */
export function mayorHueco(
  puntos: PuntoAnclado[],
  ventana: { inicio: Date; fin: Date },
): Hueco | null {
  const inicioMs = ventana.inicio.getTime();
  const finMs = ventana.fin.getTime();
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= inicioMs) return null;

  const dentro = puntos
    .map((p) => p.at.getTime())
    .filter((t) => t >= inicioMs && t <= finMs)
    .sort((a, b) => a - b);

  let mejorInicio = inicioMs;
  let mejorFin = inicioMs;
  let anterior = inicioMs;
  for (const t of dentro) {
    if (t - anterior > mejorFin - mejorInicio) {
      mejorInicio = anterior;
      mejorFin = t;
    }
    anterior = t;
  }
  if (finMs - anterior > mejorFin - mejorInicio) {
    mejorInicio = anterior;
    mejorFin = finMs;
  }

  return {
    minutos: (mejorFin - mejorInicio) / 60_000,
    desde: new Date(mejorInicio),
    hasta: new Date(mejorFin),
  };
}

/**
 * Escribe una duración como duración, nunca con formato de hora.
 *
 * La regla del lenguaje: los instantes llevan fecha, los intervalos llevan
 * unidad. `10:00` se lee como hora del día; `10 min` no se puede confundir.
 */
export function formatearDuracion(minutos: number): string {
  // Se redondea UNA vez, a segundos totales, y de ahí se parte. Redondear los
  // segundos por separado del minuto produce "1:60 min" y "60 s": el segundo
  // sube a 60 pero el minuto ya quedó fijo. La partición va después del
  // redondeo, nunca al revés.
  const totalSeg = Math.round(Math.abs(minutos) * 60);
  const horas = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;

  if (horas > 0) {
    return min > 0 ? `${horas} h ${min} min` : `${horas} h`;
  }
  if (min > 0) {
    return seg > 0 ? `${min}:${String(seg).padStart(2, "0")} min` : `${min} min`;
  }
  return `${seg} s`;
}

/**
 * Margen contra el límite: negativo llegó antes, positivo llegó después.
 * Se devuelve en minutos con decimales; quien lo escriba usa `formatearDuracion`.
 */
export function margenMinutos(llegada: Date, limite: Date): number {
  return (llegada.getTime() - limite.getTime()) / 60_000;
}

/** El límite que gobierna: deadline del hecho más la tolerancia congelada. */
export function limiteConTolerancia(deadline: Date, toleranciaMinutos: number): Date {
  return new Date(deadline.getTime() + toleranciaMinutos * 60_000);
}

export type EstadoServicio = "cumplido" | "no_cumplido" | "pendiente_evidencia" | null;

/**
 * ¿Este servicio necesita al usuario, o cerró limpio?
 *
 * Excepción es todo lo que no sea un cumplido dentro de tolerancia. Un cumplido
 * que llegó tarde SIGUE siendo cumplido —el chip no cambia— pero necesita
 * atención, así que sube a la lista de excepciones con su motivo debajo.
 *
 * Un servicio sin hecho todavía no es excepción: no es que algo saliera mal, es
 * que el turno no ha cerrado para él.
 */
export function esExcepcion(estado: EstadoServicio, timing: string | null): boolean {
  if (estado == null) return false;
  if (estado === "cumplido") return timing === "tarde";
  return true;
}

export type ConteoTurno = {
  total: number;
  cumplido: number;
  no_cumplido: number;
  pendiente_evidencia: number;
  sin_verificar: number;
  /** Desglose del cumplido, que existe en el hecho y sí tiene con qué llenarse. */
  temprano: number;
  a_tiempo: number;
  tarde: number;
};

export function contarTurno(
  servicios: Array<{ estado: EstadoServicio; timing: string | null }>,
): ConteoTurno {
  const c: ConteoTurno = {
    total: servicios.length,
    cumplido: 0,
    no_cumplido: 0,
    pendiente_evidencia: 0,
    sin_verificar: 0,
    temprano: 0,
    a_tiempo: 0,
    tarde: 0,
  };
  for (const s of servicios) {
    if (s.estado === "cumplido") c.cumplido++;
    else if (s.estado === "no_cumplido") c.no_cumplido++;
    else if (s.estado === "pendiente_evidencia") c.pendiente_evidencia++;
    else c.sin_verificar++;

    if (s.timing === "temprano") c.temprano++;
    else if (s.timing === "a_tiempo") c.a_tiempo++;
    else if (s.timing === "tarde") c.tarde++;
  }
  return c;
}

/**
 * El titular de la pantalla.
 *
 * Se sostiene SOLO con el conteo de resultados, que siempre existe. La cobertura
 * de evidencia va aparte como línea secundaria justamente porque depende de
 * emparejar con el ledger y a menudo no va a estar — un titular que dependiera
 * de ella se rompería con frecuencia.
 */
export function titularDelTurno(c: ConteoTurno): string {
  if (c.total === 0) return "No hay servicios programados para este turno.";
  if (c.sin_verificar === c.total) return "El turno todavía no cierra.";

  const conConsecuencia = c.no_cumplido + c.pendiente_evidencia + c.tarde;

  // Mientras quede un servicio sin verificar, el turno NO cerró — y decir que
  // cerró limpio sería afirmar sobre lo que todavía no se juzgó. El pendiente
  // se dice en voz alta en vez de esconderse detrás de los que ya salieron.
  if (c.sin_verificar > 0) {
    const cola = `${c.sin_verificar} sin verificar todavía`;
    if (conConsecuencia === 0) return `El turno va limpio · ${cola}.`;
    if (conConsecuencia === 1) return `Un servicio te necesita · ${cola}.`;
    return `${conConsecuencia} servicios te necesitan · ${cola}.`;
  }

  if (conConsecuencia === 0) return "El turno cerró limpio.";
  if (conConsecuencia === 1) return "El turno cerró. Un servicio te necesita.";
  return `El turno cerró. ${conConsecuencia} servicios te necesitan.`;
}
