import { getRepos } from "@/lib/db";
import type { ContractPolicy, OperationalScope } from "@jtel/domain";
import { JTTEL_TZ } from "@jtel/domain";
import { pairLedgerEntryWithFact } from "@jtel/db";
import { construirHistoriaSello, type HistoriaSello } from "@/lib/historia-sello";
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

  cobertura: Cobertura;
  /** El silencio más largo de la ventana, descrito desde evidencia anclada. */
  hueco: { minutos: number; desdeEn: string; hastaEn: string } | null;
  ventanaMinutos: number | null;
};

type Repos = ReturnType<typeof getRepos>;
type Occurrence = Awaited<ReturnType<Repos["occurrences"]["findForScope"]>>[number];

type CasoConstruido = { caso: CasoPendiente; timeZone: string };

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
  const par = pairLedgerEntryWithFact(entradas, fact.materializedAt);
  if (par.paired) {
    cobertura = leerCobertura(par.entry.steps) ?? { disponible: false, razon: "sin_paso" };
  } else {
    cobertura = { disponible: false, razon: par.reason };
  }

  let hueco: Hueco | null = null;
  if (o.trip?.id) {
    const inicio = o.trip.evidenceWindowStart ?? new Date(ventana.startMs);
    const fin = o.trip.evidenceWindowEnd ?? new Date(ventana.endMs);
    hueco = mayorHueco(
      puntos.map((p) => ({ at: p.recordedAt })),
      { inicio, fin },
    );
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
      cobertura,
      hueco: hueco
        ? { minutos: hueco.minutos, desdeEn: hueco.desde.toISOString(), hastaEn: hueco.hasta.toISOString() }
        : null,
      ventanaMinutos: (ventana.endMs - ventana.startMs) / 60_000,
    },
    timeZone: policy.timeZone ?? JTTEL_TZ,
  };
}

export type PendientesEvidenciaPayload = {
  zonaHoraria: string;
  casos: CasoPendiente[];
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

  return {
    zonaHoraria,
    casos: construidos.map((c) => c.caso),
    plazoCierreEn: null,
  };
}
