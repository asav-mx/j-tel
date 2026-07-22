import Link from "next/link";
import { getRepos } from "@/lib/db";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { RouteShiftList, RouteShiftSelect } from "@/components/route-shift-list";
import { confirmMessages } from "@/lib/confirm-messages";
import { unitConfigStepHrefFor } from "@/lib/config-wizard";
import { computeExpectedDeadline } from "@jtel/domain";
import type { UnitPageContext } from "@/lib/unit-context";
import {
  contractMatchesScope,
  operationalUnitLabel,
} from "@/lib/operational-scope";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded border border-white/10 bg-black/20 p-2 text-sm placeholder:text-white/30";
const labelClass = "block text-sm";
const btnClass =
  "rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90";

const createdLabels: Record<string, string> = {
  ruta: "Ruta creada (turno + trazado). Ya puedes usarla en Perfiles de servicio.",
  kml: "Nueva versión de trazado guardada.",
  ruta_actualizada: "Ruta actualizada.",
  ruta_eliminada: "Ruta eliminada.",
  variante_creada: "Variante de trazado creada.",
  variante_actualizada: "Estado de variante actualizado.",
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
  const samplePolicy = contracts[0]?.policy;
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
    const deadline = computeExpectedDeadline("2026-01-01", shiftStart, anticipation);
    const dl = `${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}`;
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
      meta: `Inicio ${fmtTime(shiftStart)} · deadline ~${dl} · ${variants.length} variante(s) · ${kmlCount} versión(es)`,
      deleteMessage: confirmMessages.deleteRoute(
        rs.route?.name ?? "—",
        `${rs.shift?.name ?? "—"} · inicio ${fmtTime(shiftStart)}`,
      ),
    };
  });

  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
  }));

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell
          client={client}
          unit={unit}
          title={`Rutas — ${operationalUnitLabel(unit)}`}
          step="rutas"
        />

        <p className="text-sm text-[var(--muted)]">
          Una ruta es <span className="text-white">turno + trazado KML</span> para{" "}
          <span className="text-white">{operationalUnitLabel(unit)}</span>. Los turnos se registran
          en{" "}
          <Link href={turnosHref} className="text-[var(--accent)]">
            Turnos
          </Link>
          ; aquí subes el trazado vinculado a cada turno.
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

        {isCampus && activeUnit.kind === "plant_group" ? (
          <Card title="Campus compartido">
            <p className="text-sm text-[var(--muted)]">
              Plantas en este campus:{" "}
              <span className="text-white">
                {activeUnit.memberPlants.map((p) => `${p.name} (${p.code})`).join(" · ") ||
                  "ninguna asignada"}
              </span>
              . Las rutas aplican a todas; la geocerca de llegada suele ser una sola en la entrada
              del campus (configúrala en Geocercas).
            </p>
          </Card>
        ) : null}

        {samplePolicy ? (
          <Card title="Ventana de servicio (desde contrato activo)">
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--muted)]">
              <li>
                Anticipación de llegada:{" "}
                <span className="text-white">{anticipation} min</span> antes del inicio del turno →
                deadline en geocerca
              </li>
              <li>
                Observación GPS empieza{" "}
                <span className="text-white">{evidenceBefore} min</span> antes del deadline
              </li>
              <li>
                Duración máxima de ruta:{" "}
                <span className="text-white">
                  {samplePolicy.maxRouteDurationMinutes ?? 60} min
                </span>
              </li>
            </ul>
          </Card>
        ) : (
          <Card title="Contrato">
            <p className="text-sm text-[var(--muted)]">
              Crea y activa un contrato para {unitLabel} en{" "}
              <Link href={turnosHref} className="text-[var(--accent)]">
                Turnos
              </Link>{" "}
              — ahí defines anticipación, márgenes de evidencia y si se verifica trazado KML.
            </p>
          </Card>
        )}

        <Card title="Cómo funciona">
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--muted)]">
            <li>
              Registra los <span className="text-white">turnos</span> en Turnos (hora de entrada del
              personal).
            </li>
            <li>
              Crea cada <span className="text-white">ruta</span> eligiendo turno + trazado KML. Riveras
              7 turno 1 y Riveras 7 turno 2 son rutas distintas aunque compartan nombre.
            </li>
            <li>
              Usa la ruta en <span className="text-white">Perfiles de servicio</span> junto con
              contrato y geocerca.
            </li>
          </ol>
        </Card>

        <Card title="Nueva ruta">
          {shifts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Primero registra al menos un turno en{" "}
              <Link href={turnosHref} className="text-[var(--accent)]">
                Turnos
              </Link>
              .
            </p>
          ) : (
            <form
              action="/api/cliente/rutas"
              method="post"
              encType="multipart/form-data"
              className="space-y-3"
            >
              <input type="hidden" name="clientSlug" value={client.slug} />
              {scopeHiddenFields}
              <input type="hidden" name="action" value="route" />
              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass}>
                  Nombre de la ruta
                  <input
                    name="name"
                    required
                    className={inputClass}
                    placeholder="Ej. Riveras 7"
                  />
                </label>
                <label className={labelClass}>
                  Turno
                  <select name="shiftId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Elige turno…
                    </option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · inicio {fmtTime(s.startTime)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Archivo KML / KMZ (trazado de recolección)
                <input
                  name="kmlFile"
                  type="file"
                  accept=".kml,.kmz,application/vnd.google-earth.kml+xml"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                O waypoints manuales (lat,lng por línea)
                <textarea name="waypoints" rows={3} className={inputClass} placeholder="31.75,-106.48" />
              </label>
              <button type="submit" className={btnClass}>
                Crear ruta
              </button>
            </form>
          )}
        </Card>

        <Card title={`Rutas registradas — ${unitLabel} (${routeShifts.length})`}>
          {routeShifts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin rutas todavía.</p>
          ) : (
            <RouteShiftList
              rows={routeRows}
              shifts={shiftOptions}
              clientSlug={client.slug}
              plantId={scope.kind === "plant" ? scope.plantId : undefined}
              plantGroupId={scope.kind === "plant_group" ? scope.plantGroupId : undefined}
            />
          )}
        </Card>

        {routeShifts.length > 0 ? (
          <Card title="Actualizar trazado KML (nueva versión)">
            <form
              action="/api/cliente/rutas"
              method="post"
              encType="multipart/form-data"
              className="grid gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="clientSlug" value={client.slug} />
              {scopeHiddenFields}
              <input type="hidden" name="action" value="kml" />
              <div className="md:col-span-2">
                <label className={labelClass}>
                  Ruta
                  <RouteShiftSelect
                    rows={routeRows}
                    shifts={shiftOptions}
                    name="routeId"
                    required
                  />
                </label>
              </div>
              <label className={labelClass}>
                Archivo KML / KMZ
                <input name="kmlFile" type="file" accept=".kml,.kmz" required className={inputClass} />
              </label>
              <div className="md:col-span-2">
                <button type="submit" className={btnClass}>
                  Guardar nueva versión
                </button>
              </div>
            </form>
            <p className="mt-2 text-xs text-[var(--muted)]">
              El trazado puede cambiar cuando se mueven puntos de recolección. Las versiones
              anteriores se conservan para auditoría.
            </p>
          </Card>
        ) : null}

        {routeShifts.length > 0 ? (
          <Card title="Variantes de trazado">
            <p className="mb-3 text-xs text-[var(--muted)]">
              <strong>Variante</strong> = caminos alternos que coexisten como válidos hoy (ej. por
              MEX-45 o por la Panamericana). El motor evalúa contra todas las variantes{" "}
              <span className="text-white">activas</span> — una unidad cumple si sirve por
              CUALQUIERA de ellas. No confundir con <em>versión</em> (historia temporal de una
              variante).
            </p>

            {routeRows.map((row) =>
              row.variants.length > 0 ? (
                <div key={row.routeId} className="mb-4 rounded border border-white/5 p-3">
                  <p className="mb-2 text-sm font-medium text-white">
                    {row.routeName} · {row.shiftName}
                  </p>
                  <ul className="space-y-1">
                    {row.variants.map((v) => (
                      <li key={v.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={
                            v.status === "activa"
                              ? "rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-300"
                              : "rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/50"
                          }
                        >
                          {v.status}
                        </span>
                        <span className="text-white">{v.name}</span>
                        <span className="text-[var(--muted)]">
                          ({v.kmlVersions?.length ?? 0} versión(es))
                        </span>
                        <form
                          action="/api/cliente/rutas"
                          method="post"
                          className="ml-auto"
                        >
                          <input type="hidden" name="clientSlug" value={client.slug} />
                          {scopeHiddenFields}
                          <input type="hidden" name="action" value="variant_status" />
                          <input type="hidden" name="variantId" value={v.id} />
                          <input
                            type="hidden"
                            name="status"
                            value={v.status === "activa" ? "legacy" : "activa"}
                          />
                          <button
                            type="submit"
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            {v.status === "activa" ? "→ legacy" : "→ activa"}
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-[var(--accent)]">
                + Nueva variante de trazado
              </summary>
              <form
                action="/api/cliente/rutas"
                method="post"
                encType="multipart/form-data"
                className="mt-3 grid gap-3 md:grid-cols-2"
              >
                <input type="hidden" name="clientSlug" value={client.slug} />
                {scopeHiddenFields}
                <input type="hidden" name="action" value="variant_create" />
                <div className="md:col-span-2">
                  <label className={labelClass}>
                    Ruta
                    <RouteShiftSelect
                      rows={routeRows}
                      shifts={shiftOptions}
                      name="routeId"
                      required
                    />
                  </label>
                </div>
                <label className={labelClass}>
                  Nombre de la variante
                  <input
                    name="variantName"
                    required
                    className={inputClass}
                    placeholder="Ej. Alterna Panamericana"
                  />
                </label>
                <label className={labelClass}>
                  Archivo KML / KMZ
                  <input name="kmlFile" type="file" accept=".kml,.kmz" required className={inputClass} />
                </label>
                <div className="md:col-span-2">
                  <button type="submit" className={btnClass}>
                    Crear variante
                  </button>
                </div>
              </form>
            </details>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
