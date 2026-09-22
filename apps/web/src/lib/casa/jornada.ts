import type { CausaDeLoQueFalta, EstadoDeVuelta, ParadasSinPaso, VueltaDeJornada } from "@jtel/domain";

/**
 * Las palabras de la hoja de la jornada (PR C de la ficha de Circuitos,
 * 22-sep-2026). Todo lo medido lo decide el motor (B, `armarJornada`); aquí
 * sólo se dice, con el vocabulario de la 9.3c:
 *
 *   Completa · Incompleta · salió del corredor en ‹parada› (o entró) ·
 *   SIN DATOS · Paradas sin paso · Todavía no se mide
 *
 * **«Cortó», «cortada», «cortó la ruta» no se dicen** (9.3c): implican una
 * intención que nadie midió.
 *
 * **El intervalo de un paso es del SERVICIO, no de la unidad** (ASAV, 22-sep).
 * Se mide contra el paso anterior en esa parada, de cualquier unidad (9.2d, la
 * vara de la torre); en la hoja de la 2120, «ATRASADA» se leería como que la
 * 2120 llegó tarde. Por eso aquí se dice «intervalo en rango / corto / largo»
 * con «vs. el paso anterior (2107)» al lado: el mismo dato, sin acusar a este
 * camión.
 */

export function estadoDeVueltaEnPalabras(v: Pick<VueltaDeJornada, "estado" | "faltan">): string {
  switch (v.estado) {
    case "completa":
      return "Completa";
    case "incompleta": {
      const c = v.faltan.map((f) => f.causa).find((x) => x.tipo === "salio_del_corredor" || x.tipo === "entro_al_corredor");
      return c ? `Incompleta · ${causaEnPalabras(c)}` : "Incompleta";
    }
    case "sin_datos":
      return "SIN DATOS";
    case "paradas_sin_paso":
      return "Paradas sin paso";
    case "todavia_no_se_mide":
      return "Todavía no se mide";
  }
}

export function causaEnPalabras(c: CausaDeLoQueFalta): string {
  switch (c.tipo) {
    case "salio_del_corredor":
      return `salió del corredor en ${c.nombre}`;
    case "entro_al_corredor":
      return `entró al corredor en ${c.nombre}`;
    case "sin_datos":
      return "cae en un silencio del GPS: no se afirma que no lo hizo";
    case "todavia_no_se_mide":
      return "el detector todavía no llega aquí";
    case "sin_causa_medida":
      return "sin causa medida";
  }
}

/** «Faltan Zaragoza y Tecnológico · salió del corredor en Oasis». */
export function faltanEnPalabras(f: ParadasSinPaso): string {
  const nombres = f.paradas.map((p) => p.nombre);
  const lista = nombres.length <= 1 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  return `${nombres.length === 1 ? "Falta" : "Faltan"} ${lista} · ${causaEnPalabras(f.causa)}`;
}

export type EstadoDeIntervalo = "en_rango" | "adelantada" | "atrasada" | "sin_datos" | "no_aplica";

/** El intervalo del servicio en esa parada, NO un veredicto de la unidad. */
export function intervaloEnPalabras(estado: EstadoDeIntervalo): string {
  switch (estado) {
    case "en_rango":
      return "intervalo en rango";
    case "adelantada":
      return "intervalo corto";
    case "atrasada":
      return "intervalo largo";
    default:
      return "intervalo sin datos";
  }
}

/** Contra qué se midió: el paso anterior de otra unidad, de ésta misma, o la apertura del día. */
export function contraQueEnPalabras(anteriorEtiqueta: string | null, anteriorUnitId: string | null, estaUnidad: string): string {
  if (anteriorUnitId === null) return "vs. la apertura del día";
  if (anteriorUnitId === estaUnidad) return "vs. su propio paso anterior";
  return `vs. el paso anterior (${anteriorEtiqueta ?? "otra unidad"})`;
}

/** Las vueltas contadas por estado, para el resumen: sólo las que hay. */
export function conteoDeVueltasEnPalabras(conteo: Record<EstadoDeVuelta, number>): string {
  const orden: Array<[EstadoDeVuelta, string, string]> = [
    ["completa", "completa", "completas"],
    ["incompleta", "incompleta", "incompletas"],
    ["sin_datos", "sin datos", "sin datos"],
    ["paradas_sin_paso", "con paradas sin paso", "con paradas sin paso"],
    ["todavia_no_se_mide", "todavía sin medir", "todavía sin medir"],
  ];
  return orden
    .filter(([k]) => conteo[k] > 0)
    .map(([k, uno, varios]) => `${conteo[k]} ${conteo[k] === 1 ? uno : varios}`)
    .join(" · ");
}

/** Un día civil más o menos, sin pasar de hoy. `null` si no hay a dónde ir. */
export function diaVecino(fecha: string, delta: -1 | 1, hoy: string): string | null {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + delta));
  const iso = t.toISOString().slice(0, 10);
  return delta > 0 && iso > hoy ? null : iso;
}
