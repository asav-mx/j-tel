import { describe, expect, it } from "vitest";
import { cargarCuartoDeDispositivos } from "./cuarto-dispositivos.js";

const AHORA = new Date("2026-09-17T13:42:00Z");
const HORA = 3_600_000;
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

/** Juárez Bus la mañana después de instalar: uno de cada grupo, y una unidad inactiva. */
function repos() {
  const r = {
    fleet: {
      getUnitsForCarrier: async () => [
        { id: "u1", label: "10254", active: true },
        { id: "u2", label: "10301", active: true },
        { id: "u3", label: "10099", active: false },
        { id: "u4", label: "9382", active: true },
      ],
      getDevicesForCarrier: async () => [
        { id: "d3", imei: "333", label: "TK-FTC927-003", retiredAt: null, retiredReason: null },
        { id: "d1", imei: "111", label: "TK-FTC927-001", retiredAt: null, retiredReason: null },
        { id: "d5", imei: "555", label: "TK-FTC927-005", retiredAt: null, retiredReason: null },
        { id: "b1", imei: "999", label: null, retiredAt: hace(48 * HORA), retiredReason: "Umbrella cortó" },
      ],
      getActiveAssignmentsForCarrier: async () => [
        { unitId: "u1", deviceId: "d1", validFrom: hace(20 * HORA), validTo: null },
        // Montado y callado más de 24 h: desconectado, pero sigue trayendo su unidad.
        { unitId: "u2", deviceId: "d3", validFrom: hace(40 * HORA), validTo: null },
      ],
    },
    livePositions: {
      listForCarrier: async () => [{ imei: "111", recordedAt: hace(14_000), speed: 0, heading: 0 }],
    },
    telemetry: { ultimoPuntoPorImei: async () => new Map<string, Date>() },
    geofences: { lugaresDeCarrier: async () => [] },
    occurrences: { especialesVigentesDeCarrier: async () => [] },
  };
  return r as never;
}

describe("el cuarto Dispositivos (C4-b)", () => {
  it("agrupa en el orden del inventario, con el número económico de su unidad", async () => {
    const c = await cargarCuartoDeDispositivos(repos(), { carrierAccountId: "jb", ahora: AHORA });
    const vista = (g: keyof typeof c.grupos) => c.grupos[g].map((d) => [d.nombre ?? d.imei, d.unidad]);
    expect(vista("en_unidad")).toEqual([["TK-FTC927-001", "10254"]]);
    expect(vista("en_bodega")).toEqual([["TK-FTC927-005", null]]);
    expect(vista("desconectado")).toEqual([["TK-FTC927-003", "10301"]]);
    expect(vista("de_baja")).toEqual([["999", null]]);
    expect(c.total).toBe(4);
  });

  it("ofrece para asignar sólo las unidades activas, con lo que traen, en orden numérico", async () => {
    const c = await cargarCuartoDeDispositivos(repos(), { carrierAccountId: "jb", ahora: AHORA });
    expect(c.unidades).toEqual([
      { id: "u4", numeroEconomico: "9382", trae: null },
      { id: "u1", numeroEconomico: "10254", trae: { id: "d1", nombre: "TK-FTC927-001" } },
      // Desconectado sigue montado: la unidad no está libre.
      { id: "u2", numeroEconomico: "10301", trae: { id: "d3", nombre: "TK-FTC927-003" } },
    ]);
  });
});
