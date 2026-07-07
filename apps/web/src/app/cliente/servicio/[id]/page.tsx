import { getRepos } from "@/lib/db";
import { NavBar, StatusBadge } from "@/components/ui";
import { notFound } from "next/navigation";
import type { ContractPolicy } from "@jtel/domain";
import { computeEnforcement } from "@jtel/domain";

export const dynamic = "force-dynamic";

export default async function ServicioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repos = getRepos();
  const occurrence = await repos.occurrences.findById(id);
  if (!occurrence) notFound();

  const fact = occurrence.complianceFact;
  const policy = occurrence.profile?.contract?.policy as ContractPolicy | undefined;
  const ledger = fact
    ? await repos.compliance.getLedgerForTrip(occurrence.trip!.id)
    : [];

  const enforcement =
    fact && policy
      ? computeEnforcement(fact.status, fact.timing, fact.lateExcusable, policy)
      : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <NavBar
          title={`Servicio ${occurrence.serviceDate}`}
          links={[{ href: "/cliente", label: "← Corporativo" }]}
        />

        <div className="mb-6">
          <StatusBadge status={fact?.status} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-[var(--card)] p-5">
            <h2 className="mb-3 font-semibold">Esperado</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Deadline</dt>
                <dd>{occurrence.expectedDeadline.toLocaleString("es-MX")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Unidad referencia</dt>
                <dd>{occurrence.referenceUnitId ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-white/10 bg-[var(--card)] p-5">
            <h2 className="mb-3 font-semibold">Observado</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Unidad</dt>
                <dd>{fact?.observedUnitId ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Llegada</dt>
                <dd>
                  {fact?.observedArrivalAt?.toLocaleString("es-MX") ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Puntualidad</dt>
                <dd>{fact?.timing ?? "—"}</dd>
              </div>
            </dl>
          </section>
        </div>

        {enforcement.length > 0 && (
          <section className="mt-6 rounded-xl border border-white/10 bg-[var(--card)] p-5">
            <h2 className="mb-3 font-semibold">Consecuencias (enforcement)</h2>
            <ul className="space-y-2 text-sm">
              {enforcement.map((e, i) => (
                <li key={i} className={e.applies ? "text-[var(--danger)]" : "text-[var(--muted)]"}>
                  {e.description}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--card)] p-5">
          <h2 className="mb-3 font-semibold">
            Evidencia GPS ({occurrence.trip?.evidencePoints?.length ?? 0} puntos)
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Estado: {occurrence.trip?.evidenceStatus ?? "—"}
          </p>
        </section>

        <details className="mt-6 rounded-xl border border-white/10 bg-[var(--card)] p-5">
          <summary className="cursor-pointer font-semibold">Ledger (auditoría interna)</summary>
          <pre className="mt-3 overflow-x-auto text-xs text-[var(--muted)]">
            {JSON.stringify(ledger, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
