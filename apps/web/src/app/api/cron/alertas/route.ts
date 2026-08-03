import { NextResponse } from "next/server";
import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { aplicarIncidentes, detectarAvisos } from "@/lib/alertas/datos";
import { renderAvisos } from "@/lib/alertas/correo";
import { ErrorDeCanal, resolverCanal } from "@/lib/alertas/canal";
import { INTERVALO_ALERTAS_MINUTOS, cubetaDeCorrida } from "@/lib/alertas/decision";

export const dynamic = "force-dynamic";

/**
 * La entrega de los avisos inmediatos. Corre cada 5 min (ver `vercel.json`).
 *
 * Tres cosas que parecen detalles y no lo son:
 *
 * 1. **El canal se resuelve antes de tocar la base.** Si falta configuración,
 *    esta corrida no detecta ni escribe nada: contesta 503 diciendo qué falta.
 *    Detectar sin poder avisar solo sirve para gastar el incidente.
 * 2. **La base se escribe al final, y solo si el correo salió.** La fila de
 *    `ingest_alerts` es la memoria de "ya avisamos"; escribirla antes de un
 *    envío que falla convierte el aviso en uno que ya nunca sale.
 * 3. **Un fallo del canal responde 503.** Vercel marca la corrida como fallida
 *    y eso queda a la vista. Un 200 con el error escondido en el cuerpo es el
 *    mismo silencio que esta ruta existe para romper.
 *
 * `?dryRun=1` ensaya: detecta, arma el correo y lo devuelve en la respuesta
 * sin mandarlo y sin escribir nada. Es como se revisa la redacción sin
 * esperar a que algo se caiga de verdad.
 */
export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/alertas");
  if (negada) return negada;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL no está configurada" },
      { status: 503 },
    );
  }

  const ensayo = new URL(request.url).searchParams.get("dryRun") === "1";
  const ahora = new Date();
  const cubeta = cubetaDeCorrida(ahora);

  const resolucion = resolverCanal({
    // En producción nunca cae a consola: un aviso que solo va al log del
    // servidor es exactamente el problema que estamos arreglando.
    permitirConsola: process.env.NODE_ENV !== "production",
  });
  const canal = resolucion.ok ? resolucion.canal : null;
  const faltantes = resolucion.ok ? [] : resolucion.faltantes;

  if (!canal && !ensayo) {
    console.error("[api/cron/alertas] canal sin configurar:", faltantes.join(", "));
    return NextResponse.json(
      { error: "el canal de alertas no está configurado", faltantes },
      { status: 503 },
    );
  }

  const repos = getRepos();
  const deteccion = await detectarAvisos(repos, ahora);

  const encabezado = {
    cubeta: { desde: cubeta.desde.toISOString(), hasta: cubeta.hasta.toISOString() },
    intervaloMinutos: INTERVALO_ALERTAS_MINUTOS,
    avisos: deteccion.avisos.length,
    clases: deteccion.avisos.map((a) => a.clase),
    // Si el tope se alcanzó, pudo haber resoluciones fuera de la lectura. Se
    // dice; una cota callada se lee como "no había nada más".
    topeDeLecturaAlcanzado: deteccion.topeAlcanzado,
  };

  if (deteccion.avisos.length === 0) {
    return NextResponse.json({ ...encabezado, enviado: false, motivo: "sin novedad" });
  }

  const mensaje = renderAvisos(deteccion.avisos, ahora);

  if (ensayo || !canal) {
    return NextResponse.json({
      ...encabezado,
      ensayo: true,
      enviado: false,
      canal: canal ? canal.nombre : { faltantes },
      incidentesQueSeAbririan: deteccion.pendientes.abrir,
      incidentesQueSeCerrarian: deteccion.pendientes.cerrar,
      asunto: mensaje.asunto,
      texto: mensaje.texto,
      html: mensaje.html,
    });
  }

  try {
    const envio = await canal.mandar(mensaje);
    await aplicarIncidentes(repos, deteccion.pendientes);
    return NextResponse.json({
      ...encabezado,
      enviado: true,
      canal: envio.canal,
      destinatarios: envio.destinatarios.length,
      referencia: envio.referencia,
      incidentesAbiertos: deteccion.pendientes.abrir.length,
      incidentesCerrados: deteccion.pendientes.cerrar.length,
    });
  } catch (err) {
    const motivo = err instanceof ErrorDeCanal ? err.message : String(err);
    console.error("[api/cron/alertas] no se pudo entregar:", motivo);
    // Nada se escribió, así que la siguiente corrida vuelve a detectar esto
    // mismo y lo vuelve a intentar.
    return NextResponse.json(
      { ...encabezado, enviado: false, error: motivo },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
