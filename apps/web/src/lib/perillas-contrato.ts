/**
 * Las perillas del contrato, dichas en español de operación.
 *
 * Este catálogo existe porque la pantalla anterior mostraba dieciocho campos
 * con nombres como "Umbral match KML — métrica A (%)" y "Gracia de
 * verificación", en una rejilla de tres columnas y sin una sola consecuencia
 * escrita. Un cliente nuevo se paralizaba, y un valor mal puesto aquí no da
 * error: da veredictos falsos, sellados y creíbles.
 *
 * Por eso cada perilla declara CUATRO cosas y ninguna es opcional:
 *
 *   nombre       cómo se llama en la vida real, sin jerga del motor
 *   queHace      qué mide o qué decide, en una frase
 *   siLaSubes /  hacia dónde se mueve el resultado. La dirección importa más
 *   siLaBajas    que el número: es lo que nadie puede deducir del nombre.
 *   decide       si el resultado depende de ella, o si solo organiza
 *
 * `decide` es la distinción que salva: no todas pesan igual. Cambiar la
 * tolerancia mueve veredictos; cambiar la duración máxima de ruta solo cambia
 * cómo se reparten unidades entre servicios que compiten. La pantalla lo dice
 * para que el usuario sepa cuándo está tocando el árbitro.
 *
 * NINGUNA perilla de este archivo es inventada: todas existen en
 * `contractPolicySchema` de @jtel/domain y todas las lee alguien. Las llaves
 * son las del esquema, así que un cambio allá rompe aquí en compilación y no
 * en silencio.
 */

import type { ContractPolicy } from "@jtel/domain";

/**
 * Quién lee la perilla. No es trivia técnica: le dice al usuario si está
 * tocando el árbitro o la mesa de trabajo.
 */
export type QuienDecide =
  /** El árbitro la usa para decidir el resultado del servicio. */
  | "arbitro"
  /** Define qué pedazo de telemetría se mira. Cambia lo que el árbitro ve. */
  | "ventana"
  /** Organiza la operación: qué servicios compiten, cuándo cierra el turno. */
  | "operacion"
  /** Solo tiene efectos económicos. El resultado sellado no cambia. */
  | "consecuencia";

export type GrupoPerilla =
  | "tiempo"
  | "ventana"
  | "ruta"
  | "evidencia"
  | "perdon"
  | "dinero";

export type FormaPerilla =
  | { tipo: "entero"; min?: number; max?: number; unidad: string }
  | { tipo: "porcentaje" }
  | { tipo: "fraccion" }
  | { tipo: "booleano" }
  | { tipo: "opciones"; opciones: Array<{ valor: string; etiqueta: string; explica: string }> }
  | { tipo: "zona" }
  | { tipo: "motivos" }
  | { tipo: "enforcement" };

export type Perilla = {
  /** La llave real en la política. Si el esquema cambia, esto no compila. */
  llave: keyof ContractPolicy;
  nombre: string;
  queHace: string;
  siLaSubes: string;
  siLaBajas: string;
  /**
   * El modo de falla concreto. Solo lo llevan las perillas donde equivocarse
   * produce veredictos falsos en vez de una molestia — no se pone en todas,
   * porque una advertencia en cada campo no advierte de nada.
   */
  riesgo?: string;
  decide: QuienDecide;
  grupo: GrupoPerilla;
  forma: FormaPerilla;
  /** Lo que el esquema pone si nadie la toca. */
  porDefecto: string;
  /** Opcional en el esquema: se puede dejar sin configurar. */
  opcional?: boolean;
};

export const GRUPOS: Record<
  GrupoPerilla,
  { titulo: string; pregunta: string; entrada: string }
> = {
  tiempo: {
    titulo: "El tiempo",
    pregunta: "¿A qué hora hay que estar, y cuánto se espera?",
    entrada:
      "Estas cuatro reglas arman una sola figura — la ventana del turno. Se dibuja arriba con las llegadas reales encima, porque es la única forma de ver si la hora que se declaró es la hora a la que de verdad se opera.",
  },
  ventana: {
    titulo: "Cuánto se abre la ventana",
    pregunta: "¿Cuánto antes hay que empezar a mirar para ver la ruta completa?",
    entrada:
      "El ancho de la ventana ya no es un número que alguien escribió: el sistema lo aprende de cuánto dura de verdad cada ruta. Estas perillas no fijan el ancho — gobiernan cómo se aprende. El margen de arriba pasa a ser el piso: la ventana puede abrirse más, nunca menos.",
  },
  ruta: {
    titulo: "El camino",
    pregunta: "¿Por dónde tiene que ir para que cuente?",
    entrada:
      "Qué tanto del trazado contratado hay que recorrer, y qué tan pegado. Subir estos números no hace mejor al transportista: hace que más servicios buenos se caigan por precisión de GPS.",
  },
  evidencia: {
    titulo: "Cuándo el sistema se calla",
    pregunta: "¿Cuánta señal hace falta para poder afirmar algo?",
    entrada:
      "Debajo de estos mínimos el sistema NO dicta un no cumplido: dicta pendiente por evidencia. Sin evidencia no hay falta — es lo que hace creíble al árbitro frente al transportista, y aflojarlo demasiado es lo que lo vuelve acusador.",
  },
  perdon: {
    titulo: "Lo que se perdona",
    pregunta: "¿Qué causas acepta este contrato como excusa?",
    entrada:
      "El transportista reporta el motivo y la planta decide. Marcar un motivo no perdona nada por sí solo: habilita que se pueda invocar.",
  },
  dinero: {
    titulo: "La consecuencia",
    pregunta: "¿Qué cuesta un incumplimiento?",
    entrada:
      "Esto NO cambia ningún resultado: el servicio se verifica y se sella igual. Solo define qué efecto económico se muestra sobre un resultado que ya existe.",
  },
};

export const PERILLAS: Perilla[] = [
  // ── El tiempo ────────────────────────────────────────────────────────────
  {
    llave: "arrivalAnticipationMinutes",
    nombre: "Cuánto antes del turno debe estar en planta",
    queHace:
      "Fija la hora límite de llegada. Se resta de la hora de entrada del turno: turno de 07:00 con 15 minutos da una hora límite de 06:45.",
    siLaSubes: "La hora límite se adelanta y llegar a tiempo cuesta más.",
    siLaBajas: "La hora límite se recorre hacia el turno y se vuelve más fácil cumplir.",
    riesgo:
      "Es la perilla que fija el instante contra el que se juzga TODO. Si la hora del turno está mal declarada, este número no lo corrige: multiplica el error a cada servicio del turno.",
    decide: "arbitro",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 240, unidad: "min antes del turno" },
    porDefecto: "15 min",
  },
  {
    llave: "toleranceMinutes",
    nombre: "Cuántos minutos tarde siguen contando como a tiempo",
    queHace:
      "El colchón después de la hora límite. Llegar dentro de él sigue siendo cumplido y a tiempo.",
    siLaSubes: "Más llegadas tarde quedan dentro y se marcan a tiempo.",
    siLaBajas: "Más llegadas se marcan tarde. Siguen siendo cumplidas — tarde es un motivo, no un resultado.",
    decide: "arbitro",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 120, unidad: "min" },
    porDefecto: "0 min",
  },
  {
    llave: "verificationGraceMinutes",
    nombre: "Cuánto se sigue esperando antes de verificar",
    queHace:
      "Después de la hora límite el sistema aguanta este rato antes de emitir el resultado, y sigue mirando la telemetría mientras tanto.",
    siLaSubes: "El resultado tarda más en salir, pero una llegada rezagada alcanza a registrarse.",
    siLaBajas:
      "El resultado sale antes. Una unidad que venía en camino puede quedar sin su llegada registrada.",
    decide: "ventana",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 180, unidad: "min" },
    porDefecto: "15 min",
  },
  {
    llave: "shiftCloseMinutesAfterStart",
    nombre: "A qué hora se sella el turno completo",
    queHace:
      "Se cuenta desde la hora de entrada del turno: 07:00 con 120 minutos sella a las 09:00. Una unidad que llega después no retrasa el cierre — el turno se sella igual y ese servicio carga su propio resultado.",
    siLaSubes: "El turno cierra más tarde y el resumen del día tarda en estar completo.",
    siLaBajas: "El turno cierra antes.",
    decide: "operacion",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 1440, unidad: "min después del turno" },
    porDefecto: "sin configurar",
    opcional: true,
  },
  {
    llave: "timeZone",
    nombre: "El reloj de este contrato",
    queHace:
      "Todas las horas del contrato —la del turno, la hora límite, la llegada— son horas de este reloj. No es una preferencia de cómo se ve: es con qué reloj se convierte la hora del turno en un instante real.",
    siLaSubes: "",
    siLaBajas: "",
    riesgo:
      "Cambiarla mueve la hora límite de todos los servicios futuros de este contrato. Una zona equivocada corre la hora límite horas enteras, y el resultado se sella con esa hora sin que nada se vea roto.",
    decide: "arbitro",
    grupo: "tiempo",
    forma: { tipo: "zona" },
    porDefecto: "America/Ciudad_Juarez",
  },
  {
    llave: "evidenceMarginMinutesBefore",
    nombre: "Lo mínimo que se abre la ventana hacia atrás",
    queHace:
      "El piso del ancho de la ventana. Ya no es el ancho: el sistema lo dimensiona por ruta según lo que dura de verdad, y este número es el mínimo del que nunca baja. La ventana puede abrirse más, nunca menos.",
    siLaSubes: "Sube el mínimo para todas las rutas, incluso las cortas.",
    siLaBajas:
      "Baja el piso. Las rutas con historia medida no se ven afectadas —su ancho lo pone la duración—, pero una ruta sin trazado ni historia se queda con este número.",
    decide: "ventana",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 480, unidad: "min antes" },
    porDefecto: "60 min",
  },
  {
    llave: "evidenceMarginMinutesAfter",
    nombre: "Cuánto después se sigue mirando la telemetría",
    queHace:
      "Cierra la ventana de observación después de la espera. La ventana completa va de la hora límite menos el margen de antes, hasta la hora límite más la espera más este margen.",
    siLaSubes: "Se observa más rato después de la llegada.",
    siLaBajas: "La ventana cierra antes.",
    decide: "ventana",
    grupo: "tiempo",
    forma: { tipo: "entero", min: 0, max: 480, unidad: "min después" },
    porDefecto: "30 min",
  },

  // ── Cuánto se abre la ventana ────────────────────────────────────────────
  {
    llave: "windowDerivationEnabled",
    nombre: "Aprender el ancho de la ventana de cada ruta",
    queHace:
      "Encendido, el sistema dimensiona la ventana con lo que dura de verdad ese recorrido. Apagado, todas las rutas usan el mismo margen fijo de arriba, dure lo que dure cada una.",
    siLaSubes: "",
    siLaBajas: "",
    riesgo:
      "Apagarlo devuelve el problema que esto vino a resolver: una ruta que dura 96 minutos con una ventana de 60 arranca con el sistema ciego, y después se le califica el trazado completo — incluido el tramo que nunca se miró.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "booleano" },
    porDefecto: "Encendido — la ventana se aprende por ruta",
  },
  {
    llave: "windowSlackPct",
    nombre: "Holgura sobre la duración de la ruta",
    queHace:
      "Cuánto se le suma a la duración aprendida al dimensionar la ventana. Con 25%, una ruta de 100 minutos abre la ventana 125 minutos antes.",
    siLaSubes: "Ventana más ancha: se cubre el día malo, y se mira más telemetría por servicio.",
    siLaBajas: "Ventana más ajustada. Un día más lento de lo normal vuelve a arrancar sin observar.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "porcentaje" },
    porDefecto: "25.0%",
  },
  {
    llave: "routeDurationPercentile",
    nombre: "Qué tan lento es el día que la ventana debe cubrir",
    queHace:
      "De todas las duraciones ya medidas de esa ruta, cuál se toma. Con 90 se toma una de las más lentas; con 50 se tomaría la típica.",
    siLaSubes: "La ventana cubre los días lentos.",
    siLaBajas:
      "La ventana se dimensiona para el día típico — y la mitad de los días vuelve a haber arranque sin observar.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "entero", min: 1, max: 100, unidad: "percentil" },
    porDefecto: "90",
  },
  {
    llave: "routeDurationMinSamples",
    nombre: "Cuántas mediciones hacen falta para creerle a la historia",
    queHace:
      "Por debajo de este número de recorridos medidos, la historia de la ruta no se usa y la ventana se dimensiona con la geometría del trazado.",
    siLaSubes: "Se exige más historia antes de confiar en ella. Las rutas nuevas tardan más en aprenderse.",
    siLaBajas: "Se le cree a la ruta con pocos recorridos, y un par de días raros dimensionan la ventana.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "entero", min: 1, max: 100, unidad: "mediciones" },
    porDefecto: "3",
  },
  {
    llave: "routeAvgSpeedKmh",
    nombre: "Velocidad con la que se estima una ruta sin historia",
    queHace:
      "Mientras una ruta no tiene mediciones suficientes, su duración se estima con el largo del trazado a esta velocidad. Es recolección de personal con paradas, no carretera.",
    siLaSubes: "Se estiman recorridos más cortos y la ventana de las rutas nuevas nace más angosta.",
    siLaBajas: "Se estiman recorridos más largos y la ventana nace más holgada.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "entero", min: 1, max: 120, unidad: "km/h" },
    porDefecto: "20 km/h",
  },
  {
    llave: "maxWindowBeforeMinutes",
    nombre: "Tope del ancho de la ventana",
    queHace:
      "El ancho máximo que puede alcanzar la ventana por más que la duración lo pida. Existe para que una medición absurda no abra una ventana de horas.",
    siLaSubes: "Se permiten ventanas más anchas para rutas realmente largas.",
    siLaBajas:
      "Se recorta el ancho aunque la ruta lo necesite, y las rutas largas vuelven a arrancar sin observar.",
    decide: "ventana",
    grupo: "ventana",
    forma: { tipo: "entero", min: 1, max: 1440, unidad: "min" },
    porDefecto: "360 min",
  },

  // ── El camino ────────────────────────────────────────────────────────────
  {
    llave: "routeStrictness",
    nombre: "Qué hay que cumplir del recorrido",
    queHace:
      "Decide si basta con llegar al destino, o si además hay que haber recorrido la ruta contratada.",
    siLaSubes: "",
    siLaBajas: "",
    decide: "arbitro",
    grupo: "ruta",
    forma: {
      tipo: "opciones",
      opciones: [
        {
          valor: "destino_only",
          etiqueta: "Basta con llegar al destino",
          explica:
            "Solo se verifica la llegada a la geocerca y la hora. Por dónde pasó no se juzga. Es lo correcto cuando todavía no hay trazado cargado.",
        },
        {
          valor: "kml_full",
          etiqueta: "Además debe seguir la ruta contratada",
          explica:
            "Se exige llegar Y haber recorrido el trazado, con los dos umbrales de abajo. Requiere que la ruta tenga trazado cargado.",
        },
      ],
    },
    porDefecto: "Basta con llegar al destino",
  },
  {
    llave: "kmlMatchMinPct",
    nombre: "Cuánto de la ruta contratada hay que haber recorrido",
    queHace:
      "De todos los puntos del trazado contratado, qué porcentaje tuvo que ser pisado por la unidad para dar el recorrido por bueno.",
    siLaSubes: "Se exige recorrer más ruta. Un desvío legítimo por obra empieza a tumbar servicios.",
    siLaBajas: "Se acepta haber recorrido menos ruta. Una unidad que se saltó media ruta puede pasar.",
    decide: "arbitro",
    grupo: "ruta",
    forma: { tipo: "porcentaje" },
    porDefecto: "60.0%",
  },
  {
    llave: "kmlCorridorMinPct",
    nombre: "Qué tan pegada a la ruta tuvo que ir",
    queHace:
      "De todos los puntos que reportó la unidad, qué porcentaje tuvo que caer dentro del corredor de la ruta.",
    siLaSubes:
      "Se castiga cualquier rodeo. Cuidado: también castiga a la unidad que hizo la ruta bien y además anduvo en otra cosa dentro de la ventana.",
    siLaBajas: "Se tolera que parte del recorrido haya sido fuera de la ruta.",
    decide: "arbitro",
    grupo: "ruta",
    forma: { tipo: "porcentaje" },
    porDefecto: "60.0%",
  },
  {
    llave: "kmlCorridorMeters",
    nombre: "Qué tan ancho es el corredor de la ruta",
    queHace:
      "La distancia máxima entre el GPS y el trazado para considerar que la unidad iba sobre la ruta. Es el ancho del pasillo que definen los dos porcentajes de arriba.",
    siLaSubes: "Pasillo más ancho: se perdona el GPS impreciso, pero también una calle paralela.",
    siLaBajas:
      "Pasillo más angosto: se exige precisión que el GPS de la unidad puede no tener, y servicios buenos empiezan a fallar por deriva del equipo.",
    decide: "arbitro",
    grupo: "ruta",
    forma: { tipo: "entero", min: 10, max: 500, unidad: "m" },
    porDefecto: "120 m",
  },
  {
    llave: "kmlOriginToleranceFraction",
    nombre: "Cuánto del arranque de la ruta puede faltar",
    queHace:
      "Si el primer punto útil aparece más allá de esta parte inicial de la ruta, el sistema considera que no vio el arranque y se abstiene: el servicio queda pendiente por evidencia, nunca no cumplido.",
    siLaSubes: "Se acepta empezar a ver la ruta más tarde. Más servicios se juzgan con menos recorrido visto.",
    siLaBajas: "Se exige ver el arranque casi completo. Más servicios quedan pendientes por evidencia.",
    riesgo:
      "Es la regla que impide convertir un problema de observación en una falta del transportista. Subirla mucho hace que el sistema juzgue recorridos que en realidad no vio.",
    decide: "arbitro",
    grupo: "ruta",
    forma: { tipo: "fraccion" },
    porDefecto: "15% inicial de la ruta",
  },
  {
    llave: "maxRouteDurationMinutes",
    nombre: "Cuánto dura, cuando mucho, un recorrido",
    queHace:
      "Sirve para saber qué servicios se pisan entre sí: dos servicios cuyos tiempos se traslapan compiten por la misma unidad y no se les puede acreditar a las dos.",
    siLaSubes: "Más servicios del día se consideran en competencia por la misma unidad.",
    siLaBajas: "Menos servicios compiten, y dos viajes de la misma mañana pueden acreditarse por separado.",
    decide: "operacion",
    grupo: "ruta",
    forma: { tipo: "entero", min: 1, max: 720, unidad: "min" },
    porDefecto: "60 min",
  },
  {
    llave: "permitirConsolidacion",
    nombre: "Una misma unidad puede cubrir varias rutas del turno",
    queHace:
      "Apagado, cada ruta necesita su propia unidad. Encendido, una unidad puede acreditar varias rutas del mismo turno — el recorrido mínimo de cada ruta se sigue exigiendo igual.",
    siLaSubes: "",
    siLaBajas: "",
    decide: "operacion",
    grupo: "ruta",
    forma: { tipo: "booleano" },
    porDefecto: "Apagado — cada ruta con su unidad",
  },

  // ── Cuándo el sistema se calla ───────────────────────────────────────────
  {
    llave: "evidenceMinCoveragePct",
    nombre: "Cuánta señal hace falta para poder dictar",
    queHace:
      "Qué porcentaje de la ventana tuvo que tener telemetría para que el sistema se atreva a emitir un resultado. Debajo de esto se abstiene.",
    siLaSubes:
      "El sistema se abstiene más seguido: más pendientes por evidencia, menos afirmaciones sobre datos flacos.",
    siLaBajas:
      "El sistema se atreve con menos señal. Aquí es donde un árbitro empieza a dictar faltas que no puede sostener.",
    riesgo:
      "Bajarla convierte huecos de GPS en incumplimientos. Sin evidencia no hay falta: eso es lo que vuelve creíble el veredicto frente al transportista.",
    decide: "arbitro",
    grupo: "evidencia",
    forma: { tipo: "porcentaje" },
    porDefecto: "80.0%",
  },
  {
    llave: "evidenceMaxGapMinutes",
    nombre: "El silencio más largo que se tolera",
    queHace:
      "Si dentro de la ventana hay un hueco continuo mayor a esto, el sistema se abstiene y el servicio queda pendiente por evidencia.",
    siLaSubes: "Se toleran silencios más largos y se juzgan más servicios con huecos adentro.",
    siLaBajas: "Cualquier silencio deja el servicio pendiente.",
    decide: "arbitro",
    grupo: "evidencia",
    forma: { tipo: "entero", min: 1, max: 240, unidad: "min" },
    porDefecto: "10 min",
  },

  // ── Lo que se perdona ────────────────────────────────────────────────────
  {
    llave: "excusableReasons",
    nombre: "Motivos que este contrato acepta",
    queHace:
      "La lista cerrada de causas que el transportista puede invocar sobre un servicio. Marcarlas no perdona nada por sí solo: habilita que se puedan invocar.",
    siLaSubes: "",
    siLaBajas: "",
    decide: "arbitro",
    grupo: "perdon",
    forma: { tipo: "motivos" },
    porDefecto: "ninguno",
  },

  // ── La consecuencia ──────────────────────────────────────────────────────
  {
    llave: "enforcementRules",
    nombre: "Qué efecto económico tiene un incumplimiento",
    queHace:
      "Sin regla, los resultados se verifican y sellan igual pero la plataforma no muestra ninguna consecuencia económica. Con regla, cada consecuencia aparece junto al resultado que la causó.",
    siLaSubes: "",
    siLaBajas: "",
    decide: "consecuencia",
    grupo: "dinero",
    forma: { tipo: "enforcement" },
    porDefecto: "sin regla — sin efectos económicos",
  },
];

/** Los motivos que el esquema acepta. La lista es CERRADA: no se agregan. */
export const MOTIVOS_EXCUSABLES: Array<{ valor: string; etiqueta: string }> = [
  { valor: "lluvia_nieve", etiqueta: "Lluvia o nieve" },
  { valor: "marchas", etiqueta: "Marchas o manifestaciones" },
  { valor: "obstruccion", etiqueta: "Obstrucción de la vialidad" },
  { valor: "falla_mecanica", etiqueta: "Falla mecánica" },
  { valor: "ponchadura", etiqueta: "Ponchadura" },
  { valor: "obra_sin_aviso", etiqueta: "Obra sin aviso" },
];

export const ZONAS_HORARIAS: Array<{ valor: string; etiqueta: string }> = [
  { valor: "America/Ciudad_Juarez", etiqueta: "Cd. Juárez — Mountain" },
  { valor: "America/Mexico_City", etiqueta: "Ciudad de México — Central" },
  { valor: "America/Tijuana", etiqueta: "Tijuana — Pacific" },
  { valor: "America/Cancun", etiqueta: "Cancún — Eastern, sin horario de verano" },
  { valor: "America/Hermosillo", etiqueta: "Hermosillo — Mountain, sin horario de verano" },
];

export const ETIQUETA_DECIDE: Record<QuienDecide, { texto: string; explica: string }> = {
  arbitro: {
    texto: "Decide el resultado",
    explica: "El árbitro usa esta regla para dictar cumplido, no cumplido o pendiente.",
  },
  ventana: {
    texto: "Decide qué se mira",
    explica:
      "No dicta el resultado, pero define qué pedazo de telemetría ve el árbitro — y sobre eso decide.",
  },
  operacion: {
    texto: "Organiza la operación",
    explica: "No cambia el resultado de un servicio: ordena cómo se reparten unidades y turnos.",
  },
  consecuencia: {
    texto: "Solo efectos económicos",
    explica: "El resultado se sella igual. Esto solo define qué se cobra o descuenta después.",
  },
};

export function perillasDelGrupo(grupo: GrupoPerilla): Perilla[] {
  return PERILLAS.filter((p) => p.grupo === grupo);
}
