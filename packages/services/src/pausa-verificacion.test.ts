import { describe, expect, it, vi } from "vitest";
import { VerificationService } from "./verification.js";
import { pausarVerificacion, reanudarVerificacion, vistaPreviaDePausa } from "./pausa-verificacion.js";

/**
 * La pausa de la verificación (0041) — lo que el motor y las acciones hacen.
 *
 * La SQL de la cola y del borrado se prueba contra la desechable en
 * `packages/db/src/pausa.integration.test.ts`; aquí, la llave y la revisión.
 */

const MOTIVO = "Sin telemetría: el proveedor anterior se desconectó";
const AHORA = new Date("2026-09-19T12:00:00Z");

describe("la llave de la pausa en verifyOccurrence", () => {
  /** Todo lo que no es leer la ocurrencia y preguntar por la pausa revienta: en pausa no se toca nada. */
  function repos(motivo: "ocurrencia_en_pausa" | "contrato_en_pausa" | null) {
    const prohibido = () => {
      throw new Error("en pausa no se toca nada");
    };
    return {
      pausas: { motivoDePausa: vi.fn().mockResolvedValue(motivo) },
      occurrences: {
        findById: vi.fn().mockResolvedValue({
          id: "occ-1",
          contractId: "c-1",
          expectedDeadline: new Date("2026-09-10T12:45:00Z"),
          complianceFact: { status: "pendiente_evidencia" },
          trip: { id: "trip-1" },
          contract: { status: "active", client: { isDemo: false } },
        }),
      },
      evidence: new Proxy({}, { get: prohibido }),
      compliance: new Proxy({}, { get: prohibido }),
      telemetry: new Proxy({}, { get: prohibido }),
    };
  }

  it("una ocurrencia que cae en la pausa no se sella", async () => {
    const r = await new VerificationService(repos("ocurrencia_en_pausa") as never).verifyOccurrence("occ-1");
    expect(r).toEqual({ occurrenceId: "occ-1", skipped: true, enPausa: true, motivo: "ocurrencia_en_pausa" });
  });

  it("con el contrato en pausa, un pendiente viejo tampoco se re-sella, ni con force", async () => {
    const r = await new VerificationService(repos("contrato_en_pausa") as never).verifyOccurrence("occ-1", {
      force: true,
      actorIntent: "decision",
    });
    expect(r).toMatchObject({ skipped: true, enPausa: true, motivo: "contrato_en_pausa" });
  });

  it("pregunta con la llegada exigida de la ocurrencia y su contrato", async () => {
    const rs = repos("contrato_en_pausa");
    await new VerificationService(rs as never).verifyOccurrence("occ-1");
    expect(rs.pausas.motivoDePausa).toHaveBeenCalledWith("c-1", new Date("2026-09-10T12:45:00Z"), expect.any(Date));
  });
});

describe("pausar y reanudar desde J-Staff", () => {
  const efecto = { seBorran: 12, seQuedanSinSellar: 0, selladosNoSeTocan: 30, pendientesSeCongelan: 4, entradasDelLedgerSeVan: 3 };
  function repos(eventos: unknown[] = []) {
    return {
      pausas: {
        eventosDe: vi.fn().mockResolvedValue(eventos),
        vistaPrevia: vi.fn().mockResolvedValue(efecto),
        pausar: vi.fn().mockResolvedValue({ borradas: 12 }),
        reanudar: vi.fn().mockResolvedValue(undefined),
      },
    };
  }
  const entrada = { contractId: "c-1", fechaIso: "2026-09-05", motivo: MOTIVO, zona: "America/Ciudad_Juarez", ahora: AHORA };

  it("la vista previa cuenta y no escribe; la fecha es la medianoche del contrato", async () => {
    const rs = repos();
    const v = await vistaPreviaDePausa(rs as never, entrada);
    expect(v).toMatchObject({ ok: true, valeDesde: new Date("2026-09-05T06:00:00Z"), efecto });
    expect(rs.pausas.pausar).not.toHaveBeenCalled();
  });

  it("una pausa que no pasa la revisión no cuenta ni escribe, y lo dice en palabras", async () => {
    const rs = repos();
    const v = await pausarVerificacion(rs as never, { ...entrada, motivo: " ", actor: { kind: "human", id: "u" } });
    expect(v).toEqual({ ok: false, error: "motivo_vacio", mensaje: "Escribe el motivo de la pausa." });
    expect(rs.pausas.vistaPrevia).not.toHaveBeenCalled();
    expect(rs.pausas.pausar).not.toHaveBeenCalled();
  });

  it("pausar escribe lo que se revisó: fecha, motivo limpio y autor", async () => {
    const rs = repos();
    const r = await pausarVerificacion(rs as never, { ...entrada, motivo: `  ${MOTIVO} `, actor: { kind: "human", id: "user_1" } });
    expect(r).toEqual({ ok: true, borradas: 12 });
    expect(rs.pausas.pausar).toHaveBeenCalledWith("c-1", {
      valeDesde: new Date("2026-09-05T06:00:00Z"),
      motivo: MOTIVO,
      actor: { kind: "human", id: "user_1" },
    });
  });

  it("sólo se reanuda lo que está en pausa", async () => {
    const sin = repos();
    expect(await reanudarVerificacion(sin as never, { contractId: "c-1", ahora: AHORA, actor: { kind: "human", id: "u" } })).toMatchObject({
      ok: false,
      error: "no_esta_en_pausa",
    });
    const con = repos([{ tipo: "pausa", valeDesde: new Date("2026-09-05T06:00:00Z"), motivo: MOTIVO, registradoAt: AHORA }]);
    expect(await reanudarVerificacion(con as never, { contractId: "c-1", ahora: AHORA, actor: { kind: "human", id: "u" } })).toEqual({ ok: true });
    expect(con.pausas.reanudar).toHaveBeenCalledWith("c-1", { kind: "human", id: "u" }, AHORA);
  });
});
