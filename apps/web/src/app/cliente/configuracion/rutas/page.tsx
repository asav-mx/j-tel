import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const createdLabels: Record<string, string> = {
  ruta: "Ruta creada.",
  turno: "Turno creado.",
  routeshift: "Ruta+turno combinados. Ya se puede usar en un perfil de servicio.",
};

export default async function RutasPage({
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
          <AppNav title="Rutas y turnos" links={[{ href: "/cliente/configuracion", label: "← Configuración" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [routes, shifts, routeShifts] = await Promise.all([
    repos.routes.getRoutesForClient(client.id),
    repos.routes.getShiftsForClient(client.id),
    repos.routes.getRouteShiftsForClient(client.id),
  ]);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Rutas y turnos"
          links={[{ href: withAccount("/cliente/configuracion", client.slug), label: "← Configuración" }]}
        />

        <p className="text-sm text-[var(--muted)]">
          Una <span className="text-white">ruta</span> (a dónde) más un{" "}
          <span className="text-white">turno</span> (a qué hora) forman una combinación con{" "}
          <span className="text-white">hora límite</span> de llegada. Esa combinación es lo que
          luego se usa en un perfil de servicio.
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {createdLabels[created] ?? "Guardado."}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="1. Nueva ruta">
            <form action="/api/cliente/rutas" method="post" className="space-y-3">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="route" />
              <label className={labelClass}>
                Nombre de la ruta
                <input name="name" required className={inputClass} placeholder="Ej. Ruta Poniente" />
              </label>
              <button type="submit" className={btnClass}>
                Crear ruta
              </button>
            </form>
          </Card>

          <Card title="2. Nuevo turno">
            <form action="/api/cliente/rutas" method="post" className="space-y-3">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="shift" />
              <label className={labelClass}>
                Nombre del turno
                <input name="name" required className={inputClass} placeholder="Ej. Matutino" />
              </label>
              <label className={labelClass}>
                Hora de inicio (HH:MM)
                <input name="startTime" required type="time" className={inputClass} defaultValue="06:00" />
              </label>
              <button type="submit" className={btnClass}>
                Crear turno
              </button>
            </form>
          </Card>
        </div>

        <Card title="3. Combinar ruta + turno (hora límite)">
          {routes.length === 0 || shifts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Primero crea al menos una ruta y un turno.
            </p>
          ) : (
            <form action="/api/cliente/rutas" method="post" className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="routeshift" />
              <label className={labelClass}>
                Ruta
                <select name="routeId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elige ruta…
                  </option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Turno
                <select name="shiftId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elige turno…
                  </option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.startTime}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Hora límite de llegada (HH:MM)
                <input name="deadlineTime" required type="time" className={inputClass} defaultValue="07:00" />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Waypoints de la ruta (opcional, una línea &quot;lat,lng&quot; por punto)
                <textarea
                  name="waypoints"
                  rows={4}
                  className={inputClass}
                  placeholder={"31.7500,-106.4800\n31.7100,-106.4500\n31.6904,-106.4245"}
                />
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Solo hace falta si el contrato exige seguir la ruta completa (strictness
                  &quot;ruta completa&quot;). Para verificar solo el destino, déjalo vacío.
                </span>
              </label>
              <div className="md:col-span-2">
                <button type="submit" className={btnClass}>
                  Combinar
                </button>
              </div>
            </form>
          )}
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title={`Rutas (${routes.length})`}>
            {routes.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sin rutas todavía.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {routes.map((r) => (
                  <li key={r.id} className="rounded border border-white/5 p-2">
                    {r.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Turnos (${shifts.length})`}>
            {shifts.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Sin turnos todavía.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {shifts.map((s) => (
                  <li key={s.id} className="rounded border border-white/5 p-2">
                    {s.name} · {s.startTime}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Combinaciones ruta + turno (${routeShifts.length})`}>
          {routeShifts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Sin combinaciones. Crea una arriba para poder armar un perfil de servicio.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {routeShifts.map((rs) => (
                <li
                  key={rs.id}
                  className="flex items-center justify-between rounded border border-white/5 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Límite: {rs.deadlineTime}
                      {rs.kmlVersions.length > 0 ? " · con waypoints" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
