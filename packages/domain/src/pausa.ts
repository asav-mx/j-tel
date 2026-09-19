import { JTTEL_TZ, instanteZonificado, localDateIso } from "./tiempo.js";

/**
 * La pausa de la verificación de un contrato (0041, 19 sep 2026).
 *
 * **Es un evento, no una palomita:** pausar agrega un evento con quién, cuándo
 * se registró, desde cuándo vale y por qué; reanudar agrega otro. Todo lo de
 * aquí es puro: arma los intervalos de pausa con los eventos, responde si un
 * instante cae en uno, revisa un evento nuevo antes de escribirlo y dice la
 * línea que va arriba de Servicios especiales.
 *
 * Dos preguntas distintas, y el motor hace las dos:
 *
 * 1. **¿La ocurrencia cae en una pausa?** Su llegada exigida está dentro de un
 *    intervalo de pausa. Esa ocurrencia no se genera, y si existía sin hecho se
 *    borra: nunca fue un hecho. Al reanudar sigue sin generarse: lo no medido
 *    durante la pausa jamás se inventa hacia atrás.
 * 2. **¿El contrato está en pausa ahora?** Entonces no se sella nada de él,
 *    tampoco los pendientes viejos que el cron reintentaría (decisión 3 de
 *    Asav: re-sellar es sellar). Al reanudar, el cron los retoma solo.
 */

export type TipoDeEvento = "pausa" | "reanudacion";

export type EventoDeVerificacion = {
  tipo: TipoDeEvento;
  valeDesde: Date;
  motivo: string | null;
  registradoAt: Date;
};

export type IntervaloDePausa = {
  desde: Date;
  /** `null` mientras sigue en pausa. */
  hasta: Date | null;
  motivo: string;
};

/** Lo más largo que se guarda como motivo: cabe en una línea (CHECK de la 0041). */
export const MOTIVO_DE_PAUSA_MAX = 160;

const ordenados = (eventos: readonly EventoDeVerificacion[]) =>
  [...eventos].sort(
    (a, b) => a.valeDesde.getTime() - b.valeDesde.getTime() || a.registradoAt.getTime() - b.registradoAt.getTime(),
  );

/**
 * Los intervalos de pausa de un contrato. La base garantiza que los eventos se
 * alternan y van hacia adelante; si algo llegara fuera de orden, se lee en el
 * orden de `valeDesde` y una reanudación sin pausa abierta no abre nada.
 */
export function intervalosDePausa(eventos: readonly EventoDeVerificacion[]): IntervaloDePausa[] {
  const intervalos: IntervaloDePausa[] = [];
  let abierta: IntervaloDePausa | null = null;
  for (const e of ordenados(eventos)) {
    if (e.tipo === "pausa" && !abierta) {
      abierta = { desde: e.valeDesde, hasta: null, motivo: e.motivo ?? "" };
      intervalos.push(abierta);
    } else if (e.tipo === "reanudacion" && abierta) {
      abierta.hasta = e.valeDesde;
      abierta = null;
    }
  }
  return intervalos;
}

/** ¿Este instante cae en una pausa? El inicio cuenta; el instante de reanudar ya no. */
export function caeEnPausa(intervalos: readonly IntervaloDePausa[], instante: Date): boolean {
  const t = instante.getTime();
  return intervalos.some((i) => i.desde.getTime() <= t && (i.hasta === null || t < i.hasta.getTime()));
}

/** La pausa vigente en este momento, o `null`. */
export function pausaVigente(intervalos: readonly IntervaloDePausa[], ahora: Date): IntervaloDePausa | null {
  return intervalos.find((i) => i.desde.getTime() <= ahora.getTime() && i.hasta === null) ?? null;
}

/** Una fecha civil de la zona del contrato, a su medianoche: «desde el 5 sep». */
export function inicioDeFecha(fechaIso: string, zona: string = JTTEL_TZ): Date {
  return instanteZonificado(fechaIso, 0, zona);
}

export type ErrorDeEvento =
  | "fecha_invalida"
  | "fecha_futura"
  | "ya_en_pausa"
  | "no_esta_en_pausa"
  | "antes_del_evento_anterior"
  | "motivo_vacio"
  | "motivo_largo";

export const PALABRAS_DEL_ERROR: Record<ErrorDeEvento, string> = {
  fecha_invalida: "Elige la fecha desde la que vale la pausa.",
  fecha_futura: "Una pausa vale desde hoy o desde antes: no se agenda hacia el futuro.",
  ya_en_pausa: "La verificación de este contrato ya está en pausa.",
  no_esta_en_pausa: "La verificación de este contrato no está en pausa.",
  antes_del_evento_anterior: "La pausa tiene que empezar después de la última reanudación de este contrato.",
  motivo_vacio: "Escribe el motivo de la pausa.",
  motivo_largo: `El motivo no cabe en una línea: usa menos de ${MOTIVO_DE_PAUSA_MAX} letras.`,
};

/**
 * Revisa una pausa antes de escribirla, con las mismas reglas que la base (la
 * base las vuelve a exigir; aquí se revisan para decirlas en palabras).
 */
export function revisarPausa(entrada: {
  eventos: readonly EventoDeVerificacion[];
  valeDesde: Date | null;
  motivo: string | null | undefined;
  ahora: Date;
}): { ok: true; motivo: string } | { ok: false; error: ErrorDeEvento } {
  const { eventos, valeDesde, ahora } = entrada;
  const motivo = (entrada.motivo ?? "").replace(/\s+/g, " ").trim();
  if (!valeDesde || Number.isNaN(valeDesde.getTime())) return { ok: false, error: "fecha_invalida" };
  if (valeDesde.getTime() > ahora.getTime()) return { ok: false, error: "fecha_futura" };
  const ultimo = ordenados(eventos).at(-1);
  if (ultimo?.tipo === "pausa") return { ok: false, error: "ya_en_pausa" };
  if (ultimo && valeDesde.getTime() <= ultimo.valeDesde.getTime()) return { ok: false, error: "antes_del_evento_anterior" };
  if (motivo.length === 0) return { ok: false, error: "motivo_vacio" };
  if (motivo.length > MOTIVO_DE_PAUSA_MAX) return { ok: false, error: "motivo_largo" };
  return { ok: true, motivo };
}

/** Reanudar vale desde que se registra: lo no medido durante la pausa no se genera hacia atrás. */
export function revisarReanudacion(entrada: {
  eventos: readonly EventoDeVerificacion[];
}): { ok: true } | { ok: false; error: ErrorDeEvento } {
  const ultimo = ordenados(entrada.eventos).at(-1);
  if (ultimo?.tipo !== "pausa") return { ok: false, error: "no_esta_en_pausa" };
  return { ok: true };
}

/* ─── Cómo se dice ─────────────────────────────────────────────────────── */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function diaYMes(t: Date, zona: string): { dia: number; mes: string; anio: string } {
  const [anio, mes, dia] = localDateIso(t, zona).split("-");
  return { dia: Number(dia), mes: MESES[Number(mes) - 1]!, anio: anio! };
}

/**
 * La fecha de una pausa en palabras: «desde el 5 sep» o «del 5 al 20 sep».
 * `hasta` es el instante de reanudar; el último día en pausa es el anterior
 * si reanudó justo a medianoche.
 */
export function periodoDePausaEnPalabras(i: IntervaloDePausa, zona: string = JTTEL_TZ): string {
  const a = diaYMes(i.desde, zona);
  if (i.hasta === null) return `desde el ${a.dia} ${a.mes}`;
  const ultimoInstante = new Date(i.hasta.getTime() - 1);
  const z = diaYMes(ultimoInstante, zona);
  if (a.mes === z.mes && a.anio === z.anio) {
    return a.dia === z.dia ? `el ${a.dia} ${a.mes}` : `del ${a.dia} al ${z.dia} ${z.mes}`;
  }
  return `del ${a.dia} ${a.mes} al ${z.dia} ${z.mes}`;
}

/**
 * La línea de arriba de Servicios especiales (decisiones 4 y 5 de Asav): una
 * sola, sin párrafos. El contrato va adelante sólo si la cuenta tiene más de
 * uno: lo que no distingue nada, no se muestra.
 */
export function lineaDePausa(
  i: IntervaloDePausa,
  opciones: { zona?: string; contrato?: string | null } = {},
): string {
  const cuerpo = `Verificación en pausa ${periodoDePausaEnPalabras(i, opciones.zona)} · ${i.motivo}`;
  return opciones.contrato ? `${opciones.contrato} · ${cuerpo}` : cuerpo;
}

/** ¿El intervalo toca la ventana [desde, hasta]? */
export function pausaTocaVentana(i: IntervaloDePausa, desde: Date, hasta: Date): boolean {
  return i.desde.getTime() <= hasta.getTime() && (i.hasta === null || i.hasta.getTime() > desde.getTime());
}
