import { getRepos } from "@/lib/db";
import { ClientConfigShell } from "@/components/client-config-shell";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

type GeofenceTarget =
  | { kind: "plant"; id: string; label: string }
  | { kind: "plant_group"; id: string; label: string };

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

  const [operationalUnits, geofences, allPlants] = await Promise.all([
    repos.clients.getOperationalUnits(client.id),
    repos.geofences.findForClient(client.id),
    repos.clients.getPlantsForAccount(client.id),
  ]);

  const geofenceTargets: GeofenceTarget[] = [
    ...operationalUnits
      .filter((u) => u.kind === "plant_group")
      .map((u) => ({
        kind: "plant_group" as const,
        id: u.id,
        label: `Campus: ${operationalUnitLabel(u)}`,
      })),
    ...allPlants.map((p) => ({
      kind: "plant" as const,
      id: p.id,
      label: p.plantGroupId ? `${p.name} (${p.code}) — excepción` : `${p.name} (${p.code})`,
    })),
  ];

  const geofencesByTarget = new Map<string, typeof geofences>();
  for (const g of geofences) {
    const key =
      g.ownerType === "plant_group" && g.ownerPlantGroupId
        ? `plant_group:${g.ownerPlantGroupId}`
        : g.ownerPlantId
          ? `plant:${g.ownerPlantId}`
          : null;
    if (!key) continue;
    const list = geofencesByTarget.get(key) ?? [];
    list.push(g);
    geofencesByTarget.set(key, list);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <ClientConfigShell
          client={client}
          title={`Geocercas — ${client.name}`}
          step="geocercas"
          basePath="/cliente/configuracion/geocercas"
        />

        <p className="text-sm text-[var(--muted)]">
          La geocerca marca <span className="text-white">dónde debe llegar</span> la unidad. En un{" "}
          <span className="text-white">campus</span> compartido suele haber una geocerca de llegada
          común en la entrada; también puedes definir geocercas por planta cuando haga falta
          (excepciones).
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

        {geofenceTargets.length === 0 ? (
          <Card title="Primero crea plantas o campus">
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
              <label className={`${labelClass} md:col-span-2`}>
                Pertenece a
                <select name="ownerRef" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elige campus o planta…
                  </option>
                  {geofenceTargets.map((t) => (
                    <option key={`${t.kind}-${t.id}`} value={`${t.kind}:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Tipo
                <select name="role" className={inputClass} defaultValue="destino">
                  <option value="destino">Destino (llegada)</option>
                  <option value="base">Base</option>
                  <option value="caseta">Caseta</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className={labelClass}>
                Nombre
                <input name="name" required className={inputClass} placeholder="Ej. Entrada Campus Norte" />
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
              {geofenceTargets
                .filter((t) => (geofencesByTarget.get(`${t.kind}:${t.id}`) ?? []).length > 0)
                .map((t) => (
                  <div key={`${t.kind}-${t.id}`}>
                    <p className="mb-1 text-sm font-medium">{t.label}</p>
                    <ul className="space-y-1 text-sm">
                      {(geofencesByTarget.get(`${t.kind}:${t.id}`) ?? []).map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between rounded border border-white/5 p-2"
                        >
                          <span>{g.name}</span>
                          <span className="text-xs text-[var(--muted)]">
                            {g.role} · {g.polygon.length} vértices
                            {g.ownerType === "plant_group" ? " · campus" : ""}
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
