import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CarrierMantenimientoPage() {
  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug("juarez-bus");
  const records = carrier ? await repos.fleet.getMaintenanceForCarrier(carrier.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav title="Mantenimiento" links={[{ href: "/carrier", label: "← Panel" }]} />
        <Card>
          <ul className="space-y-3 text-sm">
            {records.map((r) => (
              <li key={r.id} className="rounded border border-white/5 p-4">
                <p className="font-medium">{r.description}</p>
                <p className="text-[var(--muted)]">
                  Estado: {r.status}
                  {r.scheduledAt
                    ? ` · Programado: ${new Date(r.scheduledAt).toLocaleDateString("es-MX")}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
