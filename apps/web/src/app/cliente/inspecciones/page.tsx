import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClienteInspeccionesPage() {
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  const plants = tecma ? await repos.clients.getPlantsForAccount(tecma.id) : [];
  const plant47 = plants.find((p) => p.code === "47");
  const inspections = plant47 ? await repos.inspections.findForPlant(plant47.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Inspecciones compartidas"
          links={[
            { href: "/cliente", label: "Corporativo" },
            { href: "/cliente/planta-47", label: "Planta 47" },
          ]}
        />
        <Card title="Zona compartida — planta audita, carrier provee">
          <p className="mb-4 text-sm text-[var(--muted)]">
            La planta operadora lleva las inspecciones; el carrier mantiene y provee la evidencia.
          </p>
          {inspections.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin inspecciones registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {inspections.map((i) => (
                <li key={i.id} className="rounded border border-white/5 p-3">
                  Estado: {i.status} · {i.notes ?? "Sin notas"}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
