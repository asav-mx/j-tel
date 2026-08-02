import Link from "next/link";
import { getRepos } from "@/lib/db";
import { CorporateShell } from "@/components/unit-shell";
import { AvisoSistema, Card } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { operationalUnitLabel } from "@/lib/operational-scope";
import { contractMatchesScope } from "@/lib/operational-scope";
import { unitDashboardHref } from "@/lib/unit-routes";

export const dynamic = "force-dynamic";

export default async function ClienteDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = typeof sp?.error === "string" ? sp.error : null;

  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  // Esta pantalla solo muestra cifras: ninguna de estas ocurrencias se dibuja.
  // Antes se traían todas —con sus nueve relaciones anidadas y sin límite— para
  // contarlas con `.filter().length` y tirarlas. Ahora las cuenta la base.
  const [operationalUnits, stats, contracts] = await Promise.all([
    repos.clients.getOperationalUnits(client.id),
    repos.occurrences.countByStatusForClientAccount(client.id),
    repos.contracts.findForClient(client.id),
  ]);

  const unitCards = await Promise.all(
    operationalUnits.map(async (unit) => {
      const scope =
        unit.kind === "plant"
          ? { kind: "plant" as const, plantId: unit.id }
          : { kind: "plant_group" as const, plantGroupId: unit.id };

      const [conteo, unitContracts] = await Promise.all([
        repos.occurrences.countByStatusForScope(scope),
        Promise.resolve(contracts.filter((c) => contractMatchesScope(c, scope))),
      ]);

      return {
        unit,
        href: unitDashboardHref(unit, client.slug),
        services: conteo.total,
        contracts: unitContracts.length,
        pending: conteo.pendiente_evidencia,
        ready: unitContracts.length > 0,
      };
    }),
  );

  return (
    <CorporateShell client={client} title={`${client.name} — Sitios`}>
      {error ? <AvisoSistema lead="No se guardó.">{error}</AvisoSistema> : null}

      <p className="text-sm text-[var(--muted)]">
        Vista corporativa de <span className="text-[var(--texto)]">{client.name}</span>. Cada planta
        independiente o campus tiene su propio panel, configuración y cumplimiento.
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Total servicios">{stats.total}</Card>
        <Card title="Cumplidos">{stats.cumplido}</Card>
        <Card title="No cumplidos">{stats.no_cumplido}</Card>
        <Card title="Pendientes">{stats.pendiente_evidencia}</Card>
      </div>

      {operationalUnits.length === 0 ? (
        <Card title="Sin sitios">
          <p className="text-sm text-[var(--muted)]">
            Crea plantas o campus en{" "}
            <Link href={withAccount("/cliente/plantas", client.slug)} className="text-[var(--accent)]">
              Administrar plantas
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {unitCards.map(({ unit, href, services, contracts: uc, pending, ready }) => (
            <Link
              key={`${unit.kind}-${unit.id}`}
              href={href}
              className="block rounded-xl border border-[var(--linea)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    {unit.kind === "plant_group" ? "Campus" : "Planta independiente"}
                  </p>
                  <h2 className="text-lg font-semibold">{operationalUnitLabel(unit)}</h2>
                  {unit.kind === "plant_group" ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Plantas {unit.memberPlants.map((p) => p.code).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--muted)]">Código {unit.code}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {ready ? "Configurada" : "Pendiente"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {services} servicio(s) · {uc} contrato(s)
                {pending > 0 ? ` · ${pending} pendiente(s)` : ""}
              </p>
              <p className="mt-3 text-sm text-[var(--accent)]">Abrir panel →</p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={withAccount("/cliente/plantas", client.slug)}
          className="block rounded-xl border border-[var(--linea)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
        >
          <h2 className="font-semibold">Administrar plantas</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Alta de plantas, campus y agrupaciones corporativas.
          </p>
        </Link>
        <Link
          href={withAccount("/cliente/reportes", client.slug)}
          className="block rounded-xl border border-[var(--linea)] bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
        >
          <h2 className="font-semibold">Reportes corporativos</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Resumen exportable de todos los sitios.</p>
        </Link>
      </div>
    </CorporateShell>
  );
}
