import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAPA_DE_LA_CIUDAD, direccionDelMapa } from "@/lib/ontoy/mapa-base";
import { DIRECCION_SIN_SENAL } from "@/lib/ontoy/sin-senal";

/*
 * «Lo vivo no se cachea» — la regla del service worker, probada EJECUTÁNDOLO.
 *
 * El 22-sep-2026 la consulta de las favoritas (`/api/circuitos/en-vivo`)
 * entró sin estar en la lista del service worker, que la guardaba en caché: sin
 * red, camiones de hace rato enseñados como de ahora. Esta prueba carga `sw.js`
 * en un contexto falso, le manda peticiones y mira si las contesta él (caché)
 * o las deja pasar a la red.
 *
 * Qué es «vivo» no se escribe a mano aquí: es toda consulta bajo
 * `/api/circuitos/` que arma su respuesta con `unidadesDeLaRuta(` — los
 * camiones. Una consulta viva nueva entra sola a la prueba, y si el service
 * worker no la exceptúa, esto se cae.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SW = readFileSync(path.join(AQUI, "../../public/sw.js"), "utf8");
const ORIGEN = "https://ontoy.example";

function cargarServiceWorker() {
  const manejadores: Record<string, (e: unknown) => void> = {};
  const self = { addEventListener: (tipo: string, f: (e: unknown) => void) => (manejadores[tipo] = f), location: new URL(ORIGEN), skipWaiting: () => {} };
  // Una caché falsa vacía y sin red: el camino «sin señal» del service worker corre completo sin reventar.
  const cacheVacia = { match: async () => undefined, put: async () => {}, keys: async () => [], delete: async () => true };
  const caches = { open: async () => cacheVacia, match: async () => undefined, keys: async () => [], delete: async () => true };
  runInNewContext(SW, { self, URL, caches, fetch: () => Promise.reject(new Error("sin red")), Response, Request, Headers, console });
  /** `true` si el service worker CONTESTA la petición (o sea, la puede sacar de caché). */
  return (ruta: string, method = "GET", cabeceras: Record<string, string> = {}) => {
    let contesto = false;
    manejadores.fetch!({
      request: { url: ORIGEN + ruta, method, headers: new Headers(cabeceras) },
      respondWith: () => (contesto = true),
    });
    return contesto;
  };
}

/** Las consultas vivas: carpetas bajo api/circuitos cuyo route.ts arma su respuesta con los camiones. */
function consultasVivas(): string[] {
  const vivas: string[] = [];
  const recorrer = (dir: string, ruta: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const hija = path.join(dir, d.name);
      const segmento = d.name.startsWith("[") ? "zaragoza-centro" : d.name;
      const archivo = path.join(hija, "route.ts");
      if (existsSync(archivo) && /unidadesDeLaRuta\(/.test(readFileSync(archivo, "utf8"))) vivas.push(`${ruta}/${segmento}`);
      recorrer(hija, `${ruta}/${segmento}`);
    }
  };
  recorrer(path.join(AQUI, "api/circuitos"), "/api/circuitos");
  return vivas;
}

describe("el service worker: lo vivo no se cachea", () => {
  const contesta = cargarServiceWorker();

  it("la prueba encuentra las consultas vivas de verdad (guarda contra un falso verde)", () => {
    expect(consultasVivas().sort()).toEqual(["/api/circuitos/en-vivo", "/api/circuitos/zaragoza-centro/unidades"]);
  });

  it("ninguna consulta viva pasa por la caché", () => {
    for (const ruta of consultasVivas()) {
      expect(contesta(`${ruta}?rutas=insurgentes,zaragoza-centro`), ruta).toBe(false);
    }
  });

  it("lo que no es vivo sí puede servirse de caché sin red: la forma, la lista de paradas, el cascarón", () => {
    expect(contesta("/api/circuitos/zaragoza-centro")).toBe(true);
    expect(contesta("/api/circuitos/paradas-de-la-ciudad")).toBe(true);
    expect(contesta("/")).toBe(true);
  });

  it("nunca contesta una escritura (la apertura es un POST)", () => {
    expect(contesta("/api/circuitos/zaragoza-centro/apertura", "POST")).toBe(false);
  });

  it("una petición del mapa SIN rango pasa derecho: serían 18 MB a espaldas del pasajero", () => {
    /*
     * Hoy nadie la hace —`pmtiles` siempre pide rangos— y por eso está escrita:
     * el día que algo pida el archivo entero, que cueste lo que cuesta y no se
     * quede guardado. Bajar los 18 MB en silencio es la decisión que ASAV tomó
     * al revés el 25-sep.
     */
    expect(contesta(`/mapa/juarez-${MAPA_DE_LA_CIUDAD.fecha}.pmtiles`)).toBe(false);
    /* Y el archivo que se declara es el que la regla del service worker alcanza. */
    expect(direccionDelMapa().startsWith("/mapa/")).toBe(true);
  });
});

/*
 * **El mapa sin señal**, probado EJECUTANDO el service worker contra una caché
 * que sí guarda y una red que se puede apagar.
 *
 * Por qué así y no con una prueba de función: lo que puede fallar aquí no es una
 * cuenta, es la **conversación** entre el navegador y la caché — que un `206` no
 * se puede guardar, que el tramo pedido casi nunca es el tramo guardado, que al
 * refrescar el mapa lo viejo se tiene que ir. Nada de eso se ve mirando el
 * código, y todo se ve corriéndolo.
 *
 * ## Qué NO prueba
 *
 * **No prueba que el mapa se vea sin señal.** Prueba que los bytes que salen de
 * la caché son los mismos que dio el servidor. Que con esos bytes `pmtiles`
 * dibuje se comprueba en el navegador, con la red apagada, y está en el PR.
 *
 * **No prueba el tope con 400 pedazos de verdad**, ni cuántos megas ocupan: eso
 * depende del aparato y del navegador.
 */
const ARCHIVO = `/mapa/juarez-${MAPA_DE_LA_CIUDAD.fecha}.pmtiles`;
/** Un «archivo» de 1 000 bytes donde cada byte vale su propia posición. */
const ARCHIVO_FALSO = new Uint8Array(1000).map((_, i) => i % 256);

function cargarConCache() {
  const manejadores: Record<string, (e: unknown) => void> = {};
  const self = {
    addEventListener: (tipo: string, f: (e: unknown) => void) => (manejadores[tipo] = f),
    location: new URL(ORIGEN),
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
  };

  /** Una caché de verdad, en memoria, que conserva el orden de inserción. */
  const guardadas = new Map<string, Response>();
  const cache = {
    match: async (p: Request) => guardadas.get(p.url)?.clone(),
    put: async (p: Request, r: Response) => void guardadas.set(p.url, r),
    keys: async () => [...guardadas.keys()].map((u) => new Request(u)),
    delete: async (p: Request) => guardadas.delete(p.url),
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  };

  /** La red: sirve rangos del archivo falso, y se puede apagar. */
  const red = { hay: true, peticiones: 0, etag: '"uno"' };
  const fetchFalso = async (peticion: Request) => {
    red.peticiones++;
    if (!red.hay) throw new Error("sin red");
    const m = /bytes=(\d+)-(\d+)/.exec(peticion.headers.get("range") ?? "");
    if (!m) return new Response(ARCHIVO_FALSO, { status: 200 });
    const [desde, hasta] = [Number(m[1]), Number(m[2])];
    return new Response(ARCHIVO_FALSO.slice(desde, hasta + 1), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${desde}-${hasta}/${ARCHIVO_FALSO.length}`,
        ETag: red.etag,
      },
    });
  };

  runInNewContext(SW, { self, URL, caches, fetch: fetchFalso, Response, Request, Headers, console });

  /** Pide un rango como lo pide `pmtiles`, y devuelve lo que el SW conteste. */
  const pedir = async (ruta: string, desde: number, hasta: number) => {
    let respuesta: Promise<Response> | null = null;
    manejadores.fetch!({
      request: new Request(ORIGEN + ruta, { headers: { Range: `bytes=${desde}-${hasta}` } }),
      respondWith: (r: Promise<Response>) => {
        respuesta = r;
      },
    });
    return respuesta ? await (respuesta as Promise<Response>) : null;
  };

  return { pedir, red, guardadas };
}

const bytesDe = async (r: Response) => new Uint8Array(await r.arrayBuffer());
/* Guardar corre en segundo plano a propósito (el pasajero no espera a que se
   guarde para ver su mapa), así que las pruebas le dan un respiro. */
const respiro = () => new Promise((r) => setTimeout(r, 5));

describe("el mapa sin señal: se guarda lo que el pasajero ya miró", () => {
  it("la primera vez va a la red, y lo que llega queda guardado", async () => {
    const { pedir, red, guardadas } = cargarConCache();
    const r = await pedir(ARCHIVO, 100, 199);
    expect(r?.status).toBe(206);
    expect(await bytesDe(r!)).toEqual(ARCHIVO_FALSO.slice(100, 200));
    expect(red.peticiones).toBe(1);
    await respiro();
    expect([...guardadas.keys()]).toEqual([`${ORIGEN}${ARCHIVO}?desde=100&hasta=199`]);
  });

  it("la segunda vez NO toca la red, y devuelve los mismos bytes", async () => {
    const { pedir, red } = cargarConCache();
    await pedir(ARCHIVO, 100, 199);
    await respiro();
    red.hay = false; // la red se apaga: el pasajero se quedó sin señal
    const r = await pedir(ARCHIVO, 100, 199);
    expect(r?.status).toBe(206);
    expect(await bytesDe(r!)).toEqual(ARCHIVO_FALSO.slice(100, 200));
    expect(red.peticiones).toBe(1);
  });

  it("y sirve un tramo CONTENIDO en otro ya guardado, que es el caso de todos los días", async () => {
    /*
     * `pmtiles` junta teselas vecinas en una sola petición, así que al volver al
     * mismo lugar pide tramos parecidos pero **no iguales**. Con coincidencia
     * exacta, volver a una calle ya vista fallaría la mitad de las veces.
     */
    const { pedir, red } = cargarConCache();
    await pedir(ARCHIVO, 100, 199);
    await respiro();
    red.hay = false;
    const r = await pedir(ARCHIVO, 120, 149);
    expect(r?.status).toBe(206);
    expect(await bytesDe(r!)).toEqual(ARCHIVO_FALSO.slice(120, 150));
    expect(r?.headers.get("Content-Range")).toBe(`bytes 120-149/${ARCHIVO_FALSO.length}`);
    expect(red.peticiones).toBe(1);
  });

  it("devuelve el MISMO ETag que dio el servidor", async () => {
    /* `pmtiles` lo compara entre peticiones para enterarse de si el archivo
       cambió debajo. Uno distinto —o ninguno— lo tira creyendo que se movió. */
    const { pedir, red } = cargarConCache();
    const deLaRed = await pedir(ARCHIVO, 0, 49);
    await respiro();
    red.hay = false;
    const deLaCache = await pedir(ARCHIVO, 0, 49);
    expect(deLaCache?.headers.get("ETag")).toBe(deLaRed?.headers.get("ETag"));
    expect(deLaCache?.headers.get("ETag")).toBe('"uno"');
  });

  it("sin señal y sin ese pedazo guardado, contesta error: mejor un hueco que una calle que no es", async () => {
    const { pedir, red } = cargarConCache();
    await pedir(ARCHIVO, 100, 199);
    await respiro();
    red.hay = false;
    const r = await pedir(ARCHIVO, 600, 699);
    expect(r?.type).toBe("error");
  });

  it("al refrescar el mapa, los pedazos del viejo se van", async () => {
    /* El nombre lleva la fecha, así que el mapa nuevo vive en otra dirección y
       lo guardado del viejo no se volvería a pedir nunca: ocuparía lugar y
       empujaría fuera, por el tope, lo que sí se usa. */
    const { pedir, guardadas } = cargarConCache();
    await pedir("/mapa/juarez-20260101.pmtiles", 100, 199);
    await respiro();
    expect(guardadas.size).toBe(1);
    await pedir(ARCHIVO, 100, 199);
    await respiro();
    expect([...guardadas.keys()]).toEqual([`${ORIGEN}${ARCHIVO}?desde=100&hasta=199`]);
  });
});

/*
 * **SIN SEÑAL, en lugar del dinosaurio** (3-ir-a/16; ASAV, 25-sep-2026),
 * probado corriendo el service worker contra una caché que guarda y una red que
 * se apaga.
 *
 * ## Qué NO prueba
 *
 * **No prueba que la pantalla se vea** ni que Next la hidrate servida desde la
 * caché. Eso se comprobó en el navegador, con la red apagada, y está en el PR.
 */
function cargarNavegando(inicial: Record<string, Response> = {}) {
  const manejadores: Record<string, (e: unknown) => void> = {};
  const self = {
    addEventListener: (tipo: string, f: (e: unknown) => void) => (manejadores[tipo] = f),
    location: new URL(ORIGEN),
    skipWaiting: () => {},
    clients: { claim: () => Promise.resolve() },
  };

  /** Las llaves son la dirección completa, con consulta: como la caché de verdad. */
  const guardadas = new Map<string, Response>(
    Object.entries(inicial).map(([ruta, r]) => [ORIGEN + ruta, r]),
  );
  const llave = (p: Request | string) => (typeof p === "string" ? new URL(p, ORIGEN).href : p.url);
  const cache = {
    match: async (p: Request | string) => guardadas.get(llave(p))?.clone(),
    put: async (p: Request | string, r: Response) => void guardadas.set(llave(p), r),
    addAll: async (rutas: string[]) => {
      for (const ruta of rutas) guardadas.set(llave(ruta), new Response(`pieza ${ruta}`));
    },
    keys: async () => [...guardadas.keys()].map((u) => new Request(u)),
    delete: async (p: Request) => guardadas.delete(p.url),
  };
  const caches = {
    open: async () => cache,
    match: cache.match,
    keys: async () => [],
    delete: async () => true,
  };

  /** La red: contesta lo que se le diga, y se puede apagar. */
  const red = { hay: true, paginas: {} as Record<string, Response> };
  const fetchFalso = async (p: Request | string) => {
    if (!red.hay) throw new Error("sin red");
    const url = new URL(llave(p));
    return red.paginas[url.pathname]?.clone() ?? new Response("ok");
  };

  runInNewContext(SW, { self, URL, caches, fetch: fetchFalso, Response, Request, Headers, console });

  /** Abre una página como la abre el navegador (`mode: "navigate"`). */
  const navegar = async (ruta: string, modo = "navigate") => {
    let respuesta: Promise<Response> | null = null;
    manejadores.fetch!({
      request: { url: ORIGEN + ruta, method: "GET", mode: modo, headers: new Headers() },
      respondWith: (r: Promise<Response>) => {
        respuesta = r;
      },
    });
    return respuesta ? await (respuesta as Promise<Response>) : null;
  };

  const instalar = async () => {
    let espera: Promise<unknown> = Promise.resolve();
    manejadores.install!({ waitUntil: (p: Promise<unknown>) => (espera = p) });
    await espera;
  };

  return { navegar, instalar, red, guardadas };
}

const PANTALLA = new Response("<html>Sin señal.</html>");

describe("sin señal y sin copia de la página: SIN SEÑAL, no el dinosaurio", () => {
  it("manda a la pantalla diciendo de dónde venía, consulta incluida", async () => {
    const { navegar, red } = cargarNavegando({ "/sin-senal": PANTALLA.clone() });
    red.hay = false;
    const r = await navegar("/p/av-tecnologico?sentido=ida");
    expect(r?.status).toBe(302);
    const destino = new URL(r!.headers.get("location")!);
    expect(destino.pathname).toBe("/sin-senal");
    expect(destino.searchParams.get("desde")).toBe("/p/av-tecnologico?sentido=ida");
  });

  it("y la pantalla, pedida sin red con su `?desde=`, sale de la caché", async () => {
    const { navegar, red } = cargarNavegando({ "/sin-senal": PANTALLA.clone() });
    red.hay = false;
    const r = await navegar("/sin-senal?desde=%2Fp%2Fav-tecnologico");
    expect(r?.status).toBe(200);
    expect(await r!.text()).toBe("<html>Sin señal.</html>");
  });

  it("si la página SÍ tiene copia, se sirve la copia: es mejor que la pantalla", async () => {
    const { navegar, red } = cargarNavegando({
      "/sin-senal": PANTALLA.clone(),
      "/rutas": new Response("la app de hace rato"),
    });
    red.hay = false;
    const r = await navegar("/rutas");
    expect(await r!.text()).toBe("la app de hace rato");
  });

  it("sólo para páginas: un pedazo de código o una consulta que falla no se vuelve pantalla", async () => {
    const { navegar, red } = cargarNavegando({ "/sin-senal": PANTALLA.clone() });
    red.hay = false;
    const r = await navegar("/api/circuitos/zaragoza-centro", "cors");
    expect(r?.type).toBe("error");
  });

  it("sin la pantalla guardada, el error de siempre: no hay a dónde mandar", async () => {
    const { navegar, red } = cargarNavegando();
    red.hay = false;
    expect((await navegar("/p/av-tecnologico"))?.type).toBe("error");
  });
});

describe("lo que se guarda al andar con señal", () => {
  it("sólo lo que salió bien: un 500 no pisa la copia buena", async () => {
    const { navegar, red, guardadas } = cargarNavegando({ "/rutas": new Response("la buena") });
    red.paginas["/rutas"] = new Response("se cayó", { status: 500 });
    await navegar("/rutas");
    await respiro();
    expect(await guardadas.get(`${ORIGEN}/rutas`)!.clone().text()).toBe("la buena");
  });
});

describe("al instalarse, SIN SEÑAL se guarda con sus piezas", () => {
  /*
   * Sin sus piezas —la hoja, la letra, el código, que llevan la huella de la
   * compilación en el nombre— la pantalla saldría sin estilo el día que hace
   * falta. Aquí se mira que se guarden las que el HTML nombra, incluidas las que
   * Next mete escapadas dentro de su carga.
   */
  const HTML = [
    '<link rel="stylesheet" href="/_next/static/css/abc123.css">',
    '<link rel="preload" href="/_next/static/media/bricolage.p.woff2" as="font">',
    '<script src="/_next/static/chunks/app/sin-senal/page-9f.js"></script>',
    '<script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/747-aa.js\\"]"])</script>',
  ].join("");

  it("la pantalla y cada archivo de `/_next/static/` que nombra", async () => {
    const { instalar, red, guardadas } = cargarNavegando();
    red.paginas["/sin-senal"] = new Response(HTML);
    await instalar();
    const llaves = [...guardadas.keys()].map((u) => new URL(u).pathname);
    expect(llaves).toEqual(
      expect.arrayContaining([
        "/sin-senal",
        "/_next/static/css/abc123.css",
        "/_next/static/media/bricolage.p.woff2",
        "/_next/static/chunks/app/sin-senal/page-9f.js",
        "/_next/static/chunks/747-aa.js",
      ]),
    );
    expect(llaves.some((l) => l.includes("\\")), "una pieza cortada en la diagonal").toBe(false);
  });

  it("si la pantalla no baja, la instalación sigue: queda el dinosaurio, no una app sin service worker", async () => {
    const { instalar, red, guardadas } = cargarNavegando();
    red.paginas["/sin-senal"] = new Response("caída", { status: 500 });
    await instalar();
    expect(guardadas.has(`${ORIGEN}/sin-senal`)).toBe(false);
    expect(guardadas.has(`${ORIGEN}/rutas`)).toBe(true);
  });

  it("el service worker y la app nombran la misma dirección", () => {
    expect(/const SIN_SENAL = "([^"]+)"/.exec(SW)?.[1]).toBe(DIRECCION_SIN_SENAL);
  });

  it("subir el cascarón no tira el mapa que el pasajero ya miró", () => {
    /* Eran la misma versión hasta la v6: cada cambio al cascarón borraba los
       pedazos del mapa, que es justo lo que sirve sin señal. */
    expect(SW).toMatch(/const MAPA = "mapa-v\d+";/);
  });
});
