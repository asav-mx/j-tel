import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { resolveDateRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

type Vista = "todos" | "tarde" | "sin_servicio";

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm ${
    active
      ? "bg-[var(--accent)] text-black"
      : "border border-white/10 hover:border-[var(--accent)]"
  }`;
}

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

function parseVista(raw: string | string[] | undefined): Vista {
  if (raw === "tarde") return "tarde";
  // Compat: ?vista=dudosos → sin servicio (dudosos reales)
  if (raw === "sin_servicio" || raw === "dudosos") return "sin_servicio";
  return "todos";
}

function cumplimientoHref(
  slug: string | undefined,
  opts: {
    contract?: string | null;
    vista?: Vista;
    desde?: string;
    hasta?: string;
  },
): string {
  const params = new URLSearchParams();
  if (opts.contract) params.set("contract", opts.contract);
  if (opts.vista && opts.vista !== "todos") params.set("vista", opts.vista);
  if (opts.desde) params.set("desde", opts.desde);
  if (opts.hasta) params.set("hasta", opts.hasta);
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
  const vista = parseVista(sp?.vista);
  const range = resolveDateRange(sp, { defaultDaysBack: 6 });

  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);
  const contracts = carrier ? await repos.contracts.findForCarrier(carrier.id) : [];

  let occurrences: Awaited<ReturnType<typeof repos.occurrences.findForContract>> = [];
  if (carrier) {
    if (contractFilter) {
      const match = contracts.find((c) => c.id === contractFilter);
      if (match) {
        occurrences = await repos.occurrences.findForContract(
          contractFilter,
          range.from,
          range.to,
        );
      }
    } else {
      for (const c of contracts) {
        occurrences.push(
          ...(await repos.occurrences.findForContract(c.id, range.from, range.to)),
        );
      }
    }
  }

  const activeContract = contractFilter
    ? contracts.find((c) => c.id === contractFilter)
    : null;

  const noCumplidos = occurrences.filter((o) => o.complianceFact?.status === "no_cumplido");
  const visible =
    vista === "tarde"
      ? noCumplidos.filter((o) => !!o.complianceFact?.observedUnitId)
      : vista === "sin_servicio"
        ? noCumplidos.filter((o) => !o.complianceFact?.observedUnitId)
        : occurrences;

  const gtRows =
    vista === "sin_servicio"
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

  const actionPath = "/carrier/cumplimiento";
  const rangeHidden = {
    account: carrier?.slug,
    contract: contractFilter,
    vista: vista !== "todos" ? vista : undefined,
  };

  const title =
    vista === "tarde"
      ? `Tarde — ${range.label} (${rows.length})`
      : vista === "sin_servicio"
        ? `Sin servicio detectado — ${range.label} (${rows.length})`
        : `Servicios — ${range.label} (${rows.length})`;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AppNav
          title="Cumplimiento contractual"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />

        <DateRangeFilter action={actionPath} range={range} hidden={rangeHidden} />

        {contracts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Contrato:</span>
            <a
              href={cumplimientoHref(carrier?.slug, {
                vista,
                desde: range.fromIso,
                hasta: range.toIso,
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
                    vista,
                    desde: range.fromIso,
                    hasta: range.toIso,
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
            href={cumplimientoHref(carrier?.slug, {
              contract: contractFilter,
              desde: range.fromIso,
              hasta: range.toIso,
            })}
            className={chipClass(vista === "todos")}
          >
            Todos
          </a>
          <a
            href={cumplimientoHref(carrier?.slug, {
              contract: contractFilter,
              vista: "tarde",
              desde: range.fromIso,
              hasta: range.toIso,
            })}
            className={chipClass(vista === "tarde")}
          >
            Tarde
          </a>
          <a
            href={cumplimientoHref(carrier?.slug, {
              contract: contractFilter,
              vista: "sin_servicio",
              desde: range.fromIso,
              hasta: range.toIso,
            })}
            className={chipClass(vista === "sin_servicio")}
          >
            Sin servicio detectado
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

        {vista === "sin_servicio" ? (
          <p className="text-sm text-[var(--muted)]">
            Dudosos reales: el sistema no encontró unidad que sirviera la ruta. Abre el
            detalle para etiquetar (calibración; no cambia lo que ve el cliente).
            {labeledIds.size > 0
              ? ` Ya etiquetados: ${labeledIds.size} de ${visible.length}.`
              : null}
          </p>
        ) : null}
        {vista === "tarde" ? (
          <p className="text-sm text-[var(--muted)]">
            No cumplidos con unidad y llegada ya identificadas. No requieren etiquetado.
          </p>
        ) : null}

        <Card title={title}>
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
