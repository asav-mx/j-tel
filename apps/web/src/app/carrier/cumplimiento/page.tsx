import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function CarrierCumplimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const contractFilter =
    typeof sp?.contract === "string" && sp.contract.length > 0 ? sp.contract : null;

  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);
  const contracts = carrier ? await repos.contracts.findForCarrier(carrier.id) : [];

  let occurrences: Awaited<ReturnType<typeof repos.occurrences.findForContract>> = [];
  if (carrier) {
    if (contractFilter) {
      const match = contracts.find((c) => c.id === contractFilter);
      if (match) {
        occurrences = await repos.occurrences.findForContract(contractFilter);
      }
    } else {
      for (const c of contracts) {
        occurrences.push(...(await repos.occurrences.findForContract(c.id)));
      }
    }
  }

  const activeContract = contractFilter
    ? contracts.find((c) => c.id === contractFilter)
    : null;

  const rows = occurrences.map((occ) =>
    toOccurrenceRow(occ, "/carrier/servicio", carrier?.slug, {
      showClient: true,
      showPlant: true,
      showCarrier: false,
    }),
  );

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppNav
          title="Cumplimiento contractual"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />

        {contracts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Contrato:</span>
            <a
              href={withAccount("/carrier/cumplimiento", carrier?.slug)}
              className={`rounded-full px-3 py-1 text-sm ${
                !contractFilter
                  ? "bg-[var(--accent)] text-black"
                  : "border border-white/10 hover:border-[var(--accent)]"
              }`}
            >
              Todos
            </a>
            {contracts
              .filter((c) => c.status === "active")
              .map((c) => (
                <a
                  key={c.id}
                  href={withAccount(`/carrier/cumplimiento?contract=${c.id}`, carrier?.slug)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    contractFilter === c.id
                      ? "bg-[var(--accent)] text-black"
                      : "border border-white/10 hover:border-[var(--accent)]"
                  }`}
                >
                  {c.client?.name ?? "Cliente"}
                  {c.plant ? ` · ${c.plant.code}` : ""}
                </a>
              ))}
          </div>
        ) : null}

        {activeContract ? (
          <p className="text-sm text-[var(--muted)]">
            {activeContract.client?.name} ·{" "}
            {activeContract.plant
              ? `${activeContract.plant.name} (${activeContract.plant.code})`
              : activeContract.plantGroup?.name}{" "}
            · {activeContract.name}
          </p>
        ) : null}

        <Card title="Servicios — mismo hecho que ve el cliente">
          <OccurrenceTable
            rows={rows}
            showClient
            showPlant
            showCarrier={false}
            showEnforcement={false}
          />
        </Card>
      </div>
    </main>
  );
}
