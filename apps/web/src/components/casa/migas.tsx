import Link from "next/link";

/**
 * El camino de regreso.
 *
 * La regla 2 del mapa: a una ficha se llega tocando una pieza, desde cualquier
 * lugar donde esa cosa aparezca, y **siempre con camino de regreso**. Esto es
 * ese camino, y por eso vive en el cascarón: si cada ficha inventara el suyo,
 * habría callejones sin salida en unas pantallas y no en otras.
 *
 * Registra el descenso, que es distinto de la jerarquía de la URL: se llega a
 * una unidad desde Flota en vivo o desde el cajón Dispositivos, y el regreso tiene que
 * devolver a donde se venía, no a un padre teórico. Por eso los pasos los pone
 * quien navega, no el enrutador.
 *
 * El último paso es dónde se está: se dice, pero no es liga. Una liga a la
 * pantalla en la que ya estás promete un viaje que no ocurre.
 */
export function Migas({ pasos }: { pasos: { nombre: string; ruta?: string }[] }) {
  if (pasos.length === 0) return null;

  return (
    <nav aria-label="Camino de regreso" className="flex flex-wrap items-center gap-1.5 text-[13px]">
      {pasos.map((paso, i) => {
        const ultimo = i === pasos.length - 1;
        return (
          <span key={`${paso.nombre}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden="true" className="text-[var(--tenue)]">
                ·
              </span>
            )}
            {paso.ruta && !ultimo ? (
              <Link
                href={paso.ruta}
                className="cursor-pointer text-[var(--tenue)] underline decoration-[var(--linea)] underline-offset-4 transition-colors hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
              >
                {paso.nombre}
              </Link>
            ) : (
              <span aria-current={ultimo ? "page" : undefined} className="text-[var(--tenue)]">
                {paso.nombre}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
