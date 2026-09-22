import { describe, expect, it } from "vitest";
import { armarLaTira, RUTAS_EN_LA_TIRA } from "./tira-de-rutas";
import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";

const r = (id: string): RutaOrdenada => ({
  ruta: { circuito_id: id, nombre: id, color_hex: "#1E6FD9" } as unknown as RutaDeLaCiudad,
  entrada: null,
});

const ids = (l: RutaOrdenada[]) => l.map((x) => x.ruta.circuito_id);
const SEIS = ["a", "b", "c", "d", "e", "f"].map(r);
const NADA = new Set<string>();

describe("la tira del Mapa", () => {
  it("trae las primeras del orden; el resto espera en el panel", () => {
    const t = armarLaTira(SEIS, NADA, NADA);
    expect(ids(t.tira)).toEqual(["a", "b", "c", "d"]);
    expect(ids(t.resto)).toEqual(["e", "f"]);
    expect(t.tira).toHaveLength(RUTAS_EN_LA_TIRA);
  });

  /*
   * LA DECISIÓN de ASAV, y la que protege al pasajero que abre el Mapa por
   * primera vez: al abrir NO hay nada apagado, así que todas las de la tira se
   * dibujan. Un mapa que abre con las rutas escondidas es un mapa vacío.
   */
  it("al abrir, TODAS las de la tira están prendidas", () => {
    const t = armarLaTira(SEIS, NADA, NADA);
    expect([...t.prendidas].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("«todas prendidas» NO son las de la ciudad entera: las lejanas no se dibujan solas", () => {
    const t = armarLaTira(SEIS, NADA, NADA);
    expect(t.prendidas.has("e")).toBe(false);
    expect(t.prendidas.has("f")).toBe(false);
  });

  it("apagar un chip la quita del mapa, pero la deja en la tira para volver a prenderla", () => {
    const t = armarLaTira(SEIS, NADA, new Set(["b"]));
    expect(ids(t.tira)).toContain("b");
    expect(t.prendidas.has("b")).toBe(false);
  });

  it("una lejana escogida en el panel entra a la tira y llega PRENDIDA", () => {
    const t = armarLaTira(SEIS, new Set(["f"]), NADA);
    expect(ids(t.tira)).toEqual(["a", "b", "c", "d", "f"]);
    expect(t.prendidas.has("f")).toBe(true);
    expect(ids(t.resto)).toEqual(["e"]);
  });

  /*
   * El caso que duplicaba: apagar una cercana y volver a marcarla en el panel.
   * Si «agregadas» no descontara las que ya están, el chip saldría dos veces.
   */
  it("marcar en el panel una que ya está en la tira no la duplica", () => {
    const t = armarLaTira(SEIS, new Set(["a"]), NADA);
    expect(ids(t.tira)).toEqual(["a", "b", "c", "d"]);
    expect(ids(t.tira).filter((x) => x === "a")).toHaveLength(1);
  });

  it("con menos rutas que la tira, no hay panel que abrir", () => {
    const t = armarLaTira([r("a"), r("b")], NADA, NADA);
    expect(ids(t.tira)).toEqual(["a", "b"]);
    expect(t.resto).toEqual([]);
  });

  it("sin rutas publicadas no truena: tira vacía y nada prendido", () => {
    const t = armarLaTira([], NADA, NADA);
    expect(t.tira).toEqual([]);
    expect(t.prendidas.size).toBe(0);
  });
});
