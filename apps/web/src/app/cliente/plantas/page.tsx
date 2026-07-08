import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export default async function ClientePlantasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Plantas" links={[{ href: "/cliente", label: "← Panel" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [plants, groups] = await Promise.all([
    repos.clients.getPlantsForAccount(client.id),
    repos.clients.getPlantGroupsForAccount(client.id),
  ]);
  const groupById = new Map(groups.map((g) => [g.id, g.name] as const));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Plantas del cliente"
          links={[
            { href: withAccount("/cliente", client.slug), label: "← Panel" },
            { href: withAccount("/cliente/reportes", client.slug), label: "Reportes" },
          ]}
        />

        <p className="text-sm text-[var(--muted)]">
          Cliente corporativo: <span className="text-white">{client.name}</span>. Una cuenta de
          cliente puede tener muchas plantas; opcionalmente puedes agruparlas (por región, unidad de
          negocio, etc.).
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {created === "grupo" ? "Grupo creado." : "Planta creada."} Ya aparece en la lista.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Nueva planta">
            <form action="/api/cliente/plantas" method="post" className="space-y-3">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="plant" />
              <label className={labelClass}>
                Nombre de la planta
                <input
                  name="name"
                  required
                  className={inputClass}
                  placeholder="Ej. Planta Norte"
                />
              </label>
              <label className={labelClass}>
                Código (opcional, se genera del nombre)
                <input name="code" className={inputClass} placeholder="Ej. PLANTA-47" />
              </label>
              <label className={labelClass}>
                Grupo (opcional)
                <select name="plantGroupId" className={inputClass} defaultValue="">
                  <option value="">Sin grupo</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={btnClass}>
                Crear planta
              </button>
            </form>
          </Card>

          <Card title="Nuevo grupo de plantas (opcional)">
            <form action="/api/cliente/plantas" method="post" className="space-y-3">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="group" />
              <label className={labelClass}>
                Nombre del grupo
                <input
                  name="groupName"
                  required
                  className={inputClass}
                  placeholder="Ej. Región Bajío"
                />
              </label>
              <p className="text-xs text-[var(--muted)]">
                Los grupos sirven para reportes y permisos por conjunto de plantas.
              </p>
              <button type="submit" className={btnClass}>
                Crear grupo
              </button>
            </form>
          </Card>
        </div>

        <Card title={`Plantas (${plants.length})`}>
          {plants.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Este cliente todavía no tiene plantas. Crea la primera arriba.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {plants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded border border-white/5 p-3"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Código: {p.code}
                      {p.plantGroupId ? ` · Grupo: ${groupById.get(p.plantGroupId) ?? "—"}` : ""}
                    </p>
                  </div>
                  <a
                    href={withAccount(`/cliente/planta-${p.code}`, client.slug)}
                    className="text-[var(--accent)]"
                  >
                    Abrir
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
