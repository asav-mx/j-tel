import Link from "next/link";
import { getRepos } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnitShell } from "@/components/unit-shell";
import type { UnitPageContext } from "@/lib/unit-context";
import { contractMatchesScope } from "@/lib/operational-scope";
import { operationalUnitLabel } from "@/lib/operational-scope";
import {
  UNIT_CONFIG_STEPS,
  unitConfigStepHrefFor,
} from "@/lib/config-wizard";
import {
  unitComplianceHref,
  unitConfigHubHref,
} from "@/lib/unit-routes";

export async function UnitDashboard({ ctx }: { ctx: UnitPageContext }) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);

  const [occurrences, geofences, shifts, routeShifts, profiles] = await Promise.all([
    repos.occurrences.findForScope(scope),
    repos.geofences.findForScope(scope, client.id),
    repos.routes.getShiftsForScope(scope),
    repos.routes.getRouteShiftsForScope(scope),
    repos.profiles.findForClient(client.id).then(async (all) => {
      const { operationalScopeFromContract } = await import("@jtel/domain");
      return all.filter((p) => {
        const cs = operationalScopeFromContract(p.contract ?? {});
        return cs && contractMatchesScope(p.contract ?? {}, scope);
      });
    }),
  ]);

  const stats = {
    total: occurrences.length,
    cumplido: occurrences.filter((o) => o.complianceFact?.status === "cumplido").length,
    noCumplido: occurrences.filter((o) => o.complianceFact?.status === "no_cumplido").length,
    pendiente: occurrences.filter((o) => o.complianceFact?.status === "pendiente_evidencia").length,
  };

  const stepCounts: Record<string, number> = {
    geocercas: geofences.length,
    turnos: shifts.length,
    rutas: routeShifts.length,
    servicios: profiles.length,
  };

  const configHub = unitConfigHubHref(unit, client.slug);
  const compliance = unitComplianceHref(unit, client.slug);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <UnitShell client={client} unit={unit} title={`${unitLabel}`} />

        {unit.kind === "plant_group" ? (
          <p className="text-sm text-[var(--muted)]">
            Campus compartido — plantas{" "}
            <span className="text-white">
              {unit.memberPlants.map((p) => p.code).join(", ")}
            </span>
            . La configuración de servicios aplica a todo el campus.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Planta con operación independiente. Aquí configuras geocercas, turnos, rutas y perfiles
            solo para esta unidad.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card title="Total servicios">{stats.total}</Card>
          <Card title="Cumplidos">{stats.cumplido}</Card>
          <Card title="No cumplidos">{stats.noCumplido}</Card>
          <Card title="Pendientes">{stats.pendiente}</Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href={configHub}
            className="block rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-5 transition hover:border-[var(--accent)]"
          >
            <h2 className="text-lg font-semibold">Configuración</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Geocercas, turnos, rutas y perfiles de {unitLabel}.
            </p>
            <p className="mt-3 text-sm text-[var(--accent)]">Abrir →</p>
          </Link>
          <Link
            href={compliance}
            className="block rounded-xl border border-white/10 bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
          >
            <h2 className="text-lg font-semibold">Cumplimiento</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Servicios verificados y evidencia GPS de esta unidad.
            </p>
            <p className="mt-3 text-sm text-[var(--accent)]">
              {stats.pendiente > 0
                ? `${stats.pendiente} pendiente(s) →`
                : "Ver servicios →"}
            </p>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {UNIT_CONFIG_STEPS.map((step) => {
            const count = stepCounts[step.id] ?? 0;
            const ready = count > 0;
            return (
              <Link
                key={step.id}
                href={unitConfigStepHrefFor(unit, client.slug, step.id)}
                className="block rounded-xl border border-white/10 bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Paso {step.n}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {ready ? `${count}` : "—"}
                  </span>
                </div>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{step.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
