import Link from "next/link";

export function AppNav({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <header className="mb-8 border-b border-[var(--linea)] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--texto)]">
            ← JTEL
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-[var(--linea)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
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

/**
 * El chip de veredicto.
 *
 * **El color dice el veredicto y SOLO el veredicto.** Un cumplido que llegó
 * tarde va verde: el servicio sí se cumplió, y que no se pague es consecuencia
 * del contrato, no otro veredicto. Pintarlo ámbar —como se pintaba— lo hacía
 * leer como `pendiente por evidencia`, que es un estado distinto y con otras
 * consecuencias; mezclaba verificación con enforcement en el único elemento de
 * la interfaz cuyo trabajo es no mezclarlas.
 *
 * "Tarde" no es un cuarto estado ni un color: es un **motivo debajo**, y por eso
 * ya no viaja pegado a la etiqueta. Lo dibuja quien hospeda el chip, con su
 * medición y su tolerancia (ver `motivoTiming`).
 *
 * La forma es una impresión sobre papel —borde marcado, hueco adentro,
 * versalitas espaciadas, mono—, no una pastilla rellena de color: la pastilla
 * es de las que el skill lista como anti-patrón.
 */
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    /*
     * Ausencia de veredicto, no un cuarto veredicto: el motor todavía no juzgó
     * este servicio. Va en tenue y sin chip, para que no se lea como estado.
     */
    return (
      <span className="font-mono text-[10.5px] tracking-[0.13em] text-[var(--tenue)] uppercase">
        Sin verificar
      </span>
    );
  }

  const tonos: Record<string, string> = {
    cumplido: "text-[var(--verde)] bg-[var(--t-verde)]",
    no_cumplido: "text-[var(--rojo)] bg-[var(--t-rojo)]",
    pendiente_evidencia: "text-[var(--ambar)] bg-[var(--t-ambar)]",
  };

  const etiquetas: Record<string, string> = {
    cumplido: "Cumplido",
    no_cumplido: "No cumplido",
    pendiente_evidencia: "Pendiente por evidencia",
  };

  return (
    <span
      className={`inline-block rounded-[2px] border-[1.5px] border-current px-2.5 pt-[3.5px] pb-[2.5px] font-mono text-[10.5px] font-medium tracking-[0.13em] whitespace-nowrap uppercase ${
        tonos[status] ?? "text-[var(--tenue)]"
      }`}
    >
      {etiquetas[status] ?? status}
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
    <section className="rounded-xl border border-[var(--linea)] bg-[var(--card)] p-6">
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
    <span className="ml-2 rounded-sm border border-[var(--linea-fuerte)] px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wider text-[var(--muted)]">
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
