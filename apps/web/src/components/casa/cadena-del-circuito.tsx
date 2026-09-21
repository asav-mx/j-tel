import type { Eslabon } from "@/lib/casa/cadena-del-circuito";

/**
 * La cadena de un circuito, dibujada. Dos tamaños: `linea` para la lista (una
 * línea de palabras) y `eslabones` para el expediente (siete botones que llevan
 * a su sección).
 *
 * Lo que pide va en tinta y con su palabra; lo que está al día, en tenue. **Sin
 * cobre** (ficha, corrección 2: un aviso no es vida) y **sin glifo** (ver
 * `lib/casa/cadena-del-circuito.ts`).
 */
export function CadenaEnLinea({ eslabones }: { eslabones: Eslabon[] }) {
  // Identidad, medición y publicar no van en la línea: la lista ya dice el nombre y la publicación.
  const enLinea = eslabones.filter((e) => e.paso >= 2 && e.paso <= 5);
  return (
    <span className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[12.5px] text-[var(--tenue)]">
      {enLinea.map((e) => (
        <span key={e.paso}>
          {e.nombre.toLowerCase()}{" "}
          <span className={e.pide ? "font-semibold text-[var(--tinta)]" : ""}>{e.resumen}</span>
        </span>
      ))}
    </span>
  );
}

export function CadenaEnEslabones({ eslabones }: { eslabones: Eslabon[] }) {
  return (
    <nav aria-label="La cadena del circuito" className="flex flex-wrap gap-1.5">
      {eslabones.map((e) => (
        <a
          key={e.paso}
          href={`#${e.ancla}`}
          className={`flex items-baseline gap-2 rounded-lg border px-3 py-2 text-[12.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] ${
            e.pide ? "border-[var(--tinta)] text-[var(--tinta)]" : "border-[var(--linea)] text-[var(--tenue)]"
          } bg-[var(--pieza)]`}
        >
          <span data-medida className="text-[11px]">
            {e.paso}
          </span>
          <span className="font-semibold">{e.nombre}</span>
          <span className={e.pide ? "" : "text-[var(--tenue)]"}>{e.resumen}</span>
        </a>
      ))}
    </nav>
  );
}
