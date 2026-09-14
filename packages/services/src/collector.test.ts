import { describe, expect, it, vi } from "vitest";
import { CollectorService } from "./collector.js";

/** Repos falsos: solo lo que el recolector toca. */
function repos(opciones: {
  pollSeconds?: number;
  escrituras: Array<{ imei: string; recordedAt: Date }[]>;
}) {
  const guardado: Array<{ imei: string; recordedAt: Date }> = [];
  return {
    guardado,
    repos: {
      accounts: { listByType: async () => [{ id: "carrier-1", name: "Juárez Bus" }] },
      carriers: {
        getProfileByAccountId: async () => ({ gpsPollSeconds: opciones.pollSeconds ?? 30 }),
      },
      fleet: { getDevicesForCarrier: async () => [{ id: "dev-1", imei: "111" }] },
      livePositions: {
        upsertMany: async (filas: Array<{ imei: string; recordedAt: Date }>) => {
          guardado.push(...filas);
          return filas;
        },
      },
    } as never,
  };
}

/** Proveedor falso: la n-ésima llamada devuelve lo que diga el guion. */
function proveedor(guion: Array<{ puntos?: Array<{ recordedAt: Date }>; falla?: string }>) {
  let n = 0;
  return async () => {
    const paso = guion[Math.min(n++, guion.length - 1)];
    if (paso.falla) throw new Error(paso.falla);
    return {
      login: async () => "tok",
      getLastLocations: async () =>
        (paso.puntos ?? []).map((p) => ({
          imei: "111",
          latitude: 31.7,
          longitude: -106.4,
          speed: 10,
          heading: 90,
          timestamp: p.recordedAt,
        })),
    };
  };
}

const config = { umbrellaBaseUrl: "https://ejemplo" };
const sinEsperas = { sleep: async () => {}, now: () => new Date("2026-08-26T20:00:00Z") };

describe("CollectorService", () => {
  it("hace dos sondeos por ventana con cadencia de 30 s", async () => {
    const f = repos({ escrituras: [] });
    const t0 = new Date("2026-08-26T19:59:00Z");
    const t1 = new Date("2026-08-26T19:59:30Z");
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ puntos: [{ recordedAt: t0 }] }, { puntos: [{ recordedAt: t1 }] }]),
    } as never);

    const r = await svc.collectAll();
    expect(r.carriers[0].sondeos).toHaveLength(2);
    expect(r.carriers[0].sondeos.map((s) => s.offsetSeconds)).toEqual([0, 30]);
    expect(r.totalWritten).toBe(2);
  });

  it("la cadencia sale del perfil del carrier, no de una constante", async () => {
    const f = repos({ pollSeconds: 20, escrituras: [] });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ puntos: [{ recordedAt: new Date() }] }]),
    } as never);

    const r = await svc.collectAll();
    expect(r.carriers[0].pollSeconds).toBe(20);
    expect(r.carriers[0].sondeos).toHaveLength(3); // 60 / 20
  });

  /**
   * NO es el comportamiento deseado: es el de HOY, fijado para que el
   * comentario de `collectCarrier` no vuelva a mentir.
   *
   * El cron corre cada minuto y la ventana es de 60 s, así que
   * `floor(60 / 300)` da 0 y `Math.max(1, …)` lo sube a 1: con 300 en la base
   * se sondea UNA vez por invocación, o sea cada minuto, igual que con 60. Nada
   * avisa. El día que alguien haga que un valor mayor a 60 de verdad sondee más
   * lento, esta prueba se cae — y ese día hay que corregir también el
   * comentario.
   */
  it("hoy, un valor mayor a 60 NO sondea más lento: sondea una vez por minuto igual", async () => {
    const f = repos({ pollSeconds: 300, escrituras: [] });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ puntos: [{ recordedAt: new Date() }] }]),
    } as never);

    const r = await svc.collectAll();
    expect(r.carriers[0].pollSeconds).toBe(300);
    expect(r.carriers[0].sondeos).toHaveLength(1);
  });

  it("si el segundo sondeo falla, lo que escribió el primero se conserva y la invocación NO falla", async () => {
    const f = repos({ escrituras: [] });
    const t0 = new Date("2026-08-26T19:59:00Z");
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ puntos: [{ recordedAt: t0 }] }, { falla: "Umbrella 500" }]),
    } as never);

    const r = await svc.collectAll();
    expect(f.guardado).toHaveLength(1);
    expect(f.guardado[0].recordedAt).toEqual(t0);
    expect(r.carriers[0].sondeos[0].ok).toBe(true);
    expect(r.carriers[0].sondeos[1].ok).toBe(false);
    expect(r.carriers[0].sondeos[1].error).toContain("Umbrella 500");
    expect(r.carriers[0].ok).toBe(true);
    expect(r.anyOk).toBe(true);
  });

  it("si el PRIMER sondeo falla, el segundo sigue corriendo y escribe", async () => {
    const f = repos({ escrituras: [] });
    const t1 = new Date("2026-08-26T19:59:30Z");
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ falla: "timeout" }, { puntos: [{ recordedAt: t1 }] }]),
    } as never);

    const r = await svc.collectAll();
    expect(f.guardado).toHaveLength(1);
    expect(r.carriers[0].ok).toBe(true);
  });

  it("solo reporta anyOk=false cuando ningún sondeo funcionó", async () => {
    const f = repos({ escrituras: [] });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      provider: proveedor([{ falla: "sin red" }]),
    } as never);

    const r = await svc.collectAll();
    expect(r.anyOk).toBe(false);
    expect(r.totalWritten).toBe(0);
  });

  it("el primer sondeo no espera: si la invocación se corta, ya hay dato", async () => {
    const f = repos({ escrituras: [] });
    const sleep = vi.fn(async () => {});
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      sleep,
      provider: proveedor([{ puntos: [{ recordedAt: new Date() }] }]),
    } as never);

    await svc.collectAll();
    expect(sleep).toHaveBeenCalledTimes(1); // solo antes del segundo
  });
});

describe("CollectorService · un carrier no tumba a los demás", () => {
  /** Dos carriers: el primero revienta al leer su perfil, el segundo está sano. */
  function reposDosCarriers() {
    const guardado: Array<{ imei: string }> = [];
    return {
      guardado,
      repos: {
        accounts: {
          listByType: async () => [
            { id: "carrier-roto", name: "Carrier roto" },
            { id: "carrier-sano", name: "Carrier sano" },
          ],
        },
        carriers: {
          getProfileByAccountId: async (id: string) => {
            if (id === "carrier-roto") throw new Error('column "gps_poll_seconds" does not exist');
            return { gpsPollSeconds: 60 };
          },
        },
        fleet: { getDevicesForCarrier: async () => [{ id: "dev-1", imei: "111" }] },
        livePositions: {
          upsertMany: async (filas: Array<{ imei: string }>) => {
            guardado.push(...filas);
            return filas;
          },
        },
      } as never,
    };
  }

  it("el carrier que falla antes de sondear no impide que el sano recolecte", async () => {
    const f = reposDosCarriers();
    const svc = new CollectorService(f.repos, config, {
      sleep: async () => {},
      now: () => new Date("2026-08-26T20:00:00Z"),
      provider: proveedor([{ puntos: [{ recordedAt: new Date("2026-08-26T19:59:00Z") }] }]),
    } as never);

    const r = await svc.collectAll();

    const roto = r.carriers.find((c) => c.carrierName === "Carrier roto")!;
    expect(roto.ok).toBe(false);
    expect(roto.error).toContain("gps_poll_seconds");
    expect(roto.sondeos).toEqual([]);

    const sano = r.carriers.find((c) => c.carrierName === "Carrier sano")!;
    expect(sano.ok).toBe(true);
    expect(sano.written).toBe(1);

    expect(f.guardado).toHaveLength(1);
    expect(r.anyOk).toBe(true); // no se responde 503 por culpa del roto
  });
});

describe("CollectorService · una sola pasada para las cuentas en Compás", () => {
  const JB = { id: "cuenta-jb", name: "Juárez Bus" };
  const ASAV = { id: "cuenta-asav", name: "asav" };
  const TERCERA = { id: "cuenta-3", name: "Tercer cliente" };
  const PROPIA = { id: "cuenta-propia", name: "Con Umbrella" };

  /** Repos falsos con varias cuentas; `enCompas` dice cuáles apuntan a Compás. */
  function reposPlataforma(opciones: {
    cuentas: Array<{ id: string; name: string }>;
    enCompas: string[];
    aparatos: Array<{ id: string; imei: string; carrierAccountId: string }>;
    createAvisoFalla?: string;
  }) {
    const guardado: Array<{ imei: string; carrierAccountId: string }> = [];
    const avisos: Array<{ kind: string }> = [];
    return {
      guardado,
      avisos,
      repos: {
        accounts: { listByType: async () => opciones.cuentas },
        carriers: {
          getProfileByAccountId: async (id: string) => ({
            gpsProvider: opciones.enCompas.includes(id) ? "compas" : "umbrella",
            gpsPollSeconds: 30,
          }),
        },
        fleet: {
          listDeviceOwners: async () => opciones.aparatos,
          getDevicesForCarrier: async (id: string) =>
            opciones.aparatos.filter((a) => a.carrierAccountId === id),
        },
        livePositions: {
          upsertMany: async (filas: Array<{ imei: string; carrierAccountId: string }>) => {
            guardado.push(...filas);
            return filas;
          },
        },
        ingestAlerts: {
          findOpenByKind: async () => undefined,
          resolveOpen: async () => {},
          create: async (d: { kind: string }) => {
            if (opciones.createAvisoFalla) throw new Error(opciones.createAvisoFalla);
            avisos.push(d);
            return d;
          },
        },
      } as never,
    };
  }

  /** Compás falso: todos los aparatos con posición, y cuenta cuántas veces lo llaman. */
  function compasFalso(opciones: {
    imeis: string[];
    catalogo?: string[];
    getDevicesFalla?: number;
  }) {
    const llamadas = { positions: 0, devices: 0 };
    return {
      llamadas,
      compas: async () => ({
        login: async () => "tok",
        getLastLocations: async () => {
          llamadas.positions += 1;
          return opciones.imeis.map((imei) => ({
            imei,
            latitude: 31.7,
            longitude: -106.4,
            timestamp: new Date("2026-09-14T20:00:00Z"),
          }));
        },
        getDevices: async () => {
          llamadas.devices += 1;
          if (opciones.getDevicesFalla && llamadas.devices <= opciones.getDevicesFalla) {
            throw new Error("catálogo caído");
          }
          return (opciones.catalogo ?? opciones.imeis).map((imei) => ({ imei }));
        },
      }),
    };
  }

  it("con TRES cuentas en Compás, Compás se llama una vez por sondeo y se duerme UNA vez, no una por cuenta", async () => {
    const f = reposPlataforma({
      cuentas: [JB, ASAV, TERCERA],
      enCompas: [JB.id, ASAV.id, TERCERA.id],
      aparatos: [
        { id: "d1", imei: "111", carrierAccountId: JB.id },
        { id: "d2", imei: "222", carrierAccountId: ASAV.id },
        { id: "d3", imei: "333", carrierAccountId: TERCERA.id },
      ],
    });
    const c = compasFalso({ imeis: ["111", "222", "333"] });
    const sleep = vi.fn(async () => {});
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      sleep,
      compas: c.compas,
    } as never);

    const r = await svc.collectAll();
    expect(c.llamadas.positions).toBe(2); // dos sondeos, sin importar cuántas cuentas
    expect(sleep).toHaveBeenCalledTimes(1); // con el bucle viejo eran tres
    expect(r.compas?.sondeos.map((s) => s.offsetSeconds)).toEqual([0, 30]);
    expect(r.carriers).toEqual([]);
    expect(r.anyOk).toBe(true);
  });

  it("el muro: cada posición se escribe con la cuenta dueña según J-Tel, y el resumen la cuenta ahí", async () => {
    const f = reposPlataforma({
      cuentas: [JB, ASAV],
      enCompas: [JB.id, ASAV.id],
      aparatos: [
        { id: "d1", imei: "111", carrierAccountId: JB.id },
        { id: "d2", imei: "222", carrierAccountId: ASAV.id },
      ],
    });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      windowSeconds: 30,
      compas: compasFalso({ imeis: ["111", "222"] }).compas,
    } as never);

    const r = await svc.collectAll();
    expect(f.guardado).toEqual([
      expect.objectContaining({ imei: "111", carrierAccountId: JB.id }),
      expect.objectContaining({ imei: "222", carrierAccountId: ASAV.id }),
    ]);
    expect(r.compas?.carriers).toEqual([
      { carrierAccountId: JB.id, carrierName: "Juárez Bus", written: 1 },
      { carrierAccountId: ASAV.id, carrierName: "asav", written: 1 },
    ]);
  });

  it("lo que Compás trae y no es de una cuenta en Compás NO se escribe: ni sin dueño, ni de otro proveedor, ni en dos cuentas", async () => {
    const f = reposPlataforma({
      cuentas: [JB, ASAV, PROPIA],
      enCompas: [JB.id, ASAV.id],
      aparatos: [
        { id: "d1", imei: "111", carrierAccountId: JB.id },
        { id: "d2", imei: "444", carrierAccountId: PROPIA.id },
        { id: "d3", imei: "555", carrierAccountId: JB.id },
        { id: "d4", imei: "555", carrierAccountId: ASAV.id },
      ],
    });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      windowSeconds: 30,
      provider: async () => ({ login: async () => "t", getLastLocations: async () => [] }),
      compas: compasFalso({ imeis: ["111", "999", "444", "555"] }).compas,
    } as never);

    await svc.collectAll();
    expect(f.guardado.map((g) => g.imei)).toEqual(["111"]);
  });

  it("una cuenta con proveedor propio sigue con su sondeo, al mismo tiempo que la pasada", async () => {
    const f = reposPlataforma({
      cuentas: [JB, PROPIA],
      enCompas: [JB.id],
      aparatos: [
        { id: "d1", imei: "111", carrierAccountId: JB.id },
        { id: "d2", imei: "444", carrierAccountId: PROPIA.id },
      ],
    });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      compas: compasFalso({ imeis: ["111"] }).compas,
      provider: proveedor([{ puntos: [{ recordedAt: new Date("2026-09-14T20:00:00Z") }] }]),
    } as never);

    const r = await svc.collectAll();
    expect(r.carriers.map((c) => c.carrierName)).toEqual(["Con Umbrella"]);
    expect(r.carriers[0]!.ok).toBe(true);
    expect(r.compas?.ok).toBe(true);
  });

  it("sin la conexión de plataforma en el ambiente, la pasada falla con el nombre de las variables y NO cae a otro proveedor", async () => {
    const f = reposPlataforma({
      cuentas: [JB],
      enCompas: [JB.id],
      aparatos: [{ id: "d1", imei: "111", carrierAccountId: JB.id }],
    });
    const svc = new CollectorService(f.repos, config, sinEsperas as never);

    const r = await svc.collectAll();
    expect(r.compas?.ok).toBe(false);
    expect(r.compas?.sondeos[0]!.error).toContain("COMPAS_GPS_URL");
    expect(f.guardado).toEqual([]);
    expect(r.anyOk).toBe(false); // 503: esto sí hay que verlo
  });

  it("el cotejo corre una vez por ventana y abre el aviso del aparato sin dueño", async () => {
    const f = reposPlataforma({
      cuentas: [ASAV],
      enCompas: [ASAV.id],
      aparatos: [{ id: "d3", imei: "860693089187232", carrierAccountId: ASAV.id }],
    });
    const c = compasFalso({
      imeis: ["860693089187232"],
      catalogo: ["860693089187232", "860693086787513"],
    });
    const svc = new CollectorService(f.repos, config, { ...sinEsperas, compas: c.compas } as never);

    const r = await svc.collectAll();
    expect(c.llamadas.devices).toBe(1);
    expect(r.compas?.cotejo).toMatchObject({ sinDueno: 1, avisosAbiertos: 1 });
    expect(f.avisos.map((a) => a.kind)).toEqual(["aparato_sin_dueno"]);
  });

  it("si el catálogo falla en el primer sondeo, el cotejo se reintenta en el segundo y las posiciones ya quedaron", async () => {
    const f = reposPlataforma({
      cuentas: [JB],
      enCompas: [JB.id],
      aparatos: [{ id: "d1", imei: "111", carrierAccountId: JB.id }],
    });
    const c = compasFalso({ imeis: ["111"], getDevicesFalla: 1 });
    const svc = new CollectorService(f.repos, config, { ...sinEsperas, compas: c.compas } as never);

    const r = await svc.collectAll();
    expect(f.guardado).toHaveLength(2);
    expect(c.llamadas.devices).toBe(2);
    expect(r.compas?.cotejo).toBeDefined();
  });

  it("desplegado antes de la 0035: el aviso no se puede escribir, y las posiciones se escriben igual", async () => {
    const f = reposPlataforma({
      cuentas: [JB],
      enCompas: [JB.id],
      aparatos: [{ id: "d1", imei: "111", carrierAccountId: JB.id }],
      createAvisoFalla: 'invalid input value for enum ingest_alert_kind: "aparato_sin_dueno"',
    });
    const svc = new CollectorService(f.repos, config, {
      ...sinEsperas,
      compas: compasFalso({ imeis: ["111"], catalogo: ["111", "999"] }).compas,
    } as never);

    const r = await svc.collectAll();
    expect(f.guardado).toHaveLength(2);
    expect(r.compas?.ok).toBe(true);
    expect(r.compas?.cotejo?.error).toContain("ingest_alert_kind");
    expect(r.anyOk).toBe(true);
  });
});
