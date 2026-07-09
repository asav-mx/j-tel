import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { clientNavLinks } from "@/lib/client-nav";
import { CONFIG_STEPS } from "@/lib/config-wizard";

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

  const [operationalUnits, geofences, routeShifts, contracts, profiles] = await Promise.all([
    repos.clients.getOperationalUnits(client.id),
    repos.geofences.findForClient(client.id),
    repos.routes.getRouteShiftsForClient(client.id),
    repos.contracts.findForClient(client.id),
    repos.profiles.findForClient(client.id),
  ]);

  const s = client.slug;
  const stepCounts: Record<string, number> = {
    plantas: operationalUnits.length,
    geocercas: geofences.length,
    rutas: routeShifts.length,
    contratos: contracts.length,
    servicios: profiles.length,
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AppNav title={`Configuración — ${client.name}`} links={clientNavLinks(s)} />

        <ClientAccountSwitcher currentSlug={client.slug} basePath="/cliente/configuracion" />

        <p className="text-sm text-[var(--muted)]">
          Aquí el <span className="text-white">cliente corporativo</span> arma sus servicios de
          punta a punta. Cada paso es por <span className="text-white">unidad operativa</span> (planta
          suelta o campus compartido). El carrier no configura esto — solo ve cumplimiento cuando el
          contrato ya existe.
        </p>

        <Card title="¿Quién configura qué?">
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            <li>
              <span className="text-white">J-Staff</span> — da de alta carriers y clientes; autoriza
              qué carriers puede contratar cada cliente (Proceso comercial).
            </li>
            <li>
              <span className="text-white">Cliente (Tecma, Honeywell…)</span> — plantas, geocercas,
              rutas, contratos con <em>sus</em> carriers autorizados, perfiles de servicio.
            </li>
            <li>
              <span className="text-white">Carrier (Juárez Bus…)</span> — flota, GPS y unidades;
              consulta cumplimiento de los contratos que el cliente le asignó.
            </li>
          </ul>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {CONFIG_STEPS.map((step) => (
            <Step
              key={step.id}
              n={step.n}
              title={step.title}
              desc={step.desc}
              href={withAccount(step.path, s)}
              count={stepCounts[step.id] ?? 0}
              ready={(stepCounts[step.id] ?? 0) > 0}
            />
          ))}
        </div>

        <Card title="Orden recomendado">
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--muted)]">
            <li>Plantas y campus (agrupa plantas que comparten operación).</li>
            <li>Geocerca de llegada — en campus suele ser una sola en la entrada.</li>
            <li>Rutas + turnos + KML por unidad operativa.</li>
            <li>Contrato con el carrier (política: deadline, tolerancia, evidencia).</li>
            <li>Perfil de servicio → generar ocurrencias → el cron verifica GPS.</li>
          </ol>
        </Card>
      </div>
    </main>
  );
}
