import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * **La respuesta de ensayo no puede llegar al público.**
 *
 * La consulta pública de camiones se comparte 15 s en el CDN entre todos los
 * teléfonos. Si una respuesta de ensayo —camiones de una ruta que todavía no
 * arranca— entrara ahí, la vería cualquiera. Estas pruebas se caen si:
 *
 *  - la puerta de ensayo contesta algo que se pueda guardar (con llave o sin ella);
 *  - la puerta se abre sin la llave exacta, o con la llave apagada;
 *  - la consulta PÚBLICA se deja abrir por la llave;
 *  - alguna otra consulta de la app se salta la fecha de arranque.
 */
const llamadas: Array<{ slug: string; ensayo: boolean }> = [];
vi.mock("@/lib/unidades-de-la-ruta", () => ({
  TTL_SEGUNDOS: 15,
  unidadesDeLaRuta: async (slug: string, _ahora: Date, opciones: { ensayo?: boolean } = {}) => {
    llamadas.push({ slug, ensayo: opciones.ensayo === true });
    return { circuito_id: slug, estado: opciones.ensayo ? "en_vivo" : "por_arrancar", unidades: [] };
  },
}));
vi.mock("@/lib/ontoy/ciudad", () => ({
  estadosDeEnsayo: async () => [{ circuito_id: "centro", situacion: "abierto", abre_a: "05:00", arranca_el: "2026-10-01" }],
}));

const { GET: ensayo } = await import("./route.js");
const { GET: publica } = await import("../route.js");

/* Una llave de a mentiras, nueva en cada corrida: ninguna llave real vive en el repo. */
const LLAVE = randomBytes(24).toString("base64url");
const pedir = (get: typeof ensayo, cabecera?: string) =>
  get(
    new Request("http://x/api/circuitos/en-vivo/ensayo?rutas=centro", {
      headers: cabecera === undefined ? {} : { "x-ontoy-ensayo": cabecera },
    }),
  );

/** Lo que tiene que traer TODA respuesta de ensayo para que nadie la guarde. */
function nadieLaGuarda(r: Response) {
  const cc = r.headers.get("cache-control") ?? "";
  expect(cc).toContain("private");
  expect(cc).toContain("no-store");
  expect(cc).not.toMatch(/public|s-maxage|stale-while-revalidate/);
  expect(r.headers.get("cdn-cache-control")).toBe("no-store");
  expect(r.headers.get("vercel-cdn-cache-control")).toBe("no-store");
}

beforeEach(() => {
  llamadas.length = 0;
  vi.stubEnv("ONTOY_LLAVE_ENSAYO", LLAVE);
});
afterEach(() => vi.unstubAllEnvs());

describe("la puerta de ensayo", () => {
  it("con la llave: los camiones como si la ruta ya hubiera arrancado, y nadie guarda la respuesta", async () => {
    const r = await pedir(ensayo, LLAVE);
    expect(r.status).toBe(200);
    nadieLaGuarda(r);
    const cuerpo = await r.json();
    expect(cuerpo.ensayo).toBe(true);
    expect(cuerpo.rutas.centro.estado).toBe("en_vivo");
    expect(cuerpo.estados[0].situacion).toBe("abierto");
    expect(llamadas).toEqual([{ slug: "centro", ensayo: true }]);
  });

  it.each([
    ["sin cabecera", undefined],
    ["con una llave mala", "no-es-la-llave-pero-es-bastante-larga-xx"],
    ["con la llave y un carácter de más", `${LLAVE}x`],
    ["con la cabecera vacía", ""],
  ])("%s: 404 que nadie guarda, sin cuerpo y sin tocar la base", async (_, cabecera) => {
    const r = await pedir(ensayo, cabecera);
    expect(r.status).toBe(404);
    nadieLaGuarda(r);
    expect(await r.text()).toBe("");
    expect(llamadas).toEqual([]);
  });

  it("con la llave apagada (sin variable en Vercel), ni la llave buena abre", async () => {
    vi.stubEnv("ONTOY_LLAVE_ENSAYO", "");
    const r = await pedir(ensayo, LLAVE);
    expect(r.status).toBe(404);
    nadieLaGuarda(r);
    expect(llamadas).toEqual([]);
  });

  it("una lista mala también contesta sin dejarse guardar", async () => {
    const r = await ensayo(new Request("http://x/api/circuitos/en-vivo/ensayo", { headers: { "x-ontoy-ensayo": LLAVE } }));
    expect(r.status).toBe(400);
    nadieLaGuarda(r);
  });
});

describe("la consulta pública no se deja abrir por la llave", () => {
  it("con la llave buena en la cabecera, la pública sigue siendo pública: sin ensayo y con su caché de siempre", async () => {
    const r = await pedir(publica, LLAVE);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=15");
    const cuerpo = await r.json();
    expect(cuerpo.ensayo).toBeUndefined();
    expect(cuerpo.estados).toBeUndefined();
    expect(cuerpo.rutas.centro.estado).toBe("por_arrancar");
    expect(llamadas).toEqual([{ slug: "centro", ensayo: false }]);
  });
});

describe("la valla: sólo la puerta de ensayo se salta la fecha de arranque", () => {
  /*
   * Quién puede tocar la llave, y por qué. Cualquier otro archivo de la app que
   * la importe —o que pase `ensayo` a la consulta de camiones— es una consulta
   * pública que se podría abrir, y esta prueba se cae.
   */
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const PERMITIDOS = new Set([
    "lib/ensayo.ts", // la definición
    "lib/unidades-de-la-ruta.ts", // recibe la bandera; no la decide
    "lib/ontoy/ciudad.ts", // la situación de la lista, con la misma regla
    "app/api/circuitos/en-vivo/ensayo/route.ts", // la puerta
  ]);
  const archivos = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return archivos(p);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });

  it("encuentra los archivos (si no, la valla no vigila nada)", () => {
    expect(archivos(SRC).map((f) => path.relative(SRC, f))).toContain("app/api/circuitos/en-vivo/route.ts");
  });

  it("nadie más importa la llave de ensayo del servidor ni pide camiones con `ensayo`", () => {
    for (const f of archivos(SRC)) {
      const relativo = path.relative(SRC, f);
      if (PERMITIDOS.has(relativo)) continue;
      const texto = readFileSync(f, "utf8");
      expect(texto, `${relativo} importa la llave de ensayo`).not.toMatch(/from "@\/lib\/ensayo"/);
      expect(texto, `${relativo} pide camiones como ensayo`).not.toMatch(/unidadesDeLaRuta\([^)]*ensayo/);
      expect(texto, `${relativo} pide la lista de la ciudad como ensayo`).not.toMatch(/(?<![.\w])estadosDeEnsayo\(|estadoDeLaRuta\([^)]*true/);
    }
  });
});
