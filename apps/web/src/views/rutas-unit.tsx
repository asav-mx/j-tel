import Link from "next/link";
import { getRepos } from "@/lib/db";
import { UnitShell } from "@/components/unit-shell";
import {
  AvisoSistema,
  ChipEstado,
  Panel,
  botonPrimario,
  campo,
  etiqueta,
} from "@/components/ui";
import { RouteShiftList, RouteShiftSelect } from "@/components/route-shift-list";
import { confirmMessages } from "@/lib/confirm-messages";
import { unitConfigStepHrefFor } from "@/lib/config-wizard";
import { unitContratosHref } from "@/lib/unit-routes";
import { computeExpectedDeadline, localTimeHHMM, JTTEL_TZ } from "@jtel/domain";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const mono = "font-[family-name:var(--fuente-mono)]";

const createdLabels: Record<string, string> = {
  ruta: "La ruta quedó creada con su turno y su trazado. Ya se puede usar en un servicio.",
  kml: "Se guardó una nueva versión del trazado.",
  ruta_actualizada: "Se actualizó la ruta.",
  ruta_eliminada: "Se eliminó la ruta.",
  variante_creada: "Se creó la variante.",
  variante_actualizada: "Se actualizó el estado de la variante.",
};

function fmtTime(t: string) {
  return t.slice(0, 5);
}

export async function RutasUnitView({
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
  const activeUnit = unit;

  const allContracts = await repos.contracts.findForClient(client.id);
  const contracts = allContracts.filter((c) => contractMatchesScope(c, scope));

  /*
   * De qué contrato salen estos números.
   *
   * El panel se titulaba "desde contrato activo" pero leía `contracts[0]` — el
   * primero del alcance, activo o no. Con un borrador de por medio la pantalla
   * mostraba números de un contrato que no está juzgando nada y los presentaba
   * como los vigentes. Ahora se prefiere el activo y se dice cuál es.
   */
  const contratoDeReferencia =
    contracts.find((c) => c.status === "active") ?? contracts[0] ?? null;
  const samplePolicy = contratoDeReferencia?.policy;
  const vigente = contratoDeReferencia?.status === "active";
  const anticipation = samplePolicy?.arrivalAnticipationMinutes ?? 15;
  const evidenceBefore = samplePolicy?.evidenceMarginMinutesBefore ?? 60;

  const [shifts, routeShifts] = await Promise.all([
    repos.routes.getShiftsForScope(scope),
    repos.routes.getRouteShiftsForScope(scope),
  ]);

  const scopeHiddenFields =
    scope.kind === "plant" ? (
      <input type="hidden" name="plantId" value={scope.plantId} />
    ) : (
      <input type="hidden" name="plantGroupId" value={scope.plantGroupId} />
    );

  const unitLabel = operationalUnitLabel(activeUnit);
  const isCampus = activeUnit.kind === "plant_group";
  const turnosHref = unitConfigStepHrefFor(unit, client.slug, "turnos");
  const contratoHref = unitContratosHref(unit, client.slug);

  // Cargar variantes para cada ruta (deduplicar por routeId).
  const seenRouteIds = new Set<string>();
  const variantsByRoute = new Map<string, Array<{ id: string; name: string; status: string; kmlVersions: Array<{ id: string }> }>>();
  for (const rs of routeShifts) {
    const rid = rs.route?.id;
    if (!rid || seenRouteIds.has(rid)) continue;
    seenRouteIds.add(rid);
    const variants = await repos.routes.getVariantsForRoute(rid);
    variantsByRoute.set(rid, variants);
  }

  const routeRows = routeShifts.map((rs) => {
    const shiftStart = rs.shift?.startTime ?? "07:00:00";
    // Vista previa de la hora de corte. Zona explícita en el cálculo y en el
    // formato: getHours() leía el reloj del servidor.
    const deadline = computeExpectedDeadline("2026-01-01", shiftStart, anticipation, JTTEL_TZ);
    const dl = localTimeHHMM(deadline, JTTEL_TZ);
    const kmlCount = rs.route?.kmlVersions?.length ?? 0;
    const variants = variantsByRoute.get(rs.route?.id ?? "") ?? [];
    return {
      id: rs.id,
      routeId: rs.route?.id ?? "",
      routeName: rs.route?.name ?? "—",
      shiftId: rs.shift?.id ?? "",
      shiftName: rs.shift?.name ?? "—",
      shiftStart: fmtTime(shiftStart),
      kmlCount,
      variants,
      /*
       * Sin "~": la hora límite es una resta exacta sobre la hora del turno, no
       * una estimación. Un número con tilde se lee como opinión, y de las
       * opiniones se discuten los resultados.
       */
      meta: `entra ${fmtTime(shiftStart)} · hora límite ${dl} · ${variants.length} variante${variants.length === 1 ? "" : "s"} · ${kmlCount} versión${kmlCount === 1 ? "" : "es"}`,
      deleteMessage: confirmMessages.deleteRoute(
        rs.route?.name ?? "—",
        `${rs.shift?.name ?? "—"} · entra ${fmtTime(shiftStart)}`,
      ),
    };
  });

  // Agrupar por turno para el catálogo de variantes.
  const shiftGroups = new Map<
    string,
    { shiftName: string; shiftStart: string; routes: typeof routeRows }
  >();
  for (const row of routeRows) {
    if (!shiftGroups.has(row.shiftId)) {
      shiftGroups.set(row.shiftId, {
        shiftName: row.shiftName,
        shiftStart: row.shiftStart,
        routes: [],
      });
    }
    shiftGroups.get(row.shiftId)!.routes.push(row);
  }

  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
  }));

  const totalVariantes = routeRows.reduce((n, r) => n + r.variants.length, 0);
  const totalActivas = routeRows.reduce(
    (n, r) => n + r.variants.filter((v) => v.status === "activa").length,
    0,
  );

  return (
    <UnitShell
      client={client}
      unit={unit}
      title={`Rutas — ${operationalUnitLabel(unit)}`}
      step="rutas"
    >
      <p className="max-w-[76ch] text-[13.5px] text-[var(--tenue)]">
        Una ruta es un <span className="text-[var(--texto)]">turno junto con su trazado</span> en{" "}
        <span className="text-[var(--texto)]">{operationalUnitLabel(unit)}</span>. El mismo recorrido
        a dos horas distintas son dos rutas distintas, porque se juzgan contra horas límite
        distintas. Los turnos se registran en{" "}
        <Link href={turnosHref} className="text-[var(--azul)]">
          Turnos
        </Link>
        .
      </p>

      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}
      {created ? (
        <AvisoSistema lead="Guardado.">{createdLabels[created] ?? null}</AvisoSistema>
      ) : null}

      {isCampus && activeUnit.kind === "plant_group" ? (
        <Panel titulo="Campus compartido">
          <p className="max-w-[74ch] text-[13.5px] text-[var(--tenue)]">
            Plantas en este campus:{" "}
            <span className="text-[var(--texto)]">
              {activeUnit.memberPlants.map((p) => `${p.name} (${p.code})`).join(" · ") ||
                "ninguna asignada"}
            </span>
            . Las rutas aplican a todas; la geocerca de llegada suele ser una sola en la entrada del
            campus.
          </p>
        </Panel>
      ) : null}

      {samplePolicy ? (
        <Panel
          titulo="Con qué ventana se mira cada ruta"
          nota={
            <>
              Del contrato{" "}
              <span className="text-[var(--texto)]">{contratoDeReferencia?.name}</span>
              {vigente ? ", vigente." : " — que todavía está en borrador y no está juzgando nada."}
            </>
          }
        >
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className={`text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
                Hora límite
              </dt>
              <dd className={`mt-1 text-[13px] ${mono} text-[var(--acero)]`}>
                {anticipation} min antes del turno
              </dd>
            </div>
            <div>
              <dt className={`text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
                Se empieza a mirar
              </dt>
              <dd className={`mt-1 text-[13px] ${mono} text-[var(--acero)]`}>
                {evidenceBefore} min antes de la hora límite
              </dd>
            </div>
            <div>
              <dt className={`text-[10px] tracking-[.1em] text-[var(--tenue)] uppercase ${mono}`}>
                Dura, cuando mucho
              </dt>
              <dd className={`mt-1 text-[13px] ${mono} text-[var(--acero)]`}>
                {samplePolicy.maxRouteDurationMinutes ?? 60} min
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[12.5px]">
            <Link href={contratoHref} className="text-[var(--azul)]">
              Abrir la oficina del contrato →
            </Link>
          </p>
        </Panel>
      ) : (
        <Panel titulo="Falta el contrato">
          <p className="max-w-[70ch] text-[13.5px] text-[var(--tenue)]">
            No hay contrato para {unitLabel}. Sin él no hay hora límite ni ventana de observación, y
            ninguna ruta se puede juzgar.{" "}
            {/*
             * El enlace decía "Turnos" y llevaba a Turnos, para una acción que
             * vive en Contratos: mandaba al usuario al paso equivocado.
             */}
            <Link href={contratoHref} className="text-[var(--azul)]">
              Crear el contrato →
            </Link>
          </p>
        </Panel>
      )}

      <Panel titulo="Nueva ruta">
        {shifts.length === 0 ? (
          <p className="text-[13.5px] text-[var(--tenue)]">
            Primero registra al menos un turno en{" "}
            <Link href={turnosHref} className="text-[var(--azul)]">
              Turnos
            </Link>
            : una ruta sin turno no tiene contra qué hora medirse.
          </p>
        ) : (
          <form
            action="/api/cliente/rutas"
            method="post"
            encType="multipart/form-data"
            className="space-y-4"
          >
            <input type="hidden" name="clientSlug" value={client.slug} />
            {scopeHiddenFields}
            <input type="hidden" name="action" value="route" />
            <div className="grid gap-4 md:grid-cols-2">
              <label className={etiqueta}>
                Nombre de la ruta
                <input name="name" required className={campo} placeholder="Nombre con el que la conocen en la operación" />
              </label>
              <label className={etiqueta}>
                Turno
                <select name="shiftId" required className={campo} defaultValue="">
                  <option value="" disabled>
                    Elige turno…
                  </option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · entra {fmtTime(s.startTime)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={etiqueta}>
              Archivo del trazado (KML o KMZ)
              <input
                name="kmlFile"
                type="file"
                accept=".kml,.kmz,application/vnd.google-earth.kml+xml"
                className={campo}
              />
            </label>
            <label className={etiqueta}>
              O los puntos a mano, uno por línea (latitud, longitud)
              <textarea name="waypoints" rows={3} className={`${campo} tabular-nums`} placeholder="31.75,-106.48" />
            </label>
            <button type="submit" className={botonPrimario}>
              Crear ruta
            </button>
          </form>
        )}
      </Panel>

      <Panel titulo={`Rutas registradas — ${unitLabel} (${routeShifts.length})`}>
        {routeShifts.length === 0 ? (
          <p className="text-[13.5px] text-[var(--tenue)]">Sin rutas todavía.</p>
        ) : (
          <RouteShiftList
            rows={routeRows}
            shifts={shiftOptions}
            clientSlug={client.slug}
            plantId={scope.kind === "plant" ? scope.plantId : undefined}
            plantGroupId={scope.kind === "plant_group" ? scope.plantGroupId : undefined}
          />
        )}
      </Panel>

      {routeShifts.length > 0 ? (
        <Panel
          titulo="Actualizar el trazado"
          nota="El trazado cambia cuando se mueven los puntos de recolección. Las versiones anteriores se conservan: un servicio ya sellado conserva la que estaba vigente."
        >
          <form
            action="/api/cliente/rutas"
            method="post"
            encType="multipart/form-data"
            className="grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="clientSlug" value={client.slug} />
            {scopeHiddenFields}
            <input type="hidden" name="action" value="kml" />
            <div className="md:col-span-2">
              <label className={etiqueta}>
                Ruta
                <RouteShiftSelect
                  rows={routeRows}
                  shifts={shiftOptions}
                  name="routeId"
                  required
                />
              </label>
            </div>
            <label className={etiqueta}>
              Archivo del trazado (KML o KMZ)
              <input name="kmlFile" type="file" accept=".kml,.kmz" required className={campo} />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className={botonPrimario}>
                Guardar nueva versión
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      {routeShifts.length > 0 ? (
        <Panel
          titulo={`Variantes — ${totalVariantes} en total · ${totalActivas} activa${totalActivas === 1 ? "" : "s"}`}
          nota={
            <>
              Una <span className="text-[var(--texto)]">variante</span> es un camino alterno que
              coexiste hoy con los demás: el motor evalúa contra todas las activas y la unidad
              cumple si sirvió cualquiera. Una{" "}
              <span className="text-[var(--texto)]">versión</span> es la historia de una misma
              variante en el tiempo; las anteriores se conservan.
            </>
          }
        >
          {Array.from(shiftGroups.entries()).map(([sid, group]) => (
            <div key={sid} className="mb-8 last:mb-0">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b border-[var(--linea-tenue)] pb-2">
                <span
                  className={`text-[11px] font-medium tracking-[.13em] uppercase ${mono} text-[var(--acero)]`}
                >
                  {group.shiftName}
                </span>
                <span className={`text-[11px] tabular-nums ${mono} text-[var(--tenue)]`}>
                  entra {group.shiftStart}
                </span>
                <span className={`text-[11px] ${mono} text-[var(--tenue)]`}>
                  · {group.routes.length} ruta{group.routes.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-3 border-l border-[var(--linea-tenue)] pl-3">
                {group.routes.map((row) => {
                  const activas = row.variants.filter((v) => v.status === "activa");
                  const legacyCount = row.variants.filter((v) => v.status === "legacy").length;
                  return (
                    <div
                      key={row.routeId}
                      className="rounded border border-[var(--linea-tenue)] bg-[var(--panel2)]"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--linea-tenue)] px-3 py-2.5">
                        <span className="text-[13.5px] font-medium text-[var(--texto)]">
                          {row.routeName}
                        </span>
                        <span className={`text-[11.5px] tabular-nums ${mono} text-[var(--acero)]`}>
                          {activas.length} activa{activas.length === 1 ? "" : "s"}
                          {legacyCount > 0 ? ` · ${legacyCount} anterior${legacyCount === 1 ? "" : "es"}` : ""}
                        </span>
                        {activas.length === 0 && (
                          /*
                           * Iba en ámbar, que es el color de `pendiente por
                           * evidencia`. Esto no es el resultado de ningún
                           * servicio: es un aviso de que falta configuración,
                           * y los avisos del sistema van en azul.
                           */
                          <span
                            className={`text-[10.5px] tracking-[.1em] uppercase ${mono} text-[var(--azul)]`}
                          >
                            sin variante activa — no hay trazado contra el cual medir
                          </span>
                        )}
                      </div>

                      {row.variants.length > 0 && (
                        <table className="w-full text-[13px]">
                          <tbody className="divide-y divide-[var(--linea-tenue)]">
                            {row.variants.map((v) => {
                              const isLastActive =
                                v.status === "activa" && activas.length === 1;
                              const vCount = v.kmlVersions?.length ?? 0;
                              return (
                                <tr key={v.id}>
                                  <td className="w-32 px-3 py-2">
                                    {/*
                                     * Activa y anterior son estados operativos,
                                     * no resultados: acero y tenue. Antes cada
                                     * chip traía sus colores escritos a mano en
                                     * hexadecimal —#7A9CB8, #71808F—, que es
                                     * como el tema claro se quedó sin poder
                                     * cambiarlos.
                                     */}
                                    <ChipEstado tono={v.status === "activa" ? "acero" : "tenue"}>
                                      {v.status === "activa" ? "Activa" : "Anterior"}
                                    </ChipEstado>
                                  </td>
                                  <td className="px-3 py-2 text-[var(--texto)]">{v.name}</td>
                                  <td
                                    className={`px-3 py-2 text-[11.5px] tabular-nums ${mono} text-[var(--tenue)]`}
                                  >
                                    {vCount} versión{vCount === 1 ? "" : "es"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {isLastActive ? (
                                      <span
                                        className="text-[12px] text-[var(--tenue)]"
                                        title="Es la única activa: sin ella no queda trazado contra el cual medir esta ruta."
                                      >
                                        única activa
                                      </span>
                                    ) : (
                                      <form
                                        action="/api/cliente/rutas"
                                        method="post"
                                        className="inline"
                                      >
                                        <input
                                          type="hidden"
                                          name="clientSlug"
                                          value={client.slug}
                                        />
                                        {scopeHiddenFields}
                                        <input
                                          type="hidden"
                                          name="action"
                                          value="variant_status"
                                        />
                                        <input
                                          type="hidden"
                                          name="variantId"
                                          value={v.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="status"
                                          value={v.status === "activa" ? "legacy" : "activa"}
                                        />
                                        <button
                                          type="submit"
                                          className="text-[12px] text-[var(--azul)] hover:underline"
                                        >
                                          {v.status === "activa"
                                            ? "Pasar a anterior"
                                            : "Volver a activa"}
                                        </button>
                                      </form>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {row.variants.length === 0 && (
                        <p className="px-3 py-2.5 text-[12.5px] text-[var(--tenue)]">
                          Sin variantes. Sube un trazado en «Actualizar el trazado» y se crea la
                          variante principal.
                        </p>
                      )}

                      <details className="border-t border-[var(--linea-tenue)]">
                        <summary className="cursor-pointer px-3 py-2.5 text-[12.5px] text-[var(--azul)] hover:underline">
                          Nueva variante
                        </summary>
                        <form
                          action="/api/cliente/rutas"
                          method="post"
                          encType="multipart/form-data"
                          className="grid gap-4 px-3 pt-2 pb-3 md:grid-cols-2"
                        >
                          <input type="hidden" name="clientSlug" value={client.slug} />
                          {scopeHiddenFields}
                          <input type="hidden" name="action" value="variant_create" />
                          <input type="hidden" name="routeId" value={row.routeId} />
                          <label className={etiqueta}>
                            Nombre de la variante
                            <input
                              name="variantName"
                              required
                              className={campo}
                              placeholder="Por dónde va el camino alterno"
                            />
                          </label>
                          <label className={etiqueta}>
                            Archivo del trazado (KML o KMZ)
                            <input
                              name="kmlFile"
                              type="file"
                              accept=".kml,.kmz"
                              required
                              className={campo}
                            />
                          </label>
                          <div className="md:col-span-2">
                            <button type="submit" className={botonPrimario}>
                              Crear variante
                            </button>
                          </div>
                        </form>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Panel>
      ) : null}
    </UnitShell>
  );
}
