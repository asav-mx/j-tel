/**
 * Monitoreo — la sala de control del transportista.
 *
 * Responde una sola pregunta: **¿qué está en riesgo ahora mismo, en cualquiera
 * de mis clientes?** Mirar hacia atrás es el Workbench; aquí los segundos
 * importan y se actúa.
 *
 * Tres leyes de la ficha, y las tres se ven en el código:
 *
 * 1. **Todos los contratos en una sola sala.** Un transportista con tres
 *    clientes no puede tener tres pantallas abiertas. `findForCarrier` trae los
 *    servicios de todos sus contratos y se ordenan por cuál cierra primero, sin
 *    importar de quién sea.
 * 2. **Ningún color de veredicto.** El resultado se emite al cierre. Acero para
 *    lo medido; el ámbar solo como aviso del sistema, nunca como falta.
 * 3. **Esta pantalla mira el ahora.** Nada acumulado, nada histórico.
 *
 * Lo que NO trae, cada cosa con su razón medida — §5 de la ficha pedía auditar
 * antes de dibujar, y auditar sirvió para no dibujar cuatro cosas:
 *
 * - **Kilómetro muerto.** Se puede calcular (por unidad, contra los viajes
 *   donde esa unidad fue la acreditada; 1.16 s, cero restas negativas) y aun
 *   así no se muestra: el 2026-07-31 daba 5 245 km de 5 860, o sea 89.5% de la
 *   flota "muerta". La mayoría de las unidades no cubre rutas contratadas, así
 *   que su recorrido entero cae del lado muerto — y no está muerto, es trabajo
 *   que J-Telemetry no ve. §D del Marco, eje del ALCANCE: acusaría en falso al
 *   auditado.
 * - **Unidades de reserva.** El concepto no existe en el modelo y solo 4
 *   perfiles declaran catálogo de unidades. No se puede derivar sin inventarlo.
 * - **Diésel del turno.** `fuel_records` no tiene turno ni forma de derivarlo, y
 *   hay 1 captura en toda la base.
 * - **Chofer declarado.** Las tablas existen desde la migración 0016 y están
 *   vacías: 0 choferes, 0 hechos con chofer. El renglón se muestra sin chofer.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, SIN_SENAL_MINUTOS, localDateIso, localTimeHHMM } from "@jtel/domain";

/** Cuánto antes del cierre un servicio entra a "lo que todavía se puede evitar". */
const VENTANA_EVITABLE_MIN = 90;

export type EstadoSala = "sin_programados" | "en_vuelo";

export type ServicioEnSala = {
  ocurrenciaId: string;
  cliente: string;
  ruta: string;
  turno: string;
  /** Instante de cierre. Con fecha completa: un turno nocturno cruza la medianoche. */
  cierre: string;
  cierreHora: string;
  minutosParaCierre: number;
  /** El árbitro ya selló: la sala no recalcula nada sobre esto. */
  cerrado: boolean;
  grupo: "atencion" | "en_ruta" | "llegaron";
};

export type Evitable = {
  id: string;
  /** La afirmación, como hecho y en una frase. */
  afirmacion: string;
  /** Lo medido que la sostiene, con su umbral al lado. */
  evidencia: string;
  /**
   * El dato de la derecha, y su naturaleza.
   *
   * Van separados porque no son la misma clase de cosa y pintarlos igual
   * mentiría: una cuenta regresiva hacia un cierre es ámbar —algo que todavía
   * se puede evitar— y la hora del último punto de una unidad callada es una
   * medición, o sea acero. La primera versión les puso a los dos el mismo
   * texto ("4 servicios cierran en menos de 90 min", repetido palabra por
   * palabra en cada unidad callada): se leía como plantilla y, peor, insinuaba
   * que esa unidad era la de esos servicios. Hoy J-Telemetry no puede afirmar
   * eso en vivo.
   */
  dato: string;
  tipoDato: "cuenta_regresiva" | "medicion";
  cliente: string | null;
};

export type MonitoreoCarrierData = {
  estado: EstadoSala;
  titular: string;
  /**
   * El alcance, enunciado. Quien opera tiene derecho a saber que no está
   * viendo todo: los contratos de prueba se excluyen y se dice cuántos.
   */
  alcance: string;
  fecha: string;
  horaCorte: string;
  evitables: Evitable[];
  /**
   * La consecuencia de lo evitable, dicha UNA vez para todo el bloque.
   *
   * Iba repetida en cada renglón de unidad callada, palabra por palabra, y así
   * se leía como plantilla. Va aquí porque es una sola afirmación sobre el
   * conjunto — y porque declara el límite: J-Telemetry no puede decir en vivo
   * qué unidad cubre qué ruta, así que ligar una unidad callada a un servicio
   * concreto sería inventar el vínculo.
   */
  consecuencia: string | null;
  /** Por qué la zona de lo evitable está vacía, cuando lo está. */
  sinEvitables: string | null;
  banda: { etiqueta: string; valor: string; propio: boolean }[];
  servicios: ServicioEnSala[];
  conteos: { atencion: number; en_ruta: number; llegaron: number };
  /** Solo en `sin_programados`: cuándo vuelve a haber operación. */
  proximoTurno: string | null;
  /** Los renglones que la auditoría dejó fuera, con su razón. Se muestran. */
  ausentes: { titulo: string; razon: string }[];
};

/**
 * El texto del día sin operación.
 *
 * Vive aparte y con nombre para poder cercarlo: "sin servicios programados" y
 * "todo en orden" son afirmaciones distintas, y confundirlas le diría al
 * transportista que está cumpliendo cuando no hay nada que cumplir. Es la misma
 * distinción de la tira de catorce días.
 */
export const SIN_PROGRAMADOS = {
  titular: "Sin servicios programados hoy.",
  encabezado: "No hay nada que vigilar hoy.",
  nota:
    "Un día sin servicios programados no es un día en orden: no hay nada que cumplir. " +
    "La sala se llena sola cuando abra el turno.",
} as const;

export const AUSENTES: { titulo: string; razon: string }[] = [
  {
    titulo: "Kilómetro muerto",
    razon:
      "Se puede calcular, pero hoy el número acusaría en falso: medido sobre la flota completa da 89.5% de recorrido muerto, porque la mayoría de las unidades hace trabajo fuera de lo contratado y J-Telemetry no lo ve. Vuelve cuando exista el concepto de parada del Workbench.",
  },
  {
    titulo: "Unidades de reserva",
    razon:
      "El concepto no existe en el modelo, y solo 4 perfiles declaran su catálogo de unidades. Derivarlo hoy sería inventarlo.",
  },
  {
    titulo: "Diésel del turno",
    razon:
      "Las capturas de diésel no traen turno ni forma de derivarlo, y hay 1 captura en toda la base.",
  },
  {
    titulo: "Chofer de cada servicio",
    razon:
      "El modelo de choferes existe desde hace poco y todavía nadie ha declarado uno. Los renglones van sin chofer hasta que se capturen.",
  },
];

export async function loadMonitoreoCarrier(
  carrier: { id: string; name: string },
  opts: { ahora?: Date } = {},
): Promise<MonitoreoCarrierData> {
  const repos = getRepos();
  const ahora = opts.ahora ?? new Date();
  const fecha = localDateIso(ahora, JTTEL_TZ);

  const [{ ocurrencias, contratosDePruebaExcluidos }, ultimoPorUnidad] = await Promise.all([
    repos.occurrences.findForCarrier(carrier.id, ahora, ahora),
    repos.telemetry.getLastPointPerUnit(carrier.id),
  ]);

  const clientes = new Set(
    ocurrencias.map((o) => o.contract?.client?.name).filter((n): n is string => Boolean(n)),
  );

  const alcance = [
    `${ocurrencias.length} ${ocurrencias.length === 1 ? "servicio" : "servicios"}`,
    clientes.size > 0 ? [...clientes].join(" · ") : null,
    contratosDePruebaExcluidos > 0
      ? `${contratosDePruebaExcluidos} ${contratosDePruebaExcluidos === 1 ? "contrato de prueba excluido" : "contratos de prueba excluidos"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // ── Sin servicios programados NO es "todo en orden" ──────────────────────
  //
  // Es la misma distinción de la tira de catorce días: un día vacío porque
  // nadie programó nada y un día vacío porque falta el dato no son el mismo
  // día. Decir "todo en orden" cuando no hay nada que cumplir le afirmaría al
  // transportista que está cumpliendo.
  if (ocurrencias.length === 0) {
    const proximo = await repos.occurrences.proximoServicioParaCarrier(carrier.id, ahora);
    return {
      estado: "sin_programados",
      titular: SIN_PROGRAMADOS.titular,
      alcance,
      fecha,
      horaCorte: localTimeHHMM(ahora, JTTEL_TZ),
      evitables: [],
      consecuencia: null,
      sinEvitables: null,
      banda: [],
      servicios: [],
      conteos: { atencion: 0, en_ruta: 0, llegaron: 0 },
      // Se nombra lo que el dato ES. `expectedDeadline` es la hora de CIERRE
      // del primer servicio, no la hora a la que abre el turno: la anticipación
      // del contrato las separa. Decir "el próximo turno abre 05:40" sería el
      // valor correcto con el nombre equivocado, que es exactamente cómo un
      // dato cierto se vuelve una afirmación falsa.
      proximoTurno: proximo
        ? `El próximo servicio cierra ${localDateIso(proximo.expectedDeadline, JTTEL_TZ)} ${localTimeHHMM(proximo.expectedDeadline, JTTEL_TZ)}`
        : null,
      ausentes: AUSENTES,
    };
  }

  const servicios: ServicioEnSala[] = ocurrencias
    .map((o) => {
      const cierre = new Date(o.expectedDeadline);
      const minutos = Math.round((cierre.getTime() - ahora.getTime()) / 60_000);
      const cerrado = Boolean(o.complianceFact);
      const llego = Boolean(o.complianceFact?.observedArrivalAt);
      return {
        ocurrenciaId: o.id,
        cliente: o.contract?.client?.name ?? "—",
        ruta: o.profile?.routeShift?.route?.name ?? o.profile?.name ?? "—",
        turno: o.profile?.routeShift?.shift?.name ?? "—",
        cierre: `${localDateIso(cierre, JTTEL_TZ)} ${localTimeHHMM(cierre, JTTEL_TZ)}`,
        cierreHora: localTimeHHMM(cierre, JTTEL_TZ),
        minutosParaCierre: minutos,
        cerrado,
        // El orden es por urgencia, no por gravedad: lo que cierra primero
        // manda, que es lo único que un monitorista humano no podía dar.
        grupo: llego || cerrado ? ("llegaron" as const) : minutos <= 0 ? ("atencion" as const) : ("en_ruta" as const),
      };
    })
    .sort((a, b) => a.minutosParaCierre - b.minutosParaCierre);

  const conteos = {
    atencion: servicios.filter((s) => s.grupo === "atencion").length,
    en_ruta: servicios.filter((s) => s.grupo === "en_ruta").length,
    llegaron: servicios.filter((s) => s.grupo === "llegaron").length,
  };

  // ── Lo que todavía se puede evitar ───────────────────────────────────────
  //
  // El corazón de la pantalla, y el lugar del vigía. Hoy lo llena el sistema
  // con lo que mide; cuando exista Lenore hablará aquí. Construirlo con esta
  // forma no es adelantarse: es no tener que rehacerlo.
  //
  // Solo entra lo que todavía tiene remedio. Un servicio ya cerrado no es
  // evitable: es historia, y la historia es el Workbench.
  const evitables: Evitable[] = [];

  const unidades = await repos.fleet.getUnitsForCarrier(carrier.id);
  const mudas: { label: string; minutos: number; ultimoAt: Date }[] = [];
  for (const u of unidades) {
    const ultimo = ultimoPorUnidad.get(u.id);
    if (!ultimo) continue;
    const at = new Date(ultimo);
    const min = Math.round((ahora.getTime() - at.getTime()) / 60_000);
    if (min > SIN_SENAL_MINUTOS) mudas.push({ label: u.label, minutos: min, ultimoAt: at });
  }
  mudas.sort((a, b) => b.minutos - a.minutos);

  const porCerrar = servicios.filter(
    (s) => !s.cerrado && s.minutosParaCierre > 0 && s.minutosParaCierre <= VENTANA_EVITABLE_MIN,
  );

  // Una unidad callada solo es evitable si hay algo que todavía puede fallar
  // por su culpa. Sin servicios abiertos, el silencio es un dato de flota y
  // vive en Unidades, no en la sala.
  if (porCerrar.length > 0) {
    for (const m of mudas.slice(0, 4)) {
      evitables.push({
        id: `muda-${m.label}`,
        afirmacion: `${m.label} lleva ${m.minutos} min sin reportar.`,
        evidencia: `umbral de señal vieja: ${SIN_SENAL_MINUTOS} min`,
        dato: `último punto ${localTimeHHMM(m.ultimoAt, JTTEL_TZ)}`,
        tipoDato: "medicion",
        cliente: null,
      });
    }
  }

  for (const s of porCerrar.slice(0, 6)) {
    evitables.push({
      id: `cierre-${s.ocurrenciaId}`,
      afirmacion: `${s.ruta} cierra en ${s.minutosParaCierre} min y todavía no se acredita.`,
      evidencia: `cierre ${s.cierre} · turno ${s.turno}`,
      dato: `${s.minutosParaCierre} min`,
      tipoDato: "cuenta_regresiva",
      cliente: s.cliente,
    });
  }

  const consecuencia =
    mudas.length > 0 && porCerrar.length > 0
      ? `${porCerrar.length} ${porCerrar.length === 1 ? "servicio sigue abierto" : "servicios siguen abiertos"} y ${mudas.length === 1 ? "una unidad no está reportando" : `${mudas.length} unidades no están reportando`}. J-Telemetry todavía no puede decir en vivo cuál cubre cuál, así que la relación la pones tú.`
      : null;

  const sinEvitables =
    evitables.length === 0
      ? conteos.atencion + conteos.en_ruta === 0
        ? "Todos los servicios del día ya cerraron. Lo que sigue es historia, y la historia vive en el Workbench."
        : `Ningún servicio cierra en los próximos ${VENTANA_EVITABLE_MIN} min y ninguna unidad lleva más de ${SIN_SENAL_MINUTOS} min sin reportar.`
      : null;

  const reportando = unidades.filter((u) => {
    const ultimo = ultimoPorUnidad.get(u.id);
    if (!ultimo) return false;
    return (ahora.getTime() - new Date(ultimo).getTime()) / 60_000 <= SIN_SENAL_MINUTOS;
  }).length;

  const banda = [
    { etiqueta: "En vuelo", valor: `${conteos.en_ruta} de ${servicios.length}`, propio: false },
    { etiqueta: "Ya cerraron", valor: String(conteos.llegaron), propio: false },
    { etiqueta: "Pasaron su cierre", valor: String(conteos.atencion), propio: false },
    // Propio del transportista: la planta no ve su flota.
    { etiqueta: "Unidades reportando", valor: `${reportando} de ${unidades.length}`, propio: true },
  ];

  const titular =
    evitables.length > 0
      ? `${evitables.length} ${evitables.length === 1 ? "cosa puedes arreglar" : "cosas puedes arreglar"} antes del cierre.`
      : conteos.en_ruta > 0
        ? `${conteos.en_ruta} ${conteos.en_ruta === 1 ? "servicio en vuelo" : "servicios en vuelo"}, nada que arreglar ahora.`
        : "Nada en vuelo en este momento.";

  return {
    estado: "en_vuelo",
    titular,
    alcance,
    fecha,
    horaCorte: localTimeHHMM(ahora, JTTEL_TZ),
    evitables,
    consecuencia,
    sinEvitables,
    banda,
    servicios,
    conteos,
    proximoTurno: null,
    ausentes: AUSENTES,
  };
}
