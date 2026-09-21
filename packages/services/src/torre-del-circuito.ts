/**
 * La torre del circuito — **la capa de datos** (Marco 9.2b, Paso 1.B/1.C).
 *
 * Arma lo que la torre muestra, sobre lo que la cuenta puede ver y nada más. No
 * hay una línea de pantalla aquí: el radar es el Paso 2.
 *
 * **Vive en `services` y no en un repositorio** por el mismo motivo que
 * `comparar-pasos-por-parada.ts`: cruza `CircuitRepository` y
 * `PasoPorParadaRepository`, dos repositorios que no se llaman entre sí en esta
 * casa. Aquí es donde va la composición.
 *
 * ## No sella, no juzga (9.3)
 *
 * Etapa 1: se mide y se dice lo medido. Ninguna salida de este módulo dice
 * «cumplió» ni «no cumplió», y ninguna se guarda: la torre se calcula al leer.
 *
 * ## Dos ejes, no uno (decisión de ASAV, 20-sep)
 *
 * De cada unidad se contestan **dos preguntas distintas** y se devuelven
 * aparte:
 *
 *  - **`situacion`** — ¿está corriendo? Los cinco cajones de siempre, los
 *    mismos que ve J-Staff (`situacionDe`, en el dominio).
 *  - **`promesa`** — ¿sostuvo el intervalo? EN RANGO · ADELANTADA · ATRASADA ·
 *    SIN DATOS (9.2c, 9.3b).
 *
 * Aplanarlos en un solo estado haría que un camión **fuera de horario** saliera
 * «SIN DATOS», que se lee como un reproche por no estar trabajando de noche.
 * Por eso la promesa sólo se emite de las unidades que están en la calle, y de
 * las demás dice `no_aplica` — que **no es** `sin_datos`: lo primero dice que la
 * pregunta no viene al caso, lo segundo que venía al caso y no se pudo
 * contestar.
 *
 * ## El vocabulario del motor no sale de aquí (9.3b)
 *
 * `sostuvo`, `se_agujero` y `sin_datos` son nombres internos. Este módulo es el
 * borde: traduce a EN RANGO / ADELANTADA / ATRASADA / SIN DATOS y **no usa la
 * palabra «hueco»** — en pantalla ya significa que el equipo calló y nadie
 * midió, y dos cosas con el mismo nombre en la misma pantalla es la trampa del
 * Marco §D. Lo que una parada lleva sin que pase nadie se llama **espera**.
 *
 * Y todo número sale **con su referencia al lado** (9.3b: «4 min · rango
 * 5–15»): un intervalo sin su banda no se puede leer, y si la banda se armara
 * en la pantalla sería otra copia de la aritmética.
 */
import {
  localDateIso,
  ladoDeLaBanda,
  ventanaEsperada,
  proyectarSobreTrazado,
  perfilDeLaVuelta,
  colocarRitmoPrometido,
  type Sentido,
  type TramoMedido,
  type ReferenciaDeRitmo,
} from "@jtel/domain";
import {
  medirUnidad,
  situacionDe,
  estaEnLaCalle,
  enHorarioDeServicio,
  yaArrancoElServicio,
  aperturaDeclaradaEnFecha,
  type MedidaDeUnidad,
  type Situacion,
  type TrazadoDeSentido,
} from "@jtel/domain/publico";
import type { Repositories } from "@jtel/db";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

const SENTIDOS: Sentido[] = ["ida", "vuelta"];
const MS_POR_MINUTO = 60_000;

/**
 * Si lo que esta cuenta puede ver ES el flujo del servicio, o sólo un pedazo
 * (9.14).
 *
 * **Es la compuerta de todo lo que se deriva de intervalos**, y por eso se pasa
 * como parámetro OBLIGATORIO a cada derivación en vez de consultarse adentro:
 * el compilador no deja escribir una derivación nueva que se olvide de
 * preguntar. Quitarlo no compila; consultarlo adentro se podría borrar sin que
 * nada se rompiera.
 */
export type FlujoDelServicio = "completo" | "incompleto";

/**
 * Por qué no hay estado, cuando no lo hay. **Salen separados** (decisión de
 * ASAV, 20-sep): fundir los cuatro en una sola palabra deja al operador sin
 * saber si le fallaron los GPS, si falta capturar la promesa o si el circuito
 * lo corre alguien más. Quién los junta —y con qué palabra— lo decide el Paso 2.
 *
 * `sin_senal` NO está aquí: vive en el eje de `situacion`, que es donde ya
 * tenía nombre.
 */
export type MotivoSinDatos =
  /** La unidad no tiene un solo paso medido todavía: no hay intervalo que comparar. */
  | "sin_pasos"
  /** Ninguna franja declarada cubre ese instante. No se rellena con la vecina. */
  | "sin_promesa"
  /**
   * El rango del paso se traslapa con la orilla de la banda. **No es falta de
   * medición**: es una medición que no alcanza a concluir, y nunca un veredicto
   * a medias (decisión C de ASAV, 19-sep).
   */
  | "a_caballo"
  /**
   * 9.14: el circuito lo corren varios transportistas y esta cuenta sólo ve los
   * suyos. **SIN DATOS antes que un número prestado** — medir contra un flujo
   * incompleto produce un ATRASADA falso.
   */
  | "flujo_incompleto";

/** La banda de la promesa, en minutos. Es la «referencia» del 9.3b. */
export interface Referencia {
  desdeMin: number;
  hastaMin: number;
  /** Lo prometido para esa franja, sin la tolerancia. */
  frecuenciaMin: number;
}

export type EstadoDePromesa =
  | "en_rango"
  | "adelantada"
  | "atrasada"
  | "sin_datos"
  /** La unidad no está en la calle: la pregunta no viene al caso. No es una etiqueta de pantalla. */
  | "no_aplica";

export interface PromesaDeUnidad {
  estado: EstadoDePromesa;
  /** Sólo cuando `estado` es `sin_datos`. */
  motivo: MotivoSinDatos | null;
  /**
   * El intervalo **cerrado** que produjo el estado (9.2d: en la unidad, hacia
   * atrás contra el paso anterior por esa parada; el intervalo ya ocurrió).
   *
   * Es un **rango y no un número**, y no es un detalle: el paso por una parada
   * es el par de pings que encierran el cruce, no un instante — el instrumento
   * no conoce «la hora del paso». Devolver un minuto suelto sería la hora
   * inventada que el Marco §D prohíbe. Si los dos extremos redondean al mismo
   * minuto, la pantalla escribe uno.
   */
  intervalo: { desdeMin: number; hastaMin: number } | null;
  referencia: Referencia | null;
  medidoEn: { stopId: string; sentido: Sentido; pasoDesde: Date; pasoHasta: Date } | null;
}

/**
 * Un paso ya comparado contra su banda — **la unidad de trabajo de todo lo que
 * la torre deriva de pasos**, calculada UNA vez por paso.
 *
 * Antes cada cifra recorría los pasos por su cuenta: el estado de la unidad
 * buscaba su último paso y su ancla, y el sostenimiento volvía a recorrerlos
 * todos calculando las mismas ventanas. Dos recorridos son dos definiciones
 * del mismo veredicto esperando a separarse — y el día que se separen, la
 * pieza diría ADELANTADA y el conteo de arriba la contaría en rango.
 */
export interface PasoMedido {
  stopId: string;
  nombreDeLaParada: string;
  unitId: string;
  sentido: Sentido;
  pasoDesde: Date;
  pasoHasta: Date;
  /** El intervalo cerrado contra el paso anterior en esa parada (9.2d). */
  intervalo: { desdeMin: number; hastaMin: number };
  referencia: Referencia | null;
  estado: EstadoDePromesa;
  motivo: MotivoSinDatos | null;
}

export interface UnidadEnLaTorre {
  unitId: string;
  unitLabel: string;
  /** ¿Está corriendo? El eje de siempre. */
  situacion: Situacion;
  /** `null` cuando de esta unidad no hay una sola posición. Se enuncia, no se omite. */
  medida: MedidaDeUnidad | null;
  ultimaPosicion: { lat: number; lon: number; recordedAt: Date; antiguedadSeg: number } | null;
  /**
   * km/h del último fix — **contexto del ritmo, nunca una orden** (9.2b).
   * `null` sin posición, y también cuando el aparato no la reporta: eso no es
   * cero, y dibujarlo como cero diría «detenida» de un camión andando.
   */
  velocidadKmh: number | null;
  /**
   * El rumbo en grados del último fix. Lo usa **sólo la flecha llena**: girar
   * un círculo no dice nada, y girar la flecha hueca afirmaría un rumbo que ya
   * nadie observa. `null` cuando el aparato no lo reporta.
   */
  rumboGrados: number | null;
  /**
   * Dónde cae sobre el corredor, para poder dibujarla a lo largo del trazado.
   * `null` sin posición o sin trazado cargado — y `null` se dibuja como hueco,
   * nunca como cero.
   */
  sobreElCorredor: { sentido: Sentido; avanceMetros: number; distanciaMetros: number } | null;
  /** ¿Sostuvo el intervalo? El otro eje. */
  promesa: PromesaDeUnidad;
  /**
   * Sus últimos pasos medidos, del más reciente al más viejo — lo que el
   * detalle enseña al tocarla. Es **proyección de lo ya calculado**, no una
   * segunda medición: son las mismas filas de las que sale su estado.
   */
  ultimosPasos: PasoMedido[];
}

/**
 * Lo medido en una parada — **la espera** (9.2d, 9.3b).
 *
 * Es el segundo reloj del circuito, y corre al revés que el de la unidad:
 * **abierto, desde la última pasada hacia el ahora, y crece mientras nadie
 * pasa.** Es la única medición del circuito que puede decir algo sin que haya
 * ocurrido ningún hecho: una parada declara que la promesa se está rompiendo
 * **antes** de que ninguna unidad haya hecho nada.
 *
 * **No es un veredicto de la parada** (9.8b): la parada nunca recibe veredicto
 * propio. Es el cumplimiento del circuito EN esa parada, en vocabulario de
 * etapa 1.
 */
export interface EsperaDeParada {
  stopId: string;
  nombre: string;
  sentido: Sentido;
  /** Minutos que lleva la espera. Abierto. `null` cuando no hay con qué medir. */
  minutos: number | null;
  /** El ancla fue la apertura declarada porque hoy no ha pasado nadie por aquí. */
  desdeLaApertura: boolean;
  ultimaPasada: Date | null;
  referencia: Referencia | null;
  /**
   * **Nunca `adelantada`**, y el tipo lo dice: un intervalo abierto sólo crece.
   * Una espera corta no es mérito de nadie, es que todavía no toca.
   */
  estado: "en_rango" | "atrasada" | "sin_datos" | "no_aplica";
  motivo: MotivoSinDatos | null;
  /**
   * Quién pasó por aquí, del más reciente al más viejo — lo que el detalle
   * enseña al tocarla. Son los mismos pasos medidos de los que sale todo lo
   * demás, proyectados: nunca una segunda medición.
   */
  ultimasPasadas: PasoMedido[];
}

export type RitmoEnLaTorre =
  | {
      disponible: false;
      /** Se declara vacío y por qué (9.2e): el carril no se rellena con nada. */
      motivo: MotivoSinDatos | "sin_tramos" | "perfil_incompleto" | "fuera_de_horario";
      tramosSinMedir?: number;
    }
  | {
      disponible: true;
      sentido: Sentido;
      /** Lo que dura la vuelta según lo MEDIDO hoy en esta franja. */
      vueltaMinutos: number;
      vueltasMedidas: number;
      referencias: ReferenciaDeRitmo[];
    };

export type TorreDelCircuito =
  | { alcance: "ninguno" }
  | {
      alcance: "concesion" | "carrier";
      ahora: Date;
      yaArranco: boolean;
      enHorario: boolean;
      /** Desde cuándo corre el día de servicio. Es el ancla de todo lo de abajo. */
      apertura: Date;
      flujo: FlujoDelServicio;
      /**
       * La promesa vigente AHORA — **pública, y por eso fuera de la compuerta**
       * (9.14: la ruta, sus paradas y sus horarios son públicos; lo reservado es
       * el resultado de la medición). Sin esto, un carrier en circuito
       * compartido leía «promesa sin capturar» de un circuito que sí la tiene:
       * dato correcto sobre lo que él puede medir, afirmación falsa sobre lo que
       * el circuito declaró.
       */
      promesaVigente: Referencia | null;
      /** Con qué corrida del detector se midió todo esto. */
      detectorVersion: string;
      unidades: UnidadEnLaTorre[];
      esperas: EsperaDeParada[];
      /**
       * Cuántos de los pasos medidos desde la apertura cayeron en rango.
       * **Conteo, no juicio** — «12 de 16» no dice si eso está bien.
       */
      sostenimiento: { enRango: number; medidos: number } | null;
      ritmo: RitmoEnLaTorre;
    };

/**
 * ¿Está habilitada la comparación compartida para este circuito? (9.14)
 *
 * **Hoy siempre no, y está en una función sola a propósito.** La ley dice que
 * medir un carrier contra los camiones de otro se habilita «por circuito, según
 * el acuerdo de esa concesión — nunca por ley general, nunca por default». Ese
 * acuerdo todavía no tiene dónde vivir en la base. Cuando lo tenga, se prende
 * aquí, en un renglón, y no hay que ir a buscar la regla repartida por el
 * módulo. Mientras tanto el `false` es la respuesta correcta, no un pendiente:
 * por default, nunca.
 */
function comparacionCompartidaHabilitada(_circuitId: string): boolean {
  return false;
}

const minutosEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MS_POR_MINUTO;

/** La banda, en minutos, tal como la calcula el dominio — sin una segunda fórmula. */
function referenciaDe(ancla: Date, frecuenciaMin: number, toleranciaPct: number): Referencia {
  const ventana = ventanaEsperada(ancla, frecuenciaMin, toleranciaPct);
  return {
    desdeMin: minutosEntre(ancla, ventana.desde),
    hastaMin: minutosEntre(ancla, ventana.hasta),
    frecuenciaMin,
  };
}

export async function armarTorreDelCircuito(
  repos: Repositories,
  input: { cuentaId: string; circuitId: string; ahora: Date },
): Promise<TorreDelCircuito> {
  const { cuentaId, circuitId, ahora } = input;

  /*
   * El muro primero, y de él sale el alcance. Un circuito que no es de esta
   * cuenta responde igual que uno que no existe.
   */
  const circuito = await repos.circuits.getCircuitVisibleParaCuenta(cuentaId, circuitId);
  if (!circuito) return { alcance: "ninguno" };
  const alcance = circuito.concessionAccountId === cuentaId ? "concesion" : "carrier";

  const zona = circuito.timeZone;
  const fechaCivil = localDateIso(ahora, zona);
  const apertura = aperturaDeclaradaEnFecha(circuito.serviceStartLocal, fechaCivil, zona);
  const yaArranco = yaArrancoElServicio(ahora, circuito.serviceLaunchDate, zona);
  const enHorario = enHorarioDeServicio(
    ahora,
    circuito.serviceStartLocal,
    circuito.serviceEndLocal,
    zona,
  );

  /*
   * La compuerta del 9.14, decidida UNA vez y pasada hacia abajo.
   *
   * La concesión ve todos los pasos de su circuito, así que para ella el flujo
   * es siempre completo. Un carrier ve los suyos: si el circuito lo corre él
   * solo, eso ES el servicio completo y la medición es correcta tal cual; si lo
   * corren varios, lo que ve es un pedazo, y medir sobre un pedazo daría un
   * ATRASADA falso.
   */
  const flujo: FlujoDelServicio =
    alcance === "concesion" ||
    comparacionCompartidaHabilitada(circuitId) ||
    !(await repos.circuits.circuitoTieneMasDeUnCarrier(circuitId, apertura))
      ? "completo"
      : "incompleto";

  const [plan, paradas, trazadosCrudos] = await Promise.all([
    repos.circuits.planDelCircuitoParaCuenta(cuentaId, circuitId),
    repos.circuits.listStopsVigentes(circuitId),
    repos.circuits.getPaths(circuitId),
  ]);

  const trazados: TrazadoDeSentido[] = trazadosCrudos.map((t) => ({
    sentido: t.sentido as Sentido,
    coordinates: t.coordinates as Array<[number, number]>,
  }));

  /*
   * Los pasos de hoy, parada por parada, SIEMPRE por el repositorio con muro y
   * acotados a la apertura: la torre relee cada pocos segundos y el historial
   * de una parada crece para siempre.
   *
   * Se queda sólo con la versión del detector que corre hoy. Los pasos apilan
   * por versión (no se pisan), así que sin este filtro una recorrida con
   * detector nuevo contaría cada paso dos veces — «24 de 32» donde hubo 16.
   */
  const pasosPorParada = new Map<string, PasoVisible[]>();
  await Promise.all(
    paradas.map(async (p) => {
      const filas = await repos.pasosPorParada.listarPasosDeParada(cuentaId, p.stopId, apertura);
      pasosPorParada.set(
        p.stopId,
        filas
          .filter((f) => f.detectorVersion === VERSION_DEL_DETECTOR)
          .map((f) => ({
            stopId: f.stopId,
            unitId: f.unitId,
            sentido: f.sentido as Sentido,
            pasoDesde: f.pasoDesde,
            pasoHasta: f.pasoHasta,
          }))
          .sort((a, b) => a.pasoDesde.getTime() - b.pasoDesde.getTime()),
      );
    }),
  );

  /*
   * UNA pasada sobre los pasos de hoy, y de ella salen el estado de cada
   * unidad, el sostenimiento y los dos detalles. Dos recorridos serían dos
   * definiciones del mismo veredicto, y el día que se separaran la pieza diría
   * ADELANTADA mientras el conteo de arriba la cuenta en rango.
   */
  const medidos = await medirTodosLosPasos({
    repos,
    circuito,
    paradas,
    pasosPorParada,
    apertura,
    flujo,
  });

  const unidades = derivarUnidades({
    circuito,
    plan,
    trazados,
    medidos,
    sentidoDe: sentidoDeCadaUnidad(pasosPorParada),
    ahora,
    enHorario,
    yaArranco,
    flujo,
  });

  const esperas = await derivarEsperas({
    repos,
    circuito,
    paradas,
    pasosPorParada,
    medidos,
    apertura,
    ahora,
    enHorario,
    yaArranco,
    flujo,
  });

  const sostenimiento = contarSostenimiento(medidos);

  /*
   * La promesa de la franja de AHORA, sin pasar por la compuerta: es lo que el
   * circuito declaró, no lo que esta cuenta midió. Se pregunta por «ida» porque
   * la banda que la torre rotula es una sola; una promesa distinta por sentido
   * es un caso que existe en la base y que la pantalla todavía no separa.
   */
  const declarada = await repos.circuits.getPromesaEnInstante(circuitId, ahora, "ida", zona);
  const promesaVigente = declarada.declarada
    ? referenciaDe(ahora, declarada.frequencyMinutes, circuito.arrivalTolerancePct)
    : null;

  const ritmo = await derivarRitmo({
    repos,
    circuito,
    paradas,
    pasosPorParada,
    apertura,
    ahora,
    enHorario,
    yaArranco,
    flujo,
  });

  return {
    alcance,
    ahora,
    yaArranco,
    enHorario,
    apertura,
    flujo,
    promesaVigente,
    detectorVersion: VERSION_DEL_DETECTOR,
    unidades,
    esperas,
    sostenimiento,
    ritmo,
  };
}

interface PasoVisible {
  stopId: string;
  unitId: string;
  sentido: Sentido;
  pasoDesde: Date;
  pasoHasta: Date;
}

type Circuito = NonNullable<
  Awaited<ReturnType<Repositories["circuits"]["getCircuitVisibleParaCuenta"]>>
>;
type Parada = Awaited<ReturnType<Repositories["circuits"]["listStopsVigentes"]>>[number];

/**
 * El ancla de un paso: **el fin del rango del paso ANTERIOR en esa parada y ese
 * sentido** — el que le precede, sea de la unidad que sea, porque lo que la
 * promesa promete es la frecuencia de paso y no la vuelta de nadie (9.1). Si es
 * el primero del día, la apertura declarada.
 *
 * Es exactamente la regla que ya usa `compararPaso`, y se reusa su forma para
 * que las dos caras no midan distinto el mismo camión.
 */
function anclaDe(pasos: PasoVisible[], indice: number, apertura: Date): Date {
  const anterior = pasos[indice - 1];
  return anterior ? anterior.pasoHasta : apertura;
}

/**
 * Para qué lado va cada unidad, según su paso más reciente.
 *
 * **Sale de los pasos crudos y no de los medidos**, y por eso sobrevive a la
 * compuerta del 9.14: saber que un camión propio va de vuelta no es un
 * veredicto sobre el servicio, es de dónde está. Con la compuerta cerrada los
 * medidos van vacíos, y sin esto la torre dibujaba de «ida» a un camión que
 * venía de regreso — dato correcto, lado equivocado.
 */
function sentidoDeCadaUnidad(pasosPorParada: Map<string, PasoVisible[]>): Map<string, Sentido> {
  const ultimo = new Map<string, PasoVisible>();
  for (const pasos of pasosPorParada.values()) {
    for (const paso of pasos) {
      const previo = ultimo.get(paso.unitId);
      if (!previo || paso.pasoDesde > previo.pasoDesde) ultimo.set(paso.unitId, paso);
    }
  }
  return new Map([...ultimo].map(([unitId, paso]) => [unitId, paso.sentido]));
}

function derivarUnidades(e: {
  circuito: Circuito;
  plan: Awaited<ReturnType<Repositories["circuits"]["planDelCircuitoParaCuenta"]>>;
  trazados: TrazadoDeSentido[];
  medidos: PasoMedido[];
  sentidoDe: Map<string, Sentido>;
  ahora: Date;
  enHorario: boolean;
  yaArranco: boolean;
  flujo: FlujoDelServicio;
}): UnidadEnLaTorre[] {
  const contexto = {
    ahora: e.ahora,
    trazados: e.trazados,
    corredorMetros: e.circuito.corridorToleranceMeters,
    frescuraSegundos: e.circuito.staleAfterSeconds,
    confianzaSegundos: e.circuito.serviceConfidenceMinutes * 60,
  };

  // Los pasos de cada unidad, en orden de tiempo. `medidos` ya viene ordenado.
  const porUnidad = new Map<string, PasoMedido[]>();
  for (const paso of e.medidos) {
    porUnidad.set(paso.unitId, [...(porUnidad.get(paso.unitId) ?? []), paso]);
  }

  return e.plan.unidades.map((u): UnidadEnLaTorre => {
    const punto =
      u.latitude !== null && u.longitude !== null && u.recordedAt !== null
        ? { lat: u.latitude, lon: u.longitude, recordedAt: u.recordedAt }
        : null;
    const medida = punto ? medirUnidad(punto, contexto) : null;
    const situacion = situacionDe(medida, e.enHorario, e.yaArranco);
    const suyos = porUnidad.get(u.unitId) ?? [];
    const ultimo = suyos[suyos.length - 1] ?? null;

    return {
      unitId: u.unitId,
      unitLabel: u.unitLabel,
      situacion,
      medida,
      ultimaPosicion: punto && medida ? { ...punto, antiguedadSeg: medida.antiguedadSeg } : null,
      velocidadKmh: u.speed ?? null,
      rumboGrados: u.heading ?? null,
      sobreElCorredor: punto
        ? proyectarPunto(punto, e.sentidoDe.get(u.unitId) ?? ultimo?.sentido, e.trazados)
        : null,
      promesa: resolverPromesa(situacion, e.flujo, ultimo),
      ultimosPasos: losUltimos(suyos),
    };
  });
}


function proyectarPunto(
  punto: { lat: number; lon: number },
  sentido: Sentido | undefined,
  trazados: TrazadoDeSentido[],
): UnidadEnLaTorre["sobreElCorredor"] {
  /*
   * Se proyecta sobre el trazado de SU sentido cuando se sabe cuál es —lo dice
   * su último paso medido, que es evidencia y no una inferencia del rumbo—; si
   * no se sabe, se toma el trazado que la vea más cerca. Nunca se mezclan: cada
   * sentido tiene su propio trazado y su propio avance, y sumar avances de dos
   * trazados distintos da un número que no significa nada.
   */
  const candidatos = sentido ? trazados.filter((t) => t.sentido === sentido) : trazados;
  let mejor: UnidadEnLaTorre["sobreElCorredor"] = null;
  for (const t of candidatos.length > 0 ? candidatos : trazados) {
    const p = proyectarSobreTrazado(punto, t.coordinates);
    if (!p) continue;
    if (!mejor || p.distanciaMetros < mejor.distanciaMetros) {
      mejor = { sentido: t.sentido, avanceMetros: p.avanceMetros, distanciaMetros: p.distanciaMetros };
    }
  }
  return mejor;
}

/**
 * La promesa de una unidad: **el veredicto de su paso más reciente**, ya
 * calculado en la pasada única. Aquí no se mide nada — sólo se decide si ese
 * veredicto viene al caso, y con qué motivo cuando no hay.
 */
function resolverPromesa(
  situacion: Situacion,
  flujo: FlujoDelServicio,
  ultimo: PasoMedido | null,
): PromesaDeUnidad {
  const vacia = { intervalo: null, referencia: null, medidoEn: null };

  // No está en la calle: la pregunta no viene al caso.
  if (!estaEnLaCalle(situacion)) return { estado: "no_aplica", motivo: null, ...vacia };
  // 9.14: SIN DATOS antes que un número prestado.
  if (flujo === "incompleto") return { estado: "sin_datos", motivo: "flujo_incompleto", ...vacia };
  if (!ultimo) return { estado: "sin_datos", motivo: "sin_pasos", ...vacia };

  return {
    estado: ultimo.estado,
    motivo: ultimo.motivo,
    intervalo: ultimo.intervalo,
    referencia: ultimo.referencia,
    medidoEn: {
      stopId: ultimo.stopId,
      sentido: ultimo.sentido,
      pasoDesde: ultimo.pasoDesde,
      pasoHasta: ultimo.pasoHasta,
    },
  };
}


/** Los sentidos que sirve una parada. `null` en la base significa que sirve los dos. */
function sentidosDe(parada: Parada): Sentido[] {
  return parada.sentido ? [parada.sentido as Sentido] : SENTIDOS;
}

async function derivarEsperas(e: {
  repos: Repositories;
  circuito: Circuito;
  paradas: Parada[];
  pasosPorParada: Map<string, PasoVisible[]>;
  medidos: PasoMedido[];
  apertura: Date;
  ahora: Date;
  enHorario: boolean;
  yaArranco: boolean;
  flujo: FlujoDelServicio;
}): Promise<EsperaDeParada[]> {
  const salida: EsperaDeParada[] = [];

  for (const parada of e.paradas) {
    for (const sentido of sentidosDe(parada)) {
      const base = {
        stopId: parada.stopId,
        nombre: parada.name,
        sentido,
        ultimasPasadas: losUltimos(
          e.medidos.filter((m) => m.stopId === parada.stopId && m.sentido === sentido),
        ),
      };

      /*
       * Con el circuito cerrado o sin arrancar no se afirma nada de nadie: una
       * espera que crece toda la noche acusaría al carrier de no dar un
       * servicio que no prometió.
       */
      if (!e.yaArranco || !e.enHorario) {
        salida.push({
          ...base,
          minutos: null,
          desdeLaApertura: false,
          ultimaPasada: null,
          referencia: null,
          estado: "no_aplica",
          motivo: null,
        });
        continue;
      }

      if (e.flujo === "incompleto") {
        salida.push({
          ...base,
          minutos: null,
          desdeLaApertura: false,
          ultimaPasada: null,
          referencia: null,
          estado: "sin_datos",
          motivo: "flujo_incompleto",
        });
        continue;
      }

      const pasos = (e.pasosPorParada.get(parada.stopId) ?? []).filter((p) => p.sentido === sentido);
      const ultima = pasos.length > 0 ? pasos[pasos.length - 1]!.pasoHasta : null;
      /*
       * Sin nadie que haya pasado hoy, el ancla es la apertura declarada — y
       * eso es justo lo que 9.2d describe: la parada puede declarar que la
       * promesa se está rompiendo SIN que ninguna unidad haya hecho nada.
       */
      const ancla = ultima ?? e.apertura;

      const promesa = await e.repos.circuits.getPromesaEnInstante(
        e.circuito.id,
        e.ahora,
        sentido,
        e.circuito.timeZone,
      );
      if (!promesa.declarada) {
        salida.push({
          ...base,
          minutos: minutosEntre(ancla, e.ahora),
          desdeLaApertura: ultima === null,
          ultimaPasada: ultima,
          referencia: null,
          estado: "sin_datos",
          motivo: "sin_promesa",
        });
        continue;
      }

      const referencia = referenciaDe(ancla, promesa.frequencyMinutes, e.circuito.arrivalTolerancePct);
      const minutos = minutosEntre(ancla, e.ahora);

      /*
       * Un intervalo ABIERTO sólo puede crecer, así que sólo tiene dos
       * respuestas: cabe todavía, o ya se pasó de la orilla de arriba. Por
       * debajo de la orilla de abajo no es «adelantada» — es que no toca aún, y
       * llamarle adelanto convertiría en mérito el no haber pasado.
       */
      salida.push({
        ...base,
        minutos,
        desdeLaApertura: ultima === null,
        ultimaPasada: ultima,
        referencia,
        estado: minutos > referencia.hastaMin ? "atrasada" : "en_rango",
        motivo: null,
      });
    }
  }

  return salida;
}

/**
 * Mide TODOS los pasos visibles de hoy contra su banda — **una sola pasada, y
 * de ella sale todo lo que la torre deriva de pasos.**
 *
 * El estado de una unidad es el veredicto de su paso más reciente; el
 * sostenimiento es cuántos de éstos cayeron en rango; el detalle son los
 * últimos de una unidad o de una parada. Los tres salen de este arreglo, y por
 * eso no se pueden contradecir entre sí.
 *
 * El ancla de cada paso es **el fin del rango del paso anterior en esa parada y
 * ese sentido** —el que le precede, sea de la unidad que sea, porque lo que la
 * promesa promete es la frecuencia de paso y no la vuelta de nadie (9.1,
 * ratificado por ASAV el 21-sep)—; si es el primero del día, la apertura
 * declarada. Es la misma regla de `compararPaso`, con su forma reusada.
 */
async function medirTodosLosPasos(e: {
  repos: Repositories;
  circuito: Circuito;
  paradas: Parada[];
  pasosPorParada: Map<string, PasoVisible[]>;
  apertura: Date;
  flujo: FlujoDelServicio;
}): Promise<PasoMedido[]> {
  /*
   * Con el flujo incompleto no se mide NADA de pasos: sobre las filas de un
   * solo carrier, «el paso anterior» se salta a los demás y produce un ATRASADA
   * falso. Devolver el arreglo vacío es lo que hace que las tres cifras de
   * arriba salgan en SIN DATOS a la vez, sin que ninguna se escape (9.14).
   */
  if (e.flujo === "incompleto") return [];

  const nombreDe = new Map(e.paradas.map((p) => [p.stopId, p.name]));
  const medidos: PasoMedido[] = [];

  for (const parada of e.paradas) {
    const pasos = e.pasosPorParada.get(parada.stopId) ?? [];
    for (const sentido of SENTIDOS) {
      const delSentido = pasos.filter((p) => p.sentido === sentido);
      for (const [i, paso] of delSentido.entries()) {
        const ancla = anclaDe(delSentido, i, e.apertura);
        const intervalo = {
          desdeMin: minutosEntre(ancla, paso.pasoDesde),
          hastaMin: minutosEntre(ancla, paso.pasoHasta),
        };
        const base = {
          stopId: paso.stopId,
          nombreDeLaParada: nombreDe.get(paso.stopId) ?? "",
          unitId: paso.unitId,
          sentido,
          pasoDesde: paso.pasoDesde,
          pasoHasta: paso.pasoHasta,
          intervalo,
        };

        const promesa = await e.repos.circuits.getPromesaEnInstante(
          e.circuito.id,
          paso.pasoDesde,
          sentido,
          e.circuito.timeZone,
        );
        if (!promesa.declarada) {
          medidos.push({ ...base, referencia: null, estado: "sin_datos", motivo: "sin_promesa" });
          continue;
        }

        const referencia = referenciaDe(ancla, promesa.frequencyMinutes, e.circuito.arrivalTolerancePct);
        const ventana = ventanaEsperada(ancla, promesa.frequencyMinutes, e.circuito.arrivalTolerancePct);
        /*
         * Aquí, y en ningún otro lado, se traduce del motor a la pantalla
         * (9.3b). «antes» es intervalo más CORTO que la banda: el camión llegó
         * pisándole los talones al anterior — ADELANTADA. «despues» es más
         * largo — ATRASADA.
         */
        const lado = ladoDeLaBanda(paso, ventana);
        medidos.push({
          ...base,
          referencia,
          estado:
            lado === "dentro"
              ? "en_rango"
              : lado === "antes"
                ? "adelantada"
                : lado === "despues"
                  ? "atrasada"
                  : "sin_datos",
          motivo: lado === "a_caballo" ? "a_caballo" : null,
        });
      }
    }
  }

  return medidos.sort((a, b) => a.pasoDesde.getTime() - b.pasoDesde.getTime());
}

/** Cuántos pasos se enseñan en el detalle. Tres caben sin hacer scroll y bastan para ver la tendencia. */
const PASOS_EN_EL_DETALLE = 3;

/** Los últimos `n` de una lista ya ordenada por tiempo, del más reciente al más viejo. */
function losUltimos<T>(lista: T[], n = PASOS_EN_EL_DETALLE): T[] {
  return lista.slice(-n).reverse();
}

/**
 * Cuántos de los pasos medidos cayeron en rango — **conteo, no juicio**: «12 de
 * 16» no dice si eso está bien.
 *
 * Un paso sin promesa declarada no suma ni al numerador ni al denominador: uno
 * que nadie pudo juzgar no es uno que falló. Y uno a caballo de la orilla sí
 * cuenta como medido, porque se midió — sólo que no concluyó.
 */
function contarSostenimiento(medidos: PasoMedido[]): { enRango: number; medidos: number } | null {
  const conBanda = medidos.filter((p) => p.referencia !== null);
  if (conBanda.length === 0) return null;
  return {
    enRango: conBanda.filter((p) => p.estado === "en_rango").length,
    medidos: conBanda.length,
  };
}


async function derivarRitmo(e: {
  repos: Repositories;
  circuito: Circuito;
  paradas: Parada[];
  pasosPorParada: Map<string, PasoVisible[]>;
  apertura: Date;
  ahora: Date;
  enHorario: boolean;
  yaArranco: boolean;
  flujo: FlujoDelServicio;
}): Promise<RitmoEnLaTorre> {
  if (!e.yaArranco || !e.enHorario) return { disponible: false, motivo: "fuera_de_horario" };
  if (e.flujo === "incompleto") return { disponible: false, motivo: "flujo_incompleto" };

  /*
   * El ritmo se dibuja por sentido. Se arma el de «ida», que es el que la torre
   * enseña primero; el otro sentido es una repetición de esto mismo y entra
   * cuando la pantalla lo pida, no antes.
   */
  const sentido: Sentido = "ida";
  const promesa = await e.repos.circuits.getPromesaEnInstante(
    e.circuito.id,
    e.ahora,
    sentido,
    e.circuito.timeZone,
  );
  if (!promesa.declarada) return { disponible: false, motivo: "sin_promesa" };

  const enOrden = e.paradas
    .filter((p) => p.sentido === null || p.sentido === sentido)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => p.stopId);

  /*
   * Los tránsitos medidos entre paradas contiguas: la MISMA unidad pasando por
   * A y después por B, sin haber pasado por B en medio. Es tiempo medido, no
   * supuesto — y es lo único con lo que 9.2e permite colocar la referencia.
   */
  const tramos = tramosMedidos(enOrden, e.pasosPorParada, sentido);
  const perfil = perfilDeLaVuelta(enOrden, tramos);
  if (!perfil.medido) {
    return { disponible: false, motivo: perfil.motivo, tramosSinMedir: perfil.tramosSinMedir };
  }

  const referencias: ReferenciaDeRitmo[] = colocarRitmoPrometido({
    perfil,
    frequencyMinutes: promesa.frequencyMinutes,
    minutosDesdeAperturaDeLaFranja: minutosEntre(e.apertura, e.ahora),
  });

  return {
    disponible: true,
    sentido,
    vueltaMinutos: perfil.vueltaMinutos,
    // La vuelta se conoce tan bien como su tramo peor medido: decir «8 vueltas»
    // cuando un tramo se midió una sola vez sería prestarle al perfil una
    // firmeza que no tiene.
    vueltasMedidas: tramos.length === 0 ? 0 : Math.min(...tramos.map((t) => t.minutos.length)),
    referencias,
  };
}

function tramosMedidos(
  enOrden: string[],
  pasosPorParada: Map<string, PasoVisible[]>,
  sentido: Sentido,
): TramoMedido[] {
  // Todos los pasos del sentido, por unidad y en orden de tiempo.
  const porUnidad = new Map<string, PasoVisible[]>();
  for (const stopId of enOrden) {
    for (const paso of pasosPorParada.get(stopId) ?? []) {
      if (paso.sentido !== sentido) continue;
      const lista = porUnidad.get(paso.unitId) ?? [];
      lista.push(paso);
      porUnidad.set(paso.unitId, lista);
    }
  }

  const muestras = new Map<string, number[]>();
  for (const lista of porUnidad.values()) {
    lista.sort((a, b) => a.pasoDesde.getTime() - b.pasoDesde.getTime());
    for (let i = 1; i < lista.length; i++) {
      const de = lista[i - 1]!;
      const a = lista[i]!;
      if (de.stopId === a.stopId) continue; // dos pasos por la misma parada: es una vuelta, no un tramo
      const clave = `${de.stopId}→${a.stopId}`;
      /*
       * Se toma el centro de cada rango para medir el tránsito. El paso es un
       * rango y esto es una resta entre dos rangos; el centro es la única
       * elección que no favorece sistemáticamente a un lado, y la mediana de
       * varias muestras absorbe lo que le quede de ruido.
       */
      const centro = (p: PasoVisible) => (p.pasoDesde.getTime() + p.pasoHasta.getTime()) / 2;
      const minutos = (centro(a) - centro(de)) / MS_POR_MINUTO;
      if (minutos <= 0) continue;
      muestras.set(clave, [...(muestras.get(clave) ?? []), minutos]);
    }
  }

  return [...muestras.entries()].map(([clave, minutos]) => {
    const [deStopId, aStopId] = clave.split("→");
    return { deStopId: deStopId!, aStopId: aStopId!, minutos };
  });
}
