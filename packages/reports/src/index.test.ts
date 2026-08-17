import { describe, it, expect } from "vitest";
import { buildMonthlyReport, summarizeCompliance, reportToCsv } from "./index.js";

describe("reports", () => {
  it("genera reporte mensual con tolerancias distintas", () => {
    const policy = {
      toleranceMinutes: 5,
      verificationGraceMinutes: 15,
      routeStrictness: "destino_only" as const,
      kmlMatchMinPct: 60,
      kmlCorridorMeters: 120,
      kmlCorridorMinPct: 60,
      kmlOriginToleranceFraction: 0.15,
      frechetMaxKm: 0.8,
      corridorAttributionMarginPct: 5,
      excusableReasons: [],
      permitirConsolidacion: false,
      enforcementRules: [{ type: "no_pago_viaje" as const, toleranceMinutes: 5 }],
      evidenceMarginMinutesBefore: 60,
      evidenceMarginMinutesAfter: 30,
      arrivalAnticipationMinutes: 15,
      maxRouteDurationMinutes: 60,
      windowDerivationEnabled: true,
      windowSlackPct: 25,
      routeAvgSpeedKmh: 20,
      maxWindowBeforeMinutes: 360,
      routeDurationPercentile: 90,
      routeDurationMinSamples: 3,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      timeZone: "America/Ciudad_Juarez",
    };

    const rows = [
      {
        serviceDate: "2026-07-01",
        routeName: "Ruta Norte",
        shiftName: "Entrada 7:00",
        status: "cumplido" as const,
        timing: "a_tiempo",
        lateExcusable: false,
        observedUnitLabel: "unit-1",
        observedArrivalAt: new Date(),
      },
      {
        serviceDate: "2026-07-02",
        routeName: "Ruta Norte",
        shiftName: "Entrada 7:00",
        status: "no_cumplido" as const,
        timing: "tarde",
        lateExcusable: false,
        observedUnitLabel: "unit-1",
        observedArrivalAt: new Date(),
      },
    ];

    const summary = summarizeCompliance(rows, policy);
    expect(summary.cumplido).toBe(1);
    expect(summary.noCumplido).toBe(1);

    const report = buildMonthlyReport({
      period: "2026-07",
      accountName: "Tecma",
      contractName: "Tecma 47",
      policy,
      rows,
    });

    const csv = reportToCsv(report);
    expect(csv).toContain("cumplido");
    expect(csv).toContain("no_cumplido");
    expect(csv).toContain("Motivo");
    expect(csv).toContain("tarde");
  });

  it("marca sin_servicio cuando no_cumplido no tiene unidad", () => {
    const policy = {
      toleranceMinutes: 5,
      verificationGraceMinutes: 15,
      routeStrictness: "destino_only" as const,
      kmlMatchMinPct: 60,
      kmlCorridorMeters: 120,
      kmlCorridorMinPct: 60,
      kmlOriginToleranceFraction: 0.15,
      frechetMaxKm: 0.8,
      corridorAttributionMarginPct: 5,
      excusableReasons: [],
      permitirConsolidacion: false,
      enforcementRules: [],
      evidenceMarginMinutesBefore: 60,
      evidenceMarginMinutesAfter: 30,
      arrivalAnticipationMinutes: 15,
      maxRouteDurationMinutes: 60,
      windowDerivationEnabled: true,
      windowSlackPct: 25,
      routeAvgSpeedKmh: 20,
      maxWindowBeforeMinutes: 360,
      routeDurationPercentile: 90,
      routeDurationMinSamples: 3,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      timeZone: "America/Ciudad_Juarez",
    };

    const report = buildMonthlyReport({
      period: "2026-07",
      accountName: "Tecma",
      contractName: "Campus",
      policy,
      rows: [
        {
          serviceDate: "2026-07-09",
          routeName: "Km 30",
          shiftName: "T1",
          status: "no_cumplido",
          timing: null,
          motivo: "sin_servicio",
          lateExcusable: false,
          observedUnitLabel: null,
          observedArrivalAt: null,
        },
      ],
    });

    expect(reportToCsv(report)).toContain("sin_servicio");
  });
});
