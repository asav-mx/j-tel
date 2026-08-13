import { NextResponse } from "next/server";
import { getRepos, isDatabaseConfigured } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { revisarVentanas, agruparPorRutaTurno } from "@jtel/db";
import { avisoDeSimulacro, avisoVentanaDesalineada } from "@/lib/alertas/decision";
import { renderAvisos, PIE_HORAS_LIMITE } from "@/lib/alertas/correo";
import { ErrorDeCanal, resolverCanal } from "@/lib/alertas/canal";

export const dynamic = "force-dynamic";

/**
 * La ventana congelada · Frente A — revisa la ventana de lo que todavía no se
 * ha juzgado, y AVISA.
 *
 * Hermano de `revisar-horas-limite`, y a propósito: **es el mismo mecanismo en
 * otro campo.** `trips.evidence_window_start` se calcula al crear el viaje y
 * nadie la vuelve a mirar; la derivación aprende de la historia de cada ruta, y
 * esa historia crece. Es la forma de C21 —*congelar sin forma de revisar es el
 * patrón, no el campo*— después de la hora límite y la geocerca.
 *
 * ## No corrige, y eso es la decisión
 *
 * Corregir la ventana con la que se va a juzgar a un transportista **es decisión
 * de Asav, no de un programa**. Un cron que corrige en silencio no se distingue
 * de uno que no corre (regla 8), y su resultado llega sellado a un cliente.
 *
 * ## Una vez al día, después del generador
 *
 * La causa es **la historia creciendo**, no un incidente que aparece y se va:
 * mientras la decisión esté pendiente la población sigue ahí, y a cada hora esto
 * mandaría veinticuatro correos idénticos. **Una alerta que grita seguido enseña
 * a ignorarla.**
 *
 * ## Un cero tiene que distinguirse de un medidor ciego
 *
 * Si no había NADA que revisar, responde 503 en vez de «todo bien». Con la
 * ventana rodante generando treinta días por adelantado, cero ocurrencias sin
 * sellar **no es salud: es una lectura rota** — y las dos se ven igual de verdes
 * si nadie las separa.
 *
 * ## La deuda que hereda, dicha aquí y no escondida
 *
 * ⚠ **Nadie ha visto el correo de su hermano llegar a una bandeja** —las llaves
 * de Resend no existen fuera de producción—, y **este nace con la misma deuda**.
 * Detectar está probado; avisar no. Por eso existe `?simular=1`, y por eso este
 * cron **no cuenta como cerrado** hasta que su aviso se vea llegar (regla 16).
 *
 * `?dryRun=1` ensaya: revisa, arma el correo y lo devuelve sin mandarlo.
 */
export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/revisar-ventanas");
  if (negada) return negada;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL no está configurada" },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const ensayo = params.get("dryRun") === "1";
  const simulacro = params.get("simular") === "1";
  const ahora = new Date();

  // El canal ANTES de tocar la base: detectar sin poder avisar solo gasta el
  // hallazgo.
  const resolucion = resolverCanal({
    permitirConsola: process.env.NODE_ENV !== "production",
  });
  const canal = resolucion.ok ? resolucion.canal : null;
  const faltantes = resolucion.ok ? [] : resolucion.faltantes;

  if (!canal && !ensayo) {
    console.error(
      "[api/cron/revisar-ventanas] canal sin configurar:",
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
    const mensaje = renderAvisos([avisoDeSimulacro(ahora)], ahora, PIE_HORAS_LIMITE);
    try {
      const envio = await canal.mandar(mensaje);
      return NextResponse.json({
        simulacro: true,
        enviado: true,
        canal: envio.canal,
        destinatarios: envio.destinatarios.length,
        referencia: envio.referencia,
        asunto: mensaje.asunto,
      });
    } catch (err) {
      const motivo = err instanceof ErrorDeCanal ? err.message : String(err);
      console.error("[api/cron/revisar-ventanas] simulacro no entregado:", motivo);
      return NextResponse.json({ simulacro: true, enviado: false, error: motivo }, { status: 503 });
    }
  }

  const repos = getRepos();
  const { revisadas, desalineadas } = await revisarVentanas(repos);
  const grupos = agruparPorRutaTurno(desalineadas);

  const encabezado = {
    revisadas,
    desalineadas: desalineadas.length,
    grupos: grupos.length,
  };

  if (revisadas === 0) {
    console.error(
      "[api/cron/revisar-ventanas] no había nada que revisar — ver el 503 en el código",
    );
    return NextResponse.json(
      {
        ...encabezado,
        error:
          "cero ocurrencias sin sellar: no se puede distinguir «revisé y está todo alineado» de «la lectura no ve nada». Revisar /api/cron/renew-occurrences.",
      },
      { status: 503 },
    );
  }

  if (grupos.length === 0) {
    return NextResponse.json({ ...encabezado, enviado: false, motivo: "sin novedad" });
  }

  const avisos = grupos.map((g) => avisoVentanaDesalineada(g, ahora, revisadas));
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
    console.error("[api/cron/revisar-ventanas] no se pudo entregar:", motivo);
    // No escribe nada, así que la corrida de mañana vuelve a detectar lo mismo.
    // El 503 además marca la corrida como fallida en Vercel.
    return NextResponse.json(
      { ...encabezado, enviado: false, error: motivo },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
