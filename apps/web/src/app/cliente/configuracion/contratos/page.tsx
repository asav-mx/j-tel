import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const EXCUSABLES: Array<{ value: string; label: string }> = [
  { value: "lluvia_nieve", label: "Lluvia / nieve" },
  { value: "marchas", label: "Marchas / manifestaciones" },
  { value: "obstruccion", label: "Obstrucción de vialidad" },
  { value: "falla_mecanica", label: "Falla mecánica" },
  { value: "ponchadura", label: "Ponchadura" },
  { value: "obra_sin_aviso", label: "Obra sin aviso" },
];

const createdLabels: Record<string, string> = {
  contrato: "Contrato creado (en borrador). Actívalo cuando esté listo.",
  activado: "Contrato activado.",
};

export default async function ContratosPage({
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
          <AppNav title="Contratos" links={[{ href: "/cliente/configuracion", label: "← Configuración" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [carriers, plants, groups, contracts] = await Promise.all([
    repos.accounts.listByType("carrier"),
    repos.clients.getPlantsForAccount(client.id),
    repos.clients.getPlantGroupsForAccount(client.id),
    repos.contracts.findForClient(client.id),
  ]);
  const plantById = new Map(plants.map((p) => [p.id, p.name] as const));
  const groupById = new Map(groups.map((g) => [g.id, g.name] as const));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title="Contratos"
          links={[{ href: withAccount("/cliente/configuracion", client.slug), label: "← Configuración" }]}
        />

        <p className="text-sm text-[var(--muted)]">
          El contrato define la <span className="text-white">política</span> entre este cliente y un
          carrier: tolerancia, estrictez de ruta, márgenes de evidencia y las reglas de castigo
          (enforcement). Aplica a una planta o a un grupo de plantas.
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

        {carriers.length === 0 || plants.length === 0 ? (
          <Card title="Faltan requisitos">
            <p className="text-sm text-[var(--muted)]">
              Para crear un contrato necesitas al menos{" "}
              {carriers.length === 0 ? "un carrier (créalo en J-Staff → Cuentas)" : null}
              {carriers.length === 0 && plants.length === 0 ? " y " : null}
              {plants.length === 0 ? (
                <a href={withAccount("/cliente/plantas", client.slug)} className="text-[var(--accent)]">
                  una planta
                </a>
              ) : null}
              .
            </p>
          </Card>
        ) : (
          <Card title="Nuevo contrato">
            <form action="/api/cliente/contratos" method="post" className="space-y-4">
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="create" />

              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass}>
                  Nombre del contrato
                  <input name="name" required className={inputClass} placeholder="Ej. Ruta Poniente 2026" />
                </label>
                <label className={labelClass}>
                  Carrier
                  <select name="carrierAccountId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige carrier…
                    </option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">Alcance</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClass}>
                    Aplica a
                    <select name="target" className={inputClass} defaultValue="plant">
                      <option value="plant">Una planta</option>
                      <option value="group">Un grupo de plantas</option>
                    </select>
                  </label>
                  <div className="grid gap-3">
                    <label className={labelClass}>
                      Planta
                      <select name="plantId" className={inputClass} defaultValue="">
                        <option value="">—</option>
                        {plants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Grupo (si elegiste &quot;grupo&quot;)
                      <select name="plantGroupId" className={inputClass} defaultValue="">
                        <option value="">—</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">Política</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className={labelClass}>
                    Anticipación de llegada (min antes del turno)
                    <input
                      name="arrivalAnticipationMinutes"
                      type="number"
                      min={0}
                      defaultValue={15}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Ej. turno 7:00 y 15 min → deadline 6:45 en geocerca.
                    </span>
                  </label>
                  <label className={labelClass}>
                    Tolerancia puntualidad (min)
                    <input name="toleranceMinutes" type="number" min={0} defaultValue={5} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Gracia de verificación (min)
                    <input
                      name="verificationGraceMinutes"
                      type="number"
                      min={0}
                      defaultValue={15}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Estrictez de ruta
                    <select name="routeStrictness" className={inputClass} defaultValue="destino_only">
                      <option value="destino_only">Solo destino</option>
                      <option value="kml_full">Ruta completa (waypoints)</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Margen evidencia antes (min)
                    <input
                      name="evidenceMarginMinutesBefore"
                      type="number"
                      min={0}
                      defaultValue={60}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Cuándo empieza a observarse el GPS (ej. 60 → 5:45 si deadline 6:45).
                    </span>
                  </label>
                  <label className={labelClass}>
                    Duración máx. de ruta (min)
                    <input
                      name="maxRouteDurationMinutes"
                      type="number"
                      min={1}
                      defaultValue={60}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Margen evidencia después (min)
                    <input
                      name="evidenceMarginMinutesAfter"
                      type="number"
                      min={0}
                      defaultValue={30}
                      className={inputClass}
                    />
                  </label>
                  <label className="mt-6 flex items-center gap-2 text-sm">
                    <input type="checkbox" name="allowAlternateDestination" />
                    Permitir destino alterno
                  </label>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">Motivos excusables (opcional)</legend>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {EXCUSABLES.map((e) => (
                    <label key={e.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="excusableReasons" value={e.value} />
                      {e.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">Regla de enforcement (opcional)</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className={labelClass}>
                    Tipo
                    <select name="enforcementType" className={inputClass} defaultValue="">
                      <option value="">Ninguna</option>
                      <option value="no_pago_viaje">No pago del viaje</option>
                      <option value="rebate_escalonado">Rebate escalonado</option>
                      <option value="reembolso">Reembolso</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Tolerancia de la regla (min)
                    <input name="enforcementTolerance" type="number" min={1} defaultValue={5} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Reembolso: monto (opcional)
                    <input name="reembolsoAmount" type="number" min={0} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Rebate base (%)
                    <input name="baseRebatePercent" type="number" step="0.1" defaultValue={0} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Fallas para base
                    <input name="baseFailureCount" type="number" min={1} defaultValue={1} className={inputClass} />
                  </label>
                  <label className={labelClass}>
                    Rebate adicional (%)
                    <input
                      name="additionalRebatePercent"
                      type="number"
                      step="0.1"
                      defaultValue={0}
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Los campos de rebate/reembolso solo se usan según el tipo elegido.
                </p>
              </fieldset>

              <button type="submit" className={btnClass}>
                Crear contrato
              </button>
            </form>
          </Card>
        )}

        <Card title={`Contratos (${contracts.length})`}>
          {contracts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin contratos todavía.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {contracts.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/5 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {c.name}{" "}
                      <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                        {c.status}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.plantId
                        ? `Planta: ${plantById.get(c.plantId) ?? "—"}`
                        : c.plantGroupId
                          ? `Grupo: ${groupById.get(c.plantGroupId) ?? "—"}`
                          : "—"}{" "}
                      · Tolerancia {c.policy.toleranceMinutes} min · {c.policy.routeStrictness} ·{" "}
                      {c.profiles.length} perfil(es)
                    </p>
                  </div>
                  {c.status !== "active" ? (
                    <form action="/api/cliente/contratos" method="post">
                      <input type="hidden" name="clientSlug" value={client.slug} />
                      <input type="hidden" name="action" value="activate" />
                      <input type="hidden" name="contractId" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                      >
                        Activar
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
