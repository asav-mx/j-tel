import { getRepos } from "@/lib/db";
import { getClientMemberships } from "@/lib/auth";
import { canAccessPlant } from "@jtel/auth-rbac";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { computeEnforcement } from "@jtel/domain";

export const dynamic = "force-dynamic";

export default async function ClienteDashboardPage() {
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  const memberships = tecma ? await getClientMemberships(tecma.id) : [];

  if (!tecma || memberships.length === 0) {
    return (
      <main className="p-8">
        <p>Sin acceso o datos de demo. Ejecute db:seed.</p>
      </main>
    );
  }

  const plants = await repos.clients.getPlantsForAccount(tecma.id);
  const visiblePlants = plants.filter((p) =>
    canAccessPlant(memberships, p.id, tecma.id),
  );
  const occurrences = await repos.occurrences.findForClientAccount(tecma.id);

  const stats = {
    total: occurrences.length,
    cumplido: occurrences.filter((o) => o.complianceFact?.status === "cumplido").length,
    noCumplido: occurrences.filter((o) => o.complianceFact?.status === "no_cumplido").length,
    pendiente: occurrences.filter((o) => o.complianceFact?.status === "pendiente_evidencia")
      .length,
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title="Cara Cliente — Tecma"
          links={[
            { href: "/cliente", label: "Cumplimiento" },
            { href: "/cliente/planta-47", label: "Planta 47" },
            { href: "/cliente/reportes", label: "Reportes" },
            { href: "/cliente/notificaciones", label: "Notificaciones" },
          ]}
        />

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="Total">{stats.total}</Card>
          <Card title="Cumplidos">{stats.cumplido}</Card>
          <Card title="No cumplidos">{stats.noCumplido}</Card>
          <Card title="Pendientes">{stats.pendiente}</Card>
        </div>

        <Card title="Plantas visibles">
          <ul className="space-y-2 text-sm">
            {visiblePlants.map((plant) => (
              <li key={plant.id}>
                <a href={`/cliente/planta-${plant.code}`} className="text-[var(--accent)]">
                  {plant.name} ({plant.code})
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-6">
          <Card title="Servicios recientes">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[var(--muted)]">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Perfil</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Enforcement</th>
                    <th className="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.slice(0, 20).map((occ) => {
                    const fact = occ.complianceFact;
                    const enforcement =
                      fact
                        ? computeEnforcement(
                            fact.status,
                            fact.timing,
                            fact.lateExcusable,
                            fact.contractPolicySnapshot,
                          ).filter((e) => e.applies)
                        : [];

                    return (
                      <tr key={occ.id} className="border-b border-white/5">
                        <td className="py-3 pr-4">{occ.serviceDate}</td>
                        <td className="py-3 pr-4">{occ.profile?.name ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={fact?.status} />
                        </td>
                        <td className="py-3 pr-4 text-xs text-[var(--muted)]">
                          {enforcement[0]?.description ?? "—"}
                        </td>
                        <td className="py-3">
                          <a href={`/cliente/servicio/${occ.id}`} className="text-[var(--accent)]">
                            Ver
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
