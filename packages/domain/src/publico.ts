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

/**
 * La huella de una APERTURA de la app, para un día y un circuito.
 *
 * Contesta una sola pregunta —«¿cuántos aparatos distinguibles abrieron esta
 * ruta hoy?»— y está construida para no poder contestar ninguna otra.
 *
 * **Rota cada día, como `idPublicoDelDia` y por la misma razón.** El día entra
 * al mensaje, así que la huella de mañana no se parece a la de hoy: nadie puede
 * seguir a un aparato entre días ni armar «cuántos volvieron». Eso no es una
 * limitación que haya que resolver después — es la decisión, y medir regresos
 * sería otro producto con su propio consentimiento, no una puerta trasera de
 * éste.
 *
 * **El circuito también entra**, así que el mismo teléfono abriendo dos rutas
 * cuenta en cada una y no se puede cruzar entre ellas.
 *
 * **HMAC y no un hash a secas.** Los insumos son adivinables —hay pocos agentes
 * comunes y los rangos de IP son públicos—, así que sin la llave cualquiera con
 * una lista de direcciones podría recalcular la huella y deshacer el anonimato.
 *
 * ⚠ **Lo que esta huella NO puede prometer, y por eso el rótulo lo dice:** que
 * dos aparatos distintos den huellas distintas. Detrás de un NAT móvil —que en
 * Juárez es el caso normal, no la excepción— media colonia sale con la misma IP,
 * y con el mismo modelo de teléfono sale con el mismo agente. **Subcuenta a
 * propósito**: es lo único que el servidor puede sostener sin guardar nada en el
 * teléfono.
 */
export function huellaDeApertura(entrada: {
  ip: string;
  agente: string;
  fechaLocal: string;
  circuitoId: string;
  secreto: string;
}): string {
  if (!entrada.secreto) {
    throw new Error("huellaDeApertura necesita una llave: sin ella la huella no es opaca");
  }
  /* Los separadores no son adorno: sin ellos, dos insumos distintos pueden
     concatenarse a la misma cadena y colisionar por construcción. */
  const mensaje = [entrada.ip, entrada.agente, entrada.fechaLocal, entrada.circuitoId].join("\n");
  return createHmac("sha256", entrada.secreto).update(mensaje).digest("hex").slice(0, 32);
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

// ── Fecha de arranque del servicio ───────────────────────────────────────

/**
 * ¿El servicio de este circuito ya arrancó?
 *
 * Existe porque un circuito sólo podía estar invisible o presentado como si
 * operara, y faltaba el escalón de en medio: **declarado y visible, con el
 * servicio sin arrancar**. Antes, un circuito publicado tres semanas antes de
 * su primer día caía a `sin_evidencia` y la app contaba una ausencia que no
 * significaba nada — no hay unidades porque todavía no las tiene que haber.
 *
 * **`null` significa que YA OPERA**, no que arranca hoy. Un circuito en marcha
 * no tiene por qué inventarse una fecha de arranque hacia atrás, y poner la de
 * hoy por defecto sería fabricar una declaración que nadie hizo — la misma
 * falta que la frecuencia con `DEFAULT 20`.
 *
 * **Se compara la fecha civil del circuito, no un instante.** El servicio
 * arranca a las 00:00 de la zona del circuito, y de ahí en adelante manda el
 * reloj como siempre. Construir un instante obligaría a inventar una hora de
 * arranque que nadie declaró: lo que se declara es el DÍA.
 *
 * Una fecha pasada da `true` igual que la ausencia. No se limpia sola: es el
 * registro de cuándo arrancó, y borrarla al día siguiente perdería el dato por
 * nada.
 */
export function yaArrancoElServicio(
  ahora: Date,
  fechaDeArranque: string | null,
  zona: string,
): boolean {
  if (!fechaDeArranque) return true;
  // Las dos son `YYYY-MM-DD`, y en ese formato el orden de texto es el del
  // calendario. Comparar así evita construir fechas y atravesar el horario de
  // verano por nada, igual que `enHorarioDeServicio` con las horas.
  return localDateIso(ahora, zona) >= fechaDeArranque.slice(0, 10);
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
 * Cinco estados, evaluados en orden y parando en el primero que aplique.
 * Existen porque la app tenía **un solo silencio para tres cosas distintas** y
 * las decía todas igual: «el servicio corre cada N minutos». El quinto llegó
 * después, y por la falta simétrica: un circuito sin arrancar se presentaba
 * como uno que opera y al que no se le ve nada.
 */
export type EstadoDelCircuito =
  /**
   * **El servicio todavía no arranca**, y la fecha lo dice — no un silencio.
   *
   * Es el escalón que faltaba: un circuito sólo podía estar invisible o
   * presentado como si operara. Va ARRIBA de `fuera_de_horario` porque la fecha
   * manda sobre el reloj: preguntarle al horario si está abierto un servicio
   * que no ha arrancado es preguntar por la hora de una puerta que todavía no
   * existe.
   *
   * No cae a `sin_evidencia` porque **no hay nada que evidenciar todavía**.
   * «No hemos visto unidades» sería contar una ausencia que no significa nada:
   * las unidades no están porque aún no las tiene que haber.
   */
  | "por_arrancar"
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

/**
 * Lo que se puede afirmar de UNA unidad, medido una sola vez.
 *
 * Existe porque las dos caras hacen la misma pregunta y la hacían por separado.
 * El pasajero pregunta «¿hay servicio?» y el operador pregunta «¿cuántas de mi
 * plan están dando servicio?»: son la misma medición leída con dos alcances, y
 * mientras cada cara la calculaba con sus propios `filter`, **nada impedía que
 * un día dijeran cosas distintas del mismo camión**. Aquí se mide una vez y las
 * dos leen el resultado.
 */
export interface MedidaDeUnidad {
  /** Su última posición conocida cae dentro del corredor del circuito. */
  enCorredor: boolean;
  antiguedadSeg: number;
  /** El fix todavía dice DÓNDE ESTÁ: por debajo del umbral de dato viejo. */
  fresco: boolean;
  /**
   * Se le vio lo bastante recientemente como para seguir sosteniendo algo.
   * Es sólo tiempo: no dice nada de dónde estaba.
   */
  dentroDeConfianza: boolean;
  /**
   * **EN RUTA: del plan, fresca y dentro del corredor.** Ésta es la definición,
   * y no hay otra: `en_vivo` es «hay al menos una en ruta», y el «3 de 5» del
   * operador es cuántas lo están. Un `filter` equivalente escrito en una
   * pantalla sería una segunda definición, y las dos definiciones se separan.
   */
  enRuta: boolean;
}

/** Los tres umbrales del circuito. Ninguno tiene default: son columnas suyas. */
export interface UmbralesDelCircuito {
  corredorMetros: number;
  frescuraSegundos: number;
  confianzaSegundos: number;
}

/**
 * Mide una unidad contra el circuito: dónde está y desde cuándo.
 *
 * Los umbrales entran por parámetro y salen de las columnas del circuito
 * (`corridor_tolerance_meters`, `stale_after_seconds`,
 * `service_confidence_minutes`). Hornear cualquiera convertiría el alta de un
 * concesionario nuevo en un despliegue.
 */
export function medirUnidad(
  observado: { lat: number; lon: number; recordedAt: Date },
  contexto: { ahora: Date; trazados: TrazadoDeSentido[] } & UmbralesDelCircuito,
): MedidaDeUnidad {
  const antiguedadSeg = antiguedadSegundos(observado.recordedAt, contexto.ahora);
  const enCorredor = vaSobreElCircuito(
    { lat: observado.lat, lon: observado.lon },
    contexto.trazados,
    contexto.corredorMetros,
  );
  const fresco = esFresco(antiguedadSeg, contexto.frescuraSegundos);
  return {
    enCorredor,
    antiguedadSeg,
    fresco,
    dentroDeConfianza: antiguedadSeg < contexto.confianzaSegundos,
    enRuta: enCorredor && fresco,
  };
}

/**
 * La escalera, en un solo lugar y sin tocar la base.
 *
 * **La asignación vigente es plan, no evidencia.** Un circuito con cinco
 * unidades asignadas y ninguna observación reciente cae a `sin_evidencia`, nunca
 * a `por_horario`: la asignación dice qué se planeó, y sólo el GPS puede
 * afirmar que hay servicio. Por eso esta función no recibe cuántas unidades hay
 * asignadas — no es un insumo de la decisión, y no tenerlo a la mano es lo que
 * impide usarlo por descuido.
 *
 * **Los dos estados con evidencia exigen corredor.** Un camión parado en el
 * patio reporta cada minuto y mantendría la ruta «por horario» toda la noche;
 * su última posición está en el patio, así que no cuenta. El que se metió a un
 * túnel sí cuenta: la última vez que se le vio, iba en la ruta.
 *
 * **La fecha de arranque manda sobre el reloj**, y por eso va en el primer
 * escalón. Un circuito que arranca el 15 no está «fuera de horario» el día 3 a
 * las tres de la tarde: está sin arrancar, que es otra cosa y se dice distinto.
 *
 * **Ya no recibe umbrales**, y ése es el punto del cambio: los aplicó
 * `medirUnidad` antes de llegar aquí, así que `en_vivo` es literalmente «alguna
 * en ruta» en vez de una comparación repetida. Dos comparaciones equivalentes
 * en dos archivos son dos definiciones esperando a separarse.
 */
export function estadoDelCircuito(entrada: {
  /**
   * La fecha de arranque ya pasó — o el circuito no declaró ninguna, que
   * significa que ya opera. Lo resuelve `yaArrancoElServicio` antes de llegar
   * aquí, igual que `enHorario`.
   */
  yaArranco: boolean;
  enHorario: boolean;
  unidades: MedidaDeUnidad[];
}): EstadoDelCircuito {
  if (!entrada.yaArranco) return "por_arrancar";
  if (!entrada.enHorario) return "fuera_de_horario";
  if (entrada.unidades.some((u) => u.enRuta)) return "en_vivo";
  if (entrada.unidades.some((u) => u.enCorredor && u.dentroDeConfianza)) return "por_horario";
  return "sin_evidencia";
}

// ── Los valores con que nace un circuito ─────────────────────────────────

/**
 * Los valores con que NACE un circuito, y la única copia que existe de ellos.
 *
 * Existen como constante —y no sueltos dentro de cada `.default(…)` del
 * esquema— porque **la pantalla del expediente los enseña**: un operador que lee
 * «150 m» tiene derecho a saber si ese número lo escogió alguien para SU
 * circuito o si es el que traía de origen. Si la pantalla los tuviera copiados,
 * el día que se mueva un default seguiría diciendo el viejo con la autoridad del
 * sistema detrás — que es la forma exacta en que un dato correcto se vuelve una
 * afirmación falsa.
 *
 * Viven en el dominio y no en `@jtel/db` para que la pantalla los lea sin
 * arrastrar el controlador de base de datos, y para que el esquema y la interfaz
 * lean **el mismo símbolo** en vez de dos copias que se separan.
 *
 * ⚠ **Coincidir con el valor de origen NO prueba que nadie lo haya escrito.** Un
 * 180 heredado y un 180 tecleado son indistinguibles en la base: es exactamente
 * el hueco que tenía la frecuencia declarada antes de la `0031`. Por eso la
 * pantalla dice «igual al valor de origen» y nunca «sin ajustar». Lo único que
 * lo cerraría es un registro de cambios, que todavía no existe.
 *
 * **La frecuencia declarada no está aquí, y ésa es la diferencia de fondo:** no
 * tiene valor de origen porque la app la dice en voz alta al pasajero.
 */
export const ORIGEN_DEL_CIRCUITO = {
  frescuraSegundos: 180,
  pisoDelRangoSegundos: 180,
  pegadoDeParadasMetros: 25,
  corredorEnRutaMetros: 150,
  confianzaMinutos: 15,
  velocidadKmh: 20.5,
  colorHex: "#7C5CE0",
  horaInicioLocal: "05:00",
  horaFinLocal: "23:00",
  zonaHoraria: "America/Ciudad_Juarez",
} as const;
