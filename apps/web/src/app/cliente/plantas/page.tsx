import Link from "next/link";
import { getRepos } from "@/lib/db";
import { CorporateShell } from "@/components/unit-shell";
import { ConfirmForm } from "@/components/confirm-form";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { confirmMessages } from "@/lib/confirm-messages";
import { campusHref, plantHref } from "@/lib/navigation";

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

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <CorporateShell client={client} title={`Administrar plantas — ${client.name}`} />

        <p className="text-sm text-[var(--muted)]">
          Alta corporativa de plantas y campus. Para configurar servicios, entra al panel de cada{" "}
          <span className="text-white">unidad operativa</span> desde el hub principal.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {created === "grupo"
              ? "Grupo creado."
              : created === "actualizada"
                ? "Planta actualizada."
                : "Planta creada."}{" "}
            Ya aparece en la lista.
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
            <ul className="space-y-4 text-sm">
              {plants.map((p) => (
                <li
                  key={p.id}
                  className="rounded border border-white/5 p-3"
                >
                  <ConfirmForm
                    action="/api/cliente/plantas"
                    method="post"
                    className="space-y-3"
                    confirmTemplate={confirmMessages.savePlantTemplate}
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="plantId" value={p.id} />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className={`${labelClass} min-w-[12rem] flex-1`}>
                        Nombre
                        <input name="name" defaultValue={p.name} required className={inputClass} />
                      </label>
                      <label className={`${labelClass} min-w-[12rem] flex-1`}>
                        Grupo
                        <select
                          name="plantGroupId"
                          className={inputClass}
                          defaultValue={p.plantGroupId ?? ""}
                        >
                          <option value="">Sin grupo</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="pb-2 text-xs text-[var(--muted)]">Código: {p.code}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" className={btnClass}>
                        Guardar cambios
                      </button>
                      <a href={plantHref(p.id, client.slug)} className="self-center text-[var(--accent)]">
                        Abrir panel →
                      </a>
                    </div>
                  </ConfirmForm>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
