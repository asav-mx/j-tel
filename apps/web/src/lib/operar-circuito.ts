import { addDaysIso, haversineKm, localDateIso, instanteZonificado, proyectarSobreTrazado } from "@jtel/domain";
import {
  enHorarioDeServicio,
  estadoDelCircuito,
  yaArrancoElServicio,
  medirUnidad,
  type EstadoDelCircuito,
  type MedidaDeUnidad,
  type TrazadoDeSentido,
} from "@jtel/domain/publico";

/**
 * Cruzar el PLAN contra lo OBSERVADO, para la pantalla de operación.
 *
 * Toda la aritmética de la pantalla vive aquí y no dentro del componente, por
 * la razón de siempre: una cifra escrita dentro de un `.tsx` no se puede probar
 * sin montar la pantalla, y ésta es una cifra que el operador va a leer a las
 * seis de la mañana con el radio en la otra mano.
 *
 * ## Lo que este archivo NO hace
 *
 * **No mide.** La clasificación de cada unidad la resuelve `medirUnidad` en el
 * dominio, que es el mismo lugar del que sale lo que ve el pasajero. Aquí sólo
 * se reparte: cuál es cuál, y cómo se llama en palabras.
 *
 * **No sella, no juzga y no concluye.** No hay «no cumplió» ni nada que suene a
 * veredicto: en concesionado el motor mide y reporta. Un renglón de esta
 * pantalla pone el plan y el hecho uno frente al otro; qué significa eso lo
 * decide el operador, que es quien sabe si el camión está en el taller.
 */

/** Lo que la consulta del operador trae de cada unidad asignada y vigente. */
export interface UnidadDelPlan {
  assignmentId: string;
  unitId: string;
  /** El número económico. Es como el operador la nombra por el radio. */
  unitLabel: string;
  plateNumber: string | null;
  /**
   * El transportista, con su id además del nombre.
   *
   * El id no es un lujo: la pantalla decide con él si el nombre distingue algo
   * —un circuito puede correrlo más de un transportista—, y contar nombres en
   * vez de cuentas fundiría dos transportistas que se llamen igual en uno solo.
   */
  carrierAccountId: string;
  carrierName: string;
  assignedFrom: Date;
  /** `null` cuando de esta unidad no hay una sola posición. Se enuncia, no se omite. */
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  recordedAt: Date | null;
}

/** Los umbrales y el horario, todos columnas del circuito. Ninguno horneado. */
export interface CircuitoParaOperar {
  /**
   * El día en que arranca el servicio. `null` = ya opera.
   *
   * Entra aquí porque **apaga ruido**: sin ella, un circuito que arranca en tres
   * semanas enseña «0 de 5» y manda sus cinco unidades a «no ha salido», que es
   * un reproche por no estar trabajando antes de que exista el servicio.
   */
  serviceLaunchDate: string | null;
  serviceStartLocal: string;
  serviceEndLocal: string;
  timeZone: string;
  corridorToleranceMeters: number;
  staleAfterSeconds: number;
  serviceConfidenceMinutes: number;
}

export interface ParadaVigente {
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * En cuál de los cinco cajones cae una unidad del plan.
 *
 * Son excluyentes y cubren el plan entero: toda unidad asignada aparece en
 * exactamente uno. Que sumen es lo que permite escribir «3 de 5» sin que el
 * lector se quede preguntando dónde están las otras dos.
 */
export type Situacion =
  /**
   * El servicio del circuito todavía no arranca. **No se afirma nada de nadie**,
   * igual que fuera de horario: la unidad no está corriendo porque no la tiene
   * que estar.
   */
  | "por_arrancar"
  /** Del plan, con señal fresca y dentro del corredor. Lo que cuenta el número grande. */
  | "en_ruta"
  /** Se le vio en el corredor y dejó de reportar. Sigue en su recorrido hasta donde sabemos. */
  | "sin_senal"
  /** El circuito ya abrió y su GPS no la ve en el corredor — con señal lejos, o sin ninguna. */
  | "no_ha_salido"
  /** El circuito está cerrado. Fuera de horario no se afirma nada de nadie. */
  | "fuera_de_horario";

export interface UnidadOperando extends UnidadDelPlan {
  /** `null` cuando no hay una sola señal de esta unidad: no hay nada que medir. */
  medida: MedidaDeUnidad | null;
  situacion: Situacion;
  /**
   * A cuántos metros del trazado la ve su GPS. `null` sin señal o sin trazado
   * cargado — y `null` se dibuja como hueco, nunca como cero.
   */
  distanciaAlCorredorMetros: number | null;
  /**
   * La parada vigente más cercana a donde se le vio, para poder decir el lugar
   * con el nombre que usa el operador. `null` si el circuito no tiene paradas,
   * que es un caso normal: un circuito funciona sin ninguna.
   */
  paradaMasCercana: { name: string; metros: number } | null;
}

export interface Operacion {
  /** La hora del corte. Un dato sin su hora es un dato del que se puede dudar. */
  ahora: Date;
  /**
   * El servicio ya arrancó — o el circuito no declaró fecha, que significa que
   * ya opera. La pantalla LEE esta decisión en vez de comparar fechas por su
   * cuenta: una segunda comparación es una segunda definición esperando a
   * separarse de ésta.
   */
  yaArranco: boolean;
  enHorario: boolean;
  /**
   * Cuándo abrió la ventana de servicio que corre ahora, o `null` con el
   * circuito cerrado.
   *
   * **Es del CIRCUITO, no de la unidad**, y la pantalla tiene que decirlo así.
   * La franja horaria por asignación —«la 10249 sale a las 07:00»— no existe en
   * el modelo: `circuit_unit_assignments` guarda vigencia por fechas y nada
   * más. Escribir «su turno empezó hace 40 min» con este dato sería inventar
   * una hora que nadie declaró; escribir «el circuito abrió a las 05:00» es
   * verdad y se puede sostener.
   */
  aperturaDelHorario: Date | null;
  estado: EstadoDelCircuito;
  /** Todas las del plan, en el orden en que llegaron (número económico). */
  unidades: UnidadOperando[];
  /** Cuántas están en ruta y cuántas hay en el plan: el numerador y su denominador. */
  enRuta: number;
  enElPlan: number;
  /**
   * Las que el operador querría mirar: sin señal, o asignadas y sin salir.
   * Vacío cuando no hay nada que atender, y entonces la sección no se dibuja.
   */
  atencion: UnidadOperando[];
  /**
   * Si el plan lo corren varios transportistas — y por lo tanto si nombrarlos
   * en cada renglón distingue algo o sólo repite.
   *
   * Se cuenta por **cuenta**, no por nombre: dos transportistas que se llamen
   * igual son dos, y contarlos por su rótulo los fundiría en uno. Vive aquí y
   * no dentro del componente porque es una afirmación sobre el plan, y una
   * afirmación se prueba.
   */
  variosTransportistas: boolean;
}

export function armarOperacion(entrada: {
  ahora: Date;
  circuito: CircuitoParaOperar;
  trazados: TrazadoDeSentido[];
  paradas: ParadaVigente[];
  plan: UnidadDelPlan[];
}): Operacion {
  const { ahora, circuito, trazados, paradas, plan } = entrada;

  const yaArranco = yaArrancoElServicio(
    ahora,
    circuito.serviceLaunchDate,
    circuito.timeZone,
  );

  const enHorario = enHorarioDeServicio(
    ahora,
    circuito.serviceStartLocal,
    circuito.serviceEndLocal,
    circuito.timeZone,
  );

  const contexto = {
    ahora,
    trazados,
    corredorMetros: circuito.corridorToleranceMeters,
    frescuraSegundos: circuito.staleAfterSeconds,
    confianzaSegundos: circuito.serviceConfidenceMinutes * 60,
  };

  const unidades: UnidadOperando[] = plan.map((u) => {
    const punto =
      u.latitude !== null && u.longitude !== null && u.recordedAt !== null
        ? { lat: u.latitude, lon: u.longitude, recordedAt: u.recordedAt }
        : null;

    const medida = punto ? medirUnidad(punto, contexto) : null;

    return {
      ...u,
      medida,
      situacion: situacionDe(medida, enHorario, yaArranco),
      distanciaAlCorredorMetros: punto ? distanciaAlCorredor(punto, trazados) : null,
      paradaMasCercana: punto ? paradaMasCercanaA(punto, paradas) : null,
    };
  });

  /*
   * El estado del circuito sale de las MISMAS medidas que la lista, no de una
   * segunda consulta ni de un segundo criterio. Es lo que impide que el número
   * grande diga una cosa y la lista de abajo otra.
   *
   * Las unidades sin ninguna señal no entran: no son una observación, son la
   * ausencia de una. La escalera decide con lo que el GPS vio.
   */
  const estado = estadoDelCircuito({
    yaArranco,
    enHorario,
    unidades: unidades.map((u) => u.medida).filter((m): m is MedidaDeUnidad => m !== null),
  });

  return {
    ahora,
    yaArranco,
    enHorario,
    /*
     * Sin arrancar no hay ventana de servicio corriendo, aunque el reloj caiga
     * dentro del horario declarado. La usa la sección de atención para decir
     * «desde que abrió, hace 40 min», y antes del arranque esa frase mediría
     * una jornada que no empezó.
     */
    aperturaDelHorario: yaArranco && enHorario ? aperturaDelHorario(ahora, circuito) : null,
    estado,
    unidades,
    enRuta: unidades.filter((u) => u.situacion === "en_ruta").length,
    enElPlan: unidades.length,
    atencion: unidades.filter(
      (u) => u.situacion === "sin_senal" || u.situacion === "no_ha_salido",
    ),
    variosTransportistas: new Set(unidades.map((u) => u.carrierAccountId)).size > 1,
  };
}

/**
 * El reparto, y el orden importa.
 *
 * **Sin arrancar gana sobre todo, y el horario después**, igual que en la
 * escalera del pasajero. Con el circuito cerrado, «no ha salido» sería un
 * reproche por no estar trabajando a las cuatro de la mañana; antes del
 * arranque sería el mismo reproche, tres semanas antes de que exista el
 * servicio.
 *
 * **Sin una sola señal cae en `no_ha_salido`**, no en `sin_senal`. La
 * diferencia es la que pidió el operador: `sin_senal` es *estaba reportando en
 * el corredor y dejó de hacerlo* —hay un último lugar y una última hora que
 * enseñar—, y sin señal alguna no hay ni lo uno ni lo otro. Meterlas juntas
 * borraría justo el dato que distingue los dos problemas.
 */
function situacionDe(
  medida: MedidaDeUnidad | null,
  enHorario: boolean,
  yaArranco: boolean,
): Situacion {
  if (!yaArranco) return "por_arrancar";
  if (!enHorario) return "fuera_de_horario";
  if (!medida) return "no_ha_salido";
  if (medida.enRuta) return "en_ruta";
  if (medida.enCorredor) return "sin_senal";
  return "no_ha_salido";
}

/**
 * Cuándo abrió la ventana de servicio que está corriendo ahora.
 *
 * **Aguanta que la ventana cruce la medianoche**, igual que
 * `enHorarioDeServicio`: a las 02:00 con un servicio de 22:00 a 06:00, la
 * apertura fue ayer, y tomar la de hoy daría una duración negativa dibujada
 * como si fuera del futuro.
 *
 * El instante se construye con `instanteZonificado` y nunca a mano: un
 * `new Date(\`${fecha}T05:00:00\`)` se resuelve en la zona del proceso, y eso
 * ya costó 294 hechos sellados con la hora equivocada.
 */
export function aperturaDelHorario(ahora: Date, circuito: CircuitoParaOperar): Date {
  const [hh, mm] = circuito.serviceStartLocal.slice(0, 5).split(":").map(Number);
  const minutos = (hh ?? 0) * 60 + (mm ?? 0);
  const hoy = localDateIso(ahora, circuito.timeZone);
  const deHoy = instanteZonificado(hoy, minutos, circuito.timeZone);
  if (deHoy.getTime() <= ahora.getTime()) return deHoy;
  return instanteZonificado(addDaysIso(hoy, -1), minutos, circuito.timeZone);
}

/**
 * A cuántos metros del trazado más cercano. `null` sin trazado cargado —
 * un circuito sin KML todavía no puede afirmar distancias, y cero mentiría.
 */
function distanciaAlCorredor(
  punto: { lat: number; lon: number },
  trazados: TrazadoDeSentido[],
): number | null {
  let menor: number | null = null;
  for (const t of trazados) {
    const p = proyectarSobreTrazado(punto, t.coordinates);
    if (!p) continue;
    if (menor === null || p.distanciaMetros < menor) menor = p.distanciaMetros;
  }
  return menor;
}

function paradaMasCercanaA(
  punto: { lat: number; lon: number },
  paradas: ParadaVigente[],
): { name: string; metros: number } | null {
  let mejor: { name: string; metros: number } | null = null;
  for (const p of paradas) {
    const metros = haversineKm(punto.lat, punto.lon, p.latitude, p.longitude) * 1000;
    if (!mejor || metros < mejor.metros) mejor = { name: p.name, metros };
  }
  return mejor;
}
