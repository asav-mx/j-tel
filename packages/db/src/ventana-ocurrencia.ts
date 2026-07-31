import {
  computeEvidenceWindow,
  routeLengthKm,
  summarizeRouteDuration,
  type ContractPolicy,
  type DerivedObservationWindow,
  type EvidenceWindowRoute,
  type RouteDurationSample,
} from "@jtel/domain";

/**
 * Los hechos de la ruta con los que la generación de ocurrencias dimensiona la
 * ventana de observación: qué tan larga es y cuánto ha durado de verdad.
 *
 * Se calcula UNA vez por ruta×turno y se reusa para todas las fechas del
 * rango — el trazado y la historia no cambian de un día para otro dentro de
 * la misma corrida.
 */
export function routeWindowSizing(
  kmlWaypoints: Array<{ lat: number; lng: number }> | null | undefined,
  samples: RouteDurationSample[],
  policy: Pick<ContractPolicy, "routeDurationPercentile" | "routeDurationMinSamples">,
): EvidenceWindowRoute {
  const summary = summarizeRouteDuration(samples, {
    percentile: policy.routeDurationPercentile,
    minSamples: policy.routeDurationMinSamples,
  });

  return {
    measuredDurationMinutes: summary.minutes,
    // El largo se calcula aunque haya historia: cuesta nada y deja el
    // arranque en frío listo si un día la historia se vacía.
    routeLengthKm:
      kmlWaypoints && kmlWaypoints.length > 1 ? routeLengthKm(kmlWaypoints) : null,
  };
}

/**
 * Ventana de observación de una ocurrencia concreta: la política pone el piso
 * y el lado de después, la ruta pone el ancho de adelante.
 */
export function windowForOccurrence(
  deadline: Date,
  policy: Parameters<typeof computeEvidenceWindow>[1],
  sizing: EvidenceWindowRoute,
): DerivedObservationWindow {
  return computeEvidenceWindow(deadline, policy, sizing);
}
