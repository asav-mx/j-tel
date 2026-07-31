/**
 * Cómo se ve un aviso — la única superficie de esta tarea que un humano lee,
 * así que pasa por el skill `j-telemetry-ui` igual que una pantalla.
 *
 * Dos reglas del skill mandan sobre este archivo, y las dos son fáciles de
 * romper sin darse cuenta:
 *
 *  1. **Verde, ámbar y rojo son de los veredictos y de nadie más.** Un aviso de
 *     plataforma NO es un veredicto: es un estado operativo. Por eso este
 *     correo no tiene un banner rojo por más grave que sea lo que dice. Lo
 *     medido va en acero, lo que el sistema avisa va en azul. Si un día se
 *     pinta de rojo, el rojo deja de significar "no cumplido" en todo el
 *     producto.
 *  2. **Todo número con su lectura.** Nunca `47.3 min` solo: siempre
 *     `47.3 min · umbral 30 min`. Quien lee esto a las 3 de la mañana no
 *     debería tener que calcular nada.
 *
 * El HTML lleva los estilos en línea porque los clientes de correo tiran el
 * `<style>` del encabezado, y las fuentes de la marca no existen ahí: la pila
 * cae a la monoespaciada del sistema, que conserva el papel de "lectura de
 * instrumento" aunque no sea IBM Plex.
 */

import { instanteSellado, duracion } from "@/lib/formato-tiempo";
import {
  asuntoDe,
  DIAS_SIN_VEREDICTO,
  type Aviso,
  type Medicion,
} from "@/lib/alertas/decision";
import type { Mensaje } from "@/lib/alertas/canal";

const C = {
  fondo: "#0A0D10",
  panel: "#0F1318",
  linea: "rgba(255,255,255,.10)",
  texto: "#EAEEF2",
  tenue: "#71808F",
  acero: "#7A9CB8",
  azul: "#4C9AE0",
} as const;

const MONO = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
const SANS = `"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Etiqueta de sección: versalitas espaciadas en mono, como una impresión. */
function seccion(texto: string): string {
  return `<p style="margin:0 0 8px;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:${C.tenue}">${esc(texto)}</p>`;
}

function medicionHtml(m: Medicion): string {
  return `<tr>
  <td style="padding:6px 16px 6px 0;font-family:${SANS};font-size:13px;color:${C.tenue};vertical-align:top;white-space:nowrap">${esc(m.etiqueta)}</td>
  <td style="padding:6px 0;font-family:${MONO};font-size:13px;font-variant-numeric:tabular-nums;color:${C.acero};vertical-align:top">${esc(m.valor)}<span style="color:${C.tenue}"> · ${esc(m.lectura)}</span></td>
</tr>`;
}

function avisoHtml(aviso: Aviso): string {
  const detalle = aviso.detalle?.length
    ? `<div style="margin-top:18px">
${seccion("Servicios")}
<ul style="margin:0;padding-left:18px;font-family:${MONO};font-size:12px;line-height:1.7;color:${C.acero}">
${aviso.detalle.map((d) => `<li>${esc(d)}</li>`).join("\n")}
</ul>
</div>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border:1px solid ${C.linea};border-radius:3px;margin-bottom:16px">
<tr><td style="padding:22px 24px">

<h1 style="margin:0 0 18px;font-family:${SANS};font-size:19px;font-weight:600;line-height:1.35;color:${C.texto}">${esc(aviso.titulo)}</h1>

${seccion("Evidencia")}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px">
${aviso.mediciones.map(medicionHtml).join("\n")}
</table>

${seccion("Consecuencia")}
<p style="margin:0 0 20px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.texto}">${esc(aviso.consecuencia)}</p>

${seccion("Acción")}
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.azul}">${esc(aviso.accion)}</p>

${detalle}

</td></tr>
</table>`;
}

function envoltura(contenido: string, pie: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">
<tr><td>

<p style="margin:0 0 16px;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.13em;text-transform:uppercase;color:${C.tenue}">J-Telemetry · Aviso de plataforma</p>

${contenido}

<p style="margin:20px 0 0;font-family:${MONO};font-size:11px;line-height:1.7;color:${C.tenue};border-top:1px dotted ${C.linea};padding-top:14px">${pie}</p>

</td></tr>
</table>
</td></tr>
</table>`;
}

function medicionTexto(m: Medicion): string {
  return `  ${m.etiqueta}: ${m.valor} · ${m.lectura}`;
}

function avisoTexto(aviso: Aviso): string {
  const partes = [
    aviso.titulo,
    "",
    "EVIDENCIA",
    ...aviso.mediciones.map(medicionTexto),
    "",
    "CONSECUENCIA",
    `  ${aviso.consecuencia}`,
    "",
    "ACCIÓN",
    `  ${aviso.accion}`,
  ];
  if (aviso.detalle?.length) {
    partes.push("", "SERVICIOS", ...aviso.detalle.map((d) => `  ${d}`));
  }
  return partes.join("\n");
}

/**
 * Todos los avisos de una corrida en UN solo correo.
 *
 * Tres correos a la vez por la misma caída no informan tres veces más: son la
 * primera lección de que este remitente se puede archivar sin leer.
 */
export function renderAvisos(avisos: Aviso[], ahora: Date): Mensaje {
  const asunto =
    avisos.length === 1
      ? asuntoDe(avisos[0]!)
      : `J-Telemetry · ${avisos.length} avisos de plataforma`;

  const pie = [
    `Corrida de /api/cron/alertas · ${instanteSellado(ahora)} (hora de Ciudad Juárez)`,
    `Avisan solo la ingesta detenida, el archivador callado y los servicios sin veredicto.`,
    `Los transitorios —rate limit, error suelto de archivo— y los servicios no cumplidos viajan en el resumen diario.`,
  ].join("<br>");

  const pieTexto = [
    `Corrida de /api/cron/alertas · ${instanteSellado(ahora)} (hora de Ciudad Juárez)`,
    `Avisan solo la ingesta detenida, el archivador callado y los servicios sin veredicto.`,
    `Los transitorios y los servicios no cumplidos viajan en el resumen diario.`,
  ].join("\n");

  return {
    asunto,
    html: envoltura(avisos.map(avisoHtml).join("\n"), pie),
    texto: [
      ...avisos.map(avisoTexto),
      "",
      "—",
      pieTexto,
    ].join("\n\n"),
  };
}

/** Lo que el resumen diario cuenta del día anterior. */
export type ResumenDiario = {
  /** Día civil que se reporta, en ISO. */
  dia: string;
  /** Estado actual de `/api/salud`, leído con el mismo juicio que el vigilante. */
  saludAhora: "sano" | "enfermo";
  diagnostico: string;
  /** La lectura de cada chequeo de salud, tal como la escribe `evaluarSalud`. */
  chequeos: Array<{ id: string; estado: string; lectura: string }>;
  /** Alertas abiertas ahora mismo, por tipo. */
  abiertasPorTipo: Array<{ tipo: string; cantidad: number; masAntigua: Date | null }>;
  /** Alertas que se abrieron durante el día reportado, por tipo. */
  nuevasPorTipo: Array<{ tipo: string; cantidad: number }>;
  /** Servicios sin veredicto que siguen sin hecho sellado. */
  sinVeredicto: { total: number; sinViaje: number; contratos: number };
  /** Cuántos días atrás se miraron los servicios. Se declara para no mentir. */
  diasMirados: number;
};

/**
 * El resumen diario, que llega HAYA O NO pasado algo.
 *
 * Esa es su segunda función y la más importante: si el resumen no llega, la
 * plomería de alertas está muerta y el silencio de los otros correos no
 * significa nada. Un canal que solo habla cuando hay desgracias no se puede
 * distinguir de un canal roto.
 */
export function renderResumen(r: ResumenDiario, ahora: Date): Mensaje {
  const totalAbiertas = r.abiertasPorTipo.reduce((s, a) => s + a.cantidad, 0);
  const totalNuevas = r.nuevasPorTipo.reduce((s, a) => s + a.cantidad, 0);

  const titulo =
    totalAbiertas === 0 && r.sinVeredicto.total === 0 && r.saludAhora === "sano"
      ? "Sin incidentes abiertos. La ingesta, el archivador y la cola de verificación están al día."
      : `${totalAbiertas} incidente${totalAbiertas === 1 ? "" : "s"} abierto${totalAbiertas === 1 ? "" : "s"} y ${r.sinVeredicto.total} servicio${r.sinVeredicto.total === 1 ? "" : "s"} sin veredicto.`;

  const mediciones: Medicion[] = [
    ...r.chequeos.map((c) => ({
      etiqueta: c.id === "gps" ? "Dato de GPS" : c.id === "archivador" ? "Archivador" : c.id === "marcas" ? "Marcas de agua" : "Alertas críticas",
      valor: c.estado === "sano" ? "al día" : "fuera de umbral",
      lectura: c.lectura,
    })),
    {
      etiqueta: "Incidentes abiertos",
      valor: String(totalAbiertas),
      lectura:
        totalAbiertas === 0
          ? "ninguno pendiente de atender"
          : r.abiertasPorTipo.map((a) => `${a.tipo}: ${a.cantidad}`).join(" · "),
    },
    {
      etiqueta: `Incidentes nuevos del ${r.dia}`,
      valor: String(totalNuevas),
      lectura:
        totalNuevas === 0
          ? "ninguno se abrió ese día"
          : r.nuevasPorTipo.map((a) => `${a.tipo}: ${a.cantidad}`).join(" · "),
    },
    {
      etiqueta: "Servicios sin veredicto",
      valor: String(r.sinVeredicto.total),
      lectura: `en ${r.sinVeredicto.contratos} contrato${r.sinVeredicto.contratos === 1 ? "" : "s"} · ${r.sinVeredicto.sinViaje} sin fila de viaje · se miraron los últimos ${r.diasMirados} días`,
    },
  ];

  const aviso: Aviso = {
    clase: "sin-veredicto",
    titulo,
    mediciones,
    // El diagnóstico va dentro de una frase de consecuencia, no suelto: bajo el
    // título "Consecuencia", un "ingesta al día" a secas no dice qué implica.
    consecuencia:
      r.saludAhora === "sano"
        ? `Lo que el árbitro juzgue ahora lo juzga con evidencia al día — ${r.diagnostico}.`
        : `Lo que el árbitro juzgue ahora lo juzga con evidencia incompleta — ${r.diagnostico}.`,
    accion:
      totalAbiertas === 0 && r.sinVeredicto.total === 0
        ? "Nada que hacer. Este correo llega todos los días: si un día no llega, la plomería de alertas es lo que está caído."
        : "Atender lo abierto desde la compuerta de soporte · J-Staff",
    instante: ahora,
  };

  const pie = [
    `Resumen del ${r.dia} · corrida de /api/cron/alertas-resumen · ${instanteSellado(ahora)} (hora de Ciudad Juárez)`,
    `Llega todos los días, haya o no incidentes. Su ausencia es la señal.`,
    `Los servicios sin veredicto se miran ${DIAS_SIN_VEREDICTO} días hacia atrás: lo anterior a ese corte no está contado aquí.`,
  ];

  const mensaje = renderAvisos([aviso], ahora);
  return {
    asunto: `J-Telemetry · Resumen ${r.dia}`,
    html: envoltura(avisoHtml(aviso), pie.join("<br>")),
    texto: `${mensaje.texto.split("\n\n—\n\n")[0]}\n\n—\n\n${pie.join("\n")}`,
  };
}

/** Cuánto lleva abierta la alerta más antigua, para el resumen. */
export function antiguedad(masAntigua: Date | null, ahora: Date): string {
  if (!masAntigua) return "sin abiertas";
  return `la más antigua ${duracion((ahora.getTime() - masAntigua.getTime()) / 60_000)}`;
}
