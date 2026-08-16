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

import type { Chequeo, EstadoChequeo } from "@jtel/services";
import { instanteSellado, duracion } from "@/lib/formato-tiempo";
import {
  asuntoDe,
  DIAS_SIN_VEREDICTO,
  type Aviso,
  type Medicion,
} from "@/lib/alertas/decision";
import type { Mensaje } from "@/lib/alertas/canal";

/*
 * La paleta clara, no la oscura — sin importar la preferencia del usuario.
 *
 * Este correo nació con el fondo `#0A0D10` de la app, y en un correo eso falla
 * de tres formas: varios clientes reescriben el fondo de un correo oscuro y
 * dejan texto claro sobre blanco, ilegible; el modo oscuro de algunos clientes
 * invierte los colores otra vez encima; y un correo es la única pieza del
 * producto que puede terminar impresa y metida en una carpeta, donde
 * `#0A0D10` sale como una plancha negra.
 *
 * Los valores son los de la paleta clara del skill copiados como hex, porque
 * los clientes de correo no entienden custom properties. Es la única
 * duplicación de tokens que el producto se permite, y la comparte con
 * `@/lib/correos/plantilla`.
 */
const C = {
  fondo: "#f4f6f8",
  panel: "#ffffff",
  linea: "#e2e6ea",
  texto: "#111820",
  tenue: "#5a6874",
  acero: "#3d6a8f",
  azul: "#2a6fb5",
} as const;

const MONO = `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;
const SANS = `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

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
  /*
   * Una ceguera no se puede ver igual que una violación de umbral.
   *
   * `fuera de umbral` es una medición que salió mal, y va en acero como toda
   * medición. `no medido` no es una medición: es el hueco donde debía haber
   * una. Por eso NO va en acero —el acero afirmaría que ahí hay un dato— sino
   * en tenue y con subrayado punteado, la misma marca de "esto está declarado,
   * no observado" que lleva el sello.
   *
   * El punteado hace el trabajo cuando el color no puede: sobrevive a un
   * cliente de correo que reescribe colores, y sobrevive impreso en blanco y
   * negro.
   */
  const estiloValor = m.noMedido
    ? `color:${C.tenue};border-bottom:1px dotted ${C.tenue}`
    : `color:${C.acero}`;
  return `<tr>
  <td style="padding:6px 16px 6px 0;font-family:${SANS};font-size:13px;color:${C.tenue};vertical-align:top;white-space:nowrap">${esc(m.etiqueta)}</td>
  <td style="padding:6px 0;font-family:${MONO};font-size:13px;font-variant-numeric:tabular-nums;vertical-align:top"><span style="${estiloValor}">${esc(m.valor)}</span><span style="color:${C.tenue}"> · ${esc(m.lectura)}</span></td>
</tr>`;
}

/**
 * El desglose largo, como tabla de verdad.
 *
 * Mono y `tabular-nums` para que las columnas de minutos se puedan comparar de
 * un vistazo: una lista de viñetas con números adentro obliga a leer renglón
 * por renglón, que es justo lo que 47 filas no admiten. Sin cortes ni «y N más»:
 * un desglose que se trunca en silencio se lee como si estuvieran todos.
 */
function tablaHtml(t: NonNullable<Aviso["tabla"]>): string {
  const th = t.columnas
    .map(
      (c) =>
        `<th align="left" style="padding:0 12px 6px 0;font-family:${MONO};font-size:10.5px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:${C.tenue};border-bottom:1px solid ${C.linea};white-space:nowrap">${esc(c)}</th>`,
    )
    .join("");
  const tr = t.filas
    .map(
      (f) =>
        `<tr>${f
          .map(
            (v, i) =>
              `<td style="padding:5px 12px 5px 0;font-family:${MONO};font-size:12px;font-variant-numeric:tabular-nums;color:${i === 0 ? C.texto : C.acero};white-space:nowrap">${esc(v)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("\n");
  return `<div style="margin-top:18px">
${seccion(t.titulo)}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
<tr>${th}</tr>
${tr}
</table>
</div>`;
}

function avisoHtml(aviso: Aviso): string {
  const tabla = aviso.tabla?.filas.length ? tablaHtml(aviso.tabla) : "";
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

${tabla}
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
  if (aviso.tabla?.filas.length) {
    // Ancho por columna, medido sobre el encabezado y todas las filas: en texto
    // plano las columnas solo se pueden comparar si están alineadas.
    const anchos = aviso.tabla.columnas.map((c, i) =>
      Math.max(c.length, ...aviso.tabla!.filas.map((f) => (f[i] ?? "").length)),
    );
    const linea = (celdas: string[]) =>
      "  " + celdas.map((v, i) => (v ?? "").padEnd(anchos[i]!)).join("  ").trimEnd();
    partes.push(
      "",
      aviso.tabla.titulo.toUpperCase(),
      linea(aviso.tabla.columnas),
      "  " + "-".repeat(anchos.reduce((a, b) => a + b + 2, 0) - 2),
      ...aviso.tabla.filas.map(linea),
    );
  }
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
/**
 * Quién mandó este correo y qué alcance tiene lo que dice.
 *
 * Es parámetro y no constante desde que un segundo cron empezó a usar este
 * renderizador. El pie que sirve para uno **miente** en el otro: firmado
 * «corrida de /api/cron/alertas» y prometiendo que solo avisan tres clases, un
 * correo de la revisión de horas límite le dice a quien lo lee que viene de un
 * cron que no lo mandó y que su clase no existe. Es §D del Marco en el pie de
 * un correo — el texto era correcto donde nació y falso donde se reusó.
 */
export type PieDeCorreo = {
  /** La ruta del cron que hizo esta corrida. */
  origen: string;
  /** Qué avisa este canal, y qué deja fuera. Una línea por afirmación. */
  alcance: string[];
};

export const PIE_ALERTAS: PieDeCorreo = {
  origen: "/api/cron/alertas",
  alcance: [
    "Avisan solo la ingesta detenida, el archivador callado y los servicios sin veredicto.",
    "Los transitorios —rate limit, error suelto de archivo— y los servicios no cumplidos viajan en el resumen diario.",
  ],
};

export const PIE_HORAS_LIMITE: PieDeCorreo = {
  origen: "/api/cron/revisar-horas-limite",
  alcance: [
    "Revisa una vez al día las ocurrencias sin sellar con hora límite en el futuro, y compara la congelada contra la que hoy se derivaría.",
    "Avisa; no corrige. Corregir la ventana con la que se juzga es decisión de Asav.",
    "Lo ya sellado no entra: eso no se corrige, se re-verifica.",
  ],
};

export function renderAvisos(
  avisos: Aviso[],
  ahora: Date,
  pieDe: PieDeCorreo = PIE_ALERTAS,
): Mensaje {
  const asunto =
    avisos.length === 1
      ? asuntoDe(avisos[0]!)
      : `J-Telemetry · ${avisos.length} avisos de plataforma`;

  const lineas = [
    `Corrida de ${pieDe.origen} · ${instanteSellado(ahora)} (hora de Ciudad Juárez)`,
    ...pieDe.alcance,
  ];

  const pie = lineas.join("<br>");
  const pieTexto = lineas.join("\n");

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

/**
 * Cómo se llama cada chequeo en el correo. Uno por cada uno, sin escalera.
 *
 * ── La valla, y por qué es un `Record` y no un `if` más ─────────────────────
 *
 * Esto era una escalera de ternarios que terminaba en un caso por omisión. El
 * chequeo de verificación se agregó después, no tenía rama, y cayó al último
 * peldaño: salió rotulado **«Alertas críticas»**, que es el nombre de otra
 * población. El correo traía dos renglones con el mismo nombre —uno real y uno
 * que era otra cosa— y ninguno de los dos lo delataba, porque el caso por
 * omisión siempre tiene algo que devolver.
 *
 * El defecto de fondo no fue la rama olvidada: fue que el sistema **permite
 * olvidarla en silencio**. Un `Record<Chequeo["id"], string>` no lo permite —
 * agregar un chequeo nuevo a `Chequeo["id"]` sin nombrarlo aquí no compila. La
 * valla la pone el compilador y no la memoria de quien escriba el chequeo
 * siguiente, que es justo quien no va a acordarse.
 *
 * ── Por qué "Cola de verificación" y no "Servicios sin veredicto" ───────────
 *
 * Porque ese nombre ya es de otro renglón: el de `sinVeredicto`, que mira los
 * últimos días y solo contratos activos. Este chequeo cuenta otra población
 * —vencidos hace más de 2 h sin NINGÚN hecho, sin ventana de días— y darle el
 * nombre del otro sería repetir el defecto con mejor ortografía. "Cola de
 * verificación" es como el propio correo ya la nombra en su día limpio.
 */
const ETIQUETA_CHEQUEO: Record<Chequeo["id"], string> = {
  gps: "Dato de GPS",
  archivador: "Archivador",
  marcas: "Marcas de agua",
  alertas: "Alertas críticas",
  verificacion: "Cola de verificación",
};

/** Lo que el resumen diario cuenta del día anterior. */
export type ResumenDiario = {
  /** Día civil que se reporta, en ISO. */
  dia: string;
  /** Estado actual de `/api/salud`, leído con el mismo juicio que el vigilante. */
  saludAhora: "sano" | "enfermo";
  diagnostico: string;
  /**
   * La lectura de cada chequeo de salud, tal como la escribe `evaluarSalud`.
   *
   * El estado viene tipado —y con sus tres valores— a propósito: era `string`,
   * y un `string` deja pasar cualquier cosa sin que nadie se entere. Es el
   * mismo descuido que dejó al correo sin poder decir "no sé".
   */
  chequeos: Array<{ id: Chequeo["id"]; estado: EstadoChequeo; lectura: string }>;
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

  /*
   * Los chequeos que no se pudieron medir. Mientras haya uno, este resumen no
   * puede afirmar que no falte nada: no lo sabe.
   */
  const sinMedir = r.chequeos.filter((c) => c.estado === "no_medido");
  const conteos = `${totalAbiertas} incidente${totalAbiertas === 1 ? "" : "s"} abierto${totalAbiertas === 1 ? "" : "s"} y ${r.sinVeredicto.total} servicio${r.sinVeredicto.total === 1 ? "" : "s"} sin veredicto`;
  const nadaAbierto = totalAbiertas === 0 && r.sinVeredicto.total === 0;

  /*
   * El título no afirma un conteo completo cuando hay un chequeo que no se
   * pudo hacer.
   *
   * El 15 de agosto el título dijo "0 incidentes abiertos y 0 servicios sin
   * veredicto" con un chequeo caído debajo. Los dos ceros eran ciertos —cada
   * uno de su población— y el titular era falso: se leía como "no hay nada", y
   * lo que había era un instrumento que no pudo mirar. Correcto como conteo,
   * falso como afirmación.
   *
   * Los conteos que SÍ se midieron se siguen diciendo: callarlos por un hueco
   * en otro chequeo sería el error simétrico.
   */
  const titulo = sinMedir.length
    ? nadaAbierto
      ? `${sinMedir.length === 1 ? "Un chequeo no se pudo medir" : `${sinMedir.length} chequeos no se pudieron medir`}: este resumen no puede afirmar que no haya nada pendiente.`
      : `${conteos} · y ${sinMedir.length === 1 ? "un chequeo" : `${sinMedir.length} chequeos`} sin medir, así que puede haber más.`
    : nadaAbierto && r.saludAhora === "sano"
      ? "Sin incidentes abiertos. La ingesta, el archivador y la cola de verificación están al día."
      : `${conteos}.`;

  const mediciones: Medicion[] = [
    ...r.chequeos.map((c) => ({
      /*
       * Si algún día llegara un id sin nombre, el renglón sale con el id crudo:
       * feo y evidente. Nunca con el nombre de otra población, que es la forma
       * de fallar que se ve bien y miente.
       */
      etiqueta: ETIQUETA_CHEQUEO[c.id] ?? c.id,
      valor: c.estado === "sano" ? "al día" : c.estado === "no_medido" ? "no medido" : "fuera de umbral",
      lectura: c.lectura,
      noMedido: c.estado === "no_medido",
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
    //
    // "Incompleta" y "no se pudo comprobar" no son lo mismo, y la diferencia es
    // justo la que este PR existe para poder decir: la primera afirma que falta
    // evidencia; la segunda admite que no se sabe si falta.
    consecuencia: sinMedir.length
      ? `Lo que el árbitro juzgue ahora lo juzga sin que se haya podido comprobar todo — ${r.diagnostico}.`
      : r.saludAhora === "sano"
        ? `Lo que el árbitro juzgue ahora lo juzga con evidencia al día — ${r.diagnostico}.`
        : `Lo que el árbitro juzgue ahora lo juzga con evidencia incompleta — ${r.diagnostico}.`,
    // "Nada que hacer" con un chequeo ciego debajo es la misma mentira que el
    // título: no se sabe si hay algo que hacer.
    accion: sinMedir.length
      ? `Revisar por qué ${sinMedir.length === 1 ? "el chequeo no pudo medirse" : "los chequeos no pudieron medirse"} · J-Staff`
      : nadaAbierto
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
