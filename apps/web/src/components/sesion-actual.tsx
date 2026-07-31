import Link from "next/link";
import { getIdentidad, type OrigenDeIdentidad } from "@/lib/auth";

/**
 * Quién soy, en una línea, en toda pantalla que lleve encabezado.
 *
 * Va en acero y azul a propósito. Una sesión es **estado operativo**, no un
 * resultado: verde, ámbar y rojo son de los veredictos y no se prestan ni para
 * decir "conectado". La misma regla por la que el correo de alertas no lleva
 * rojo.
 */

export const ORIGEN_CORTO: Record<OrigenDeIdentidad, string> = {
  clerk: "sesión",
  "encabezado-dev": "encabezado",
  "variable-dev": "variable",
  "default-heredado": "por defecto",
};

/**
 * Vive en el layout raíz y no en el encabezado de la app por dos razones: el
 * layout es servidor puro —meterlo en `ui.tsx` arrastraría el SDK de servidor
 * de Clerk al bundle de cliente, porque de ahí importan componentes de
 * cliente— y así aparece también en las pantallas que no llevan encabezado.
 *
 * No se pinta sobre el landing: es público, no trata datos ni veredictos, y un
 * distintivo de identidad interna no tiene nada que hacer ahí.
 */
export async function SesionActual() {
  const { headers } = await import("next/headers");
  const ruta = (await headers()).get("x-jtel-path") ?? "";
  if (ruta.startsWith("/landing")) return null;

  const id = await getIdentidad();

  return (
    <Link
      href="/quien-soy"
      className="fixed right-3 bottom-3 z-50 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-[var(--linea)] bg-[var(--panel)]/95 px-2.5 py-1 font-mono text-[11px] whitespace-nowrap text-[var(--tenue)] transition-colors hover:border-[var(--azul)] hover:text-[var(--azul)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]"
      title="Ver identidad, origen y membresías"
    >
      <span
        aria-hidden="true"
        className="h-[5px] w-[5px] flex-none rounded-full"
        style={{ background: id.sesionActiva ? "var(--acero)" : "var(--tenue)" }}
      />
      <span className="text-[var(--acero)]">{id.userId}</span>
      <span>· {ORIGEN_CORTO[id.origen]}</span>
      {id.memberships.length === 0 ? <span>· sin membresías</span> : null}
    </Link>
  );
}
