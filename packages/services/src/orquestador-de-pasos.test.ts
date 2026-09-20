import { describe, it, expect, vi } from "vitest";
import type { ResultadoDeUnidad, UnidadParaDetectar } from "@jtel/db";
import {
  ARRANQUE_HORAS,
  COLCHON_MINUTOS,
  OrquestadorDePasosService,
  VERSION_DEL_DETECTOR,
} from "./orquestador-de-pasos.js";

/*
 * El orquestador con repositorios de mentira: lo que decide ÉL — el orden, la
 * ventana que le pide al repositorio, que una unidad que falla no tumba a las
 * demás, el presupuesto de tiempo, y la simulación. La transacción, el
 * marcador y el muro contra la base de verdad viven en
 * `orquestador-de-pasos.integration.test.ts`.
 */

const AHORA = new Date("2026-09-22T18:00:00.000Z");

function unidad(n: number, extra: Partial<UnidadParaDetectar> = {}): UnidadParaDetectar {
  return {
    circuitId: `circuito-${n}`,
    unitId: `unidad-${n}`,
    carrierAccountId: `cuenta-de-la-unidad-${n}`,
    asignadaDesde: new Date("2026-09-01T00:00:00.000Z"),
    corridorToleranceMeters: 150,
    sentidos: ["ida", "vuelta"],
    marcaLastPingAt: null,
    ...extra,
  };
}

function resultado(extra: Partial<ResultadoDeUnidad> = {}): ResultadoDeUnidad {
  return {
    estado: "detectada",
    simulado: false,
    desde: new Date("2026-09-22T17:00:00.000Z"),
    hasta: new Date("2026-09-22T17:40:00.000Z"),
    marcaNueva: new Date("2026-09-22T17:40:00.000Z"),
    pasosGuardados: 2,
    muestra: [],
    ...extra,
  };
}

function armar(elegibles: UnidadParaDetectar[], detectar: (i: any) => Promise<ResultadoDeUnidad>, saltadas = []) {
  const detectarUnidadEnRonda = vi.fn(detectar);
  const repos = {
    pasosPorParada: {
      unidadesParaDetectar: vi.fn(async () => ({ elegibles, saltadas })),
      detectarUnidadEnRonda,
    },
  } as any;
  return { servicio: new OrquestadorDePasosService(repos, () => AHORA), detectarUnidadEnRonda, repos };
}

describe("orquestador de pasos · la ventana que pide", () => {
  it("techo = ahora − colchón, arranque = ahora − 24 h, versión constante", async () => {
    const { servicio, detectarUnidadEnRonda } = armar([unidad(1)], async () => resultado());
    const ronda = await servicio.correr();

    const llamada = detectarUnidadEnRonda.mock.calls[0]![0];
    expect(llamada.hastaMaximo.getTime()).toBe(AHORA.getTime() - COLCHON_MINUTOS * 60_000);
    expect(llamada.arranque.getTime()).toBe(AHORA.getTime() - ARRANQUE_HORAS * 3_600_000);
    expect(llamada.detectorVersion).toBe(VERSION_DEL_DETECTOR);
    expect(llamada.simular).toBe(false);
    expect(ronda.hastaMaximo).toBe(new Date(AHORA.getTime() - COLCHON_MINUTOS * 60_000).toISOString());
  });

  it("el colchón es mayor que la cadencia del archivador (10 min)", () => {
    expect(COLCHON_MINUTOS).toBeGreaterThan(10);
  });

  it("el muro: le pasa al repositorio la cuenta de la UNIDAD, tal como vino resuelta", async () => {
    const { servicio, detectarUnidadEnRonda } = armar([unidad(7)], async () => resultado());
    await servicio.correr();
    expect(detectarUnidadEnRonda.mock.calls[0]![0].carrierAccountId).toBe("cuenta-de-la-unidad-7");
  });
});

describe("orquestador de pasos · una unidad que falla no tumba a las demás", () => {
  it("la fallida se registra, las demás siguen y cuentan", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { servicio, detectarUnidadEnRonda } = armar([unidad(1), unidad(2), unidad(3)], async (i) => {
      if (i.unitId === "unidad-2") throw new Error("se cayó la conexión");
      return resultado({ pasosGuardados: 3 });
    });

    const ronda = await servicio.correr();

    expect(detectarUnidadEnRonda).toHaveBeenCalledTimes(3);
    expect(ronda.fallidas).toEqual([
      { circuitId: "circuito-2", unitId: "unidad-2", error: "se cayó la conexión" },
    ]);
    expect(ronda.detectadas).toBe(2);
    expect(ronda.pasosGuardados).toBe(6);
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it("si falla la elegibilidad, la ronda entera falla (no hay a quién procesar)", async () => {
    const repos = {
      pasosPorParada: {
        unidadesParaDetectar: vi.fn(async () => {
          throw new Error('no existe la relación "circuit_detection_marks"');
        }),
        detectarUnidadEnRonda: vi.fn(),
      },
    } as any;
    await expect(new OrquestadorDePasosService(repos, () => AHORA).correr()).rejects.toThrow(
      /circuit_detection_marks/,
    );
    expect(repos.pasosPorParada.detectarUnidadEnRonda).not.toHaveBeenCalled();
  });
});

describe("orquestador de pasos · el orden y el presupuesto", () => {
  it("primero la que nunca corrió, luego la de marca más vieja", async () => {
    const orden: string[] = [];
    const { servicio } = armar(
      [
        unidad(1, { marcaLastPingAt: new Date("2026-09-22T17:30:00.000Z") }),
        unidad(2, { marcaLastPingAt: new Date("2026-09-22T16:00:00.000Z") }),
        unidad(3, { marcaLastPingAt: null }),
      ],
      async (i) => {
        orden.push(i.unitId);
        return resultado({ estado: "sin_novedad", pasosGuardados: 0 });
      },
    );
    await servicio.correr();
    expect(orden).toEqual(["unidad-3", "unidad-2", "unidad-1"]);
  });

  it("al agotarse el presupuesto para y dice cuántas quedaron pendientes", async () => {
    let t = AHORA.getTime();
    const reloj = () => new Date(t);
    const repos = {
      pasosPorParada: {
        unidadesParaDetectar: async () => ({ elegibles: [unidad(1), unidad(2), unidad(3), unidad(4)], saltadas: [] }),
        detectarUnidadEnRonda: vi.fn(async () => {
          t += 100_000; // cada unidad "tarda" 100 s
          return resultado({ estado: "sin_novedad", pasosGuardados: 0 });
        }),
      },
    } as any;

    const ronda = await new OrquestadorDePasosService(repos, reloj).correr({ presupuestoMs: 150_000 });

    // Después de la 1ª van 100 s (≤150), después de la 2ª van 200 s (>150): para antes de la 3ª.
    expect(repos.pasosPorParada.detectarUnidadEnRonda).toHaveBeenCalledTimes(2);
    expect(ronda.sinNovedad).toBe(2);
    expect(ronda.pendientes).toBe(2);
  });
});

describe("orquestador de pasos · lo que cuenta y lo que dice", () => {
  it("cuenta por estado y trae las saltadas con su motivo", async () => {
    const estados: Record<string, ResultadoDeUnidad["estado"]> = {
      "unidad-1": "detectada",
      "unidad-2": "sin_novedad",
      "unidad-3": "ocupada",
    };
    const saltadas = [{ circuitId: "oasis", unitId: "u9", motivo: "el circuito no tiene paradas capturadas" }];
    const { servicio } = armar(
      [unidad(1), unidad(2), unidad(3)],
      async (i) => resultado({ estado: estados[i.unitId]!, pasosGuardados: estados[i.unitId] === "detectada" ? 4 : 0 }),
      saltadas as any,
    );
    const ronda = await servicio.correr();
    expect(ronda).toMatchObject({ elegibles: 3, detectadas: 1, sinNovedad: 1, ocupadas: 1, pasosGuardados: 4, pendientes: 0 });
    expect(ronda.saltadas).toEqual(saltadas);
  });

  it("sin elegibles no llama al detector y devuelve una ronda vacía dicha, no un error", async () => {
    const { servicio, detectarUnidadEnRonda } = armar([], async () => resultado());
    const ronda = await servicio.correr();
    expect(detectarUnidadEnRonda).not.toHaveBeenCalled();
    expect(ronda).toMatchObject({ elegibles: 0, detectadas: 0, fallidas: [], pendientes: 0 });
  });
});

describe("orquestador de pasos · simular", () => {
  const muestra = Array.from({ length: 25 }, (_, n) => ({
    stopId: `parada-${n}`,
    sentido: "ida" as const,
    pasoDesde: new Date("2026-09-22T17:10:00.000Z"),
    pasoHasta: new Date("2026-09-22T17:10:30.000Z"),
    huecoSegundos: 30,
  }));

  it("pide simular al repositorio y trae la muestra (acotada a 20) de lo que escribiría", async () => {
    const { servicio, detectarUnidadEnRonda } = armar([unidad(1)], async () =>
      resultado({ simulado: true, pasosGuardados: 25, muestra }),
    );
    const ronda = await servicio.correr({ simular: true });

    expect(detectarUnidadEnRonda.mock.calls[0]![0].simular).toBe(true);
    expect(ronda.simulado).toBe(true);
    expect(ronda.detalle[0]!.muestra).toHaveLength(20);
    expect(ronda.detalle[0]!.marcaNueva).toBe("2026-09-22T17:40:00.000Z");
  });

  it("sin simular no arrastra la muestra: la respuesta del cron no crece con cada paso", async () => {
    const { servicio } = armar([unidad(1)], async () => resultado({ pasosGuardados: 25, muestra }));
    const ronda = await servicio.correr();
    expect(ronda.detalle[0]).not.toHaveProperty("muestra");
  });
});
