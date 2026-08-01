import Link from "next/link";
import { getRepos } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnitShell } from "@/components/unit-shell";
import type { UnitPageContext } from "@/lib/unit-context";
import { contractMatchesScope, operationalUnitLabel } from "@/lib/operational-scope";
import {
  UNIT_CONFIG_STEPS,
  unitConfigStepHrefFor,
} from "@/lib/config-wizard";
import { unitContratosHref, unitDashboardHref } from "@/lib/unit-routes";

export async function UnitConfigHub({
  ctx,
}: {
  ctx: UnitPageContext;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);

  const [geofences, routeShifts, shifts, profiles] = await Promise.all([
    repos.geofences.findForScope(scope, client.id),
    repos.routes.getRouteShiftsForScope(scope),
    repos.routes.getShiftsForScope(scope),
    repos.profiles.findForClient(client.id).then(async (all) => {
      const { operationalScopeFromContract } = await import("@jtel/domain");
      return all.filter((p) => {
        const cs = operationalScopeFromContract(p.contract ?? {});
        return cs && contractMatchesScope(p.contract ?? {}, scope);
      });
    }),
  ]);

  const stepCounts: Record<string, number> = {
    geocercas: geofences.length,
    turnos: shifts.length,
    rutas: routeShifts.length,
    servicios: profiles.length,
  };

  return (
    <UnitShell client={client} unit={unit} title={`Configuración — ${unitLabel}`}>
      <p className="text-sm text-[var(--muted)]">
        Configura los servicios de <span className="text-[var(--texto)]">{unitLabel}</span> en orden. Cada
        paso aplica solo a esta unidad operativa.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={unitContratosHref(unit, client.slug)}
          className="block rounded-xl border border-[var(--linea)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)] md:col-span-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Requisito para perfiles
            </span>
            <span className="text-sm text-[var(--accent)]">Abrir →</span>
          </div>
          <h3 className="mt-2 font-semibold">Contratos</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Política con el carrier (deadline, GPS, enforcement). Activa el contrato aquí antes del
            paso 4.
          </p>
        </Link>
        {UNIT_CONFIG_STEPS.map((step) => {
          const count = stepCounts[step.id] ?? 0;
          const ready = count > 0;
          return (
            <Link
              key={step.id}
              href={unitConfigStepHrefFor(unit, client.slug, step.id)}
              className="block rounded-xl border border-[var(--linea)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--t-acero)] text-sm font-semibold">
                  {step.n}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {ready ? `${count} listo(s)` : "pendiente"}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{step.desc}</p>
            </Link>
          );
        })}
      </div>

      <Card title="Orden recomendado">
        <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--muted)]">
          <li>Contrato con el carrier (activar si está en borrador).</li>
          <li>Geocerca de llegada (destino / fin de la ruta).</li>
          <li>Turnos — horarios de entrada del personal.</li>
          <li>Rutas — trazado KML por turno (Riveras 7 turno 1 ≠ turno 2).</li>
          <li>Perfiles de servicio → generar ocurrencias.</li>
        </ol>
        <p className="mt-1 text-sm">
          <Link href={unitDashboardHref(unit, client.slug)} className="text-[var(--accent)]">
            ← Volver al panel de la unidad
          </Link>
        </p>
      </Card>
    </UnitShell>
  );
}
