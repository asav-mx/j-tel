/**
 * Cuando un servicio recibe su PRIMER veredicto mucho después del plazo, el
 * expediente tiene que decir por qué.
 *
 * EL CASO QUE LO PIDE. Ocho servicios de Honeywell del 30 de junio al 8 de
 * julio aparecen juzgados 35 días tarde. Su evidencia no faltaba: estaban los
 * ~12 000 puntos de cada uno en memoria propia desde el primer día. Lo que
 * fallaba era la escritura — se intentaba guardar todos los puntos en una sola
 * sentencia y Postgres la rechazaba por exceso de parámetros—, y el error se
 * perdía en un `catch`.
 *
 * Sin esta marca, esos ocho veredictos aparecerían indistinguibles de los
 * normales, 35 días después de la fecha del servicio, sin que nadie —ni el
 * cliente ni el transportista— pueda entender por qué. Un veredicto que no se
 * puede explicar no se puede discutir, y uno que no se puede discutir no
 * sirve como prueba.
 *
 * LA CAUSA SE AFIRMA SOLO CUANDO ES COMPROBABLE. Si los puntos no habrían
 * cabido en una sentencia, eso es un hecho aritmético que se puede verificar
 * contra los datos. Si sí cabían, la demora tuvo otro origen y aquí se dice
 * que no se sabe, en vez de inventar una explicación verosímil.
 */

const HORA_MS = 60 * 60 * 1000;

/**
 * A partir de cuánto un primer veredicto se considera tardío.
 *
 * El camino normal sella en minutos. 48 horas deja fuera cualquier corte
 * pasajero —un despliegue, una caída del proveedor, una noche sin señal— y
 * solo marca lo que de verdad se quedó atrás.
 */
export const HORAS_PARA_LLAMARLO_TARDIO = 48;

/**
 * El MÁXIMO de filas de evidencia que pudieron caber en una sentencia antes
 * del loteo: 65 534 parámetros ÷ 6 por fila = 10 922.
 *
 * Seis y no nueve porque `id`, `device_id` y `unit_id` viajan como `default`
 * cuando no se les pasa valor, y no gastan parámetro. Con los tres presentes
 * el techo real bajaba a 8 191 filas.
 *
 * SE USA EL TECHO MÁS GENEROSO A PROPÓSITO. Este número decide si el
 * expediente ACUSA a la escritura de haber perdido el veredicto. Con el techo
 * generoso solo se acusa cuando los puntos no cabían **de ninguna manera**; con
 * el estrecho se acusaría también en casos que quizá sí cupieron. Ante la duda,
 * "no se sabe" — que es una de las dos respuestas que este archivo sabe dar.
 *
 * Es una constante histórica escrita a mano y no el valor vivo del esquema:
 * responde "¿cabían cuando se intentó guardarlos?", y eso no puede cambiar el
 * día que alguien agregue una columna. Un expediente que se reescribe solo no
 * es un expediente.
 */
export const FILAS_QUE_CABIAN_ANTES_DEL_LOTEO = 10_922;

export type CausaDeRetraso =
  /** Los puntos existían pero no cabían en una sola sentencia de escritura. */
  | "escritura_no_cabia_en_una_sentencia"
  /** Llegó tarde y los datos no dicen por qué. Se nombra en vez de fingirlo. */
  | "no_determinada";

export interface EntradaRecuperacionTardia {
  /** ¿Es el primer veredicto de este servicio, o ya tenía uno? */
  esPrimerVeredicto: boolean;
  /** Plazo del servicio (sin gracia: lo que el contrato prometió). */
  plazo: Date;
  /** Cuándo se está sellando. */
  selladoEn: Date;
  /** Puntos de evidencia con los que se juzgó. */
  puntosDeEvidencia: number;
  /** Cuántas filas cabían en una sentencia antes del arreglo del loteo. */
  filasQueCabianEnUnaSentencia: number;
}

export interface RecuperacionTardia {
  horasDeRetraso: number;
  diasDeRetraso: number;
  causa: CausaDeRetraso;
  explicacion: string;
}

/**
 * Devuelve la marca si este sellado es una recuperación tardía, o `null` si es
 * un veredicto normal.
 */
export function recuperacionTardia(
  entrada: EntradaRecuperacionTardia,
): RecuperacionTardia | null {
  if (!entrada.esPrimerVeredicto) return null;

  const horas = (entrada.selladoEn.getTime() - entrada.plazo.getTime()) / HORA_MS;
  if (horas <= HORAS_PARA_LLAMARLO_TARDIO) return null;

  const dias = Math.floor(horas / 24);
  const noCabia =
    entrada.puntosDeEvidencia > entrada.filasQueCabianEnUnaSentencia &&
    entrada.filasQueCabianEnUnaSentencia > 0;

  const causa: CausaDeRetraso = noCabia
    ? "escritura_no_cabia_en_una_sentencia"
    : "no_determinada";

  const explicacion = noCabia
    ? `Este servicio se juzga ${dias} días después de su fecha. La evidencia no faltaba: ` +
      `sus ${entrada.puntosDeEvidencia.toLocaleString("es-MX")} puntos de GPS estaban guardados ` +
      `desde el primer día. Lo que fallaba era guardarlos — se intentaban escribir todos de una ` +
      `vez y la base rechazaba la operación entera—, y el error no llegaba a ninguna pantalla. ` +
      `El veredicto es tan bueno como cualquiera: se dictó sobre la evidencia completa.`
    : `Este servicio se juzga ${dias} días después de su fecha, con ` +
      `${entrada.puntosDeEvidencia.toLocaleString("es-MX")} puntos de evidencia. Los datos no ` +
      `dicen a qué se debió la demora.`;

  return { horasDeRetraso: Math.round(horas), diasDeRetraso: dias, causa, explicacion };
}
