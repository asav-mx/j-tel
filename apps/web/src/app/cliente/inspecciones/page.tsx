import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { plantHref } from "@/lib/navigation";
import { exigirSesion } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function ClienteInspeccionesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Sin sesión no se renderiza. Va en la PÁGINA y no solo en el layout:
  // un redirect de layout no impide que la hija se renderice, y su
  // payload —con datos reales dentro— viaja igual en la respuesta.
  await exigirSesion();

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);
  const plants = client ? await repos.clients.getPlantsForAccount(client.id) : [];
  const firstPlant = plants[0];
  const inspections = firstPlant ? await repos.inspections.findForPlant(firstPlant.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Inspecciones compartidas"
          links={[
            { href: withAccount("/cliente", client?.slug), label: "Corporativo" },
            {
              href: firstPlant ? plantHref(firstPlant.id, client?.slug) : withAccount("/cliente", client?.slug),
              label: firstPlant?.name ?? "Planta",
            },
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
                <li key={i.id} className="rounded border border-[var(--linea-tenue)] p-3">
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
