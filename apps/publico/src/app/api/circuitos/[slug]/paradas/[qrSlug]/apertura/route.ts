import { NextResponse } from "next/server";
import { fechaLocalDelCircuito, huellaDeAperturaDeParada } from "@jtel/domain/publico";
import { getRepos } from "@/lib/db";
import { circuitoParaLaApp } from "@/lib/vista-previa";

/**
 * **La apertura de una PARADA.** El contador hermano del de la ruta.
 *
 * ## Por qué cuelga del circuito y no vive en `/api/paradas/…`
 *
 * No es por jerarquía: es por el **firewall**. La regla de tasa del panel apunta
 * a `/api/circuitos/*`, y la `Ficha-Contador-Anonimo` apoya explícitamente la
 * escritura abierta en que «el firewall ya la cubre… hereda el límite sin tocar
 * el panel». Una ruta en `/api/paradas/*` **no heredaría nada**, y estrenaríamos
 * una segunda escritura pública sin el límite que justifica a la primera — sin
 * que nada fallara ni nadie se enterara.
 *
 * De paso, tener el circuito en la dirección es lo que permite comprobar que la
 * parada es suya antes de contarla.
 *
 * ## Lo que se comprueba antes de contar
 *
 * **Que el circuito sea visible**, con `circuitoParaLaApp`: un circuito no
 * publicado contesta lo mismo que un slug inventado, igual que el de la ruta.
 *
 * **Que la parada sea de ese circuito.** Sin esto, cualquiera podría sumarle
 * aperturas a la parada de otra ruta mandando el slug que quisiera, y la cifra
 * dejaría de decir lo que dice.
 *
 * Todo lo demás —la huella rotada por día, la fecha civil del circuito, que ni
 * la IP ni el agente crucen hacia la base, el 204 sin cuerpo y sin caché— es lo
 * mismo que en `../../apertura/route.ts`, a propósito. Ahí está el argumento
 * completo; no se repite aquí para que no se separen.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string; qrSlug: string }> },
) {
  const { slug, qrSlug } = await ctx.params;

  const visible = await circuitoParaLaApp(slug);
  if (!visible) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }
  const { circuito } = visible;

  const parada = await getRepos().circuits.paradaDelCircuitoPorQr(circuito.id, qrSlug);
  if (!parada) {
    return NextResponse.json({ error: "No existe esa parada" }, { status: 404 });
  }

  const secreto = process.env.JTEL_SECRET_KEY;
  if (!secreto) {
    /* Misma decisión que en el contador de la ruta: sin llave NO se cuenta, se
       contesta 204 igual, y se grita en el registro del servidor — porque un
       cero de este contador no significa que nadie abrió una parada. */
    console.error(
      "[apertura-parada] Falta JTEL_SECRET_KEY: las aperturas de parada NO se están contando. " +
        "Un cero de este contador hoy no significa que nadie abrió una parada.",
    );
    return sinCuerpo();
  }

  const fechaLocal = fechaLocalDelCircuito(new Date(), circuito.timeZone);

  await getRepos().circuits.registrarAperturaDeParada({
    stopId: parada.id,
    localDate: fechaLocal,
    fingerprint: huellaDeAperturaDeParada({
      ip: ipDe(request),
      agente: request.headers.get("user-agent") ?? "",
      fechaLocal,
      paradaId: parada.id,
      secreto,
    }),
  });

  return sinCuerpo();
}

/** La primera del `x-forwarded-for` es la del cliente; las demás son proxies. */
function ipDe(request: Request): string {
  const cadena = request.headers.get("x-forwarded-for");
  if (cadena) return cadena.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

function sinCuerpo() {
  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
