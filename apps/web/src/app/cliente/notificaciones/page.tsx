import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { DateRangeFilter } from "@/components/date-range-filter";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { inCreatedAtRange, resolveDateRange } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export default async function ClienteNotificacionesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const range = resolveDateRange(sp, { defaultDaysBack: 29 });

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);
  const all = client ? await repos.notifications.findForAccount(client.id) : [];
  const notifications = all
    .filter((n) => inCreatedAtRange(n.createdAt, range.fromIso, range.toIso))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <AppNav
          title="Notificaciones"
          links={[{ href: withAccount("/cliente/cumplimiento", client?.slug), label: "← Cumplimiento" }]}
        />

        <DateRangeFilter
          action="/cliente/notificaciones"
          range={range}
          hidden={{ account: client?.slug }}
        />

        <Card title={`Notificaciones — ${range.label} (${notifications.length})`}>
          <ul className="space-y-4">
            {notifications.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">
                Sin notificaciones en este rango.
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id} className="rounded-lg border border-white/5 p-4">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{n.body}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {new Date(n.createdAt).toLocaleString("es-MX")} · {n.type}
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
