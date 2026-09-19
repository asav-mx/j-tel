import { JTTEL_TZ, addDaysIso, instanteZonificado, localDateIso, ventanaDelDia } from "@jtel/domain";

/**
 * La ventana de tiempo de la casa — una sola pieza para C3 (Recorridos y
 * playback) y para Vernier (Servicios especiales).
 *
 * Salió de `recorrido.ts` el 18 sep 2026, cuando Vernier la necesitó (decisión
 * 7 de Asav: «que la misma palabra signifique lo mismo en toda la casa vale más
 * que no tocar lo ya hecho»). Con ella cambió un atajo: **«Últimos 7 días» ya
 * no existe; es «Esta semana»**, del lunes a las 00:00 de la zona al momento de
 * mirar, sin importar el día (ficha Vernier §2).
 *
 * **La zona es un dato, no una constante.** C3 sigue en la del despliegue
 * (`JTTEL_TZ`); Vernier usa la del mercado de la cuenta. Por eso cada función
 * la recibe, con la del despliegue por omisión para que C3 no cambie de
 * firma. Que las demás pantallas sigan con la zona fija es pendiente con
 * nombre, no de este cambio.
 */

export type Periodo = { desde: number; hasta: number };
export type Atajo = { nombre: string; periodo: Periodo };

const MINUTO = 60_000;

const diaDe = (t: number, zona: string) => localDateIso(new Date(t), zona);
const inicioDelDia = (t: number, zona: string) => ventanaDelDia(diaDe(t, zona), zona).desde.getTime();

/** El día de la semana de una fecha civil, 0 = domingo. No depende de la zona: la fecha ya es civil. */
const diaDeLaSemana = (fechaIso: string) => new Date(`${fechaIso}T12:00:00Z`).getUTCDay();

/**
 * Los atajos exactos: Hoy · Ayer · Esta semana · Este mes. Ninguno horneado:
 * todos salen de `ahora` y de la zona.
 *
 * «Esta semana» arranca el **lunes a las 00:00** de la zona, también en lunes
 * (entonces es igual a «Hoy») y en domingo (siete días enteros menos lo que
 * falta del domingo).
 */
export function atajosDeTiempo(ahora: number, zona: string = JTTEL_TZ): Atajo[] {
  const hoy = diaDe(ahora, zona);
  const inicioHoy = inicioDelDia(ahora, zona);
  const ayer = ventanaDelDia(addDaysIso(hoy, -1), zona);
  const lunes = addDaysIso(hoy, -((diaDeLaSemana(hoy) + 6) % 7));
  return [
    { nombre: "Hoy", periodo: { desde: inicioHoy, hasta: ahora } },
    { nombre: "Ayer", periodo: { desde: ayer.desde.getTime(), hasta: ayer.hasta.getTime() } },
    { nombre: "Esta semana", periodo: { desde: ventanaDelDia(lunes, zona).desde.getTime(), hasta: ahora } },
    { nombre: "Este mes", periodo: { desde: instanteZonificado(`${hoy.slice(0, 8)}01`, 0, zona).getTime(), hasta: ahora } },
  ];
}

/** Las flechas ‹ ›: mueven el tamaño de la ventana vigente, no «un día». */
export function mover(p: Periodo, sentido: -1 | 1): Periodo {
  const ancho = p.hasta - p.desde + 1;
  return { desde: p.desde + sentido * ancho, hasta: p.hasta + sentido * ancho };
}

/** Quitar el acote regresa al día completo que contiene el inicio. */
export function diaQueContiene(t: number, zona: string = JTTEL_TZ): Periodo {
  const v = ventanaDelDia(diaDe(t, zona), zona);
  return { desde: v.desde.getTime(), hasta: v.hasta.getTime() };
}

/** Un día y una hora del panel («2026-09-14», «06:00»), en la zona, a instante. */
export function instanteDelPanel(fecha: string, hora: string, zona: string = JTTEL_TZ): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, m] = hora.split(":").map(Number);
  return instanteZonificado(fecha, h! * 60 + m!, zona).getTime();
}

export function panelDe(t: number, zona: string = JTTEL_TZ): { fecha: string; hora: string } {
  return { fecha: diaDe(t, zona), hora: hhmm(t, zona) };
}

/**
 * Lee la ventana de la dirección; si no viene o no sirve, el atajo por omisión
 * de quien pregunta (C3: «Hoy»; Vernier: «Ayer», como su prototipo).
 */
export function periodoDeLaDireccion(
  desde: string | undefined,
  hasta: string | undefined,
  ahora: number,
  opciones: { zona?: string; porOmision?: number } = {},
): Periodo {
  const a = desde ? Date.parse(desde) : Number.NaN;
  const z = hasta ? Date.parse(hasta) : Number.NaN;
  if (Number.isFinite(a) && Number.isFinite(z) && z > a) return { desde: a, hasta: z };
  return atajosDeTiempo(ahora, opciones.zona)[opciones.porOmision ?? 0]!.periodo;
}

/** ¿El periodo es exactamente uno de los atajos? Para marcarlo activo. */
export function atajoDelPeriodo(p: Periodo, ahora: number, zona: string = JTTEL_TZ): string | null {
  return (
    atajosDeTiempo(ahora, zona).find(
      (a) => a.periodo.desde === p.desde && Math.abs(a.periodo.hasta - p.hasta) <= MINUTO,
    )?.nombre ?? null
  );
}

/* ─── Cómo se dice ──────────────────────────────────────────────────────── */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SEMANA_EN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatos = new Map<string, Intl.DateTimeFormat>();
function partesEn(zona: string): Intl.DateTimeFormat {
  let f = formatos.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatos.set(zona, f);
  }
  return f;
}

function leer(t: number, zona: string) {
  const p = Object.fromEntries(partesEn(zona).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return {
    dia: Number(p.day),
    mes: Number(p.month),
    semana: SEMANA_EN[p.weekday!]!,
    hh: p.hour!,
    mm: p.minute!,
    ss: p.second!,
  };
}

export const hhmm = (t: number, zona: string = JTTEL_TZ) => {
  const p = leer(t, zona);
  return `${p.hh}:${p.mm}`;
};
export const hhmmss = (t: number, zona: string = JTTEL_TZ) => {
  const p = leer(t, zona);
  return `${p.hh}:${p.mm}:${p.ss}`;
};
/** «dom 14 sep» */
export const diaCorto = (t: number, zona: string = JTTEL_TZ) => {
  const p = leer(t, zona);
  return `${DIAS[p.semana]} ${p.dia} ${MESES[p.mes - 1]}`;
};
/** «sáb 14 sep 10:18:30» */
export const sello = (t: number, zona: string = JTTEL_TZ) => `${diaCorto(t, zona)} ${hhmmss(t, zona)}`;

/** Cómo se nombra el periodo en su botón. */
export function etiquetaDelPeriodo(p: Periodo, leida: number, zona: string = JTTEL_TZ): string {
  const mismoDia = diaDe(p.desde, zona) === diaDe(p.hasta, zona);
  const hastaAhora = Math.abs(p.hasta - leida) <= MINUTO;
  const desdeMedianoche = hhmm(p.desde, zona) === "00:00";
  if (mismoDia && hastaAhora && desdeMedianoche) return `${diaCorto(p.desde, zona)} · hasta ahora`;
  if (mismoDia && desdeMedianoche && p.hasta - p.desde >= 24 * 60 * MINUTO - 2 * MINUTO) {
    return `${diaCorto(p.desde, zona)} · todo el día`;
  }
  if (mismoDia) return `${diaCorto(p.desde, zona)} · ${hhmm(p.desde, zona)}–${hhmm(p.hasta, zona)}`;
  return `${diaCorto(p.desde, zona)} ${hhmm(p.desde, zona)} → ${diaCorto(p.hasta, zona)} ${hhmm(p.hasta, zona)}${
    hastaAhora ? " (ahora)" : ""
  }`;
}
