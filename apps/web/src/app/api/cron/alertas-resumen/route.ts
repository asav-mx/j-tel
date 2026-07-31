import { NextResponse } from "next/server";
import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { armarResumen } from "@/lib/alertas/datos";
import { renderResumen } from "@/lib/alertas/correo";
import { ErrorDeCanal, resolverCanal } from "@/lib/alertas/canal";

export const dynamic = "force-dynamic";

/**
 * El resumen diario. Corre a las 07:00 de Ciudad Juárez (13:00 UTC).
 *
 * Sale TODOS los días, haya o no incidentes, y esa es su razón de ser más que
 * el contenido: un canal que solo habla cuando hay desgracias no se distingue
 * de un canal roto. Si un día no llega el resumen, lo que está caído es la
 * plomería de alertas — y entonces el silencio de los avisos inmediatos no
 * significa que todo esté bien.
 *
 * Aquí es también donde aterriza todo lo que a propósito NO dispara un aviso
 * inmediato: los rate limits, los errores sueltos de archivo, y el rezago de
 * servicios sin veredicto que se acumuló.
 *
 * `?dryRun=1` ensaya sin mandar.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL no está configurada" },
      { status: 503 },
    );
  }

  const ensayo = new URL(request.url).searchParams.get("dryRun") === "1";
  const ahora = new Date();

  const resolucion = resolverCanal({
    permitirConsola: process.env.NODE_ENV !== "production",
  });
  const canal = resolucion.ok ? resolucion.canal : null;
  const faltantes = resolucion.ok ? [] : resolucion.faltantes;

  if (!canal && !ensayo) {
    console.error("[api/cron/alertas-resumen] canal sin configurar:", faltantes.join(", "));
    return NextResponse.json(
      { error: "el canal de alertas no está configurado", faltantes },
      { status: 503 },
    );
  }

  const repos = getRepos();
  const resumen = await armarResumen(repos, ahora);
  const mensaje = renderResumen(resumen, ahora);

  if (ensayo || !canal) {
    return NextResponse.json({
      ensayo: true,
      enviado: false,
      canal: canal ? canal.nombre : { faltantes },
      resumen,
      asunto: mensaje.asunto,
      texto: mensaje.texto,
      html: mensaje.html,
    });
  }

  try {
    const envio = await canal.mandar(mensaje);
    return NextResponse.json({
      enviado: true,
      dia: resumen.dia,
      salud: resumen.saludAhora,
      canal: envio.canal,
      destinatarios: envio.destinatarios.length,
      referencia: envio.referencia,
    });
  } catch (err) {
    const motivo = err instanceof ErrorDeCanal ? err.message : String(err);
    console.error("[api/cron/alertas-resumen] no se pudo entregar:", motivo);
    return NextResponse.json({ enviado: false, error: motivo }, { status: 503 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
