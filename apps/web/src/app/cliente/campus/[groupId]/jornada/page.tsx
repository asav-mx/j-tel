import { resolveCampusUnitPage } from "@/lib/unit-context";
import { loadJornada } from "@/lib/jornada-data";
import { UnitShell } from "@/components/unit-shell";
import { Card } from "@/components/ui";
import { JornadaContrastMap } from "@/components/jornada-contrast-map";
import { withAccount } from "@/lib/account-context";
import { JornadaClientFilters } from "@/components/jornada-client-filters";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

export default async function CampusJornadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { groupId } = await params;
  const ctx = await resolveCampusUnitPage(groupId, searchParams);
  const sp = searchParams ? await searchParams : undefined;
  const fecha = parseParam(sp, "fecha") ?? todayIso();
  const turno = parseParam(sp, "turno");

  const repos = (await import("@/lib/db")).getRepos();
  const day = new Date(`${fecha}T00:00:00`);
  const occs = await repos.occurrences.findForPlantGroup(groupId, day, day);
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
          plantGroupId: groupId,
          accountSlug: ctx.client.slug,
          fecha,
          turnoId,
        })
      : null;

  const cumplimientoHref = withAccount(
    `/cliente/campus/${groupId}/cumplimiento?fecha=7d`,
    ctx.client.slug,
  );

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell
          client={ctx.client}
          unit={ctx.unit}
          title={`Jornada — ${ctx.unit.name}`}
        />

        <p className="text-sm text-[var(--muted)]">
          Vista agregada por turno (sin entidad nueva): rutas esperadas vs GPS observado.{" "}
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
              Ver jornada
            </button>
          </form>
        </Card>

        {!jornada ? (
          <Card title="Sin datos">
            <p className="text-sm text-[var(--muted)]">
              No hay ocurrencias para esa fecha/turno en este campus.
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
              <JornadaClientFilters
                routes={jornada.routes}
                units={jornada.units}
              />
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
