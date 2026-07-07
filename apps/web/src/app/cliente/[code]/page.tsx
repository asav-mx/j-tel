import { getRepos } from "@/lib/db";
import { getClientMemberships } from "@/lib/auth";
import { canAccessPlant } from "@jtel/auth-rbac";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlantaPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const plantCode = code.replace("planta-", "");
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  if (!tecma) notFound();

  const memberships = await getClientMemberships(tecma.id);
  const plants = await repos.clients.getPlantsForAccount(tecma.id);
  const plant = plants.find((p) => p.code === plantCode);
  if (!plant) notFound();

  if (memberships.length > 0 && !canAccessPlant(memberships, plant.id, tecma.id)) {
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
            { href: "/cliente", label: "Corporativo" },
            { href: `/cliente/planta-${plant.code}`, label: plant.name },
            { href: "/cliente/inspecciones", label: "Inspecciones" },
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
