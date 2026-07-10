import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { buildMonthlyReport, reportToCsv } from "@jtel/reports";
import type { ContractPolicy } from "@jtel/domain";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function ClienteReportesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);
  const occurrences = client ? await repos.occurrences.findForClientAccount(client.id) : [];
  const contracts = client ? await repos.contracts.findForClient(client.id) : [];

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
    kmlMatchMinPct: 60,
    allowAlternateDestination: false,
    excusableReasons: [],
    enforcementRules: [],
    evidenceMarginMinutesBefore: 60,
    evidenceMarginMinutesAfter: 30,
  }) as ContractPolicy;

  const report = buildMonthlyReport({
    period: new Date().toISOString().slice(0, 7),
    accountName: client?.name ?? "Cliente",
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
          links={[{ href: withAccount("/cliente/cumplimiento", client?.slug), label: "← Cumplimiento" }]}
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
