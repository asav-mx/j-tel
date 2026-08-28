import { createHmac } from "node:crypto";
import { proyectarSobreTrazado } from "./trazado.js";
import { localDateIso, localTimeHHMM } from "./tiempo.js";

/**
 * Lo que el endpoint público necesita decidir, sin base de datos.
 *
 * Todo lo de aquí es puro a propósito: son las decisiones que deciden **qué se
 * le enseña a un pasajero**, y una decisión así tiene que poder probarse sin
 * montar un circuito. La consulta trae datos crudos; estas funciones dicen qué
 * de esos datos se puede afirmar.
 *
 * Ningún umbral vive aquí. La frecuencia, el horario y los segundos de dato
 * viejo son **campos por circuito** y entran por parámetro: hornear cualquiera
 * convertiría el alta de un concesionario nuevo en un despliegue.
 */

// ── Identidad pública ────────────────────────────────────────────────────

/**
 * El identificador opaco de una unidad, para un día.
 *
 * **Rota cada día, en la zona del circuito.** Dentro del día es estable, que es
 * lo que permite a la app animar el mismo camión moviéndose en vez de verlo
 * parpadear; entre días no se puede ligar, así que nadie arma el historial de
 * un camión —ni de su chofer— raspando el endpoint día tras día.
 *
 * HMAC y no un hash a secas: sin la llave, cualquiera con una lista de
 * identificadores de unidad podría recalcularlo y deshacer el anonimato.
 */
export function idPublicoDelDia(unitId: string, fechaLocal: string, secreto: string): string {
  if (!secreto) throw new Error("idPublicoDelDia necesita una llave: sin ella el id no es opaco");
  return createHmac("sha256", secreto).update(`${unitId}:${fechaLocal}`).digest("hex").slice(0, 12);
}

/** La fecha civil del circuito, que es la que hace rotar el identificador. */
export function fechaLocalDelCircuito(ahora: Date, zona: string): string {
  return localDateIso(ahora, zona);
}

// ── Horario de servicio ──────────────────────────────────────────────────

/**
 * ¿El circuito está en horario de servicio ahora?
 *
 * **Aguanta que la ventana cruce la medianoche.** Un circuito de 05:00 a 23:00
 * es el caso fácil; uno de 22:00 a 06:00 es un servicio nocturno real, y con
 * una comparación ingenua daría `false` toda la noche — justo cuando corre.
 *
 * Las horas llegan como las guarda Postgres (`HH:MM` o `HH:MM:SS`) y se
 * comparan como texto, que en 24 h con cero a la izquierda ordena igual que el
 * reloj. Sin construir fechas: construirlas obliga a inventar un día y a
 * atravesar el horario de verano por nada.
 */
export function enHorarioDeServicio(
  ahora: Date,
  inicioLocal: string,
  finLocal: string,
  zona: string,
): boolean {
  const hhmm = localTimeHHMM(ahora, zona);
  const inicio = inicioLocal.slice(0, 5);
  const fin = finLocal.slice(0, 5);
  if (inicio === fin) return true; // 24 horas: no hay hueco que dejar fuera.
  return inicio < fin ? hhmm >= inicio && hhmm < fin : hhmm >= inicio || hhmm < fin;
}

// ── Frescura ─────────────────────────────────────────────────────────────

/** Segundos desde que el aparato tomó el fix. La cuenta la hace el servidor. */
export function antiguedadSegundos(recordedAt: Date, ahora: Date): number {
  return Math.max(0, Math.round((ahora.getTime() - recordedAt.getTime()) / 1000));
}

/**
 * ¿La posición todavía dice dónde está el camión?
 *
 * El umbral entra por parámetro porque es del circuito. **No reutiliza
 * `SIN_SENAL_MINUTOS`**, que es el de la torre interna: otro público, otro
 * número, y mezclarlos haría que afinar uno moviera al otro sin querer.
 */
export function esFresco(antiguedadSeg: number, umbralSegundos: number): boolean {
  return antiguedadSeg < umbralSegundos;
}

// ── Sentido ──────────────────────────────────────────────────────────────

export type Sentido = "ida" | "vuelta";

export interface TrazadoDeSentido {
  sentido: Sentido;
  coordinates: Array<[number, number]>;
}

/**
 * Cuánto se puede alejar el punto del trazado antes de dejar de estar «en el
 * circuito». Los 150 m salen de la geometría del archivo, no del gusto: el KML
 * del circuito 1 tiene huecos de hasta 224 m entre vértices, y con proyección
 * punto-a-segmento un camión a media cuadra de una avenida ancha sigue estando
 * sobre su recorrido.
 *
 * Es tolerancia del instrumento, no política de operación. Si algún día un
 * corredor pide otra, se vuelve columna del circuito como los demás umbrales.
 */
export const CORREDOR_METROS_POR_DEFECTO = 150;

/**
 * ¿Se puede afirmar que esta unidad va sobre el circuito?
 *
 * **Es la misma ley que el dato viejo, aplicada al espacio en vez del tiempo.**
 * Un fix de hace veinte minutos no se publica porque ya no dice dónde está el
 * camión; una unidad a nueve kilómetros del trazado no se publica porque no
 * dice que venga en la ruta. En los dos casos el sistema no puede afirmarlo, y
 * en los dos la app cae a «Por horario», que es honesto.
 *
 * Existe porque estar ASIGNADO no es estar EN RUTA. Una unidad asignada va al
 * taller, al patio, o a cubrir otra cosa, y sigue reportando todo el tiempo.
 * Medido el 27 de agosto contra `corredor-prueba`: de cuatro unidades vivas y
 * asignadas, las cuatro estaban fuera del corredor.
 *
 * La tolerancia entra por parámetro y es campo del circuito: un corredor de
 * KML fino y uno derivado de trazas no admiten el mismo margen.
 */
export function vaSobreElCircuito(
  punto: { lat: number; lon: number },
  trazados: TrazadoDeSentido[],
  corredorMetros: number,
): boolean {
  for (const t of trazados) {
    const p = proyectarSobreTrazado(punto, t.coordinates);
    if (p && p.distanciaMetros <= corredorMetros) return true;
  }
  return false;
}

/** Cuánto puede diferir el rumbo del camión del rumbo del tramo y seguir siendo ese sentido. */
const RUMBO_TOLERANCIA_GRADOS = 70;

/** Cuánto tiene que ganarle un sentido al otro para poder decidir entre los dos. */
const VENTAJA_MINIMA_GRADOS = 25;

/**
 * De qué lado va la unidad: `"ida"`, `"vuelta"`, o **`null` cuando no se puede
 * afirmar**.
 *
 * Ida y vuelta no son espejo —20.83 km contra 16.44 en el circuito 1, por los
 * sentidos únicos del Centro—, pero comparten tramos, y en un tramo compartido
 * la posición sola no distingue nada. Lo que distingue es **hacia dónde
 * apunta**: se compara el rumbo del aparato contra el rumbo del tramo donde
 * cayó la proyección.
 *
 * Devuelve `null` en todos los casos donde el instrumento no vio lo suficiente:
 * sin trazados, sin rumbo, fuera del corredor, o con los dos sentidos igual de
 * plausibles. Un sentido inventado es peor que un hueco declarado — mandaría al
 * pasajero a esperar del otro lado de la calle.
 */
export function sentidoDeLaUnidad(
  punto: { lat: number; lon: number },
  rumboGrados: number | null,
  trazados: TrazadoDeSentido[],
  corredorMetros = CORREDOR_METROS_POR_DEFECTO,
): Sentido | null {
  if (trazados.length === 0) return null;
  if (rumboGrados === null || !Number.isFinite(rumboGrados)) return null;

  const candidatos: Array<{ sentido: Sentido; desvio: number }> = [];

  for (const t of trazados) {
    const p = proyectarSobreTrazado(punto, t.coordinates);
    if (!p) continue;
    if (p.distanciaMetros > corredorMetros) continue;

    const a = t.coordinates[p.indiceSegmento];
    const b = t.coordinates[p.indiceSegmento + 1];
    if (!a || !b) continue;

    const desvio = diferenciaAngular(rumboGrados, rumboDelTramo(a, b));
    if (desvio > RUMBO_TOLERANCIA_GRADOS) continue;
    candidatos.push({ sentido: t.sentido, desvio });
  }

  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0].sentido;

  candidatos.sort((x, y) => x.desvio - y.desvio);
  // Empate técnico: los dos sentidos explican igual de bien lo que se ve.
  if (candidatos[1].desvio - candidatos[0].desvio < VENTAJA_MINIMA_GRADOS) return null;
  return candidatos[0].sentido;
}

/** Rumbo de un tramo en grados desde el norte, en el sentido del reloj. */
function rumboDelTramo(a: [number, number], b: [number, number]): number {
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const rad = Math.PI / 180;
  const lat1 = latA * rad;
  const lat2 = latB * rad;
  const dLon = (lonB - lonA) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

/** Diferencia entre dos rumbos, siempre entre 0 y 180. */
function diferenciaAngular(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// ── La escalera de estados ───────────────────────────────────────────────

/**
 * En qué está el circuito ahora mismo, para la app del pasajero.
 *
 * Cuatro estados, evaluados en orden y parando en el primero que aplique.
 * Existen porque la app tenía **un solo silencio para tres cosas distintas** y
 * las decía todas igual: «el servicio corre cada N minutos».
 */
export type EstadoDelCircuito =
  /** El reloj está fuera del horario declarado. No se promete nada. */
  | "fuera_de_horario"
  /** Hay al menos una unidad con posición fresca dentro del corredor. */
  | "en_vivo"
  /** Nadie fresco, pero se vio una unidad en el corredor dentro de la ventana de confianza. */
  | "por_horario"
  /**
   * Ninguna de las anteriores: **el sistema no tiene evidencia**, y eso es
   * todo lo que dice.
   *
   * Se llamaba `sin_servicio` y el nombre arrastraba la lógica del árbitro a
   * donde no toca. En transporte especial el silencio es prueba en contra —de
   * eso depende un pago—. En público es al revés: la unidad está declarada en
   * la concesión y el horario también, y eso no es una suposición nuestra sino
   * un hecho que el propio operador publicó. **Que no veamos una posición no
   * autoriza a afirmar que no hay servicio.**
   */
  | "sin_evidencia";

/** Lo que se sabe de una unidad para decidir el estado. */
export interface ObservacionParaEstado {
  /** Su última posición conocida cae dentro del corredor del circuito. */
  enCorredor: boolean;
  antiguedadSeg: number;
}

/**
 * La escalera, en un solo lugar y sin tocar la base.
 *
 * **La asignación vigente es plan, no evidencia.** Un circuito con cinco
 * unidades asignadas y ninguna observación reciente cae a `sin_servicio`, nunca
 * a `por_horario`: la asignación dice qué se planeó, y sólo el GPS puede
 * afirmar que hay servicio. Por eso esta función no recibe cuántas unidades hay
 * asignadas — no es un insumo de la decisión, y no tenerlo a la mano es lo que
 * impide usarlo por descuido.
 *
 * **Los dos estados con evidencia exigen corredor.** Un camión parado en el
 * patio reporta cada minuto y mantendría la ruta «por horario» toda la noche;
 * su última posición está en el patio, así que no cuenta. El que se metió a un
 * túnel sí cuenta: la última vez que se le vio, iba en la ruta.
 */
export function estadoDelCircuito(entrada: {
  enHorario: boolean;
  observaciones: ObservacionParaEstado[];
  frescuraSegundos: number;
  confianzaSegundos: number;
}): EstadoDelCircuito {
  if (!entrada.enHorario) return "fuera_de_horario";

  const enRuta = entrada.observaciones.filter((o) => o.enCorredor);
  if (enRuta.some((o) => o.antiguedadSeg < entrada.frescuraSegundos)) return "en_vivo";
  if (enRuta.some((o) => o.antiguedadSeg < entrada.confianzaSegundos)) return "por_horario";
  return "sin_evidencia";
}
