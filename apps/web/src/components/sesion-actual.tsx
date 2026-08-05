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
  anonimo: "sin identidad",
};

/**
 * El distintivo, sin resguardo. Lo envuelve `SesionActual`.
 *
 * Vive en el layout raíz y no en el encabezado de la app por dos razones: el
 * layout es servidor puro —meterlo en `ui.tsx` arrastraría el SDK de servidor
 * de Clerk al bundle de cliente, porque de ahí importan componentes de
 * cliente— y así aparece también en las pantallas que no llevan encabezado.
 *
 * No se pinta sobre el landing: es público, no trata datos ni veredictos, y un
 * distintivo de identidad interna no tiene nada que hacer ahí.
 *
 * Tampoco sobre `/entrar`, y por una razón más fuerte que la del landing: ahí
 * **se contradecía con la pantalla**. La puerta dice «necesitas entrar» y el
 * distintivo, en la esquina, decía `tecma_admin · variable` — o sea, le
 * anunciaba a un visitante sin sesión un identificador interno y, de paso, que
 * el bypass está puesto. Medido en el arranque de producción local al construir
 * la pieza 1.i.
 */
async function distintivo() {
  const { headers } = await import("next/headers");
  const ruta = (await headers()).get("x-jtel-path") ?? "";
  if (ruta.startsWith("/landing")) return null;
  if (ruta.startsWith("/entrar")) return null;
  /*
   * Tampoco donde ya hay navegación lateral: su caja de usuario dice lo mismo
   * y mejor, en el lugar que le toca. Este distintivo sigue vivo para carrier
   * y J-Staff, que todavía no tienen nav — cuando la tengan, se borra entero.
   */
  if (ruta.startsWith("/cliente")) return null;

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
      <span className="text-[var(--acero)]">{id.userId ?? "nadie"}</span>
      <span>· {ORIGEN_CORTO[id.origen]}</span>
      {id.memberships.length === 0 ? <span>· sin membresías</span> : null}
    </Link>
  );
}

/**
 * Quién soy — con resguardo. **Un adorno no puede tumbar lo que lo hospeda.**
 *
 * Esto cuelga del layout raíz, así que se renderiza en TODAS las pantallas y
 * `getIdentidad()` consulta la base. Sin resguardo, una base caída o sin
 * configurar lanzaba aquí y se llevaba la página entera — incluida `/`, que
 * está escrita justo para atrapar ese fallo y explicar cómo conectar Neon.
 * Perdíamos el diagnóstico exactamente cuando más sirve, y lo cambiábamos por
 * una pantalla en blanco.
 *
 * Se atrapa TODO, no solo el fallo de base: si el encabezado de ruta no llegó,
 * si Clerk contesta raro, si la consulta expira. Ninguna de esas cosas
 * justifica dejar sin pantalla a quien está tratando de arreglarlas.
 */
export async function SesionActual() {
  try {
    return await distintivo();
  } catch {
    return null;
  }
}
