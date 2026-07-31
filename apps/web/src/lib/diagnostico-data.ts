/**
 * Reunir lo que el microscopio necesita — la parte que toca la base.
 *
 * La lectura vive en `diagnostico-lectura.ts` y la geometría en
 * `diagnostico-geometria.ts`; las dos se prueban sin base de datos.
 *
 * Regla de la pantalla entera: **todo sale de lo sellado.** Los puntos de
 * evidencia son los que el motor guardó para ese viaje, la ventana es la que
 * el motor usó, los números son los que escribió en el ledger al decidir.
 * Abrir esta pantalla no verifica nada de nuevo (ley 2) y tampoco vuelve a
 * pedirle telemetría a nadie.
 *
 * Lo único que se calcula al abrir es geometría de dibujo: dónde empieza el
 * tramo observable sobre el trazado. Se calcula con la MISMA función del
 * paquete de verificación y con los MISMOS puntos sellados, así que reproduce
 * el corte que el motor aplicó en vez de proponer uno nuevo.
 */

import { observableRouteSpan } from "@jtel/verification";
import { pairLedgerEntryWithFact, type LedgerPairing } from "@jtel/db";
import { contractPolicySchema, type LedgerStep } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { leerElMotor, type LecturaDelMotor } from "@/lib/diagnostico-lectura";
import { partirRuta, type Punto, type TramoDeRuta } from "@/lib/diagnostico-geometria";
import { construirHistoriaSello, type HistoriaSello } from "@/lib/historia-sello";

/** Cuántos puntos de traza se llevan al dibujo. Por encima de esto no se ve mejor. */
export const MAX_PUNTOS_DIBUJADOS = 900;

export type PuntoConHora = Punto & { ms: number };

export type CandidataDibujada = {
  clave: string;
  /** La clave escrita para un humano: la placa o el nombre de la unidad. */
  etiqueta: string;
  puntos: PuntoConHora[];
  esLaDecisiva: boolean;
};

export type DatosDeDiagnostico = {
  ocurrencia: {
    id: string;
    fecha: string;
    ruta: string;
    turno: string;
    contrato: string;
    contratoId: string;
    deadline: Date;
    toleranciaMinutos: number;
    /**
     * Cuánto arranque de ruta tolera perder el contrato (0–1), de la política
     * congelada en el hecho. Es el umbral contra el que se lee el tramo que la
     * ventana no alcanzó — sin él, el riel de ruta enseñaría un número sin su
     * lectura.
     */
    toleranciaDeOrigen: number | null;
  };
  hecho: {
    estado: string;
    timing: string | null;
    llegada: Date | null;
    unidadObservada: string | null;
    selladoEn: Date;
    /** Las versiones del sello y la causa de cada una. */
    historiaSello: HistoriaSello;
    excusable: string | null;
  } | null;
  /** La ventana que el motor efectivamente miró, tal como quedó en el viaje. */
  ventana: { desde: Date; hasta: Date } | null;
  /** Emparejamiento del ledger con el hecho vigente: puede fallar, y se dice. */
  emparejamiento: LedgerPairing<{ action: string; createdAt: Date }>;
  pasos: LedgerStep[];
  lectura: LecturaDelMotor | null;
  trazado: {
    /** Nombre de la variante dibujada. */
    variante: string;
    waypoints: Punto[];
    tramo: TramoDeRuta;
  } | null;
  geocerca: Punto[];
  candidatas: CandidataDibujada[];
  /**
   * Cómo se escribe cada clave del ledger para un humano. El motor agrupa por
   * identificador; una tabla de UUIDs no se lee.
   */
  etiquetas: Record<string, string>;
  /**
   * La traza se corta en la llegada a la geocerca (ley 4: frontera de la
   * evidencia). Aplica también aquí — la ley dice "a nadie, en ninguna cara".
   */
  trazaCortadaEnLlegada: boolean;
  /** Instantes de la candidata decisiva, para el riel de tiempo. */
  instantesDecisiva: number[];
};

export async function cargarDiagnostico(
  occurrenceId: string,
): Promise<DatosDeDiagnostico | null> {
  const repos = getRepos();
  const ocurrencia = await repos.occurrences.findById(occurrenceId);
  if (!ocurrencia) return null;

  const perfil = ocurrencia.profile;
  const contrato = perfil?.contract;
  const trip = ocurrencia.trip;
  const fact = ocurrencia.complianceFact;

  const routeShift = perfil?.routeShiftId
    ? await repos.routes.findRouteShiftById(perfil.routeShiftId)
    : null;

  /*
   * La política CONGELADA en el hecho, leída con los defaults del esquema.
   *
   * Un hecho anterior a que existiera una perilla no trae esa llave, pero el
   * motor la resolvió con su default al verificar — o sea que el default ES
   * el valor con el que se juzgó este servicio. Enseñar el campo vacío haría
   * creer que la regla no aplicó, y aquí eso importa el doble: sin la
   * tolerancia de origen, el tramo no observado se enseñaría sin el umbral
   * contra el que se lee, que es medio dato.
   */
  const parseada = fact ? contractPolicySchema.safeParse(fact.contractPolicySnapshot) : null;
  const politica = parseada?.success ? parseada.data : (fact?.contractPolicySnapshot ?? null);

  // --- El ledger de ESTA corrida ------------------------------------------
  // Se acota a lo escrito desde el sello del hecho vigente y se empareja con
  // la regla conservadora del paquete de base: ante la duda, no se empareja.
  // Un hueco declarado antes que las cifras de otra corrida.
  const entradas = fact
    ? await repos.compliance.getLedgerForOccurrence(occurrenceId, {
        sinceMaterializedAt: fact.materializedAt,
      })
    : [];
  const emparejamiento = pairLedgerEntryWithFact(entradas, fact?.materializedAt ?? new Date());
  const pasos: LedgerStep[] = emparejamiento.paired
    ? ((emparejamiento.entry as { steps?: LedgerStep[] }).steps ?? [])
    : [];
  // La flota del carrier del contrato, para escribir los identificadores del
  // motor con placa. Solo esa flota: ninguna unidad de otra cuenta puede
  // aparecer aquí ni por accidente.
  const flota = contrato ? await repos.fleet.getUnitsForCarrier(contrato.carrierAccountId) : [];
  const etiquetas: Record<string, string> = {};
  for (const u of flota) {
    etiquetas[u.id] = u.plateNumber ? `${u.label} · ${u.plateNumber}` : u.label;
  }
  const escribir = (clave: string) => etiquetas[clave] ?? clave;

  const lectura = pasos.length > 0 ? leerElMotor(pasos, escribir) : null;

  // --- El trazado que el motor evaluó -------------------------------------
  // Mismo camino que la verificación: variantes activas a la fecha del
  // servicio, y si no hay, la versión vigente del KML principal.
  const routeId = routeShift?.routeId ?? null;
  const variantes = routeId
    ? await repos.routes.getActiveVariantVersionsForDate(routeId, ocurrencia.expectedDeadline)
    : [];
  let elegida: { variantId: string; variantName: string; waypoints: Punto[] } | null =
    variantes.length > 0
      ? {
          variantId: variantes[0]!.variantId,
          variantName: variantes[0]!.variantName,
          waypoints: variantes[0]!.waypoints as Punto[],
        }
      : null;

  // El hecho sella cuál variante sirvió: si la nombra, esa es la que se dibuja.
  if (fact?.servedVariantId) {
    const servida = variantes.find((v) => v.variantId === fact.servedVariantId);
    if (servida) {
      elegida = {
        variantId: servida.variantId,
        variantName: servida.variantName,
        waypoints: servida.waypoints as Punto[],
      };
    }
  }

  if (!elegida && routeId) {
    const fallback = await repos.routes.getKmlVersionForDate(
      routeId,
      ocurrencia.expectedDeadline,
    );
    if (fallback?.waypoints?.length) {
      elegida = {
        variantId: "",
        variantName: "Principal",
        waypoints: fallback.waypoints as Punto[],
      };
    }
  }

  // --- La evidencia sellada, agrupada como la agrupó el motor --------------
  const llegada = fact?.observedArrivalAt ?? null;
  const puntosCrudos = trip?.evidencePoints ?? [];

  const porClave = new Map<string, PuntoConHora[]>();
  for (const p of puntosCrudos) {
    // El motor sustituye el IMEI por el unitId cuando la evidencia lo trae
    // resuelto, y agrupa por ese valor. Se replica para que las trazas del
    // dibujo correspondan una a una con las candidatas del ledger.
    const clave = p.unitId ?? p.imei;
    const ms = p.recordedAt.getTime();
    // Ley 4: la evidencia se corta en la llegada a la geocerca. Lo que la
    // unidad hizo después no se muestra en ninguna cara — tampoco en esta.
    if (llegada && ms > llegada.getTime()) continue;
    const lista = porClave.get(clave) ?? [];
    lista.push({ lat: p.latitude, lng: p.longitude, ms });
    porClave.set(clave, lista);
  }
  for (const lista of porClave.values()) lista.sort((a, b) => a.ms - b.ms);

  const claveDecisiva = lectura?.decisiva?.clave ?? null;
  const candidatas: CandidataDibujada[] = [...porClave.entries()]
    .map(([clave, puntos]) => ({
      clave,
      etiqueta: escribir(clave),
      puntos,
      esLaDecisiva: clave === claveDecisiva,
    }))
    .sort(
      (a, b) =>
        Number(b.esLaDecisiva) - Number(a.esLaDecisiva) ||
        a.etiqueta.localeCompare(b.etiqueta, "es"),
    );

  const puntosDecisiva = porClave.get(claveDecisiva ?? "") ?? [];

  // --- Dónde empezó la observación sobre el trazado -----------------------
  // Con la función del motor y con los puntos de la candidata decisiva: el
  // mismo corte que se calificó, no uno nuevo.
  let trazado: DatosDeDiagnostico["trazado"] = null;
  if (elegida && elegida.waypoints.length > 0) {
    const corredorKm = (lectura?.umbrales.corredorMetros ?? 120) / 1000;
    const paraElMotor = (puntosDecisiva.length > 0
      ? puntosDecisiva
      : [...porClave.values()].flat()
    ).map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
      timestamp: new Date(p.ms),
      imei: claveDecisiva ?? "",
    }));
    const span = observableRouteSpan(paraElMotor, elegida.waypoints, corredorKm);
    const indiceInicio = elegida.waypoints.length - span.waypoints.length;
    trazado = {
      variante: elegida.variantName,
      waypoints: elegida.waypoints,
      tramo: partirRuta(elegida.waypoints, indiceInicio),
    };
  }

  const historia = await repos.compliance.getFactHistory(occurrenceId);

  return {
    ocurrencia: {
      id: ocurrencia.id,
      fecha: ocurrencia.serviceDate,
      ruta: routeShift?.route?.name ?? "—",
      turno: routeShift?.shift?.name ?? "—",
      contrato: contrato?.name ?? "—",
      contratoId: ocurrencia.contractId,
      deadline: ocurrencia.expectedDeadline,
      toleranciaMinutos: politica?.toleranceMinutes ?? 0,
      toleranciaDeOrigen: politica?.kmlOriginToleranceFraction ?? null,
    },
    hecho: fact
      ? {
          estado: fact.status,
          timing: fact.timing ?? null,
          llegada: fact.observedArrivalAt ?? null,
          unidadObservada: fact.observedUnit?.label ?? fact.observedUnitId ?? null,
          selladoEn: fact.materializedAt,
          historiaSello: construirHistoriaSello(fact, historia),
          excusable: fact.excusableReason ?? null,
        }
      : null,
    ventana: trip
      ? { desde: trip.evidenceWindowStart, hasta: trip.evidenceWindowEnd }
      : null,
    emparejamiento,
    pasos,
    lectura,
    trazado,
    geocerca: (perfil?.geofence?.polygon as Punto[] | undefined) ?? [],
    candidatas,
    etiquetas,
    trazaCortadaEnLlegada: llegada != null,
    instantesDecisiva: puntosDecisiva.map((p) => p.ms),
  };
}

// ---------------------------------------------------------------------------
// El índice: por dónde se entra al microscopio
// ---------------------------------------------------------------------------

export type FilaDeIndice = {
  occurrenceId: string;
  fecha: string;
  ruta: string;
  turno: string;
  estado: string;
  timing: string | null;
  matchPct: number | null;
};

export type ListaDeDiagnostico = {
  filas: FilaDeIndice[];
  /**
   * Conteos del PERIODO COMPLETO, no de las filas que sobrevivieron al tope.
   * Contarlos sobre la lista recortada haría decir «0 cumplido» cuando lo que
   * pasa es que los cumplidos van hasta abajo y el tope los cortó.
   */
  conteos: { total: number; noCumplido: number; pendiente: number; cumplido: number };
  /** Cuántos servicios del periodo no aparecen en la lista. */
  omitidos: number;
};

/**
 * Servicios de un contrato en un rango, con lo mínimo para elegir cuál abrir.
 *
 * Ordena por lo que amerita microscopio: primero lo que quedó sin resolver o
 * en contra, después lo que cerró limpio. Un diagnóstico se abre para entender
 * un problema, no para admirar un cumplido.
 */
export async function listarParaDiagnostico(entrada: {
  contractId: string;
  desde: string;
  hasta: string;
  limite?: number;
}): Promise<ListaDeDiagnostico> {
  const repos = getRepos();
  const ocurrencias = await repos.occurrences.findForContract(
    entrada.contractId,
    new Date(`${entrada.desde}T00:00:00.000Z`),
    new Date(`${entrada.hasta}T23:59:59.999Z`),
  );

  const orden: Record<string, number> = {
    no_cumplido: 0,
    pendiente_evidencia: 1,
    cumplido: 2,
  };

  const todas: FilaDeIndice[] = ocurrencias
    .map((o) => ({
      occurrenceId: o.id,
      fecha: o.serviceDate,
      ruta: o.profile?.routeShift?.route?.name ?? "—",
      turno: o.profile?.routeShift?.shift?.name ?? "—",
      estado: o.complianceFact?.status ?? "sin_hecho",
      timing: o.complianceFact?.timing ?? null,
      matchPct: o.complianceFact?.observedRouteMatchPct ?? null,
    }))
    .sort(
      (a, b) =>
        (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3) ||
        b.fecha.localeCompare(a.fecha) ||
        a.ruta.localeCompare(b.ruta, "es"),
    );

  const limite = entrada.limite ?? 120;
  const cuenta = (estado: string) => todas.filter((f) => f.estado === estado).length;

  return {
    filas: todas.slice(0, limite),
    conteos: {
      total: todas.length,
      noCumplido: cuenta("no_cumplido"),
      pendiente: cuenta("pendiente_evidencia"),
      cumplido: cuenta("cumplido"),
    },
    omitidos: Math.max(0, todas.length - limite),
  };
}
