/**
 * Autopsia de no_cumplido — clasificación de solo lectura.
 *
 * Lee hechos congelados y ledger. No escribe en saveFact, no reverifica,
 * no llama a Umbrella. Las cubetas son etiquetas internas de análisis,
 * jamás un cuarto estado ni algo que el cliente vea.
 */

import { classifyNoCumplido } from "./no-cumplido-motivo";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Cubetas Nivel A — conclusión con datos ya guardados. */
export type BucketA =
  | "tarde"
  | "llegada_fuera_de_ventana"
  | "sin_servicio_detectado";

/** Cubetas Nivel B — señal candidata, requiere ojo humano. */
export type BucketB =
  | "hueco_de_datos?"
  | "brinco_gps?"
  | "empalme?"
  | "variante_trazado?"
  | "sin_rastro";

export type Bucket = BucketA | BucketB;

export interface AutopsiaSignal {
  bucket: BucketB;
  details: Record<string, unknown>;
}

export interface AutopsiaRow {
  occurrenceId: string;
  serviceDate: string;
  profileName: string;
  routeName: string | null;
  referenceUnitId: string | null;
  /** Cubeta principal (la más específica, Nivel A antes que B). */
  mainBucket: Bucket;
  /** Todas las señales de Nivel B que dispararon, para ver casos mixtos. */
  signals: AutopsiaSignal[];
  /** Números crudos que sustentan la clasificación. */
  raw: {
    observedUnitId: string | null;
    routeMatchPct: number | null;
    corridorPrecisionPct: number | null;
    /** Leído del paso cobertura_evidencia del ledger (null si no existe). */
    coveragePct: number | null;
    /** Hueco máximo continuo (minutos), del ledger. */
    maxGapMinutes: number | null;
    /** true si el paso cobertura_evidencia existía en el ledger. */
    coverageStepExists: boolean;
    /** Salto GPS máximo detectado (metros). */
    maxGpsJumpMeters: number | null;
    /** ¿Alguna candidata llegó a la geocerca del contrato? */
    anyArrivalAtGeofence: boolean;
    /** Minutos fuera de ventana (si aplica, de Tarea 3). */
    minutesOutsideWindow: number | null;
    /** ¿Llegada a geocerca de otro contrato? */
    arrivalOutsideContractGeofence: boolean;
  };
}

export interface AutopsiaSummary {
  total: number;
  byBucket: Record<string, number>;
  /** Cuántos no_cumplido tienen hueco_de_datos? — candidatos a mal juzgados. */
  huecoFlag: number;
  /** Cuántos tienen llegada_fuera_de_ventana — mide si el margen de 45min captura. */
  llegadaFueraCount: number;
  /** Cuántos no tienen el paso cobertura_evidencia en el ledger o lo tienen insuficiente. */
  sinCoberturaStepOInsuficiente: number;
}

export interface AutopsiaReport {
  contractId: string;
  from: string;
  to: string;
  summary: AutopsiaSummary;
  rows: AutopsiaRow[];
}

// ---------------------------------------------------------------------------
// Constantes nombradas y documentadas
// ---------------------------------------------------------------------------

/**
 * Velocidad implícita máxima (km/h) entre dos puntos GPS consecutivos antes
 * de marcar como brinco sospechoso. 300 km/h es físicamente imposible para
 * un camión de transporte de personal en zona urbana; cualquier valor por
 * encima es un salto del dispositivo, no movimiento real.
 * Solo marca la señal — no filtra ni corrige datos.
 */
const GPS_JUMP_SPEED_THRESHOLD_KMH = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

interface LedgerEntry {
  action: string;
  steps: Array<{ step: string; result: string; details?: Record<string, unknown> }>;
  metadata?: Record<string, unknown>;
}

interface EvidencePoint {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  imei: string;
}

export function classifyOne(
  fact: {
    status: string;
    observedUnitId: string | null;
    observedRouteMatchPct: number | null;
  },
  ledger: LedgerEntry[],
  evidencePoints: EvidencePoint[],
  policySnapshot: {
    evidenceMinCoveragePct?: number;
    evidenceMaxGapMinutes?: number;
  } | null,
): { mainBucket: Bucket; signals: AutopsiaSignal[]; raw: AutopsiaRow["raw"] } {
  const signals: AutopsiaSignal[] = [];

  // --- Extraer datos del ledger congelado ---

  // Paso cobertura_evidencia
  const verificationEntry = ledger.find((e) => e.action === "verificacion_automatica");
  const steps = verificationEntry?.steps ?? [];
  const coverageStep = steps.find((s) => s.step === "cobertura_evidencia");
  const coveragePct = coverageStep?.details?.coveragePct as number | undefined ?? null;
  const maxGapMs = coverageStep?.details?.maxGapMinutes as number | undefined;
  const maxGapMinutes = maxGapMs ?? null;
  const coverageStepExists = coverageStep !== undefined;
  const coverageSufficient = coverageStep?.result === "suficiente";

  // Candidatas del metadata
  const candidates = (verificationEntry?.metadata?.candidateUnits ?? []) as Array<{
    unitId: string;
    servedRoute: boolean;
    arrivalAt: string | null;
    routeMatchPct: number;
    corridorPrecisionPct: number;
  }>;
  const anyArrivalAtGeofence = candidates.some((c) => c.arrivalAt !== null);

  // Mejor candidata para A%/B%
  const bestCandidate = candidates.reduce<typeof candidates[number] | null>(
    (best, c) => (!best || c.routeMatchPct > best.routeMatchPct ? c : best),
    null,
  );

  // Tarea 3 — contexto llegada fuera de ventana
  const ctxEntry = ledger.find((e) => e.action === "contexto_calibracion");
  const ctxStep = ctxEntry?.steps?.find((s) => s.step === "llegada_fuera_ventana");
  const minutesOutsideWindow =
    (ctxStep?.details?.minutesAfterWindowEnd as number | undefined) ?? null;
  const arrivalOutsideContractGeofence =
    (ctxStep?.details?.arrivalOutsideContractGeofence as boolean | undefined) ?? false;

  // Empalme — del elimination pass
  const elimEntry = ledger.find((e) => e.action === "eliminacion_candidatas");
  const elimExcluded = (elimEntry?.metadata?.excludedOccupiedUnitIds ?? []) as string[];

  // --- Brinco GPS (por IMEI, no flota mezclada) ---
  // Agrupar por IMEI para no crear saltos falsos entre unidades distintas.
  let maxGpsJumpMeters: number | null = null;
  if (evidencePoints.length >= 2) {
    const byImei = new Map<string, EvidencePoint[]>();
    for (const p of evidencePoints) {
      const arr = byImei.get(p.imei) ?? [];
      arr.push(p);
      byImei.set(p.imei, arr);
    }
    let maxJumpM = 0;
    for (const [, points] of byImei) {
      if (points.length < 2) continue;
      const sorted = [...points].sort(
        (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const distKm = haversineKm(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude,
        );
        const dtHours =
          (curr.recordedAt.getTime() - prev.recordedAt.getTime()) / 3_600_000;
        if (dtHours > 0) {
          const speedKmh = distKm / dtHours;
          if (speedKmh > GPS_JUMP_SPEED_THRESHOLD_KMH) {
            const jumpM = distKm * 1000;
            if (jumpM > maxJumpM) maxJumpM = jumpM;
          }
        }
      }
    }
    if (maxJumpM > 0) maxGpsJumpMeters = Math.round(maxJumpM);
  }

  // --- Build raw ---
  const raw: AutopsiaRow["raw"] = {
    observedUnitId: fact.observedUnitId,
    routeMatchPct: bestCandidate?.routeMatchPct ?? fact.observedRouteMatchPct,
    corridorPrecisionPct: bestCandidate?.corridorPrecisionPct ?? null,
    coveragePct,
    maxGapMinutes,
    coverageStepExists,
    maxGpsJumpMeters,
    anyArrivalAtGeofence,
    minutesOutsideWindow,
    arrivalOutsideContractGeofence,
  };

  // --- Nivel A ---

  // A1: tarde (observedUnitId presente)
  const motivo = classifyNoCumplido(fact);
  if (motivo === "tarde") {
    return { mainBucket: "tarde", signals, raw };
  }

  // A2: llegada_fuera_de_ventana (Tarea 3 en ledger)
  if (ctxStep) {
    return { mainBucket: "llegada_fuera_de_ventana", signals, raw };
  }

  // A3: sin_servicio_detectado (default de Nivel A para sin observedUnitId)
  // → pero primero recolectamos TODAS las señales de Nivel B

  // --- Nivel B (señales) ---

  // B1: hueco_de_datos? — leer del paso cobertura_evidencia del ledger
  if (coverageStepExists && !coverageSufficient) {
    signals.push({
      bucket: "hueco_de_datos?",
      details: {
        coveragePct,
        maxGapMinutes,
        policyMinCoveragePct: policySnapshot?.evidenceMinCoveragePct ?? null,
        policyMaxGapMinutes: policySnapshot?.evidenceMaxGapMinutes ?? null,
        note: "Cobertura insuficiente según el ledger. Candidato a pendiente_evidencia.",
      },
    });
  } else if (!coverageStepExists) {
    // Sin paso de cobertura — no se puede concluir; recalcular con assessEvidenceCoverage
    // solo si hay puntos. Para esta versión, marcar como señal.
    if (evidencePoints.length > 0) {
      // Calcular cobertura básica: % de la ventana con datos
      signals.push({
        bucket: "hueco_de_datos?",
        details: {
          coveragePct: null,
          maxGapMinutes: null,
          note: "El paso cobertura_evidencia no existe en el ledger. No se puede evaluar cobertura sin recalcular.",
        },
      });
    }
  }

  // B2: brinco_gps?
  if (maxGpsJumpMeters !== null) {
    signals.push({
      bucket: "brinco_gps?",
      details: {
        maxJumpMeters: maxGpsJumpMeters,
        thresholdKmh: GPS_JUMP_SPEED_THRESHOLD_KMH,
        note: `Salto de ${maxGpsJumpMeters}m a velocidad implícita > ${GPS_JUMP_SPEED_THRESHOLD_KMH} km/h.`,
      },
    });
  }

  // B3: empalme?
  if (elimEntry && elimExcluded.length > 0) {
    signals.push({
      bucket: "empalme?",
      details: {
        excludedUnitIds: elimExcluded,
        note: "Unidades excluidas por exclusividad en ventana traslapada.",
      },
    });
  }

  // B4: variante_trazado? — candidata llegó a geocerca pero no cubrió la ruta
  const varianteCandidates = candidates.filter(
    (c) => c.arrivalAt !== null && !c.servedRoute,
  );
  if (varianteCandidates.length > 0) {
    const best = varianteCandidates.reduce((a, b) =>
      a.routeMatchPct > b.routeMatchPct ? a : b,
    );
    signals.push({
      bucket: "variante_trazado?",
      details: {
        unitId: best.unitId,
        arrivalAt: best.arrivalAt,
        routeMatchPct: best.routeMatchPct,
        corridorPrecisionPct: best.corridorPrecisionPct,
        note: "Unidad llegó a la geocerca destino pero reprobó A/B. Sugiere otra calle al mismo destino.",
      },
    });
  }

  // B5: sin_rastro — sin llegada, sin Tarea 3, cobertura casi nula
  const effectiveCoverage = coveragePct ?? (evidencePoints.length === 0 ? 0 : null);
  if (
    !anyArrivalAtGeofence &&
    !ctxStep &&
    effectiveCoverage !== null &&
    effectiveCoverage < 10
  ) {
    signals.push({
      bucket: "sin_rastro",
      details: {
        coveragePct: effectiveCoverage,
        note: "Genuinamente no hay evidencia de que la unidad anduviera.",
      },
    });
  }

  // Cubeta principal: la señal más específica de Nivel B, o sin_servicio_detectado
  const mainBucket: Bucket =
    signals.length > 0 ? signals[0]!.bucket : "sin_servicio_detectado";

  return { mainBucket, signals, raw };
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export function buildSummary(rows: AutopsiaRow[]): AutopsiaSummary {
  const byBucket: Record<string, number> = {};
  let huecoFlag = 0;
  let llegadaFueraCount = 0;
  let sinCoberturaStepOInsuficiente = 0;

  for (const row of rows) {
    byBucket[row.mainBucket] = (byBucket[row.mainBucket] ?? 0) + 1;

    if (
      row.mainBucket === "hueco_de_datos?" ||
      row.signals.some((s) => s.bucket === "hueco_de_datos?")
    ) {
      huecoFlag++;
    }

    if (row.mainBucket === "llegada_fuera_de_ventana") {
      llegadaFueraCount++;
    }

    if (!row.raw.coverageStepExists) {
      sinCoberturaStepOInsuficiente++;
    } else if (row.raw.coveragePct !== null && row.raw.coveragePct < 80) {
      sinCoberturaStepOInsuficiente++;
    }
  }

  return {
    total: rows.length,
    byBucket,
    huecoFlag,
    llegadaFueraCount,
    sinCoberturaStepOInsuficiente,
  };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function reportToCsv(report: AutopsiaReport): string {
  const headers = [
    "fecha",
    "perfil",
    "ruta",
    "unidad_referencia",
    "cubeta_principal",
    "señales_secundarias",
    "observedUnitId",
    "routeMatchPct",
    "corridorPrecisionPct",
    "coveragePct",
    "maxGapMinutes",
    "coverageStepExists",
    "maxGpsJumpMeters",
    "anyArrivalAtGeofence",
    "minutesOutsideWindow",
    "arrivalOutsideContractGeofence",
  ];

  const csvRows = [headers.join(",")];

  for (const row of report.rows) {
    const secondaryBuckets = row.signals
      .map((s) => s.bucket)
      .filter((b) => b !== row.mainBucket)
      .join("; ");

    csvRows.push(
      [
        row.serviceDate,
        '"' + row.profileName.replace(/"/g, '""') + '"',
        '"' + (row.routeName ?? "").replace(/"/g, '""') + '"',
        row.referenceUnitId ?? "",
        row.mainBucket,
        '"' + secondaryBuckets.replace(/"/g, '""') + '"',
        row.raw.observedUnitId ?? "",
        row.raw.routeMatchPct?.toFixed(1) ?? "",
        row.raw.corridorPrecisionPct?.toFixed(1) ?? "",
        row.raw.coveragePct?.toFixed(1) ?? "",
        row.raw.maxGapMinutes?.toFixed(1) ?? "",
        row.raw.coverageStepExists,
        row.raw.maxGpsJumpMeters ?? "",
        row.raw.anyArrivalAtGeofence,
        row.raw.minutesOutsideWindow ?? "",
        row.raw.arrivalOutsideContractGeofence,
      ].join(","),
    );
  }

  return csvRows.join("\n");
}
