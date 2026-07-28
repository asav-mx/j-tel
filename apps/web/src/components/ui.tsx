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

export function StatusBadge({
  status,
  timing,
}: {
  status?: string | null;
  timing?: string | null;
}) {
  if (!status) {
    return <span className="text-xs text-[var(--muted)]">Sin verificar</span>;
  }

  const lateCumplido = status === "cumplido" && timing === "tarde";
  const styles: Record<string, string> = {
    cumplido: lateCumplido
      ? "bg-amber-500/20 text-amber-200"
      : "bg-emerald-500/20 text-emerald-300",
    no_cumplido: "bg-red-500/20 text-red-300",
    pendiente_evidencia: "bg-amber-500/20 text-amber-300",
  };

  const labels: Record<string, string> = {
    cumplido: "Cumplido",
    no_cumplido: "No cumplido",
    pendiente_evidencia: "Pendiente por evidencia",
  };

  const timingSuffix =
    status === "cumplido" && timing
      ? timing === "tarde"
        ? " · Tarde"
        : timing === "temprano"
          ? " · Temprano"
          : ""
      : "";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "bg-white/10"}`}
    >
      {(labels[status] ?? status) + timingSuffix}
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

/**
 * Marca de cuenta demo. Es un estado operativo, no un resultado: va en tenue,
 * nunca en verde/ámbar/rojo, que están reservados a los veredictos.
 */
export function DemoChip() {
  return (
    <span className="ml-2 rounded-sm border border-white/15 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wider text-[var(--muted)]">
      demo
    </span>
  );
}

/**
 * Interruptor de cuentas demo para las pantallas de J-Staff.
 *
 * Las demo existen y J-Staff puede verlas — solo no estorban por default.
 * Si no hay ninguna, no se dibuja nada: un interruptor que no apaga nada
 * es ruido.
 */
export function DemoToggle({
  mostrando,
  ocultas,
  href,
}: {
  mostrando: boolean;
  ocultas: number;
  href: string;
}) {
  if (!mostrando && ocultas === 0) return null;
  return (
    <p className="mb-3 text-xs text-[var(--muted)]">
      {mostrando
        ? "Mostrando las cuentas demo. "
        : `${ocultas} cuenta${ocultas === 1 ? "" : "s"} demo oculta${ocultas === 1 ? "" : "s"}. `}
      <Link href={href} className="text-[var(--accent)]">
        {mostrando ? "Ocultarlas" : "Mostrarlas"}
      </Link>
    </p>
  );
}
