import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { buildMonthlyReport, reportToCsv } from "@jtel/reports";
import type { ContractPolicy } from "@jtel/domain";

export const dynamic = "force-dynamic";

export default async function ClienteReportesPage() {
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  const occurrences = tecma ? await repos.occurrences.findForClientAccount(tecma.id) : [];
  const contracts = tecma ? await repos.contracts.findForClient(tecma.id) : [];

  const rows = occurrences
    .filter((o) => o.complianceFact)
    .map((o) => ({
      serviceDate: o.serviceDate,
      routeName: o.profile?.routeShift?.route?.name ?? "—",
      shiftName: o.profile?.routeShift?.shift?.name ?? "—",
      status: o.complianceFact!.status,
      timing: o.complianceFact!.timing,
      lateExcusable: o.complianceFact!.lateExcusable,
      observedUnitLabel: o.complianceFact!.observedUnitId,
      observedArrivalAt: o.complianceFact!.observedArrivalAt,
    }));

  const policy = (contracts[0]?.policy ?? {
    toleranceMinutes: 5,
    verificationGraceMinutes: 15,
    routeStrictness: "destino_only",
    allowAlternateDestination: false,
    excusableReasons: [],
    enforcementRules: [],
    evidenceMarginMinutesBefore: 60,
    evidenceMarginMinutesAfter: 30,
  }) as ContractPolicy;

  const report = buildMonthlyReport({
    period: new Date().toISOString().slice(0, 7),
    accountName: "Tecma",
    contractName: contracts[0]?.name ?? "Contrato",
    policy,
    rows,
  });

  const csv = reportToCsv(report);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Reportes mensuales"
          links={[{ href: "/cliente", label: "← Cumplimiento" }]}
        />
        <Card title="Reporte generado automáticamente">
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>Total: {report.summary.total}</div>
            <div>Cumplidos: {report.summary.cumplido}</div>
            <div>No cumplidos: {report.summary.noCumplido}</div>
            <div>Pendientes: {report.summary.pendienteEvidencia}</div>
            <div>Rebate mensual: {report.monthlyRebatePercent}%</div>
          </dl>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
            {csv}
          </pre>
        </Card>
      </div>
    </main>
  );
}
