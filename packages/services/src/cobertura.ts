/**
 * Cobertura de la ventana de evidencia — lectura del paso `cobertura_evidencia`
 * del ledger.
 *
 * Pura por diseño: entra el arreglo de pasos del ledger ya emparejado con el
 * hecho, sale la medición o la razón honesta de por qué no hay una. No decide
 * nada — el árbitro ya decidió; esto solo lee lo que quedó escrito.
 */

/** Por qué no se pudo poner la medición de cobertura junto a este sello. */
export type CoberturaNoDisponible = {
  disponible: false;
  razon: "no_entry" | "ambiguous" | "out_of_tolerance" | "sin_paso";
};

export type CoberturaMedida = {
  disponible: true;
  pct: number;
  minimoPct: number;
  mayorHuecoMinutos: number | null;
  huecoMaximoPermitido: number | null;
};

export type Cobertura = CoberturaMedida | CoberturaNoDisponible;

export const COBERTURA_STEP = "cobertura_evidencia";

type PasoLedger = { step?: string; details?: Record<string, unknown> };

/**
 * Lee la medición de cobertura del paso `cobertura_evidencia`, si está.
 *
 * Devuelve `null` cuando el paso simplemente no aparece en los `steps` —
 * quien llama decide qué `CoberturaNoDisponible` corresponde (por ejemplo,
 * si el ledger ni siquiera emparejó con el hecho).
 */
export function leerCobertura(steps: unknown): CoberturaMedida | null {
  if (!Array.isArray(steps)) return null;
  const paso = (steps as PasoLedger[]).find((s) => s?.step === COBERTURA_STEP);
  const d = paso?.details;
  if (!d) return null;
  const pct = Number(d.coveragePct);
  const minimo = Number(d.minCoveragePct);
  if (!Number.isFinite(pct) || !Number.isFinite(minimo)) return null;
  const gap = Number(d.maxGapMinutes);
  const gapMax = Number(d.maxGapMinutesAllowed);
  return {
    disponible: true,
    pct,
    minimoPct: minimo,
    mayorHuecoMinutos: Number.isFinite(gap) ? gap : null,
    huecoMaximoPermitido: Number.isFinite(gapMax) ? gapMax : null,
  };
}
