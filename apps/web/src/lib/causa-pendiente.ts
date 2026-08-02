import type { Cobertura } from "@jtel/services";

/**
 * Por qué el árbitro no pudo juzgar un servicio.
 *
 * `pendiente_evidencia` NO es un solo caso. El motor lo emite por cuatro
 * caminos distintos —`verifyOccurrence` en `packages/verification`— y deja
 * escrito cuál fue, con su `reason`, en el paso de decisión del ledger.
 *
 * Vive aparte de las dos pantallas que lo usan (la bandeja de pendientes y
 * Cierre del turno) porque las dos tienen que contar exactamente la misma
 * historia: si una dedujera la causa por su cuenta, el mismo servicio se
 * explicaría de dos formas distintas según dónde se mire.
 *
 * `desconocida` existe para los hechos cuyo ledger no quedó emparejado. Es
 * preferible callar la causa que inventarle una.
 */
export type CausaPendiente =
  /** No llegó un solo punto en toda la ventana. */
  | "sin_evidencia"
  /** La señal no alcanzó el mínimo de cobertura del contrato. */
  | "cobertura_insuficiente"
  /** Una unidad llegó, pero su recorrido no alcanza el mínimo de ninguna ruta. */
  | "llegada_sin_atribucion"
  /** La ventana no alcanzó a cubrir el arranque de la ruta. */
  | "observacion_insuficiente"
  | "desconocida";

export type PasoLedger = { step?: string; result?: string; details?: Record<string, unknown> };

/**
 * Saca la causa del ledger, en el orden en que el motor las decide.
 *
 * El paso `evidencia: indisponible` gana sobre todo: si no hubo un punto, no
 * hay nada más que contar. Después manda el `reason` que el paso de decisión
 * dejó escrito, y solo si ninguno aparece se cae a la cobertura — que a esas
 * alturas sí es la única explicación posible.
 *
 * **Nunca se deduce de la cobertura primero.** Ese era el error: la pantalla
 * contaba "no hubo suficiente señal" para las cuatro causas, y en una planta
 * real 39 de 54 pendientes tenían la cobertura por encima del umbral. La frase
 * acusaba de perder señal a quien no la había perdido.
 */
export function leerCausaPendiente(steps: unknown, cobertura: Cobertura): CausaPendiente {
  if (!Array.isArray(steps)) return "desconocida";
  const pasos = steps as PasoLedger[];

  if (pasos.some((s) => s?.step === "evidencia" && s?.result === "indisponible")) {
    return "sin_evidencia";
  }

  const decision = pasos.find(
    (s) => s?.result === "pendiente_evidencia" && typeof s?.details?.reason === "string",
  );
  const reason = decision?.details?.reason;
  if (reason === "llegada_sin_atribucion") return "llegada_sin_atribucion";
  if (reason === "observacion_insuficiente") return "observacion_insuficiente";

  if (cobertura.disponible && cobertura.pct < cobertura.minimoPct) {
    return "cobertura_insuficiente";
  }
  return "desconocida";
}

/**
 * Qué fracción del trazado se alcanzó a ver antes de la tolerancia de origen.
 * Solo significa algo con `observacion_insuficiente`.
 */
export function leerFraccionObservada(steps: unknown): number | null {
  if (!Array.isArray(steps)) return null;
  const fr = (steps as PasoLedger[]).find(
    (s) => typeof s?.details?.earliestObservedFraction === "number",
  )?.details?.earliestObservedFraction;
  return typeof fr === "number" ? fr : null;
}
