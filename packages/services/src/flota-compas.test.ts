import { describe, expect, it } from "vitest";
import { cargarFlotaCompas } from "./flota-compas.js";

const AHORA = new Date("2026-09-15T18:00:00Z");
const MIN = 60_000;

/** Repos falsos: sólo lo que el cargador toca. */
function repos(opciones: { contratos?: number; inactiva?: boolean } = {}) {
  const pedidosDeArchivo: string[][] = [];
  const r = {
    fleet: {
      getUnitsForCarrier: async () => [
        { id: "u1", label: "10254", active: true },
        { id: "u2", label: "10301", active: !opciones.inactiva },
      ],
      getDevicesForCarrier: async () => [
        { id: "d1", imei: "111", label: "TK-FTC927-001", retiredAt: null, retiredReason: null },
        { id: "d2", imei: "222", label: null, retiredAt: null, retiredReason: null },
      ],
      getActiveAssignmentsForCarrier: async () => [
        { unitId: "u1", deviceId: "d1", validFrom: new Date("2026-09-01T00:00:00Z"), validTo: null },
      ],
    },
    livePositions: {
      listForCarrier: async () => [
        { imei: "111", recordedAt: new Date(AHORA.getTime() - 14_000), speed: 42.7, heading: 90 },
      ],
    },
    telemetry: {
      ultimoPuntoPorImei: async (imeis: string[]) => {
        pedidosDeArchivo.push(imeis);
        return new Map([["222", new Date(AHORA.getTime() - 30 * MIN)]]);
      },
    },
    contracts: { findForCarrier: async () => Array.from({ length: opciones.contratos ?? 0 }) },
  };
  return { repos: r as never, pedidosDeArchivo };
}

describe("cargarFlotaCompas", () => {
  it("junta las filas y clasifica: u1 en línea, u2 sin dispositivo, d2 en bodega con su señal archivada", async () => {
    const f = repos();
    const flota = await cargarFlotaCompas(f.repos, "c1", AHORA);
    expect(flota.unidades.map((u) => [u.unidad.label, u.grupo])).toEqual([
      ["10254", "en_linea"],
      ["10301", "sin_dispositivo"],
    ]);
    expect(flota.dispositivos.find((d) => d.dispositivo.id === "d2")?.estado).toEqual({
      grupo: "en_bodega",
      ultimaSenalAt: new Date(AHORA.getTime() - 30 * MIN),
    });
    // El archivo se consulta por los IMEI de la cuenta, todos juntos.
    expect(f.pedidosDeArchivo).toEqual([["111", "222"]]);
  });

  it("dice si la cuenta tiene contrato, que es lo que decide si EN DESTINO existe", async () => {
    expect((await cargarFlotaCompas(repos().repos, "c1", AHORA)).tieneContrato).toBe(false);
    expect((await cargarFlotaCompas(repos({ contratos: 2 }).repos, "c1", AHORA)).tieneContrato).toBe(true);
  });

  it("una unidad inactiva no entra a la flota, y se cuenta para que no desaparezca en silencio", async () => {
    const flota = await cargarFlotaCompas(repos({ inactiva: true }).repos, "c1", AHORA);
    expect(flota.unidades.map((u) => u.unidad.id)).toEqual(["u1"]);
    expect(flota.unidadesInactivas).toBe(1);
  });
});
