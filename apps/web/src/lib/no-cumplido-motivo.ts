/**
 * Detalle legible bajo el chip no_cumplido (solo lectura del hecho congelado).
 * Los tres estados de cara al cliente no cambian.
 */

export type NoCumplidoMotivo = "tarde" | "sin_servicio";

export function classifyNoCumplido(fact: {
  status?: string | null;
  observedUnitId?: string | null;
} | null | undefined): NoCumplidoMotivo | null {
  if (!fact || fact.status !== "no_cumplido") return null;
  return fact.observedUnitId ? "tarde" : "sin_servicio";
}

export function noCumplidoDetailLine(input: {
  status?: string | null;
  timing?: string | null;
  observedUnitId?: string | null;
  observedArrivalAt?: Date | string | null;
  expectedDeadline?: Date | string | null;
  observedUnitLabel?: string | null;
}): string | null {
  if (input.status !== "no_cumplido") return null;

  if (!input.observedUnitId) {
    return "Sin servicio detectado en la ventana";
  }

  const unit = input.observedUnitLabel?.trim() || "unidad registrada";
  let lateMin: number | null = null;
  if (input.observedArrivalAt && input.expectedDeadline) {
    const arrival = new Date(input.observedArrivalAt).getTime();
    const deadline = new Date(input.expectedDeadline).getTime();
    if (Number.isFinite(arrival) && Number.isFinite(deadline) && arrival > deadline) {
      lateMin = Math.round((arrival - deadline) / 60_000);
    }
  }

  if (lateMin != null && lateMin > 0) {
    return `Llegada tarde (+${lateMin} min, ${unit})`;
  }
  if (input.timing === "tarde") {
    return `Llegada tarde (${unit})`;
  }
  return `Servicio con unidad observada (${unit}) — no cumplido`;
}

/**
 * El motivo de puntualidad bajo un servicio CUMPLIDO.
 *
 * "Tarde" no es un cuarto estado ni un color: es un motivo debajo de cumplido.
 * El servicio se prestó y el árbitro lo selló como cumplido; que llegara fuera
 * de tolerancia es consecuencia del contrato —enforcement—, no otro veredicto.
 * Por eso el chip sigue verde y esto va aquí abajo.
 *
 * **La tolerancia viene del contrato, y del contrato CONGELADO.** Se lee del
 * `contractPolicySnapshot` del hecho, no de la política de hoy: el hecho se
 * calculó una vez con los umbrales que regían entonces, y mostrar el umbral
 * vigente al abrir la pantalla haría que el número y su lectura no se
 * correspondan. Nunca una constante.
 *
 * Precisión de la etiqueta: `tarde` significa que la llegada quedó FUERA de la
 * tolerancia — dentro, el motor la habría llamado `a_tiempo`. Por eso el
 * renglón dice de cuánto fue el exceso y contra qué tolerancia se midió: sin
 * las dos mitades, el auditado no puede saber si el árbitro fue justo.
 */
export function motivoTiming(input: {
  status?: string | null;
  timing?: string | null;
  observedArrivalAt?: Date | string | null;
  expectedDeadline?: Date | string | null;
  toleranceMinutes?: number | null;
}): string | null {
  if (input.status !== "cumplido") return null;
  if (input.timing !== "tarde" && input.timing !== "temprano") return null;

  const partes: string[] = [input.timing === "tarde" ? "Tarde" : "Temprano"];

  if (input.observedArrivalAt && input.expectedDeadline) {
    const llegada = new Date(input.observedArrivalAt).getTime();
    const deadline = new Date(input.expectedDeadline).getTime();
    if (Number.isFinite(llegada) && Number.isFinite(deadline)) {
      const min = Math.abs(Math.round((llegada - deadline) / 60_000));
      partes.push(`${min} min ${input.timing === "tarde" ? "después" : "antes"} del deadline`);
    }
  }

  // Si no hay tolerancia guardada no se inventa una: se omite la lectura en
  // vez de mostrar un umbral que no fue el que se aplicó.
  if (typeof input.toleranceMinutes === "number" && Number.isFinite(input.toleranceMinutes)) {
    partes.push(`tolerancia del contrato ${input.toleranceMinutes} min`);
  }

  return partes.join(" · ");
}

/** Columna motivo para reportes CSV. */
export function reportMotivo(input: {
  status: string;
  timing: string | null;
  observedUnitId?: string | null;
  observedUnitLabel?: string | null;
}): string {
  if (input.status === "no_cumplido" && !input.observedUnitId && !input.observedUnitLabel) {
    return "sin_servicio";
  }
  if (input.status === "no_cumplido" && (input.observedUnitId || input.observedUnitLabel)) {
    return "tarde";
  }
  if (input.status === "cumplido" && input.timing === "tarde") {
    return "tarde";
  }
  if (input.status === "cumplido") {
    return input.timing ?? "cumplido";
  }
  if (input.status === "pendiente_evidencia") {
    return "pendiente_evidencia";
  }
  return input.status;
}
