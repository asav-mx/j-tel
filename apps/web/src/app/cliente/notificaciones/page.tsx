import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function ClienteNotificacionesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);
  const notifications = client ? await repos.notifications.findForAccount(client.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <AppNav
          title="Notificaciones"
          links={[{ href: withAccount("/cliente/cumplimiento", client?.slug), label: "← Cumplimiento" }]}
        />
        <Card>
          <ul className="space-y-4">
            {notifications.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">Sin notificaciones.</li>
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
