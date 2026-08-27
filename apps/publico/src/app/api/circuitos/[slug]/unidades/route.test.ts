import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * El contrato del endpoint público, con la base simulada.
 *
 * Lo que se ejerce aquí no es la geometría —ésa vive en `@jtel/domain/publico` y
 * se prueba sola— sino **qué sale y qué no sale por la puerta**. Es la clase de
 * regla que no se rompe con un error de compilación: alguien agrega un campo al
 * `select` de la consulta, se cuela hasta la respuesta, y todo sigue en verde.
 */

const repos = {
  circuits: {
    getPublishedCircuitBySlug: vi.fn(),
    listLivePositionsForCircuit: vi.fn(),
    getPaths: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ getRepos: () => repos }));

const { GET } = await import("./route.js");

const CIRCUITO = {
  id: "uuid-interno-que-no-debe-salir",
  publicSlug: "oasis-centro",
  declaredFrequencyMinutes: 20,
  staleAfterSeconds: 180,
  serviceStartLocal: "00:00",
  serviceEndLocal: "00:00", // 24 h: la prueba no depende de la hora a la que corra.
  timeZone: "America/Ciudad_Juarez",
};

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const pedir = () => new Request("http://publico.test/api/circuitos/oasis-centro/unidades");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JTEL_SECRET_KEY = "llave-de-prueba";
  repos.circuits.getPaths.mockResolvedValue([]);
  repos.circuits.listLivePositionsForCircuit.mockResolvedValue([]);
});

describe("la puerta", () => {
  it("un circuito no publicado contesta 404 — la consulta no lo devuelve", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(null);
    const r = await GET(pedir(), ctx("oasis-centro"));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "No existe ese circuito" });
  });

  it("un slug inventado contesta exactamente lo mismo, byte por byte", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(null);
    const noPublicado = await GET(pedir(), ctx("oasis-centro"));
    const inventado = await GET(pedir(), ctx("no-existe-jamas"));
    expect(inventado.status).toBe(noPublicado.status);
    expect(await inventado.text()).toBe(await noPublicado.text());
  });

  it("sin llave no publica unidades con identidad recalculable: 503", async () => {
    delete process.env.JTEL_SECRET_KEY;
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    const r = await GET(pedir(), ctx("oasis-centro"));
    expect(r.status).toBe(503);
  });
});

describe("lo que sale, y lo que no", () => {
  const posicion = {
    unitId: "5cc6dc22-dc23-4467-afbd-2a91123fe0cf",
    latitude: 31.71,
    longitude: -106.45,
    heading: 45,
    recordedAt: new Date(Date.now() - 30_000),
  };

  beforeEach(() => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([posicion]);
  });

  it("la unidad trae exactamente los campos del contrato, ni uno más", async () => {
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(Object.keys(cuerpo.unidades[0]).sort()).toEqual([
      "antiguedad_seg",
      "fresco",
      "id_publico",
      "lat",
      "lon",
      "rumbo",
      "sentido",
    ]);
  });

  it("`circuito_id` es el slug, nunca el uuid interno", async () => {
    const r = await GET(pedir(), ctx("oasis-centro"));
    const crudo = await r.text();
    expect(JSON.parse(crudo).circuito_id).toBe("oasis-centro");
    expect(crudo).not.toContain(CIRCUITO.id);
  });

  it("el identificador de la unidad no viaja ni entero ni en pedazos", async () => {
    const crudo = await (await GET(pedir(), ctx("oasis-centro"))).text();
    expect(crudo).not.toContain(posicion.unitId);
    expect(crudo).not.toContain("5cc6dc22");
  });

  it("la antigüedad la calcula el servidor, y no se manda `recordedAt`", async () => {
    const crudo = await (await GET(pedir(), ctx("oasis-centro"))).text();
    const cuerpo = JSON.parse(crudo);
    expect(cuerpo.unidades[0].antiguedad_seg).toBeGreaterThanOrEqual(29);
    expect(cuerpo.unidades[0].antiguedad_seg).toBeLessThanOrEqual(35);
    expect(crudo).not.toContain("recordedAt");
    expect(crudo).not.toContain("recorded_at");
  });

  it("sin trazado el sentido es null, y la unidad se publica igual", async () => {
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.unidades).toHaveLength(1);
    expect(cuerpo.unidades[0].sentido).toBeNull();
  });
});

describe("dato viejo", () => {
  it("una unidad pasada del umbral DEL CIRCUITO no se publica, ni con posición vieja", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-vieja", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 20 * 60_000) },
      { unitId: "u-fresca", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const crudo = await (await GET(pedir(), ctx("oasis-centro"))).text();
    const cuerpo = JSON.parse(crudo);

    expect(cuerpo.unidades).toHaveLength(1);
    // Y no se cuela por otro lado: de la vieja no queda ni rastro.
    expect(crudo).not.toContain("u-vieja");
    // La frecuencia declarada sí va, que es a lo que cae la app.
    expect(cuerpo.frecuencia_declarada_min).toBe(20);
  });

  it("el umbral es el del circuito: con 15 s, la de 30 s también se cae", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({ ...CIRCUITO, staleAfterSeconds: 15 });
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-1", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.unidades).toHaveLength(0);
  });
});

describe("horario", () => {
  it("fuera de horario no consulta posiciones siquiera, y lo dice", async () => {
    // Ventana de un minuto que no puede contener el instante de la corrida.
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceStartLocal: "03:00",
      serviceEndLocal: "03:01",
    });
    const ahora = new Date();
    const hhmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: CIRCUITO.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(ahora);
    if (hhmm === "03:00") return; // un minuto al día en que esta prueba no aplica

    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.en_servicio).toBe(false);
    expect(cuerpo.unidades).toEqual([]);
    expect(repos.circuits.listLivePositionsForCircuit).not.toHaveBeenCalled();
  });
});

describe("caché", () => {
  it("el encabezado y el cuerpo dicen el mismo TTL", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    const r = await GET(pedir(), ctx("oasis-centro"));
    const cuerpo = await r.json();
    expect(r.headers.get("cache-control")).toContain(`s-maxage=${cuerpo.ttl_seg}`);
    expect(r.headers.get("cache-control")).toContain("stale-while-revalidate=30");
  });
});
