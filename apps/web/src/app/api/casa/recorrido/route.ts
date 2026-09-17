import { NextResponse } from "next/server";
import { JTTEL_TZ } from "@jtel/domain";
import { cargarRecorridoDeUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { CACHE_ABIERTA, CACHE_CERRADA, errorSinCache as error, ventanaYGradoDe } from "@/lib/casa/ventana-de-la-peticion";

/**
 * GET /api/casa/recorrido — C3-b del cuarto de Compás: el recorrido de una
 * unidad en una ventana, listo para dibujar y reproducir.
 *
 *   ?account=<slug>&unidad=<id>&desde=<ISO con zona>&hasta=<ISO con zona>[&grado=0..3]
 *
 * La ventana, el grado y la caché (regla 10) se leen en `ventanaYGradoDe`, la
 * misma puerta que usa el recorrido del dispositivo. Los errores no se guardan.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuenta = url.searchParams.get("account")?.trim() ?? "";
  if (!cuenta) return error("Falta la cuenta (account).", 400);

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, "json");
  if (!g.ok) return g.respuesta;

  const unitId = url.searchParams.get("unidad")?.trim() ?? "";
  if (!unitId) return error("Falta la unidad (unidad).", 400);

  const leida = ventanaYGradoDe(url);
  if (!leida.ok) return leida.respuesta;
  const { ventana, grado, gradoEscrito } = leida;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return error("No hay un transportista con esa cuenta.", 404);

  const recorrido = await cargarRecorridoDeUnidad(repos, {
    carrierAccountId: carrier.id,
    unitId,
    ventana,
    grado,
    ahora: new Date(),
    timeZone: JTTEL_TZ,
  });
  if (!recorrido) return error("Esa unidad no es de esta cuenta.", 404);

  const congelable = recorrido.cerrada && gradoEscrito;
  return NextResponse.json(recorrido, {
    headers: { "Cache-Control": congelable ? CACHE_CERRADA : CACHE_ABIERTA },
  });
}
