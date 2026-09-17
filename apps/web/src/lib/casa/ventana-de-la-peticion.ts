import { NextResponse } from "next/server";
import { esGradoDeTrazo, gradoParaVentana, type GradoDeTrazo, type Ventana } from "@jtel/domain";

/**
 * La puerta común de los recorridos servidos (unidad y dispositivo): la
 * ventana, el grado y la caché se leen igual en los dos, o una pantalla
 * congelaría lo que la otra revalida.
 *
 * **La caché (regla 10).** Una ventana cerrada se sirve como inmutable; todo
 * lo demás revalida. `private`, nunca `public`: la guardia corre dentro del
 * endpoint, y una caché compartida del CDN entregaría el recorrido de una
 * cuenta a quien tuviera la dirección. Sólo se congela si el grado vino
 * escrito: si se omite, lo elige el servidor y ese criterio puede cambiar.
 */

/** «Este mes» dura hasta 31 días; uno más de holgura por el cambio de horario. */
const VENTANA_MAXIMA_MS = 32 * 24 * 3_600_000;

/**
 * Un instante con zona escrita. `2026-09-14T06:00` sin zona se resolvería en
 * el reloj del servidor — el bug que ya selló 294 hechos con la hora
 * equivocada (ver `instanteZonificado`) — así que se rechaza.
 */
const INSTANTE_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export const CACHE_CERRADA = "private, max-age=31536000, immutable";
export const CACHE_ABIERTA = "private, no-cache";

export function errorSinCache(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status, headers: { "Cache-Control": "no-store" } });
}

function instante(raw: string | null): Date | null {
  if (!raw || !INSTANTE_CON_ZONA.test(raw)) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ventanaYGradoDe(
  url: URL,
): { ok: true; ventana: Ventana; grado: GradoDeTrazo; gradoEscrito: boolean } | { ok: false; respuesta: NextResponse } {
  const desde = instante(url.searchParams.get("desde"));
  const hasta = instante(url.searchParams.get("hasta"));
  if (!desde || !hasta) {
    return {
      ok: false,
      respuesta: errorSinCache(
        "La ventana va en desde y hasta, como instantes ISO con zona (p. ej. 2026-09-14T06:00:00-06:00).",
        400,
      ),
    };
  }
  if (hasta.getTime() <= desde.getTime()) return { ok: false, respuesta: errorSinCache("La ventana termina antes de empezar.", 400) };
  if (hasta.getTime() - desde.getTime() > VENTANA_MAXIMA_MS) {
    return { ok: false, respuesta: errorSinCache("La ventana dura más de 32 días.", 400) };
  }
  const ventana = { desde, hasta };

  const crudo = url.searchParams.get("grado");
  if (crudo === null) return { ok: true, ventana, grado: gradoParaVentana(ventana), gradoEscrito: false };
  const n = /^\d$/.test(crudo) ? Number(crudo) : Number.NaN;
  if (!esGradoDeTrazo(n)) return { ok: false, respuesta: errorSinCache("El grado va de 0 (detalle completo) a 3.", 400) };
  return { ok: true, ventana, grado: n, gradoEscrito: true };
}
