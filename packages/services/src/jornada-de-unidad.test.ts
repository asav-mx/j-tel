import { describe, expect, it } from "vitest";
import { cargarJornadaParaJStaff } from "./jornada-de-unidad.js";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/*
 * La lectura de la jornada contra repos falsos que anotan con qué se les
 * llamó: lo que se prueba aquí es el muro y el recorte, no la regla (ésa vive
 * en `@jtel/domain`, jornada.test.ts).
 */
const CONCESION = "cuenta-concesion";
const CARRIER = "cuenta-carrier";
const D = (iso: string) => new Date(iso);

function repos(opts: {
  circuito?: Record<string, unknown> | null;
  asignaciones?: Array<{ unitId: string; validFrom: Date; validTo: Date | null; carrierAccountId?: string }>;
  pasos?: Array<{ detectorVersion: string; pasoDesde: Date }>;
  servicio?: Array<{ stopId: string; unitId: string; sentido: string; pasoDesde: Date; pasoHasta: Date; detectorVersion: string }>;
} = {}) {
  const llamadas = {
    telemetria: [] as Array<{ cuenta: string; desde: Date; hasta: Date }>,
    pasos: [] as Array<{ cuenta: string; desde: Date; hasta: Date }>,
    servicio: [] as string[],
  };
  const circuito =
    opts.circuito === null
      ? null
      : {
          id: "k1",
          name: "Oasis–Centro",
          concessionAccountId: CONCESION,
          timeZone: "UTC",
          serviceStartLocal: "06:00:00",
          serviceEndLocal: "22:00:00",
          staleAfterSeconds: 180,
          corridorToleranceMeters: 150,
          corridorExitMinutes: 3,
          arrivalTolerancePct: 50,
          ...opts.circuito,
        };
  const r = {
    circuits: {
      getCircuit: async () => circuito,
      listStopsEnInstante: async () => [
        { stopId: "p1", name: "P1", orden: 1, sentido: null, latitude: 0, longitude: 0 },
      ],
      getPaths: async () => [{ sentido: "ida", coordinates: [[0, 0], [0.036, 0]] }],
      getPromesaEnInstante: async () => ({ declarada: true, frequencyMinutes: 10, franja: {} }),
    },
    telemetry: {
      getForUnitWindow: async (cuenta: string, _u: string, desde: Date, hasta: Date) => {
        llamadas.telemetria.push({ cuenta, desde, hasta });
        return [];
      },
    },
    pasosPorParada: {
      listarPasosDeUnidad: async (cuenta: string, _c: string, _u: string, desde: Date, hasta: Date) => {
        llamadas.pasos.push({ cuenta, desde, hasta });
        return (opts.pasos ?? []).map((p) => ({
          stopId: "p1",
          sentido: "ida",
          pasoHasta: new Date(p.pasoDesde.getTime() + 20_000),
          ...p,
        }));
      },
      marcaDeDeteccion: async () => D("2026-09-20T21:00:00Z"),
      // Los pasos del SERVICIO en la parada (todas las unidades), por la puerta del muro.
      listarPasosDeParada: async (cuenta: string) => {
        llamadas.servicio.push(cuenta);
        return opts.servicio ?? [];
      },
    },
  };
  const asignaciones = (
    opts.asignaciones ?? [{ unitId: "u1", validFrom: D("2026-09-01T00:00:00Z"), validTo: null }]
  ).map((a) => ({ unitLabel: "2120", carrierAccountId: a.carrierAccountId ?? CARRIER, ...a }));
  return { repos: r as never, llamadas, asignaciones };
}

const pedir = (r: ReturnType<typeof repos>, fecha = "2026-09-20", ahora = D("2026-09-21T12:00:00Z")) =>
  cargarJornadaParaJStaff(r.repos, { circuitId: "k1", unitId: "u1", fecha, ahora, asignaciones: r.asignaciones });

describe("cargarJornadaParaJStaff · qué se lee y con qué cuenta", () => {
  it("los pasos se leen como la concesión dueña (J-Tel), por la puerta del muro", async () => {
    const r = repos();
    await pedir(r);
    expect(r.llamadas.pasos[0]!.cuenta).toBe(CONCESION);
  });

  it("las posiciones, con la cuenta del carrier de la asignación y con margen de una hora", async () => {
    const r = repos();
    const j = await pedir(r);
    expect(j.estado).toBe("jornada");
    expect(r.llamadas.telemetria).toEqual([
      { cuenta: CARRIER, desde: D("2026-09-20T05:00:00Z"), hasta: D("2026-09-20T23:00:00Z") },
    ]);
  });

  it("NUNCA fuera de la asignación: asignada a las 8, ni la jornada ni el margen empiezan antes", async () => {
    const r = repos({ asignaciones: [{ unitId: "u1", validFrom: D("2026-09-20T08:00:00Z"), validTo: null }] });
    const j = await pedir(r);
    expect(r.llamadas.telemetria[0]!.desde).toEqual(D("2026-09-20T08:00:00Z"));
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.jornada.ventana.desde).toEqual(D("2026-09-20T08:00:00Z"));
  });

  it("sin asignación ese día no hay jornada, y no se lee una sola posición", async () => {
    const r = repos({ asignaciones: [{ unitId: "otra", validFrom: D("2026-09-01T00:00:00Z"), validTo: null }] });
    expect((await pedir(r)).estado).toBe("sin_asignacion");
    expect(r.llamadas.telemetria).toEqual([]);
  });

  it("sólo cuenta los pasos de la versión del detector que corre hoy", async () => {
    const r = repos({
      pasos: [
        { detectorVersion: VERSION_DEL_DETECTOR, pasoDesde: D("2026-09-20T07:00:00Z") },
        { detectorVersion: "detector-viejo", pasoDesde: D("2026-09-20T07:00:00Z") },
      ],
    });
    const j = await pedir(r);
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    // Dos pasos por la misma parada a la misma hora; sin el filtro serían dos vueltas.
    expect(j.jornada.vueltas).toHaveLength(1);
    expect(j.jornada.vueltas[0]!.pasos).toHaveLength(1);
  });
});

describe("cargarJornadaParaJStaff · el día de servicio", () => {
  it("hoy, la jornada termina AHORA, no al cierre", async () => {
    const r = repos();
    const j = await pedir(r, "2026-09-20", D("2026-09-20T10:00:00Z"));
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.jornada.ventana.hasta).toEqual(D("2026-09-20T10:00:00Z"));
    expect(r.llamadas.telemetria[0]!.hasta).toEqual(D("2026-09-20T10:00:00Z"));
  });

  it("antes de abrir no hay jornada todavía", async () => {
    expect((await pedir(repos(), "2026-09-20", D("2026-09-20T05:00:00Z"))).estado).toBe("no_ha_abierto");
  });

  it("un servicio que cruza medianoche cierra al día siguiente", async () => {
    const r = repos({ circuito: { serviceStartLocal: "18:00:00", serviceEndLocal: "02:00:00" } });
    const j = await pedir(r);
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.jornada.ventana).toEqual({ desde: D("2026-09-20T18:00:00Z"), hasta: D("2026-09-21T02:00:00Z") });
  });

  it("un circuito que no existe responde así, sin leer nada más", async () => {
    const r = repos({ circuito: null });
    expect((await pedir(r)).estado).toBe("no_existe");
    expect(r.llamadas.pasos).toEqual([]);
  });

  it("los minutos fuera del corredor salen del circuito, no de una constante (0051)", async () => {
    const j = await pedir(repos({ circuito: { corridorExitMinutes: 7 } }));
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.jornada.umbrales.minutosFuera).toBe(7);
  });

  it("la jornada no trae chofer: es de la unidad", async () => {
    const j = await pedir(repos());
    expect(JSON.stringify(j)).not.toMatch(/chofer|driver/i);
  });
});

describe("cargarJornadaParaJStaff · el intervalo del SERVICIO en cada paso (una sola vara)", () => {
  const paso = (unitId: string, hhmm: string) => ({
    stopId: "p1",
    unitId,
    sentido: "ida",
    pasoDesde: D(`2026-09-20T${hhmm}:00Z`),
    pasoHasta: D(`2026-09-20T${hhmm}:20Z`),
    detectorVersion: VERSION_DEL_DETECTOR,
  });

  it("se mide contra el paso anterior de CUALQUIER unidad, y dice cuál fue", async () => {
    const r = repos({
      asignaciones: [
        { unitId: "u1", validFrom: D("2026-09-01T00:00:00Z"), validTo: null },
        { unitId: "u2", validFrom: D("2026-09-01T00:00:00Z"), validTo: null },
      ],
      servicio: [paso("u2", "07:00"), paso("u1", "07:25")],
    });
    const j = await pedir({ ...r, asignaciones: r.asignaciones.map((a) => (a.unitId === "u2" ? { ...a, unitLabel: "2107" } : a)) });
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.intervalos).toHaveLength(1);
    expect(j.intervalos[0]).toMatchObject({ unitId: "u1", anteriorUnitId: "u2", anteriorEtiqueta: "2107", estado: "atrasada" });
  });

  it("se lee como la concesión dueña, por la puerta del muro", async () => {
    const r = repos({ servicio: [paso("u1", "07:05")] });
    await pedir(r);
    expect(new Set(r.llamadas.servicio)).toEqual(new Set([CONCESION]));
  });

  it("el primero del día se mide contra la apertura: sin paso anterior, no se nombra a nadie", async () => {
    const j = await pedir(repos({ servicio: [paso("u1", "06:08")] }));
    if (j.estado !== "jornada") throw new Error("se esperaba jornada");
    expect(j.intervalos[0]).toMatchObject({ anteriorUnitId: null, anteriorEtiqueta: null, estado: "en_rango" });
  });
});
