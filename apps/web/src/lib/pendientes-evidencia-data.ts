import { getRepos } from "@/lib/db";
import type { ContractPolicy, OperationalScope } from "@jtel/domain";
import { JTTEL_TZ, haversineKm } from "@jtel/domain";
import { pairLedgerEntryWithFact } from "@jtel/db";
import {
  construirHistoriaSello,
  intencionDeActor,
  type HistoriaSello,
} from "@/lib/historia-sello";
import { inferCircleFromPolygon } from "@/lib/geo";
import {
  leerCausaPendiente,
  leerFraccionObservada,
  type CausaPendiente,
} from "@/lib/causa-pendiente";
import {
  computeExclusiveContentionWindow,
  leerCobertura,
  mayorHueco,
  type Cobertura,
  type Hueco,
} from "@jtel/services";

/**
 * Pendiente por evidencia — la bandeja de todo lo que el árbitro todavía no
 * pudo juzgar, para una planta o campus.
 *
 * El estado más honesto del producto hecho pantalla (PLAN-v1, Ola 1). No hay
 * una sola llamada al motor en este archivo: se leen hechos ya sellados, el
 * ledger emparejado y los puntos de evidencia ya anclados del trip — igual
 * que hace `cierre-data.ts`, del que esta pantalla reutiliza la lectura de
 * cobertura (`@jtel/services`).
 *
 * No hay fecha ni turno en el filtro: un pendiente sigue siendo un pendiente
 * hasta que se resuelve, sin importar cuántos días lleve. Filtrar por hoy
 * escondería justo lo que más necesita atención.
 */

/**
 * Un tramo de la ventana del servicio, en porcentaje del ancho total.
 *
 * `conSenal` no significa "hubo un punto aquí": significa que entre los dos
 * puntos que lo delimitan el silencio fue tolerable según la política. Es la
 * misma regla con la que el motor calcula la cobertura, y por eso la tira y el
 * porcentaje de la barra siempre cuadran — si se dibujaran con criterios
 * distintos, la pantalla se contradiría sola.
 */
export type TramoVentana = {
  desdePct: number;
  hastaPct: number;
  conSenal: boolean;
};

export type CasoPendiente = {
  occurrenceId: string;
  profileCode: string;
  profileName: string;
  turnoName: string | null;
  fecha: string;

  /** La marca de sellado, y el orden de la bandeja. */
  selladoEn: string | null;
  /** Las versiones del resultado y la causa de cada una. */
  historiaSello: HistoriaSello;

  /** Por qué quedó sin juzgar, leído del ledger. Gobierna lo que la tarjeta afirma. */
  causa: CausaPendiente;
  /**
   * Qué fracción del trazado se alcanzó a ver antes de la tolerancia de origen.
   * Solo viene con `observacion_insuficiente`, que es donde significa algo.
   */
  fraccionObservada: number | null;

  cobertura: Cobertura;
  /** El silencio más largo de la ventana, descrito desde evidencia anclada. */
  hueco: { minutos: number; desdeEn: string; hastaEn: string } | null;
  ventanaMinutos: number | null;
  /** Cuántos puntos de evidencia se anclaron a la ventana. */
  puntos: number;

  /** La ventana en el tiempo: dónde hubo señal y dónde no. Vacío si no hay puntos. */
  tramos: TramoVentana[];
  /** Los extremos de la ventana, para rotular la tira. */
  ventanaDesdeEn: string | null;
  ventanaHastaEn: string | null;

  /**
   * El último punto que se recibió, y a qué distancia del destino quedó.
   *
   * `distanciaKmAlDestino` va en `null` cuando la geocerca no tiene un centro
   * derivable — no se estima uno para poder dibujar la cifra.
   */
  ultimaSenal: { en: string; distanciaKmAlDestino: number | null } | null;
};

/** Lo que la banda de estado puede afirmar hoy. */
export type BandaPendientes = {
  abiertos: number;
  /**
   * Pendientes que dejaron de serlo este mes **sin que nadie lo pidiera**: la
   * verificación programada volvió a correr y esta vez la evidencia alcanzó.
   *
   * Las salidas causadas por una decisión —J-Staff, CLI— NO se cuentan aquí.
   * Sumarlas daría un número mayor y una frase falsa: "se resolvieron solos"
   * dejaría de ser verdad en cuanto alguien pidiera una re-verificación.
   */
  resueltosSolosEsteMes: number;
  /** El mínimo de cobertura del contrato de referencia. `null` si no hay contrato. */
  minimoCoberturaPct: number | null;
  /** Desde cuándo se cuenta el mes, para poder decirlo en pantalla. */
  mesDesde: string;
};

type Repos = ReturnType<typeof getRepos>;
type Occurrence = Awaited<ReturnType<Repos["occurrences"]["findForScope"]>>[number];

type CasoConstruido = { caso: CasoPendiente; timeZone: string };

/**
 * Parte la ventana en tramos con y sin señal, usando la misma tolerancia de
 * hueco con la que el motor decide si un silencio cuenta como cubierto.
 *
 * Los bordes importan y son fáciles de perder: el trecho entre el inicio de la
 * ventana y el primer punto —y el del último punto al cierre— son silencio,
 * aunque no haya un "hueco entre puntos" que los describa. Un servicio cuya
 * unidad empezó a reportar tarde tiene su apagón justo ahí.
 */
function partirVentana(
  instantes: Date[],
  inicio: Date,
  fin: Date,
  huecoMaximoMinutos: number,
): TramoVentana[] {
  const t0 = inicio.getTime();
  const t1 = fin.getTime();
  const ancho = t1 - t0;
  if (ancho <= 0) return [];

  const dentro = instantes
    .map((d) => d.getTime())
    .filter((ms) => ms >= t0 && ms <= t1)
    .sort((a, b) => a - b);
  if (dentro.length === 0) return [{ desdePct: 0, hastaPct: 100, conSenal: false }];

  const toleranciaMs = Math.max(0, huecoMaximoMinutos) * 60_000;
  const pct = (ms: number) => ((ms - t0) / ancho) * 100;

  const crudos: TramoVentana[] = [];
  const empujar = (desde: number, hasta: number, conSenal: boolean) => {
    if (hasta <= desde) return;
    crudos.push({ desdePct: pct(desde), hastaPct: pct(hasta), conSenal });
  };

  empujar(t0, dentro[0]!, false);
  for (let i = 0; i < dentro.length - 1; i += 1) {
    const a = dentro[i]!;
    const b = dentro[i + 1]!;
    empujar(a, b, b - a <= toleranciaMs);
  }
  empujar(dentro[dentro.length - 1]!, t1, false);

  // Fundir tramos contiguos del mismo tipo: cien puntos seguidos producirían
  // cien rectángulos de acero pegados, que es la misma barra dibujada cien
  // veces y un DOM inútilmente grande.
  const fundidos: TramoVentana[] = [];
  for (const tramo of crudos) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo && ultimo.conSenal === tramo.conSenal) {
      ultimo.hastaPct = tramo.hastaPct;
    } else {
      fundidos.push({ ...tramo });
    }
  }
  return fundidos;
}

async function construirCaso(o: Occurrence, repos: Repos): Promise<CasoConstruido> {
  const fact = o.complianceFact!;
  const profile = o.profile;
  const policy = (o.contract?.policy ?? {}) as ContractPolicy;
  const ventana = computeExclusiveContentionWindow(o.expectedDeadline, policy);

  const [entradas, puntos, historia] = await Promise.all([
    repos.compliance.getLedgerForOccurrence(o.id, { sinceMaterializedAt: fact.materializedAt }),
    o.trip?.id ? repos.evidence.getPointsForTrip(o.trip.id) : Promise.resolve([]),
    repos.compliance.getFactHistory(o.id),
  ]);

  let cobertura: Cobertura;
  let causa: CausaPendiente = "desconocida";
  let fraccionObservada: number | null = null;
  const par = pairLedgerEntryWithFact(entradas, fact.materializedAt);
  if (par.paired) {
    cobertura = leerCobertura(par.entry.steps) ?? { disponible: false, razon: "sin_paso" };
    causa = leerCausaPendiente(par.entry.steps, cobertura);
    fraccionObservada = leerFraccionObservada(par.entry.steps);
  } else {
    cobertura = { disponible: false, razon: par.reason };
  }

  let hueco: Hueco | null = null;
  let tramos: TramoVentana[] = [];
  let ventanaDesde: Date | null = null;
  let ventanaHasta: Date | null = null;
  if (o.trip?.id) {
    const inicio = o.trip.evidenceWindowStart ?? new Date(ventana.startMs);
    const fin = o.trip.evidenceWindowEnd ?? new Date(ventana.endMs);
    ventanaDesde = inicio;
    ventanaHasta = fin;
    hueco = mayorHueco(
      puntos.map((p) => ({ at: p.recordedAt })),
      { inicio, fin },
    );
    tramos = partirVentana(
      puntos.map((p) => p.recordedAt),
      inicio,
      fin,
      policy.evidenceMaxGapMinutes ?? 10,
    );
  }

  /*
   * La última señal y su distancia al destino.
   *
   * Es la mitad que convierte "no vimos lo suficiente" en algo accionable: una
   * unidad que dejó de reportar a 400 m de la planta cuenta una historia muy
   * distinta de una que se calló a 18 km. No se estima un centro cuando la
   * geocerca no lo permite — la cifra se omite antes que inventarse.
   */
  const ultimo = puntos[puntos.length - 1];
  let ultimaSenal: CasoPendiente["ultimaSenal"] = null;
  if (ultimo) {
    const centro = inferCircleFromPolygon(profile?.geofence?.polygon ?? []);
    ultimaSenal = {
      en: ultimo.recordedAt.toISOString(),
      distanciaKmAlDestino: centro
        ? haversineKm(ultimo.latitude, ultimo.longitude, centro.lat, centro.lng)
        : null,
    };
  }

  return {
    caso: {
      occurrenceId: o.id,
      profileCode: profile?.code ?? "—",
      profileName: profile?.name ?? "—",
      turnoName: profile?.routeShift?.shift?.name ?? null,
      fecha: o.serviceDate,
      selladoEn: fact.materializedAt?.toISOString() ?? null,
      historiaSello: construirHistoriaSello(fact, historia),
      causa,
      fraccionObservada,
      puntos: puntos.length,
      cobertura,
      hueco: hueco
        ? { minutos: hueco.minutos, desdeEn: hueco.desde.toISOString(), hastaEn: hueco.hasta.toISOString() }
        : null,
      ventanaMinutos: (ventana.endMs - ventana.startMs) / 60_000,
      tramos,
      ventanaDesdeEn: ventanaDesde?.toISOString() ?? null,
      ventanaHastaEn: ventanaHasta?.toISOString() ?? null,
      ultimaSenal,
    },
    timeZone: policy.timeZone ?? JTTEL_TZ,
  };
}

export type PendientesEvidenciaPayload = {
  zonaHoraria: string;
  casos: CasoPendiente[];
  banda: BandaPendientes;
  /**
   * El plazo de cierre del pendiente — ni columna ni lógica existen todavía.
   * Reservado a propósito, como el bloque de enforcement en Cierre del turno:
   * se enciende cuando el contrato lo defina con la planta y el área legal,
   * no antes.
   */
  plazoCierreEn: null;
};

export async function loadPendientesEvidencia(opts: {
  accountSlug: string;
  scope: OperationalScope;
}): Promise<PendientesEvidenciaPayload> {
  const repos = getRepos();

  // Sin rango de fecha: la bandeja es todo lo que sigue pendiente, sin
  // importar cuándo se detectó.
  const occs = await repos.occurrences.findForScope(opts.scope);
  const pendientes = occs.filter((o) => o.complianceFact?.status === "pendiente_evidencia");

  // Cada caso hace 3 consultas (ledger, puntos de evidencia, historia del
  // sello) que no dependen entre sí, y ningún caso depende de otro — así que
  // tanto las 3 consultas de un caso como los casos entre sí corren en
  // paralelo. Sin esto, la bandeja hacía 3×N consultas en fila.
  const construidos = await Promise.all(pendientes.map((o) => construirCaso(o, repos)));

  // Orden por horizonte: el que lleva más tiempo pendiente primero — es el
  // que más se acerca a cualquier resolución, y el que menos debería quedar
  // enterrado bajo lo recién detectado.
  construidos.sort((a, b) => (a.caso.selladoEn ?? "").localeCompare(b.caso.selladoEn ?? ""));

  // La zona sale del contrato del primer caso YA ORDENADO — el que realmente
  // se muestra arriba — nunca del primero del fetch crudo (que trae otro
  // orden y puede ser un contrato distinto).
  const zonaHoraria = construidos[0]?.timeZone ?? JTTEL_TZ;

  /*
   * "Se resolvieron solos este mes" — el renglón que enseña que el pendiente
   * no es un callejón sin salida.
   *
   * Se cuentan las ocurrencias del alcance que tuvieron una versión pendiente
   * reemplazada este mes y que HOY ya no están pendientes. Las dos condiciones
   * hacen falta: sin la segunda, un servicio que pasó de pendiente a pendiente
   * —vuelve a correr la verificación y la evidencia sigue sin alcanzar— se
   * contaría como resuelto.
   *
   * Y solo cuentan las salidas de intención `consolidacion`: la verificación
   * programada corriendo sola. Una re-verificación pedida por J-Staff resuelve
   * el pendiente, sí, pero no "solo" — meterla aquí inflaría el número y
   * volvería falsa la frase que lo acompaña.
   */
  const ahora = new Date();
  const mesDesde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
  const yaNoPendientes = occs.filter(
    (o) => o.complianceFact && o.complianceFact.status !== "pendiente_evidencia",
  );
  const salidas = await repos.compliance.getSalidasDePendiente(
    yaNoPendientes.map((o) => o.id),
    mesDesde,
  );
  const resueltosSolos = new Set(
    salidas
      .filter((s) => intencionDeActor(s.actorKind) === "consolidacion")
      .map((s) => s.serviceOccurrenceId),
  );

  const politicaReferencia = (construidos.length > 0
    ? pendientes.find((o) => o.id === construidos[0]!.caso.occurrenceId)?.contract?.policy
    : occs.find((o) => o.contract?.policy)?.contract?.policy) as ContractPolicy | undefined;

  return {
    zonaHoraria,
    casos: construidos.map((c) => c.caso),
    banda: {
      abiertos: construidos.length,
      resueltosSolosEsteMes: resueltosSolos.size,
      minimoCoberturaPct: politicaReferencia?.evidenceMinCoveragePct ?? null,
      mesDesde: mesDesde.toISOString(),
    },
    plazoCierreEn: null,
  };
}

export type { CausaPendiente };
