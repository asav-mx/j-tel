import { describe, it, expect } from "vitest";
import { classifyOne, buildSummary, reportToCsv, type AutopsiaRow, type AutopsiaReport } from "./autopsia.js";

// --- Helpers ---

function makeLedger(overrides: {
  coverageStep?: { result: string; details: Record<string, unknown> };
  decisionReason?: string;
  candidateUnits?: Array<Record<string, unknown>>;
  ctxCalibration?: { step: string; result: string; details: Record<string, unknown> };
  eliminationPass?: { excludedOccupiedUnitIds: string[] };
} = {}) {
  const steps: Array<{ step: string; result: string; details?: Record<string, unknown> }> = [
    { step: "inicio", result: "evaluando", details: { pointCount: 100 } },
  ];
  if (overrides.coverageStep) {
    steps.push({
      step: "cobertura_evidencia",
      ...overrides.coverageStep,
    });
  }
  steps.push({ step: "evidencia", result: "disponible", details: { count: 100 } });
  steps.push({
    step: "decision",
    result: "no_cumplido",
    details: { reason: overrides.decisionReason ?? "ninguna_unidad_sirvio" },
  });

  const entries: Array<{
    action: string;
    steps: typeof steps;
    metadata?: Record<string, unknown>;
  }> = [
    {
      action: "verificacion_automatica",
      steps,
      metadata: {
        candidateUnits: overrides.candidateUnits ?? [],
      },
    },
  ];

  if (overrides.ctxCalibration) {
    entries.push({
      action: "contexto_calibracion",
      steps: [overrides.ctxCalibration],
    });
  }

  if (overrides.eliminationPass) {
    entries.push({
      action: "eliminacion_candidatas",
      steps: [],
      metadata: {
        eliminationPass: true,
        excludedOccupiedUnitIds: overrides.eliminationPass.excludedOccupiedUnitIds,
      },
    });
  }

  return entries;
}

const noPoints: Array<{ latitude: number; longitude: number; recordedAt: Date; imei: string }> = [];

// --- Tests ---

describe("autopsia — classifyOne", () => {
  // Prueba 1: no_cumplido con observedUnitId presente → tarde
  it("no_cumplido con observedUnitId → cubeta tarde", () => {
    const fact = { status: "no_cumplido", observedUnitId: "unit-1", observedRouteMatchPct: 80 };
    const ledger = makeLedger();
    const { mainBucket } = classifyOne(fact, ledger, noPoints, null);
    expect(mainBucket).toBe("tarde");
  });

  // Prueba 2: no_cumplido con observedUnitId = null, razón ninguna_unidad_sirvio → sin_servicio_detectado
  it("no_cumplido sin unidad + ninguna_unidad_sirvio → sin_servicio_detectado", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: {
        result: "suficiente",
        details: { coveragePct: 100, maxGapMinutes: 1 },
      },
      decisionReason: "ninguna_unidad_sirvio",
    });
    const { mainBucket } = classifyOne(fact, ledger, noPoints, null);
    expect(mainBucket).toBe("sin_servicio_detectado");
  });

  // Prueba 3: no_cumplido con contexto Tarea 3 → llegada_fuera_de_ventana
  it("no_cumplido con contexto Tarea 3 → llegada_fuera_de_ventana", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "suficiente", details: { coveragePct: 100, maxGapMinutes: 1 } },
      ctxCalibration: {
        step: "llegada_fuera_ventana",
        result: "info",
        details: {
          minutesAfterWindowEnd: 12,
          arrivalAt: "2026-07-09T06:57:00Z",
        },
      },
    });
    const { mainBucket, raw } = classifyOne(fact, ledger, noPoints, null);
    expect(mainBucket).toBe("llegada_fuera_de_ventana");
    expect(raw.minutesOutsideWindow).toBe(12);
  });

  // Prueba 4: no_cumplido con cobertura baja → hueco_de_datos?
  it("no_cumplido con cobertura insuficiente en ledger → señal hueco_de_datos?", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: {
        result: "insuficiente",
        details: { coveragePct: 45, maxGapMinutes: 25 },
      },
    });
    const { mainBucket, signals, raw } = classifyOne(fact, ledger, noPoints, {
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
    });
    expect(mainBucket).toBe("hueco_de_datos?");
    expect(signals.some((s) => s.bucket === "hueco_de_datos?")).toBe(true);
    expect(raw.coveragePct).toBe(45);
    expect(raw.maxGapMinutes).toBe(25);
    expect(raw.coverageStepExists).toBe(true);
  });

  // Prueba 5 (parte de 7): correr no crea ni modifica complianceFact
  // → esto se prueba en integración; aquí confirmamos que classifyOne es puro
  it("classifyOne es una función pura que no muta sus argumentos", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger();
    const factBefore = JSON.stringify(fact);
    const ledgerBefore = JSON.stringify(ledger);
    classifyOne(fact, ledger, noPoints, null);
    expect(JSON.stringify(fact)).toBe(factBefore);
    expect(JSON.stringify(ledger)).toBe(ledgerBefore);
  });

  it("brinco_gps con salto imposible marca señal", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "suficiente", details: { coveragePct: 100, maxGapMinutes: 1 } },
    });
    // Dos puntos a 50km en 10 segundos → 18000 km/h
    const points = [
      { latitude: 31.7, longitude: -106.4, recordedAt: new Date("2026-07-09T06:00:00Z"), imei: "u1" },
      { latitude: 32.15, longitude: -106.4, recordedAt: new Date("2026-07-09T06:00:10Z"), imei: "u1" },
    ];
    const { signals, raw } = classifyOne(fact, ledger, points, null);
    expect(signals.some((s) => s.bucket === "brinco_gps?")).toBe(true);
    expect(raw.maxGpsJumpMeters).toBeGreaterThan(10000);
  });

  it("variante_trazado: candidata llegó a geocerca pero no cubrió ruta", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "suficiente", details: { coveragePct: 100, maxGapMinutes: 1 } },
      candidateUnits: [
        {
          unitId: "unit-1",
          servedRoute: false,
          arrivalAt: "2026-07-09T06:42:00Z",
          routeMatchPct: 12.5,
          corridorPrecisionPct: 8.3,
        },
      ],
    });
    const { signals } = classifyOne(fact, ledger, noPoints, null);
    const variante = signals.find((s) => s.bucket === "variante_trazado?");
    expect(variante).toBeDefined();
    expect(variante!.details.routeMatchPct).toBe(12.5);
    expect(variante!.details.corridorPrecisionPct).toBe(8.3);
  });

  it("empalme: elimination pass con unidades excluidas", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "suficiente", details: { coveragePct: 100, maxGapMinutes: 1 } },
      eliminationPass: { excludedOccupiedUnitIds: ["unit-winner"] },
    });
    const { signals } = classifyOne(fact, ledger, noPoints, null);
    expect(signals.some((s) => s.bucket === "empalme?")).toBe(true);
  });

  it("sin_rastro: sin llegada, sin Tarea 3, cobertura < 10%", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "insuficiente", details: { coveragePct: 3, maxGapMinutes: 55 } },
    });
    const { signals } = classifyOne(fact, ledger, noPoints, null);
    expect(signals.some((s) => s.bucket === "sin_rastro")).toBe(true);
  });

  // Prueba 7: confidencialidad — arrivalOutsideContractGeofence no nombra al otro cliente
  it("contexto Tarea 3 con arrivalOutsideContractGeofence no expone geofenceId", () => {
    const fact = { status: "no_cumplido", observedUnitId: null, observedRouteMatchPct: null };
    const ledger = makeLedger({
      coverageStep: { result: "suficiente", details: { coveragePct: 100, maxGapMinutes: 1 } },
      ctxCalibration: {
        step: "llegada_fuera_ventana",
        result: "info",
        details: {
          arrivalOutsideContractGeofence: true,
          arrivalAt: "2026-07-09T07:02:00Z",
          minutesAfterWindowEnd: 17,
        },
      },
    });
    const { mainBucket, raw } = classifyOne(fact, ledger, noPoints, null);
    expect(mainBucket).toBe("llegada_fuera_de_ventana");
    expect(raw.arrivalOutsideContractGeofence).toBe(true);
    // No hay geofenceId de otro cliente en ningún campo del raw
    expect(JSON.stringify(raw)).not.toContain("geofenceId");
  });
});

describe("autopsia — buildSummary", () => {
  it("conteo por cubeta y banderas", () => {
    const rows: AutopsiaRow[] = [
      {
        occurrenceId: "1", serviceDate: "2026-07-14", profileName: "Ruta A", routeName: "A",
        referenceUnitId: null, mainBucket: "sin_servicio_detectado", signals: [],
        raw: { observedUnitId: null, routeMatchPct: null, corridorPrecisionPct: null,
          coveragePct: 100, maxGapMinutes: 1, coverageStepExists: true,
          maxGpsJumpMeters: null, anyArrivalAtGeofence: false,
          minutesOutsideWindow: null, arrivalOutsideContractGeofence: false },
      },
      {
        occurrenceId: "2", serviceDate: "2026-07-14", profileName: "Ruta B", routeName: "B",
        referenceUnitId: null, mainBucket: "hueco_de_datos?",
        signals: [{ bucket: "hueco_de_datos?", details: { coveragePct: 30 } }],
        raw: { observedUnitId: null, routeMatchPct: null, corridorPrecisionPct: null,
          coveragePct: 30, maxGapMinutes: 25, coverageStepExists: true,
          maxGpsJumpMeters: null, anyArrivalAtGeofence: false,
          minutesOutsideWindow: null, arrivalOutsideContractGeofence: false },
      },
      {
        occurrenceId: "3", serviceDate: "2026-07-15", profileName: "Ruta C", routeName: "C",
        referenceUnitId: null, mainBucket: "llegada_fuera_de_ventana", signals: [],
        raw: { observedUnitId: null, routeMatchPct: null, corridorPrecisionPct: null,
          coveragePct: 100, maxGapMinutes: 1, coverageStepExists: true,
          maxGpsJumpMeters: null, anyArrivalAtGeofence: false,
          minutesOutsideWindow: 12, arrivalOutsideContractGeofence: false },
      },
      {
        occurrenceId: "4", serviceDate: "2026-07-15", profileName: "Ruta D", routeName: "D",
        referenceUnitId: null, mainBucket: "sin_servicio_detectado", signals: [],
        raw: { observedUnitId: null, routeMatchPct: null, corridorPrecisionPct: null,
          coveragePct: null, maxGapMinutes: null, coverageStepExists: false,
          maxGpsJumpMeters: null, anyArrivalAtGeofence: false,
          minutesOutsideWindow: null, arrivalOutsideContractGeofence: false },
      },
    ];

    const summary = buildSummary(rows);
    expect(summary.total).toBe(4);
    expect(summary.byBucket["sin_servicio_detectado"]).toBe(2);
    expect(summary.byBucket["hueco_de_datos?"]).toBe(1);
    expect(summary.byBucket["llegada_fuera_de_ventana"]).toBe(1);
    expect(summary.huecoFlag).toBe(1);
    expect(summary.llegadaFueraCount).toBe(1);
    // Row 2 has coveragePct=30 (<80) + Row 4 has no coverageStep
    expect(summary.sinCoberturaStepOInsuficiente).toBe(2);
  });
});

describe("autopsia — reportToCsv", () => {
  it("genera CSV con headers y una fila", () => {
    const report: AutopsiaReport = {
      contractId: "c1",
      from: "2026-07-14",
      to: "2026-07-17",
      summary: {
        total: 1, byBucket: { sin_servicio_detectado: 1 },
        huecoFlag: 0, llegadaFueraCount: 0, sinCoberturaStepOInsuficiente: 0,
      },
      rows: [
        {
          occurrenceId: "1", serviceDate: "2026-07-14",
          profileName: "Km 20 - A", routeName: "Km 20 - A",
          referenceUnitId: null, mainBucket: "sin_servicio_detectado", signals: [],
          raw: { observedUnitId: null, routeMatchPct: 5.9, corridorPrecisionPct: 76.2,
            coveragePct: 100, maxGapMinutes: 1, coverageStepExists: true,
            maxGpsJumpMeters: null, anyArrivalAtGeofence: false,
            minutesOutsideWindow: null, arrivalOutsideContractGeofence: false },
        },
      ],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain("fecha,perfil,ruta");
    expect(csv).toContain("sin_servicio_detectado");
    expect(csv).toContain("Km 20 - A");
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 row
  });
});
