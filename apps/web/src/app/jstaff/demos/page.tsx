import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";
import { exigirEnPagina } from "@/lib/guardia-pagina";

export const dynamic = "force-dynamic";

export default async function JStaffDemosPage() {
  // La comprobación va cerca del dato: un layout no se re-renderiza
  // al navegar entre rutas hermanas, así que como única guardia es frágil.
  await exigirEnPagina({ tipo: "jstaff" });

  const repos = getRepos();
  const templates = await repos.demos.getTemplates();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav title="Demos comerciales" links={[{ href: "/jstaff", label: "← Panel" }]} />
        <Card>
          {templates.map((t) => (
            <div key={t.id} className="mb-4 rounded border border-[var(--linea-tenue)] p-4">
              <p className="font-medium">{t.name}</p>
              <pre className="mt-2 overflow-x-auto text-xs text-[var(--muted)]">
                {JSON.stringify(t.config, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Al activar contrato, la demo se convierte en servicio activo sin cambios de código.
              </p>
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
