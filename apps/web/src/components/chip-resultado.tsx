import type { EstadoServicio } from "@jtel/services";

/**
 * El chip de resultado — impresión con borde, nunca pastilla rellena.
 *
 * Tres colores y nada más: verde cumplido, rojo no cumplido, ámbar pendiente
 * por evidencia. El color dice el resultado y solo el resultado.
 */
export function ChipResultado({ estado }: { estado: EstadoServicio }) {
  const conf =
    estado === "cumplido"
      ? { t: "Cumplido", c: "var(--verde)", b: "rgba(52,199,123,.07)" }
      : estado === "no_cumplido"
        ? { t: "No cumplido", c: "var(--rojo)", b: "rgba(229,72,77,.07)" }
        : { t: "Pendiente por evidencia", c: "var(--ambar)", b: "rgba(227,168,31,.07)" };
  return (
    <span
      className="inline-block rounded-sm border-[1.5px] px-2.5 pt-[3.5px] pb-[2.5px] font-mono text-[10.5px] font-medium tracking-[0.13em] whitespace-nowrap uppercase"
      style={{ color: conf.c, background: conf.b, borderColor: "currentColor" }}
    >
      {conf.t}
    </span>
  );
}
