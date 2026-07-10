import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  findOperationalUnit,
  operationalUnitLabel,
} from "@/lib/operational-scope";
import { operationalScopeFromContract } from "@jtel/domain";

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
  eliminado: "Borrador eliminado.",
};

function contractScopeLabel(
  c: { plantId?: string | null; plantGroupId?: string | null },
  units: Awaited<ReturnType<ReturnType<typeof getRepos>["clients"]["getOperationalUnits"]>>,
): string {
  const scope = operationalScopeFromContract(c);
  if (!scope) return "—";
  const unit = findOperationalUnit(units, scope);
  if (!unit) return "—";
  return unit.kind === "plant_group" ? `Campus: ${operationalUnitLabel(unit)}` : operationalUnitLabel(unit);
}

export async function ContratosUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;
  const created = typeof sp?.created === "string" ? sp.created : null;
  const { client, unit, scope } = ctx;

  const repos = getRepos();

  const [authorizedCarriers, operationalUnits, contracts] = await Promise.all([
    repos.commercial.getAuthorizedCarriersForClient(client.id),
    repos.clients.getOperationalUnits(client.id),
    repos.contracts.findForClient(client.id),
  ]);

  const activeUnit = unit;
  const scopedContracts = contracts.filter((c) => contractMatchesScope(c, scope));

  const scopeHidden =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const openByCarrier = new Map(
    scopedContracts
      .filter((c) => c.status !== "suspended")
      .map((c) => [c.carrierAccountId, c] as const),
  );
  const allCarriersHaveOpenContract =
    authorizedCarriers.length > 0 &&
    authorizedCarriers.every((c) => openByCarrier.has(c.id));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell
          client={client}
          unit={unit}
          title={`Contratos — ${operationalUnitLabel(unit)}`}
        />

        <p className="text-sm text-[var(--muted)]">
          El contrato define la <span className="text-white">política</span> entre este cliente y un
          carrier para <span className="text-white">{operationalUnitLabel(unit)}</span>. Desde ahí se
          calculan deadline, ventana GPS y reglas de cumplimiento para los perfiles de servicio.
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

        {authorizedCarriers.length === 0 ? (
          <Card title="Sin carriers autorizados">
            <p className="text-sm text-[var(--muted)]">
              Este cliente aún no tiene carriers autorizados por J-Staff. Solicita a JTEL que
              autorice al carrier correcto antes de crear contratos.
            </p>
          </Card>
        ) : allCarriersHaveOpenContract ? (
          <Card title={`Contrato existente — ${operationalUnitLabel(activeUnit)}`}>
            <p className="text-sm text-[var(--muted)]">
              Ya hay un contrato en borrador o activo para cada carrier autorizado en esta unidad.
              Activa el borrador que quieras usar o elimina los duplicados de abajo.
            </p>
          </Card>
        ) : (
          <Card title={`Nuevo contrato — ${operationalUnitLabel(activeUnit)}`}>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Solo puede existir un contrato (borrador o activo) por carrier y unidad operativa.
            </p>
            <ConfirmForm
              action="/api/cliente/contratos"
              method="post"
              className="space-y-4"
              confirmMessage={confirmMessages.createContract(operationalUnitLabel(activeUnit))}
            >
              <input type="hidden" name="clientSlug" value={client.slug} />
              <input type="hidden" name="action" value="create" />
              {scopeHidden}

              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass}>
                  Nombre del contrato
                  <input name="name" required className={inputClass} placeholder="Ej. Transporte Personal 2026" />
                </label>
                  <label className={labelClass}>
                    Carrier autorizado
                    <select name="carrierAccountId" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Elige carrier…
                      </option>
                    {authorizedCarriers.map((c) => {
                      const taken = openByCarrier.has(c.id);
                      return (
                        <option key={c.id} value={c.id} disabled={taken}>
                          {c.name}
                          {taken ? " (ya tiene contrato)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

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
              </fieldset>

              <button type="submit" className={btnClass}>
                Crear contrato
              </button>
            </ConfirmForm>
          </Card>
        )}

        <Card title={`Contratos — ${operationalUnitLabel(activeUnit)} (${scopedContracts.length})`}>
          {scopedContracts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin contratos para esta unidad.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scopedContracts.map((c) => (
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
                      {c.carrier?.name ?? "—"} · {contractScopeLabel(c, operationalUnits)} ·
                      Tolerancia {c.policy.toleranceMinutes} min · anticipación{" "}
                      {c.policy.arrivalAnticipationMinutes ?? 15} min · {c.policy.routeStrictness} ·{" "}
                      {c.profiles.length} perfil(es)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status !== "active" ? (
                      <ConfirmForm
                        action="/api/cliente/contratos"
                        method="post"
                        confirmMessage={confirmMessages.activateContract(c.name)}
                      >
                        <input type="hidden" name="clientSlug" value={client.slug} />
                        <input type="hidden" name="action" value="activate" />
                        <input type="hidden" name="contractId" value={c.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                        >
                          Activar
                        </button>
                      </ConfirmForm>
                    ) : null}
                    {c.status === "draft" && c.profiles.length === 0 ? (
                      <ConfirmForm
                        action="/api/cliente/contratos"
                        method="post"
                        confirmMessage={confirmMessages.deleteContractDraft(c.name)}
                      >
                        <input type="hidden" name="clientSlug" value={client.slug} />
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="contractId" value={c.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 hover:border-red-400"
                        >
                          Eliminar borrador
                        </button>
                      </ConfirmForm>
                    ) : null}
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
