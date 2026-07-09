import { getRepos } from "@/lib/db";
import { getClientMemberships } from "@/lib/auth";
import { canAccessPlant } from "@jtel/auth-rbac";
import { AppNav, Card } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { resolveAccountByType } from "@/lib/account-context";
import { clientNavLinks } from "@/lib/client-nav";
import { complianceHref, plantHref } from "@/lib/navigation";

export const dynamic = "force-dynamic";

function filterByPlant<T extends { contract?: { plantId?: string | null } | null }>(
  items: T[],
  plantId: string | null,
): T[] {
  if (!plantId) return items;
  return items.filter((o) => o.contract?.plantId === plantId);
}

export default async function ClienteCumplimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const plantFilter =
    typeof sp?.plant === "string" && sp.plant !== "all" ? sp.plant : null;

  const memberships = await getClientMemberships(client.id);
  const plants = await repos.clients.getPlantsForAccount(client.id);
  const visiblePlants =
    memberships.length === 0
      ? plants
      : plants.filter((p) => canAccessPlant(memberships, p.id, client.id));

  const allOccurrences = await repos.occurrences.findForClientAccount(client.id);
  const occurrences = filterByPlant(allOccurrences, plantFilter);

  const rows = occurrences
    .slice(0, 50)
    .map((occ) => toOccurrenceRow(occ, "/cliente/servicio", client.slug));

  const activePlant = plantFilter
    ? visiblePlants.find((p) => p.id === plantFilter)
    : null;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title={`Cumplimiento — ${client.name}`}
          links={clientNavLinks(client.slug)}
        />

        <ClientAccountSwitcher currentSlug={client.slug} basePath="/cliente/cumplimiento" />

        <p className="mb-6 text-sm text-[var(--muted)]">
          Cliente corporativo: <span className="text-white">{client.name}</span>. Detalle de
          servicios verificados contra el GPS del carrier (por contrato y planta).
        </p>

        {visiblePlants.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Planta:</span>
            <a
              href={complianceHref(client.slug)}
              className={`rounded-full px-3 py-1 text-sm ${
                !plantFilter
                  ? "bg-[var(--accent)] text-black"
                  : "border border-white/10 hover:border-[var(--accent)]"
              }`}
            >
              Todas
            </a>
            {visiblePlants.map((plant) => (
              <a
                key={plant.id}
                href={complianceHref(client.slug, plant.id)}
                className={`rounded-full px-3 py-1 text-sm ${
                  plantFilter === plant.id
                    ? "bg-[var(--accent)] text-black"
                    : "border border-white/10 hover:border-[var(--accent)]"
                }`}
              >
                {plant.name}
              </a>
            ))}
          </div>
        ) : null}

        {activePlant ? (
          <p className="mb-4 text-sm text-[var(--muted)]">
            Mostrando servicios de{" "}
            <a href={plantHref(activePlant.id, client.slug)} className="text-[var(--accent)]">
              {activePlant.name} ({activePlant.code})
            </a>
            .{" "}
            <a href={complianceHref(client.slug)} className="text-[var(--accent)]">
              Ver todas las plantas
            </a>
          </p>
        ) : null}

        <Card title="Servicios recientes">
          <OccurrenceTable rows={rows} showPlant={!plantFilter} showCarrier />
        </Card>
      </div>
    </main>
  );
}
