import { getRepos } from "@/lib/db";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function CarrierCumplimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);
  const contracts = carrier ? await repos.contracts.findForCarrier(carrier.id) : [];

  const occurrences = [];
  for (const c of contracts) {
    const occs = await repos.occurrences.findForClientAccount(c.clientAccountId);
    occurrences.push(...occs.filter((o) => o.contractId === c.id));
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title="Cumplimiento contractual (detalle operativo)"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />
        <Card title="Mismo hecho que el cliente — más contexto operativo">
          <div className="space-y-2">
            {occurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 p-3 text-sm"
              >
                <div>
                  <p>{occ.serviceDate} · {occ.profile?.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Evidencia: {occ.trip?.evidenceStatus ?? "—"}
                  </p>
                </div>
                {occ.complianceFact ? (
                  <StatusBadge status={occ.complianceFact.status} />
                ) : (
                  <span className="text-[var(--muted)]">Pendiente</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
