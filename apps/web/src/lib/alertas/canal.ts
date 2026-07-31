/**
 * El canal: por dónde sale un aviso para llegarle a una persona.
 *
 * Hoy hay una sola implementación —correo por Resend— pero todo lo de arriba
 * habla contra la interfaz `Canal`. Agregar un webhook después es un archivo
 * nuevo y una línea en `resolverCanal`, no una cirugía.
 *
 * Resend se llama con `fetch` a propósito: su SDK no aporta nada sobre un POST
 * con tres campos, y una dependencia menos en `apps/web` es una cosa menos que
 * pueda romper un build.
 *
 * ## Un canal mal configurado tiene que doler
 *
 * El fallo que esta plomería existe para arreglar es el silencio, así que el
 * modo de fallar más peligroso es "se envió a ninguna parte y nadie se enteró".
 * Por eso aquí no hay `catch` que se trague nada: si falta configuración o
 * Resend contesta mal, sale un error con su motivo, la ruta responde 503 y
 * Vercel marca la corrida como fallida — que es un canal más para enterarse.
 */

const RESEND_URL = "https://api.resend.com/emails";

/** Sin esto, una corrida colgada se ve igual que una corrida sana. */
const TIMEOUT_MS = 10_000;

export type Mensaje = {
  asunto: string;
  html: string;
  texto: string;
};

export type ResultadoEnvio = {
  canal: string;
  destinatarios: string[];
  /** El identificador que devuelve el proveedor, para rastrear un envío. */
  referencia?: string;
};

export interface Canal {
  readonly nombre: string;
  mandar(mensaje: Mensaje): Promise<ResultadoEnvio>;
}

export class ErrorDeCanal extends Error {
  constructor(
    message: string,
    readonly canal: string,
  ) {
    super(message);
    this.name = "ErrorDeCanal";
  }
}

export class CanalResend implements Canal {
  readonly nombre = "correo/resend";

  constructor(
    private apiKey: string,
    private remitente: string,
    private destinatarios: string[],
  ) {}

  async mandar(mensaje: Mensaje): Promise<ResultadoEnvio> {
    let respuesta: Response;
    try {
      respuesta = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.remitente,
          to: this.destinatarios,
          subject: mensaje.asunto,
          html: mensaje.html,
          text: mensaje.texto,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "desconocido";
      throw new ErrorDeCanal(`no hubo respuesta de Resend: ${motivo}`, this.nombre);
    }

    if (!respuesta.ok) {
      // El cuerpo de Resend trae el motivo real (dominio sin verificar, clave
      // revocada). Se recorta porque va a un log, no a una pantalla.
      const cuerpo = (await respuesta.text().catch(() => "")).slice(0, 300);
      throw new ErrorDeCanal(
        `Resend respondió ${respuesta.status}: ${cuerpo}`,
        this.nombre,
      );
    }

    const datos = (await respuesta.json().catch(() => ({}))) as { id?: string };
    return {
      canal: this.nombre,
      destinatarios: this.destinatarios,
      referencia: datos.id,
    };
  }
}

/**
 * Canal de desarrollo: escribe el aviso en la consola del servidor.
 *
 * Solo se usa cuando quien llama lo permite explícitamente y no hay clave. En
 * producción nunca: ahí, un aviso que solo va a la consola es exactamente el
 * problema que estamos arreglando.
 */
export class CanalConsola implements Canal {
  readonly nombre = "consola";

  async mandar(mensaje: Mensaje): Promise<ResultadoEnvio> {
    console.info(`[alertas] ${mensaje.asunto}\n${mensaje.texto}`);
    return { canal: this.nombre, destinatarios: [] };
  }
}

export type ResolucionDeCanal =
  | { ok: true; canal: Canal }
  | { ok: false; faltantes: string[] };

/** Separa por coma y limpia; una lista vacía no es una lista. */
export function leerDestinatarios(crudo: string | undefined): string[] {
  return (crudo ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

/**
 * Arma el canal a partir del entorno, o dice exactamente qué falta.
 *
 * Devuelve la lista de faltantes en vez de lanzar, para que la ruta pueda
 * contestar con el motivo puesto: "no se pudo avisar porque falta
 * ALERTAS_DESTINATARIOS" se arregla; un 500 pelón, no.
 */
export function resolverCanal(
  opciones: { permitirConsola?: boolean } = {},
): ResolucionDeCanal {
  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.ALERTAS_REMITENTE;
  const destinatarios = leerDestinatarios(process.env.ALERTAS_DESTINATARIOS);

  const faltantes: string[] = [];
  if (!apiKey) faltantes.push("RESEND_API_KEY");
  if (!remitente) faltantes.push("ALERTAS_REMITENTE");
  if (destinatarios.length === 0) faltantes.push("ALERTAS_DESTINATARIOS");

  if (faltantes.length === 0) {
    return { ok: true, canal: new CanalResend(apiKey!, remitente!, destinatarios) };
  }
  if (opciones.permitirConsola) {
    return { ok: true, canal: new CanalConsola() };
  }
  return { ok: false, faltantes };
}
