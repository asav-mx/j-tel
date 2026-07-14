import { loadMonitoreo } from "@/lib/monitoreo-data";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import { MonitoreoLive } from "@/components/monitoreo-map";
import { getRepos } from "@/lib/db";
import type { UnitPageContext } from "@/lib/unit-context";
import { scopeToUnitPath } from "@/lib/unit-routes";
import { operationalUnitLabel } from "@/lib/operational-scope";
import Link from "next/link";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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
  const fecha = parseParam(sp, "fecha") ?? todayIso();
  const turno = parseParam(sp, "turno");

  const repos = getRepos();
  const day = new Date(`${fecha}T00:00:00`);
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

  const monitoreo =
    turnoId != null
      ? await loadMonitoreo({
          scope: ctx.scope,
          accountSlug: ctx.client.slug,
          fecha,
          turnoId,
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
  const unitLabel = operationalUnitLabel(ctx.unit);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={ctx.client} unit={ctx.unit} title={`Monitoreo — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Torre de control en vivo: rutas del turno de fondo y unidades identificadas dejando
          huella de lo ya cubierto (pre-verificado visual, no cambia el veredicto).{" "}
          <Link href={historialHref} className="text-[var(--accent)]">
            Ver historial →
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
              Ver monitoreo
            </button>
          </form>
        </Card>

        {!monitoreo ? (
          <Card title="Sin datos">
            <p className="text-sm text-[var(--muted)]">
              No hay ocurrencias para esa fecha/turno en esta unidad.
            </p>
          </Card>
        ) : (
          <Card
            title={`${monitoreo.turnoName} · ${monitoreo.fecha}${monitoreo.turnoStartTime ? ` · ${monitoreo.turnoStartTime}` : ""}`}
          >
            <p className="mb-4 text-sm text-[var(--muted)]">
              {monitoreo.stats.total} rutas · {monitoreo.stats.llego} llegó ·{" "}
              {monitoreo.stats.avanzando} avanzando · {monitoreo.stats.en_ruta} en ruta ·{" "}
              {monitoreo.stats.programada} programada ·{" "}
              <span className="text-red-300">{monitoreo.stats.alerta} alerta</span>
            </p>
            <MonitoreoLive initial={monitoreo} query={query} />
          </Card>
        )}
      </div>
    </main>
  );
}
