import { getDb, getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  const jb = await repos.accounts.findBySlug("juarez-bus");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">JTEL</h1>
          <p className="mt-2 text-[var(--muted)]">
            Verificación automática de transporte de personal
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <a
            href="/cliente"
            className="rounded-xl border border-white/10 bg-[var(--card)] p-6 transition hover:border-[var(--accent)]"
          >
            <h2 className="text-lg font-semibold">Cara Cliente</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cumplimiento, reportes y penalizaciones
            </p>
          </a>
          <a
            href="/carrier"
            className="rounded-xl border border-white/10 bg-[var(--card)] p-6 transition hover:border-[var(--accent)]"
          >
            <h2 className="text-lg font-semibold">Cara Carrier</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Flota, mantenimiento y auditoría
            </p>
          </a>
          <a
            href="/jstaff"
            className="rounded-xl border border-white/10 bg-[var(--card)] p-6 transition hover:border-[var(--accent)]"
          >
            <h2 className="text-lg font-semibold">J-Staff</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Altas, demos y compuerta de soporte
            </p>
          </a>
        </div>

        <section className="mt-12 rounded-xl border border-white/10 bg-[var(--card)] p-6">
          <h3 className="font-semibold">Estado del sistema</h3>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Cuenta Tecma</dt>
              <dd>{tecma ? "Conectada" : "Sin seed — ejecute db:seed"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Carrier Juárez Bus</dt>
              <dd>{jb ? "Conectado" : "Sin seed"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
