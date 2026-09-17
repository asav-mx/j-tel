/**
 * Las clases de los controles de formulario de la casa.
 *
 * Eran constantes locales en cada página (el catálogo, el papel); los paneles de
 * C4 son los primeros que las necesitan desde componentes, y copiar una cuarta
 * vez es la forma en que dos botones terminan viéndose distintos.
 */
const boton =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] disabled:cursor-not-allowed disabled:opacity-45";

export const clases = {
  primario: `${boton} border-[var(--tinta)] bg-[var(--tinta)] text-[var(--papel)]`,
  secundario: `${boton} border-[var(--linea)] bg-[var(--pieza)] text-[var(--tinta)] hover:bg-[var(--roce)]`,
  /** Un botón que abre su panel: con el panel abierto, su borde lo dice. */
  abridor: (abierto: boolean) =>
    `${boton} bg-[var(--pieza)] text-[var(--tinta)] hover:bg-[var(--roce)] ${abierto ? "border-[var(--tinta)]" : "border-[var(--linea)]"}`,
  campo:
    "w-full rounded-lg border border-[var(--linea)] bg-[var(--papel)] px-3 py-2.5 text-[15px] text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]",
  panel: "flex flex-col gap-4 rounded-[10px] border border-[var(--tinta)] bg-[var(--pieza)] p-4",
  nota: "border-l-2 border-[var(--linea)] py-0.5 pl-2.5 text-[13px] text-[var(--tenue)]",
  aviso: "rounded-lg border border-[var(--tinta)] px-3 py-2.5 text-[13.5px]",
  ayuda: "text-[12.5px] text-[var(--tenue)]",
} as const;

export const estiloTitularDePanel = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" } as const;
