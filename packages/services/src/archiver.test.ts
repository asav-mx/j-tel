import { describe, expect, it } from "vitest";
import { ArchiverService } from "./archiver.js";

/*
 * La marca de lectura por aparato (0037).
 *
 * El caso que la motivó, medido en la desechable el 15 de septiembre de 2026:
 * con UNA marca por cuenta, un aparato mudo de 100 hizo que 70 perdieran ~10
 * minutos para siempre. Estas pruebas fijan las tres condiciones que vuelven
 * una corrida incompleta «más vueltas» en vez de pérdida.
 */

const AHORA = new Date("2026-09-15T18:00:00Z");
const MIN = 60_000;
const hace = (min: number) => new Date(AHORA.getTime() - min * MIN);

/** Repos falsos con marcas de verdad: sólo avanzan, como `greatest` en la base. */
function repos(opciones: { imeis: string[]; marcaCuenta?: Date; marcas?: Record<string, Date> }) {
  const marcas = new Map<string, Date>(Object.entries(opciones.marcas ?? {}));
  const guardados: Array<{ imei: string; recordedAt: Date }> = [];
  let marcaCuenta = opciones.marcaCuenta ?? null;
  const r = {
    accounts: { listByType: async () => [{ id: "c1", name: "Juárez Bus" }] },
    carriers: { getProfileByAccountId: async () => ({ gpsProvider: "compas" }) },
    fleet: {
      getDevicesForCarrier: async () => opciones.imeis.map((imei) => ({ id: `d-${imei}`, imei })),
      resolveUnitAtTime: async () => ({ unitId: "u1" }),
    },
    telemetry: {
      getWatermark: async () => (marcaCuenta ? { lastRecordedAt: marcaCuenta } : undefined),
      setWatermark: async (_c: string, t: Date) => {
        marcaCuenta = t;
      },
      getArchiveMarks: async () => new Map(marcas),
      setArchiveMark: async (_c: string, imei: string, t: Date) => {
        const antes = marcas.get(imei);
        if (!antes || t > antes) marcas.set(imei, t);
      },
      savePoints: async (filas: Array<{ imei: string; recordedAt: Date }>) => {
        guardados.push(...filas);
        return filas;
      },
    },
    ingestAlerts: { create: async () => ({}) },
  };
  return { repos: r as never, marcas, guardados, marcaCuenta: () => marcaCuenta };
}

/** Un Traccar falso: un punto por minuto por aparato, con aparatos mudos y un reloj que avanza por petición. */
function proveedor(opciones: {
  catalogo: string[];
  mudos?: string[];
  /** Aparatos para los que el proveedor contesta «demasiadas peticiones». */
  limitados?: string[];
  alPreguntar?: () => void;
  sinPuntos?: boolean;
}) {
  const pedidos: Array<{ imei: string; desde: Date; hasta: Date }> = [];
  const p = {
    name: "traccar",
    login: async () => "tok",
    getDevices: async () => opciones.catalogo.map((imei) => ({ imei })),
    getHistoryLocations: async (
      _t: string,
      q: { imeis?: string[]; beginGmt: Date; endGmt: Date },
    ) => {
      const imei = q.imeis![0]!;
      pedidos.push({ imei, desde: q.beginGmt, hasta: q.endGmt });
      opciones.alPreguntar?.();
      if (opciones.limitados?.includes(imei)) {
        throw new Error("Traccar 429 en /api/positions: too many requests");
      }
      if (opciones.mudos?.includes(imei)) {
        throw new Error("Traccar no contestó en 10 s en /api/positions");
      }
      if (opciones.sinPuntos) return [];
      const puntos = [];
      for (let t = Math.ceil(q.beginGmt.getTime() / MIN) * MIN; t <= q.endGmt.getTime(); t += MIN) {
        puntos.push({ imei, latitude: 31.7, longitude: -106.4, timestamp: new Date(t) });
      }
      return puntos;
    },
  };
  // `as never`, igual que en collector.test: el falso sólo trae lo que el archivador toca.
  return { pedidos, resolver: (async () => p) as never };
}

const config = { umbrellaBaseUrl: "https://ejemplo" };

describe("ArchiverService · marca de lectura por aparato", () => {
  it("un aparato mudo no detiene a los demás, y su marca no se mueve", async () => {
    const imeis = ["a", "b", "c", "d", "e", "f"];
    const f = repos({ imeis, marcaCuenta: hace(10) });
    const t = proveedor({ catalogo: imeis, mudos: ["b"] });
    const svc = new ArchiverService(f.repos, config, { provider: t.resolver });

    const r = await svc.archiveCarrier("c1", "Juárez Bus", AHORA);

    expect(r.aparatos).toMatchObject({ alDia: 5, sinTerminar: 0, fueraDelProveedor: 0 });
    expect(r.aparatos!.fallidos.map((x) => x.imei)).toEqual(["b"]);
    for (const imei of ["a", "c", "d", "e", "f"]) expect(f.marcas.get(imei)).toEqual(AHORA);
    // Anotada en su arranque, y ahí se queda: no avanzó a «ahora».
    expect(f.marcas.get("b")).toEqual(hace(10));
    expect(r.error).toContain("se retoman");
  });

  it("en la corrida siguiente el que falló va primero y recupera su ventana entera", async () => {
    const imeis = ["a", "b", "c"];
    const f = repos({ imeis, marcaCuenta: hace(10) });
    const mudo = proveedor({ catalogo: imeis, mudos: ["b"] });
    await new ArchiverService(f.repos, config, { provider: mudo.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      AHORA,
    );

    const despues = new Date(AHORA.getTime() + 10 * MIN);
    const sano = proveedor({ catalogo: imeis });
    await new ArchiverService(f.repos, config, { provider: sano.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      despues,
    );

    // «b» no tenía marca propia: quedó anotada al empezar la PRIMERA corrida,
    // con la marca de la cuenta de antes de leer a nadie — no con la que los
    // demás empujaron a «ahora».
    expect(sano.pedidos[0]!.imei).toBe("b");
    const deB = f.guardados.filter((g) => g.imei === "b").map((g) => g.recordedAt.getTime());
    const deA = f.guardados.filter((g) => g.imei === "a").map((g) => g.recordedAt.getTime());
    expect(Math.min(...deB)).toBeLessThanOrEqual(hace(10).getTime());
    expect(Math.max(...deB)).toBe(despues.getTime());
    expect(Math.min(...deA)).toBe(Math.min(...deB));
  });

  it("el más atrasado se lee primero", async () => {
    const imeis = ["nuevo", "viejo", "medio"];
    const f = repos({
      imeis,
      marcaCuenta: hace(5),
      marcas: { nuevo: hace(5), viejo: hace(50), medio: hace(20) },
    });
    const t = proveedor({ catalogo: imeis });
    await new ArchiverService(f.repos, config, { provider: t.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      AHORA,
    );
    expect(t.pedidos.map((p) => p.imei)).toEqual(["viejo", "medio", "nuevo"]);
    // Cada uno desde SU marca, menos los 5 min de traslape.
    expect(t.pedidos[0]!.desde).toEqual(hace(55));
    expect(t.pedidos[2]!.desde).toEqual(hace(10));
  });

  it("al acabarse el presupuesto deja de empezar lecturas, y los que faltan conservan su marca", async () => {
    const imeis = ["a", "b", "c", "d"];
    const f = repos({ imeis, marcaCuenta: hace(10) });
    let reloj = 0;
    const t = proveedor({ catalogo: imeis, alPreguntar: () => (reloj += 100) });
    const svc = new ArchiverService(f.repos, config, {
      provider: t.resolver,
      presupuestoMs: 250,
      reloj: () => reloj,
    });

    const r = await svc.archiveCarrier("c1", "Juárez Bus", AHORA);

    expect(t.pedidos.map((p) => p.imei)).toEqual(["a", "b", "c"]);
    expect(r.aparatos).toMatchObject({ alDia: 3, sinTerminar: 1 });
    expect(f.marcas.get("d")).toEqual(hace(10));

    // Y la siguiente corrida empieza por «d», que es el más atrasado.
    reloj = 0;
    const t2 = proveedor({ catalogo: imeis });
    await new ArchiverService(f.repos, config, { provider: t2.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      new Date(AHORA.getTime() + 10 * MIN),
    );
    expect(t2.pedidos[0]!.imei).toBe("d");
  });

  it("si el proveedor pide bajarle, la corrida para y los que faltan conservan su marca", async () => {
    const imeis = ["a", "b", "c"];
    const f = repos({ imeis, marcaCuenta: hace(10) });
    const t = proveedor({ catalogo: imeis, limitados: ["a"] });
    const r = await new ArchiverService(f.repos, config, { provider: t.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      AHORA,
    );
    // A «b» y a «c» ya no se les preguntó.
    expect(t.pedidos.map((p) => p.imei)).toEqual(["a"]);
    expect(r.aparatos).toMatchObject({ alDia: 0, sinTerminar: 2 });
    expect(f.marcas.get("b")).toEqual(hace(10));
  });

  it("a un aparato que el proveedor no conoce no se le pregunta, y su marca no se toca", async () => {
    const f = repos({ imeis: ["vivo", "umbrella-muerto"], marcaCuenta: hace(10) });
    const t = proveedor({ catalogo: ["vivo"] });
    const r = await new ArchiverService(f.repos, config, { provider: t.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      AHORA,
    );
    expect(t.pedidos.map((p) => p.imei)).toEqual(["vivo"]);
    expect(r.aparatos!.fueraDelProveedor).toBe(1);
    expect(f.marcas.has("umbrella-muerto")).toBe(false);
  });

  it("una ventana leída sin puntos también avanza la marca: estacionado no es sin leer", async () => {
    const f = repos({ imeis: ["estacionado"], marcaCuenta: hace(10) });
    const t = proveedor({ catalogo: ["estacionado"], sinPuntos: true });
    const r = await new ArchiverService(f.repos, config, { provider: t.resolver }).archiveCarrier(
      "c1",
      "Juárez Bus",
      AHORA,
    );
    expect(r.aparatos!.alDia).toBe(1);
    expect(f.marcas.get("estacionado")).toEqual(AHORA);
    // Y la marca de la cuenta no se mueve sin un punto nuevo.
    expect(f.marcaCuenta()).toEqual(hace(10));
  });

  it("un aparato muy atrasado lee su tope de trozos y deja pasar a los demás", async () => {
    const f = repos({
      imeis: ["tres-dias", "al-dia"],
      marcaCuenta: hace(10),
      marcas: { "tres-dias": hace(72 * 60), "al-dia": hace(10) },
    });
    const t = proveedor({ catalogo: ["tres-dias", "al-dia"], sinPuntos: true });
    const r = await new ArchiverService(f.repos, config, {
      provider: t.resolver,
      maxChunksPerRun: 12,
    }).archiveCarrier("c1", "Juárez Bus", AHORA);

    expect(t.pedidos.filter((p) => p.imei === "tres-dias")).toHaveLength(12);
    expect(t.pedidos.at(-1)!.imei).toBe("al-dia");
    expect(r.aparatos).toMatchObject({ alDia: 1, atrasados: 1 });
    // Avanzó 12 horas (menos el traslape inicial), no saltó a «ahora».
    expect(f.marcas.get("tres-dias")).toEqual(
      new Date(hace(72 * 60).getTime() - 5 * MIN + 12 * 60 * MIN),
    );
  });
});
