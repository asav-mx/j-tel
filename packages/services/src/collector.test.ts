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
