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
