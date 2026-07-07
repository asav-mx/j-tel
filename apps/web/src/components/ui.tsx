import Link from "next/link";

export function AppNav({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <header className="mb-8 border-b border-white/10 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-white">
            ← JTEL
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:border-[var(--accent)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export const NavBar = AppNav;

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <span className="text-xs text-[var(--muted)]">Sin verificar</span>;
  }
  const styles: Record<string, string> = {
    cumplido: "bg-emerald-500/20 text-emerald-300",
    no_cumplido: "bg-red-500/20 text-red-300",
    pendiente_evidencia: "bg-amber-500/20 text-amber-300",
  };

  const labels: Record<string, string> = {
    cumplido: "Cumplido",
    no_cumplido: "No cumplido",
    pendiente_evidencia: "Pendiente por evidencia",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-white/10"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[var(--card)] p-6">
      {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}
