import { describe, it, expect } from "vitest";
import {
  PIXELES_POR_MODULO,
  PRESUPUESTO_MS,
  RECORTE_INICIAL,
  RECORTE_MAXIMO,
  RECORTE_MINIMO,
  cuadroDeAnalisis,
  fraccionDeLaMira,
  fraccionQueNecesitaElCodigo,
  siguienteRecorte,
} from "./encuadre";

describe("el recorte nunca escala", () => {
  /*
   * La regresión que ya costó una ronda entera. Un `Encuadre` tiene UN lado:
   * el trozo que se toma del fotograma y el lienzo donde se analiza son el
   * mismo número, así que un escalado no cabe ni escribiéndolo mal.
   */
  it("el trozo tomado y el lienzo analizado son el mismo número", () => {
    for (const [a, l] of [
      [640, 480],
      [1280, 720],
      [1080, 1920],
      [1920, 1080],
    ] as const) {
      const e = cuadroDeAnalisis(a, l, 640)!;
      expect(Object.values(e).filter((v) => v === e.lado).length, `${a}×${l}`).toBeGreaterThan(0);
      expect(e.lado).toBeLessThanOrEqual(Math.min(a, l));
    }
  });

  it("toma el cuadrado centrado del tamaño pedido", () => {
    const e = cuadroDeAnalisis(1080, 1920, 640)!;
    expect(e.lado).toBe(640);
    expect(e.ox).toBe(220);
    expect(e.oy).toBe(640);
    expect(e.ox * 2 + e.lado).toBe(1080);
  });

  it("si el fotograma es más chico que el recorte, manda el fotograma", () => {
    expect(cuadroDeAnalisis(320, 240, 640)!.lado).toBe(240);
  });

  it("un fotograma que todavía no existe no da encuadre", () => {
    expect(cuadroDeAnalisis(0, 0)).toBeNull();
    expect(cuadroDeAnalisis(NaN, 720)).toBeNull();
    expect(cuadroDeAnalisis(1280, 720, 0)).toBeNull();
  });
});

describe("el recorte que se mide a sí mismo", () => {
  it("se encoge cuando el barrido tarda de más", () => {
    expect(siguienteRecorte(640, 400)).toBeLessThan(640);
  });

  it("crece cuando sobra tiempo", () => {
    expect(siguienteRecorte(640, 30)).toBeGreaterThan(640);
  });

  it("se queda quieto dentro del presupuesto", () => {
    expect(siguienteRecorte(640, PRESUPUESTO_MS)).toBe(640);
  });

  it("nunca sale de sus topes", () => {
    for (const ms of [0, 1, PRESUPUESTO_MS, 5000]) {
      for (const desde of [RECORTE_MINIMO, RECORTE_INICIAL, RECORTE_MAXIMO]) {
        const n = siguienteRecorte(desde, ms);
        expect(n, `${desde} con ${ms} ms`).toBeGreaterThanOrEqual(RECORTE_MINIMO);
        expect(n, `${desde} con ${ms} ms`).toBeLessThanOrEqual(RECORTE_MAXIMO);
      }
    }
  });

  /* Con los números que midió ASAV —1130 ms a 1080— el lector tiene que bajar
     hasta el piso, y llegar ahí sin dar tumbos. */
  it("un teléfono lento aterriza en el mínimo y se queda", () => {
    let r = RECORTE_INICIAL;
    for (let i = 0; i < 20; i++) r = siguienteRecorte(r, 900);
    expect(r).toBe(RECORTE_MINIMO);
    expect(siguienteRecorte(r, 900)).toBe(RECORTE_MINIMO);
  });

  it("un teléfono rápido sube hasta el techo y se queda", () => {
    let r = RECORTE_INICIAL;
    for (let i = 0; i < 20; i++) r = siguienteRecorte(r, 10);
    expect(r).toBe(RECORTE_MAXIMO);
    expect(siguienteRecorte(r, 10)).toBe(RECORTE_MAXIMO);
  });
});

describe("la mira no se mueve", () => {
  /*
   * Se dibuja del tamaño del recorte MÍNIMO, así que lo que quede dentro está
   * siempre dentro de lo analizado, aunque el recorte crezca. Si la mira
   * siguiera al recorte, cambiaría de tamaño mientras alguien apunta.
   */
  it("lo que encierra la mira cabe en cualquier recorte permitido", () => {
    for (const fotograma of [480, 720, 1080, 1920]) {
      const miraEnPixeles = fraccionDeLaMira(fotograma) * fotograma;
      expect(miraEnPixeles, `${fotograma}`).toBeLessThanOrEqual(RECORTE_MINIMO + 0.001);
    }
  });

  it("con un fotograma chico la mira es toda la caja", () => {
    expect(fraccionDeLaMira(320)).toBe(1);
  });
});

describe("qué tan grande tiene que verse el código", () => {
  it("recortar no cambia lo que el código necesita: son píxeles nativos", () => {
    expect(PIXELES_POR_MODULO).toBe(4);
    /* 67 módulos × 4 px = 268 px, sin importar de qué recorte se hable. */
    expect(fraccionQueNecesitaElCodigo(RECORTE_MINIMO)).toBeCloseTo(268 / RECORTE_MINIMO, 5);
    expect(fraccionQueNecesitaElCodigo(1080)).toBeCloseTo(268 / 1080, 5);
  });
});
