import Link from "next/link";
import { getRepos } from "@/lib/db";
import { ConfirmForm } from "@/components/confirm-form";
import { UnitShell } from "@/components/unit-shell";
import {
  AvisoSistema,
  ChipEstado,
  Panel,
  botonPrimario,
  botonSecundario,
  campo,
  etiqueta,
} from "@/components/ui";
import { confirmMessages } from "@/lib/confirm-messages";
import { unitConfigStepHrefFor } from "@/lib/config-wizard";
import { unitContratosHref } from "@/lib/unit-routes";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";
import { operationalScopeFromContract } from "@jtel/domain";
import { localDateIso } from "@/lib/local-time";
import { todayIso, addDaysIso } from "@/lib/date-range";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

const DAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const DIA_CORTO = new Map(DAYS.map((d) => [d.value, d.label]));

/** Los días como se leen, no como se guardan: `[1, 2, 3]` no es un horario. */
function decirDias(dias: number[]): string {
  if (dias.length === 0) return "sin días";
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return orden
    .filter((d) => dias.includes(d))
    .map((d) => DIA_CORTO.get(d) ?? d)
    .join(" ");
}

const createdLabels: Record<string, string> = {
  perfil: "El servicio quedó creado. Ya puedes programar sus días.",
  perfil_actualizado:
    "Se actualizó el servicio. Aplica hacia adelante: los días ya sellados conservan lo que estaba vigente.",
  generado: "Quedaron programados los próximos 30 días.",
  generado_acotado:
    "Quedaron programados los días que caben dentro de la vigencia del contrato.",
  ya_existian: "Esos días ya estaban programados; no se duplicó ninguno.",
  eliminado: "Se eliminó el servicio.",
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

/** Cuántos días del servicio caen en [from, to] (inclusive). */
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

/** Cobertura de días programados dentro de la ventana rodante [hoy, hoy+30] ∩ vigencia.
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

  /*
   * Lo que falta, con el camino para resolverlo. Una lista de requisitos sin
   * enlace obliga al usuario a acordarse de en qué paso vivía cada cosa.
   */
  const faltantes: Array<{ que: string; href: string }> = [];
  if (!contracts.some((c) => c.status === "active" || c.status === "demo")) {
    faltantes.push({ que: "un contrato activo", href: unitContratosHref(unit, client.slug) });
  }
  if (routeShifts.length === 0) {
    faltantes.push({
      que: "una ruta con su turno",
      href: unitConfigStepHrefFor(unit, client.slug, "rutas"),
    });
  }
  if (geofences.length === 0) {
    faltantes.push({
      que: "una geocerca de destino",
      href: unitConfigStepHrefFor(unit, client.slug, "geocercas"),
    });
  }

  const avisoGuardado = created
    ? created.startsWith("geocerca_actualizada_")
      ? `La geocerca quedó aplicada a ${created.replace("geocerca_actualizada_", "")} servicios.`
      : created === "generado" || created === "generado_acotado"
        ? `${createdLabels[created]}${n ? ` ${n} días nuevos.` : ""}`
        : created === "ya_existian"
          ? `${createdLabels.ya_existian}${n ? ` ${n} días.` : ""}`
          : (createdLabels[created] ?? null)
    : null;

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Servicios — ${operationalUnitLabel(unit)}`}
      step="servicios"
    >
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        Un servicio junta lo demás y define{" "}
        <span className="text-[var(--texto)]">qué se verifica</span>: el contrato con el que se
        juzga, la ruta y su turno, la geocerca de llegada y los días que corre. De ahí sale cada día
        programado, y cada día programado recibe su propio resultado.
      </p>

      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
      {avisoGuardado ? <AvisoSistema lead="Guardado.">{avisoGuardado}</AvisoSistema> : null}

      {faltantes.length > 0 ? (
        <Panel
          titulo="Falta algo antes de poder crear un servicio"
          nota={`En ${operationalUnitLabel(activeUnit)} todavía no está en pie todo lo que se necesita.`}
        >
          <ul className="space-y-1.5 text-[13.5px]">
            {faltantes.map((f) => (
              <li key={f.href}>
                <span className="text-[var(--tenue)]">Falta </span>
                <Link href={f.href} className="text-[var(--azul)] hover:underline">
                  {f.que} →
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel titulo={`Nuevo servicio — ${operationalUnitLabel(activeUnit)}`}>
          <ConfirmForm
            action="/api/cliente/servicios"
            method="post"
            className="space-y-5"
            confirmMessage={confirmMessages.createProfile(operationalUnitLabel(activeUnit))}
            pendingLabel="Creando servicio…"
          >
            <input type="hidden" name="clientSlug" value={client.slug} />
            <input type="hidden" name="action" value="create" />
            {scopeHidden}

            <div className="grid gap-4 md:grid-cols-2">
              <label className={etiqueta}>
                Nombre del servicio
                <input name="name" required className={campo} placeholder="Cómo lo nombra la operación" />
              </label>
              <label className={etiqueta}>
                Código
                <input name="code" className={campo} placeholder="Opcional — si lo dejas vacío se genera del nombre" />
              </label>
              <label className={etiqueta}>
                Contrato con el que se juzga
                <select name="contractId" required className={campo} defaultValue="">
                  <option value="" disabled>
                    Elige contrato…
                  </option>
                  {contracts
                    .filter((c) => c.status === "active" || c.status === "demo")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ·{" "}
                        {c.carrier?.name ?? carrierById.get(c.carrierAccountId)?.name ?? "transportista"}
                      </option>
                    ))}
                </select>
              </label>
              <label className={etiqueta}>
                Ruta y turno
                <select name="routeShiftId" required className={campo} defaultValue="">
                  <option value="" disabled>
                    Elige combinación…
                  </option>
                  {routeShifts.map((rs) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"} · entra{" "}
                      {rs.shift?.startTime?.slice(0, 5) ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${etiqueta} md:col-span-2 md:max-w-md`}>
                Geocerca de llegada
                <select name="geofenceId" required className={campo} defaultValue="">
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

            <fieldset className="rounded border border-[var(--linea)] p-4">
              <legend
                className={`px-1 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}
              >
                Días que corre
              </legend>
              <div className="flex flex-wrap gap-4">
                {DAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 text-[13.5px]">
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

            <button type="submit" className={botonPrimario}>
              Crear servicio
            </button>
          </ConfirmForm>
        </Panel>
      )}

      <Panel titulo={`Servicios — ${operationalUnitLabel(activeUnit)} (${profiles.length})`}>
        {profiles.length === 0 ? (
          <p className="text-[13.5px] text-[var(--tenue)]">Sin servicios en esta unidad.</p>
        ) : (
          <>
            {unit.kind === "plant" && geofences.length > 0 ? (
              /*
               * Iba en ámbar, el color de `pendiente por evidencia`. Es una
               * herramienta de corrección, no el resultado de nada.
               */
              <div className="mb-5 rounded border border-[var(--linea)] bg-[var(--panel2)] p-4">
                <p className="mb-3 max-w-[74ch] text-[13px] text-[var(--tenue)]">
                  Si todos los servicios apuntan a la geocerca equivocada, elige la correcta y se
                  aplica a los {profiles.length} de un jalón.
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
                  <label className={`min-w-[220px] flex-1 ${etiqueta}`}>
                    Geocerca correcta
                    <select name="geofenceId" required className={campo} defaultValue="">
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
                  <button type="submit" className={botonSecundario}>
                    Aplicar a todos
                  </button>
                </ConfirmForm>
              </div>
            ) : null}
            <ul className="space-y-3">
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
                  <li key={p.id} className="rounded border border-[var(--linea-tenue)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-baseline gap-2.5">
                          <span className={`text-[11.5px] ${mono} text-[var(--acero)]`}>
                            {p.code}
                          </span>
                          <span className="text-[15px] font-medium text-[var(--texto)]">
                            {p.name}
                          </span>
                        </p>
                        <p className="mt-1 text-[12.5px] text-[var(--tenue)]">
                          {p.contract?.name ?? "—"} · {p.routeShift?.route?.name ?? "—"} ·{" "}
                          {p.routeShift?.shift?.name ?? "—"} · llega a {p.geofence?.name ?? "—"}
                        </p>
                        <p className={`mt-1 text-[12px] ${mono} text-[var(--tenue)]`}>
                          corre{" "}
                          <span className="text-[var(--acero)]">
                            {decirDias(p.activeDays ?? [])}
                          </span>
                          {contractFrom && contractTo ? (
                            <>
                              {" "}
                              · vigencia{" "}
                              <span className="text-[var(--acero)]">
                                {contractFrom} → {contractTo}
                              </span>
                            </>
                          ) : null}
                        </p>
                        {/*
                         * Cuántos días están programados NO es un veredicto: no
                         * hay ningún servicio verificado en este número. Iba en
                         * pastilla verde con una palomita, y sin días
                         * programados en pastilla ámbar — los colores de
                         * `cumplido` y de `pendiente por evidencia`.
                         */}
                        <p className="mt-2.5 flex flex-wrap items-center gap-2">
                          {/*
                           * El chip cuenta días, no ventanas. Decía "30 días
                           * programados" cuando la ventana quedaba cubierta,
                           * pero en una ventana de 30 días un servicio de lunes
                           * a viernes tiene 21 días — el número era correcto
                           * como ancho de ventana y falso como cuenta de lo
                           * programado. Se dice lo que se contó.
                           */}
                          <ChipEstado tono={hasOccurrences ? "acero" : "tenue"}>
                            {hasOccurrences
                              ? coversRolling
                                ? `${rolling.inWindowCount} día${rolling.inWindowCount === 1 ? "" : "s"} programado${rolling.inWindowCount === 1 ? "" : "s"}`
                                : `${rolling.inWindowCount} de ${rolling.expected} días`
                              : "sin días programados"}
                          </ChipEstado>
                          {hasOccurrences && rolling.covFrom && rolling.covTo ? (
                            <span className={`text-[11.5px] ${mono} text-[var(--tenue)]`}>
                              {rolling.covFrom} → {rolling.covTo}
                            </span>
                          ) : rolling.expected > 0 ? (
                            <span className={`text-[11.5px] ${mono} text-[var(--tenue)]`}>
                              faltan {rolling.expected} en los próximos {ROLLING_DAYS} días
                            </span>
                          ) : null}
                        </p>
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
                          <button type="submit" className={botonSecundario}>
                            Eliminar servicio
                          </button>
                        </ConfirmForm>
                      ) : null}
                    </div>
                    {coversRolling ? (
                      <p className="mt-3 max-w-[74ch] text-[12.5px] text-[var(--tenue)]">
                        Los próximos {ROLLING_DAYS} días ya están programados y el sistema renueva
                        la ventana solo. Programar de nuevo únicamente sirve para rellenar un hueco.
                      </p>
                    ) : (
                      <>
                        <ConfirmForm
                          action="/api/cliente/servicios"
                          method="post"
                          className="mt-3 flex flex-wrap items-end gap-3"
                          confirmTemplate={confirmMessages.generateOccurrencesTemplate(p.name)}
                          pendingLabel="Programando días…"
                        >
                          <input type="hidden" name="clientSlug" value={client.slug} />
                          <input type="hidden" name="action" value="generar" />
                          <input type="hidden" name="profileId" value={p.id} />
                          {scopeHidden}
                          <label className="text-[12px] text-[var(--tenue)]">
                            Desde
                            <input
                              name="fromDate"
                              type="date"
                              required
                              defaultValue={rolling.windowFrom}
                              min={contractFrom}
                              max={rolling.windowTo}
                              className={campo}
                            />
                          </label>
                          <label className="text-[12px] text-[var(--tenue)]">
                            Hasta
                            <input
                              name="toDate"
                              type="date"
                              required
                              defaultValue={rolling.windowTo}
                              min={rolling.windowFrom}
                              max={contractTo && contractTo < rolling.windowTo ? contractTo : rolling.windowTo}
                              className={campo}
                            />
                          </label>
                          <button type="submit" className={botonSecundario}>
                            {hasOccurrences ? "Completar los 30 días" : "Programar 30 días"}
                          </button>
                        </ConfirmForm>
                        <p className="mt-2 max-w-[74ch] text-[12px] text-[var(--tenue)]">
                          De hoy a {ROLLING_DAYS} días, sin pasar de la vigencia del contrato. A
                          partir de ahí el sistema renueva la ventana cada día.
                        </p>
                      </>
                    )}
                    <details className="mt-3 rounded border border-[var(--linea)] bg-[var(--panel2)] p-3">
                      <summary className="cursor-pointer text-[13px] font-medium text-[var(--azul)]">
                        Editar el servicio
                      </summary>
                      <ConfirmForm
                        action="/api/cliente/servicios"
                        method="post"
                        className="mt-4 space-y-4"
                        confirmMessage={confirmMessages.updateProfile(p.name)}
                        pendingLabel="Guardando…"
                      >
                        <input type="hidden" name="clientSlug" value={client.slug} />
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="profileId" value={p.id} />
                        {scopeHidden}
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className={etiqueta}>
                            Nombre del servicio
                            <input name="name" required className={campo} defaultValue={p.name} />
                          </label>
                          <label className={etiqueta}>
                            Código
                            <input name="code" className={campo} defaultValue={p.code ?? ""} />
                          </label>
                          <div className={etiqueta}>
                            Contrato con el que se juzga
                            <p className={`mt-1.5 text-[13px] ${mono} text-[var(--acero)]`}>
                              {p.contract?.name ?? "—"} ·{" "}
                              {(p.contract?.carrierAccountId
                                ? carrierById.get(p.contract.carrierAccountId)?.name
                                : null) ?? "transportista"}
                            </p>
                            <p className="mt-1.5 text-[12px] text-[var(--tenue)]">
                              No se cambia aquí: cambiar de contrato cambiaría las reglas con las
                              que ya se juzgaron días pasados.
                            </p>
                          </div>
                          <label className={etiqueta}>
                            Ruta y turno
                            <select
                              name="routeShiftId"
                              required
                              className={campo}
                              defaultValue={p.routeShiftId}
                            >
                              {routeShifts.map((rs) => (
                                <option key={rs.id} value={rs.id}>
                                  {rs.route?.name ?? "—"} · {rs.shift?.name ?? "—"} · entra{" "}
                                  {rs.shift?.startTime?.slice(0, 5) ?? "—"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={`${etiqueta} md:col-span-2 md:max-w-md`}>
                            Geocerca de llegada
                            <select
                              name="geofenceId"
                              required
                              className={campo}
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
                        <fieldset className="rounded border border-[var(--linea)] p-4">
                          <legend
                            className={`px-1 text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}
                          >
                            Días que corre
                          </legend>
                          <div className="flex flex-wrap gap-4">
                            {DAYS.map((d) => (
                              <label key={d.value} className="flex items-center gap-2 text-[13.5px]">
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
                        <button type="submit" className={botonSecundario}>
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
      </Panel>

      {activeUnit.kind === "plant_group" ? (
        <p className="max-w-[74ch] text-[12.5px] text-[var(--tenue)]">
          En un campus conviene la geocerca compartida de la entrada. Las geocercas por planta
          aparecen como excepción, si las configuraste.
        </p>
      ) : null}
    </UnitShell>
  );
}
