import { getRepos } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnitShell } from "@/components/unit-shell";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

export async function UnitComplianceView({
  ctx,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);

  const occurrences = await repos.occurrences.findForScope(scope);
  const rows = occurrences
    .slice(0, 50)
    .map((occ) => toOccurrenceRow(occ, "/cliente/servicio", client.slug, { showPlant: false }));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={client} unit={unit} title={`Cumplimiento — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Servicios verificados de <span className="text-white">{unitLabel}</span> contra el GPS del
          carrier.
        </p>

        <Card title={`Servicios recientes (${occurrences.length})`}>
          <OccurrenceTable rows={rows} showPlant={false} showCarrier />
        </Card>
      </div>
    </main>
  );
}
