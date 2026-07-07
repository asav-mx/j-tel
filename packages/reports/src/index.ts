import type { ComplianceStatus, ContractPolicy, EnforcementOutcome } from "@jtel/domain";
import { computeEnforcement, computeMonthlyRebate } from "@jtel/domain";

export interface OccurrenceReportRow {
  serviceDate: string;
  routeName: string;
  shiftName: string;
  status: ComplianceStatus;
  timing: string | null;
  observedUnitLabel: string | null;
  observedArrivalAt: Date | null;
  lateExcusable: boolean;
}

export interface MonthlyComplianceReport {
  period: string;
  accountName: string;
  contractName: string;
  summary: {
    total: number;
    cumplido: number;
    noCumplido: number;
    pendienteEvidencia: number;
    onTimeRate: number;
  };
  rows: OccurrenceReportRow[];
  enforcement: EnforcementOutcome[];
  monthlyRebatePercent: number;
}

export function summarizeCompliance(
  rows: Array<{ status: ComplianceStatus; timing: string | null; lateExcusable: boolean }>,
  policy: ContractPolicy,
) {
  const cumplido = rows.filter((r) => r.status === "cumplido").length;
  const noCumplido = rows.filter((r) => r.status === "no_cumplido").length;
  const pendiente = rows.filter((r) => r.status === "pendiente_evidencia").length;
  const onTime = rows.filter(
    (r) => r.status === "cumplido" && (r.timing === "a_tiempo" || r.timing === "temprano"),
  ).length;

  return {
    total: rows.length,
    cumplido,
    noCumplido,
    pendienteEvidencia: pendiente,
    onTimeRate: rows.length ? (onTime / rows.length) * 100 : 0,
    monthlyRebatePercent: computeMonthlyRebate(noCumplido, policy.enforcementRules),
  };
}

export function formatMonthlyReportText(input: {
  accountName: string;
  plantName: string;
  periodLabel: string;
  summary: ReturnType<typeof summarizeCompliance>;
  csv: string;
}): string {
  return [
    `REPORTE MENSUAL DE CUMPLIMIENTO — ${input.accountName}`,
    `Planta: ${input.plantName}`,
    `Periodo: ${input.periodLabel}`,
    "",
    `Total servicios: ${input.summary.total}`,
    `Cumplidos: ${input.summary.cumplido}`,
    `No cumplidos: ${input.summary.noCumplido}`,
    `Pendientes por evidencia: ${input.summary.pendienteEvidencia}`,
    `Tasa puntualidad: ${input.summary.onTimeRate.toFixed(1)}%`,
    `Rebate mensual estimado: ${input.summary.monthlyRebatePercent}%`,
    "",
    "DETALLE CSV:",
    input.csv,
  ].join("\n");
}

export function buildMonthlyReport(input: {
  period: string;
  accountName: string;
  contractName: string;
  policy: ContractPolicy;
  rows: Array<
    OccurrenceReportRow & {
      status: ComplianceStatus;
      timing: string | null;
      lateExcusable: boolean;
    }
  >;
}): MonthlyComplianceReport {
  const cumplido = input.rows.filter((r) => r.status === "cumplido").length;
  const noCumplido = input.rows.filter((r) => r.status === "no_cumplido").length;
  const pendiente = input.rows.filter((r) => r.status === "pendiente_evidencia").length;
  const onTime = input.rows.filter(
    (r) => r.status === "cumplido" && (r.timing === "a_tiempo" || r.timing === "temprano"),
  ).length;

  const enforcement: EnforcementOutcome[] = input.rows
    .filter((r) => r.status === "no_cumplido")
    .flatMap((r) =>
      computeEnforcement(r.status, r.timing, r.lateExcusable, input.policy),
    );

  return {
    period: input.period,
    accountName: input.accountName,
    contractName: input.contractName,
    summary: {
      total: input.rows.length,
      cumplido,
      noCumplido,
      pendienteEvidencia: pendiente,
      onTimeRate: input.rows.length ? (onTime / input.rows.length) * 100 : 0,
    },
    rows: input.rows,
    enforcement,
    monthlyRebatePercent: computeMonthlyRebate(noCumplido, input.policy.enforcementRules),
  };
}

export function reportToCsv(report: MonthlyComplianceReport): string {
  const header = "Fecha,Ruta,Turno,Estado,Puntualidad,Unidad,Llegada,Excusable\n";
  const lines = report.rows.map((r) =>
    [
      r.serviceDate,
      r.routeName,
      r.shiftName,
      r.status,
      r.timing ?? "",
      r.observedUnitLabel ?? "",
      r.observedArrivalAt?.toISOString() ?? "",
      r.lateExcusable ? "si" : "no",
    ].join(","),
  );
  return header + lines.join("\n");
}
