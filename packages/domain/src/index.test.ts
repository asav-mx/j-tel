import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  computeExpectedDeadline,
  computeEvidenceWindow,
  normalizeProfileCode,
  suggestProfileCode,
  contractPolicySchema,
  createContractSchema,
  createServiceProfileSchema,
  enforcementRulesSchema,
} from "./index.js";

describe("parseTimeToMinutes", () => {
  it("parsea HH:MM", () => {
    expect(parseTimeToMinutes("06:45")).toBe(6 * 60 + 45);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("parsea HH:MM:SS ignorando segundos", () => {
    expect(parseTimeToMinutes("06:45:30")).toBe(6 * 60 + 45);
  });

  it("tolera partes faltantes usando 0", () => {
    expect(parseTimeToMinutes("07")).toBe(7 * 60);
    expect(parseTimeToMinutes("")).toBe(0);
  });
});

describe("computeExpectedDeadline", () => {
  it("resta la anticipación de llegada al inicio del turno", () => {
    const deadline = computeExpectedDeadline("2024-01-15", "06:45", 15);
    expect(deadline.getFullYear()).toBe(2024);
    expect(deadline.getMonth()).toBe(0);
    expect(deadline.getDate()).toBe(15);
    expect(deadline.getHours()).toBe(6);
    expect(deadline.getMinutes()).toBe(30);
  });

  it("con anticipación 0 el deadline es el inicio del turno", () => {
    const deadline = computeExpectedDeadline("2024-01-15", "06:45", 0);
    expect(deadline.getHours()).toBe(6);
    expect(deadline.getMinutes()).toBe(45);
  });

  it("cruza a la hora anterior cuando la anticipación supera los minutos", () => {
    const deadline = computeExpectedDeadline("2024-01-15", "06:10", 20);
    expect(deadline.getHours()).toBe(5);
    expect(deadline.getMinutes()).toBe(50);
  });
});

describe("computeEvidenceWindow", () => {
  it("calcula ventana antes/después del deadline", () => {
    const deadline = new Date("2024-01-15T06:30:00");
    const { windowStart, windowEnd } = computeEvidenceWindow(deadline, {
      evidenceMarginMinutesBefore: 60,
      verificationGraceMinutes: 15,
      evidenceMarginMinutesAfter: 30,
    });
    expect(windowStart.toISOString()).toBe(new Date("2024-01-15T05:30:00").toISOString());
    // 15 grace + 30 after = 45 min después del deadline
    expect(windowEnd.toISOString()).toBe(new Date("2024-01-15T07:15:00").toISOString());
  });

  it("no muta el deadline original", () => {
    const deadline = new Date("2024-01-15T06:30:00");
    const iso = deadline.toISOString();
    computeEvidenceWindow(deadline, {
      evidenceMarginMinutesBefore: 60,
      verificationGraceMinutes: 15,
      evidenceMarginMinutesAfter: 30,
    });
    expect(deadline.toISOString()).toBe(iso);
  });
});

describe("normalizeProfileCode", () => {
  it("mayúsculas y guiones a partir de espacios", () => {
    expect(normalizeProfileCode("ruta norte")).toBe("RUTA-NORTE");
  });

  it("quita acentos", () => {
    expect(normalizeProfileCode("Camión Mañana")).toBe("CAMION-MANANA");
  });

  it("colapsa símbolos y recorta guiones de los extremos", () => {
    expect(normalizeProfileCode("  --a_b!!c--  ")).toBe("A-B-C");
  });

  it("limita a 24 caracteres", () => {
    const out = normalizeProfileCode("a".repeat(40));
    expect(out).toHaveLength(24);
  });

  it("regresa cadena vacía si no hay caracteres válidos", () => {
    expect(normalizeProfileCode("!!!")).toBe("");
  });
});

describe("suggestProfileCode", () => {
  it("usa el nombre normalizado", () => {
    expect(suggestProfileCode("Ruta Sur")).toBe("RUTA-SUR");
  });

  it("cae a SRV cuando el nombre no produce código", () => {
    expect(suggestProfileCode("###")).toBe("SRV");
  });
});

describe("contractPolicySchema", () => {
  it("aplica valores por defecto", () => {
    const parsed = contractPolicySchema.parse({
      toleranceMinutes: 10,
      routeStrictness: "destino_only",
    });
    expect(parsed.arrivalAnticipationMinutes).toBe(15);
    expect(parsed.verificationGraceMinutes).toBe(15);
    expect(parsed.kmlMatchMinPct).toBe(60);
    expect(parsed.kmlCorridorMeters).toBe(120);
    expect(parsed.evidenceMinCoveragePct).toBe(80);
    expect(parsed.excusableReasons).toEqual([]);
    expect(parsed.enforcementRules).toEqual([]);
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(() =>
      contractPolicySchema.parse({
        toleranceMinutes: 10,
        routeStrictness: "destino_only",
        kmlMatchMinPct: 150,
      }),
    ).toThrow();
  });

  it("rechaza tolerancia negativa", () => {
    expect(() =>
      contractPolicySchema.parse({
        toleranceMinutes: -1,
        routeStrictness: "destino_only",
      }),
    ).toThrow();
  });
});

describe("enforcementRulesSchema", () => {
  it("valida regla rebate_escalonado", () => {
    const parsed = enforcementRulesSchema.parse({
      type: "rebate_escalonado",
      toleranceMinutes: 10,
      baseRebatePercent: 2,
      baseFailureCount: 2,
      additionalRebatePercent: 1,
    });
    expect(parsed.type).toBe("rebate_escalonado");
  });

  it("rechaza toleranceMinutes no positivo en no_pago_viaje", () => {
    expect(() =>
      enforcementRulesSchema.parse({ type: "no_pago_viaje", toleranceMinutes: 0 }),
    ).toThrow();
  });
});

describe("createContractSchema", () => {
  const base = {
    carrierAccountId: "11111111-1111-1111-1111-111111111111",
    clientAccountId: "22222222-2222-2222-2222-222222222222",
    name: "Contrato demo",
    validFrom: "2024-01-01",
    validTo: "2024-12-31",
    policy: { toleranceMinutes: 10, routeStrictness: "destino_only" as const },
  };

  it("acepta contrato con planta y estatus por defecto draft", () => {
    const parsed = createContractSchema.parse({
      ...base,
      plantId: "33333333-3333-3333-3333-333333333333",
    });
    expect(parsed.status).toBe("draft");
  });

  it("acepta contrato con grupo de plantas", () => {
    const parsed = createContractSchema.parse({
      ...base,
      plantGroupId: "44444444-4444-4444-4444-444444444444",
    });
    expect(parsed.plantGroupId).toBeDefined();
  });

  it("rechaza planta y grupo simultáneos", () => {
    expect(() =>
      createContractSchema.parse({
        ...base,
        plantId: "33333333-3333-3333-3333-333333333333",
        plantGroupId: "44444444-4444-4444-4444-444444444444",
      }),
    ).toThrow(/planta o grupo/);
  });

  it("rechaza cuando no hay ni planta ni grupo", () => {
    expect(() => createContractSchema.parse(base)).toThrow();
  });

  it("rechaza vigencia con inicio posterior al fin", () => {
    expect(() =>
      createContractSchema.parse({
        ...base,
        plantId: "33333333-3333-3333-3333-333333333333",
        validFrom: "2024-12-31",
        validTo: "2024-01-01",
      }),
    ).toThrow();
  });
});

describe("createServiceProfileSchema", () => {
  const base = {
    contractId: "11111111-1111-1111-1111-111111111111",
    routeShiftId: "22222222-2222-2222-2222-222222222222",
    geofenceId: "33333333-3333-3333-3333-333333333333",
    name: "Perfil",
  };

  it("normaliza el código provisto", () => {
    const parsed = createServiceProfileSchema.parse({ ...base, code: "ruta norte" });
    expect(parsed.code).toBe("RUTA-NORTE");
  });

  it("deja code undefined cuando viene vacío", () => {
    const parsed = createServiceProfileSchema.parse({ ...base, code: "   " });
    expect(parsed.code).toBeUndefined();
  });

  it("aplica activeDays por defecto (lun-vie)", () => {
    const parsed = createServiceProfileSchema.parse(base);
    expect(parsed.activeDays).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.possibleUnitIds).toEqual([]);
  });

  it("rechaza días fuera de 0..6", () => {
    expect(() =>
      createServiceProfileSchema.parse({ ...base, activeDays: [7] }),
    ).toThrow();
  });
});
