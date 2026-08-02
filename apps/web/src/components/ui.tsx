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

const mono = "font-[family-name:var(--fuente-mono)]";

/*
 * Las clases de formulario de la configuración, en un solo lugar.
 *
 * Las seis vistas las repetían palabra por palabra, y ahí es donde una piel se
 * desarma: basta que una se quede sin actualizar para que el usuario vea dos
 * productos distintos en dos pasos del mismo alta.
 *
 * `campo` lleva `tabular-nums` porque casi todo lo que se escribe aquí son
 * minutos, metros y porcentajes, y las columnas de números tienen que alinear.
 */
export const campo =
  "mt-1.5 w-full rounded border border-[var(--linea)] bg-[var(--panel2)] px-3 py-1.5 text-sm text-[var(--texto)] tabular-nums placeholder:text-[var(--tenue)]";

export const etiqueta = "block text-[13.5px] text-[var(--texto)]";

/**
 * La acción principal. Azul —el color de las acciones— y nunca verde: un botón
 * verde en esta plataforma se lee como `cumplido`.
 */
export const botonPrimario =
  "rounded border border-[var(--azul)]/50 bg-[var(--azul)]/10 px-4 py-2 text-sm font-medium text-[var(--azul)] hover:bg-[var(--azul)]/20";

/**
 * Todo lo demás, incluido lo que borra. El rojo dice `no cumplido` y nada más;
 * que una acción destruye lo dicen la palabra y el diálogo de confirmación.
 */
export const botonSecundario =
  "rounded border border-[var(--linea-fuerte)] px-3 py-1.5 text-xs text-[var(--texto)] hover:border-[var(--azul)] hover:text-[var(--azul)]";

/**
 * Un panel de la configuración. Es el `Card` que sí obedece los tokens de tema:
 * `--panel` en vez del heredado `--card`, que en oscuro tira a azul y en claro
 * ni siquiera es el mismo color.
 *
 * El `nota` existe para que un título nunca vaya solo cuando necesita contexto —
 * la regla de que ningún dato obligue a deducir empieza en el encabezado.
 */
export function Panel({
  titulo,
  nota,
  children,
}: {
  titulo?: string;
  nota?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--linea)] bg-[var(--panel)] p-6">
      {titulo ? (
        <header className="mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--texto)]">{titulo}</h2>
          {nota ? <p className="mt-1 max-w-[76ch] text-[12.5px] text-[var(--tenue)]">{nota}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Estado operativo — activo, borrador, listo, sin configurar.
 *
 * **No es un veredicto y por eso no lleva verde, ámbar ni rojo.** Esos tres
 * colores son de `cumplido`, `pendiente por evidencia` y `no cumplido`, y nada
 * más; un "listo" en verde hace que el ojo lea un resultado donde solo hay un
 * paso de configuración terminado. Aquí manda el acero, que es el color de lo
 * medido, y el tenue para lo que todavía no existe.
 *
 * La forma es la misma impresión con borde del chip de resultado, no una
 * pastilla rellena.
 */
export function ChipEstado({
  children,
  tono = "tenue",
}: {
  children: React.ReactNode;
  /** `acero` para lo que ya está en pie; `tenue` para lo que falta. */
  tono?: "acero" | "tenue";
}) {
  return (
    <span
      className={`inline-block rounded-[2px] border px-2 pt-[3px] pb-[2px] text-[9.5px] font-medium tracking-[.12em] whitespace-nowrap uppercase ${mono} ${
        tono === "acero"
          ? "border-[var(--b-acero)] text-[var(--acero)]"
          : "border-[var(--linea-fuerte)] text-[var(--tenue)]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Aviso del sistema: se guardó, no se guardó, falta un paso.
 *
 * Va en azul —el color de los avisos y las acciones— tanto si salió bien como
 * si salió mal. Un "no se guardó" en rojo y un "guardado" en verde se leen como
 * `no cumplido` y `cumplido`, que es exactamente la confusión que el producto
 * no se puede permitir: el resultado de un servicio y el resultado de un
 * formulario no comparten alfabeto.
 */
export function AvisoSistema({
  lead,
  children,
}: {
  /** La primera frase, en azul. Ej. "No se guardó." · "Guardado." */
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--azul)]/40 bg-[var(--azul)]/10 p-4 text-[13.5px] text-[var(--texto)]">
      <span className="text-[var(--azul)]">{lead}</span> {children}
    </div>
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
