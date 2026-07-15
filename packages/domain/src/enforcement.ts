import type { ComplianceStatus, ContractPolicy, EnforcementRules } from "./index.js";

export interface EnforcementOutcome {
  type: EnforcementRules["type"];
  applies: boolean;
  description: string;
  amount?: number;
  rebatePercent?: number;
}

export function computeEnforcement(
  status: ComplianceStatus,
  timing: string | null,
  lateExcusable: boolean,
  policy: ContractPolicy,
): EnforcementOutcome[] {
  if (status !== "no_cumplido" && !(status === "cumplido" && timing === "tarde" && !lateExcusable)) {
    return policy.enforcementRules.map((rule) => ({
      type: rule.type,
      applies: false,
      description: "No aplica — servicio cumplido o pendiente",
    }));
  }

  const sinServicio = status === "no_cumplido" && timing == null;

  return policy.enforcementRules.map((rule) => {
    if (rule.type === "no_pago_viaje") {
      return {
        type: rule.type,
        applies: true,
        description: sinServicio
          ? "No se paga el viaje — sin servicio detectado en la ventana"
          : `No se paga el viaje — retraso mayor a ${rule.toleranceMinutes} min sin causa excusable`,
      };
    }

    if (rule.type === "rebate_escalonado") {
      return {
        type: rule.type,
        applies: true,
        description: sinServicio
          ? `Rebate aplicable — sin servicio detectado (${rule.baseRebatePercent}% base por ${rule.baseFailureCount} faltas)`
          : `Rebate aplicable — ${rule.baseRebatePercent}% base por ${rule.baseFailureCount} faltas`,
        rebatePercent: rule.baseRebatePercent,
      };
    }

    return {
      type: rule.type,
      applies: true,
      description: sinServicio
        ? "Reembolso aplicable — sin servicio detectado"
        : "Reembolso aplicable según contrato",
    };
  });
}

export function computeMonthlyRebate(
  failureCount: number,
  rules: EnforcementRules[],
): number {
  const rebateRule = rules.find((r) => r.type === "rebate_escalonado");
  if (!rebateRule || rebateRule.type !== "rebate_escalonado") return 0;
  if (failureCount < rebateRule.baseFailureCount) return 0;

  const extra = failureCount - rebateRule.baseFailureCount;
  return rebateRule.baseRebatePercent + extra * rebateRule.additionalRebatePercent;
}
