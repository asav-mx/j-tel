import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export default async function GeocercasPage({
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
          <AppNav title="Geocercas" links={[{ href: "/cliente/configuracion", label: "← Configuración" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [plants, geofences] = await Promise.all([
    repos.clients.getPlantsForAccount(client.id),
    repos.geofences.findForClient(client.id),
  ]);
  const geofencesByPlant = new Map<string, typeof geofences>();
  for (const g of geofences) {
    if (!g.ownerPlantId) continue;
    const list = geofencesByPlant.get(g.ownerPlantId) ?? [];
    list.push(g);
    geofencesByPlant.set(g.ownerPlantId, list);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Geocercas de destino"
          links={[
            { href: withAccount("/cliente/configuracion", client.slug), label: "← Configuración" },
            { href: withAccount("/cliente/plantas", client.slug), label: "Plantas" },
          ]}
        />

        <p className="text-sm text-[var(--muted)]">
          La geocerca marca <span className="text-white">dónde debe llegar</span> la unidad. Sin una
          geocerca de destino, ese destino no se puede verificar. Captura el centro (latitud y
          longitud) y un radio en metros; nosotros generamos el área.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Geocerca creada. Ya aparece en la lista.
          </div>
        ) : null}

        {plants.length === 0 ? (
          <Card title="Primero crea una planta">
            <p className="text-sm text-[var(--muted)]">
              Este cliente no tiene plantas todavía.{" "}
              <a href={withAccount("/cliente/plantas", client.slug)} className="text-[var(--accent)]">
                Crear plantas →
              </a>
            </p>
          </Card>
        ) : (
          <Card title="Nueva geocerca">
            <form action="/api/cliente/geocercas" method="post" className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <label className={labelClass}>
                Planta
                <select name="plantId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elige planta…
                  </option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Tipo
                <select name="role" className={inputClass} defaultValue="destino">
                  <option value="destino">Destino</option>
                  <option value="base">Base</option>
                  <option value="caseta">Caseta</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className={labelClass}>
                Nombre
                <input name="name" required className={inputClass} placeholder="Ej. Andén Planta Norte" />
              </label>
              <label className={labelClass}>
                Radio (metros)
                <input
                  name="radiusMeters"
                  required
                  className={inputClass}
                  placeholder="Ej. 150"
                  defaultValue="150"
                  inputMode="decimal"
                />
              </label>
              <label className={labelClass}>
                Latitud
                <input name="lat" required className={inputClass} placeholder="Ej. 31.6904" inputMode="decimal" />
              </label>
              <label className={labelClass}>
                Longitud
                <input name="lng" required className={inputClass} placeholder="Ej. -106.4245" inputMode="decimal" />
              </label>
              <div className="md:col-span-2">
                <p className="mb-2 text-xs text-[var(--muted)]">
                  Tip: en Google Maps, clic derecho sobre el punto → el primer valor es la latitud y el
                  segundo la longitud.
                </p>
                <button type="submit" className={btnClass}>
                  Crear geocerca
                </button>
              </div>
            </form>
          </Card>
        )}

        <Card title={`Geocercas (${geofences.length})`}>
          {geofences.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aún no hay geocercas. Crea la primera arriba.
            </p>
          ) : (
            <div className="space-y-4">
              {plants
                .filter((p) => (geofencesByPlant.get(p.id) ?? []).length > 0)
                .map((p) => (
                  <div key={p.id}>
                    <p className="mb-1 text-sm font-medium">
                      {p.name} <span className="text-[var(--muted)]">({p.code})</span>
                    </p>
                    <ul className="space-y-1 text-sm">
                      {(geofencesByPlant.get(p.id) ?? []).map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between rounded border border-white/5 p-2"
                        >
                          <span>{g.name}</span>
                          <span className="text-xs text-[var(--muted)]">
                            {g.role} · {g.polygon.length} vértices
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
