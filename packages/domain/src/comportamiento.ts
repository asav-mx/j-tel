import { proyectarSobreTrazado, largoDeTrazado } from "./trazado.js";
import type { Sentido } from "./llegada.js";

/**
 * El reporte de comportamiento de un circuito concesionado: qué pasó hoy.
 *
 * **Lectura, no sello.** En concesionado el motor mide y reporta; nada de aquí
 * se guarda como hecho ni firma una falta contra nadie. La ley del Tramo JB es
 * explícita: los concesionarios que se sumen lo hacen a una plataforma que los
 * MUESTRA, no que los vigila, y un sistema que empezara a firmar faltas desde el
 * día uno cambia la naturaleza de la invitación.
 *
 * Por eso aquí no hay ningún «cumplió» ni «incumplió», y las funciones devuelven
 * **mediciones con su hueco declarado** en vez de calificaciones.
 *
 * ## Todo sale de pasadas reales, y ninguna de una velocidad
 *
 * Las vueltas se cuentan viendo a la unidad recorrer el trazado, y los
 * intervalos salen de **las horas a las que pasó de verdad** por un punto. Nada
 * de esto estima: no hay ninguna división entre distancia y velocidad, así que
 * el interruptor del rango —que gobierna toda afirmación de tiempo hacia el
 * pasajero— no tiene por dónde entrar. Un minuto medido entre dos pasadas
 * observadas no es una estimación de llegada.
 */

// ── Lo que entra ─────────────────────────────────────────────────────────

/** Un punto del archivo histórico, ya resuelto a su unidad. */
export interface PuntoDelDia {
  lat: number;
  lon: number;
  recordedAt: Date;
}

export interface TrazadoParaMedir {
  sentido: Sentido;
  coordenadas: Array<[number, number]>;
}

/**
 * Qué fracción del trazado marca el principio y el final de una vuelta.
 *
 * No son 0 y 1 porque **ninguna unidad se estaciona sobre el vértice exacto**:
 * arranca media cuadra adelante de la terminal y se detiene media cuadra antes.
 * Exigir los extremos exactos contaría cero vueltas de un día entero de
 * servicio, que es el modo de falla peor — un número correcto para su regla y
 * falso como afirmación sobre el día.
 *
 * Son declarados, no medidos, y son parámetro: el día que un corredor pida
 * otros, se vuelven columna del circuito como los demás umbrales.
 */
export const ARRANQUE_DE_VUELTA = 0.1;
export const CIERRE_DE_VUELTA = 0.9;

/**
 * Cuánto puede retroceder la unidad sobre el trazado antes de que se considere
 * que empezó de nuevo, en fracción del largo.
 *
 * Existe porque el GPS tiembla: un fix puede caer veinte metros atrás del
 * anterior sin que el camión haya dado marcha atrás. Debajo de este umbral el
 * retroceso es ruido y la vuelta sigue viva; encima, es que la unidad regresó al
 * principio y arrancó otra.
 */
export const RETROCESO_QUE_REINICIA = 0.25;

/**
 * Cuánto puede pasar entre dos muestras dentro del corredor sin que se rompa la
 * vuelta que iban formando, en minutos.
 *
 * **Sin esto el conteo cose dos momentos sin relación y los llama un recorrido.**
 * Se vio mirando el reporte contra datos reales: una unidad cerca del inicio a
 * las 05:00 y cerca del final a las 13:00 producía *«1 vuelta · 8 h 20 min»*.
 * Ninguna vuelta de un corredor de veinticuatro kilómetros dura ocho horas — lo
 * que hubo en medio fue una unidad estacionada, o fuera de la ruta, o sin señal.
 *
 * Es la §E del Marco: rellenar un hueco que el sistema no observó, con el
 * agravante de que el resultado se veía como una medición. Aquí lo que se
 * completaba era **la mitad de un recorrido**, y el número salía con toda la
 * autoridad de un dato medido.
 *
 * La regla que queda: una vuelta sólo está observada si se le vio **de corrido**
 * a lo largo de ella. Un hueco más grande que esto no es una vuelta lenta: es
 * dos pedazos que no se pueden unir sin inventar el de en medio.
 *
 * **Coincide hoy con la ventana de confianza del circuito y va aparte a
 * propósito**: aquélla contesta «hasta cuándo puedo seguir afirmando que hay
 * servicio», y ésta «hasta cuándo puedo seguir afirmando que es el mismo
 * recorrido». Compartir la constante haría que afinar una moviera la otra.
 */
export const HUECO_QUE_ROMPE_MINUTOS = 15;

// ── La serie: dónde estuvo la unidad sobre el trazado ─────────────────────

export interface MuestraEnTrazado {
  en: Date;
  /** Metros recorridos sobre el trazado, ya proyectado. */
  avanceMetros: number;
  /** Fracción del largo, entre 0 y 1. */
  fraccion: number;
}

export interface SerieDelDia {
  sentido: Sentido;
  muestras: MuestraEnTrazado[];
  /** Puntos que cayeron fuera del corredor: no se descartan callando, se cuentan. */
  fueraDelCorredor: number;
}

/**
 * Proyecta el día de una unidad sobre un trazado y se queda con lo que cae
 * dentro del corredor.
 *
 * **Lo que queda fuera se CUENTA, no se tira en silencio.** Un reporte que
 * descarta la mitad de los puntos y no lo dice afirma sobre el día entero lo que
 * sólo vale para la mitad que miró — la §D del Marco en su forma de alcance. La
 * pantalla necesita poder decir sobre cuánto está hablando.
 */
export function serieSobreTrazado(
  puntos: PuntoDelDia[],
  trazado: TrazadoParaMedir,
  corredorMetros: number,
): SerieDelDia {
  const largo = largoDeTrazado(trazado.coordenadas);
  const muestras: MuestraEnTrazado[] = [];
  let fueraDelCorredor = 0;

  /* En orden de tiempo, siempre: la consulta puede devolver como quiera, y una
     serie desordenada convertiría cada salto en una vuelta. */
  const enOrden = [...puntos].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  for (const p of enOrden) {
    const proy = proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado.coordenadas);
    if (!proy) continue;
    if (proy.distanciaMetros > corredorMetros) {
      fueraDelCorredor++;
      continue;
    }
    muestras.push({
      en: p.recordedAt,
      avanceMetros: proy.avanceMetros,
      fraccion: largo > 0 ? Math.min(1, proy.avanceMetros / largo) : 0,
    });
  }

  return { sentido: trazado.sentido, muestras, fueraDelCorredor };
}

// ── Las vueltas ──────────────────────────────────────────────────────────

export interface VueltaObservada {
  /** Cuándo se le vio arrancar el recorrido y cuándo completarlo. */
  desde: Date;
  hasta: Date;
  /** Cuánto tardó, en minutos. Sale de dos horas reales, no de una velocidad. */
  minutos: number;
}

export interface VueltasDelDia {
  sentido: Sentido;
  vueltas: VueltaObservada[];
  /**
   * Un recorrido empezado y no terminado al cerrar el corte. Se enuncia en vez
   * de contarse: media vuelta no es una vuelta, y tampoco es nada.
   */
  enCurso: boolean;
}

/**
 * Cuántas veces recorrió la unidad este trazado.
 *
 * **Una vuelta es una pasada completa observada**: se le vio antes del
 * `ARRANQUE_DE_VUELTA` y después pasando el `CIERRE_DE_VUELTA`, avanzando. No se
 * cuenta por distancia acumulada —un camión que se mece en un semáforo sumaría
 * vueltas sin moverse de la cuadra— ni por vértices tocados.
 *
 * **Lo que no se ve, no se cuenta, y eso es a propósito.** Si la unidad perdió
 * señal a media vuelta, esa vuelta no aparece: el sistema no la observó. Es un
 * conteo de vueltas OBSERVADAS y así tiene que rotularlo la pantalla — llamarlo
 * «vueltas del día» a secas sería afirmar sobre el día lo que sólo vale para lo
 * que el GPS alcanzó a ver.
 */
export function vueltasSobreLaSerie(
  serie: SerieDelDia,
  opciones: {
    arranque?: number;
    cierre?: number;
    retrocesoQueReinicia?: number;
    huecoQueRompeMinutos?: number;
  } = {},
): VueltasDelDia {
  const arranque = opciones.arranque ?? ARRANQUE_DE_VUELTA;
  const cierre = opciones.cierre ?? CIERRE_DE_VUELTA;
  const retroceso = opciones.retrocesoQueReinicia ?? RETROCESO_QUE_REINICIA;
  const hueco = (opciones.huecoQueRompeMinutos ?? HUECO_QUE_ROMPE_MINUTOS) * 60_000;

  const vueltas: VueltaObservada[] = [];
  /* La vuelta viva: dónde empezó, hasta dónde ha llegado, y cuándo se le vio por última vez. */
  let inicio: MuestraEnTrazado | null = null;
  let maxima = 0;
  let ultima: MuestraEnTrazado | null = null;

  for (const m of serie.muestras) {
    /*
     * UN HUECO GRANDE ROMPE LA VUELTA. Si entre dos muestras dentro del
     * corredor pasó más que esto, lo de en medio no se observó: la unidad
     * estuvo estacionada, fuera de la ruta, o sin señal. Unir los dos pedazos
     * produciría una vuelta de ocho horas, que es rellenar un hueco con la
     * autoridad de un dato medido.
     */
    if (inicio && ultima && m.en.getTime() - ultima.en.getTime() > hueco) {
      inicio = null;
      maxima = 0;
    }

    /*
     * Un retroceso grande significa que la unidad volvió al principio: se cierra
     * lo que hubiera abierto y se empieza a mirar de nuevo. Un retroceso chico es
     * el temblor del GPS y no toca nada.
     */
    if (inicio && m.fraccion < maxima - retroceso) {
      inicio = null;
      maxima = 0;
    }

    ultima = m;

    if (!inicio) {
      if (m.fraccion <= arranque) {
        inicio = m;
        maxima = m.fraccion;
      }
      continue;
    }

    if (m.fraccion > maxima) maxima = m.fraccion;

    if (m.fraccion >= cierre) {
      vueltas.push({
        desde: inicio.en,
        hasta: m.en,
        minutos: (m.en.getTime() - inicio.en.getTime()) / 60_000,
      });
      inicio = null;
      maxima = 0;
    }
  }

  return { sentido: serie.sentido, vueltas, enCurso: inicio !== null };
}

// ── El intervalo observado ───────────────────────────────────────────────

export interface PasadaPorElPunto {
  unidad: string;
  en: Date;
}

export interface IntervaloObservado {
  /** Entre estas dos pasadas consecutivas. */
  anterior: PasadaPorElPunto;
  siguiente: PasadaPorElPunto;
  minutos: number;
}

/**
 * Cada vez que ALGUNA unidad pasó por una fracción del trazado, en orden.
 *
 * Es el insumo del intervalo: para el pasajero parado en una esquina, lo que
 * importa no es qué unidad viene sino cuánto hay entre camión y camión.
 *
 * Se detecta el CRUCE, no la cercanía: la unidad estaba antes del punto en una
 * muestra y después en la siguiente. Tomar «la muestra más cercana al punto»
 * contaría varias pasadas de un camión detenido justo ahí.
 */
export function pasadasPorElPunto(
  seriesPorUnidad: Array<{ unidad: string; serie: SerieDelDia }>,
  fraccionDelPunto: number,
): PasadaPorElPunto[] {
  const pasadas: PasadaPorElPunto[] = [];

  for (const { unidad, serie } of seriesPorUnidad) {
    for (let i = 1; i < serie.muestras.length; i++) {
      const antes = serie.muestras[i - 1];
      const despues = serie.muestras[i];
      if (antes.fraccion < fraccionDelPunto && despues.fraccion >= fraccionDelPunto) {
        pasadas.push({ unidad, en: despues.en });
      }
    }
  }

  return pasadas.sort((a, b) => a.en.getTime() - b.en.getTime());
}

/**
 * Cuánto hubo entre pasada y pasada.
 *
 * **Sale de dos horas reales.** No hay velocidad, no hay distancia dividida
 * entre nada, y por lo tanto no hay estimación: es lo que el instrumento vio.
 *
 * Sin frecuencia declarada esto **no se convierte en un veredicto**. Que un
 * intervalo sea de 31 minutos no dice si la unidad va atrasada; dice que
 * pasaron 31 minutos. Quién decide si eso está bien es el concesionario cuando
 * declare su frecuencia, y mientras no lo haga la pantalla enseña la medición y
 * se calla el juicio.
 */
export function intervalosEntrePasadas(pasadas: PasadaPorElPunto[]): IntervaloObservado[] {
  const salida: IntervaloObservado[] = [];
  for (let i = 1; i < pasadas.length; i++) {
    salida.push({
      anterior: pasadas[i - 1],
      siguiente: pasadas[i],
      minutos: (pasadas[i].en.getTime() - pasadas[i - 1].en.getTime()) / 60_000,
    });
  }
  return salida;
}

/**
 * La mediana de los intervalos, o `null` con menos de dos pasadas.
 *
 * **Mediana y no promedio**, misma razón que en la velocidad del corredor: una
 * unidad que se quedó una hora en el taller a media mañana arrastraría el
 * promedio de todo el día y describiría un servicio que nadie dio.
 *
 * `null` con una sola pasada, y eso **se dibuja como hueco**: con un camión no
 * hay intervalo que medir, y un cero ahí diría que pasan pegados.
 */
export function intervaloMedianoMinutos(intervalos: IntervaloObservado[]): number | null {
  if (intervalos.length === 0) return null;
  const m = intervalos.map((i) => i.minutos).sort((a, b) => a - b);
  const medio = Math.floor(m.length / 2);
  return m.length % 2 === 0 ? (m[medio - 1] + m[medio]) / 2 : m[medio];
}
