import { getRepos } from "@/lib/db";
import { AppNav, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JStaffCuentasPage() {
  const repos = getRepos();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <AppNav title="Alta de cuentas" links={[{ href: "/jstaff", label: "← Panel" }]} />
        <Card title="Crear cuenta carrier o cliente">
          <p className="mb-4 text-sm text-[var(--muted)]">
            Use POST /api/jstaff/accounts para dar de alta cuentas sin tocar código.
          </p>
          <form action="/api/jstaff/accounts" method="post" className="space-y-4">
            <input type="hidden" name="_method" value="POST" />
            <label className="block text-sm">
              Nombre
              <input
                name="name"
                className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2"
                placeholder="Nueva Empresa"
              />
            </label>
            <label className="block text-sm">
              Slug
              <input
                name="slug"
                className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2"
                placeholder="nueva-empresa"
              />
            </label>
            <label className="block text-sm">
              Tipo
              <select
                name="type"
                className="mt-1 w-full rounded border border-white/10 bg-black/20 p-2"
              >
                <option value="client">Cliente</option>
                <option value="carrier">Carrier</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black"
            >
              Crear cuenta
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
