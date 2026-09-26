/**
 * **«Mándala»** — compartir una parada (diseño: «Manda tu parada, una carta,
 * para compartirla por WhatsApp»; auditoría: «entra en la versión 1»).
 *
 * ## Qué se manda
 *
 * **La liga de su letrero**, `‹origen›/p/‹qr_slug›`, y su nombre. Nada más:
 * ni la ubicación de quien la manda, ni sus otras paradas, ni un identificador.
 * Quien la recibe abre lo mismo que quien escanea el poste. El `qr_slug` es lo
 * estable de una parada —su nombre puede cambiar, su lugar en la lista también—.
 *
 * ## Por qué la hoja de compartir del teléfono, y no un botón de WhatsApp
 *
 * `navigator.share` abre la hoja del sistema, y WhatsApp está ahí para quien lo
 * tiene. Un botón que llame directo a WhatsApp dejaría fuera a quien usa otra
 * cosa y metería en la app la liga de un tercero. La app no se entera de a
 * quién ni por dónde se mandó: el teléfono lo resuelve.
 *
 * ## Lo que pasa cuando no se puede
 *
 * Sin `share` (una computadora, un navegador viejo) se copia la liga. Sin eso
 * tampoco, se DICE la liga en la pantalla: un botón que no hace nada y calla es
 * un botón roto. Cancelar la hoja del sistema no es un error y no se dice nada.
 */

export type ResultadoDeMandar = "compartida" | "copiada" | "cancelada" | "no-se-pudo";

/** La liga pública de una parada: la misma que imprime su letrero. */
export function ligaDeLaParada(origen: string, qrSlug: string): string {
  return `${origen.replace(/\/+$/, "")}/p/${encodeURIComponent(qrSlug)}`;
}

interface Navegador {
  share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText?: (t: string) => Promise<void> };
}

export async function mandarParada(entrada: {
  nombre: string;
  liga: string;
  nav: Navegador;
}): Promise<ResultadoDeMandar> {
  const { nombre, liga, nav } = entrada;
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: nombre, text: nombre, url: liga });
      return "compartida";
    } catch (e) {
      /* El pasajero cerró la hoja: no es un error y no se le dice nada. */
      if ((e as { name?: string })?.name === "AbortError") return "cancelada";
      /* Cualquier otro fallo —permiso, un navegador a medias—: se intenta copiar. */
    }
  }
  if (typeof nav.clipboard?.writeText === "function") {
    try {
      await nav.clipboard.writeText(liga);
      return "copiada";
    } catch {
      /* sin portapapeles: se dice la liga */
    }
  }
  return "no-se-pudo";
}

/**
 * Lo que la hoja dice después de tocar «Mándala». `null` = no dice nada nuevo:
 * cuando la hoja del sistema se abrió, el teléfono ya contestó.
 */
export function mandadaEnPalabras(r: ResultadoDeMandar, liga: string): string | null {
  if (r === "copiada") return "Liga copiada. Pégala donde quieras mandarla.";
  if (r === "no-se-pudo") return `Tu navegador no deja compartir desde aquí. La liga es ${liga}`;
  return null;
}
