import { getRepos } from "@/lib/db";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

export async function GeocercasUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const { client, unit } = ctx;

  const repos = getRepos();

  const allGeofences = await repos.geofences.findForClient(client.id);

  const ownerRef =
    unit.kind === "plant_group"
      ? (`plant_group:${unit.id}` as const)
      : (`plant:${unit.id}` as const);

  const unitLabel =
    unit.kind === "plant_group"
      ? `Campus: ${operationalUnitLabel(unit)}`
      : `${unit.name} (${unit.code})`;

  const unitGeofences = allGeofences.filter((g) => {
    if (unit.kind === "plant_group") {
      return g.ownerType === "plant_group" && g.ownerPlantGroupId === unit.id;
    }
    return g.ownerPlantId === unit.id;
  });

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell
          client={client}
          unit={unit}
          title={`Geocercas — ${operationalUnitLabel(unit)}`}
          step="geocercas"
        />

        <p className="text-sm text-[var(--muted)]">
          La geocerca marca <span className="text-white">dónde debe llegar</span> la unidad en{" "}
          <span className="text-white">{operationalUnitLabel(unit)}</span>.
          {unit.kind === "plant_group"
            ? " En un campus compartido suele haber una geocerca de llegada común en la entrada."
            : null}
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

        <Card title={`Nueva geocerca — ${operationalUnitLabel(unit)}`}>
          <form action="/api/cliente/geocercas" method="post" className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="clientSlug" value={client.slug} />
            <input type="hidden" name="ownerRef" value={ownerRef} />
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
                Pertenece a: <span className="text-white">{unitLabel}</span>
              </p>
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

        <Card title={`Geocercas — ${operationalUnitLabel(unit)} (${unitGeofences.length})`}>
          {unitGeofences.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aún no hay geocercas para esta unidad. Crea la primera arriba.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {unitGeofences.map((g) => (
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
          )}
        </Card>
      </div>
    </main>
  );
}
