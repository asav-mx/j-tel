/**
 * Cómo se escriben los instantes y las duraciones en el historial de flota.
 *
 * Dos reglas del skill, hechas función para que no se puedan olvidar:
 *
 *  - Los INSTANTES llevan fecha completa cuando sirven de evidencia. Un turno
 *    nocturno cruza la medianoche, y una hora sin fecha no sostiene un caso.
 *  - Las DURACIONES llevan unidad y jamás formato de hora: `2 h 14 min`, nunca
 *    `2:14`, que se lee como hora del día.
 *
 * Toda hora que sale de aquí está en la zona del despliegue, y la pantalla
 * escribe cuál es.
 */

import { JTTEL_TZ } from "@/lib/local-time";

/** Hora del reloj, al segundo. Para mediciones. */
export function reloj(d: Date, timeZone: string = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Hora del reloj sin segundos. Para ejes y etiquetas. */
export function relojCorto(d: Date, timeZone: string = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Fecha completa. En contexto de evidencia no se abrevia. */
export function fechaCompleta(d: Date, timeZone: string = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Fecha civil ISO (`2026-07-22`) escrita para leerse: `mié 22 jul 2026`. */
export function fechaDeIso(fechaIso: string, timeZone: string = JTTEL_TZ): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  // Mediodía UTC: cualquier zona cae en el mismo día civil.
  const instante = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(instante);
}

/**
 * La misma fecha sin el año, para cuando el periodo ya lo dijo arriba:
 * `mié 22 jul`.
 *
 * Se arma con las partes en vez de recortar el texto ya formado — quitarle
 * los cuatro dígitos del final a "mié, 22 de jul de 2026" deja un "de"
 * colgando, y en una tabla de evidencia eso se lee como un dato incompleto.
 */
export function fechaDeIsoSinAnio(fechaIso: string, timeZone: string = JTTEL_TZ): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const instante = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const partes = new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(instante);

  const de = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  return `${de("weekday")} ${de("day")} ${de("month")}`.replace(/\.$/, "");
}

/**
 * Instante completo para marcas de sellado: `2026-07-24 06:50:00`.
 *
 * Fecha y hora juntas, en ese orden y sin abreviar, porque una marca de sello
 * es evidencia: una hora suelta no dice de qué día se está hablando y un
 * servicio nocturno cruza la medianoche.
 */
export function instanteSellado(d: Date, timeZone: string = JTTEL_TZ): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const de = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${de("year")}-${de("month")}-${de("day")} ${de("hour")}:${de("minute")}:${de("second")}`;
}

/**
 * Una duración, escrita como duración.
 *
 * Por debajo de una hora se escribe en minutos con un decimal cuando el
 * decimal significa algo: un hueco de 46.4 min no es lo mismo que uno de 46.
 *
 * **Pasados dos días se escribe en días**, y no es cosmética. Una unidad que
 * lleva sin reportar desde mayo daba `2 578 h`, que es correcto y no se lee:
 * nadie divide entre veinticuatro de cabeza a las seis de la mañana. El corte
 * está en 48 h y no en 24 para que un hueco de un turno de noche —«31 h»—
 * conserve su hora, que ahí sí es la unidad en la que se piensa.
 */
export function duracion(minutos: number): string {
  if (minutos < 1) {
    const segundos = Math.round(minutos * 60);
    return `${segundos} s`;
  }
  if (minutos < 60) {
    const redondo = Math.round(minutos * 10) / 10;
    return Number.isInteger(redondo) ? `${redondo} min` : `${redondo.toFixed(1)} min`;
  }
  if (minutos < 48 * 60) {
    const horas = Math.floor(minutos / 60);
    const resto = Math.round(minutos - horas * 60);
    if (resto === 0) return `${horas} h`;
    return `${horas} h ${resto} min`;
  }
  const dias = Math.floor(minutos / (24 * 60));
  const horasResto = Math.round((minutos - dias * 24 * 60) / 60);
  // 47 h de resto redondean a 24 y darían "3 días 24 h", que no existe.
  if (horasResto >= 24) return `${dias + 1} días`;
  if (horasResto === 0) return `${dias} días`;
  return `${dias} días ${horasResto} h`;
}

/**
 * La diferencia entre dos instantes, con su signo dicho en palabras.
 *
 * `10 min antes` / `2 h 14 min de retraso` — nunca `-10:00`, que no se lee.
 */
export function margen(observado: Date, limite: Date): string {
  const minutos = (observado.getTime() - limite.getTime()) / 60_000;
  if (Math.abs(minutos) < 1 / 60) return "justo en el límite";
  return minutos < 0
    ? `${duracion(Math.abs(minutos))} antes`
    : `${duracion(minutos)} de retraso`;
}
