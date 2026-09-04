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
  corridorToleranceMeters: 150,
  serviceConfidenceMinutes: 15,
  /** Sin fecha de arranque: el circuito YA OPERA, que es el caso de siempre. */
  serviceLaunchDate: null as string | null,
  arrivalRangeEnabledAt: null as Date | null,
};

/*
 * Un trazado recto que pasa por los dos puntos que usan las pruebas. Existe
 * porque el endpoint ya no publica a nadie fuera del corredor: sin trazado no
 * hay corredor, y sin corredor no se puede afirmar que la unidad vaya en ruta.
 */
const TRAZADO = [
  { sentido: "ida" as const, coordinates: [[-106.45, 31.71], [-106.4, 31.7]] as Array<[number, number]> },
];

/** Lejos de todo trazado de estas pruebas: ~15 km. */
const FUERA = { latitude: 31.6, longitude: -106.3 };

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const pedir = () => new Request("http://publico.test/api/circuitos/oasis-centro/unidades");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JTEL_SECRET_KEY = "llave-de-prueba";
  repos.circuits.getPaths.mockResolvedValue(TRAZADO);
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

  it("sin trazado no se publica nada: sin corredor no hay nada que afirmar", async () => {
    /*
     * Antes se publicaba con `sentido: null`. Cambió a propósito el 27 de
     * agosto: si no hay trazado, el sistema no puede afirmar que la unidad vaya
     * en la ruta, y dibujarla en el mapa del circuito es exactamente esa
     * afirmación. La app cae a «Por horario», que es lo honesto.
     */
    repos.circuits.getPaths.mockResolvedValue([]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.unidades).toEqual([]);
  });
});

describe("fuera del corredor", () => {
  beforeEach(() => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
  });

  it("una unidad asignada y fresca pero lejos del trazado NO se publica", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-lejos", ...FUERA, heading: 0, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const crudo = await (await GET(pedir(), ctx("oasis-centro"))).text();
    expect(JSON.parse(crudo).unidades).toEqual([]);
    expect(crudo).not.toContain("u-lejos");
  });

  it("cuando TODAS quedan fuera es SIN EVIDENCIA, no «por horario»", async () => {
    /*
     * El caso que motivó la escalera. Cinco unidades asignadas, frescas, y
     * ninguna en el corredor: eso NO es «hay servicio y calló la señal» — es
     * que no hay servicio. Antes caía a «por horario» y la app prometía una
     * cadencia sin una sola observación que la sostuviera.
     */
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "a", ...FUERA, heading: 0, recordedAt: new Date(Date.now() - 10_000) },
      { unitId: "b", ...FUERA, heading: 90, recordedAt: new Date(Date.now() - 20_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("sin_evidencia");
    expect(cuerpo.unidades).toEqual([]);
  });

  it("el corte es el DEL CIRCUITO, no una constante", async () => {
    // A ~1.2 km del trazado: fuera con 150 m, dentro con un corredor de 2 km.
    const lejito = { latitude: 31.72, longitude: -106.45 };
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...lejito, heading: 0, recordedAt: new Date(Date.now() - 10_000) },
    ]);

    const estrecho = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(estrecho.unidades).toEqual([]);

    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({ ...CIRCUITO, corridorToleranceMeters: 2000 });
    const ancho = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(ancho.unidades).toHaveLength(1);
  });
});

describe("dato viejo", () => {
  it("pasada la VENTANA DE CONFIANZA no se publica, ni queda rastro de ella", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-vieja", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 20 * 60_000) },
      { unitId: "u-fresca", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const crudo = await (await GET(pedir(), ctx("oasis-centro"))).text();
    const cuerpo = JSON.parse(crudo);

    // La de 20 min pasó la ventana de confianza (15): de ella no queda rastro.
    // La de 30 s va, y va marcada FRESCA.
    expect(cuerpo.unidades).toHaveLength(1);
    expect(cuerpo.unidades[0].fresco).toBe(true);
    expect(crudo).not.toContain("u-vieja");
    // La frecuencia declarada sí va, que es a lo que cae la app.
    expect(cuerpo.frecuencia_declarada_min).toBe(20);
  });

  it("el umbral de FRESCURA es el del circuito: con 15 s, la de 30 s va apagada", async () => {
    /*
     * Ya no desaparece — el camión no se fue a ningún lado. Lo que cambia es
     * que deja de contar como «de ahorita»: sale marcada, la app la pinta
     * apagada, y el estado cae a POR HORARIO porque no hay ninguna fresca.
     */
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({ ...CIRCUITO, staleAfterSeconds: 15 });
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-1", latitude: 31.7, longitude: -106.4, heading: 0, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_horario");
    expect(cuerpo.unidades).toHaveLength(1);
    expect(cuerpo.unidades[0].fresco).toBe(false);
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
    expect(cuerpo.estado).toBe("fuera_de_horario");
    expect(cuerpo.unidades).toEqual([]);
    // Y dice a qué hora abre, que es lo único que el pasajero puede usar.
    expect(cuerpo.abre_a).toBe("03:00");
    expect(repos.circuits.listLivePositionsForCircuit).not.toHaveBeenCalled();
  });
});

describe("fecha de arranque", () => {
  /** Un día que no llega nunca dentro de la vida de esta prueba. */
  const MANANA = () => {
    const d = new Date(Date.now() + 30 * 24 * 3600_000);
    return d.toISOString().slice(0, 10);
  };
  const enRuta = { latitude: 31.71, longitude: -106.45 };

  it("con la fecha en el futuro: POR ARRANCAR, y no se consulta una sola posición", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceLaunchDate: MANANA(),
    });
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_arrancar");
    expect(cuerpo.unidades).toEqual([]);
    expect(repos.circuits.listLivePositionsForCircuit).not.toHaveBeenCalled();
  });

  it("dice QUÉ DÍA arranca — sin eso la app no tendría qué enseñar", async () => {
    const fecha = MANANA();
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceLaunchDate: fecha,
    });
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.arranca_el).toBe(fecha);
  });

  it("EL CAMIÓN DEL ENSAYO no se publica: la fecha manda sobre lo que el GPS ve", async () => {
    /*
     * Una unidad probando el recorrido la semana antes reporta como cualquier
     * otra, fresca y dentro del corredor. Publicarla convertiría un ensayo en
     * un servicio, y a alguien parado en la banqueta le diría que ya puede
     * subirse.
     */
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceLaunchDate: MANANA(),
    });
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-1", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 10_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_arrancar");
    expect(cuerpo.unidades).toEqual([]);
  });

  it("POR ARRANCAR gana sobre FUERA DE HORARIO: la fecha manda sobre el reloj", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceLaunchDate: MANANA(),
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
    expect(cuerpo.estado).toBe("por_arrancar");
  });

  it("con la fecha ya pasada la escalera trabaja igual que sin fecha", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceLaunchDate: "2026-01-01",
    });
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u-1", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 10_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("en_vivo");
    expect(cuerpo.unidades).toHaveLength(1);
  });

  it("un circuito que ya opera manda `arranca_el` en null, no una fecha inventada", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.arranca_el).toBeNull();
  });
});

describe("la escalera, por el endpoint", () => {
  const enRuta = { latitude: 31.71, longitude: -106.45 };

  beforeEach(() => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
  });

  it("fresca y en corredor: EN VIVO, con la unidad", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("en_vivo");
    expect(cuerpo.unidades).toHaveLength(1);
  });

  it("vieja pero dentro de la ventana: POR HORARIO, y la unidad SÍ va, marcada no-fresca", async () => {
    /*
     * El camión perdió señal y sigue su recorrido: borrarlo del mapa mandaría
     * al pasajero caminando a otra ruta por algo que no ocurrió. Va, marcado,
     * y la app lo pinta apagado con cuánto hace que se le vio.
     */
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 10 * 60_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_horario");
    expect(cuerpo.unidades).toHaveLength(1);
    expect(cuerpo.unidades[0].fresco).toBe(false);
    expect(cuerpo.unidades[0].antiguedad_seg).toBeGreaterThan(500);
  });

  it("pasada la ventana de confianza el punto SÍ desaparece", async () => {
    /*
     * A esas alturas ya no se puede sostener que la unidad siga en la ruta, y
     * un punto viejo en el mapa afirmaría justo eso.
     */
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 20 * 60_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.unidades).toEqual([]);
  });

  it("en vivo con una compañera vieja: van las dos, cada una con su `fresco`", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "fresca", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 30_000) },
      { unitId: "vieja", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 8 * 60_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("en_vivo");
    expect(cuerpo.unidades.map((u: { fresco: boolean }) => u.fresco).sort()).toEqual([false, true]);
  });

  it("pasada la ventana de confianza: SIN EVIDENCIA", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 20 * 60_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("sin_evidencia");
  });

  it("la ventana de confianza es la DEL CIRCUITO", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 20 * 60_000) },
    ]);
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      serviceConfidenceMinutes: 30,
    });
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_horario");
  });

  it("una unidad FUERA del corredor no sostiene nada — el camión del patio", async () => {
    /*
     * Reporta cada minuto desde el patio. Su última posición está en el patio,
     * así que no es evidencia de que la ruta esté corriendo.
     */
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "patio", ...FUERA, heading: 0, recordedAt: new Date(Date.now() - 10_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("sin_evidencia");
  });

  it("sin frecuencia declarada NO inventa cadencia: viaja null", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      declaredFrequencyMinutes: null,
    });
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 10 * 60_000) },
    ]);
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("por_horario");
    expect(cuerpo.frecuencia_declarada_min).toBeNull();
  });

  it("el interruptor del rango viaja, y viene apagado", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue([
      { unitId: "u", ...enRuta, heading: 45, recordedAt: new Date(Date.now() - 30_000) },
    ]);
    const apagado = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(apagado.rango_activo).toBe(false);
    // Y con el rango apagado la unidad SIGUE saliendo: el mapa no se calla.
    expect(apagado.unidades).toHaveLength(1);

    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue({
      ...CIRCUITO,
      arrivalRangeEnabledAt: new Date(),
    });
    const prendido = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(prendido.rango_activo).toBe(true);
  });

  it("la asignación es plan, no evidencia: cinco asignadas sin observación reciente es SIN EVIDENCIA", async () => {
    repos.circuits.listLivePositionsForCircuit.mockResolvedValue(
      ["a", "b", "c", "d", "e"].map((unitId) => ({
        unitId,
        ...enRuta,
        heading: 0,
        recordedAt: new Date(Date.now() - 60 * 60_000),
      })),
    );
    const cuerpo = await (await GET(pedir(), ctx("oasis-centro"))).json();
    expect(cuerpo.estado).toBe("sin_evidencia");
  });
});

describe("caché", () => {
  it("el encabezado y el cuerpo dicen el mismo TTL", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    const r = await GET(pedir(), ctx("oasis-centro"));
    const cuerpo = await r.json();
    expect(r.headers.get("cache-control")).toContain(`s-maxage=${cuerpo.ttl_seg}`);
  });

  it("NO lleva stale-while-revalidate: el navegador lo obedece y serviría camiones viejos", async () => {
    /*
     * SWR no es solo del CDN. Con 30 s de ventana, un teléfono sirve
     * posiciones de hasta 30 s más viejas mientras revalida — encima del TTL,
     * son 45 s de un presupuesto de 180. Se vio en la calle: el endpoint
     * contestaba «fuera de horario» y la pantalla seguía en «Llegando».
     */
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    const r = await GET(pedir(), ctx("oasis-centro"));
    expect(r.headers.get("cache-control")).not.toContain("stale-while-revalidate");
  });

  it("el NAVEGADOR no guarda nada: max-age=0, o dibuja camiones donde ya no están", () => {
    /*
     * Esta prueba existe por un bug que se vio en la calle, no en la
     * compilación: sin `max-age`, el navegador cachea heurísticamente una
     * respuesta `public` y la app siguió diciendo «Llegando» cuando el
     * endpoint ya contestaba cero unidades. El caché de lo vivo va en el CDN,
     * compartido, nunca dentro de un teléfono.
     */
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
    return GET(pedir(), ctx("oasis-centro")).then((r) => {
      expect(r.headers.get("cache-control")).toContain("max-age=0");
    });
  });
});
