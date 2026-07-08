import Link from "next/link";
import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function JStaffCuentasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;

  const repos = getRepos();
  const accounts = await repos.accounts.listAll();
  const carriers = accounts.filter((a) => a.type === "carrier");
  const clients = accounts.filter((a) => a.type === "client");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav title="Alta de cuentas" links={[{ href: "/jstaff", label: "← Panel" }]} />

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Cuenta creada correctamente. Ya aparece en la lista de abajo.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Crear cuenta carrier o cliente">
            <form action="/api/jstaff/accounts" method="post" className="space-y-4">
              <label className="block text-sm">
                Nombre de la empresa
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2"
                  placeholder="Ej. Transportes García"
                />
              </label>
              <label className="block text-sm">
                Tipo
                <select
                  name="type"
                  className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2"
                >
                  <option value="client">Cliente (maquiladora / planta)</option>
                  <option value="carrier">Carrier (operador de transporte)</option>
                </select>
              </label>
              <p className="text-xs text-[var(--muted)]">
                El identificador de URL se genera automáticamente a partir del nombre.
              </p>
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black"
              >
                Crear cuenta
              </button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card title={`Carriers (${carriers.length})`}>
              {carriers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin carriers todavía.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {carriers.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded border border-white/5 p-3"
                    >
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-[var(--muted)]">{a.slug}</p>
                      </div>
                      <Link
                        href={withAccount("/carrier", a.slug)}
                        className="text-[var(--accent)]"
                      >
                        Abrir
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Clientes (${clients.length})`}>
              {clients.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin clientes todavía.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {clients.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded border border-white/5 p-3"
                    >
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-[var(--muted)]">{a.slug}</p>
                      </div>
                      <Link
                        href={withAccount("/cliente", a.slug)}
                        className="text-[var(--accent)]"
                      >
                        Abrir
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
