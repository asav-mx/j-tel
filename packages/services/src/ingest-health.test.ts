import { describe, expect, it } from "vitest";
import { IngestHealthService, isOperationalHours } from "./ingest-health.js";
import type { Repositories } from "@jtel/db";

describe("isOperationalHours", () => {
  it("rejects Sunday morning", () => {
    // 2026-07-12 is Sunday
    const sun = new Date("2026-07-12T14:00:00Z");
    expect(isOperationalHours(sun)).toBe(false);
  });

  it("accepts weekday midday Juarez", () => {
    // 2026-07-10 Friday 18:00 UTC = 12:00 Juarez (UTC-6)
    const fri = new Date("2026-07-10T18:00:00Z");
    expect(isOperationalHours(fri)).toBe(true);
  });

  it("rejects weekday night", () => {
    // 2026-07-10 Friday 06:00 UTC = 00:00 Juarez
    const night = new Date("2026-07-10T06:00:00Z");
    expect(isOperationalHours(night)).toBe(false);
  });
});

/**
 * **El #470 en el latido.** Aquí es donde se abrían las alertas críticas: tres
 * días seguidas para una flota estacionada, y una más para el carrier bueno
 * porque su único camión se detuvo dieciséis minutos.
 */

const CARRIER = { id: "carrier-1", name: "Juárez Bus" };

/** Viernes 12:00 en Juárez, dentro del horario del circuito. */
const EN_TURNO = new Date("2026-07-10T18:00:00Z");

const UNIDAD = (minutosSinHablar: number | null) => ({
  carrierAccountId: CARRIER.id,
  unidad: "2120",
  carrier: CARRIER.name,
  circuito: "Oasis-Centro",
  abre: "06:00:00",
  cierra: "20:00:00",
  zona: "America/Ciudad_Juarez",
  arrancaEl: null,
  minutosSinHablar,
});

function reposFalsos(flota: ReturnType<typeof UNIDAD>[]) {
  const creadas: Array<{ message: string; metadata: Record<string, unknown> }> = [];
  const repos = {
    accounts: { listByType: async () => [CARRIER] },
    telemetry: {
      getWatermark: async () => null,
      latestPointAgeMinutes: async () => null,
      countPointsSince: async () => 0,
      unidadesQueDeberianHablar: async () => flota,
    },
    ingestAlerts: {
      findOpenByKind: async () => null,
      create: async (a: { message: string; metadata: Record<string, unknown> }) => {
        creadas.push(a);
      },
      resolveOpen: async () => {},
    },
  } as unknown as Repositories;
  return { repos, creadas };
}

describe("el latido sólo grita por quien debería estar hablando", () => {
  it("#470 · con la flota fuera de horario no abre nada", async () => {
    const deMadrugada = new Date("2026-07-10T08:00:00Z"); // 02:00 en Juárez
    const { repos, creadas } = reposFalsos([UNIDAD(68 * 60)]);
    const r = await new IngestHealthService(repos).checkHeartbeat(deMadrugada);
    expect(creadas).toEqual([]);
    expect(r.alertsCreated).toBe(0);
    expect(r.carriers[0]!.stale).toBe(false);
  });

  it("#470 · sin ninguna unidad montada tampoco: no hay a quién esperar", async () => {
    const { repos, creadas } = reposFalsos([]);
    const r = await new IngestHealthService(repos).checkHeartbeat(EN_TURNO);
    expect(creadas).toEqual([]);
    expect(r.alertsCreated).toBe(0);
  });

  it("en turno y hablando: nada que abrir", async () => {
    const { repos, creadas } = reposFalsos([UNIDAD(3)]);
    const r = await new IngestHealthService(repos).checkHeartbeat(EN_TURNO);
    expect(creadas).toEqual([]);
    expect(r.carriers[0]!.stale).toBe(false);
  });

  /*
   * Y el otro lado, que es lo que impide cumplir «no grita cuando duerme» no
   * gritando nunca.
   */
  it("en turno y callada: abre la crítica, y el mensaje nombra a la unidad", async () => {
    const { repos, creadas } = reposFalsos([UNIDAD(45)]);
    const r = await new IngestHealthService(repos).checkHeartbeat(EN_TURNO);
    expect(r.alertsCreated).toBe(1);
    expect(creadas[0]!.message).toContain("2120");
    expect(creadas[0]!.message).toContain("Oasis-Centro");
    expect(creadas[0]!.message).toContain("umbral");
    expect(creadas[0]!.metadata.callan).toEqual(["2120"]);
  });

  /*
   * El mensaje viejo decía «Ingesta detenida > 15 min para Juárez Bus». Era
   * falso dos veces: la ingesta no estaba detenida, y lo que callaba no era el
   * carrier sino un camión.
   */
  it("el mensaje ya no dice «ingesta detenida» cuando lo que calla es un camión", async () => {
    const { repos, creadas } = reposFalsos([UNIDAD(45)]);
    await new IngestHealthService(repos).checkHeartbeat(EN_TURNO);
    expect(creadas[0]!.message).not.toContain("Ingesta detenida");
  });

  /* Un aparato recién montado que nunca mandó un punto es otro problema. */
  it("la que nunca habló también abre, y se dice con esas palabras", async () => {
    const { repos, creadas } = reposFalsos([UNIDAD(null)]);
    await new IngestHealthService(repos).checkHeartbeat(EN_TURNO);
    expect(creadas[0]!.message).toContain("nunca ha hablado");
  });
});
