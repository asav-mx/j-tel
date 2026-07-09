import { describe, it, expect } from "vitest";
import { buildMonthlyReport, summarizeCompliance, reportToCsv } from "./index.js";

describe("reports", () => {
  it("genera reporte mensual con tolerancias distintas", () => {
    const policy = {
      toleranceMinutes: 5,
      verificationGraceMinutes: 15,
      routeStrictness: "destino_only" as const,
      allowAlternateDestination: false,
      excusableReasons: [],
      enforcementRules: [{ type: "no_pago_viaje" as const, toleranceMinutes: 5 }],
      evidenceMarginMinutesBefore: 60,
      evidenceMarginMinutesAfter: 30,
      arrivalAnticipationMinutes: 15,
      maxRouteDurationMinutes: 60,
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
  });
});
