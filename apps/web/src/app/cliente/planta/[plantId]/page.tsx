import { getRepos } from "@/lib/db";
import { NavBar, StatusBadge } from "@/components/ui";
import { notFound } from "next/navigation";
import { withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function PlantaPage({
  params,
  searchParams,
}: {
  params: Promise<{ plantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const accountSlug = typeof sp?.account === "string" ? sp.account : undefined;
  const repos = getRepos();
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant) notFound();

  const occurrences = await repos.occurrences.findForPlant(plantId);
  const inspections = await repos.inspections.findForPlant(plantId);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <NavBar
          title={`${plant.name} — Planta Operadora`}
          links={[
            { href: withAccount("/cliente", accountSlug), label: "Corporativo" },
            { href: withAccount(`/cliente/planta/${plantId}`, accountSlug), label: plant.name },
            {
              href: withAccount(`/cliente/planta/${plantId}/inspecciones`, accountSlug),
              label: "Inspecciones",
            },
          ]}
        />

        <p className="mb-6 text-sm text-[var(--muted)]">
          Alcance: solo esta planta. No ve otras plantas del corporativo.
        </p>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Servicios de la planta</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-[var(--card)] text-left text-[var(--muted)]">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Llegada observada</th>
                </tr>
              </thead>
              <tbody>
                {occurrences.map((o) => (
                  <tr key={o.id} className="border-t border-white/5">
                    <td className="p-3">{o.serviceDate}</td>
                    <td className="p-3">
                      <StatusBadge status={o.complianceFact?.status} />
                    </td>
                    <td className="p-3">
                      {o.complianceFact?.observedArrivalAt?.toLocaleString("es-MX") ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Inspecciones</h2>
          {inspections.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin inspecciones registradas.</p>
          ) : (
            <ul className="space-y-2">
              {inspections.map((i) => (
                <li
                  key={i.id}
                  className="rounded-lg border border-white/10 bg-[var(--card)] p-3 text-sm"
                >
                  {i.status} — {i.inspectedAt?.toLocaleDateString("es-MX") ?? "Pendiente"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
