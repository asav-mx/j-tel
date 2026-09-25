import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { estadoTrasError } from "@/lib/ubicacion";

describe("qué deja un error del GPS (bug del 22-sep-2026)", () => {
  it("el «no» del pasajero es «negada», haya habido posición o no", () => {
    expect(estadoTrasError(1, false)).toBe("negada");
    expect(estadoTrasError(1, true)).toBe("negada");
  });

  it("GPS apagado o tiempo agotado, sin posición todavía: «sin-senal», no «buscando» para siempre", () => {
    expect(estadoTrasError(2, false)).toBe("sin-senal");
    expect(estadoTrasError(3, false)).toBe("sin-senal");
  });

  it("si ya había posición, un túnel no la borra", () => {
    expect(estadoTrasError(2, true)).toBe("concedida");
    expect(estadoTrasError(3, true)).toBe("concedida");
  });
});

describe("el punto «tú» no se vuelve a perder en silencio", () => {
  /*
   * Se perdió una vez: la cara vieja (`vista-pasajero.tsx`) lo dibujaba, y el
   * PR #476 la reemplazó sin pasárselo a la nueva y sin decirlo. Esta valla
   * exige que CADA mapa de Ontoy reciba la posición del pasajero.
   */
  const ontoy = readFileSync(new URL("../components/ontoy/ontoy.tsx", import.meta.url), "utf8");
  const mapas = ontoy.match(/<VistaMapa\b[\s\S]*?\/>/g) ?? [];

  it("hay mapas que revisar (guarda contra un falso verde)", () => {
    expect(mapas.length).toBeGreaterThanOrEqual(2);
  });

  it("cada <VistaMapa> recibe yo={yo}", () => {
    for (const m of mapas) expect(m, m.slice(0, 80)).toContain("yo={yo}");
  });

  it("y la vista del mapa lo dibuja, con su palabra «tú»", () => {
    /*
     * **La valla no se aflojó: se mudó con el dibujo.**
     *
     * Hasta el PR de los muñecos, el pasajero era un `<span>` escrito a mano
     * dentro de `vista-mapa.tsx`, y esta prueba buscaba ese literal. Ahora es el
     * personajito del universo y lo dibuja `pasajeroConLinterna` en
     * `lib/ontoy/munecos.ts`, con su carita y su linterna.
     *
     * Así que se comprueban **las dos mitades**, que es lo que el literal
     * comprobaba junto: que el mapa llame a quien lo dibuja, y que lo que
     * dibuja siga llevando la palabra. Cualquiera de las dos que se pierda
     * vuelve a dejar al pasajero sin saber dónde está parado.
     */
    const mapa = readFileSync(new URL("../components/ontoy/vista-mapa.tsx", import.meta.url), "utf8");
    expect(mapa, "el mapa tiene que dibujar al pasajero").toContain("pasajeroConLinterna(");
    const munecos = readFileSync(new URL("./ontoy/munecos.ts", import.meta.url), "utf8");
    expect(munecos, "el pasajero lleva su palabra").toContain('ontoy-pasajero-palabra">tú<');
  });

  it("la linterna sólo se enciende con rumbo medido", () => {
    /*
     * Va aquí y no en `munecos.test.ts` porque es una regla sobre **el dato**,
     * no sobre el dibujo: `coords.heading` viene nulo casi siempre, y el nulo
     * tiene que llegar hasta el mapa sin que nadie lo rellene en el camino.
     *
     * Lo que esto cerca es el atajo fácil —`?? 0`— en cualquiera de los tres
     * saltos: al leerlo del GPS, al pasarlo por props o al dibujarlo.
     */
    const ubi = readFileSync(new URL("./ubicacion.ts", import.meta.url), "utf8");
    expect(ubi, "el rumbo se conserva nulo cuando no se midió").toContain("rumbo: Number.isFinite(");
    const mapa = readFileSync(new URL("../components/ontoy/vista-mapa.tsx", import.meta.url), "utf8");
    expect(mapa).toContain("pasajeroConLinterna(yo.rumbo ?? null)");
  });
});
