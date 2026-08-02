import { NextResponse } from "next/server";
import type { OperationalScope } from "@jtel/domain";
import { configApiRedirectPath, type ConfigRedirectStep } from "@/lib/unit-routes";

/**
 * Regresa a la pantalla de configuración con un aviso en la URL.
 *
 * **El alcance tiene que venir RESUELTO. Si no resolvió, va `null`.**
 *
 * `parseOperationalScope` y `resolveOperationalScope` devuelven la misma forma,
 * así que el tipo no distingue un alcance que existe de uno que solo se leyó
 * del formulario. Pasar el segundo manda al usuario a `/cliente/planta/<id que
 * no existe>`, que responde 404 de Next: el mensaje viaja en la URL y nadie lo
 * lee nunca. Un error que no se ve es peor que no tenerlo, porque quien lo
 * escribió creyó que estaba informando.
 *
 * Con `null` el aviso aterriza en el inicio corporativo, que sí lo dibuja —
 * y es el destino honesto: si el sitio no existe, no hay página de sitio a la
 * cual volver. El caso no es de laboratorio: una planta borrada en otra
 * pestaña y luego guardar llega justo aquí.
 */
export function configApiBack(
  request: Request,
  slug: string,
  step: ConfigRedirectStep,
  resolvedScope: OperationalScope | null,
  params: Record<string, string>,
) {
  const path = resolvedScope
    ? configApiRedirectPath(resolvedScope, slug, step)
    : `/cliente?account=${encodeURIComponent(slug)}`;
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}
