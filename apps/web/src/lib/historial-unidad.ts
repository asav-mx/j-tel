/**
 * Historial de una unidad — qué hizo, leído del GPS. Funciones puras.
 *
 * Contesta la pregunta que el carrier hoy no puede contestar: "¿qué hizo mi
 * unidad el martes?". No emite ningún veredicto, no consulta hechos sellados y
 * no sabe qué ruta debía hacerse. Es lectura de telemetría y nada más.
 *
 * Por eso todo lo que sale de aquí se pinta en acero y tenue: son estados de
 * observación, no resultados. El skill es explícito — verde, ámbar y rojo
 * jamás marcan un estado operativo, y "sin señal" es justamente eso.
 *
 * Las tres clases de segmento son lo único que la telemetría sostiene por sí
 * sola:
 *
 *   en_movimiento — hay puntos y la unidad se desplaza
 *   detenida      — hay puntos y la unidad no se mueve del mismo lugar
 *   sin_dato      — no hay puntos, y por lo tanto no hay nada que afirmar
 *
 * `sin_dato` NO es "apagada", "en patio" ni "sin cobertura": es ausencia de
 * observación. Nombrarla de otro modo sería inventar evidencia que nadie midió.
 *
 * Aquí solo vive la medición. Reunir los datos es trabajo de la página, y así
 * el historial se prueba sin base de datos.
 */

import { haversineKm } from "@jtel/verification";
import { localDateIso, instanteZonificado } from "@jtel/domain";
import { SALTO_GPS_KMH } from "@jtel/services";

export { SALTO_GPS_KMH };

/**
 * Los tres umbrales con los que se lee la telemetría.
 *
 * NO son umbrales de contrato —no deciden si alguien cumplió— sino la
 * resolución con la que se mira el dato. Aun así viajan como parámetro y no
 * horneados en la función, y la pantalla los escribe junto al resultado: un
 * número sin su regla al lado es medio dato.
 */
export type ReglasDeLectura = {
  /** Sin un punto por más de esto, no hay observación: es hueco. */
  huecoMinutos: number;
  /** Radio dentro del cual la unidad se considera en el mismo lugar. */
  radioDetenidaMetros: number;
  /** Quietud mínima para llamarla "detenida". Menos que esto es un alto. */
  detenidaMinutos: number;
};

export const REGLAS_POR_DEFECTO: ReglasDeLectura = {
  huecoMinutos: 10,
  radioDetenidaMetros: 120,
  detenidaMinutos: 15,
};

export type PuntoDeUnidad = {
  recordedAt: Date;
  latitude: number;
  longitude: number;
  /** El equipo que lo reportó. Una unidad puede haber tenido más de uno. */
  imei: string;
};

export type ClaseSegmento = "en_movimiento" | "detenida" | "sin_dato";

export type Segmento = {
  clase: ClaseSegmento;
  desde: Date;
  hasta: Date;
  minutos: number;
  /** Puntos que sostienen el segmento. Cero en los huecos, por definición. */
  puntos: number;
  /**
   * Kilómetros del segmento. SIEMPRE aproximados: los tramos con velocidad
   * implícita imposible se descartan por ser saltos del equipo, y cada
   * descarte deja un hueco en la suma que no hay forma honesta de rellenar.
   */
  kmAproximados: number;
  saltosDescartados: number;
};

export type DiaDeUnidad = {
  /** Día civil en la zona del despliegue. */
  fecha: string;
  /** La franja observada ese día — puede ser menos de 24 h si se pidió así. */
  desde: Date;
  hasta: Date;
  segmentos: Segmento[];
  puntos: number;
  equipos: number;
  kmAproximados: number;
  saltosDescartados: number;
  minutosEnMovimiento: number;
  minutosDetenida: number;
  minutosSinDato: number;
  /** Cuántos huecos, y el mayor de ellos. Se muestran, no se esconden. */
  huecos: number;
  huecoMayorMinutos: number | null;
  primerDato: Date | null;
  ultimoDato: Date | null;
};

const MS_POR_MINUTO = 60_000;

function minutosEntre(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_POR_MINUTO;
}

function metrosEntre(a: PuntoDeUnidad, b: PuntoDeUnidad): number {
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
}

/**
 * Kilómetros entre dos puntos, o `null` si el tramo es un salto del equipo.
 *
 * Mismo criterio que el censo de recorrido: por encima de SALTO_GPS_KMH la
 * velocidad implícita es imposible para un camión, así que el tramo no es
 * movimiento — es el GPS reportando mal. Se descarta en vez de sumarlo, y el
 * descarte se cuenta para poder decirlo en pantalla.
 */
function kmDelTramo(a: PuntoDeUnidad, b: PuntoDeUnidad): number | null {
  const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  const horas = minutosEntre(a.recordedAt, b.recordedAt) / 60;
  if (horas <= 0) return km === 0 ? 0 : null;
  return km / horas > SALTO_GPS_KMH ? null : km;
}

/** Un bloque de puntos consecutivos sin huecos entre ellos. */
function partirPorHuecos(
  puntos: PuntoDeUnidad[],
  huecoMinutos: number,
): PuntoDeUnidad[][] {
  const bloques: PuntoDeUnidad[][] = [];
  let actual: PuntoDeUnidad[] = [];

  for (const p of puntos) {
    const anterior = actual[actual.length - 1];
    if (anterior && minutosEntre(anterior.recordedAt, p.recordedAt) > huecoMinutos) {
      bloques.push(actual);
      actual = [];
    }
    actual.push(p);
  }
  if (actual.length > 0) bloques.push(actual);
  return bloques;
}

function resumirTramo(puntos: PuntoDeUnidad[], clase: ClaseSegmento): Segmento {
  const primero = puntos[0]!;
  const ultimo = puntos[puntos.length - 1]!;
  let km = 0;
  let saltos = 0;

  for (let i = 1; i < puntos.length; i++) {
    const tramo = kmDelTramo(puntos[i - 1]!, puntos[i]!);
    if (tramo === null) saltos++;
    else km += tramo;
  }

  return {
    clase,
    desde: primero.recordedAt,
    hasta: ultimo.recordedAt,
    minutos: minutosEntre(primero.recordedAt, ultimo.recordedAt),
    puntos: puntos.length,
    kmAproximados: km,
    saltosDescartados: saltos,
  };
}

/**
 * Parte un bloque observado en tramos de quietud y de desplazamiento.
 *
 * La quietud se busca hacia adelante: desde un punto se extiende mientras los
 * siguientes caigan dentro del radio. Si esa racha dura lo suficiente, es una
 * detención; si no, el punto pertenece al movimiento. Así una parada larga no
 * se parte en pedazos por un rebote de dos metros del GPS.
 */
function segmentarBloque(bloque: PuntoDeUnidad[], reglas: ReglasDeLectura): Segmento[] {
  if (bloque.length === 0) return [];
  if (bloque.length === 1) return [resumirTramo(bloque, "en_movimiento")];

  const segmentos: Segmento[] = [];
  let enMovimiento: PuntoDeUnidad[] = [];
  let i = 0;

  const cerrarMovimiento = () => {
    if (enMovimiento.length > 0) {
      segmentos.push(resumirTramo(enMovimiento, "en_movimiento"));
      enMovimiento = [];
    }
  };

  while (i < bloque.length) {
    const ancla = bloque[i]!;
    let fin = i;
    while (
      fin + 1 < bloque.length &&
      metrosEntre(ancla, bloque[fin + 1]!) <= reglas.radioDetenidaMetros
    ) {
      fin++;
    }

    const quieta = minutosEntre(ancla.recordedAt, bloque[fin]!.recordedAt);
    if (fin > i && quieta >= reglas.detenidaMinutos) {
      // El último punto en movimiento es también el primero de la detención:
      // el segmento anterior tiene que llegar hasta donde la unidad se paró.
      if (enMovimiento.length > 0) enMovimiento.push(ancla);
      cerrarMovimiento();
      segmentos.push(resumirTramo(bloque.slice(i, fin + 1), "detenida"));
      i = fin;
      // El punto de arranque cierra la detención y abre el movimiento.
      enMovimiento.push(bloque[i]!);
      i++;
      continue;
    }

    enMovimiento.push(ancla);
    i++;
  }

  cerrarMovimiento();
  return segmentos;
}

/**
 * El día de una unidad: sus segmentos y lo que suman.
 *
 * `desde`/`hasta` son la franja que se pidió mirar, no el primer y último
 * punto. La diferencia importa: si la unidad no reportó nada entre las 05:00 y
 * las 06:30, ese hueco es parte de la respuesta y tiene que aparecer.
 */
export function construirDia(entrada: {
  fecha: string;
  desde: Date;
  hasta: Date;
  puntos: PuntoDeUnidad[];
  reglas?: ReglasDeLectura;
}): DiaDeUnidad {
  const reglas = entrada.reglas ?? REGLAS_POR_DEFECTO;
  const puntos = [...entrada.puntos].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );

  const bloques = partirPorHuecos(puntos, reglas.huecoMinutos);
  const segmentos: Segmento[] = [];

  /** Un hueco es ausencia de observación: no tiene puntos ni kilómetros. */
  const hueco = (desde: Date, hasta: Date): Segmento | null => {
    const minutos = minutosEntre(desde, hasta);
    if (minutos <= 0) return null;
    return {
      clase: "sin_dato",
      desde,
      hasta,
      minutos,
      puntos: 0,
      kmAproximados: 0,
      saltosDescartados: 0,
    };
  };

  const empujar = (s: Segmento | null) => {
    if (s && s.minutos > 0) segmentos.push(s);
  };

  if (bloques.length === 0) {
    empujar(hueco(entrada.desde, entrada.hasta));
  } else {
    // Desde el borde de la franja hasta el primer punto también es hueco.
    empujar(hueco(entrada.desde, bloques[0]![0]!.recordedAt));

    bloques.forEach((bloque, indice) => {
      segmentos.push(...segmentarBloque(bloque, reglas));
      const siguiente = bloques[indice + 1];
      const finBloque = bloque[bloque.length - 1]!.recordedAt;
      if (siguiente) empujar(hueco(finBloque, siguiente[0]!.recordedAt));
      else empujar(hueco(finBloque, entrada.hasta));
    });
  }

  /*
   * Un punto aislado no cubre tiempo: produce un tramo de duración cero que
   * no se puede dibujar ni leer. Se descarta de la tira —el conteo de puntos
   * sigue reportándolo— y los vecinos se siguen tocando, porque un tramo de
   * duración cero empieza y termina en el mismo instante.
   */
  const conDuracion = segmentos.filter((s) => s.minutos > 0);

  const acumular = (clase: ClaseSegmento) =>
    conDuracion.filter((s) => s.clase === clase).reduce((t, s) => t + s.minutos, 0);

  const huecos = conDuracion.filter((s) => s.clase === "sin_dato");
  const equipos = new Set(puntos.map((p) => p.imei)).size;

  return {
    fecha: entrada.fecha,
    desde: entrada.desde,
    hasta: entrada.hasta,
    segmentos: conDuracion,
    puntos: puntos.length,
    equipos,
    // Los kilómetros se suman de TODOS los tramos, incluidos los de duración
    // cero: la distancia se midió aunque el tramo no se pueda dibujar.
    kmAproximados: segmentos.reduce((t, s) => t + s.kmAproximados, 0),
    saltosDescartados: segmentos.reduce((t, s) => t + s.saltosDescartados, 0),
    minutosEnMovimiento: acumular("en_movimiento"),
    minutosDetenida: acumular("detenida"),
    minutosSinDato: acumular("sin_dato"),
    huecos: huecos.length,
    huecoMayorMinutos:
      huecos.length > 0 ? Math.max(...huecos.map((h) => h.minutos)) : null,
    primerDato: puntos[0]?.recordedAt ?? null,
    ultimoDato: puntos[puntos.length - 1]?.recordedAt ?? null,
  };
}

/**
 * Las franjas absolutas de un periodo: una por fecha civil.
 *
 * Existe como función aparte porque hay dos consumidores y no puede haber dos
 * cuentas. `construirDias` la usa para partir puntos; el resumen de la base la
 * usa para saber qué ventanas pedir. Si cada uno calculara sus propios bordes,
 * la tabla y la tira podrían estar hablando de tramos distintos del día — y una
 * segunda versión de la aritmética de zona horaria es exactamente el bug que ya
 * corrió hechos a la hora equivocada.
 */
export function ventanasDelPeriodo(entrada: {
  fechas: string[];
  minutosDesde: number;
  minutosHasta: number;
  timeZone: string;
}): Array<{ fecha: string; desde: Date; hasta: Date }> {
  const cruzaMedianoche = entrada.minutosHasta <= entrada.minutosDesde;
  return entrada.fechas.map((fecha) => ({
    fecha,
    desde: instanteZonificado(fecha, entrada.minutosDesde, entrada.timeZone),
    hasta: instanteZonificado(
      fecha,
      cruzaMedianoche ? entrada.minutosHasta + 1440 : entrada.minutosHasta,
      entrada.timeZone,
    ),
  }));
}

/**
 * Reparte los puntos de un periodo en un día por fecha civil, respetando la
 * franja horaria pedida dentro de cada día.
 *
 * Un rango de días no es una sola tira larga: son N tiras comparables, porque
 * la pregunta del carrier es "¿qué hizo el martes y qué el miércoles?" y no
 * "¿qué hizo en 72 horas seguidas?".
 *
 * Los días sin un solo punto SÍ aparecen, como un día entero sin dato. Un día
 * que se omite se lee como un día que no existió.
 */
export function construirDias(entrada: {
  fechas: string[];
  minutosDesde: number;
  minutosHasta: number;
  timeZone: string;
  puntos: PuntoDeUnidad[];
  reglas?: ReglasDeLectura;
}): DiaDeUnidad[] {
  const { fechas, minutosDesde, minutosHasta, timeZone } = entrada;
  const cruzaMedianoche = minutosHasta <= minutosDesde;

  const porFecha = new Map<string, PuntoDeUnidad[]>();
  for (const fecha of fechas) porFecha.set(fecha, []);

  for (const p of entrada.puntos) {
    // Una franja que cruza medianoche pertenece al día en que empezó: el
    // turno de noche del martes es del martes, aunque cierre el miércoles.
    let fecha = localDateIso(p.recordedAt, timeZone);
    if (cruzaMedianoche && !porFecha.has(fecha)) {
      const previa = localDateIso(
        new Date(p.recordedAt.getTime() - 24 * 60 * MS_POR_MINUTO),
        timeZone,
      );
      if (porFecha.has(previa)) fecha = previa;
    }
    porFecha.get(fecha)?.push(p);
  }

  return ventanasDelPeriodo({ fechas, minutosDesde, minutosHasta, timeZone }).map(
    (ventana) =>
      construirDia({
        ...ventana,
        puntos: porFecha.get(ventana.fecha) ?? [],
        reglas: entrada.reglas,
      }),
  );
}

/** Dónde cae un instante dentro de la franja, en porcentaje. Para la tira. */
export function posicionEnFranja(instante: Date, desde: Date, hasta: Date): number {
  const total = hasta.getTime() - desde.getTime();
  if (total <= 0) return 0;
  const p = ((instante.getTime() - desde.getTime()) / total) * 100;
  return Math.min(100, Math.max(0, p));
}
