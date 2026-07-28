/**
 * Recorrido de la flota — censo y medición por unidad, función pura.
 *
 * Observación pura de lo propio: quién reportó, quién no, y con qué resolución.
 * No emite veredicto, no consulta hechos sellados, no sabe qué es un match.
 *
 * Existe porque el 2026-07-28 la pregunta que cerraba el diagnóstico —"¿por
 * dónde fue el camión el 21, el 24 y el 27?"— no se podía contestar desde el
 * producto: solo había el inventario de altas y las credenciales del proveedor.
 *
 * El censo distingue TRES cosas que hoy se ven iguales:
 *
 *   reportó            — hay dato en la ventana
 *   dejó de reportar   — hay dato histórico, pero no en la ventana
 *   nunca reportó      — no hay un solo punto en toda su historia
 *
 * Esa última categoría no es una falla del árbitro: es un camión invisible. Si
 * hace una ruta, el sistema no ve nada. Medido el 2026-07-28, eran 23 de 82.
 *
 * Aquí solo vive la medición. Reunir los datos es trabajo de la página, y así
 * el censo se prueba sin base de datos.
 */

import { haversineKm } from "@jtel/verification";

/**
 * Velocidad implícita por encima de la cual un tramo es un salto del equipo y
 * no movimiento real. Mismo valor que usa `apps/web/src/lib/autopsia.ts`; los
 * kilómetros que salen de aquí van marcados como aproximados justamente porque
 * el tramo descartado deja un hueco en la suma y no hay regla para rellenarlo.
 */
export const SALTO_GPS_KMH = 300;

/** Desplazamiento de una zona respecto a UTC, en ms, para un instante dado. */
function desplazamientoMs(instante: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  return (
    Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) -
    instante.getTime()
  );
}

/**
 * Una fecha civil y unos minutos desde medianoche, en una zona, al instante
 * real que les corresponde.
 *
 * Dos pasadas a propósito: la primera conjetura el desplazamiento con la hora
 * equivocada, la segunda lo corrige. Sin eso, los dos días del año en que
 * cambia el horario salen con una hora de error.
 */
export function instanteZonificado(
  fechaIso: string,
  minutos: number,
  timeZone: string,
): Date {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const civil = Date.UTC(anio!, mes! - 1, dia!, 0, 0, 0) + minutos * 60_000;
  const primera = civil - desplazamientoMs(new Date(civil), timeZone);
  return new Date(civil - desplazamientoMs(new Date(primera), timeZone));
}

/**
 * Ventana de observación a partir de una fecha civil y un rango de horas.
 *
 * Si la hora final no es mayor que la inicial, la ventana cruza medianoche y
 * termina al día siguiente. No es un caso raro: los turnos de noche lo hacen,
 * y sin esto el turno nocturno sería el único que no se puede mirar.
 */
export function ventanaLocal(
  fechaIso: string,
  minutosDesde: number,
  minutosHasta: number,
  timeZone: string,
): { desde: Date; hasta: Date; cruzaMedianoche: boolean } {
  const cruzaMedianoche = minutosHasta <= minutosDesde;
  return {
    desde: instanteZonificado(fechaIso, minutosDesde, timeZone),
    hasta: instanteZonificado(
      fechaIso,
      cruzaMedianoche ? minutosHasta + 1440 : minutosHasta,
      timeZone,
    ),
    cruzaMedianoche,
  };
}

export type PuntoObservado = {
  unitId: string;
  /** El equipo que lo reportó. Una unidad puede tener más de uno. */
  imei: string;
  recordedAt: Date;
  latitude: number;
  longitude: number;
};

export type UnidadDeFlota = {
  id: string;
  label: string;
  plateNumber: string | null;
};

export type CategoriaCenso = "reporto" | "dejo_de_reportar" | "nunca_reporto";

export type FilaRecorrido = {
  unitId: string;
  label: string;
  plateNumber: string | null;
  categoria: CategoriaCenso;
  /** Puntos de la unidad en la ventana, sumando todos sus equipos. */
  puntos: number;
  /** Cuántos equipos distintos reportaron por esta unidad en la ventana. */
  equipos: number;
  primerDato: Date | null;
  ultimoDato: Date | null;
  /**
   * Último punto conocido en toda la historia, para las unidades que no
   * reportaron en la ventana. Es lo que separa "dejó de reportar el 25" de
   * "nunca ha reportado": la primera tiene fecha, la segunda es `null`.
   */
  ultimoDatoConocido: Date | null;
  /**
   * Intervalo mediano entre pings, en segundos, del equipo con más puntos.
   *
   * Mediana y no promedio: un solo hueco largo distorsiona el promedio y
   * haría ver mal a una unidad que reportó bien casi todo el tiempo.
   *
   * Del equipo con más puntos y no de la mezcla: si dos equipos reportan por
   * la misma unidad, intercalar sus tiempos inventa una densidad que ninguno
   * de los dos tuvo.
   *
   * `null` cuando hay menos de dos puntos — un punto solo no tiene intervalo.
   */
  intervaloMedianoSegundos: number | null;
  /**
   * Distancia recorrida, en kilómetros, del equipo con más puntos.
   * SIEMPRE aproximada: los tramos con velocidad implícita imposible se
   * descartan y dejan un hueco en la suma.
   */
  kmAproximados: number | null;
  /** Cuántos tramos se descartaron por salto. Se muestra, no se esconde. */
  saltosDescartados: number;
};

export type Censo = {
  ventana: { desde: Date; hasta: Date; minutos: number };
  /** Unidades activas del carrier — el denominador honesto. */
  activas: number;
  reportaron: number;
  dejaronDeReportar: number;
  nuncaReportaron: number;
  /** Todas las unidades activas, reportaran o no. Ninguna se omite. */
  filas: FilaRecorrido[];
};

export type EntradaCenso = {
  ventana: { desde: Date; hasta: Date };
  /** Unidades ACTIVAS del carrier. El censo se cuenta contra estas. */
  unidades: UnidadDeFlota[];
  /** Puntos de la ventana, en cualquier orden. */
  puntos: PuntoObservado[];
  /**
   * Último punto conocido por unidad en toda la historia. Solo hace falta
   * para las que no reportaron en la ventana; sobra para las demás.
   */
  ultimoDatoPorUnidad: Map<string, Date>;
};

/** Mediana exacta. Con longitud par, promedio de los dos centrales. */
function mediana(valoresOrdenados: number[]): number {
  const n = valoresOrdenados.length;
  const medio = Math.floor(n / 2);
  return n % 2 === 1
    ? valoresOrdenados[medio]!
    : (valoresOrdenados[medio - 1]! + valoresOrdenados[medio]!) / 2;
}

/** Intervalo mediano entre pings consecutivos, en segundos. */
function intervaloMediano(puntos: PuntoObservado[]): number | null {
  if (puntos.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < puntos.length; i++) {
    gaps.push(puntos[i]!.recordedAt.getTime() - puntos[i - 1]!.recordedAt.getTime());
  }
  gaps.sort((a, b) => a - b);
  return mediana(gaps) / 1000;
}

/** Kilómetros recorridos descartando saltos del equipo. */
function kilometros(puntos: PuntoObservado[]): { km: number; saltos: number } {
  let km = 0;
  let saltos = 0;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    const tramo = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
    const horas = (b.recordedAt.getTime() - a.recordedAt.getTime()) / 3_600_000;
    // Dos lecturas del mismo instante no son un tramo: no suman ni son salto.
    if (horas <= 0) continue;
    if (tramo / horas > SALTO_GPS_KMH) {
      saltos++;
      continue;
    }
    km += tramo;
  }
  return { km, saltos };
}

/**
 * Construye el censo de la flota sobre una ventana.
 *
 * Toda unidad activa aparece en `filas`, reportara o no. Omitir a las mudas
 * es exactamente cómo el 28 de julio se volvió invisible: el mapa solo puede
 * dibujar lo que existe, y sin censo la pantalla miente por omisión.
 */
export function construirCenso(entrada: EntradaCenso): Censo {
  const { ventana, unidades, puntos, ultimoDatoPorUnidad } = entrada;

  const porUnidad = new Map<string, PuntoObservado[]>();
  for (const p of puntos) {
    const lista = porUnidad.get(p.unitId);
    if (lista) lista.push(p);
    else porUnidad.set(p.unitId, [p]);
  }

  const filas: FilaRecorrido[] = unidades.map((u) => {
    const suyos = porUnidad.get(u.id) ?? [];

    if (suyos.length === 0) {
      const ultimoConocido = ultimoDatoPorUnidad.get(u.id) ?? null;
      return {
        unitId: u.id,
        label: u.label,
        plateNumber: u.plateNumber,
        categoria: ultimoConocido ? "dejo_de_reportar" : "nunca_reporto",
        puntos: 0,
        equipos: 0,
        primerDato: null,
        ultimoDato: null,
        ultimoDatoConocido: ultimoConocido,
        intervaloMedianoSegundos: null,
        kmAproximados: null,
        saltosDescartados: 0,
      };
    }

    suyos.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

    // Agrupar por equipo: la densidad y los kilómetros salen del equipo con
    // más puntos, no de la mezcla. Mezclar dos equipos de la misma unidad
    // inventa una densidad que ninguno tuvo y un recorrido en zigzag entre
    // dos lecturas simultáneas.
    const porEquipo = new Map<string, PuntoObservado[]>();
    for (const p of suyos) {
      const lista = porEquipo.get(p.imei);
      if (lista) lista.push(p);
      else porEquipo.set(p.imei, [p]);
    }
    const representante = [...porEquipo.values()].reduce((mejor, actual) =>
      actual.length > mejor.length ? actual : mejor,
    );

    const { km, saltos } = kilometros(representante);

    return {
      unitId: u.id,
      label: u.label,
      plateNumber: u.plateNumber,
      categoria: "reporto" as const,
      puntos: suyos.length,
      equipos: porEquipo.size,
      primerDato: suyos[0]!.recordedAt,
      ultimoDato: suyos[suyos.length - 1]!.recordedAt,
      ultimoDatoConocido: null,
      intervaloMedianoSegundos: intervaloMediano(representante),
      kmAproximados: representante.length >= 2 ? km : null,
      saltosDescartados: saltos,
    };
  });

  // Las que reportaron van por etiqueta, para poder buscar una unidad. Las que
  // dejaron de reportar van por fecha del último dato, la más reciente arriba:
  // una que calló ayer se atiende distinto que una que calló hace un mes.
  const orden: Record<CategoriaCenso, number> = {
    reporto: 0,
    dejo_de_reportar: 1,
    nunca_reporto: 2,
  };
  filas.sort((a, b) => {
    if (orden[a.categoria] !== orden[b.categoria]) {
      return orden[a.categoria] - orden[b.categoria];
    }
    if (a.categoria === "dejo_de_reportar") {
      const ta = a.ultimoDatoConocido?.getTime() ?? 0;
      const tb = b.ultimoDatoConocido?.getTime() ?? 0;
      if (ta !== tb) return tb - ta;
    }
    return a.label.localeCompare(b.label, "es");
  });

  return {
    ventana: {
      desde: ventana.desde,
      hasta: ventana.hasta,
      minutos: Math.round((ventana.hasta.getTime() - ventana.desde.getTime()) / 60_000),
    },
    activas: unidades.length,
    reportaron: filas.filter((f) => f.categoria === "reporto").length,
    dejaronDeReportar: filas.filter((f) => f.categoria === "dejo_de_reportar").length,
    nuncaReportaron: filas.filter((f) => f.categoria === "nunca_reporto").length,
    filas,
  };
}
