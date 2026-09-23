import { describe, it, expect } from "vitest";
import {
  TOPE_DEL_ANALISIS,
  PIXELES_POR_MODULO,
  cuadroDeAnalisis,
  fraccionQueNecesitaElCodigo,
} from "./encuadre";

describe("el cuadro que se analiza", () => {
  /*
   * La regresión que este archivo existe para impedir. El lector encogía todo a
   * 480 px y por eso no leía con teléfonos de verdad: si alguien vuelve a meter
   * un escalado, esta prueba se cae.
   */
  it("NO encoge lo que da un teléfono", () => {
    for (const [a, l] of [
      [640, 480],
      [1280, 720],
      [1920, 1080],
    ] as const) {
      const e = cuadroDeAnalisis(a, l)!;
      expect(e.analisis, `${a}×${l}`).toBe(Math.min(a, l));
    }
  });

  it("toma el cuadrado centrado", () => {
    const e = cuadroDeAnalisis(1280, 720)!;
    expect(e.lado).toBe(720);
    expect(e.ox).toBe(280);
    expect(e.oy).toBe(0);
    /* Centrado de verdad: lo que sobra se reparte a los dos lados. */
    expect(e.ox * 2 + e.lado).toBe(1280);
  });

  it("también con el fotograma de pie", () => {
    const e = cuadroDeAnalisis(720, 1280)!;
    expect(e.lado).toBe(720);
    expect(e.oy).toBe(280);
    expect(e.ox).toBe(0);
  });

  it("sólo pone tope a lo que pasa del tope", () => {
    expect(cuadroDeAnalisis(4096, 2160)!.analisis).toBe(TOPE_DEL_ANALISIS);
    expect(cuadroDeAnalisis(1920, 1080)!.analisis).toBe(1080);
  });

  it("un fotograma que todavía no existe no da encuadre", () => {
    expect(cuadroDeAnalisis(0, 0)).toBeNull();
    expect(cuadroDeAnalisis(NaN, 720)).toBeNull();
  });
});

describe("qué tan grande tiene que verse el código", () => {
  /*
   * El número que explica el fallo de la calle: con el cuadro viejo de 480 px,
   * el QR tenía que llenar más de la mitad del ancho de la cámara.
   */
  it("con el cuadro viejo pedía más de la mitad; con el nuevo, un cuarto", () => {
    expect(PIXELES_POR_MODULO).toBe(4);
    expect(fraccionQueNecesitaElCodigo(480)).toBeGreaterThan(0.55);
    expect(fraccionQueNecesitaElCodigo(1080)).toBeLessThan(0.26);
  });
});
