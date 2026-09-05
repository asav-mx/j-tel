import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * El contrato de la apertura, con la base simulada.
 *
 * Lo que se ejerce aquí no es el HMAC —ése vive en `@jtel/domain/publico` y se
 * prueba solo— sino **qué llega a guardarse y qué no sale por la puerta**: que
 * un circuito sin publicar no se distinga de uno inventado, que la fecha sea la
 * del circuito y no la del servidor, y que ni la IP ni el agente crucen hacia la
 * base.
 */

const repos = {
  circuits: {
    getPublishedCircuitBySlug: vi.fn(),
    registrarApertura: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ getRepos: () => repos }));

const { POST } = await import("./route.js");

const CIRCUITO = {
  id: "uuid-interno-que-no-debe-salir",
  publicSlug: "oasis-centro",
  timeZone: "America/Ciudad_Juarez",
};

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

const pedir = (headers: Record<string, string> = {}) =>
  new Request("http://publico.test/api/circuitos/oasis-centro/apertura", {
    method: "POST",
    headers,
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JTEL_SECRET_KEY = "llave-de-prueba";
  repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(CIRCUITO);
});

describe("la puerta", () => {
  it("un circuito no publicado contesta 404 y NO cuenta nada", async () => {
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(null);
    const r = await POST(pedir(), ctx("oasis-centro"));
    expect(r.status).toBe(404);
    expect(repos.circuits.registrarApertura).not.toHaveBeenCalled();
  });

  it("un slug inventado contesta exactamente lo mismo, byte por byte", async () => {
    /*
     * Una escritura contesta distinto según encuentre o no, así que ésta sería
     * la puerta más fácil para averiguar qué slugs existen antes de que existan
     * para el pasajero.
     */
    repos.circuits.getPublishedCircuitBySlug.mockResolvedValue(null);
    const noPublicado = await POST(pedir(), ctx("oasis-centro"));
    const inventado = await POST(pedir(), ctx("no-existe-jamas"));
    expect(inventado.status).toBe(noPublicado.status);
    expect(await inventado.text()).toBe(await noPublicado.text());
  });

  it("SIN LLAVE no se cuenta, y aun así contesta 204", async () => {
    // Sin llave la huella no sería opaca. Y una pantalla no se rompe por un
    // contador: el pasajero no tiene nada que ver con esto.
    delete process.env.JTEL_SECRET_KEY;
    const r = await POST(pedir(), ctx("oasis-centro"));
    expect(r.status).toBe(204);
    expect(repos.circuits.registrarApertura).not.toHaveBeenCalled();
  });
});

describe("lo que se guarda, y lo que no", () => {
  it("guarda el circuito, el día y una huella opaca — nada más", async () => {
    const r = await POST(pedir({ "x-forwarded-for": "189.203.10.4" }), ctx("oasis-centro"));
    expect(r.status).toBe(204);
    expect(repos.circuits.registrarApertura).toHaveBeenCalledTimes(1);
    expect(Object.keys(repos.circuits.registrarApertura.mock.calls[0][0]).sort()).toEqual([
      "circuitId",
      "fingerprint",
      "localDate",
    ]);
  });

  it("NI LA IP NI EL AGENTE cruzan hacia la base", async () => {
    /*
     * Entran al HMAC y no quedan en ninguna columna. Es la mitad del diseño que
     * ninguna prueba de la huella alcanza: la huella puede estar perfecta y este
     * archivo mandar la IP en otro campo.
     */
    const ip = "189.203.10.4";
    const agente = "Mozilla/5.0 (Linux; Android 11)";
    await POST(pedir({ "x-forwarded-for": ip, "user-agent": agente }), ctx("oasis-centro"));
    const guardado = JSON.stringify(repos.circuits.registrarApertura.mock.calls[0][0]);
    expect(guardado).not.toContain(ip);
    expect(guardado).not.toContain(agente);
    expect(guardado).not.toContain("Android");
  });

  it("la huella cambia con la IP y con el agente", async () => {
    await POST(pedir({ "x-forwarded-for": "1.1.1.1", "user-agent": "a" }), ctx("oasis-centro"));
    await POST(pedir({ "x-forwarded-for": "2.2.2.2", "user-agent": "a" }), ctx("oasis-centro"));
    await POST(pedir({ "x-forwarded-for": "1.1.1.1", "user-agent": "b" }), ctx("oasis-centro"));
    const huellas = repos.circuits.registrarApertura.mock.calls.map((c) => c[0].fingerprint);
    expect(new Set(huellas).size).toBe(3);
  });

  it("EL MISMO APARATO, LA MISMA HUELLA: es lo que permite deduplicar sin cookie", async () => {
    const cabeceras = { "x-forwarded-for": "189.203.10.4", "user-agent": "Android" };
    await POST(pedir(cabeceras), ctx("oasis-centro"));
    await POST(pedir(cabeceras), ctx("oasis-centro"));
    const [a, b] = repos.circuits.registrarApertura.mock.calls.map((c) => c[0].fingerprint);
    expect(a).toBe(b);
  });

  it("de `x-forwarded-for` toma la PRIMERA, que es el cliente", async () => {
    /*
     * Las demás son intermediarios: tomar la última contaría a todos los que
     * compartan salida como un solo aparato, encima del NAT que ya los junta.
     */
    const soloCliente = pedir({ "x-forwarded-for": "189.203.10.4" });
    const conProxies = pedir({ "x-forwarded-for": "189.203.10.4, 10.0.0.1, 10.0.0.2" });
    await POST(soloCliente, ctx("oasis-centro"));
    await POST(conProxies, ctx("oasis-centro"));
    const [a, b] = repos.circuits.registrarApertura.mock.calls.map((c) => c[0].fingerprint);
    expect(a).toBe(b);
  });

  it("la fecha es la del CIRCUITO, no la del servidor", async () => {
    /*
     * Con la fecha de UTC, un pasajero de las 23:30 en Juárez contaría en el día
     * siguiente y su segunda apertura de esa noche no se deduplicaría con la
     * primera.
     */
    const enJuarez = new Intl.DateTimeFormat("en-CA", {
      timeZone: CIRCUITO.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    await POST(pedir(), ctx("oasis-centro"));
    expect(repos.circuits.registrarApertura.mock.calls[0][0].localDate).toBe(enJuarez);
  });
});

describe("la respuesta", () => {
  it("es 204 sin cuerpo: la app dispara y sigue", async () => {
    const r = await POST(pedir(), ctx("oasis-centro"));
    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
  });

  it("NO SE CACHEA NUNCA — una apertura guardada en un CDN es una que no se cuenta", async () => {
    const r = await POST(pedir(), ctx("oasis-centro"));
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});
