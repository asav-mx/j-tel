import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Crear y corregir paradas con su sentido (Oasis, 21 sep 2026): sin valor por
 * defecto, pegadas al trazado de SU sentido, «ambos» avisa si queda lejos de la
 * vuelta, y corregir el sentido no mueve la parada — avisa. La regla de pegado
 * tiene sus propias pruebas (`lib/pegado-de-parada.test.ts`); aquí, que las
 * rutas la usen y guarden lo que dice.
 */

// Ida sobre 31.720 y vuelta 300 m al sur: calles distintas, como Oasis.
const IDA: Array<[number, number]> = [[-106.46, 31.72], [-106.45, 31.72]];
const VUELTA: Array<[number, number]> = [[-106.45, 31.7173], [-106.46, 31.7173]];

const exigir = vi.fn();
const createStop = vi.fn();
const reviseStop = vi.fn();
const listStopsVigentes = vi.fn();

vi.mock("@/lib/guardia-api", () => ({ exigir: (...a: unknown[]) => exigir(...a) }));
vi.mock("@/lib/db", () => ({
  getRepos: () => ({
    circuits: {
      getCircuit: async () => ({ id: "c1", publicSlug: "oasis", stopSnapToleranceMeters: 60 }),
      getPaths: async () => [
        { sentido: "ida", coordinates: IDA },
        { sentido: "vuelta", coordinates: VUELTA },
      ],
      listStopsVigentes: (id: string) => listStopsVigentes(id),
      createStop: (d: unknown) => createStop(d),
      reviseStop: (...a: unknown[]) => reviseStop(...a),
    },
  }),
}));

const { POST } = await import("./route");
const { PATCH } = await import("./[stopId]/route");

const crear = (cuerpo: Record<string, unknown>) =>
  POST(new Request("https://x/api", { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id: "c1" }) });
const corregir = (cuerpo: Record<string, unknown>) =>
  PATCH(new Request("https://x/api", { method: "PATCH", body: JSON.stringify(cuerpo) }), {
    params: Promise.resolve({ id: "c1", stopId: "s1" }),
  });

beforeEach(() => {
  for (const f of [exigir, createStop, reviseStop, listStopsVigentes]) f.mockReset();
  exigir.mockResolvedValue({ ok: true, identidad: { userId: "jstaff_admin" } });
  listStopsVigentes.mockResolvedValue([]);
  createStop.mockImplementation(async (d: { name: string; orden: number; latitude: number; longitude: number }) => ({
    identidad: { id: "s-nueva", qrSlug: "oasis-1" },
    version: { name: d.name, orden: d.orden, latitude: d.latitude, longitude: d.longitude },
  }));
  reviseStop.mockImplementation(async (_id: string, c: Record<string, unknown>) => ({
    id: "v2",
    name: "Oasis",
    orden: 1,
    latitude: c.latitude ?? 31.72,
    longitude: c.longitude ?? -106.455,
    sentido: "sentido" in c ? c.sentido : "ida",
    validFrom: new Date(),
  }));
});

describe("crear", () => {
  it("sin sentido no crea: no hay valor por defecto", async () => {
    const r = await crear({ lat: 31.7175, lon: -106.455 });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("Falta el sentido");
    expect(createStop).not.toHaveBeenCalled();
  });

  it("una de vuelta se pega a la vuelta y se guarda como vuelta", async () => {
    const r = await crear({ lat: 31.7175, lon: -106.455, sentido: "vuelta" });
    expect(r.status).toBe(200);
    const d = createStop.mock.calls[0]![0];
    expect(d.sentido).toBe("vuelta");
    expect(d.latitude).toBeCloseTo(31.7173, 4);
  });

  it("«ambos» lejos de la vuelta se crea, pegada a la ida, y avisa con los metros", async () => {
    const r = await crear({ lat: 31.7202, lon: -106.455, sentido: null });
    const cuerpo = await r.json();
    expect(createStop.mock.calls[0]![0].sentido).toBeNull();
    expect(createStop.mock.calls[0]![0].latitude).toBeCloseTo(31.72, 4);
    expect(cuerpo.aviso).toMatch(/Queda a \d+ m del trazado de la vuelta/);
  });
});

describe("corregir", () => {
  it("cambiar sólo el sentido NO mueve la parada, y avisa que queda lejos del trazado nuevo", async () => {
    listStopsVigentes.mockResolvedValue([{ stopId: "s1", sentido: null, latitude: 31.72, longitude: -106.455 }]);
    const r = await corregir({ sentido: "vuelta" });
    const cuerpo = await r.json();
    const cambios = reviseStop.mock.calls[0]![1];
    expect(cambios).toEqual({ sentido: "vuelta" });
    expect(cuerpo.aviso).toMatch(/Queda a \d+ m del trazado de la vuelta: muévela/);
    expect(cuerpo.lejos).toBe(true);
  });

  it("moverla sin repetir el sentido la pega al que YA tiene (antes la pegaba a la ida)", async () => {
    listStopsVigentes.mockResolvedValue([{ stopId: "s1", sentido: "vuelta", latitude: 31.72, longitude: -106.455 }]);
    await corregir({ lat: 31.7176, lon: -106.456 });
    const cambios = reviseStop.mock.calls[0]![1];
    expect(cambios.latitude).toBeCloseTo(31.7173, 4);
    expect(cambios).not.toHaveProperty("sentido");
  });

  it("un sentido que no existe se rechaza", async () => {
    listStopsVigentes.mockResolvedValue([{ stopId: "s1", sentido: null, latitude: 31.72, longitude: -106.455 }]);
    expect((await corregir({ sentido: "ambos" })).status).toBe(400);
    expect(reviseStop).not.toHaveBeenCalled();
  });
});
