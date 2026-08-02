/**
 * El molde de los correos del producto.
 *
 * **Un correo no es una notificación: es un documento.** Se reenvía, se
 * imprime, se archiva, y puede aparecer en una discusión de facturación seis
 * meses después. Tiene que sostenerse solo, sin acceso al sistema — y eso
 * gobierna cada decisión de este archivo.
 *
 * ## Por qué la paleta va escrita a mano, y en claro
 *
 * En pantalla los colores salen de tokens que siguen el tema del usuario. Aquí
 * no se puede: los clientes de correo tiran el `<style>` del encabezado, no
 * entienden custom properties, y varios reescriben el fondo de un correo
 * oscuro dejando texto claro sobre blanco — ilegible. Encima, un correo es la
 * única pieza del producto que puede terminar impresa y metida en una carpeta,
 * y un fondo `#0A0D10` se imprime como una plancha negra.
 *
 * Por eso **el correo siempre va en claro**, sin importar la preferencia del
 * usuario, con los valores de la paleta clara del skill copiados como hex. Es
 * la única duplicación de tokens que el producto se permite, y existe porque
 * el medio no admite la indirección.
 */

import { instanteSellado } from "@/lib/formato-tiempo";
import { JTTEL_TZ } from "@jtel/domain";

/** La paleta clara del skill, en hex. Ver el comentario de arriba. */
export const C = {
  fondo: "#f4f6f8",
  panel: "#ffffff",
  linea: "#e2e6ea",
  lineaFuerte: "#ccd3da",
  texto: "#111820",
  tenue: "#5a6874",
  acero: "#3d6a8f",
  verde: "#1b8a54",
  ambar: "#9a6a05",
  rojo: "#b4262b",
  azul: "#2a6fb5",
} as const;

export const MONO = `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;
export const SANS = `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type TonoChip = "acero" | "ambar" | "rojo" | "verde";

const TINTE: Record<TonoChip, { color: string; fondo: string }> = {
  acero: { color: C.acero, fondo: "#eef2f6" },
  ambar: { color: C.ambar, fondo: "#f7f1e4" },
  rojo: { color: C.rojo, fondo: "#f9ecec" },
  verde: { color: C.verde, fondo: "#e9f4ee" },
};

/**
 * El chip de siempre: impresión con borde, versalitas espaciadas, mono. No una
 * pastilla rellena — se lee igual en papel que en pantalla.
 */
export function chip(texto: string, tono: TonoChip): string {
  const t = TINTE[tono];
  return `<span style="display:inline-block;border:1.5px solid ${t.color};background:${t.fondo};border-radius:2px;padding:3px 9px;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:${t.color}">${esc(texto)}</span>`;
}

export function seccion(texto: string): string {
  return `<p style="margin:0 0 8px;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:${C.tenue}">${esc(texto)}</p>`;
}

/** Una medida con su lectura. Nunca el valor solo. */
export type Medida = { etiqueta: string; valor: string; lectura: string };

export function tablaMedidas(medidas: Medida[]): string {
  if (medidas.length === 0) return "";
  const filas = medidas
    .map(
      (m) => `<tr>
  <td style="padding:6px 16px 6px 0;font-family:${SANS};font-size:13px;color:${C.tenue};vertical-align:top;white-space:nowrap">${esc(m.etiqueta)}</td>
  <td style="padding:6px 0;font-family:${MONO};font-size:13px;font-variant-numeric:tabular-nums;color:${C.acero};vertical-align:top">${esc(m.valor)}<span style="color:${C.tenue}"> · ${esc(m.lectura)}</span></td>
</tr>`,
    )
    .join("\n");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${filas}
</table>`;
}

/** Una fila de la tabla de excepciones. */
export type FilaServicio = {
  servicio: string;
  chip: { texto: string; tono: TonoChip };
  /** La medición con su umbral al lado. Nunca una sin la otra. */
  medida: string;
};

export function tablaServicios(filas: FilaServicio[]): string {
  if (filas.length === 0) return "";
  const cuerpo = filas
    .map(
      (f) => `<tr>
  <td style="padding:9px 12px 9px 0;border-top:1px solid ${C.linea};font-family:${SANS};font-size:13.5px;color:${C.texto};vertical-align:top">${esc(f.servicio)}</td>
  <td style="padding:9px 12px 9px 0;border-top:1px solid ${C.linea};vertical-align:top;white-space:nowrap">${chip(f.chip.texto, f.chip.tono)}</td>
  <td style="padding:9px 0;border-top:1px solid ${C.linea};font-family:${MONO};font-size:12px;font-variant-numeric:tabular-nums;color:${C.tenue};vertical-align:top">${esc(f.medida)}</td>
</tr>`,
    )
    .join("\n");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">
${cuerpo}
</table>`;
}

/** La acción principal. Una sola, salvo que dos caminos sean igual de razonables. */
export function boton(texto: string, url: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;border:1.5px solid ${C.azul};border-radius:2px;padding:9px 16px;font-family:${MONO};font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:${C.azul};text-decoration:none">${esc(texto)}</a>`;
}

/**
 * La marca de sellado, dentro del cuerpo.
 *
 * Va aquí y no en el pie de la plataforma a propósito: **reenviado o impreso
 * sigue siendo evidencia**, y un correo que reporta resultados sin decir
 * cuándo se sellaron ni con qué política es un correo que no se puede usar en
 * una discusión seis meses después.
 */
export function selloHtml(selladoEn: Date, politica: string, tz?: string): string {
  return `<p style="margin:20px 0 0;padding-top:14px;border-top:1px dotted ${C.lineaFuerte};font-family:${MONO};font-size:11px;line-height:1.7;color:${C.tenue}">Verificado y sellado · ${esc(instanteSellado(selladoEn, tz))}<br>Con la política ${esc(politica)}. Los resultados están congelados: no se recalculan al abrir esta pantalla ni este correo.</p>`;
}

export function selloTexto(selladoEn: Date, politica: string, tz?: string): string {
  return `Verificado y sellado · ${instanteSellado(selladoEn, tz)}\nCon la política ${politica}. Los resultados están congelados.`;
}

/**
 * El pie que dice por qué le llegó este correo.
 *
 * **Sin enlace de preferencias.** No existe tabla de preferencias de aviso —
 * `notifications` es una bandeja in-app y no tiene canal ni concepto de "qué
 * quiero recibir por correo". Prometer un ajuste que no existe es peor que no
 * ofrecerlo: el usuario hace clic, no pasa nada, y deja de creerle al correo.
 */
export function pieDeProcedencia(rol: string, contrato: string): string[] {
  return [
    `Te llega porque tienes el rol de ${rol} en el contrato ${contrato}.`,
    `Todavía no hay dónde ajustar qué avisos recibes; cuando exista, este pie lo dirá.`,
  ];
}

/**
 * La envoltura. Tablas y estilos en línea porque es lo único que sobrevive a
 * los clientes de correo.
 */
export function envoltura(opts: {
  encabezado: string;
  contenido: string;
  pie: string[];
}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">
<tr><td>

<p style="margin:0 0 16px;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:${C.tenue}">${esc(opts.encabezado)}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border:1px solid ${C.linea};border-radius:3px">
<tr><td style="padding:24px 26px">
${opts.contenido}
</td></tr>
</table>

<p style="margin:18px 0 0;font-family:${MONO};font-size:11px;line-height:1.7;color:${C.tenue}">${opts.pie.map(esc).join("<br>")}</p>

</td></tr>
</table>
</td></tr>
</table>`;
}

/**
 * La fecha del asunto, en ISO.
 *
 * No en "viernes, 24 de julio de 2026": el asunto tiene que **encontrarse por
 * búsqueda dentro de un año**, y quien busca teclea `2026-07-24`, no el día de
 * la semana. La forma larga y legible vive dentro del cuerpo, donde se lee de
 * corrido; el asunto es un índice.
 */
export function fechaParaAsunto(d: Date, timeZone: string = JTTEL_TZ): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return partes;
}
