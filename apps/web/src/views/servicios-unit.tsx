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
import { localDateIso } from "@/lib/local-time";
import { todayIso, addDaysIso } from "@/lib/date-range";

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
  perfil_actualizado:
    "Perfil actualizado. Los cambios aplican hacia adelante (verificación y monitoreo leen la geocerca actual del perfil).",
  generado: "Ocurrencias generadas (ventana de 30 días).",
  generado_acotado: "Ocurrencias generadas (rango acotado a 30 días / vigencia del contrato).",
  ya_existian: "Esas fechas ya tenían ocurrencias; no se crearon duplicados.",
  eliminado: "Perfil eliminado.",
};

const ROLLING_DAYS = 30;

function asIsoDate(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localDateIso(value);
  }
  return String(value).slice(0, 10);
}

/** Cuántos días del perfil caen en [from, to] (inclusive). */
function expectedOccurrenceCount(
  fromIso: string,
  toIso: string,
  activeDays: number[],
): number {
  const days = activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5];
  let n = 0;
  const current = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime()) || current > end) {
    return 0;
  }
  while (current <= end) {
    if (days.includes(current.getDay())) n += 1;
    current.setDate(current.getDate() + 1);
  }
  return n;
}

/** Cobertura de ocurrencias dentro de la ventana rodante [hoy, hoy+30] ∩ vigencia.
 * `coverage` debe venir ya filtrado a esa ventana. */
function rollingWindowCoverage(
  coverage: { count: number; fromDate: string; toDate: string } | undefined,
  contractFrom: string | undefined,
  contractTo: string | undefined,
  activeDays: number[],
) {
  const today = todayIso();
  let windowFrom = today;
  let windowTo = addDaysIso(today, ROLLING_DAYS);
  if (contractFrom && contractFrom > windowFrom) windowFrom = contractFrom;
  if (contractTo && contractTo < windowTo) windowTo = contractTo;

  const expected =
    windowFrom <= windowTo
      ? expectedOccurrenceCount(windowFrom, windowTo, activeDays)
      : 0;

  if (!coverage || coverage.count === 0) {
    return {
      windowFrom,
      windowTo,
      expected,
      inWindowCount: 0,
      coversRolling: false,
      hasAny: false,
      covFrom: undefined as string | undefined,
      covTo: undefined as string | undefined,
    };
  }

  const covFrom = asIsoDate(coverage.fromDate);
  const covTo = asIsoDate(coverage.toDate);
  // Con coverage ya filtrado a la ventana, basta el conteo vs esperado.
  const coversRolling = expected > 0 && coverage.count >= expected;

  return {
    windowFrom,
    windowTo,
    expected,
    inWindowCount: coverage.count,
    coversRolling,
    hasAny: true,
    covFrom,
    covTo,
  };
}

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

  const today = todayIso();
  const rollingTo = addDaysIso(today, ROLLING_DAYS);
  const occurrenceCoverage = await repos.profiles.occurrenceCoverageByProfile(
    profiles.map((p) => p.id),
    { fromDate: today, toDate: rollingTo },
  );

  const carrierById = new Map(
    allContracts
      .map((c) => c.carrier)
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => [c.id, c] as const),
  );

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const missing: string[] = [];
  if (!contracts.some((c) => c.status === "active" || c.status === "demo")) {
    missing.push("un contrato activo");
  }
  if (routeShifts.length === 0) missing.push("ruta + turno programados");
  if (geofences.length === 0) missing.push("geocerca de destino");

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Perfiles de servicio — ${operationalUnitLabel(unit)}`}
      step="servicios"
    >
      <p className="text-sm text-[var(--muted)]">
        El perfil define <span className="text-white">qué</span> se verifica:{" "}
        <span className="text-white">contrato + ruta/turno + geocerca + días</span>. Las
        ocurrencias se mantienen en una <span className="text-white">ventana de 30 días</span>{" "}
        (renovación automática diaria). Generar es solo el primer arranque o para rellenar huecos.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {created ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {created.startsWith("geocerca_actualizada_")
            ? `Geocerca aplicada a ${created.replace("geocerca_actualizada_", "")} perfiles. Ya puedes eliminar la geocerca que no uses.`
            : created === "generado" || created === "generado_acotado"
              ? `${createdLabels[created]} ${n ? `(${n} nuevas)` : ""}`
              : created === "ya_existian"
                ? `${createdLabels.ya_existian}${n ? ` (${n} días)` : ""}`
                : (createdLabels[created] ?? "Guardado.")}
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
            pendingLabel="Creando perfil…"
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
                Código (opcional)
                <input
                  name="code"
                  className={inputClass}
                  placeholder="Ej. CSD-PON-I — si lo dejas vacío se genera del nombre"
                />
              </label>
              <label className={labelClass}>
                Contrato
                <select name="contractId" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elige contrato…
                  </option>
                  {contracts
                    .filter((c) => c.status === "active" || c.status === "demo")
                    .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.carrier?.name ?? carrierById.get(c.carrierAccountId)?.name ?? "carrier"}
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
            </div>

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
          <>
            {unit.kind === "plant" && geofences.length > 0 ? (
              <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                <p className="mb-3 text-sm text-amber-100">
                  ¿Todos los perfiles apuntan a la geocerca equivocada? Corrige de un jalón:
                  elige la buena y se aplica a los {profiles.length} perfiles.
                </p>
                <ConfirmForm
                  action="/api/cliente/servicios"
                  method="post"
                  className="flex flex-wrap items-end gap-3"
                  confirmMessage={confirmMessages.bulkSetGeofence(operationalUnitLabel(unit))}
                  pendingLabel="Aplicando geocerca…"
                >
                  <input type="hidden" name="clientSlug" value={client.slug} />
                  <input type="hidden" name="action" value="bulk_geofence" />
                  {scopeHidden}
                  <label className="min-w-[220px] flex-1 text-sm">
                    Geocerca correcta
                    <select name="geofenceId" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Elige una geocerca…
                      </option>
                      {geofences.map((g) => (
                        <option key={g.id} value={g.id}>
                          {geofenceOptionLabel(g)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={btnClass}>
                    Aplicar a todos los perfiles
                  </button>
                </ConfirmForm>
              </div>
            ) : null}
            <ul className="space-y-3 text-sm">
            {profiles.map((p) => {
              const contractFrom = asIsoDate(p.contract?.validFrom);
              const contractTo = asIsoDate(p.contract?.validTo);
              const coverage = occurrenceCoverage.get(p.id);
              const rolling = rollingWindowCoverage(
                coverage,
                contractFrom,
                contractTo,
                p.activeDays ?? [1, 2, 3, 4, 5],
              );
              const hasOccurrences = rolling.hasAny;
              const coversRolling = rolling.coversRolling;

              return (
              <li key={p.id} className="rounded border border-white/5 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-xs text-[var(--accent)]">{p.code}</span>
                      {p.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.contract?.name ?? "—"} · {p.routeShift?.route?.name ?? "—"} ·{" "}
                      {p.routeShift?.shift?.name ?? "—"} · destino {p.geofence?.name ?? "—"} · días [
                      {(p.activeDays ?? []).join(", ")}]
                      {contractFrom && contractTo
                        ? ` · vigencia ${contractFrom} → ${contractTo}`
                        : ""}
                    </p>
                    {hasOccurrences ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                        <span aria-hidden>✓</span>
                        {coversRolling
                          ? `30 días cubiertos: ${rolling.inWindowCount} ocurrencias (${rolling.covFrom} → ${rolling.covTo})`
                          : `Parcial: ${rolling.inWindowCount} de ~${rolling.expected} en ventana 30d (${rolling.covFrom} → ${rolling.covTo})`}
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-200">
                        Sin ocurrencias — genera los próximos 30 días
                        {rolling.expected > 0 ? ` (~${rolling.expected})` : ""}
                      </p>
                    )}
                  </div>
                  {!hasOccurrences ? (
                    <ConfirmForm
                      action="/api/cliente/servicios"
                      method="post"
                      confirmMessage={confirmMessages.deleteProfile(p.name)}
                      pendingLabel="Eliminando…"
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
                {coversRolling ? (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Ventana de 30 días cubierta. El cron diario la renueva; no hace falta generar
                    de nuevo salvo que falte un hueco.
                  </p>
                ) : (
                  <>
                    <ConfirmForm
                      action="/api/cliente/servicios"
                      method="post"
                      className="mt-3 flex flex-wrap items-end gap-2"
                      confirmTemplate={confirmMessages.generateOccurrencesTemplate(p.name)}
                      pendingLabel="Generando ocurrencias…"
                    >
                      <input type="hidden" name="clientSlug" value={client.slug} />
                      <input type="hidden" name="action" value="generar" />
                      <input type="hidden" name="profileId" value={p.id} />
                      {scopeHidden}
                      <label className="text-xs">
                        Desde
                        <input
                          name="fromDate"
                          type="date"
                          required
                          defaultValue={rolling.windowFrom}
                          min={contractFrom}
                          max={rolling.windowTo}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-xs">
                        Hasta
                        <input
                          name="toDate"
                          type="date"
                          required
                          defaultValue={rolling.windowTo}
                          min={rolling.windowFrom}
                          max={contractTo && contractTo < rolling.windowTo ? contractTo : rolling.windowTo}
                          className={inputClass}
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-[var(--accent)]"
                      >
                        {hasOccurrences ? "Completar 30 días" : "Generar 30 días"}
                      </button>
                    </ConfirmForm>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Por defecto: hoy → +{ROLLING_DAYS} días (techo: vigencia del contrato). El
                      sistema renueva esta ventana cada día.
                    </p>
                  </>
                )}
                <details className="mt-3 rounded-lg border border-[var(--accent)]/40 bg-black/20 p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-[var(--accent)]">
                    ▸ Editar perfil / cambiar geocerca
                  </summary>
                  <ConfirmForm
                    action="/api/cliente/servicios"
                    method="post"
                    className="mt-3 space-y-3"
                    confirmMessage={confirmMessages.updateProfile(p.name)}
                    pendingLabel="Guardando…"
                  >
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="profileId" value={p.id} />
                    {scopeHidden}
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className={labelClass}>
                        Nombre del perfil
                        <input
                          name="name"
                          required
                          className={inputClass}
                          defaultValue={p.name}
                        />
                      </label>
                      <label className={labelClass}>
                        Código
                        <input name="code" className={inputClass} defaultValue={p.code ?? ""} />
                      </label>
                      <div className={labelClass}>
                        Contrato
                        <p className={`${inputClass} text-[var(--muted)]`}>
                          {p.contract?.name ?? "—"} ·{" "}
                          {(p.contract?.carrierAccountId
                            ? carrierById.get(p.contract.carrierAccountId)?.name
                            : null) ?? "carrier"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          El contrato no se puede cambiar aquí.
                        </p>
                      </div>
                      <label className={labelClass}>
                        Ruta + turno
                        <select
                          name="routeShiftId"
                          required
                          className={inputClass}
                          defaultValue={p.routeShiftId}
                        >
                          {routeShifts.map((rs) => (
                            <option key={rs.id} value={rs.id}>
                              {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"} · inicio{" "}
                              {rs.shift?.startTime?.slice(0, 5) ?? "—"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={`${labelClass} md:col-span-2`}>
                        Geocerca de destino
                        <select
                          name="geofenceId"
                          required
                          className={inputClass}
                          defaultValue={p.geofenceId}
                        >
                          {geofences.map((g) => (
                            <option key={g.id} value={g.id}>
                              {geofenceOptionLabel(g)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <fieldset className="rounded-lg border border-white/10 p-3">
                      <legend className="px-1 text-sm text-[var(--muted)]">Días activos</legend>
                      <div className="flex flex-wrap gap-3">
                        {DAYS.map((d) => (
                          <label key={d.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="activeDays"
                              value={d.value}
                              defaultChecked={(p.activeDays ?? [1, 2, 3, 4, 5]).includes(d.value)}
                            />
                            {d.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      type="submit"
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-[var(--accent)]"
                    >
                      Guardar cambios
                    </button>
                  </ConfirmForm>
                </details>
              </li>
            );
            })}
          </ul>
          </>
        )}
      </Card>

      {activeUnit.kind === "plant_group" ? (
        <p className="text-xs text-[var(--muted)]">
          En campus, prioriza la geocerca de entrada compartida. Las geocercas por planta aparecen
          como excepción si las configuraste en Geocercas.
        </p>
      ) : null}
    </UnitShell>
  );
}
