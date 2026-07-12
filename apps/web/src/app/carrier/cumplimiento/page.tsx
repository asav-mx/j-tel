import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm ${
    active
      ? "bg-[var(--accent)] text-black"
      : "border border-white/10 hover:border-[var(--accent)]"
  }`;
}

/** Etiqueta legible del chip: cliente · campus/planta (no solo el cliente). */
function contractChipLabel(c: {
  client?: { name: string } | null;
  plant?: { code: string } | null;
  plantGroup?: { name: string } | null;
  name?: string | null;
}): string {
  const client = c.client?.name ?? "Cliente";
  const scope = c.plant?.code ?? c.plantGroup?.name ?? null;
  return scope ? `${client} · ${scope}` : client;
}

function cumplimientoHref(
  slug: string | undefined,
  opts: { contract?: string | null; vista?: "todos" | "dudosos" },
): string {
  const params = new URLSearchParams();
  if (opts.contract) params.set("contract", opts.contract);
  if (opts.vista === "dudosos") params.set("vista", "dudosos");
  const qs = params.toString();
  return withAccount(`/carrier/cumplimiento${qs ? `?${qs}` : ""}`, slug);
}

export default async function CarrierCumplimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const contractFilter =
    typeof sp?.contract === "string" && sp.contract.length > 0 ? sp.contract : null;
  const vistaDudosos = sp?.vista === "dudosos";

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

  // Dudosos = residuales no_cumplido (GPS suficiente; fallan match). Pendientes no van aquí.
  const visible = vistaDudosos
    ? occurrences.filter((o) => o.complianceFact?.status === "no_cumplido")
    : occurrences;

  const gtRows = vistaDudosos
    ? await repos.occurrenceGroundTruth.listForDates(visible.map((o) => o.id))
    : [];
  const labeledIds = new Set(gtRows.map((g) => g.occurrenceId));

  const rows = visible.map((occ) =>
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
              href={cumplimientoHref(carrier?.slug, {
                vista: vistaDudosos ? "dudosos" : "todos",
              })}
              className={chipClass(!contractFilter)}
            >
              Todos
            </a>
            {contracts
              .filter((c) => c.status === "active")
              .map((c) => (
                <a
                  key={c.id}
                  href={cumplimientoHref(carrier?.slug, {
                    contract: c.id,
                    vista: vistaDudosos ? "dudosos" : "todos",
                  })}
                  className={chipClass(contractFilter === c.id)}
                >
                  {contractChipLabel(c)}
                </a>
              ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--muted)]">Vista:</span>
          <a
            href={cumplimientoHref(carrier?.slug, { contract: contractFilter })}
            className={chipClass(!vistaDudosos)}
          >
            Todos
          </a>
          <a
            href={cumplimientoHref(carrier?.slug, {
              contract: contractFilter,
              vista: "dudosos",
            })}
            className={chipClass(vistaDudosos)}
          >
            Dudosos
          </a>
        </div>

        {activeContract ? (
          <p className="text-sm text-[var(--muted)]">
            {activeContract.client?.name} ·{" "}
            {activeContract.plant
              ? `${activeContract.plant.name} (${activeContract.plant.code})`
              : activeContract.plantGroup?.name}{" "}
            · {activeContract.name}
          </p>
        ) : null}

        {vistaDudosos ? (
          <p className="text-sm text-[var(--muted)]">
            Servicios que el sistema marcó como no cumplidos. Abre el detalle para etiquetar
            (calibración; no cambia lo que ve el cliente).
            {labeledIds.size > 0
              ? ` Ya etiquetados: ${labeledIds.size} de ${visible.length}.`
              : null}
          </p>
        ) : null}

        <Card
          title={
            vistaDudosos
              ? "Dudosos — mismo hecho que ve el cliente"
              : "Servicios — mismo hecho que ve el cliente"
          }
        >
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
