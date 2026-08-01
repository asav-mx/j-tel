import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import { inferCircleFromPolygon } from "@/lib/geo";
import type { UnitPageContext } from "@/lib/unit-context";
import { operationalUnitLabel } from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-[var(--linea)] bg-black/20 p-2 text-sm placeholder:text-[var(--tenue)]";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const createdLabels: Record<string, string> = {
  geocerca: "Geocerca creada. Ya aparece en la lista.",
  geocerca_actualizada: "Geocerca actualizada.",
  geocerca_eliminada: "Geocerca eliminada.",
};

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
    <UnitShell
      client={client}
      unit={unit}
      title={`Geocercas — ${operationalUnitLabel(unit)}`}
      step="geocercas"
    >
      <p className="text-sm text-[var(--muted)]">
        La geocerca marca <span className="text-[var(--texto)]">dónde debe llegar</span> la unidad en{" "}
        <span className="text-[var(--texto)]">{operationalUnitLabel(unit)}</span>.
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
          {createdLabels[created] ?? "Guardado."}
        </div>
      ) : null}

      <Card title={`Nueva geocerca — ${operationalUnitLabel(unit)}`}>
        <form action="/api/cliente/geocercas" method="post" className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="clientSlug" value={client.slug} />
          <input type="hidden" name="ownerRef" value={ownerRef} />
          <input type="hidden" name="action" value="create" />
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
              Pertenece a: <span className="text-[var(--texto)]">{unitLabel}</span>
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
          <ul className="space-y-4 text-sm">
            {unitGeofences.map((g) => {
              const circle = inferCircleFromPolygon(g.polygon);
              return (
                <li
                  key={g.id}
                  className="rounded-lg border border-[var(--linea)] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {g.role} · {g.polygon.length} vértices
                      {g.ownerType === "plant_group" ? " · campus" : ""}
                    </span>
                  </div>
                  <ConfirmForm
                    action="/api/cliente/geocercas"
                    method="post"
                    confirmMessage={confirmMessages.updateGeofence(g.name)}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="ownerRef" value={ownerRef} />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="geofenceId" value={g.id} />
                    <label className={labelClass}>
                      Tipo
                      <select name="role" className={inputClass} defaultValue={g.role}>
                        <option value="destino">Destino (llegada)</option>
                        <option value="base">Base</option>
                        <option value="caseta">Caseta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      Nombre
                      <input name="name" required className={inputClass} defaultValue={g.name} />
                    </label>
                    <label className={labelClass}>
                      Radio (metros)
                      <input
                        name="radiusMeters"
                        required
                        className={inputClass}
                        defaultValue={circle?.radiusMeters ?? 150}
                        inputMode="decimal"
                      />
                    </label>
                    <label className={labelClass}>
                      Latitud
                      <input
                        name="lat"
                        required
                        className={inputClass}
                        defaultValue={circle?.lat ?? ""}
                        inputMode="decimal"
                      />
                    </label>
                    <label className={labelClass}>
                      Longitud
                      <input
                        name="lng"
                        required
                        className={inputClass}
                        defaultValue={circle?.lng ?? ""}
                        inputMode="decimal"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <button type="submit" className={btnClass}>
                        Guardar cambios
                      </button>
                    </div>
                  </ConfirmForm>
                  <div className="mt-2">
                    <ConfirmForm
                      action="/api/cliente/geocercas"
                      method="post"
                      confirmMessage={confirmMessages.deleteGeofence(g.name)}
                      className="inline"
                    >
                      <input type="hidden" name="clientSlug" value={client.slug} />
                      <input type="hidden" name="ownerRef" value={ownerRef} />
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="geofenceId" value={g.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-200 hover:border-red-400"
                      >
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </UnitShell>
  );
}
