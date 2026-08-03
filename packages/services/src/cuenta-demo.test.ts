import { describe, it, expect, vi } from "vitest";
import { motivoCuentaDemo, esCuentaDeEjemplo } from "./cuenta-demo.js";
import { VerificationService } from "./verification.js";

/*
 * LA VALLA DE LA LLAVE.
 *
 * El 2026-08-03 se midieron en producción 84 hechos vinculantes sellados sobre
 * cuentas de ejemplo — 52 de ellos acusaciones formales (`no_cumplido`), con
 * expediente y motivo escrito, contra transportistas por servicios que nadie
 * prestó. Estas pruebas existen para que el día que alguien reabra esa llave se
 * entere aquí y no cinco semanas después en la base.
 *
 * Los DOS cerrojos se ejercen por separado a propósito. Hoy solo el primero
 * muerde —los cuatro contratos de producción tienen `status = 'active'`,
 * incluidos los dos de cuentas demo—, así que una prueba que solo ejerciera
 * `is_demo` pasaría en verde con el segundo cerrojo borrado.
 */

describe("motivoCuentaDemo · los dos cerrojos", () => {
  it("cuenta marcada demo → cuenta_marcada_demo", () => {
    expect(motivoCuentaDemo({ cuentaClienteEsDemo: true, estadoDelContrato: "active" })).toBe(
      "cuenta_marcada_demo",
    );
  });

  it("contrato marcado demo sobre cuenta REAL → contrato_marcado_demo", () => {
    // El agujero que quedaría abierto si solo se cerrara `is_demo`.
    expect(motivoCuentaDemo({ cuentaClienteEsDemo: false, estadoDelContrato: "demo" })).toBe(
      "contrato_marcado_demo",
    );
  });

  it("cuenta real con contrato activo → null, se puede sellar", () => {
    expect(motivoCuentaDemo({ cuentaClienteEsDemo: false, estadoDelContrato: "active" })).toBeNull();
    expect(esCuentaDeEjemplo({ cuentaClienteEsDemo: false, estadoDelContrato: "active" })).toBe(
      false,
    );
  });

  it("ausencia de dato no es permiso, pero tampoco invento: null/undefined no bloquean", () => {
    // `is_demo` es NOT NULL con default false en el esquema; si llegara vacío es
    // una lectura incompleta, no una cuenta de ejemplo. Bloquear aquí apagaría
    // el motor entero ante un bug de consulta.
    expect(motivoCuentaDemo({})).toBeNull();
    expect(motivoCuentaDemo({ cuentaClienteEsDemo: null, estadoDelContrato: null })).toBeNull();
  });

  it("otros estados de contrato no son demo", () => {
    for (const estado of ["draft", "active", "suspended"]) {
      expect(motivoCuentaDemo({ estadoDelContrato: estado })).toBeNull();
    }
  });
});

describe("el motor no sella sobre cuentas de ejemplo", () => {
  function ocurrenciaDe(contract: { status: string; client: { isDemo: boolean } }) {
    return {
      id: "occ-1",
      contract,
      trip: { id: "trip-1", evidenceWindowStart: new Date(), evidenceWindowEnd: new Date() },
      complianceFact: null,
      profile: { contract: { policy: {} }, geofence: null, routeShift: null },
    };
  }

  function reposCon(occ: unknown) {
    const saveFact = vi.fn();
    const deleteFactForOccurrence = vi.fn();
    const updateTripStatus = vi.fn();
    const clearPointsForTrip = vi.fn();
    return {
      saveFact,
      deleteFactForOccurrence,
      updateTripStatus,
      clearPointsForTrip,
      repos: {
        occurrences: { findById: vi.fn().mockResolvedValue(occ) },
        evidence: {
          getPointsForTrip: vi.fn().mockResolvedValue([]),
          clearPointsForTrip,
          updateTripStatus,
        },
        compliance: { saveFact, deleteFactForOccurrence, addLedgerEntry: vi.fn() },
      },
    };
  }

  const casos = [
    {
      nombre: "cerrojo 1 · la cuenta cliente está marcada como demo",
      contract: { status: "active", client: { isDemo: true } },
      motivo: "cuenta_marcada_demo",
    },
    {
      nombre: "cerrojo 2 · el contrato está marcado como demo, cuenta real",
      contract: { status: "demo", client: { isDemo: false } },
      motivo: "contrato_marcado_demo",
    },
  ];

  for (const caso of casos) {
    it(`${caso.nombre} → ni sella, ni borra, ni toca la evidencia`, async () => {
      const f = reposCon(ocurrenciaDe(caso.contract));
      const service = new VerificationService(f.repos as never, {
        umbrellaBaseUrl: "http://example.com",
      });

      const result = await service.verifyOccurrence("occ-1");

      expect(result).toEqual({
        occurrenceId: "occ-1",
        skipped: true,
        cuentaDeEjemplo: true,
        motivo: caso.motivo,
      });
      // Lo que se protege: que no quede rastro vinculante nuevo.
      expect(f.saveFact).not.toHaveBeenCalled();
      // Y que tampoco destruya lo que ya hubiera. Cerrar la llave no limpia:
      // retirar los 84 ya sellados lleva firma y motivo, y va aparte.
      expect(f.deleteFactForOccurrence).not.toHaveBeenCalled();
      expect(f.clearPointsForTrip).not.toHaveBeenCalled();
      expect(f.updateTripStatus).not.toHaveBeenCalled();
    });
  }

  it("con force y como decisión humana TAMPOCO sella — no hay puerta de atrás", async () => {
    // El caso real: J-Staff dándole a «verificar» en la pantalla de soporte.
    // Devuelve el motivo en vez de reventar, para que se pueda enunciar.
    const f = reposCon(ocurrenciaDe({ status: "active", client: { isDemo: true } }));
    const service = new VerificationService(f.repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });

    const result = await service.verifyOccurrence("occ-1", {
      force: true,
      actorKind: "human",
      actorId: null,
      actorIntent: "decision",
    });

    expect(result).toMatchObject({ skipped: true, cuentaDeEjemplo: true });
    expect(f.saveFact).not.toHaveBeenCalled();
    expect(f.deleteFactForOccurrence).not.toHaveBeenCalled();
  });

  it("una cuenta REAL con contrato activo NO se detiene en la llave", async () => {
    /*
     * La mitad que impide satisfacer la valla bloqueando todo. Sin esta, un
     * cerrojo mal escrito que apagara el motor entero pasaría en verde.
     */
    const f = reposCon(ocurrenciaDe({ status: "active", client: { isDemo: false } }));
    const service = new VerificationService(f.repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });

    const result = (await service.verifyOccurrence("occ-1").catch((e) => e)) as {
      cuentaDeEjemplo?: boolean;
    };

    // No se afirma el veredicto —estos repos son de mentira y el motor no llega
    // a dictar—, se afirma que no se paró en el cerrojo.
    expect(result?.cuentaDeEjemplo).toBeUndefined();
  });

  it("el cron cuenta lo que dejó fuera en vez de saltárselo callado", async () => {
    const contar = vi.fn().mockResolvedValue(7);
    const repos = {
      occurrences: {
        findPendingVerification: vi.fn().mockResolvedValue([]),
        contarVencidasDeCuentaDemo: contar,
      },
      compliance: { addLedgerEntry: vi.fn() },
    };
    const avisos: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((m) => {
      avisos.push(String(m));
    });

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    await service.processPending();
    warn.mockRestore();

    expect(contar).toHaveBeenCalled();
    expect(avisos.join("\n")).toContain("7 servicio(s)");
  });
});
