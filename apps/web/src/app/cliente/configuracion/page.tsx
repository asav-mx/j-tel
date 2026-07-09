import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { clientNavLinks } from "@/lib/client-nav";

export const dynamic = "force-dynamic";

function Step({
  n,
  title,
  desc,
  href,
  count,
  ready,
}: {
  n: number;
  title: string;
  desc: string;
  href: string;
  count: number;
  ready: boolean;
}) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-white/10 bg-[var(--card)] p-5 transition hover:border-[var(--accent)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
          {n}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            ready ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
          }`}
        >
          {ready ? `${count} listo(s)` : "pendiente"}
        </span>
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
    </a>
  );
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <AppNav title="Configuración" links={[{ href: "/cliente", label: "← Panel" }]} />
          <Card title="Sin cliente">
            <p className="text-sm text-[var(--muted)]">
              No hay cuentas cliente. Crea una en J-Staff → Cuentas.
            </p>
          </Card>
        </div>
      </main>
    );
  }

  const [plants, geofences, routeShifts, contracts, profiles] = await Promise.all([
    repos.clients.getPlantsForAccount(client.id),
    repos.geofences.findForClient(client.id),
    repos.routes.getRouteShiftsForClient(client.id),
    repos.contracts.findForClient(client.id),
    repos.profiles.findForClient(client.id),
  ]);

  const s = client.slug;

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav
          title={`Configuración — ${client.name}`}
          links={clientNavLinks(s)}
        />

        <ClientAccountSwitcher currentSlug={client.slug} basePath="/cliente/configuracion" />

        <p className="text-sm text-[var(--muted)]">
          Arma un servicio real de punta a punta, sin scripts. Sigue los pasos en orden; al terminar
          podrás generar las ocurrencias que el sistema verificará automáticamente.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Step
            n={1}
            title="Plantas"
            desc="Da de alta las plantas del cliente (dónde operan)."
            href={withAccount("/cliente/plantas", s)}
            count={plants.length}
            ready={plants.length > 0}
          />
          <Step
            n={2}
            title="Geocercas de destino"
            desc="Marca el área de llegada de cada planta (centro + radio)."
            href={withAccount("/cliente/configuracion/geocercas", s)}
            count={geofences.length}
            ready={geofences.length > 0}
          />
          <Step
            n={3}
            title="Rutas y turnos"
            desc="Por planta: rutas, turnos, trazado KML y programación."
            href={withAccount("/cliente/configuracion/rutas", s)}
            count={routeShifts.length}
            ready={routeShifts.length > 0}
          />
          <Step
            n={4}
            title="Contratos"
            desc="Política con el carrier: tolerancia, estrictez y enforcement."
            href={withAccount("/cliente/configuracion/contratos", s)}
            count={contracts.length}
            ready={contracts.length > 0}
          />
          <Step
            n={5}
            title="Perfiles de servicio"
            desc="Junta todo y genera las ocurrencias diarias a verificar."
            href={withAccount("/cliente/configuracion/servicios", s)}
            count={profiles.length}
            ready={profiles.length > 0}
          />
        </div>

        <Card title="¿Cómo funciona?">
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--muted)]">
            <li>Creas plantas y su geocerca de destino.</li>
            <li>Defines rutas + turnos (con hora límite de llegada).</li>
            <li>Registras el contrato con el carrier y su política.</li>
            <li>Creas un perfil de servicio que une contrato + ruta/turno + geocerca + unidades.</li>
            <li>Generas las ocurrencias del periodo; el cron las verifica contra el GPS.</li>
          </ol>
        </Card>
      </div>
    </main>
  );
}
