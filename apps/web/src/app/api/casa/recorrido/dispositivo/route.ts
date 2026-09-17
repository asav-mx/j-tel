import { NextResponse } from "next/server";
import { JTTEL_TZ } from "@jtel/domain";
import { cargarRecorridoDeDispositivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { correosDeAutores } from "@/lib/casa/autores";
import { CACHE_ABIERTA, CACHE_CERRADA, errorSinCache as error, ventanaYGradoDe } from "@/lib/casa/ventana-de-la-peticion";

/**
 * GET /api/casa/recorrido/dispositivo — el recorrido de un dispositivo en una
 * ventana, partido en etapas por unidad (ver `cargarRecorridoDeDispositivo`).
 *
 *   ?account=<slug>&dispositivo=<id>&desde=<ISO con zona>&hasta=<ISO con zona>[&grado=0..3]
 *
 * Misma puerta y misma caché que el de la unidad (`ventanaYGradoDe`). Lo único
 * que agrega es `autores`: el correo de quien montó o soltó el aparato, para
 * que el playback diga quién al detenerse en un cambio. Nunca se inventa un
 * nombre: si no se puede leer, va el id tal como quedó guardado.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuenta = url.searchParams.get("account")?.trim() ?? "";
  if (!cuenta) return error("Falta la cuenta (account).", 400);

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, "json");
  if (!g.ok) return g.respuesta;

  const deviceId = url.searchParams.get("dispositivo")?.trim() ?? "";
  if (!deviceId) return error("Falta el dispositivo (dispositivo).", 400);

  const leida = ventanaYGradoDe(url);
  if (!leida.ok) return leida.respuesta;
  const { ventana, grado, gradoEscrito } = leida;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return error("No hay un transportista con esa cuenta.", 404);

  const recorrido = await cargarRecorridoDeDispositivo(repos, {
    carrierAccountId: carrier.id,
    deviceId,
    ventana,
    grado,
    ahora: new Date(),
    timeZone: JTTEL_TZ,
  });
  if (!recorrido) return error("Ese dispositivo no es de esta cuenta.", 404);

  const ids = recorrido.etapas.flatMap((e) => (e.tipo === "unidad" ? [e.asignadaPor, e.cerradaPor] : []));
  const autores = Object.fromEntries(await correosDeAutores(ids));

  const congelable = recorrido.cerrada && gradoEscrito;
  return NextResponse.json(
    { ...recorrido, autores },
    { headers: { "Cache-Control": congelable ? CACHE_CERRADA : CACHE_ABIERTA } },
  );
}
