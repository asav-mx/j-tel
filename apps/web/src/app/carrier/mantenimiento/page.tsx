import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function CarrierMantenimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);
  const records = carrier ? await repos.fleet.getMaintenanceForCarrier(carrier.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav
          title="Mantenimiento"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />
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
