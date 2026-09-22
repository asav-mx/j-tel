import { describe, expect, it, vi } from "vitest";

/*
 * /api/circuitos/en-vivo: cada ruta dice lo que diría sola (la misma función),
 * sólo las pedidas, con tope, y lo no publicado no aparece.
 */
const pedidas: string[] = [];
vi.mock("@/lib/unidades-de-la-ruta", () => ({
  TTL_SEGUNDOS: 15,
  unidadesDeLaRuta: async (slug: string) => {
    pedidas.push(slug);
    return slug === "sin-publicar" ? null : { circuito_id: slug, estado: "en_vivo", unidades: [] };
  },
}));
const { GET } = await import("./route.js");
const pedir = (q: string) => GET(new Request(`http://x/api/circuitos/en-vivo${q}`));

describe("GET /api/circuitos/en-vivo", () => {
  it("contesta cada ruta pedida con el cuerpo de su consulta sola", async () => {
    const r = await pedir("?rutas=norte,centro");
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(Object.keys(cuerpo.rutas)).toEqual(["centro", "norte"]);
    expect(cuerpo.rutas.norte).toEqual({ circuito_id: "norte", estado: "en_vivo", unidades: [] });
  });

  it("una ruta no publicada o inventada no aparece — sin decir cuál de las dos es", async () => {
    const cuerpo = await (await pedir("?rutas=centro,sin-publicar")).json();
    expect(Object.keys(cuerpo.rutas)).toEqual(["centro"]);
  });

  it("sin lista, o con demasiadas rutas, 400: nunca la ciudad entera", async () => {
    expect((await pedir("")).status).toBe(400);
    expect((await pedir("?rutas=a,b,c,d,e,f,g,h,i")).status).toBe(400);
  });

  it("mismo caché que la consulta de una ruta: 15 s, sin stale-while-revalidate", async () => {
    const r = await pedir("?rutas=centro");
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=15");
  });
});
