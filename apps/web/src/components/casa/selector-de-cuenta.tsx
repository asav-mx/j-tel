"use client";

import { usePathname } from "next/navigation";
import { CASAS, cuartoDeLaRuta, type Cara, type CuentaDeLaCasa } from "@/lib/casa/casas";

/**
 * El selector de cuenta — para quien ve más de una.
 *
 * Un coordinador no edita la dirección a mano (Asav, 16 sep 2026). Es la misma
 * forma que «Elige un mercado» del catálogo de J-Staff: un `<select>` y un
 * botón, un formulario GET que funciona sin JavaScript. Del cliente sólo se usa
 * la ruta, para saber a qué cuarto volver.
 *
 * **Cambiar de cuenta lleva al cuarto, no a la ficha.** Estando en la unidad
 * 1042 de Juárez Bus y eligiendo ASAV, se llega a Expedientes de ASAV: la 1042
 * no es de ASAV. La regla vive en `cuartoDeLaRuta`.
 *
 * Las opciones son las `elegibles` que resolvió la guardia, así que el selector
 * no puede ofrecer una cuenta que después se rechace.
 */
export function SelectorDeCuenta({
  cara,
  elegibles,
  actual,
  id,
}: {
  cara: Cara;
  elegibles: CuentaDeLaCasa["elegibles"];
  actual: CuentaDeLaCasa["actual"];
  /** Dos selectores pueden convivir en la página (marco y cuerpo): cada uno con su id. */
  id: string;
}) {
  const destino = cuartoDeLaRuta(CASAS[cara], usePathname());

  return (
    <form method="get" action={destino} className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Cuenta
      </label>
      <select
        id={id}
        name="account"
        required
        defaultValue={actual?.slug ?? ""}
        className="min-w-0 max-w-[14rem] truncate rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-2.5 py-1.5 text-[13px] text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]"
      >
        {!actual && (
          <option value="" disabled>
            Elige una cuenta
          </option>
        )}
        {elegibles.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.nombre}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="flex-none cursor-pointer rounded-lg border border-[var(--linea)] px-2.5 py-1.5 text-[13px] hover:bg-[var(--roce)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
      >
        Ver
      </button>
    </form>
  );
}
