import { verifyService, pointInPolygon } from "@jtel/verification";
import { measureBestTraversal, corridorKmFromMeters } from "./medicion-recorrido.js";
import {
  razonSinEvidenciaPosible,
  explicarRazon,
  type RazonSinEvidencia,
} from "./sin-evidencia-posible.js";
import {
  recuperacionTardia,
  FILAS_QUE_CABIAN_ANTES_DEL_LOTEO,
} from "./recuperacion-tardia.js";
import {
  motivoSinEvidencia,
  type MotivoSinEvidencia,
} from "./motivo-sin-evidencia.js";
import { motivoCuentaDemo } from "./cuenta-demo.js";
import type { ComplianceFact, Repositories } from "@jtel/db";
import type { ContractPolicy, VerificationResult } from "@jtel/domain";
import { localDateIso, JTTEL_TZ, DEFAULT_FRECHET_MAX_KM } from "@jtel/domain";

/**
 * El motor ya no recibe configuración del proveedor de GPS: no habla con él.
 * El tipo queda vacío y exportado solo para no romper importaciones sueltas.
 */
export type VerificationServiceConfig = Record<string, never>;

/** Hueco máximo entre puntos GPS para considerar la ventana “cubierta”. */
export const EVIDENCE_COVERAGE_MAX_GAP_MS = 5 * 60 * 1000;

export type ExclusiveUnitClaim = {
  occurrenceId: string;
  unitId: string;
  matchPct: number;
  arrivalAtMs: number;
  /** Ventana operativa del servicio (no la de evidencia GPS). */
  windowStartMs: number;
  windowEndMs: number;
};

/**
 * Ventana en la que el camión “ocupa” el servicio para exclusividad:
 * desde (deadline − duración máx. de ruta) hasta (deadline + tolerancia).
 * Más estrecha que la ventana de evidencia (márgenes GPS de 60+30 min),
 * para no chocar dos viajes de la misma mañana que solo se rozan en márgenes.
 */
export function computeExclusiveContentionWindow(
  deadline: Date,
  policy: {
    maxRouteDurationMinutes?: number;
    toleranceMinutes?: number;
  },
): { startMs: number; endMs: number } {
  const durationMin = Math.max(1, policy.maxRouteDurationMinutes ?? 60);
  const toleranceMin = Math.max(0, policy.toleranceMinutes ?? 0);
  const startMs = deadline.getTime() - durationMin * 60_000;
  const endMs = deadline.getTime() + toleranceMin * 60_000;
  return { startMs, endMs };
}

/** Dos ventanas se traslapan si comparten algún instante (semiabierto en el borde). */
export function evidenceWindowsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/**
 * Unidades ya acreditadas con confianza (`cumplido`) en ventanas que se
 * traslapan con el residual. Se excluyen del universo de candidatas (eliminación).
 * No dicta sentencia: el residual aún debe matchear la ruta con umbrales de política.
 */
export function occupiedUnitIdsForResidual(
  residual: { windowStartMs: number; windowEndMs: number },
  confidentClaims: Array<{
    unitId: string;
    windowStartMs: number;
    windowEndMs: number;
  }>,
): string[] {
  const occupied = new Set<string>();
  for (const c of confidentClaims) {
    if (
      evidenceWindowsOverlap(
        residual.windowStartMs,
        residual.windowEndMs,
        c.windowStartMs,
        c.windowEndMs,
      )
    ) {
      occupied.add(c.unitId);
    }
  }
  return [...occupied];
}

/**
 * Entre claims de la misma unidad, solo son conflicto si sus ventanas
 * operativas se traslapan. Misma unidad en días/turnos sin traslape = válido.
 * Gana mayor match KML; empate → llegada más temprana.
 */
export function pickExclusiveUnitLosers(
  claims: ExclusiveUnitClaim[],
): { winners: ExclusiveUnitClaim[]; losers: ExclusiveUnitClaim[] } {
  const byUnit = new Map<string, ExclusiveUnitClaim[]>();
  for (const c of claims) {
    const list = byUnit.get(c.unitId) ?? [];
    list.push(c);
    byUnit.set(c.unitId, list);
  }

  const winners: ExclusiveUnitClaim[] = [];
  const losers: ExclusiveUnitClaim[] = [];

  for (const list of byUnit.values()) {
    const sorted = [...list].sort((a, b) => {
      const diff = b.matchPct - a.matchPct;
      if (Math.abs(diff) >= 0.5) return diff;
      return a.arrivalAtMs - b.arrivalAtMs;
    });
    const unitWinners: ExclusiveUnitClaim[] = [];
    for (const c of sorted) {
      const conflicts = unitWinners.some((w) =>
        evidenceWindowsOverlap(
          w.windowStartMs,
          w.windowEndMs,
          c.windowStartMs,
          c.windowEndMs,
        ),
      );
      if (conflicts) losers.push(c);
      else unitWinners.push(c);
    }
    winners.push(...unitWinners);
  }

  return { winners, losers };
}

/**
 * Cobertura incompleta si no hay puntos o hay un hueco > maxGapMs al inicio,
 * entre puntos o al final de la ventana.
 */
export function hasIncompleteEvidenceCoverage(
  timestamps: Date[],
  windowStart: Date,
  windowEnd: Date,
  maxGapMs = EVIDENCE_COVERAGE_MAX_GAP_MS,
): boolean {
  const start = windowStart.getTime();
  const end = windowEnd.getTime();
  if (end <= start) return false;

  const sorted = timestamps
    .map((t) => t.getTime())
    .filter((t) => t >= start && t <= end)
    .sort((a, b) => a - b);

  if (sorted.length === 0) return true;
  if (sorted[0]! - start > maxGapMs) return true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! - sorted[i - 1]! > maxGapMs) return true;
  }
  if (end - sorted[sorted.length - 1]! > maxGapMs) return true;
  return false;
}

type VerifyOccurrenceOpts =
  | {
      force?: false | undefined;
      keepEvidence?: boolean;
      excludeUnitIds?: string[];
      eliminationPass?: boolean;
      eliminationExcludedUnitIds?: string[];
      actorKind?: string;
      actorId?: string | null;
    }
  | {
      force: true;
      /** "decision" → archiva siempre; "maintenance" → archiva solo si cambia el veredicto. */
      actorIntent: "decision" | "maintenance";
      keepEvidence?: boolean;
      excludeUnitIds?: string[];
      eliminationPass?: boolean;
      eliminationExcludedUnitIds?: string[];
      actorKind?: string;
      actorId?: string | null;
    };

export class VerificationService {
  /**
   * Primer punto de telemetría propia por carrier, cacheado por corrida. No
   * cambia dentro de una pasada del cron y la consulta es la misma para todos
   * los servicios del mismo transportista.
   */
  private horizonteMemoriaPorCarrier = new Map<string, Date | null>();

  /** Marca de agua del archivador por carrier, cacheada por corrida. */
  private marcaDeAguaPorCarrier = new Map<string, Date | null>();

  constructor(private repos: Repositories) {}

  async processPending(now = new Date()) {
    const pending = await this.repos.occurrences.findPendingVerification(now);

    /*
     * Lo excluido se cuenta y se dice. Un filtro mudo y un filtro que no filtra
     * se ven idénticos desde afuera, y ya nos pasó con `candidateDevices`.
     *
     * Va a consola y no al ledger a propósito: son los MISMOS servicios cada
     * minuto que corre el cron. Una entrada por servicio por minuto inundaría la
     * historia de las cuentas reales con ruido de cuentas de ejemplo. El número
     * exacto se puede pedir cuando se quiera con `contarVencidasDeCuentaDemo`.
     */
    const excluidasPorDemo = await this.repos.occurrences.contarVencidasDeCuentaDemo(now);
    if (excluidasPorDemo > 0) {
      console.warn(
        `[verify] ${excluidasPorDemo} servicio(s) vencido(s) fuera de la cola por ser de cuenta de ejemplo. ` +
          `El motor no sella sobre cuentas demo. Los hechos ya sellados antes de esta regla siguen en pie.`,
      );
    }

    const results = [];
    const verifiedIds: string[] = [];

    for (const row of pending) {
      try {
        const result = await this.verifyOccurrence(row.occurrence.id);
        results.push(result);
        verifiedIds.push(row.occurrence.id);
      } catch (err) {
        /*
         * EL FALLO DEJA RASTRO. ESTE `catch` ES EL QUE ESCONDIÓ 35 DÍAS.
         *
         * Antes solo empujaba `{ skipped: true }` a un arreglo que se
         * devolvía en el JSON de la respuesta del cron. Nadie lee esa
         * respuesta: Vercel la descarta, y cuando el proceso muere por falta
         * de memoria ni siquiera llega a devolverse. Ocho servicios de un
         * cliente vivo reventaron aquí cada minuto durante cinco semanas sin
         * dejar una sola marca en ningún lado.
         *
         * La regla que sale de eso: **la verdad tiene que salir del estado de
         * la base, no del valor que devuelve la corrida.** Por eso se escribe
         * en el ledger, donde vive el resto de la historia del servicio y
         * donde una consulta lo puede encontrar después.
         */
        const mensaje = err instanceof Error ? err.message : String(err);
        try {
          await this.repos.compliance.addLedgerEntry({
            tripId: row.trip.id,
            serviceOccurrenceId: row.occurrence.id,
            actorKind: "system:cron",
            actorId: null,
            action: "verificacion_fallida",
            steps: [
              {
                step: "verificacion_interrumpida",
                result: "error",
                details: {
                  error: mensaje.slice(0, 500),
                  tipo: err instanceof Error ? err.name : "desconocido",
                  nota: "La verificación de este servicio se interrumpió y NO dejó veredicto. No es 'sin evidencia': es que el árbitro no llegó a dictar.",
                },
              },
            ],
            metadata: { fallo: true, tipo: err instanceof Error ? err.name : "desconocido" },
          });
        } catch (errLedger) {
          // Si ni el rastro se puede escribir, al menos que salga por consola.
          // Nunca dejar que registrar el fallo se coma el resto de la corrida.
          console.error(
            `[verify] ${row.occurrence.id}: falló la verificación Y su registro —`,
            errLedger,
          );
        }
        console.error(`[verify] ${row.occurrence.id}: ${mensaje}`);

        results.push({
          occurrenceId: row.occurrence.id,
          skipped: true,
          error: mensaje,
        });
      }
    }

    // Misma lógica que reverify-day: tras el motor nuevo, repartir unidades
    // exclusivas entre servicios con ventanas operativas traslapadas.
    // Solo aplica a contratos sin permitirConsolidacion.
    if (verifiedIds.length > 0) {
      const exclusiveScopeIds = await this.collectExclusiveScopeIds(verifiedIds);
      const idsForExclusive = await this.filterByExclusivePolicy(exclusiveScopeIds);
      if (idsForExclusive.length > 0) {
        await this.resolveExclusiveUnitClaims(idsForExclusive);
        await this.resolveEliminationPass(idsForExclusive);
      }
    }

    return results;
  }

  /**
   * Amplía el set verificado a todos los servicios del mismo contrato+fecha,
   * para que la exclusividad vea el turno completo (no solo los recién vencidos).
   */
  private async collectExclusiveScopeIds(verifiedIds: string[]): Promise<string[]> {
    const scopeKeys = new Set<string>();
    const ids = new Set<string>(verifiedIds);

    for (const id of verifiedIds) {
      const occ = await this.repos.occurrences.findById(id);
      const contractId = occ?.profile?.contractId;
      if (!occ || !contractId) continue;
      scopeKeys.add(`${contractId}|${occ.serviceDate}`);
    }

    for (const key of scopeKeys) {
      const [contractId, serviceDate] = key.split("|");
      if (!contractId || !serviceDate) continue;
      const dayOccs = await this.repos.occurrences.findForContract(contractId);
      for (const o of dayOccs) {
        if (o.serviceDate === serviceDate) ids.add(o.id);
      }
    }

    return [...ids];
  }

  /**
   * Filtra ocurrencias cuyo contrato NO tiene permitirConsolidacion = true.
   * Las que sí lo tienen se excluyen de la resolución exclusiva.
   */
  private async filterByExclusivePolicy(occurrenceIds: string[]): Promise<string[]> {
    const result: string[] = [];
    // Cache por contractId para no cargar la misma política N veces.
    const cache = new Map<string, boolean>();
    for (const id of occurrenceIds) {
      const occ = await this.repos.occurrences.findById(id);
      const contractId = occ?.profile?.contractId ?? occ?.contractId;
      if (!contractId) { result.push(id); continue; }
      if (!cache.has(contractId)) {
        const pol = occ?.profile?.contract?.policy as ContractPolicy | undefined;
        cache.set(contractId, pol?.permitirConsolidacion ?? false);
      }
      if (!cache.get(contractId)) result.push(id);
    }
    return result;
  }

  /**
   * Herramienta interna (J-Staff / scripts): recalcula hechos con force.
   * No se dispara desde la UI del cliente al guardar política.
   *
   * `exclusiveUnits`: si varias rutas con ventanas operativas traslapadas
   * acreditan la misma unidad (calles compartidas), se queda en la de mayor
   * match KML y el resto se reevalúa sin esa unidad.
   */
  async reverifyContract(
    contractId: string,
    opts: {
      daysBack?: number;
      now?: Date;
      /** ISO date YYYY-MM-DD — si se pasa, solo ese día. */
      serviceDate?: string;
      /** Default true. false = re-ingerir desde memoria. */
      keepEvidence?: boolean;
      exclusiveUnits?: boolean;
      /** Quién pidió el re-juicio. */
      actorKind?: string;
      actorId?: string | null;
      actorIntent?: "decision" | "maintenance";
    } = {},
  ) {
    const daysBack = opts.daysBack ?? 14;
    const now = opts.now ?? new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - daysBack);
    // Operación del sistema sin contrato en foco → zona del despliegue.
    const fromIso = localDateIso(from, JTTEL_TZ);
    const keepEvidence = opts.keepEvidence ?? true;

    const occs = await this.repos.occurrences.findForContract(contractId);
    const targets = occs.filter((o) => {
      if (!o.trip) return false;
      if (opts.serviceDate) return o.serviceDate === opts.serviceDate;
      if (o.serviceDate < fromIso) return false;
      // Solo servicios cuyo deadline ya pasó (o está en ventana de gracia).
      return o.expectedDeadline.getTime() <= now.getTime() + 60 * 60 * 1000;
    });

    const results = [];
    for (const occ of targets) {
      try {
        results.push(
          await this.verifyOccurrence(occ.id, {
            force: true,
            actorIntent: opts.actorIntent ?? "decision",
            keepEvidence,
            actorKind: opts.actorKind,
            actorId: opts.actorId,
          }),
        );
      } catch (err) {
        results.push({
          occurrenceId: occ.id,
          skipped: true,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Exclusividad: si el caller no lo especifica, derivar de la política del
    // contrato. permitirConsolidacion = true → no exclusividad (una unidad
    // puede acreditar varias rutas). Default: exclusivo.
    // findForContract no carga relaciones profundas → cargar con findById.
    const applyExclusive = opts.exclusiveUnits ??
      await (async () => {
        const firstTarget = targets[0];
        if (!firstTarget) return true;
        const full = await this.repos.occurrences.findById(firstTarget.id);
        const pol = full?.profile?.contract?.policy as ContractPolicy | undefined;
        return !(pol?.permitirConsolidacion ?? false);
      })();

    if (applyExclusive) {
      await this.resolveExclusiveUnitClaims(targets.map((o) => o.id));
      await this.resolveEliminationPass(targets.map((o) => o.id));
      // Refrescar resultados tras la resolución exclusiva + eliminación.
      results.length = 0;
      for (const occ of targets) {
        const fresh = await this.repos.occurrences.findById(occ.id);
        results.push({
          occurrenceId: occ.id,
          skipped: false,
          status: fresh?.complianceFact?.status,
          observedUnitId: fresh?.complianceFact?.observedUnitId ?? null,
          observedRouteMatchPct: fresh?.complianceFact?.observedRouteMatchPct ?? null,
        });
      }
    }

    return results;
  }

  /**
   * Si la misma unidad quedó como observada en varios servicios con ventanas
   * operativas traslapadas, se queda en el de mayor `observedRouteMatchPct`
   * (empate → llegada más temprana) y los perdedores se re-verifican
   * excluyendo las unidades ya asignadas en ventanas que se traslapan.
   */
  private async resolveExclusiveUnitClaims(occurrenceIds: string[]) {
    const maxRounds = 8;
    for (let round = 0; round < maxRounds; round++) {
      const claims: ExclusiveUnitClaim[] = [];

      for (const id of occurrenceIds) {
        const occ = await this.repos.occurrences.findById(id);
        const fact = occ?.complianceFact;
        if (!fact || fact.status !== "cumplido" || !fact.observedUnitId) {
          continue;
        }
        const policy =
          (fact.contractPolicySnapshot as ContractPolicy | null | undefined) ??
          (occ.profile?.contract?.policy as ContractPolicy | undefined);
        const { startMs, endMs } = computeExclusiveContentionWindow(
          occ.expectedDeadline,
          policy ?? {},
        );
        claims.push({
          occurrenceId: id,
          unitId: fact.observedUnitId,
          matchPct: fact.observedRouteMatchPct ?? 0,
          arrivalAtMs: fact.observedArrivalAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
          windowStartMs: startMs,
          windowEndMs: endMs,
        });
      }

      const { winners, losers } = pickExclusiveUnitLosers(claims);
      if (losers.length === 0) return;

      const loserIds = [...new Set(losers.map((c) => c.occurrenceId))];
      for (const occurrenceId of loserIds) {
        const loser = losers.find((c) => c.occurrenceId === occurrenceId)!;
        // Solo excluir unidades que ganaron en ventanas que se traslapan con ésta.
        const excludeUnitIds = [
          ...new Set(
            winners
              .filter((w) =>
                evidenceWindowsOverlap(
                  w.windowStartMs,
                  w.windowEndMs,
                  loser.windowStartMs,
                  loser.windowEndMs,
                ),
              )
              .map((w) => w.unitId),
          ),
        ];
        await this.verifyOccurrence(occurrenceId, {
          force: true,
          actorIntent: "maintenance",
          keepEvidence: true,
          excludeUnitIds,
          actorKind: "system:exclusivity-pass",
          actorId: null,
        });
      }
    }
  }

  /**
   * Pasada de eliminación (Tarea A): para residuales `no_cumplido`, re-evalúa
   * excluyendo unidades ya acreditadas en ventanas traslapadas.
   * Umbrales A/B/corredor = política del contrato (sin relajar).
   * Una sola candidata no basta: el GPS debe matchear la ruta.
   */
  private async resolveEliminationPass(occurrenceIds: string[]) {
    const uniqueIds = [...new Set(occurrenceIds)];
    const confidentClaims: Array<{
      unitId: string;
      windowStartMs: number;
      windowEndMs: number;
      occurrenceId: string;
    }> = [];

    for (const id of uniqueIds) {
      const occ = await this.repos.occurrences.findById(id);
      const fact = occ?.complianceFact;
      if (!fact || fact.status !== "cumplido" || !fact.observedUnitId) continue;
      const policy =
        (fact.contractPolicySnapshot as ContractPolicy | null | undefined) ??
        (occ.profile?.contract?.policy as ContractPolicy | undefined);
      const { startMs, endMs } = computeExclusiveContentionWindow(
        occ.expectedDeadline,
        policy ?? {},
      );
      confidentClaims.push({
        unitId: fact.observedUnitId,
        windowStartMs: startMs,
        windowEndMs: endMs,
        occurrenceId: id,
      });
    }

    for (const id of uniqueIds) {
      const occ = await this.repos.occurrences.findById(id);
      const fact = occ?.complianceFact;
      if (!fact || fact.status !== "no_cumplido") continue;

      const policy =
        (fact.contractPolicySnapshot as ContractPolicy | null | undefined) ??
        (occ.profile?.contract?.policy as ContractPolicy | undefined) ??
        {};
      const residualWindow = computeExclusiveContentionWindow(
        occ.expectedDeadline,
        policy,
      );
      const occupied = occupiedUnitIdsForResidual(
        { windowStartMs: residualWindow.startMs, windowEndMs: residualWindow.endMs },
        confidentClaims,
      );
      if (occupied.length === 0) continue;

      await this.verifyOccurrence(id, {
        force: true,
        actorIntent: "maintenance",
        keepEvidence: true,
        excludeUnitIds: occupied,
        eliminationPass: true,
        eliminationExcludedUnitIds: occupied,
        actorKind: "system:elimination-pass",
        actorId: null,
      });
      // Una sola ronda: no realimentar veredictos derivados a confidentClaims
      // (evita cascada dependiente del orden de procesamiento).
    }
  }

  /**
   * Tarea 3 — contexto "llegada fuera de ventana" en el ledger.
   *
   * Condiciones (aprobadas por Asav, no relajar):
   *  1. Solo se invoca cuando el hecho quedó SIN llegada (observedArrivalAt = null).
   *  2. Confidencialidad entre clientes: `geofenceId` solo se escribe si la
   *     geocerca es del contrato de ESTA ocurrencia. Si la unidad entró a la
   *     geocerca de otro cliente, se escribe `arrivalOutsideContractGeofence: true`
   *     sin identificar el destino.
   *  3. Cero Umbrella: el GPS extendido se lee SOLO de la telemetría propia (Neon).
   *     Si no hay dato en memoria propia, no se anota nada.
   *
   * No toca el veredicto ni los tres estados: solo agrega una entrada de ledger.
   */
  private async recordArrivalOutsideWindowContext(input: {
    occurrenceId: string;
    tripId: string;
    carrierAccountId: string;
    imeis: string[];
    imeiToUnitId: Map<string, string>;
    windowEnd: Date;
    deadline: Date;
    policy: ContractPolicy;
    ownGeofence: { id: string | null; polygon: Array<{ lat: number; lng: number }> };
    actorKind: string;
    actorId: string | null;
  }): Promise<void> {
    const grace = input.policy.verificationGraceMinutes ?? 15;
    const marginAfter = input.policy.evidenceMarginMinutesAfter ?? 0;
    const extendedEnd = new Date(input.deadline);
    extendedEnd.setMinutes(
      extendedEnd.getMinutes() + grace + Math.max(60, marginAfter),
    );

    // La ventana extendida empieza donde terminó la del veredicto.
    if (extendedEnd.getTime() <= input.windowEnd.getTime()) return;
    if (input.imeis.length === 0) return;

    // (3) SOLO telemetría propia (Neon). Nunca Umbrella en vivo.
    const points = await this.repos.telemetry.getForImeis(
      input.imeis,
      input.windowEnd,
      extendedEnd,
    );
    if (points.length === 0) return;

    const sorted = [...points].sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
    );

    const ownPolygon = input.ownGeofence.polygon;
    const hasOwnPolygon = Array.isArray(ownPolygon) && ownPolygon.length >= 3;

    // Primer punto que entra a la geocerca PROPIA del contrato.
    let ownEntry: { at: Date; imei: string } | null = null;
    if (hasOwnPolygon) {
      for (const p of sorted) {
        if (pointInPolygon({ lat: p.latitude, lng: p.longitude }, ownPolygon)) {
          ownEntry = { at: p.recordedAt, imei: p.imei };
          break;
        }
      }
    }

    if (ownEntry) {
      const unitId = input.imeiToUnitId.get(ownEntry.imei) ?? null;
      const minutesAfter = Math.round(
        (ownEntry.at.getTime() - input.windowEnd.getTime()) / 60_000,
      );
      await this.repos.compliance.addLedgerEntry({
        tripId: input.tripId,
        serviceOccurrenceId: input.occurrenceId,
        actorKind: input.actorKind,
        actorId: input.actorId,
        action: "contexto_calibracion",
        steps: [
          {
            step: "llegada_fuera_ventana",
            result: "info",
            details: {
              arrivalAt: ownEntry.at.toISOString(),
              minutesAfterWindowEnd: minutesAfter,
              geofenceId: input.ownGeofence.id,
              ...(unitId ? { unitId } : {}),
              note: "Llegada a la geocerca del contrato después del fin de ventana. Informativo; no cambia el veredicto.",
            },
          },
        ],
        metadata: { source: "memory", scope: "own_contract" },
      });
      return;
    }

    // (2) No entró a la geocerca propia. ¿Entró a alguna geocerca de OTRO
    // contrato del mismo carrier? Solo para el flag neutro — jamás el destino.
    const otherPolygons = await this.getOtherCarrierGeofencePolygons(
      input.carrierAccountId,
      input.ownGeofence.id,
    );
    if (otherPolygons.length === 0) return;

    let neutralEntryAt: Date | null = null;
    for (const p of sorted) {
      const hit = otherPolygons.some((poly) =>
        pointInPolygon({ lat: p.latitude, lng: p.longitude }, poly),
      );
      if (hit) {
        neutralEntryAt = p.recordedAt;
        break;
      }
    }
    if (!neutralEntryAt) return;

    const minutesAfter = Math.round(
      (neutralEntryAt.getTime() - input.windowEnd.getTime()) / 60_000,
    );
    await this.repos.compliance.addLedgerEntry({
      tripId: input.tripId,
      serviceOccurrenceId: input.occurrenceId,
      actorKind: input.actorKind,
      actorId: input.actorId,
      action: "contexto_calibracion",
      steps: [
        {
          step: "llegada_fuera_ventana",
          result: "info",
          details: {
            // Confidencialidad: sin geofenceId, sin nombre de destino.
            arrivalOutsideContractGeofence: true,
            arrivalAt: neutralEntryAt.toISOString(),
            minutesAfterWindowEnd: minutesAfter,
            note: "Se detectó llegada a una geocerca fuera de este contrato después del fin de ventana. Informativo; no identifica el destino ni cambia el veredicto.",
          },
        },
      ],
      metadata: { source: "memory", scope: "other_contract" },
    });
  }

  /**
   * Geocercas destino de OTROS contratos del mismo carrier (solo polígonos,
   * sin id/nombre) para el flag neutro de confidencialidad. Excluye la propia.
   */
  private async getOtherCarrierGeofencePolygons(
    carrierAccountId: string,
    ownGeofenceId: string | null,
  ): Promise<Array<Array<{ lat: number; lng: number }>>> {
    const contracts = await this.repos.contracts.findForCarrier(carrierAccountId);
    const polygons: Array<Array<{ lat: number; lng: number }>> = [];
    const seen = new Set<string>();
    for (const c of contracts) {
      const profiles = await this.repos.profiles.findForContract(c.id);
      for (const p of profiles) {
        const g = p.geofence;
        if (!g || !g.polygon || g.polygon.length < 3) continue;
        if (ownGeofenceId && g.id === ownGeofenceId) continue;
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        polygons.push(g.polygon as Array<{ lat: number; lng: number }>);
      }
    }
    return polygons;
  }

  /**
   * ¿Este servicio salió de la cola de reintento, y por qué?
   *
   * Devuelve la razón si lo retiró (y la deja escrita en el ledger y en el
   * estado de evidencia del viaje), o `null` si todavía tiene sentido volver a
   * intentarlo. NO toca el veredicto: eso es `pendiente_evidencia` y así se
   * queda — sin evidencia no es incumplimiento.
   */
  /** Hasta qué instante tiene dato guardado el archivador para ese carrier. */
  private async marcaDeAguaDe(carrierAccountId: string): Promise<Date | null> {
    const cache = this.marcaDeAguaPorCarrier.get(carrierAccountId);
    if (cache !== undefined) return cache;
    const marca = await this.repos.telemetry.getWatermark(carrierAccountId);
    const valor = marca?.lastRecordedAt ?? null;
    this.marcaDeAguaPorCarrier.set(carrierAccountId, valor);
    return valor;
  }

  private async evaluarSinEvidenciaPosible(input: {
    occurrenceId: string;
    tripId: string;
    carrierAccountId: string;
    finDeVentana: Date;
    actorKind: string;
    actorId: string | null;
  }): Promise<RazonSinEvidencia | null> {
    let horizonte = this.horizonteMemoriaPorCarrier.get(input.carrierAccountId);
    if (horizonte === undefined) {
      horizonte = await this.repos.telemetry.getMemoryHorizon(input.carrierAccountId);
      this.horizonteMemoriaPorCarrier.set(input.carrierAccountId, horizonte);
    }

    const intentosPrevios = await this.repos.compliance.countAutomaticVerifications(
      input.occurrenceId,
    );

    const razon = razonSinEvidenciaPosible({
      finDeVentana: input.finDeVentana,
      horizonteDeMemoria: horizonte,
      intentosPrevios,
      ahora: new Date(),
    });
    if (!razon) return null;

    await this.repos.evidence.updateTripStatus(input.tripId, "sin_evidencia_posible");
    await this.repos.compliance.addLedgerEntry({
      tripId: input.tripId,
      serviceOccurrenceId: input.occurrenceId,
      actorKind: input.actorKind,
      actorId: input.actorId,
      action: "sin_evidencia_posible",
      steps: [
        {
          step: "retiro_de_la_cola",
          result: razon,
          details: {
            explicacion: explicarRazon(razon),
            intentosPrevios,
            finDeVentana: input.finDeVentana.toISOString(),
            horizonteDeMemoria: horizonte ? horizonte.toISOString() : null,
            nota: "El veredicto NO cambia: sigue en pendiente_evidencia. Lo que cambia es que deja de reintentarse cada minuto. Reversible: una re-verificación forzada lo vuelve a juzgar.",
          },
        },
      ],
      metadata: { razon, intentosPrevios },
    });

    return razon;
  }

  async verifyOccurrence(
    occurrenceId: string,
    opts: VerifyOccurrenceOpts = {},
  ) {
    const occurrence = await this.repos.occurrences.findById(occurrenceId);
    if (!occurrence?.trip) {
      throw new Error("Ocurrencia o viaje no encontrado");
    }

    /*
     * LA LLAVE. Antes de leer evidencia, antes de borrar el hecho pendiente,
     * antes de cualquier cosa que deje marca.
     *
     * Va aquí y no en la consulta del cron porque hay CUATRO puertas hasta este
     * punto —`processPending` (cron y worker), `reverifyContract`, y dos rutas
     * de API que llaman `verifyOccurrence` directo— y un filtro en la consulta
     * solo cierra una. Este es el único sitio por el que pasan las cuatro.
     *
     * No lanza: devuelve. Las rutas de API llaman esto de cara a un humano, y un
     * throw se convertiría en 500 sin decir qué pasó. El motivo viaja en el
     * resultado para que quien haya llamado pueda enunciarlo.
     */
    const motivoDemo = motivoCuentaDemo({
      cuentaClienteEsDemo: occurrence.contract?.client?.isDemo,
      estadoDelContrato: occurrence.contract?.status,
    });
    if (motivoDemo) {
      return {
        occurrenceId,
        skipped: true as const,
        cuentaDeEjemplo: true as const,
        motivo: motivoDemo,
      };
    }

    const trip = occurrence.trip;
    const existingPoints = await this.repos.evidence.getPointsForTrip(trip.id);
    const reuseEvidence = Boolean(opts.keepEvidence && existingPoints.length > 0);

    const resolvedActorKind = opts.actorKind ?? "system:cron";
    const resolvedActorId = opts.actorId ?? null;
    let pendingHistoryId: string | null = null;
    // Guardamos el hecho pendiente COMPLETO para archivar condicionalmente después de
    // saveFact, solo si el veredicto cambió (ver comentario en el bloque post-saveFact).
    let pendingRetryFact: ComplianceFact | null = null;
    // Se lee ANTES de borrar nada: después de este bloque la ocurrencia se
    // queda sin hecho por construcción y ya no se puede distinguir un primer
    // veredicto de un re-juicio.
    const esPrimerVeredicto = !occurrence.complianceFact;

    // Sin force: cumplido/no_cumplido son definitivos; pendiente se reintenta.
    if (occurrence.complianceFact) {
      if (
        !opts.force &&
        occurrence.complianceFact.status !== "pendiente_evidencia"
      ) {
        return { occurrenceId, skipped: true, status: occurrence.complianceFact.status };
      }
      if (opts.force && opts.actorIntent === "decision") {
        // Decisión explícita (human / system:cli): archiva siempre, aunque el resultado
        // no cambie — alguien decidió revisarlo, y eso es información.
        pendingHistoryId = await this.repos.compliance.archiveAndDeleteFact(
          occurrenceId,
          resolvedActorKind,
          resolvedActorId,
        );
      } else {
        // Retry (sin force) o pasada automática con actorIntent:"maintenance"
        // (exclusivity-pass / elimination-pass): no archivar ahora; decidir
        // post-saveFact solo si el veredicto cambió.
        // Regla (diseño, no accidente): se versiona SOLO cuando cambia el VEREDICTO.
        // Un GPS sin señal 6 h = 360 reintentos idénticos; archivar cada uno
        // inundaría la historia. Las pasadas automáticas son mecánicas — no representan
        // una decisión aunque usen force:true.
        // Se pela `observedUnit` (relación anidada del findById, no columna de la tabla)
        // para que la foto quede en la forma plana de compliance_facts.
        const { observedUnit: _observedUnit, ...factRow } = occurrence.complianceFact;
        pendingRetryFact = factRow;
        await this.repos.compliance.deleteFactForOccurrence(occurrenceId);
      }
      if (!reuseEvidence) {
        await this.repos.evidence.clearPointsForTrip(trip.id);
        await this.repos.evidence.updateTripStatus(trip.id, "en_espera");
      }
    }

    const profile = occurrence.profile!;
    const contract = profile.contract!;
    const policy = contract.policy as ContractPolicy;

    const possibleUnitIds = await this.repos.profiles.getPossibleUnitIds(profile.id);
    const devices = await this.repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const units = await this.repos.fleet.getUnitsForCarrier(contract.carrierAccountId);

    const candidateDevices = devices.filter((d) => {
      if (possibleUnitIds.length === 0) return true;
      return units.some(
        (u) => possibleUnitIds.includes(u.id) && d.carrierAccountId === contract.carrierAccountId,
      );
    });

    const imeis = candidateDevices.map((d) => d.imei);
    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));

    const resolveUnit = async (imei: string, at: Date) => {
      const device = imeiToDevice.get(imei);
      if (!device) return null;
      const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, at);
      if (!assignment) return null;
      return { unitId: assignment.unitId, deviceId: device.id };
    };

    // Ya no existe "umbrella": el motor no habla con el proveedor. El valor
    // sigue en entradas de ledger anteriores al 2026-08-03, así que quien las
    // LEE debe contemplarlo — pero no se escribe nunca más.
    let ingestSource: "memory" | "none" | "cached" = "none";
    let ingestStatus: "disponible" | "parcial" | "indisponible" = "indisponible";
    let ingestPointCount = 0;
    let razonRetiro: RazonSinEvidencia | null = null;
    let motivoPendiente: MotivoSinEvidencia | null = null;

    if (reuseEvidence) {
      ingestSource = "cached";
      ingestPointCount = existingPoints.length;
      ingestStatus =
        trip.evidenceStatus === "disponible" || trip.evidenceStatus === "parcial"
          ? trip.evidenceStatus
          : existingPoints.some((p) => p.unitId)
            ? "disponible"
            : "parcial";
    } else {
      /*
       * EL MOTOR SOLO LEE LA MEMORIA PROPIA. NUNCA SALE A BUSCAR.
       *
       * El archivador es la única puerta al proveedor de GPS. Si el expediente
       * está vacío, el árbitro dicta `pendiente_evidencia` y se acabó: no
       * pregunta, no espera, no depende de que un tercero conteste.
       *
       * POR QUÉ. La caída en vivo que vivía aquí convertía un servicio
       * irresoluble en una llamada saliente por minuto, y esas llamadas se
       * formaban en una cola de proceso que creció hasta tumbar
       * `/api/cron/verify` cuatro veces el 3 de agosto de 2026. Verificar es
       * juzgar con lo que hay; conseguir los datos es otro trabajo, con su
       * propio cron, su propio ritmo y su propio límite de peticiones.
       *
       * NO CUESTA UN SOLO VEREDICTO, y está medido, no supuesto:
       *   · Umbrella no entregó UN punto en 30 días — 0 verificaciones con
       *     origen `umbrella` en el ledger; las 162 787 que salieron a buscar
       *     volvieron con `none`.
       *   · De 928 ocurrencias vencidas en 30 días, CERO tenían la memoria
       *     vacía para su ventana.
       * La puerta ya estaba cerrada de hecho: esto quita el cable muerto.
       *
       * Si un día la memoria no alcanza una ventana, lo que se arregla es el
       * archivador — no que el árbitro salga a suplirlo.
       */
      const memoryPoints = await this.repos.telemetry.getForImeis(
        imeis,
        trip.evidenceWindowStart,
        trip.evidenceWindowEnd,
      );

      if (memoryPoints.length > 0) {
        const resolved = memoryPoints.map((p) => ({
          imei: p.imei,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed ?? undefined,
          recordedAt: p.recordedAt,
          deviceId: p.deviceId ?? undefined,
          unitId: p.unitId ?? undefined,
        }));
        await this.repos.evidence.savePoints(trip.id, resolved);
        ingestStatus = resolved.some((p) => p.unitId) ? "disponible" : "parcial";
        await this.repos.evidence.updateTripStatus(trip.id, ingestStatus);
        ingestSource = "memory";
        ingestPointCount = resolved.length;
      } else {
        // Sin memoria no hay con qué juzgar, y no hay a quién preguntarle.
        ingestSource = "none";
        ingestStatus = "indisponible";
        ingestPointCount = 0;
        await this.repos.evidence.updateTripStatus(trip.id, "indisponible");
      }
    }

    // Ni la memoria propia ni el proveedor trajeron un punto. ¿Tiene sentido
    // volver a intentarlo el minuto que viene, o este servicio no se puede
    // resolver? Sin esta pregunta, cinco servicios de junio se reintentaron
    // 31 400 veces cada uno. Ver `sin-evidencia-posible.ts`.
    if (ingestStatus === "indisponible") {
      // ¿La memoria todavía no llega, o el camión no transmitió? Instrumental
      // interno: va al ledger y a J-Staff, NUNCA a la cara del cliente.
      motivoPendiente = motivoSinEvidencia({
        finDeVentana: trip.evidenceWindowEnd,
        marcaDeAgua: await this.marcaDeAguaDe(contract.carrierAccountId),
      });
    }

    if (ingestStatus === "indisponible" && !opts.force) {
      razonRetiro = await this.evaluarSinEvidenciaPosible({
        occurrenceId,
        tripId: trip.id,
        carrierAccountId: contract.carrierAccountId,
        finDeVentana: trip.evidenceWindowEnd,
        actorKind: resolvedActorKind,
        actorId: resolvedActorId,
      });
    }

    // Construye imei→unidad una sola vez (preferir unitId ya en evidencia).
    const storedPoints = reuseEvidence
      ? existingPoints
      : await this.repos.evidence.getPointsForTrip(trip.id);
    const imeiToUnitId = new Map<string, string>();
    const unresolvedImeis = new Set<string>();
    for (const point of storedPoints) {
      if (point.unitId) {
        imeiToUnitId.set(point.imei, point.unitId);
      } else if (!imeiToUnitId.has(point.imei)) {
        unresolvedImeis.add(point.imei);
      }
    }
    for (const imei of unresolvedImeis) {
      const device = imeiToDevice.get(imei);
      if (!device) continue;
      const sample = storedPoints.find((p) => p.imei === imei)!;
      const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, sample.recordedAt);
      if (assignment) imeiToUnitId.set(imei, assignment.unitId);
    }

    const evidencePoints = storedPoints.map((p) => ({
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? undefined,
      timestamp: p.recordedAt,
    }));

    const geofence = profile.geofence!;
    const routeId = profile.routeShift?.routeId;

    // --- Multi-variante: cargar TODAS las variantes activas con su versión vigente ---
    // VARIANTE = caminos alternos que coexisten hoy (ej. MEX-45 o Panamericana).
    // VERSIÓN  = historia temporal de una variante (versión vigente en la fecha del servicio).
    // Se evalúa contra cada variante usando la misma implementación de match (evaluateUnitRouteMatch
    // dentro de verifyService — NO se duplica).
    const variants = routeId
      ? await this.repos.routes.getActiveVariantVersionsForDate(routeId, occurrence.expectedDeadline)
      : [];

    // Fallback: si no hay variantes (ruta sin KML o pre-migración), usar getKmlVersionForDate.
    if (variants.length === 0 && routeId) {
      const fallback = await this.repos.routes.getKmlVersionForDate(
        routeId,
        occurrence.expectedDeadline,
      );
      if (fallback?.waypoints?.length) {
        variants.push({
          variantId: "",
          variantName: "Principal",
          kmlVersionId: fallback.id,
          waypoints: fallback.waypoints,
        });
      }
    }

    // Corpus de rutas hermanas para TF-IDF: solo variante "Principal" de cada ruta.
    const routeCorpus: Array<Array<{ lat: number; lng: number }>> = [];
    const contractProfiles = await this.repos.profiles.findForContract(occurrence.contractId);
    const seenRouteIds = new Set<string>();
    for (const p of contractProfiles) {
      const rid = p.routeShift?.routeId;
      if (!rid || seenRouteIds.has(rid)) continue;
      seenRouteIds.add(rid);
      const kml = await this.repos.routes.getKmlVersionForDate(
        rid,
        occurrence.expectedDeadline,
      );
      if (kml?.waypoints?.length) routeCorpus.push(kml.waypoints);
    }

    const excluded = new Set(opts.excludeUnitIds ?? []);
    const enrichedPoints = evidencePoints
      .filter((p) => {
        const unitId = imeiToUnitId.get(p.imei);
        return !(unitId && excluded.has(unitId));
      })
      .map((p) => ({
        ...p,
        imei: imeiToUnitId.get(p.imei) ?? p.imei,
      }));

    const coverageWindow = computeExclusiveContentionWindow(
      occurrence.expectedDeadline,
      policy,
    );

    const baseInput = {
      occurrenceId,
      expectedDeadline: occurrence.expectedDeadline,
      toleranceMinutes: policy.toleranceMinutes,
      routeStrictness: policy.routeStrictness,
      kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
      kmlCorridorMeters: policy.kmlCorridorMeters ?? 120,
      kmlCorridorMinPct: policy.kmlCorridorMinPct ?? 60,
      kmlOriginToleranceFraction: policy.kmlOriginToleranceFraction ?? 0.15,
      // C12 · sale de la política del contrato, no de un default del motor.
      frechetMaxKm: policy.frechetMaxKm ?? DEFAULT_FRECHET_MAX_KM,
      geofencePolygon: geofence.polygon,
      routeCorpus: routeCorpus.length > 0 ? routeCorpus : undefined,
      evidencePoints: enrichedPoints,
      excusableReasons: policy.excusableReasons,
      coverageWindowStart: new Date(coverageWindow.startMs),
      coverageWindowEnd: new Date(coverageWindow.endMs),
      evidenceMinCoveragePct: policy.evidenceMinCoveragePct ?? 80,
      evidenceMaxGapMinutes: policy.evidenceMaxGapMinutes ?? 10,
    };

    // --- Evaluación multi-variante ---
    let verification: VerificationResult;
    let servedVariantId: string | null = null;

    if (variants.length <= 1) {
      // 0 o 1 variante: flujo idéntico al anterior (regresión cero).
      verification = verifyService({
        ...baseInput,
        kmlWaypoints: variants[0]?.waypoints,
      });
      if (verification.status === "cumplido" && variants[0]?.variantId) {
        servedVariantId = variants[0].variantId;
      }
    } else {
      // N variantes: evaluar cada una, elegir la mejor.
      const variantResults: Array<{
        variantId: string;
        variantName: string;
        result: VerificationResult;
      }> = [];
      for (const v of variants) {
        const result = verifyService({
          ...baseInput,
          kmlWaypoints: v.waypoints,
        });
        variantResults.push({ variantId: v.variantId, variantName: v.variantName, result });
      }

      // Elegir mejor variante:
      // 1. Prioridad: cumplido > todo lo demás.
      // 2. Entre cumplidos: min(A,B) del winner → Fréchet → dirección → llegada → variantId (estabilidad).
      // 3. Si ninguno cumplido: tomar el "mejor" no_cumplido (mismo ranking, para el ledger).
      const cumplidos = variantResults.filter((v) => v.result.status === "cumplido");
      const pool = cumplidos.length > 0 ? cumplidos : variantResults;

      pool.sort((a, b) => {
        const wa = a.result.candidateUnits.find((c) => c.unitId === a.result.observedUnitId);
        const wb = b.result.candidateUnits.find((c) => c.unitId === b.result.observedUnitId);
        const scoreA = wa ? Math.min(wa.routeMatchPct, wa.corridorPrecisionPct) : -1;
        const scoreB = wb ? Math.min(wb.routeMatchPct, wb.corridorPrecisionPct) : -1;
        const diff = scoreB - scoreA;
        if (Math.abs(diff) >= 1) return diff;
        const fA = wa?.frechetKm ?? Infinity;
        const fB = wb?.frechetKm ?? Infinity;
        if (Math.abs(fA - fB) >= 0.05) return fA - fB;
        const dA = wa?.directionSimilarity ?? 0;
        const dB = wb?.directionSimilarity ?? 0;
        if (Math.abs(dA - dB) >= 0.05) return dB - dA;
        const tA = a.result.observedArrivalAt?.getTime() ?? Infinity;
        const tB = b.result.observedArrivalAt?.getTime() ?? Infinity;
        if (tA !== tB) return tA - tB;
        // Desempate determinista final: orden lexicográfico de variantId.
        return a.variantId.localeCompare(b.variantId);
      });

      const best = pool[0]!;
      verification = best.result;
      if (verification.status === "cumplido") {
        servedVariantId = best.variantId;
      }

      // Registrar evaluación multi-variante en el ledger.
      verification.ledgerSteps.push({
        step: "multi_variante",
        result: `${variantResults.length}_evaluadas`,
        details: {
          variantCount: variantResults.length,
          results: variantResults.map((v) => {
            const w = v.result.candidateUnits.find((c) => c.unitId === v.result.observedUnitId);
            return {
              variantId: v.variantId,
              variantName: v.variantName,
              status: v.result.status,
              bestUnit: v.result.observedUnitId,
              routeMatchPct: v.result.observedRouteMatchPct,
              corridorPrecisionPct: w?.corridorPrecisionPct,
            };
          }),
          selectedVariantId: servedVariantId,
        },
      });
    }

    verification.servedVariantId = servedVariantId;
    const finalStatus = verification.status;

    let observedUnitId: string | null = null;
    if (verification.observedUnitId && finalStatus === "cumplido") {
      const winner = verification.candidateUnits.find(
        (c) => c.unitId === verification.observedUnitId,
      );
      const candidate =
        (winner && units.some((u) => u.id === winner.unitId) ? winner.unitId : null) ??
        imeiToUnitId.get(verification.observedUnitId) ??
        units.find((u) => u.id === verification.observedUnitId)?.id ??
        null;
      // Solo persistir UUID de unidad real (nunca un IMEI crudo).
      observedUnitId = candidate && units.some((u) => u.id === candidate) ? candidate : null;
    }

    // Instrumento, no veredicto: cuánto duró de verdad este recorrido. De
    // aquí sale el ancho de la ventana de las ocurrencias futuras de esta
    // ruta×turno. Va aparte del hecho y nunca lo altera; si falla, el sellado
    // sigue igual (por eso el try/catch).
    try {
      const measuredWaypoints =
        (servedVariantId
          ? variants.find((v) => v.variantId === servedVariantId)?.waypoints
          : undefined) ?? variants[0]?.waypoints;
      const measuredKmlVersionId =
        (servedVariantId
          ? variants.find((v) => v.variantId === servedVariantId)?.kmlVersionId
          : undefined) ?? variants[0]?.kmlVersionId ?? null;

      if (measuredWaypoints?.length && profile.routeShiftId) {
        const arrivalByUnit = new Map<string, Date | null>();
        if (verification.observedUnitId && verification.observedArrivalAt) {
          arrivalByUnit.set(verification.observedUnitId, verification.observedArrivalAt);
        }
        const measured = measureBestTraversal(
          enrichedPoints,
          measuredWaypoints,
          corridorKmFromMeters(policy.kmlCorridorMeters),
          {
            arrivalAtByUnit: arrivalByUnit,
            window: {
              start: trip.evidenceWindowStart,
              end: trip.evidenceWindowEnd,
            },
          },
        );
        if (measured?.measurement.durationMinutes != null) {
          await this.repos.routeTraversals.record({
            routeShiftId: profile.routeShiftId,
            serviceOccurrenceId: occurrenceId,
            serviceDate: occurrence.serviceDate,
            kmlVersionId: measuredKmlVersionId,
            durationMinutes: measured.measurement.durationMinutes,
            lowerBound: measured.measurement.lowerBound,
            pointsInCorridor: measured.measurement.pointsInCorridor,
            unitId: units.some((u) => u.id === measured.unitId) ? measured.unitId : null,
          });
        }
      }
    } catch (err) {
      console.error(
        `[medicion-recorrido] ${occurrenceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const fact = await this.repos.compliance.saveFact({
      serviceOccurrenceId: occurrenceId,
      tripId: trip.id,
      expectedDeadline: occurrence.expectedDeadline,
      expectedGeofenceId: occurrence.expectedGeofenceId,
      referenceUnitId: occurrence.referenceUnitId,
      observedUnitId,
      observedArrivalAt:
        finalStatus === "cumplido" ? verification.observedArrivalAt : null,
      observedRouteMatchPct:
        finalStatus === "cumplido" ? verification.observedRouteMatchPct : null,
      servedVariantId: finalStatus === "cumplido" ? servedVariantId : null,
      status: finalStatus,
      timing: finalStatus === "cumplido" ? verification.timing : null,
      lateExcusable: finalStatus === "cumplido" ? verification.lateExcusable : false,
      routeStrictnessApplied: verification.routeStrictnessApplied,
      contractPolicySnapshot: policy,
    });

    // Enlazar la fila de historial al hecho sucesor recién creado.
    if (pendingHistoryId) {
      await this.repos.compliance.updateHistorySuccessor(pendingHistoryId, fact.id);
    }

    // Retry con cambio de veredicto: archivar ahora que ya sabemos el nuevo estado.
    // Si el veredicto NO cambió (pendiente→pendiente), no se versiona — ver comentario arriba.
    if (pendingRetryFact && fact.status !== pendingRetryFact.status) {
      const retryHistoryId = await this.repos.compliance.insertHistoryEntry(
        pendingRetryFact,
        resolvedActorKind,
        resolvedActorId,
      );
      await this.repos.compliance.updateHistorySuccessor(retryHistoryId, fact.id);
    }

    // ¿Este primer veredicto llega con semanas de retraso? Entonces el
    // expediente tiene que decir por qué, o aparecería indistinguible de uno
    // normal y nadie —ni el cliente ni el transportista— podría entenderlo.
    const tardia = recuperacionTardia({
      esPrimerVeredicto,
      plazo: occurrence.expectedDeadline,
      selladoEn: new Date(),
      puntosDeEvidencia: ingestPointCount,
      filasQueCabianEnUnaSentencia: FILAS_QUE_CABIAN_ANTES_DEL_LOTEO,
    });
    if (tardia) {
      await this.repos.compliance.addLedgerEntry({
        tripId: trip.id,
        serviceOccurrenceId: occurrenceId,
        actorKind: resolvedActorKind,
        actorId: resolvedActorId,
        action: "recuperacion_tardia",
        steps: [
          {
            step: "primer_veredicto_tardio",
            result: tardia.causa,
            details: {
              explicacion: tardia.explicacion,
              diasDeRetraso: tardia.diasDeRetraso,
              horasDeRetraso: tardia.horasDeRetraso,
              plazo: occurrence.expectedDeadline.toISOString(),
              puntosDeEvidencia: ingestPointCount,
              origenDeLaEvidencia: ingestSource,
            },
          },
        ],
        metadata: {
          recuperacionTardia: true,
          causa: tardia.causa,
          diasDeRetraso: tardia.diasDeRetraso,
        },
      });
    }

    await this.repos.compliance.addLedgerEntry({
      tripId: trip.id,
      serviceOccurrenceId: occurrenceId,
      actorKind: resolvedActorKind,
      actorId: resolvedActorId,
      action: opts.eliminationPass
        ? "eliminacion_candidatas"
        : "verificacion_automatica",
      steps: verification.ledgerSteps,
      metadata: {
        ingestStatus,
        ingestSource,
        pointCount: ingestPointCount,
        // Solo cuando no llegó un punto. Interno: J-Staff lo lee, el cliente no.
        ...(motivoPendiente ? { motivoSinEvidencia: motivoPendiente } : {}),
        candidateUnits: verification.candidateUnits,
        ...(opts.eliminationPass
          ? {
              eliminationPass: true,
              excludedOccupiedUnitIds: opts.eliminationExcludedUnitIds ?? opts.excludeUnitIds ?? [],
              policyThresholds: {
                kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
                kmlCorridorMinPct: policy.kmlCorridorMinPct ?? 60,
                kmlCorridorMeters: policy.kmlCorridorMeters ?? 120,
              },
            }
          : {}),
      },
    });

    // Tarea 3 (aprobada con 3 condiciones): contexto de calibración en el ledger.
    // (1) SOLO cuando el hecho quedó sin llegada (observedArrivalAt = null).
    // (2) Confidencialidad: geofenceId solo si es del contrato de esta ocurrencia;
    //     entrada a geocerca de otro cliente → flag neutro, sin identificar destino.
    // (3) Cero Umbrella: se lee EXCLUSIVAMENTE de la telemetría propia (Neon).
    const savedArrivalAt =
      finalStatus === "cumplido" ? verification.observedArrivalAt : null;
    // Si el servicio acaba de salir de la cola por no tener evidencia posible,
    // este contexto tampoco la va a encontrar: lee de la misma memoria propia
    // que ya sabemos que no cubre la ventana. Saltarlo evita una consulta por
    // los IMEIs del carrier entero cuyo resultado conocemos.
    if (!savedArrivalAt && !razonRetiro) {
      try {
        await this.recordArrivalOutsideWindowContext({
          occurrenceId,
          tripId: trip.id,
          carrierAccountId: contract.carrierAccountId,
          imeis,
          imeiToUnitId,
          windowEnd: trip.evidenceWindowEnd,
          deadline: occurrence.expectedDeadline,
          policy,
          ownGeofence: {
            id: profile.geofenceId ?? occurrence.expectedGeofenceId ?? null,
            polygon: geofence.polygon,
          },
          actorKind: resolvedActorKind,
          actorId: resolvedActorId,
        });
      } catch (err) {
        // El contexto es informativo; nunca debe tumbar la verificación.
        console.error("[verify] recordArrivalOutsideWindowContext:", err);
      }
    }

    // Se avisa cuando el veredicto CAMBIA, no cada vez que se recalcula.
    //
    // Antes se creaba una notificación por corrida: cinco servicios atorados
    // reintentándose cada minuto produjeron 159 783 avisos de `sin_evidencia`
    // —~6 800 al día— que decían todos exactamente lo mismo. Eso no es avisar,
    // es tapar: la notificación que sí importaba quedaba enterrada, y la
    // pantalla que las lee se quedó sin memoria al traerlas.
    const veredictoCambio = !pendingRetryFact || pendingRetryFact.status !== finalStatus;

    if (finalStatus === "pendiente_evidencia" && veredictoCambio) {
      await this.repos.notifications.create({
        accountId: contract.clientAccountId,
        type: "sin_evidencia",
        title: "Servicio pendiente por evidencia",
        body: `El servicio del ${occurrence.serviceDate} quedó pendiente por falta de evidencia GPS.`,
        metadata: { occurrenceId },
      });
    } else if (
      finalStatus === "cumplido" &&
      verification.timing === "tarde" &&
      !verification.lateExcusable
    ) {
      await this.repos.notifications.create({
        accountId: contract.clientAccountId,
        type: "tarde",
        title: "Servicio con retraso",
        body: `El servicio del ${occurrence.serviceDate} cumplió la ruta pero llegó tarde.`,
        metadata: { occurrenceId, factId: fact?.id },
      });
    }

    return {
      occurrenceId,
      skipped: false,
      status: finalStatus,
      factId: fact?.id,
      ingestSource,
      pointCount: ingestPointCount,
      /** Si salió de la cola de reintento, por qué. `null` = sigue en cola. */
      sinEvidenciaPosible: razonRetiro,
    };
  }

}
