import type { Repositories } from "@jtel/db";
import {
  JTTEL_TZ,
  PARADA_MINUTOS_POR_DEFECTO,
  SIN_SENAL_MINUTOS,
  TOLERANCIA_POR_GRADO,
  localDateIso,
  paradas as paradasDeLaTraza,
  simplificarTraza,
  ventanaDelDia,
  type GradoDeTrazo,
  type Hueco,
  type Salto,
  type Parada,
  type PuntoTraza,
  type Ventana,
} from "@jtel/domain";
import {
  cortarPorModalidad,
  recorridoPorVentana,
  type CifrasDelPeriodo,
  type Lugar,
  type Modalidad,
  type RecorridoPorVentana,
  type TrazaCortada,
  type TrazaOculta,
  type Visita,
} from "./recorrido-del-dia.js";

/**
 * El recorrido servido — C3-b del cuarto de Compás: lo que la pantalla de
 * Recorridos y playback pide para dibujar una ventana.
 *
 * Tres decisiones de la ficha de C3 viven aquí:
 *
 *   · **Regla 9, simplificar al dibujar, jamás al guardar.** La base no se
 *     toca; aquí sólo se decide qué puntos se pintan, por forma, con una lista
 *     de intocables, y la respuesta dice si se simplificó.
 *   · **Regla 10, lo cerrado no cambia.** `ventanaCerrada` decide si la
 *     respuesta puede guardarse para siempre.
 *   · **Pieza 7, el corte por modalidad**, con la misma regla que enciende EN
 *     DESTINO en Flota en vivo: una pantalla no puede dibujar adentro de un
 *     destino de especial mientras la otra dice que la unidad está ahí.
 *
 * Las cifras se sacan siempre de la traza completa: el kilómetro se mide sobre
 * la evidencia, nunca sobre el dibujo.
 */

/** Lo que la pantalla necesita de un lugar. El polígono ya lo tiene el mapa. */
export type LugarBreve = Pick<Lugar, "id" | "nombre" | "rol">;

export type RecorridoServido = {
  unidad: { id: string; etiqueta: string };
  ventana: Ventana;
  /** Si la ventana ya no puede cambiar (regla 10). Ver `ventanaCerrada`. */
  cerrada: boolean;
  grado: GradoDeTrazo;
  toleranciaMetros: number;
  /**
   * Si se quitaron puntos para dibujar. La pantalla lo declara: «Trazo
   * simplificado para dibujarse · acota para el detalle completo».
   */
  simplificado: boolean;
  /** Puntos medidos en la ventana. */
  puntosMedidos: number;
  /** Puntos que van en `tramos`. */
  puntosDibujados: number;
  /** Lo que se dibuja: tramos observados, partidos en huecos y saltos, cortados por modalidad y simplificados. */
  tramos: PuntoTraza[][];
  huecos: Hueco[];
  /** Saltos del GPS: los dos puntos se dibujan, la línea entre ellos no. */
  saltos: Salto[];
  visitas: Array<Omit<Visita, "lugar"> & { lugar: LugarBreve }>;
  /** Lo que no se dibuja por el corte en destino de un especial, con sus horas. */
  ocultos: Array<Omit<TrazaOculta, "lugar"> & { lugar: LugarBreve }>;
  paradas: Parada[];
  /** El umbral con el que se leyeron las paradas; la pantalla lo declara. */
  paradaMinutos: number;
  cifras: CifrasDelPeriodo;
  /**
   * Los dispositivos que la unidad traía en algún momento de la ventana, con
   * sus fechas. Es lo que distingue, en una ventana vacía, «no traía con qué
   * medir» de «traía y no reportó» (regla 11).
   */
  dispositivos: Array<{ etiqueta: string | null; desde: Date; hasta: Date | null }>;
};

/**
 * La modalidad en cada instante, a partir de los servicios especiales que
 * tocan la ventana.
 *
 * Especial si el instante cae en la ventana de evidencia de alguno; si no,
 * `null`: sin servicio especial no hay sello que proteger y la traza no se
 * corta. Circuito tampoco corta (7.6), así que distinguirlo de «ninguno» no
 * cambia el dibujo y no se consulta.
 */
export function modalidadDesdeEspeciales(
  especiales: Array<{ ventanaDesde: Date; ventanaHasta: Date }>,
): (instante: Date) => Modalidad | null {
  return (instante) => {
    const t = instante.getTime();
    return especiales.some((e) => e.ventanaDesde.getTime() <= t && t <= e.ventanaHasta.getTime())
      ? "especial"
      : null;
  };
}

/**
 * Los tramos que se dibujan: los cortados, simplificados por forma.
 *
 * **Intocables** (regla 9) — ninguna tolerancia los quita:
 *   · el primer y el último punto de cada tramo (y con ellos los dos extremos
 *     de cada hueco y los bordes de cada corte);
 *   · las entradas y salidas de geocerca, que son horas que el árbitro ya usó;
 *   · el inicio y el fin de cada parada larga.
 *
 * Además, una vuelta cerrada nunca se aplana (`conservarVueltas`).
 */
export function trazoParaDibujar(entrada: {
  recorrido: Pick<RecorridoPorVentana, "huecos" | "visitas">;
  cortada: TrazaCortada;
  paradas: Parada[];
  toleranciaMetros: number;
}): { tramos: PuntoTraza[][]; puntosAntes: number; puntosDibujados: number; simplificado: boolean } {
  const intocables = new Set<number>();
  for (const h of entrada.recorrido.huecos) intocables.add(h.desde.getTime()).add(h.hasta.getTime());
  for (const v of entrada.recorrido.visitas) {
    intocables.add(v.entrada.getTime());
    if (v.salida) intocables.add(v.salida.getTime());
  }
  for (const p of entrada.paradas) intocables.add(p.desde.getTime()).add(p.hasta.getTime());

  const tramos = entrada.cortada.tramos.map((tramo) =>
    simplificarTraza(tramo, entrada.toleranciaMetros, {
      intocable: (i) => intocables.has(tramo[i]!.at.getTime()),
      conservarVueltas: true,
    }),
  );
  const puntosAntes = entrada.cortada.tramos.reduce((n, t) => n + t.length, 0);
  const puntosDibujados = tramos.reduce((n, t) => n + t.length, 0);
  return { tramos, puntosAntes, puntosDibujados, simplificado: puntosDibujados < puntosAntes };
}

/**
 * ¿Ya no puede cambiar lo que se sirve de esta ventana?
 *
 * La ficha dice «un periodo cuyo fin ya pasó de hoy». Eso solo no alcanza,
 * porque la base **sí** recibe puntos del pasado: un equipo que estuvo sin red
 * guarda sus posiciones y las sube después, y el archivador las lee cuando
 * llega a esa hora. Congelar la respuesta antes de eso dejaría para siempre, en
 * la caché de quien la vio, un hueco que ya no existe — «nadie la midió» dicho
 * de algo que sí se midió.
 *
 * Por eso, cerrada es las dos cosas:
 *   1. la ventana termina antes de que empiece hoy, en la zona; y
 *   2. el archivador ya leyó, **de cada dispositivo que la unidad traía en la
 *      ventana**, hasta el fin de la ventana (marca por aparato, 0037).
 *
 * Un dispositivo sin marca no se ha leído con la marca por aparato: ante la
 * duda, la ventana no se da por cerrada. No congelar sólo cuesta volver a
 * pedirla; congelar de más cuesta un dato falso que no se corrige.
 */
export function ventanaCerrada(entrada: {
  ventana: Ventana;
  ahora: Date;
  timeZone: string;
  imeis: string[];
  marcas: Map<string, Date>;
}): boolean {
  const hoy = ventanaDelDia(localDateIso(entrada.ahora, entrada.timeZone), entrada.timeZone);
  if (entrada.ventana.hasta.getTime() >= hoy.desde.getTime()) return false;
  return entrada.imeis.every((imei) => {
    const marca = entrada.marcas.get(imei);
    return marca !== undefined && marca.getTime() >= entrada.ventana.hasta.getTime();
  });
}

type ReposDelRecorrido = Pick<Repositories, "fleet" | "telemetry" | "geofences" | "occurrences">;

const breve = (l: Lugar): LugarBreve => ({ id: l.id, nombre: l.nombre, rol: l.rol });

/**
 * El recorrido de una unidad del carrier en una ventana, listo para servir.
 * `null` si la unidad no es de ese carrier: desde aquí no existe.
 */
export async function cargarRecorridoDeUnidad(
  repos: ReposDelRecorrido,
  opciones: {
    carrierAccountId: string;
    unitId: string;
    ventana: Ventana;
    grado: GradoDeTrazo;
    ahora: Date;
    timeZone?: string;
    paradaMinutos?: number;
  },
): Promise<RecorridoServido | null> {
  const { carrierAccountId, unitId, ventana, grado, ahora } = opciones;
  const timeZone = opciones.timeZone ?? JTTEL_TZ;
  const paradaMinutos = opciones.paradaMinutos ?? PARADA_MINUTOS_POR_DEFECTO;

  const unidades = await repos.fleet.getUnitsForCarrier(carrierAccountId);
  const unidad = unidades.find((u) => u.id === unitId);
  if (!unidad) return null;

  const [filas, filasDeLugares, especiales, asignaciones, marcas] = await Promise.all([
    repos.telemetry.getForUnitWindow(carrierAccountId, unitId, ventana.desde, ventana.hasta),
    repos.geofences.lugaresDeCarrier(carrierAccountId),
    repos.occurrences.especialesDeUnidadEnVentana(carrierAccountId, unitId, ventana.desde, ventana.hasta),
    repos.fleet.asignacionesDeUnidad(unitId),
    repos.telemetry.getArchiveMarks(carrierAccountId),
  ]);

  const lugares: Lugar[] = filasDeLugares.map((g) => ({
    id: g.id,
    nombre: g.name,
    rol: g.role,
    poligono: g.polygon,
  }));
  const puntos: PuntoTraza[] = filas.map((f) => ({
    lat: f.latitude,
    lng: f.longitude,
    at: f.recordedAt,
    speed: f.speed,
  }));

  const recorrido = recorridoPorVentana({ ventana, puntos, lugares });
  const cortada = cortarPorModalidad(recorrido, modalidadDesdeEspeciales(especiales));
  const paradas = paradasDeLaTraza(recorrido.tramos.flat(), {
    minMinutos: paradaMinutos,
    umbralHuecoMinutos: SIN_SENAL_MINUTOS,
  });
  const toleranciaMetros = TOLERANCIA_POR_GRADO[grado];
  const dibujo = trazoParaDibujar({ recorrido, cortada, paradas, toleranciaMetros });

  const enLaVentana = asignaciones.filter(
    (a) =>
      a.desde.getTime() <= ventana.hasta.getTime() &&
      (a.hasta === null || a.hasta.getTime() > ventana.desde.getTime()),
  );
  const imeis = [...new Set([...enLaVentana.map((a) => a.imei), ...filas.map((f) => f.imei)])];

  return {
    unidad: { id: unidad.id, etiqueta: unidad.label },
    ventana,
    cerrada: ventanaCerrada({ ventana, ahora, timeZone, imeis, marcas }),
    grado,
    toleranciaMetros,
    simplificado: dibujo.simplificado,
    puntosMedidos: recorrido.cifras.puntos,
    puntosDibujados: dibujo.puntosDibujados,
    tramos: dibujo.tramos,
    huecos: recorrido.huecos,
    saltos: recorrido.saltos,
    visitas: recorrido.visitas.map((v) => ({ ...v, lugar: breve(v.lugar) })),
    ocultos: cortada.ocultos.map((o) => ({ ...o, lugar: breve(o.lugar) })),
    paradas,
    paradaMinutos,
    cifras: recorrido.cifras,
    dispositivos: enLaVentana.map((a) => ({ etiqueta: a.etiqueta, desde: a.desde, hasta: a.hasta })),
  };
}
