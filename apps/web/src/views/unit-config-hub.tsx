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
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <UnitShell client={client} unit={unit} title={`Configuración — ${unitLabel}`} />

        <p className="text-sm text-[var(--muted)]">
          Configura los servicios de <span className="text-white">{unitLabel}</span> en orden. Cada
          paso aplica solo a esta unidad operativa.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {UNIT_CONFIG_STEPS.map((step) => {
            const count = stepCounts[step.id] ?? 0;
            const ready = count > 0;
            return (
              <Link
                key={step.id}
                href={unitConfigStepHrefFor(unit, client.slug, step.id)}
                className="block rounded-xl border border-white/10 bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
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
            <li>Geocerca de llegada (destino / fin de la ruta).</li>
            <li>Turnos — horarios de entrada del personal.</li>
            <li>Rutas — trazado KML por turno (Riveras 7 turno 1 ≠ turno 2).</li>
            <li>Perfiles de servicio → generar ocurrencias.</li>
          </ol>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Los <span className="text-white">contratos</span> con el carrier (política de cumplimiento)
            se configuran por separado —{" "}
            <Link href={unitContratosHref(unit, client.slug)} className="text-[var(--accent)]">
              Contratos
            </Link>
            . Los perfiles los requieren.
          </p>
          <p className="mt-1 text-sm">
            <Link href={unitDashboardHref(unit, client.slug)} className="text-[var(--accent)]">
              ← Volver al panel de la unidad
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
