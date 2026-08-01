import Link from "next/link";
import { getRepos } from "@/lib/db";
import { UnitShell } from "@/components/unit-shell";
import type { UnitPageContext } from "@/lib/unit-context";
import { contractMatchesScope, operationalUnitLabel } from "@/lib/operational-scope";
import { withAccount } from "@/lib/account-context";
import { unitBasePath, unitComplianceHref, unitContratosHref } from "@/lib/unit-routes";

type Puerta = { label: string } & (
  | { atenuada: true }
  | { atenuada?: false; href: string }
);

/**
 * El homescreen de una unidad: puertas a lo que ya existe, sin cifras.
 *
 * Los pasos de configuración operativa (geocercas/turnos/rutas/perfiles)
 * siguen viviendo detrás del link "Configuración" del header (`UnitShell`) —
 * no son una de las seis puertas de la ficha, así que no se repiten aquí.
 */
export async function UnitDashboard({ ctx }: { ctx: UnitPageContext }) {
  const repos = getRepos();
  const { client, unit, scope } = ctx;
  const unitLabel = operationalUnitLabel(unit);

  const contracts = await repos.contracts.findForClient(client.id);
  const scopedContracts = contracts.filter((c) => contractMatchesScope(c, scope));
  // Un solo contrato: se va directo a su oficina/historia. Cero o varios: la
  // puerta cae en la lista de contratos, igual que hace hoy el hub de la unidad.
  const unContrato = scopedContracts.length === 1 ? scopedContracts[0] : null;
  const contratosHubHref = unitContratosHref(unit, client.slug);
  const contratoHref = unContrato
    ? withAccount(`/cliente/contrato/${unContrato.id}`, client.slug)
    : contratosHubHref;
  const historiaHref = unContrato
    ? withAccount(`/cliente/contrato/${unContrato.id}/historia`, client.slug)
    : contratosHubHref;

  const puertas: Puerta[] = [
    { label: "Cumplimiento", href: unitComplianceHref(unit, client.slug) },
    { label: "Cierre del turno", href: withAccount(`${unitBasePath(unit)}/cierre`, client.slug) },
    unit.kind === "plant"
      ? {
          label: "Pendiente por evidencia",
          href: withAccount(`${unitBasePath(unit)}/pendiente-por-evidencia`, client.slug),
        }
      : { label: "Pendiente por evidencia", atenuada: true },
    { label: "Monitoreo", href: withAccount(`${unitBasePath(unit)}/monitoreo`, client.slug) },
    { label: "Configuración del contrato", href: contratoHref },
    { label: "Historia de la política", href: historiaHref },
  ];

  return (
    <main className="min-h-screen bg-[var(--fondo)] p-6 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <UnitShell client={client} unit={unit} title={unitLabel} />

        <nav aria-label={`Puertas de ${unitLabel}`}>
          <ul className="divide-y divide-[var(--linea)] rounded-sm border border-[var(--linea)] bg-[var(--panel)]">
            {puertas.map((puerta) =>
              puerta.atenuada ? (
                <li
                  key={puerta.label}
                  className="flex items-center justify-between px-5 py-4 text-[var(--tenue)]"
                >
                  <span className="text-[15px]">{puerta.label}</span>
                  <span
                    className="text-[10.5px] uppercase tracking-[.13em]"
                    style={{ fontFamily: "var(--fuente-mono)" }}
                  >
                    Próximamente
                  </span>
                </li>
              ) : (
                <li key={puerta.label}>
                  <Link
                    href={puerta.href}
                    className="flex items-center justify-between px-5 py-4 text-[var(--texto)] transition hover:bg-white/[0.03]"
                  >
                    <span className="text-[15px]">{puerta.label}</span>
                    <span className="text-[var(--tenue)]">→</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
    </main>
  );
}
