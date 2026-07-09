import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { withAccount } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let clients: Array<{ name: string; slug: string }> = [];
  let carriers: Array<{ name: string; slug: string }> = [];
  let dbError: string | null = null;

  if (!isDatabaseConfigured()) {
    dbError = "DATABASE_URL no está configurada en Vercel.";
  } else {
    try {
      const repos = getRepos();
      clients = await repos.accounts.listByType("client");
      carriers = await repos.accounts.listByType("carrier");
    } catch (err) {
      dbError =
        err instanceof Error
          ? err.message
          : "No se pudo conectar a la base de datos.";
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">JTEL</h1>
          <p className="mt-2 text-[var(--muted)]">
            Verificación automática de transporte de personal
          </p>
        </header>

        {dbError && (
          <section className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
            <p className="font-semibold text-amber-200">Base de datos pendiente</p>
            <p className="mt-2 text-[var(--muted)]">{dbError}</p>
            <ol className="mt-3 list-inside list-decimal space-y-1 text-[var(--muted)]">
              <li>Vercel → j-tel-web → Storage → Create Database → Neon</li>
              <li>Conectar al proyecto j-tel-web</li>
              <li>Redeploy</li>
              <li>Correr migrate + seed una vez (te guío)</li>
            </ol>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-xl border border-white/10 bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Cara Cliente</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cumplimiento, reportes y penalizaciones
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {clients.length === 0 ? (
                <li className="text-[var(--muted)]">Sin clientes</li>
              ) : (
                clients.map((c) => (
                  <li key={c.slug}>
                    <a href={withAccount("/cliente", c.slug)} className="text-[var(--accent)] hover:underline">
                      {c.name} →
                    </a>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-xl border border-white/10 bg-[var(--card)] p-6">
            <h2 className="text-lg font-semibold">Cara Carrier</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Flota, mantenimiento y auditoría
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {carriers.length === 0 ? (
                <li className="text-[var(--muted)]">Sin carriers</li>
              ) : (
                carriers.map((c) => (
                  <li key={c.slug}>
                    <a href={withAccount("/carrier", c.slug)} className="text-[var(--accent)] hover:underline">
                      {c.name} →
                    </a>
                  </li>
                ))
              )}
            </ul>
          </section>
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
              <dt className="text-[var(--muted)]">Base de datos</dt>
              <dd>{isDatabaseConfigured() ? "Configurada" : "Pendiente"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Clientes</dt>
              <dd>{clients.length > 0 ? clients.map((c) => c.name).join(", ") : "Sin clientes"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Carriers</dt>
              <dd>{carriers.length > 0 ? carriers.map((c) => c.name).join(", ") : "Sin carriers"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
