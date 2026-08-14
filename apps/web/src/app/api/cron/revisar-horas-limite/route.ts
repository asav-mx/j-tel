import { NextResponse } from "next/server";
import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { revisarHorasLimite } from "@jtel/db";
import {
  agruparDesalineadas,
  avisoDeSimulacro,
  avisoHoraLimiteVieja,
} from "@/lib/alertas/decision";
import { renderAvisos, PIE_HORAS_LIMITE } from "@/lib/alertas/correo";
import { ErrorDeCanal, resolverCanal } from "@/lib/alertas/canal";

export const dynamic = "force-dynamic";

/**
 * C21 · El cron que revisa la hora límite de lo que todavía no se ha juzgado,
 * y AVISA.
 *
 * Corre una vez al día, después del generador (ver `vercel.json`). Compara la
 * hora límite congelada de cada ocurrencia sin sellar contra la que hoy se
 * derivaría de su turno y su política, y manda un correo si difieren.
 *
 * ## No corrige, y eso es la decisión, no una limitación
 *
 * Corregir en silencio la ventana con la que se va a juzgar a un transportista
 * es decisión de Asav, no de un programa: un cron que corrige solo no se
 * distingue de uno que no corre, y el resultado de su trabajo llega sellado a
 * un cliente. Las otras dos opciones —regenerar al detectar el cambio, y
 * derivar la hora al leer en vez de congelarla— se descartaron con su motivo
 * en el Tramo 3 del plan.
 *
 * ## Una vez al día, y por qué no más seguido
 *
 * La causa de este aviso es una persona moviendo un turno, no un incidente que
 * aparece y se va. Mientras la decisión de corregir esté pendiente, la
 * población sigue ahí: a cada hora, esto mandaría veinticuatro correos
 * idénticos al día por el mismo hecho, y una alerta que grita seguido enseña a
 * ignorarla. Una vez al día acota la latencia a menos de veinticuatro horas
 * —que es lo que ataca el costo real de C21, doce ocurrencias selladas mientras
 * se decidía— sin volver ruido el canal.
 *
 * ## Un cero tiene que poder distinguirse de un medidor ciego
 *
 * Si la revisión no encontró NADA que revisar, esto responde 503 en vez de
 * "todo bien". La ventana rodante genera treinta días por adelantado, así que
 * cero ocurrencias sin sellar no es un sistema sano: es una lectura que falló
 * o un generador que dejó de correr, y las dos se ven idénticas a la buena
 * noticia si nadie las separa.
 *
 * `?dryRun=1` ensaya: revisa, arma el correo y lo devuelve en la respuesta sin
 * mandarlo. Es como se revisa la redacción sin esperar a que un turno se mueva.
 */
export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/revisar-horas-limite");
  if (negada) return negada;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL no está configurada" },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const ensayo = params.get("dryRun") === "1";
  /*
   * El simulacro — regla 16, y el mismo mecanismo que `simular_codigo` en
   * `salud.yml`. Manda un aviso POR EL CANAL DE VERDAD para comprobar que
   * llega a una bandeja.
   *
   * Hace falta aquí en particular porque el detector encuentra cero: al 7 de
   * agosto de 2026 no queda ninguna ocurrencia sin sellar con la hora límite
   * vieja, así que una corrida limpia no distingue un canal sano de uno mudo.
   * Provocarlo moviendo un turno real está descartado — eso ensucia datos de un
   * cliente vivo para probar una plomería.
   *
   * No lee la base y no escribe nada. Se anuncia como simulacro en el asunto,
   * en el título y en la acción: un correo de prueba que se lee como hallazgo
   * real es §D del Marco, y mandaría a alguien a buscar servicios que no
   * existen.
   */
  const simulacro = params.get("simular") === "1";
  const ahora = new Date();

  // El canal se resuelve ANTES de tocar la base: detectar sin poder avisar solo
  // sirve para gastar el hallazgo.
  const resolucion = resolverCanal({
    permitirConsola: process.env.NODE_ENV !== "production",
  });
  const canal = resolucion.ok ? resolucion.canal : null;
  const faltantes = resolucion.ok ? [] : resolucion.faltantes;

  if (!canal && !ensayo) {
    console.error(
      "[api/cron/revisar-horas-limite] canal sin configurar:",
      faltantes.join(", "),
    );
    return NextResponse.json(
      { error: "el canal de alertas no está configurado", faltantes },
      { status: 503 },
    );
  }

  if (simulacro) {
    if (!canal) {
      return NextResponse.json(
        { error: "no se puede simular sin canal", faltantes },
        { status: 503 },
      );
    }
    const mensaje = renderAvisos([avisoDeSimulacro(ahora, "revisar-horas-limite")], ahora, PIE_HORAS_LIMITE);
    try {
      const envio = await canal.mandar(mensaje);
      return NextResponse.json({
        simulacro: true,
        enviado: true,
        canal: envio.canal,
        destinatarios: envio.destinatarios.length,
        // La referencia del proveedor: es con lo que se rastrea la ENTREGA.
        // «Se mandó» y «llegó» son dos cosas, y esta es la que permite ir a
        // preguntar por la segunda.
        referencia: envio.referencia,
        asunto: mensaje.asunto,
      });
    } catch (err) {
      const motivo = err instanceof ErrorDeCanal ? err.message : String(err);
      console.error("[api/cron/revisar-horas-limite] simulacro no entregado:", motivo);
      return NextResponse.json({ simulacro: true, enviado: false, error: motivo }, { status: 503 });
    }
  }

  const repos = getRepos();
  const { revisadas, desalineadas } = await revisarHorasLimite(repos);
  const grupos = agruparDesalineadas(desalineadas);

  const encabezado = {
    revisadas,
    desalineadas: desalineadas.length,
    grupos: grupos.length,
  };

  if (revisadas === 0) {
    console.error(
      "[api/cron/revisar-horas-limite] no había nada que revisar — ver el 503 en el código",
    );
    return NextResponse.json(
      {
        ...encabezado,
        error:
          "cero ocurrencias sin sellar por delante: no se puede distinguir «revisé y está todo alineado» de «la lectura no ve nada». Revisar /api/cron/renew-occurrences.",
      },
      { status: 503 },
    );
  }

  if (grupos.length === 0) {
    return NextResponse.json({ ...encabezado, enviado: false, motivo: "sin novedad" });
  }

  const avisos = grupos.map((g) => avisoHoraLimiteVieja(g, ahora, revisadas));
  const mensaje = renderAvisos(avisos, ahora, PIE_HORAS_LIMITE);

  if (ensayo || !canal) {
    return NextResponse.json({
      ...encabezado,
      ensayo: true,
      enviado: false,
      canal: canal ? canal.nombre : { faltantes },
      asunto: mensaje.asunto,
      texto: mensaje.texto,
      html: mensaje.html,
    });
  }

  try {
    const envio = await canal.mandar(mensaje);
    return NextResponse.json({
      ...encabezado,
      enviado: true,
      canal: envio.canal,
      destinatarios: envio.destinatarios.length,
      referencia: envio.referencia,
    });
  } catch (err) {
    const motivo = err instanceof ErrorDeCanal ? err.message : String(err);
    console.error("[api/cron/revisar-horas-limite] no se pudo entregar:", motivo);
    // Esta ruta no escribe nada, así que la corrida de mañana vuelve a detectar
    // lo mismo y lo vuelve a intentar. Un 503 además marca la corrida como
    // fallida en Vercel, que es otro camino para enterarse.
    return NextResponse.json(
      { ...encabezado, enviado: false, error: motivo },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
