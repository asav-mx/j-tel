/**
 * Los cuatro correos del producto.
 *
 * Llegan a gente que nunca va a abrir la plataforma: el jefe del gerente, el
 * dueño del carrier, contabilidad. Para muchos, este correo es su único
 * contacto con J-Telemetry — y como se reenvía, se imprime y se archiva, tiene
 * que sostenerse solo, sin acceso al sistema.
 *
 * ## Lo que este archivo NO hace: enviar
 *
 * Aquí solo se arma el contenido. **No hay a quién mandárselo todavía.**
 * `userMemberships` resuelve "¿puede este usuario entrar a X?", pero no la
 * consulta inversa que estos correos necesitan —"dame todos los usuarios con
 * rol Y en el contrato Z"—; el correo real no vive en la base (el usuario es
 * un `clerkUserId` y el email se resuelve contra Clerk); y ningún membership
 * usa hoy el `scopeType` `"contract"`. El único envío que existe,
 * `leerDestinatarios()`, toma una lista fija de `ALERTAS_DESTINATARIOS` — la
 * misma para toda corrida, y pensada para avisos internos de J-Staff.
 *
 * Esa pieza es otro trabajo y toca auth. El bloqueo impide **enviar**, no
 * impide escribir: estas funciones quedan construidas y probadas para cuando
 * exista el destinatario.
 */

import type { Mensaje } from "@/lib/alertas/canal";
import { instanteSellado } from "@/lib/formato-tiempo";
import {
  C,
  MONO,
  SANS,
  boton,
  chip,
  envoltura,
  esc,
  fechaParaAsunto,
  pieDeProcedencia,
  seccion,
  selloHtml,
  selloTexto,
  tablaMedidas,
  tablaServicios,
  type FilaServicio,
  type Medida,
} from "@/lib/correos/plantilla";

function parrafo(texto: string, color: string = C.texto): string {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:1.6;color:${color}">${texto}</p>`;
}

function titularHtml(texto: string): string {
  return `<h1 style="margin:14px 0 12px;font-family:${SANS};font-size:20px;font-weight:600;line-height:1.35;color:${C.texto}">${esc(texto)}</h1>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Cierre del turno — diario, cara planta
// ─────────────────────────────────────────────────────────────────────────────

export type CierreDelTurno = {
  cuenta: string;
  turno: string;
  fecha: Date;
  selladoEn: Date;
  politica: string;
  cumplidos: number;
  total: number;
  /** Solo las excepciones. Los cumplidos se resumen en una línea. */
  excepciones: FilaServicio[];
  /** Cuántas de esas excepciones son pendientes por evidencia. */
  pendientes: number;
  urlCierre: string;
  rol: string;
  contrato: string;
  timeZone?: string;
};

/**
 * Llega **todos los días, incluso cuando todo salió bien**.
 *
 * Si solo llegara cuando hay problemas, su llegada sería mala noticia y la
 * gente dejaría de abrirlo — y entonces el día que de verdad importe tampoco
 * se abriría.
 *
 * La tabla lista **solo las excepciones**. Poner los catorce renglones esconde
 * los dos que importan; los cumplidos caben en una línea.
 */
export function correoCierre(c: CierreDelTurno): Mensaje {
  const excepciones = c.excepciones.length;
  const asunto =
    excepciones === 0
      ? `${c.cuenta} · ${c.turno} del ${fechaParaAsunto(c.fecha, c.timeZone)} — ${c.cumplidos} de ${c.total} cumplidos, cerró limpio`
      : `${c.cuenta} · ${c.turno} del ${fechaParaAsunto(c.fecha, c.timeZone)} — ${c.cumplidos} de ${c.total} cumplidos, ${excepciones} ${excepciones === 1 ? "excepción" : "excepciones"}`;

  const marca =
    excepciones === 0
      ? chip("Cerró limpio", "acero")
      : chip(`Cerró con ${excepciones} ${excepciones === 1 ? "excepción" : "excepciones"}`, "ambar");

  const notaPendientes =
    c.pendientes > 0
      ? parrafo(
          `<b style="font-weight:600">${c.pendientes === 1 ? "Un servicio quedó pendiente por evidencia" : `${c.pendientes} servicios quedaron pendientes por evidencia`}: no cuentan como incumplimiento ni como cumplido.</b> El sistema no vio lo suficiente para juzgarlos. El plazo de cierre está en definición con la planta y el área legal; cuando exista, este correo lo dirá.`,
        )
      : "";

  const resumenCumplidos =
    c.cumplidos > 0
      ? `<p style="margin:0 0 20px;font-family:${MONO};font-size:12.5px;color:${C.tenue}">Los otros ${c.cumplidos} ${c.cumplidos === 1 ? "servicio cumplió" : "servicios cumplieron"} sin observaciones y no se listan uno por uno.</p>`
      : "";

  const contenido = [
    marca,
    titularHtml(`El ${c.turno.toLowerCase()} cerró: ${c.cumplidos} de ${c.total} servicios cumplidos`),
    parrafo(
      `Sellado el <b style="font-weight:600">${esc(instanteSellado(c.selladoEn, c.timeZone))}</b>. Los resultados están congelados y no se recalculan.`,
      C.tenue,
    ),
    excepciones > 0 ? seccion("Las excepciones") : "",
    tablaServicios(c.excepciones),
    resumenCumplidos,
    notaPendientes,
    boton("Ver el cierre completo", c.urlCierre),
    selloHtml(c.selladoEn, c.politica, c.timeZone),
  ]
    .filter(Boolean)
    .join("\n");

  const texto = [
    excepciones === 0 ? "CERRÓ LIMPIO" : `CERRÓ CON ${excepciones} EXCEPCIONES`,
    "",
    `El ${c.turno.toLowerCase()} cerró: ${c.cumplidos} de ${c.total} servicios cumplidos.`,
    `Sellado el ${instanteSellado(c.selladoEn, c.timeZone)}. Los resultados están congelados y no se recalculan.`,
    ...(excepciones > 0
      ? ["", "LAS EXCEPCIONES", ...c.excepciones.map((f) => `  ${f.servicio} — ${f.chip.texto} · ${f.medida}`)]
      : []),
    ...(c.cumplidos > 0
      ? ["", `Los otros ${c.cumplidos} servicios cumplieron sin observaciones.`]
      : []),
    ...(c.pendientes > 0
      ? [
          "",
          `${c.pendientes} servicio(s) quedaron pendientes por evidencia: no cuentan como incumplimiento ni como cumplido.`,
          `El plazo de cierre está en definición con la planta y el área legal.`,
        ]
      : []),
    "",
    `Ver el cierre completo: ${c.urlCierre}`,
    "",
    selloTexto(c.selladoEn, c.politica, c.timeZone),
  ].join("\n");

  const pie = pieDeProcedencia(c.rol, c.contrato);
  return {
    asunto,
    html: envoltura({ encabezado: `J-Telemetry · Cierre del turno`, contenido, pie }),
    texto: `${texto}\n\n—\n${pie.join("\n")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Pendiente por evidencia — por evento, cara planta
// ─────────────────────────────────────────────────────────────────────────────

export type PendientesPorEvidencia = {
  cuenta: string;
  fecha: Date;
  servicios: FilaServicio[];
  urlBandeja: string;
  rol: string;
  contrato: string;
  timeZone?: string;
};

/**
 * El correo que la ficha imaginó como "el único que pide una decisión con
 * fecha límite" — y que hoy no puede pedirla.
 *
 * **No lleva `Acción requerida` ni fecha de cierre en el asunto**, porque el
 * plazo del pendiente no existe como regla acordada: es la decisión pendiente
 * de PLAN-v1 §4, la misma que dejamos fuera de la Oficina y de la pantalla.
 *
 * En un correo pesa más que en pantalla. Un correo se reenvía, se imprime y se
 * archiva: una fecha límite inventada dentro de un correo archivado sobrevive
 * fuera del sistema, y reaparece en una discusión de facturación como si
 * alguien la hubiera pactado.
 *
 * **Se agrupan en un correo, nunca uno por servicio.** Tres correos por lo
 * mismo se leen como spam y enseñan a archivar al remitente sin abrirlo.
 */
export function correoPendientes(p: PendientesPorEvidencia): Mensaje {
  const n = p.servicios.length;
  const asunto = `${p.cuenta} · ${n} ${n === 1 ? "servicio pendiente" : "servicios pendientes"} por evidencia — ${fechaParaAsunto(p.fecha, p.timeZone)}`;

  const contenido = [
    chip("Pendiente por evidencia", "ambar"),
    titularHtml(
      n === 1
        ? "Un servicio quedó sin resultado por falta de evidencia"
        : `${n} servicios quedaron sin resultado por falta de evidencia`,
    ),
    // El lede obligatorio. Sin esta frase, un gerente asume que son fallas y le
    // reclama al carrier algo que no pasó.
    parrafo(
      `<b style="font-weight:600">No cuentan como incumplimiento ni como cumplido.</b> El sistema no vio lo suficiente para emitir un resultado, y forzar un veredicto sobre lo que no alcanzó a observar sería inventarlo.`,
    ),
    seccion("Los servicios"),
    tablaServicios(p.servicios),
    parrafo(
      `Si la telemetría archivada llega completa, estos servicios <b style="font-weight:600">se verifican solos</b> y dejan de estar pendientes.`,
      C.tenue,
    ),
    parrafo(
      `El plazo para completar la evidencia está en definición con la planta y el área legal. Mientras no exista, este correo no pone una fecha límite — no hay ninguna acordada.`,
      C.tenue,
    ),
    boton("Ver la bandeja", p.urlBandeja),
  ]
    .filter(Boolean)
    .join("\n");

  const texto = [
    "PENDIENTE POR EVIDENCIA",
    "",
    n === 1
      ? "Un servicio quedó sin resultado por falta de evidencia."
      : `${n} servicios quedaron sin resultado por falta de evidencia.`,
    "",
    "No cuentan como incumplimiento ni como cumplido. El sistema no vio lo suficiente",
    "para emitir un resultado.",
    "",
    "LOS SERVICIOS",
    ...p.servicios.map((f) => `  ${f.servicio} — ${f.chip.texto} · ${f.medida}`),
    "",
    "Si la telemetría archivada llega completa, estos servicios se verifican solos.",
    "El plazo para completar la evidencia está en definición: no hay fecha límite acordada.",
    "",
    `Ver la bandeja: ${p.urlBandeja}`,
  ].join("\n");

  const pie = pieDeProcedencia(p.rol, p.contrato);
  return {
    asunto,
    html: envoltura({ encabezado: `J-Telemetry · Pendiente por evidencia`, contenido, pie }),
    texto: `${texto}\n\n—\n${pie.join("\n")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Aviso operativo — por evento, cara carrier
// ─────────────────────────────────────────────────────────────────────────────

export type AvisoOperativo = {
  cuenta: string;
  fecha: Date;
  titulo: string;
  hecho: string;
  medidas: Medida[];
  urlResolver: string;
  urlInvestigar: string;
  rol: string;
  contrato: string;
  timeZone?: string;
};

/**
 * La única alerta **preventiva**: llega mientras todavía se puede hacer algo.
 *
 * Chip en acero, nunca colores de veredicto — no es el resultado de ningún
 * servicio. Dice el hecho sin acusar, dice la consecuencia de tardar sin
 * regañar, y reafirma la frontera de confidencialidad, que el carrier debe
 * poder leer en cada contacto.
 *
 * Dos acciones aquí sí: resolver e investigar son igual de razonables.
 */
export function correoAvisoOperativo(a: AvisoOperativo): Mensaje {
  const asunto = `${a.cuenta} · ${a.titulo} — ${fechaParaAsunto(a.fecha, a.timeZone)}`;

  const contenido = [
    chip("Aviso operativo", "acero"),
    titularHtml(a.titulo),
    parrafo(esc(a.hecho)),
    parrafo(
      `El sistema registra lo que midió; <b style="font-weight:600">no acusa a nadie</b>. Esto es un aviso para que puedas resolverlo antes de que tenga consecuencia.`,
      C.tenue,
    ),
    seccion("Lo medido"),
    tablaMedidas(a.medidas),
    seccion("Por qué conviene hoy"),
    parrafo(
      `Declararlo más tarde queda registrado como tardío, y esa marca acompaña al servicio en el expediente. Resolverlo ahora evita esa nota — no hay multa por tardar, hay constancia.`,
    ),
    // La frontera, en cada contacto con el carrier.
    parrafo(
      `Tus clientes <b style="font-weight:600">no ven tus asignaciones ni tu operación interna</b>. Esto lo ves solo tú.`,
      C.tenue,
    ),
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px">${boton("Resolver ahora", a.urlResolver)}</td>
<td>${boton("Investigar primero", a.urlInvestigar)}</td>
</tr></table>`,
  ]
    .filter(Boolean)
    .join("\n");

  const texto = [
    "AVISO OPERATIVO",
    "",
    a.titulo,
    "",
    a.hecho,
    "El sistema registra lo que midió; no acusa a nadie.",
    "",
    "LO MEDIDO",
    ...a.medidas.map((m) => `  ${m.etiqueta}: ${m.valor} · ${m.lectura}`),
    "",
    "POR QUÉ CONVIENE HOY",
    "  Declararlo más tarde queda registrado como tardío, y esa marca acompaña",
    "  al servicio en el expediente.",
    "",
    "Tus clientes no ven tus asignaciones ni tu operación interna.",
    "",
    `Resolver ahora: ${a.urlResolver}`,
    `Investigar primero: ${a.urlInvestigar}`,
  ].join("\n");

  const pie = pieDeProcedencia(a.rol, a.contrato);
  return {
    asunto,
    html: envoltura({ encabezado: `J-Telemetry · Aviso operativo`, contenido, pie }),
    texto: `${texto}\n\n—\n${pie.join("\n")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Sistema caído — por evento, ambas caras
// ─────────────────────────────────────────────────────────────────────────────

export type SistemaCaido = {
  cuenta: string;
  ultimaLectura: Date;
  sinSenalDesde: string;
  unidadesAfectadas: number;
  serviciosEnRiesgo: number;
  urlEstado: string;
  timeZone?: string;
};

/**
 * El más importante y el que más fácil se hace mal.
 *
 * **Si el archivador se cae y nadie avisa, el silencio se lee como "todo
 * bien".** Por eso la negación va en el primer párrafo, antes de cualquier
 * dato: sin ella, un gerente lee "sin telemetría" y entiende "no salieron las
 * unidades".
 *
 * Ámbar, nunca rojo: no hay veredicto que dar. Y es el **único correo sin pie
 * de procedencia** — va a todos los roles del contrato, ignorando cualquier
 * preferencia, porque nadie debe operar creyendo que el sistema ve cuando no.
 */
export function correoSistemaCaido(s: SistemaCaido): Mensaje {
  const asunto = `${s.cuenta} · Sin telemetría desde el ${instanteSellado(s.ultimaLectura, s.timeZone)} — el sistema no está viendo las unidades`;

  const medidas: Medida[] = [
    {
      etiqueta: "Última lectura",
      valor: instanteSellado(s.ultimaLectura, s.timeZone),
      lectura: `hace ${s.sinSenalDesde}`,
    },
    {
      etiqueta: "Unidades afectadas",
      valor: String(s.unidadesAfectadas),
      lectura: s.unidadesAfectadas === 1 ? "sin reportar" : "sin reportar",
    },
    {
      etiqueta: "Servicios en riesgo",
      valor: String(s.serviciosEnRiesgo),
      lectura: "quedarían sin poder verificarse si el corte sigue",
    },
  ];

  const contenido = [
    chip("Sin señal", "ambar"),
    titularHtml(`El sistema no está recibiendo telemetría desde el ${instanteSellado(s.ultimaLectura, s.timeZone)}`),
    // La negación primero, antes de cualquier dato. Es toda la razón de ser de
    // este correo.
    parrafo(
      `<b style="font-weight:600">Esto no significa que las unidades no salieron.</b> Significa que el sistema no las está viendo.`,
    ),
    seccion("El alcance"),
    tablaMedidas(medidas),
    seccion("Qué implica mientras dure"),
    parrafo(
      `Los servicios de esta ventana no se van a poder verificar: quedarán <b style="font-weight:600">pendientes por evidencia</b>, que no es un incumplimiento — es la constancia de que el instrumento no alcanzó a ver.`,
    ),
    parrafo(
      `Si la telemetría llega completa cuando se restablezca la conexión, esos servicios <b style="font-weight:600">se verifican con normalidad</b> y dejan de estar pendientes.`,
      C.tenue,
    ),
    boton("Ver el estado del sistema", s.urlEstado),
  ]
    .filter(Boolean)
    .join("\n");

  const texto = [
    "SIN SEÑAL",
    "",
    `El sistema no está recibiendo telemetría desde el ${instanteSellado(s.ultimaLectura, s.timeZone)}.`,
    "",
    "Esto no significa que las unidades no salieron. Significa que el sistema no las está viendo.",
    "",
    "EL ALCANCE",
    ...medidas.map((m) => `  ${m.etiqueta}: ${m.valor} · ${m.lectura}`),
    "",
    "QUÉ IMPLICA MIENTRAS DURE",
    "  Los servicios de esta ventana quedarán pendientes por evidencia, que no es",
    "  un incumplimiento.",
    "",
    "  Si la telemetría llega completa al restablecerse, se verifican con normalidad.",
    "",
    `Ver el estado del sistema: ${s.urlEstado}`,
  ].join("\n");

  // Único correo sin pie de procedencia: va a todos los roles del contrato y no
  // admite preferencia. Decir "te llega porque..." sugeriría que se puede apagar.
  const pie = [
    "Este aviso va a todos los roles del contrato y no se puede desactivar:",
    "nadie debe operar creyendo que el sistema ve cuando no.",
  ];

  return {
    asunto,
    html: envoltura({ encabezado: `J-Telemetry · Estado del sistema`, contenido, pie }),
    texto: `${texto}\n\n—\n${pie.join("\n")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Móvil — la mitad que más se lee
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_TITULO_MAX = 48;
export const PUSH_CUERPO_MAX = 90;

export type Push = { titulo: string; cuerpo: string };

/**
 * Casi nadie abre esto en un escritorio a las seis de la mañana: **la
 * notificación se lee en la pantalla de bloqueo, y muchas veces eso es todo lo
 * que se lee.** Por eso el push tiene que sostenerse sin abrirse.
 *
 * Los topes no son estéticos: pasado ese largo, el sistema operativo corta con
 * puntos suspensivos, y lo que se pierde es siempre el final — donde suele
 * estar el dato. `recortar` prefiere cortar en un límite de palabra a que lo
 * haga el teléfono a media cifra.
 */
function recortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max - 1);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

export function pushCierre(c: Pick<CierreDelTurno, "turno" | "cumplidos" | "total" | "excepciones">): Push {
  const detalle = c.excepciones
    .map((e) => `${e.servicio} ${e.chip.texto.toLowerCase()}`)
    .join(", ");
  return {
    titulo: recortar(`${c.turno} cerrado — ${c.cumplidos} de ${c.total}`, PUSH_TITULO_MAX),
    cuerpo: recortar(
      c.excepciones.length === 0
        ? "Cerró limpio: ninguna excepción."
        : `${c.excepciones.length} ${c.excepciones.length === 1 ? "excepción" : "excepciones"}: ${detalle}.`,
      PUSH_CUERPO_MAX,
    ),
  };
}

export function pushPendientes(n: number): Push {
  return {
    titulo: recortar(
      n === 1 ? "1 servicio pendiente por evidencia" : `${n} pendientes por evidencia`,
      PUSH_TITULO_MAX,
    ),
    cuerpo: recortar(
      "No cuentan como incumplimiento ni como cumplido: el sistema no vio lo suficiente.",
      PUSH_CUERPO_MAX,
    ),
  };
}

export function pushSistemaCaido(ultimaLectura: Date, timeZone?: string): Push {
  return {
    titulo: recortar(
      `Sin telemetría desde las ${instanteSellado(ultimaLectura, timeZone).slice(11, 16)}`,
      PUSH_TITULO_MAX,
    ),
    cuerpo: recortar(
      "Las unidades pueden estar operando; el sistema no las ve.",
      PUSH_CUERPO_MAX,
    ),
  };
}
