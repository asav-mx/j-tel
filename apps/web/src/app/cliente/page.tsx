import { getRepos } from "@/lib/db";
import { getClientMemberships } from "@/lib/auth";
import { canAccessPlant } from "@jtel/auth-rbac";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { computeEnforcement } from "@jtel/domain";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function ClienteDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const memberships = await getClientMemberships(client.id);
  const plants = await repos.clients.getPlantsForAccount(client.id);
  // Sin membresías (aún no hay login real): mostrar todas las plantas de la cuenta
  const visiblePlants =
    memberships.length === 0
      ? plants
      : plants.filter((p) => canAccessPlant(memberships, p.id, client.id));
  const occurrences = await repos.occurrences.findForClientAccount(client.id);

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
          title={`Cara Cliente — ${client.name}`}
          links={[
            { href: withAccount("/cliente", client.slug), label: "Cumplimiento" },
            { href: withAccount("/cliente/plantas", client.slug), label: "Plantas" },
            { href: withAccount("/cliente/configuracion", client.slug), label: "Configuración" },
            { href: withAccount("/cliente/reportes", client.slug), label: "Reportes" },
            { href: withAccount("/cliente/notificaciones", client.slug), label: "Notificaciones" },
          ]}
        />

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="Total">{stats.total}</Card>
          <Card title="Cumplidos">{stats.cumplido}</Card>
          <Card title="No cumplidos">{stats.noCumplido}</Card>
          <Card title="Pendientes">{stats.pendiente}</Card>
        </div>

        <Card title="Plantas visibles">
          {visiblePlants.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Este cliente aún no tiene plantas.{" "}
              <a
                href={withAccount("/cliente/plantas", client.slug)}
                className="text-[var(--accent)]"
              >
                Crear plantas
              </a>
              .
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {visiblePlants.map((plant) => (
                <li key={plant.id}>
                  <a
                    href={withAccount(`/cliente/planta-${plant.code}`, client.slug)}
                    className="text-[var(--accent)]"
                  >
                    {plant.name} ({plant.code})
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            <a
              href={withAccount("/cliente/plantas", client.slug)}
              className="text-[var(--accent)]"
            >
              Gestionar plantas →
            </a>
          </p>
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
                          <a
                            href={withAccount(`/cliente/servicio/${occ.id}`, client.slug)}
                            className="text-[var(--accent)]"
                          >
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
