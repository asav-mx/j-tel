/**
 * Emparejar una entrada del ledger con el hecho vigente de su ocurrencia.
 *
 * `ledger_entries` NO tiene `factId` (ver docs/DESPUES.md — "El ledger debe
 * colgar del hecho"). Tras una re-verificación quedan varias entradas para la
 * misma ocurrencia y la única forma de saber cuál produjo el hecho vigente es
 * por fecha. Esto es frágil, así que las reglas de aquí son deliberadamente
 * conservadoras: **ante la duda no se empareja.** Un hueco honesto —"medición
 * no disponible"— antes que una cifra de la corrida equivocada.
 *
 * La dirección del emparejamiento sale del orden de escritura del motor:
 * `saveFact` corre ANTES que `addLedgerEntry`, así que la entrada que produjo
 * un hecho siempre tiene `createdAt >= fact.materializedAt`.
 */

/**
 * Acciones cuyas entradas llevan los pasos de la verificación —y por lo tanto
 * el paso `cobertura_evidencia`.
 *
 * Son DOS, no una: el motor escribe la misma carga con acción
 * `eliminacion_candidatas` cuando el hecho se selló durante un pase de
 * eliminación. Buscar solo `verificacion_automatica` pierde esos hechos.
 */
export const SEALING_LEDGER_ACTIONS = [
  "verificacion_automatica",
  "eliminacion_candidatas",
] as const;

/**
 * Tolerancia entre el sellado del hecho y la escritura de su entrada.
 *
 * Las dos escrituras van seguidas dentro de la misma llamada del motor, así que
 * en la práctica se separan por milisegundos. Diez minutos es holgado a
 * propósito: sirve para descartar una entrada que claramente pertenece a otra
 * corrida, no para medir latencia.
 */
export const DEFAULT_PAIRING_TOLERANCE_MS = 10 * 60_000;

export type PairableLedgerEntry = {
  action: string;
  createdAt: Date;
};

export type LedgerPairing<T> =
  | { paired: true; entry: T }
  | {
      paired: false;
      /**
       * `no_entry` — ninguna entrada al momento del sello o después.
       * `ambiguous` — más de una candidata; no se puede elegir sin adivinar.
       * `out_of_tolerance` — hay una sola, pero tan lejos del sello que
       *   atribuirla a este hecho sería inventar.
       */
      reason: "no_entry" | "ambiguous" | "out_of_tolerance";
      candidates: number;
    };

/**
 * Devuelve la entrada que produjo el hecho vigente, o por qué no se pudo saber.
 *
 * No asume que `entries` venga ordenado.
 */
export function pairLedgerEntryWithFact<T extends PairableLedgerEntry>(
  entries: readonly T[],
  materializedAt: Date,
  opts: { toleranceMs?: number } = {},
): LedgerPairing<T> {
  const toleranceMs = opts.toleranceMs ?? DEFAULT_PAIRING_TOLERANCE_MS;
  const sealedAt = materializedAt.getTime();

  const candidates = entries
    .filter(
      (e) =>
        (SEALING_LEDGER_ACTIONS as readonly string[]).includes(e.action) &&
        e.createdAt.getTime() >= sealedAt,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (candidates.length === 0) {
    return { paired: false, reason: "no_entry", candidates: 0 };
  }

  // Más de una corrida después del sello vigente no debería existir: cada
  // re-verificación archiva el hecho anterior e inserta uno nuevo, moviendo
  // `materializedAt` hacia adelante. Si hay dos, el supuesto se rompió y no
  // tenemos con qué desempatar.
  if (candidates.length > 1) {
    return { paired: false, reason: "ambiguous", candidates: candidates.length };
  }

  const entry = candidates[0]!;
  if (entry.createdAt.getTime() - sealedAt > toleranceMs) {
    return { paired: false, reason: "out_of_tolerance", candidates: 1 };
  }

  return { paired: true, entry };
}
