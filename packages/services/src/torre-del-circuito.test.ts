import { describe, it, expect } from "vitest";
import { armarTorreDelCircuito, type TorreDelCircuito } from "./torre-del-circuito.js";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/*
 * La derivación de la torre (9.2b–9.3b, 9.14), contra repos falsos.
 *
 * El reloj vive en UTC y la franja promete cada 10 min con 50 % de tolerancia,
 * así que la banda es [5, 15] minutos y se puede verificar a mano. El trazado
 * es una recta sobre el ecuador para que la geometría no distraiga.
 */
const CONCESION = "cuenta-concesion";
const CARRIER = "cuenta-carrier";
const AHORA = new Date("2026-09-20T08:00:00Z");
const APERTURA = new Date("2026-09-20T06:00:00Z");
const MIN = 60_000;
const hace = (min: number) => new Date(AHORA.getTime() - min * MIN);

const CIRCUITO = {
  id: "k1",
  concessionAccountId: CONCESION,
  timeZone: "UTC",
  serviceStartLocal: "06:00:00",
  serviceEndLocal: "22:00:00",
  serviceLaunchDate: null,
  corridorToleranceMeters: 150,
  staleAfterSeconds: 180,
  serviceConfidenceMinutes: 15,
  arrivalTolerancePct: 50,
};

/** Sobre el trazado y con señal fresca: la unidad está en la calle. */
const EN_LA_CALLE = { latitude: 0, longitude: 0.002, heading: 90, recordedAt: hace(1) };

interface Paso {
  stopId: string;
  unitId: string;
  sentido: "ida" | "vuelta";
  pasoDesde: Date;
  pasoHasta: Date;
}

const paso = (stopId: string, unitId: string, minutosAtras: number, duracionSeg = 30): Paso => ({
  stopId,
  unitId,
  sentido: "ida",
  pasoDesde: hace(minutosAtras),
  pasoHasta: new Date(hace(minutosAtras).getTime() + duracionSeg * 1000),
});

function repos(opts: {
  circuito?: Partial<typeof CIRCUITO> | null;
  alcance?: "concesion" | "carrier" | "ninguno";
  unidades?: Array<{ unitId: string; unitLabel: string } & Partial<typeof EN_LA_CALLE>>;
  paradas?: Array<{ stopId: string; name: string; orden: number; sentido: "ida" | "vuelta" | null }>;
  pasos?: Paso[];
  frecuencia?: number | null;
  variosCarriers?: boolean;
} = {}) {
  const circuito = opts.circuito === null ? null : { ...CIRCUITO, ...opts.circuito };
  const paradas = opts.paradas ?? [{ stopId: "p1", name: "Parada 1", orden: 1, sentido: "ida" as const }];
  const pasos = opts.pasos ?? [];
  const unidades = opts.unidades ?? [];

  return {
    circuits: {
      getCircuitVisibleParaCuenta: async (cuentaId: string) =>
        opts.alcance === "ninguno" ? null : circuito,
      planDelCircuitoParaCuenta: async () => ({
        alcance: opts.alcance ?? "concesion",
        unidades: unidades.map((u) => ({
          assignmentId: `a-${u.unitId}`,
          unitId: u.unitId,
          unitLabel: u.unitLabel,
          plateNumber: null,
          assignedFrom: APERTURA,
          latitude: u.latitude ?? null,
          longitude: u.longitude ?? null,
          heading: u.heading ?? null,
          recordedAt: u.recordedAt ?? null,
        })),
      }),
      listStopsVigentes: async () => paradas,
      getPaths: async () => [{ sentido: "ida", coordinates: [[0, 0], [0.009, 0]] }],
      getPromesaEnInstante: async () =>
        opts.frecuencia === null
          ? { declarada: false }
          : { declarada: true, frequencyMinutes: opts.frecuencia ?? 10, franja: {} },
      circuitoTieneMasDeUnCarrier: async () => opts.variosCarriers ?? false,
    },
    pasosPorParada: {
      listarPasosDeParada: async (_c: string, stopId: string) =>
        pasos.filter((p) => p.stopId === stopId).map((p) => ({ ...p, detectorVersion: VERSION_DEL_DETECTOR })),
    },
  } as never;
}

const abierta = (t: TorreDelCircuito) => {
  if (t.alcance === "ninguno") throw new Error("se esperaba una torre con alcance");
  return t;
};

describe("armarTorreDelCircuito · el muro y el alcance", () => {
  it("un circuito que esta cuenta no puede ver responde como uno que no existe", async () => {
    const t = await armarTorreDelCircuito(repos({ alcance: "ninguno" }), {
      cuentaId: "ajena",
      circuitId: "k1",
      ahora: AHORA,
    });
    expect(t).toEqual({ alcance: "ninguno" });
  });

  it("la concesión dueña siempre tiene el flujo completo, aunque el circuito lo corran varios", async () => {
    // Ve TODOS los pasos de su circuito: lo que ve ES el servicio.
    const t = abierta(
      await armarTorreDelCircuito(repos({ variosCarriers: true }), {
        cuentaId: CONCESION,
        circuitId: "k1",
        ahora: AHORA,
      }),
    );
    expect(t.alcance).toBe("concesion");
    expect(t.flujo).toBe("completo");
  });

  it("un carrier SOLO en su circuito también tiene el flujo completo (9.14)", async () => {
    const t = abierta(
      await armarTorreDelCircuito(repos({ alcance: "carrier", variosCarriers: false }), {
        cuentaId: CARRIER,
        circuitId: "k1",
        ahora: AHORA,
      }),
    );
    expect(t.flujo).toBe("completo");
  });
});

describe("armarTorreDelCircuito · el estado de la unidad contra la banda (9.2c, 9.3b)", () => {
  const conIntervalo = async (minutosEntrePasos: number) => {
    /*
     * Dos pasos por la misma parada: el primero ancla, el segundo es el que se
     * mide. El intervalo es la distancia entre ellos, contra la banda [5, 15].
     */
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }],
          pasos: [paso("p1", "u0", 20 + minutosEntrePasos), paso("p1", "u1", 20)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    return t.unidades[0]!.promesa;
  };

  it("intervalo dentro de la banda → EN RANGO, con su referencia al lado", async () => {
    const p = await conIntervalo(10);
    expect(p.estado).toBe("en_rango");
    expect(p.motivo).toBeNull();
    // 9.3b: todo número lleva su referencia.
    expect(p.referencia).toEqual({ desdeMin: 5, hastaMin: 15, frecuenciaMin: 10 });
    expect(p.intervalo!.desdeMin).toBeCloseTo(9.5, 6); // el ancla es el FIN del paso anterior
  });

  it("intervalo CORTO → ADELANTADA (le pisó los talones al anterior)", async () => {
    const p = await conIntervalo(2);
    expect(p.estado).toBe("adelantada");
    expect(p.intervalo!.hastaMin).toBeLessThan(p.referencia!.desdeMin);
  });

  it("intervalo LARGO → ATRASADA", async () => {
    const p = await conIntervalo(40);
    expect(p.estado).toBe("atrasada");
    expect(p.intervalo!.desdeMin).toBeGreaterThan(p.referencia!.hastaMin);
  });

  it("el rango a caballo de la orilla es SIN DATOS con su propio motivo, no un veredicto a medias", async () => {
    // Un paso largo (4 min de rango) que cruza la orilla de abajo de la banda.
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }],
          pasos: [paso("p1", "u0", 27), paso("p1", "u1", 23, 4 * 60)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    const p = t.unidades[0]!.promesa;
    expect(p.estado).toBe("sin_datos");
    expect(p.motivo).toBe("a_caballo");
    // Y el intervalo SÍ sale: se midió, sólo que no alcanzó a concluir.
    expect(p.intervalo).not.toBeNull();
  });

  it("sin un solo paso medido es SIN DATOS por sin_pasos, no por la señal", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({ unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }] }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.unidades[0]!.promesa).toMatchObject({ estado: "sin_datos", motivo: "sin_pasos" });
  });

  it("sin franja declarada para ese instante es SIN DATOS por sin_promesa — no se rellena con la vecina", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          frecuencia: null,
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }],
          pasos: [paso("p1", "u0", 30), paso("p1", "u1", 20)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.unidades[0]!.promesa).toMatchObject({ estado: "sin_datos", motivo: "sin_promesa" });
  });
});

describe("armarTorreDelCircuito · los dos ejes no se aplanan (decisión de ASAV)", () => {
  it("una unidad que no salió NO dice SIN DATOS: la promesa no le aplica", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({ unidades: [{ unitId: "u1", unitLabel: "10254" }] }), // sin posición
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.unidades[0]!.situacion).toBe("no_ha_salido");
    expect(t.unidades[0]!.promesa.estado).toBe("no_aplica");
    expect(t.unidades[0]!.promesa.motivo).toBeNull();
  });

  it("fuera de horario no se afirma nada de nadie — ni de las unidades ni de las paradas", async () => {
    const deNoche = new Date("2026-09-20T23:30:00Z");
    const t = abierta(
      await armarTorreDelCircuito(
        repos({ unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }] }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: deNoche },
      ),
    );
    expect(t.enHorario).toBe(false);
    expect(t.unidades[0]!.situacion).toBe("fuera_de_horario");
    expect(t.unidades[0]!.promesa.estado).toBe("no_aplica");
    expect(t.esperas[0]!.estado).toBe("no_aplica");
    expect(t.ritmo).toEqual({ disponible: false, motivo: "fuera_de_horario" });
  });

  it("sin señal fresca sigue en la calle: su paso medido es evidencia que no depende del GPS", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE, recordedAt: hace(30) }],
          pasos: [paso("p1", "u0", 30), paso("p1", "u1", 20)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.unidades[0]!.situacion).toBe("sin_senal");
    expect(t.unidades[0]!.promesa.estado).toBe("en_rango");
    // Y se enuncia la edad del último punto, con su última posición conocida.
    expect(t.unidades[0]!.ultimaPosicion!.antiguedadSeg).toBeCloseTo(1800, 0);
    expect(t.unidades[0]!.sobreElCorredor).not.toBeNull();
  });
});

describe("armarTorreDelCircuito · la compuerta del flujo (9.14)", () => {
  const carrierCompartido = async () =>
    abierta(
      await armarTorreDelCircuito(
        repos({
          alcance: "carrier",
          variosCarriers: true,
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }],
          pasos: [paso("p1", "u0", 60), paso("p1", "u1", 20)],
        }),
        { cuentaId: CARRIER, circuitId: "k1", ahora: AHORA },
      ),
    );

  it("SIN DATOS antes que un número prestado: no sale un ATRASADA falso", async () => {
    const t = await carrierCompartido();
    expect(t.flujo).toBe("incompleto");
    /*
     * Sobre sus propias filas el intervalo sería de 40 min contra una banda de
     * 5–15: ATRASADA. Pero el paso del OTRO carrier no lo ve, y ese ATRASADA
     * sería falso. La compuerta lo convierte en SIN DATOS con su motivo.
     */
    expect(t.unidades[0]!.promesa).toMatchObject({
      estado: "sin_datos",
      motivo: "flujo_incompleto",
    });
    expect(t.esperas[0]!).toMatchObject({ estado: "sin_datos", motivo: "flujo_incompleto" });
    expect(t.sostenimiento).toBeNull();
    expect(t.ritmo).toEqual({ disponible: false, motivo: "flujo_incompleto" });
  });

  it("la posición y la frescura SÍ se emiten: son de su propia unidad, no del flujo", async () => {
    const t = await carrierCompartido();
    expect(t.unidades[0]!.situacion).toBe("en_ruta");
    expect(t.unidades[0]!.ultimaPosicion).not.toBeNull();
    expect(t.unidades[0]!.sobreElCorredor).not.toBeNull();
  });
});

describe("armarTorreDelCircuito · la espera de la parada (9.2d, 9.3b)", () => {
  it("es un número ABIERTO que crece: mismo dato, más tarde, más espera", async () => {
    const hacer = (ahora: Date) =>
      armarTorreDelCircuito(repos({ pasos: [paso("p1", "u1", 20)] }), {
        cuentaId: CONCESION,
        circuitId: "k1",
        ahora,
      });
    const temprano = abierta(await hacer(AHORA));
    const tarde = abierta(await hacer(new Date(AHORA.getTime() + 7 * MIN)));
    expect(tarde.esperas[0]!.minutos!).toBeCloseTo(temprano.esperas[0]!.minutos! + 7, 6);
  });

  it("NUNCA dice adelantada: un intervalo abierto sólo crece", async () => {
    // Un minuto desde la última pasada, muy por debajo de la orilla de abajo.
    const t = abierta(
      await armarTorreDelCircuito(repos({ pasos: [paso("p1", "u1", 1)] }), {
        cuentaId: CONCESION,
        circuitId: "k1",
        ahora: AHORA,
      }),
    );
    expect(t.esperas[0]!.estado).toBe("en_rango");
  });

  it("pasada la orilla de arriba, la parada lo declara", async () => {
    const t = abierta(
      await armarTorreDelCircuito(repos({ pasos: [paso("p1", "u1", 40)] }), {
        cuentaId: CONCESION,
        circuitId: "k1",
        ahora: AHORA,
      }),
    );
    expect(t.esperas[0]!).toMatchObject({ estado: "atrasada", desdeLaApertura: false });
    expect(t.esperas[0]!.minutos!).toBeGreaterThan(t.esperas[0]!.referencia!.hastaMin);
  });

  it("SIN QUE NINGUNA UNIDAD HAYA HECHO NADA, la parada puede declarar que la promesa se rompe", async () => {
    /*
     * El corazón del 9.2d: no hay un solo paso hoy, el circuito abrió hace dos
     * horas, y la parada ya tiene algo que decir. Es la única medición del
     * circuito que no espera a que ocurra un hecho.
     */
    const t = abierta(
      await armarTorreDelCircuito(repos({ pasos: [] }), {
        cuentaId: CONCESION,
        circuitId: "k1",
        ahora: AHORA,
      }),
    );
    expect(t.esperas[0]!).toMatchObject({
      estado: "atrasada",
      desdeLaApertura: true,
      ultimaPasada: null,
    });
    expect(t.esperas[0]!.minutos).toBeCloseTo(120, 6);
  });

  it("una parada que sirve los dos sentidos se mide en los dos", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({ paradas: [{ stopId: "p1", name: "Parada 1", orden: 1, sentido: null }] }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.esperas.map((e) => e.sentido)).toEqual(["ida", "vuelta"]);
  });
});

describe("armarTorreDelCircuito · sostenimiento y ritmo", () => {
  it("el sostenimiento cuenta, no juzga: cuántos de los medidos cayeron en rango", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          pasos: [
            paso("p1", "u1", 60), // ancla contra la apertura (60 min): fuera
            paso("p1", "u2", 50), // 10 min después: en rango
            paso("p1", "u1", 40), // 10 min después: en rango
            paso("p1", "u2", 10), // 30 min después: fuera
          ],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.sostenimiento).toEqual({ enRango: 2, medidos: 4 });
  });

  it("el ritmo prometido NO se emite sin vueltas medidas: el carril va vacío y lo declara (9.2e)", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          paradas: [
            { stopId: "p1", name: "Parada 1", orden: 1, sentido: "ida" },
            { stopId: "p2", name: "Parada 2", orden: 2, sentido: "ida" },
          ],
          pasos: [paso("p1", "u1", 20)], // un solo paso: ningún tramo medido
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.ritmo).toMatchObject({ disponible: false, motivo: "sin_tramos" });
  });

  it("con los tramos medidos sí se emite, y sale del tiempo medido", async () => {
    /*
     * Una unidad recorre p1 → p2 en 10 min y cierra la vuelta p2 → p1 en 20.
     * La vuelta medida son 30 min, y de ahí —no de repartir parejo— sale dónde
     * van las referencias.
     */
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          paradas: [
            { stopId: "p1", name: "Parada 1", orden: 1, sentido: "ida" },
            { stopId: "p2", name: "Parada 2", orden: 2, sentido: "ida" },
          ],
          pasos: [paso("p1", "u1", 60), paso("p2", "u1", 50), paso("p1", "u1", 30)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    expect(t.ritmo.disponible).toBe(true);
    if (!t.ritmo.disponible) return;
    expect(t.ritmo.vueltaMinutos).toBe(30);
    expect(t.ritmo.referencias.length).toBeGreaterThan(0);
    // Ninguna referencia pasa de la vuelta: la que ya la dio, sale.
    expect(t.ritmo.referencias.every((r) => r.minutosEnLaVuelta < 30)).toBe(true);
  });
});

describe("armarTorreDelCircuito · el vocabulario del motor no sale al borde (9.3b)", () => {
  it("ninguna salida dice sostuvo, se_agujero ni hueco", async () => {
    const t = abierta(
      await armarTorreDelCircuito(
        repos({
          unidades: [{ unitId: "u1", unitLabel: "10254", ...EN_LA_CALLE }],
          pasos: [paso("p1", "u0", 30), paso("p1", "u1", 20)],
        }),
        { cuentaId: CONCESION, circuitId: "k1", ahora: AHORA },
      ),
    );
    const serializada = JSON.stringify(t);
    for (const prohibida of ["sostuvo", "se_agujero", "hueco", "cumpli"]) {
      expect(serializada.toLowerCase(), `la torre emitió «${prohibida}»`).not.toContain(prohibida);
    }
  });
});
