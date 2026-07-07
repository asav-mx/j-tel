import { getRepos, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tecma: { name: string } | null = null;
  let jb: { name: string } | null = null;
  let dbError: string | null = null;

  if (!isDatabaseConfigured()) {
    dbError = "DATABASE_URL no está configurada en Vercel.";
  } else {
    try {
      const repos = getRepos();
      tecma = await repos.accounts.findBySlug("tecma");
      jb = await repos.accounts.findBySlug("juarez-bus");
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
              <dt className="text-[var(--muted)]">Base de datos</dt>
              <dd>{isDatabaseConfigured() ? "Configurada" : "Pendiente"}</dd>
            </div>
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
