import { loadMonitoreo } from "@/lib/monitoreo-data";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import { MonitoreoLive } from "@/components/monitoreo-map";
import { getRepos } from "@/lib/db";
import type { UnitPageContext } from "@/lib/unit-context";
import { scopeToUnitPath } from "@/lib/unit-routes";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { localDateIso, pickActiveShift } from "@/lib/local-time";
import Link from "next/link";

function parseParam(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = sp?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function MonitoreoUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const now = new Date();
  // Fecha civil en Juárez (no UTC), para que a las 10pm no salte al “día de mañana”.
  const fechaAuto = localDateIso(now);
  const fechaOverride = parseParam(sp, "fecha");
  const fecha = fechaOverride ?? fechaAuto;
  const turnoOverride = parseParam(sp, "turno");
  const autoMode = !fechaOverride && !turnoOverride;

  const repos = getRepos();
  const day = new Date(`${fecha}T12:00:00`);
  const [occs, configuredShifts] = await Promise.all([
    repos.occurrences.findForScope(ctx.scope, day, day),
    repos.routes.getShiftsForScope(ctx.scope),
  ]);

  const shiftById = new Map<string, { id: string; name: string; startTime: string }>();
  for (const s of configuredShifts) {
    shiftById.set(s.id, {
      id: s.id,
      name: s.name,
      startTime: String(s.startTime ?? "").slice(0, 5),
    });
  }
  for (const o of occs) {
    const shift = o.profile?.routeShift?.shift;
    if (shift?.id && !shiftById.has(shift.id)) {
      shiftById.set(shift.id, {
        id: shift.id,
        name: shift.name,
        startTime: String(shift.startTime ?? "").slice(0, 5),
      });
    }
  }
  const shifts = [...shiftById.values()].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );

  const active = pickActiveShift(shifts, now);
  const turnoId =
    turnoOverride && shiftById.has(turnoOverride)
      ? turnoOverride
      : (active?.id ?? shifts[0]?.id ?? null);
  const selectedShift = turnoId ? (shiftById.get(turnoId) ?? null) : null;

  const monitoreo =
    turnoId != null
      ? await loadMonitoreo({
          scope: ctx.scope,
          accountSlug: ctx.client.slug,
          fecha,
          turnoId,
          now,
        })
      : null;

  const scopeParam =
    ctx.scope.kind === "plant"
      ? `plantId=${ctx.scope.plantId}`
      : `groupId=${ctx.scope.plantGroupId}`;
  const query =
    turnoId != null
      ? `account=${encodeURIComponent(ctx.client.slug)}&fecha=${fecha}&turno=${turnoId}&${scopeParam}`
      : "";

  const basePath = scopeToUnitPath(ctx.scope);
  const historialHref = withAccount(`${basePath}/jornada`, ctx.client.slug);
  const liveHref = withAccount(`${basePath}/monitoreo`, ctx.client.slug);
  const unitLabel = operationalUnitLabel(ctx.unit);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={ctx.client} unit={ctx.unit} title={`Monitoreo — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Torre de control en vivo: el turno se elige solo según la hora (Juárez). Las unidades
          identificadas dejan huella de lo ya cubierto (pre-verificado visual, no cambia el
          veredicto). Para jornadas pasadas ve a{" "}
          <Link href={historialHref} className="text-[var(--accent)]">
            Historial
          </Link>
          .
        </p>

        <Card title={autoMode ? "Turno activo (automático)" : "Vista forzada (manual)"}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="text-base text-white">
                {selectedShift
                  ? `${selectedShift.name} · ${fecha} · ${selectedShift.startTime}`
                  : "Sin turnos configurados"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {autoMode
                  ? "Elegido por la hora actual. Se actualiza cada 45s."
                  : "Estás forzando fecha/turno. "}
                {!autoMode ? (
                  <Link href={liveHref} className="text-[var(--accent)]">
                    Volver al automático →
                  </Link>
                ) : null}
              </p>
            </div>
            <Link
              href={historialHref}
              className="rounded border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
            >
              Ver historial (días pasados) →
            </Link>
          </div>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-[var(--muted)]">
              Forzar otra fecha / turno
            </summary>
            <form className="mt-3 flex flex-wrap items-end gap-3" method="get">
              <input type="hidden" name="account" value={ctx.client.slug} />
              <label>
                <span className="text-[var(--muted)]">Fecha</span>
                <input
                  type="date"
                  name="fecha"
                  defaultValue={fecha}
                  className="mt-1 block rounded border border-white/10 bg-black/40 px-3 py-2"
                />
              </label>
              <label>
                <span className="text-[var(--muted)]">Turno</span>
                <select
                  name="turno"
                  defaultValue={turnoId ?? ""}
                  className="mt-1 block rounded border border-white/10 bg-black/40 px-3 py-2"
                >
                  {shifts.length === 0 ? (
                    <option value="">Sin turnos</option>
                  ) : (
                    shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime})
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="submit"
                className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-black"
              >
                Ver este turno
              </button>
            </form>
          </details>
        </Card>

        {!monitoreo ? (
          <Card title="Sin datos">
            <p className="text-sm text-[var(--muted)]">
              No hay ocurrencias para el turno activo de hoy. Revisa turnos/perfiles o abre{" "}
              <Link href={historialHref} className="text-[var(--accent)]">
                Historial
              </Link>{" "}
              para un día pasado.
            </p>
          </Card>
        ) : (
          <Card
            title={`${monitoreo.turnoName} · ${monitoreo.fecha}${monitoreo.turnoStartTime ? ` · ${monitoreo.turnoStartTime}` : ""}`}
          >
            <p className="mb-4 text-sm text-[var(--muted)]">
              {monitoreo.stats.total} rutas · {monitoreo.stats.cerrado} cerrado ·{" "}
              {monitoreo.stats.llego} llegó · {monitoreo.stats.avanzando} avanzando ·{" "}
              {monitoreo.stats.en_ruta} en ruta · {monitoreo.stats.programada} programada ·{" "}
              <span className="text-red-300">{monitoreo.stats.alerta} alerta</span>
            </p>
            <MonitoreoLive initial={monitoreo} query={query} />
          </Card>
        )}
      </div>
    </main>
  );
}
