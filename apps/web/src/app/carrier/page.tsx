import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { CarrierAccountSwitcher } from "@/components/carrier-account-switcher";
import { OccurrenceTable, toOccurrenceRow } from "@/components/occurrence-table";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function CarrierDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin datos de carrier. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const units = await repos.fleet.getUnitsForCarrier(carrier.id);
  const devices = await repos.fleet.getDevicesForCarrier(carrier.id);
  const maintenance = await repos.fleet.getMaintenanceForCarrier(carrier.id);
  const contracts = await repos.contracts.findForCarrier(carrier.id);
  const activeContracts = contracts.filter((c) => c.status === "active");

  const contractSummaries = await Promise.all(
    activeContracts.map(async (contract) => {
      const occs = await repos.occurrences.findForContract(contract.id);
      return {
        contract,
        total: occs.length,
        pending: occs.filter((o) => o.complianceFact?.status === "pendiente_evidencia").length,
        recent: occs.slice(0, 5),
      };
    }),
  );

  const recentRows = contractSummaries
    .flatMap((s) => s.recent)
    .slice(0, 10)
    .map((occ) =>
      toOccurrenceRow(occ, "/carrier/servicio", carrier.slug, {
        showClient: true,
        showPlant: true,
        showCarrier: false,
      }),
    );

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title={`Cara Carrier — ${carrier.name}`}
          links={[
            { href: withAccount("/carrier", carrier.slug), label: "Panel" },
            { href: withAccount("/carrier/flota", carrier.slug), label: "Flota" },
            { href: withAccount("/carrier/gps", carrier.slug), label: "Proveedor GPS" },
            { href: withAccount("/carrier/mantenimiento", carrier.slug), label: "Mantenimiento" },
            { href: withAccount("/carrier/combustible", carrier.slug), label: "Combustible" },
            {
              href: withAccount("/carrier/cumplimiento", carrier.slug),
              label: "Cumplimiento contractual",
            },
            { href: withAccount("/carrier/reportes", carrier.slug), label: "Reportes al cliente" },
          ]}
        />

        <CarrierAccountSwitcher currentSlug={carrier.slug} basePath="/carrier" />

        <Card title="Tu rol como carrier">
          <p className="text-sm text-[var(--muted)]">
            Configuras <span className="text-white">flota, GPS y unidades</span> — eso es cómo
            atiendes. El cliente define <span className="text-white">geocercas, turnos, rutas y
            contratos</span> (qué se verifica). Aquí ves el cumplimiento de los contratos activos
            que te asignaron.
          </p>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="Unidades">{units.length}</Card>
          <Card title="Dispositivos GPS">{devices.length}</Card>
          <Card title="Contratos activos">{activeContracts.length}</Card>
          <Card title="Mantenimiento pendiente">
            {maintenance.filter((m) => m.status !== "completado").length}
          </Card>
        </div>

        <Card title="Clientes con contrato activo">
          {contractSummaries.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Sin contratos activos. El cliente los crea en Configuración → Contratos.
            </p>
          ) : (
            <ul className="space-y-3">
              {contractSummaries.map(({ contract, total, pending }) => {
                const plantLabel = contract.plant
                  ? `${contract.plant.name} (${contract.plant.code})`
                  : contract.plantGroup
                    ? `Grupo: ${contract.plantGroup.name}`
                    : "—";
                return (
                  <li
                    key={contract.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-4"
                  >
                    <div>
                      <p className="font-medium">{contract.client?.name ?? "Cliente"}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {plantLabel} · {contract.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {total} servicios · {pending} pendientes por evidencia
                      </p>
                    </div>
                    <a
                      href={withAccount(
                        `/carrier/cumplimiento?contract=${contract.id}`,
                        carrier.slug,
                      )}
                      className="text-sm text-[var(--accent)]"
                    >
                      Ver servicios →
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="mt-6">
          <Card title="Cumplimiento reciente">
            <OccurrenceTable
              rows={recentRows}
              showClient
              showPlant
              showCarrier={false}
              showEnforcement={false}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
