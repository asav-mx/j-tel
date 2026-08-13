/**
 * El expediente de candidatas que se congela DENTRO del hecho — Parte 2.
 *
 * Toma lo que el motor ya decidió y lo empaqueta para sellarlo. **No decide
 * nada**: no recalcula un match, no mueve un veredicto, no elige ganadora. Si
 * este archivo desapareciera, todos los veredictos saldrían iguales.
 *
 * ---
 *
 * **Qué resuelve.** Hasta aquí, un servicio sin atribución guardaba un motivo
 * del SERVICIO —`ninguna_unidad_coincidio_ruta`, que dice lo mismo que «no se
 * pudo atribuir»— y ninguno de cada candidata. El expediente no explicaba
 * porque el motor nunca escribió el porqué.
 *
 * **Las dos leyes del frente, aplicadas aquí:**
 *
 * 1. Nada de esto es un veredicto ni lo cambia.
 * 2. Nada se inventa. Lo que no se midió sale `null`, y `null` no es cero.
 */
import type {
  CandidatasSnapshot,
  GpsPoint,
  SenalDeCandidata,
  VerificationResult,
} from "@jtel/domain";
import { assessEvidenceCoverage } from "@jtel/verification";

/**
 * Piso de precisión de corredor (%) para entrar al expediente.
 *
 * **No es umbral de política y no decide ningún veredicto**: decide a quién vale
 * la pena enseñar. Vive aquí, con su número escrito, porque un corte escondido
 * en el código es un filtro que nadie puede auditar.
 *
 * El 5 sale de medirlo sobre los 397 acusados con llegada (13 de agosto de
 * 2026): de una flota de 50 evaluadas, «llegó a la geocerca» deja mediana de 4 y
 * este piso la baja a 3 — un expediente que se lee. Apretarlo más sale caro: con
 * B > 25 % **110 de 397 servicios (27.7 %) se quedarían sin ninguna candidata
 * que enseñar**, y un expediente vacío es peor que uno con una fila de más.
 *
 * `B > 0 %` se descartó por medición, no por gusto: da exactamente lo mismo que
 * llegar, porque el destino está sobre el trazado y entrar a la geocerca ya
 * implica tocar el corredor.
 */
export const PISO_CORREDOR_RELEVANTE_PCT = 5;

/** Cómo se recortó la lista. Viaja dentro del hecho para que el corte sea auditable. */
export const CRITERIO_RELEVANTE = `llego_a_geocerca_y_corredor_mayor_${PISO_CORREDOR_RELEVANTE_PCT}pct`;
/** El de respaldo, cuando el corte de arriba no deja a nadie. */
export const CRITERIO_SOLO_LLEGADA = "llego_a_geocerca";
/** Cuando NINGUNA llegó: se guardan las que más se acercaron al trazado. */
export const CRITERIO_SIN_LLEGADAS = "sin_llegadas_mas_cercanas_al_trazado";
/**
 * Cuántas guardar cuando nadie llegó.
 *
 * Sin llegada no hay corte natural y sin tope se guardaría la flota entera —42
 * en el servicio que destapó esto—. El total evaluado viaja aparte, que es lo
 * que impide que el tope esconda.
 */
export const MAX_SIN_LLEGADAS = 5;

/** Mediana del hueco entre puntos consecutivos (s); null con menos de dos. */
function cadenciaMedianaS(instantes: number[]): number | null {
  if (instantes.length < 2) return null;
  const orden = [...instantes].sort((a, b) => a - b);
  const huecos: number[] = [];
  for (let i = 1; i < orden.length; i++) huecos.push((orden[i]! - orden[i - 1]!) / 1000);
  huecos.sort((a, b) => a - b);
  const mitad = Math.floor(huecos.length / 2);
  return huecos.length % 2 === 1
    ? huecos[mitad]!
    : (huecos[mitad - 1]! + huecos[mitad]!) / 2;
}

/**
 * La señal de UNA candidata, medida sobre SUS puntos.
 *
 * Existe porque el paso `cobertura_evidencia` del ledger mide **una sola
 * unidad, la mejor**, y con eso el expediente no puede distinguir «este camión
 * no hizo la ruta» de «a este camión no se le vio hacerla» — que es la
 * distinción que sostiene el producto (C19).
 */
function senalDe(
  puntos: GpsPoint[],
  ventana: { inicio: Date; fin: Date } | null,
  opts: { minCoveragePct?: number; maxGapMinutes?: number },
): SenalDeCandidata | null {
  if (puntos.length === 0 || !ventana) return null;
  const instantes = puntos.map((p) => p.timestamp);
  const cobertura = assessEvidenceCoverage(instantes, ventana.inicio, ventana.fin, opts);
  return {
    coberturaPct: Number(cobertura.coveragePct.toFixed(1)),
    huecoMaximoMin: Number((cobertura.maxGapMs / 60_000).toFixed(1)),
    cadenciaMedianaS: cadenciaMedianaS(instantes.map((t) => t.getTime())),
    puntos: cobertura.pointCount,
  };
}

export type ArmarSnapshotInput = {
  verification: VerificationResult;
  /** Los puntos que el motor tuvo enfrente, con `unitId` ya resuelto. */
  evidencePoints: GpsPoint[];
  ventanaCobertura: { inicio: Date; fin: Date } | null;
  minCoveragePct?: number;
  maxGapMinutes?: number;
  /**
   * Contra qué trazado se calificó — **no cuál sirvió**. Se llena SIEMPRE, tanto
   * en cumplido como en no cumplido: el expediente necesita saber contra qué se
   * le juzgó, y ésa es una pregunta distinta de cuál acreditó.
   */
  trazadoEvaluado: { variantId: string | null; kmlVersionId: string | null } | null;
};

/**
 * Arma el expediente de candidatas.
 *
 * Devuelve `null` **solo si el motor no evaluó ninguna candidata** —evidencia
 * vacía, o cobertura insuficiente antes de llegar al match—. Ese `null` es
 * honesto: significa que no hubo a quién preguntarle. **No se confunde con el
 * `null` de la columna en los hechos viejos**, que significa que el motor de
 * entonces no registraba el porqué; ésos no se tocan nunca.
 */
export function armarCandidatasSnapshot(
  input: ArmarSnapshotInput,
): CandidatasSnapshot | null {
  const todas = input.verification.candidateUnits;
  if (todas.length === 0) return null;

  const porUnidad = new Map<string, GpsPoint[]>();
  for (const p of input.evidencePoints) {
    const clave = p.unitId ?? p.imei;
    const arr = porUnidad.get(clave) ?? [];
    arr.push(p);
    porUnidad.set(clave, arr);
  }

  const llegaron = todas.filter((c) => c.arrivalAt !== null);
  const cercanas = llegaron.filter(
    (c) => c.corridorPrecisionPct > PISO_CORREDOR_RELEVANTE_PCT,
  );

  let relevantes: typeof todas;
  let criterio: string;
  if (llegaron.length === 0) {
    /*
     * NADIE LLEGÓ — y el expediente tiene que explicar eso también.
     *
     * Esta rama existe porque su ausencia se vio en pantalla: un servicio con
     * **42 candidatas evaluadas y ninguna llegada** se sellaba con la lista
     * VACÍA, así que el expediente quedaba mudo para siempre. Son 204 de los
     * 608 acusados. «Nadie llegó» es un hallazgo, no una ausencia.
     *
     * Se guardan las que más se acercaron al trazado, aunque ninguna haya
     * entrado a la geocerca: es la única respuesta honesta a «dónde anduvieron»,
     * y sale de lo que el motor ya midió.
     */
    relevantes = [...todas]
      .filter((c) => c.corridorPrecisionPct > 0 || c.routeMatchPct > 0)
      .sort(
        (a, b) =>
          Math.min(b.routeMatchPct, b.corridorPrecisionPct) -
          Math.min(a.routeMatchPct, a.corridorPrecisionPct),
      )
      .slice(0, MAX_SIN_LLEGADAS);
    criterio = CRITERIO_SIN_LLEGADAS;
  } else {
    /*
     * Si el segundo criterio no deja a nadie, se cae al primero. **La pantalla
     * nunca se queda vacía**: que ninguna se acercara al trazado es un hecho del
     * servicio, y de los más elocuentes que este expediente puede dar — pero se
     * cuenta enseñando a las que llegaron, no dejando la lista en blanco.
     */
    relevantes = cercanas.length > 0 ? cercanas : llegaron;
    criterio = cercanas.length > 0 ? CRITERIO_RELEVANTE : CRITERIO_SOLO_LLEGADA;
  }

  // El mismo orden del motor: la que más cerca estuvo de acreditar, primero.
  const ordenadas = [...relevantes].sort(
    (a, b) =>
      Math.min(b.routeMatchPct, b.corridorPrecisionPct) -
      Math.min(a.routeMatchPct, a.corridorPrecisionPct),
  );

  return {
    // Lo que se evaluó, no lo que se guardó. Sin esto el corte esconde.
    evaluadas: todas.length,
    criterio,
    candidatas: ordenadas.map((c) => {
      const suyos = porUnidad.get(c.unitId) ?? [];
      return {
        unidadId: c.unitId,
        imeis: [...new Set(suyos.map((p) => p.imei))].sort(),
        llegadaAt: c.arrivalAt ? c.arrivalAt.toISOString() : null,
        acredito: c.servedRoute,
        motivos: c.motivos ?? [],
        senal: senalDe(suyos, input.ventanaCobertura, {
          minCoveragePct: input.minCoveragePct,
          maxGapMinutes: input.maxGapMinutes,
        }),
      };
    }),
    trazadoEvaluado: input.trazadoEvaluado,
  };
}
