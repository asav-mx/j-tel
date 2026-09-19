"use client";

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]";

/**
 * Los chips con su rótulo: los de Servicios especiales (#448) y los del
 * archivero de Expedientes. Viven aparte para que las dos pantallas no dibujen
 * dos chips distintos del mismo gesto.
 */

/** Un chip que prende y apaga. Activo = borde y letra en tinta; la forma del borde lo dice, no un color. */
export function Chip({
  activo,
  alTocar,
  medida = false,
  children,
}: {
  activo: boolean;
  alTocar: () => void;
  medida?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alTocar}
      data-medida={medida || undefined}
      className={`cursor-pointer rounded-full border px-3 py-1 ${medida ? "text-[12px]" : "text-[12.5px]"} transition-colors ${
        activo ? "border-[var(--tinta)] text-[var(--tinta)]" : "border-[var(--linea)] text-[var(--tenue)] hover:text-[var(--tinta)]"
      } ${foco}`}
    >
      {children}
    </button>
  );
}

/**
 * Una fila de chips con su rótulo a la izquierda, en mono y mayúsculas chicas,
 * como los títulos de sección (Asav, 19 sep 2026): CONTRATO, TURNO. El rótulo
 * tiene ancho fijo para que las dos filas empiecen sus chips en la misma
 * columna; en celular los chips bajan de renglón junto a él.
 */
export function FilaDeChips({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="flex items-baseline gap-3">
      <span data-medida aria-hidden="true" className="w-[64px] flex-none text-[10.5px] uppercase tracking-[0.2em] text-[var(--tenue)]">
        {rotulo}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
