import { getRepos } from "@/lib/db";
import { getCarrierMemberships } from "@/lib/auth";
import { AppNav, Card, StatusBadge } from "@/components/ui";
import { resolveAccountByType, withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function CarrierDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const memberships = await getCarrierMemberships();
  const repos = getRepos();
  const carrier = await resolveAccountByType("carrier", searchParams);

  if (!carrier) {
    return (
      <main className="p-8">
        <p>Sin datos de carrier. Ejecute db:seed.</p>
      </main>
    );
  }

  const units = await repos.fleet.getUnitsForCarrier(carrier.id);
  const devices = await repos.fleet.getDevicesForCarrier(carrier.id);
  const maintenance = await repos.fleet.getMaintenanceForCarrier(carrier.id);
  const contracts = await repos.contracts.findForCarrier(carrier.id);

  const allOccurrences = [];
  for (const contract of contracts) {
    const occs = await repos.occurrences.findForClientAccount(contract.clientAccountId);
    allOccurrences.push(...occs.filter((o) => o.contractId === contract.id));
  }

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

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="Unidades">{units.length}</Card>
          <Card title="Dispositivos GPS">{devices.length}</Card>
          <Card title="Contratos activos">
            {contracts.filter((c) => c.status === "active").length}
          </Card>
          <Card title="Mantenimiento pendiente">
            {maintenance.filter((m) => m.status !== "completado").length}
          </Card>
        </div>

        <Card title="Operación standalone">
          <p className="text-sm text-[var(--muted)]">
            El producto de flota funciona sin contrato. La verificación contractual es una capa
            adicional ({memberships[0]?.role ?? "demo"}).
          </p>
        </Card>

        <div className="mt-6">
          <Card title="Cumplimiento reciente (mismo hecho que el cliente)">
            <div className="space-y-2">
              {allOccurrences.slice(0, 10).map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-center justify-between rounded border border-white/5 p-3 text-sm"
                >
                  <span>
                    {occ.serviceDate} — {occ.profile?.name}
                  </span>
                  {occ.complianceFact ? (
                    <StatusBadge status={occ.complianceFact.status} />
                  ) : (
                    <span className="text-[var(--muted)]">Sin verificar</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
