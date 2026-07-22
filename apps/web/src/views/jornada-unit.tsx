import { loadJornada } from "@/lib/jornada-data";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import { JornadaClientFilters } from "@/components/jornada-client-filters";
import { getRepos } from "@/lib/db";
import type { UnitPageContext } from "@/lib/unit-context";
import { scopeToUnitPath } from "@/lib/unit-routes";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { localDateIso } from "@/lib/local-time";
import { dayForDateQuery } from "@jtel/domain";
import Link from "next/link";

function parseParam(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = sp?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function JornadaUnitView({
  ctx,
  searchParams,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const fecha = parseParam(sp, "fecha") ?? localDateIso();
  const turno = parseParam(sp, "turno");

  const repos = getRepos();
  const day = dayForDateQuery(fecha);
  const occs = await repos.occurrences.findForScope(ctx.scope, day, day);

  const shiftById = new Map<string, { id: string; name: string; startTime: string }>();
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
  const turnoId = turno && shiftById.has(turno) ? turno : (shifts[0]?.id ?? null);

  const jornada =
    turnoId != null
      ? await loadJornada({
          scope: ctx.scope,
          accountSlug: ctx.client.slug,
          fecha,
          turnoId,
        })
      : null;

  const basePath = scopeToUnitPath(ctx.scope);
  const cumplimientoHref = withAccount(`${basePath}/cumplimiento?fecha=7d`, ctx.client.slug);
  const monitoreoHref = withAccount(`${basePath}/monitoreo`, ctx.client.slug);
  const unitLabel = operationalUnitLabel(ctx.unit);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={ctx.client} unit={ctx.unit} title={`Historial — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Aquí ves el mapa de una jornada ya pasada (o de hoy): todas las rutas del turno vs GPS
          observado — lo que antes se llamaba “Jornada”. El en vivo está en{" "}
          <Link href={monitoreoHref} className="text-[var(--accent)]">
            Monitoreo
          </Link>
          .{" "}
          <Link href={cumplimientoHref} className="text-[var(--accent)]">
            ← Cumplimiento
          </Link>
        </p>

        <Card title="Seleccionar turno / fecha">
          <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
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
                  <option value="">Sin turnos ese día</option>
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
              Ver historial
            </button>
          </form>
        </Card>

        {!jornada ? (
          <Card title="Sin datos">
            <p className="text-sm text-[var(--muted)]">
              No hay ocurrencias para esa fecha/turno en esta unidad.
            </p>
          </Card>
        ) : (
          <>
            <Card
              title={`${jornada.turnoName} · ${jornada.fecha}${jornada.turnoStartTime ? ` · ${jornada.turnoStartTime}` : ""}`}
            >
              <p className="mb-4 text-sm text-[var(--muted)]">
                {jornada.stats.total} rutas · {jornada.stats.cumplido} cumplido ·{" "}
                {jornada.stats.no_cumplido} no cumplido · {jornada.stats.pendiente_evidencia}{" "}
                pendiente · {jornada.stats.sin_verificar} sin verificar
              </p>
              <JornadaClientFilters routes={jornada.routes} units={jornada.units} />
            </Card>

            <Card title="Rutas del turno">
              <ul className="space-y-2 text-sm">
                {jornada.routes.map((r) => (
                  <li
                    key={r.occurrenceId}
                    className="flex flex-wrap justify-between gap-2 rounded border border-white/5 p-3"
                  >
                    <span>
                      <Link
                        href={withAccount(
                          `/cliente/servicio/${r.occurrenceId}`,
                          ctx.client.slug,
                        )}
                        className="text-[var(--accent)]"
                      >
                        {r.profileCode}
                      </Link>{" "}
                      — {r.profileName}
                    </span>
                    <span className="text-[var(--muted)]">
                      {r.status ?? "sin_verificar"}
                      {r.observedUnitLabel ? ` · ${r.observedUnitLabel}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
