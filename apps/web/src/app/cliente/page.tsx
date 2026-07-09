import Link from "next/link";
import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { resolveAccountByType, withAccount } from "@/lib/account-context";
import { clientNavLinks } from "@/lib/client-nav";
import { configHubHref } from "@/lib/config-wizard";

export const dynamic = "force-dynamic";

export default async function ClienteDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const client = await resolveAccountByType("client", searchParams);

  if (!client) {
    return (
      <main className="p-8">
        <p>No hay cuentas cliente. Crea una en J-Staff → Cuentas.</p>
      </main>
    );
  }

  const [occurrences, plants, contracts] = await Promise.all([
    repos.occurrences.findForClientAccount(client.id),
    repos.clients.getPlantsForAccount(client.id),
    repos.contracts.findForClient(client.id),
  ]);

  const stats = {
    total: occurrences.length,
    cumplido: occurrences.filter((o) => o.complianceFact?.status === "cumplido").length,
    noCumplido: occurrences.filter((o) => o.complianceFact?.status === "no_cumplido").length,
    pendiente: occurrences.filter((o) => o.complianceFact?.status === "pendiente_evidencia")
      .length,
  };

  const s = client.slug;
  const sections = [
    {
      title: "Configuración de servicios",
      desc: "Guía paso a paso: plantas → geocercas → rutas → contratos → perfiles.",
      href: configHubHref(s),
      hint: `${contracts.length} contrato(s)`,
      primary: true,
    },
    {
      title: "Cumplimiento",
      desc: "Servicios verificados, evidencia GPS y estado por planta.",
      href: withAccount("/cliente/cumplimiento", s),
      hint:
        stats.pendiente > 0
          ? `${stats.pendiente} pendiente(s) por evidencia`
          : `${stats.total} servicio(s) registrados`,
    },
    {
      title: "Plantas",
      desc: "Alta de plantas, campus y alcance operativo.",
      href: withAccount("/cliente/plantas", s),
      hint: `${plants.length} planta(s)`,
    },
    {
      title: "Reportes",
      desc: "Resumen mensual exportable.",
      href: withAccount("/cliente/reportes", s),
      hint: "CSV automático",
    },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav title={`Panel — ${client.name}`} links={clientNavLinks(s)} />

        <ClientAccountSwitcher currentSlug={client.slug} basePath="/cliente" />

        <p className="mb-6 text-sm text-[var(--muted)]">
          Cliente corporativo: <span className="text-white">{client.name}</span>. Resumen general;
          el detalle de cumplimiento está en su pestaña.
        </p>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card title="Total servicios">{stats.total}</Card>
          <Card title="Cumplidos">{stats.cumplido}</Card>
          <Card title="No cumplidos">{stats.noCumplido}</Card>
          <Card title="Pendientes">{stats.pendiente}</Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`block rounded-xl border p-5 transition hover:border-[var(--accent)] ${
                "primary" in section && section.primary
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                  : "border-white/10 bg-[var(--card)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <span className="text-xs text-[var(--muted)]">{section.hint}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{section.desc}</p>
              <p className="mt-3 text-sm text-[var(--accent)]">Abrir →</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
