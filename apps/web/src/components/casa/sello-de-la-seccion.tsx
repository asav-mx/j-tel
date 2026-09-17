"use client";

import { usePathname } from "next/navigation";
import { selloActivo, type Grupo } from "@/lib/casa/casas";

/**
 * El sello de la sección donde se está, junto a la marca. **Sólo en celular.**
 *
 * En computadora cada sello vive encima de sus pestañas y se ven los tres a la
 * vez. En el teléfono la barra de abajo no tiene dónde ponerlos, y sin esto la
 * marca se caía entera: nadie que use J-Tel sólo desde el celular vería jamás
 * «Compás» ni «Vernier». Eso vacía media razón de la opción B — el menú lista
 * nombres de cosa **porque** la marca se graba por repetición del sello.
 *
 * Aquí la repetición cambia de forma, no desaparece: en vez de tres sellos a la
 * vez, uno que cambia al moverse de sección. Se ve tantas veces como veces se
 * cambie de sección, que en un turno son muchas.
 *
 * No aparece cuando no toca: en la puerta de la casa, y en los lugares que el
 * mapa dejó sin producto. La regla 4 vale también para la marca.
 */
export function SelloDeLaSeccion({ grupos, lugar }: { grupos: Grupo[]; lugar?: string }) {
  const enRuta = usePathname();
  const sello = selloActivo(grupos, lugar ?? enRuta);

  if (sello === null) return null;

  return (
    <span className="flex items-center gap-2 md:hidden">
      <span aria-hidden="true" className="h-3.5 w-px bg-[var(--linea)]" />
      <span
        data-medida
        className="text-[10px] uppercase tracking-[0.16em] text-[var(--tenue)]"
      >
        {sello}
      </span>
    </span>
  );
}
