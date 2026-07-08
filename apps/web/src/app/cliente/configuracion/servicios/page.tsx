import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const createdLabels: Record<string, string> = {
  perfil: "Perfil de servicio creado. Ya puedes generar sus ocurrencias.",
  generado: "Ocurrencias generadas.",
};

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const n = typeof sp?.n === "string" ? sp.n : null;

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Servicios" links={[{ href: "/cliente/configuracion", label: "← Configuración" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [carriers, contracts, routeShifts, geofences, profiles] = await Promise.all([
    repos.accounts.listByType("carrier"),
    repos.contracts.findForClient(client.id),
    repos.routes.getRouteShiftsForClient(client.id),
    repos.geofences.findForClient(client.id),
    repos.profiles.findForClient(client.id),
  ]);
  const carrierById = new Map(carriers.map((c) => [c.id, c] as const));

  // Unidades de los carriers que tienen contrato con este cliente.
  const carrierIds = [...new Set(contracts.map((c) => c.carrierAccountId))];
  const unitsByCarrier = await Promise.all(
    carrierIds.map(async (id) => ({
      carrier: carrierById.get(id) ?? null,
      units: await repos.fleet.getUnitsForCarrier(id),
    })),
  );
  const allUnits = unitsByCarrier.flatMap((c) => c.units);

  const missing: string[] = [];
  if (contracts.length === 0) missing.push("un contrato");
  if (routeShifts.length === 0) missing.push("una combinación ruta+turno");
  if (geofences.length === 0) missing.push("una geocerca de destino");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Perfiles de servicio"
          links={[{ href: withAccount("/cliente/configuracion", client.slug), label: "← Configuración" }]}
        />

        <p className="text-sm text-[var(--muted)]">
          El perfil de servicio junta todo: <span className="text-white">contrato</span> +{" "}
          <span className="text-white">ruta/turno</span> + <span className="text-white">geocerca</span>{" "}
          + <span className="text-white">unidades</span> + días activos. Con un perfil ya puedes
          generar las ocurrencias (los servicios diarios que se verificarán).
        </p>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {created ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {created === "generado" && n
              ? `Ocurrencias generadas: ${n}.`
              : createdLabels[created] ?? "Guardado."}
          </div>
        ) : null}

        {missing.length > 0 ? (
          <Card title="Faltan requisitos">
            <p className="text-sm text-[var(--muted)]">
              Para crear un perfil necesitas {missing.join(", ")}. Ve a{" "}
              <a href={withAccount("/cliente/configuracion", client.slug)} className="text-[var(--accent)]">
                Configuración
              </a>{" "}
              para completarlos.
            </p>
          </Card>
        ) : (
          <Card title="Nuevo perfil de servicio">
            <form action="/api/cliente/servicios" method="post" className="space-y-4">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="create" />

              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass}>
                  Nombre del perfil
                  <input name="name" required className={inputClass} placeholder="Ej. Poniente Matutino" />
                </label>
                <label className={labelClass}>
                  Contrato
                  <select name="contractId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige contrato…
                    </option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {carrierById.get(c.carrierAccountId)?.name ?? "carrier"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Ruta + turno
                  <select name="routeShiftId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige combinación…
                    </option>
                    {routeShifts.map((rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"} · límite {rs.deadlineTime}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Geocerca de destino
                  <select name="geofenceId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige geocerca…
                    </option>
                    {geofences.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Unidad de referencia (opcional)
                  <select name="referenceUnitId" className={inputClass} defaultValue="">
                    <option value="">—</option>
                    {allUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                        {u.plateNumber ? ` · ${u.plateNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">
                  Unidades posibles (del carrier del contrato)
                </legend>
                {allUnits.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    El carrier del contrato no tiene unidades. Regístralas en su gestión de flota.
                  </p>
                ) : (
                  unitsByCarrier.map((c) => (
                    <div key={c.carrier?.id ?? "x"} className="mb-2">
                      <p className="text-xs text-[var(--muted)]">{c.carrier?.name ?? "Carrier"}</p>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {c.units.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="possibleUnitIds" value={u.id} />
                            {u.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </fieldset>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">Días activos</legend>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="activeDays"
                        value={d.value}
                        defaultChecked={d.value >= 1 && d.value <= 5}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button type="submit" className={btnClass}>
                Crear perfil
              </button>
            </form>
          </Card>
        )}

        <Card title={`Perfiles (${profiles.length})`}>
          {profiles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin perfiles todavía.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {profiles.map((p) => (
                <li key={p.id} className="rounded border border-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {p.contract?.name ?? "—"} · {p.routeShift?.route?.name ?? "—"} ·{" "}
                        {p.routeShift?.shift?.name ?? "—"} · destino {p.geofence?.name ?? "—"} ·{" "}
                        {p.possibleUnits.length} unidad(es) · días [{(p.activeDays ?? []).join(", ")}]
                      </p>
                    </div>
                  </div>
                  <form
                    action="/api/cliente/servicios"
                    method="post"
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="action" value="generar" />
                    <input type="hidden" name="profileId" value={p.id} />
                    <label className="text-xs">
                      Desde
                      <input name="fromDate" type="date" required className={inputClass} />
                    </label>
                    <label className="text-xs">
                      Hasta
                      <input name="toDate" type="date" required className={inputClass} />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-[var(--accent)]"
                    >
                      Generar ocurrencias
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
