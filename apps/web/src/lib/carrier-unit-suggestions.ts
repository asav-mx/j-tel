/**
 * Extrae sugerencias de unidad desde el ledger de verificación (carrier only).
 * Usa metadata.candidateUnits del último pass (eliminación o automática).
 */

export type UnitSuggestion = {
  unitId: string;
  label: string;
  /** min(A,B) — qué tan cerca estuvo de pasar el umbral. */
  score: number;
  routeMatchPct: number;
  corridorPrecisionPct: number;
  rank: number;
};

type LedgerCandidate = {
  unitId?: string;
  routeMatchPct?: number;
  corridorPrecisionPct?: number;
  arrivalAt?: string | Date | null;
  servedRoute?: boolean;
};

type LedgerEntryLike = {
  action?: string;
  createdAt?: Date | string;
  metadata?: {
    candidateUnits?: LedgerCandidate[];
  } | null;
};

function scoreOf(c: LedgerCandidate): number {
  const a = Number(c.routeMatchPct ?? 0);
  const b = Number(c.corridorPrecisionPct ?? 0);
  return Math.min(a, b);
}

/**
 * Resuelve id de candidata (UUID de unidad o IMEI) → unitId real.
 */
export function resolveCandidateUnitId(
  rawId: string,
  unitsById: Map<string, { id: string; label: string }>,
  imeiToUnitId: Map<string, string>,
): string | null {
  if (unitsById.has(rawId)) return rawId;
  const fromImei = imeiToUnitId.get(rawId);
  if (fromImei && unitsById.has(fromImei)) return fromImei;
  return null;
}

export function suggestionsFromLedger(
  ledger: unknown[],
  units: Array<{ id: string; label: string }>,
  imeiToUnitId: Map<string, string>,
  limit = 3,
): UnitSuggestion[] {
  const entries = (ledger as LedgerEntryLike[]).filter(
    (e) =>
      Array.isArray(e?.metadata?.candidateUnits) &&
      (e.metadata?.candidateUnits?.length ?? 0) > 0,
  );
  if (entries.length === 0) return [];

  // Preferir la última pasada (eliminación suele ser la más reciente).
  const latest = entries[entries.length - 1]!;
  const candidates = latest.metadata!.candidateUnits!;

  const unitsById = new Map(units.map((u) => [u.id, u]));
  const bestByUnit = new Map<string, LedgerCandidate & { unitId: string }>();

  for (const c of candidates) {
    const raw = String(c.unitId ?? "").trim();
    if (!raw) continue;
    const unitId = resolveCandidateUnitId(raw, unitsById, imeiToUnitId);
    if (!unitId) continue;
    const prev = bestByUnit.get(unitId);
    if (!prev || scoreOf(c) > scoreOf(prev)) {
      bestByUnit.set(unitId, { ...c, unitId });
    }
  }

  const ranked = [...bestByUnit.values()]
    .filter((c) => scoreOf(c) > 0 || c.arrivalAt != null)
    .sort((a, b) => {
      const diff = scoreOf(b) - scoreOf(a);
      if (Math.abs(diff) >= 0.5) return diff;
      // Desempate: mejor A
      return Number(b.routeMatchPct ?? 0) - Number(a.routeMatchPct ?? 0);
    })
    .slice(0, limit);

  return ranked.map((c, i) => {
    const unit = unitsById.get(c.unitId)!;
    return {
      unitId: c.unitId,
      label: unit.label,
      score: Math.round(scoreOf(c) * 10) / 10,
      routeMatchPct: Math.round(Number(c.routeMatchPct ?? 0) * 10) / 10,
      corridorPrecisionPct: Math.round(Number(c.corridorPrecisionPct ?? 0) * 10) / 10,
      rank: i + 1,
    };
  });
}
