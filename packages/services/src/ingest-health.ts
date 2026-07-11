/**
 * Salud de ingesta GPS (Fase 0): heartbeat / dead-man switch.
 * Si no entran puntos nuevos en X minutos en horario operativo → alerta.
 */
import type { Repositories } from "@jtel/db";

const DEFAULT_STALE_MINUTES = 15;

/** Lunes–sábado 05:00–22:00 America/Ciudad_Juarez (UTC-6 sin DST en práctica MX). */
export function isOperationalHours(now = new Date(), timeZone = "America/Ciudad_Juarez"): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  if (weekday === "Sun") return false;
  return hour >= 5 && hour < 22;
}

export type IngestHealthSummary = {
  checkedAt: string;
  operationalHours: boolean;
  staleMinutesThreshold: number;
  carriers: Array<{
    carrierAccountId: string;
    name: string;
    watermarkAgeMinutes: number | null;
    latestPointAgeMinutes: number | null;
    pointsLastHour: number;
    stale: boolean;
    alertCreated: boolean;
  }>;
  alertsCreated: number;
  alertsResolved: number;
};

export class IngestHealthService {
  constructor(
    private repos: Repositories,
    private opts: { staleMinutes?: number } = {},
  ) {}

  async checkHeartbeat(now = new Date()): Promise<IngestHealthSummary> {
    const staleMinutes = this.opts.staleMinutes ?? DEFAULT_STALE_MINUTES;
    const operationalHours = isOperationalHours(now);
    const carriers = await this.repos.accounts.listByType("carrier");
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const rows: IngestHealthSummary["carriers"] = [];
    let alertsCreated = 0;
    let alertsResolved = 0;

    for (const carrier of carriers) {
      const watermark = await this.repos.telemetry.getWatermark(carrier.id);
      const watermarkAgeMinutes = watermark
        ? Math.max(0, (now.getTime() - watermark.lastRecordedAt.getTime()) / 60_000)
        : null;
      const latestPointAgeMinutes = await this.repos.telemetry.latestPointAgeMinutes(carrier.id);
      const pointsLastHour = await this.repos.telemetry.countPointsSince(carrier.id, oneHourAgo);

      const age =
        latestPointAgeMinutes ??
        watermarkAgeMinutes ??
        (operationalHours ? Number.POSITIVE_INFINITY : 0);
      const stale = operationalHours && age > staleMinutes;

      let alertCreated = false;
      if (stale) {
        const existing = await this.repos.ingestAlerts.findOpenByKind(
          "heartbeat_stale",
          carrier.id,
        );
        if (!existing) {
          await this.repos.ingestAlerts.create({
            carrierAccountId: carrier.id,
            kind: "heartbeat_stale",
            severity: "critical",
            message: `Ingesta detenida > ${staleMinutes} min para ${carrier.name} (último punto hace ${Math.round(age)} min)`,
            metadata: {
              staleMinutesThreshold: staleMinutes,
              latestPointAgeMinutes,
              watermarkAgeMinutes,
              pointsLastHour,
            },
          });
          alertCreated = true;
          alertsCreated += 1;
        }
      } else {
        const open = await this.repos.ingestAlerts.findOpenByKind("heartbeat_stale", carrier.id);
        if (open) {
          await this.repos.ingestAlerts.resolveOpen("heartbeat_stale", carrier.id);
          alertsResolved += 1;
        }
      }

      rows.push({
        carrierAccountId: carrier.id,
        name: carrier.name,
        watermarkAgeMinutes,
        latestPointAgeMinutes,
        pointsLastHour,
        stale,
        alertCreated,
      });
    }

    return {
      checkedAt: now.toISOString(),
      operationalHours,
      staleMinutesThreshold: staleMinutes,
      carriers: rows,
      alertsCreated,
      alertsResolved,
    };
  }
}

/** Recall vs ground truth para un contrato/día. */
export async function computeDayRecall(
  repos: Repositories,
  contractId: string,
  serviceDate: string,
): Promise<{
  groundTruth: boolean;
  total: number;
  cumplido: number;
  noCumplido: number;
  pendienteEvidencia: number;
  sinVerificar: number;
  /** Solo sobre ocurrencias con evidencia suficiente (excluye pendiente_evidencia). */
  recall: number | null;
  falseNegatives: number;
}> {
  const gt = await repos.groundTruth.findForContractDate(contractId, serviceDate);
  const occs = await repos.occurrences.findForContract(contractId);
  const day = occs.filter((o) => o.serviceDate === serviceDate);

  let cumplido = 0;
  let noCumplido = 0;
  let pendienteEvidencia = 0;
  let sinVerificar = 0;
  for (const o of day) {
    const s = o.complianceFact?.status;
    if (s === "cumplido") cumplido += 1;
    else if (s === "no_cumplido") noCumplido += 1;
    else if (s === "pendiente_evidencia") pendienteEvidencia += 1;
    else sinVerificar += 1;
  }

  const denom = cumplido + noCumplido;
  const recall = denom > 0 ? cumplido / denom : null;
  const groundTruth = gt?.expectedAllCumplido ?? false;
  const falseNegatives = groundTruth ? noCumplido : 0;

  return {
    groundTruth: Boolean(gt),
    total: day.length,
    cumplido,
    noCumplido,
    pendienteEvidencia,
    sinVerificar,
    recall,
    falseNegatives,
  };
}
