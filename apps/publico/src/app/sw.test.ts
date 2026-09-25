import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAPA_DE_LA_CIUDAD, direccionDelMapa } from "@/lib/ontoy/mapa-base";

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
