import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CarrierFlotaPage() {
  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug("juarez-bus");
  const units = carrier ? await repos.fleet.getUnitsForCarrier(carrier.id) : [];
  const devices = carrier ? await repos.fleet.getDevicesForCarrier(carrier.id) : [];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <AppNav title="Gestión de flota" links={[{ href: "/carrier", label: "← Panel" }]} />

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Unidades">
            <ul className="space-y-2 text-sm">
              {units.map((u) => (
                <li key={u.id} className="rounded border border-white/5 p-3">
                  <p className="font-medium">{u.label}</p>
                  <p className="text-[var(--muted)]">Placa: {u.plateNumber ?? "—"}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Dispositivos GPS">
            <ul className="space-y-2 text-sm">
              {devices.map((d) => (
                <li key={d.id} className="rounded border border-white/5 p-3 font-mono">
                  IMEI: {d.imei}
                  {d.label ? ` · ${d.label}` : ""}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
