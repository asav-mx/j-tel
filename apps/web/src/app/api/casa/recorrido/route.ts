import { NextResponse } from "next/server";
import { esGradoDeTrazo, gradoParaVentana, JTTEL_TZ, type GradoDeTrazo } from "@jtel/domain";
import { cargarRecorridoDeUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * GET /api/casa/recorrido — C3-b del cuarto de Compás: el recorrido de una
 * unidad en una ventana, listo para dibujar y reproducir.
 *
 *   ?account=<slug>&unidad=<id>&desde=<ISO con zona>&hasta=<ISO con zona>[&grado=0..3]
 *
 * **La caché (regla 10).** Una ventana cerrada (`cargarRecorridoDeUnidad`
 * decide qué es cerrada) se sirve como inmutable; todo lo demás revalida. Tres
 * cuidados:
 *
 *   · **`private`, nunca `public`.** La guardia corre aquí adentro; una caché
 *     compartida del CDN le entregaría el recorrido de una cuenta a quien
 *     tuviera la dirección, sin pasar por ella. Se guarda en el navegador de
 *     quien ya pasó la guardia.
 *   · **La clave es la dirección entera**, así que lleva la ventana y el
 *     grado. Sólo se congela si el grado vino escrito: si se omite, el
 *     servidor lo elige (`gradoParaVentana`) y ese criterio puede cambiar, así
 *     que esa respuesta revalida.
 *   · Los errores no se guardan.
 */
export const dynamic = "force-dynamic";

/** «Este mes» dura hasta 31 días; uno más de holgura por el cambio de horario. */
const VENTANA_MAXIMA_MS = 32 * 24 * 3_600_000;

/**
 * Un instante con zona escrita. `2026-09-14T06:00` sin zona se resolvería en
 * el reloj del servidor — el bug que ya selló 294 hechos con la hora
 * equivocada (ver `instanteZonificado`) — así que se rechaza.
 */
const INSTANTE_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const CACHE_CERRADA = "private, max-age=31536000, immutable";
const CACHE_ABIERTA = "private, no-cache";

function error(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status, headers: { "Cache-Control": "no-store" } });
}

function instante(raw: string | null): Date | null {
  if (!raw || !INSTANTE_CON_ZONA.test(raw)) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuenta = url.searchParams.get("account")?.trim() ?? "";
  if (!cuenta) return error("Falta la cuenta (account).", 400);

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, "json");
  if (!g.ok) return g.respuesta;

  const unitId = url.searchParams.get("unidad")?.trim() ?? "";
  if (!unitId) return error("Falta la unidad (unidad).", 400);

  const desde = instante(url.searchParams.get("desde"));
  const hasta = instante(url.searchParams.get("hasta"));
  if (!desde || !hasta) {
    return error("La ventana va en desde y hasta, como instantes ISO con zona (p. ej. 2026-09-14T06:00:00-06:00).", 400);
  }
  if (hasta.getTime() <= desde.getTime()) return error("La ventana termina antes de empezar.", 400);
  if (hasta.getTime() - desde.getTime() > VENTANA_MAXIMA_MS) {
    return error("La ventana dura más de 32 días.", 400);
  }
  const ventana = { desde, hasta };

  const gradoCrudo = url.searchParams.get("grado");
  let grado: GradoDeTrazo;
  if (gradoCrudo === null) {
    grado = gradoParaVentana(ventana);
  } else {
    const n = /^\d$/.test(gradoCrudo) ? Number(gradoCrudo) : Number.NaN;
    if (!esGradoDeTrazo(n)) return error("El grado va de 0 (detalle completo) a 3.", 400);
    grado = n;
  }

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

  const congelable = recorrido.cerrada && gradoCrudo !== null;
  return NextResponse.json(recorrido, {
    headers: { "Cache-Control": congelable ? CACHE_CERRADA : CACHE_ABIERTA },
  });
}
