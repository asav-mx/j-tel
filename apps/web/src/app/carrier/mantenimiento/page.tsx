import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { DateRangeFilter } from "@/components/date-range-filter";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { inCreatedAtRange, resolveDateRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export default async function CarrierMantenimientoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const range = resolveDateRange(sp, { defaultDaysBack: 29 });

  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);
  const all = carrier ? await repos.fleet.getMaintenanceForCarrier(carrier.id) : [];
  const records = all.filter((r) => {
    const when = r.scheduledAt ?? r.createdAt;
    if (!when) return true;
    return inCreatedAtRange(when, range.fromIso, range.toIso);
  });

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <AppNav
          title="Mantenimiento"
          links={[{ href: withAccount("/carrier", carrier?.slug), label: "← Panel" }]}
        />

        <DateRangeFilter
          action="/carrier/mantenimiento"
          range={range}
          hidden={{ account: carrier?.slug }}
        />

        <Card title={`Mantenimiento — ${range.label} (${records.length})`}>
          <ul className="space-y-3 text-sm">
            {records.length === 0 ? (
              <li className="text-[var(--muted)]">Sin registros en este rango.</li>
            ) : (
              records.map((r) => (
                <li key={r.id} className="rounded border border-white/5 p-4">
                  <p className="font-medium">{r.description}</p>
                  <p className="text-[var(--muted)]">
                    Estado: {r.status}
                    {r.scheduledAt
                      ? ` · Programado: ${new Date(r.scheduledAt).toLocaleDateString("es-MX")}`
                      : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </main>
  );
}
