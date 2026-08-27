import { getRepos } from "@/lib/db";
import { AppNav, Card, DemoChip, DemoToggle } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import Link from "next/link";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function JStaffDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // La comprobación va cerca del dato: un layout no se re-renderiza
  // al navegar entre rutas hermanas, así que como única guardia es frágil.
  await exigirEnPagina({ tipo: "jstaff" });

  const sp = searchParams ? await searchParams : undefined;
  const mostrarDemo = sp?.demo === "1";

  const repos = getRepos();
  // Se piden todas y se filtra aquí para poder contar cuántas se ocultaron.
  const todas = await repos.accounts.listAll();
  const accounts = mostrarDemo ? todas : todas.filter((a) => !a.isDemo);
  const demoOcultas = todas.length - accounts.length;

  const templates = await repos.demos.getTemplates();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <AppNav
          title="J-Staff — Operador de plataforma"
          links={[
            { href: "/jstaff", label: "Panel" },
            { href: "/jstaff/cuentas", label: "Cuentas" },
            { href: "/jstaff/comercial", label: "Comercial" },
            { href: "/jstaff/demos", label: "Demos" },
            { href: "/jstaff/circuitos", label: "Circuitos" },
            { href: "/jstaff/verificacion", label: "Verificación" },
            { href: "/jstaff/diagnostico", label: "Diagnóstico" },
            { href: "/jstaff/soporte", label: "Compuerta de atención" },
          ]}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Multi-cuenta">
            <DemoToggle
              mostrando={mostrarDemo}
              ocultas={demoOcultas}
              href={mostrarDemo ? "/jstaff" : "/jstaff?demo=1"}
            />
            <ul className="space-y-2 text-sm">
              {accounts.map((a) => (
                <li key={a!.id} className="flex justify-between rounded border border-[var(--linea-tenue)] p-3">
                  <span>
                    {a!.name}
                    {a!.isDemo ? <DemoChip /> : null}
                  </span>
                  <span className="text-[var(--muted)]">
                    {a!.type}{" "}
                    {a!.type === "carrier" ? (
                      <Link className="text-[var(--accent)]" href={withAccount("/carrier", a.slug)}>
                        Abrir
                      </Link>
                    ) : a!.type === "client" ? (
                      <Link className="text-[var(--accent)]" href={withAccount("/cliente", a.slug)}>
                        Abrir
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Plantillas demo → contrato">
            <ul className="space-y-2 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="rounded border border-[var(--linea-tenue)] p-3">
                  {t.name}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
