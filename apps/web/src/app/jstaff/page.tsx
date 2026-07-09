import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { withAccount } from "@/lib/account-context";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JStaffDashboardPage() {
  const repos = getRepos();
  const accounts = await repos.accounts.listAll();

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
            { href: "/jstaff/soporte", label: "Compuerta de atención" },
          ]}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Multi-cuenta">
            <ul className="space-y-2 text-sm">
              {accounts.map((a) => (
                <li key={a!.id} className="flex justify-between rounded border border-white/5 p-3">
                  <span>{a!.name}</span>
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
                <li key={t.id} className="rounded border border-white/5 p-3">
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
