import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";
import { operationalScopeFromContract } from "@jtel/domain";

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
  eliminado: "Perfil eliminado.",
};

function geofenceOptionLabel(g: {
  name: string;
  role: string;
  ownerType: string;
}): string {
  const suffix =
    g.ownerType === "plant_group" ? " · campus" : g.role === "destino" ? "" : ` · ${g.role}`;
  return `${g.name}${suffix}`;
}

export async function ServiciosUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const n = typeof sp?.n === "string" ? sp.n : null;
  const { client, unit, scope } = ctx;

  const repos = getRepos();
  const activeUnit = unit;

  const [allContracts, allProfiles] = await Promise.all([
    repos.contracts.findForClient(client.id),
    repos.profiles.findForClient(client.id),
  ]);

  const [routeShifts, geofences, contracts] = await Promise.all([
    repos.routes.getRouteShiftsForScope(scope),
    repos.geofences.findForScope(scope, client.id),
    Promise.resolve(allContracts.filter((c) => contractMatchesScope(c, scope))),
  ]);

  const profiles = allProfiles.filter((p) => {
    const cs = operationalScopeFromContract(p.contract ?? {});
    return cs && contractMatchesScope(p.contract ?? {}, scope);
  });

  const profilesWithOccurrences = await repos.profiles.profileIdsWithOccurrences(
    profiles.map((p) => p.id),
  );

  const carrierById = new Map(
    allContracts
      .map((c) => c.carrier)
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => [c.id, c] as const),
  );

  const carrierIds = [...new Set(contracts.map((c) => c.carrierAccountId))];
  const unitsByCarrier = await Promise.all(
    carrierIds.map(async (id) => ({
      carrier: carrierById.get(id) ?? null,
      units: await repos.fleet.getUnitsForCarrier(id),
    })),
  );

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const missing: string[] = [];
  if (contracts.length === 0) missing.push("un contrato activo o borrador");
  if (routeShifts.length === 0) missing.push("ruta + turno programados");
  if (geofences.length === 0) missing.push("geocerca de destino");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell
          client={client}
          unit={unit}
          title={`Perfiles de servicio — ${operationalUnitLabel(unit)}`}
          step="servicios"
        />

        <p className="text-sm text-[var(--muted)]">
          El perfil junta <span className="text-white">contrato + ruta/turno + geocerca + unidades</span>{" "}
          dentro de la misma unidad operativa. En campus, la geocerca habitual es la de llegada al
          parque; también puedes usar geocercas por planta como excepción.
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
              Para crear un perfil en <span className="text-white">{operationalUnitLabel(activeUnit)}</span>{" "}
              necesitas: {missing.join(", ")}.
            </p>
          </Card>
        ) : (
          <Card title={`Nuevo perfil — ${operationalUnitLabel(activeUnit)}`}>
            <ConfirmForm
              action="/api/cliente/servicios"
              method="post"
              className="space-y-4"
              confirmMessage={confirmMessages.createProfile(operationalUnitLabel(activeUnit))}
            >
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="create" />
              {scopeHidden}

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
                        {c.name} · {c.carrier?.name ?? carrierById.get(c.carrierAccountId)?.name ?? "carrier"} · {c.status}
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
                        {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"} · inicio{" "}
                        {rs.shift?.startTime?.slice(0, 5) ?? "—"}
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
                        {geofenceOptionLabel(g)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Unidad de referencia (opcional)
                  <select name="referenceUnitId" className={inputClass} defaultValue="">
                    <option value="">—</option>
                    {unitsByCarrier.flatMap((c) =>
                      c.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                          {u.plateNumber ? ` · ${u.plateNumber}` : ""}
                          {c.carrier ? ` (${c.carrier.name})` : ""}
                        </option>
                      )),
                    )}
                  </select>
                </label>
              </div>

              <fieldset className="rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-sm text-[var(--muted)]">
                  Unidades posibles (del carrier del contrato)
                </legend>
                {unitsByCarrier.every((c) => c.units.length === 0) ? (
                  <p className="text-sm text-[var(--muted)]">
                    El carrier del contrato no tiene unidades registradas.
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
            </ConfirmForm>
          </Card>
        )}

        <Card title={`Perfiles — ${operationalUnitLabel(activeUnit)} (${profiles.length})`}>
          {profiles.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin perfiles para esta unidad.</p>
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
                    {!profilesWithOccurrences.has(p.id) ? (
                      <ConfirmForm
                        action="/api/cliente/servicios"
                        method="post"
                        confirmMessage={confirmMessages.deleteProfile(p.name)}
                      >
                        <input type="hidden" name="clientSlug" value={client.slug} />
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="profileId" value={p.id} />
                        {scopeHidden}
                        <button
                          type="submit"
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 hover:border-red-400"
                        >
                          Eliminar perfil
                        </button>
                      </ConfirmForm>
                    ) : null}
                  </div>
                  <ConfirmForm
                    action="/api/cliente/servicios"
                    method="post"
                    className="mt-3 flex flex-wrap items-end gap-2"
                    confirmTemplate={confirmMessages.generateOccurrencesTemplate(p.name)}
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="action" value="generar" />
                    <input type="hidden" name="profileId" value={p.id} />
                    {scopeHidden}
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
                  </ConfirmForm>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {activeUnit.kind === "plant_group" ? (
          <p className="text-xs text-[var(--muted)]">
            En campus, prioriza la geocerca de entrada compartida. Las geocercas por planta aparecen
            como excepción si las configuraste en Geocercas.
          </p>
        ) : null}
      </div>
    </main>
  );
}
