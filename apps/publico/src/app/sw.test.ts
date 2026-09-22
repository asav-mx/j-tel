import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  runInNewContext(SW, { self, URL, caches, fetch: () => Promise.reject(new Error("sin red")), Response, console });
  /** `true` si el service worker CONTESTA la petición (o sea, la puede sacar de caché). */
  return (ruta: string, method = "GET") => {
    let contesto = false;
    manejadores.fetch!({ request: { url: ORIGEN + ruta, method }, respondWith: () => (contesto = true) });
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
});
