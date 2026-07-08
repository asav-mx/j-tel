import { getRepos } from "@/lib/db";
import { getClientMemberships } from "@/lib/auth";
import { canAccessPlant } from "@jtel/auth-rbac";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { notFound } from "next/navigation";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function PlantaPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const plantCode = code.replace("planta-", "");
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);
  if (!client) notFound();

  const memberships = await getClientMemberships(client.id);
  const plants = await repos.clients.getPlantsForAccount(client.id);
  const plant = plants.find((p) => p.code === plantCode);
  if (!plant) notFound();

  if (memberships.length > 0 && !canAccessPlant(memberships, plant.id, client.id)) {
    return (
      <main className="p-8">
        <p>Acceso denegado — esta planta no está en su alcance.</p>
      </main>
    );
  }

  const occurrences = await repos.occurrences.findForPlant(plant.id);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav
          title={`Planta ${plant.name}`}
          links={[
            { href: withAccount("/cliente", client.slug), label: "Corporativo" },
            { href: withAccount(`/cliente/planta-${plant.code}`, client.slug), label: plant.name },
            { href: withAccount("/cliente/inspecciones", client.slug), label: "Inspecciones" },
          ]}
        />

        <Card title={`Servicios — solo planta ${plant.code}`}>
          <div className="space-y-3">
            {occurrences.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sin servicios en el periodo.</p>
            ) : (
              occurrences.map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 p-3"
                >
                  <div>
                    <p className="font-medium">{occ.serviceDate}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Deadline: {new Date(occ.expectedDeadline).toLocaleString("es-MX")}
                    </p>
                  </div>
                  <StatusBadge status={occ.complianceFact?.status} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
