import { describe, expect, it } from "vitest";
import {
  ALTURAS,
  FRACCION,
  alSoltar,
  masAbajo,
  masArriba,
  type AlturaDeLaHoja,
} from "./alturas-de-la-hoja";

/**
 * **Lo que esta valla NO prueba.**
 *
 * No prueba que la hoja se vea bien en ninguna de las tres alturas, ni que el
 * arrastre se sienta natural, ni que el dedo mueva la hoja: eso es del navegador
 * y de la revisión visual, y ninguna prueba en Node lo puede afirmar. Tampoco
 * prueba que las fracciones sean las del diseño —eso lo dice la medición escrita
 * en el archivo—; prueba que **las tres son distintas, están en orden y caen
 * donde el dedo las dejó**, que es lo que se puede romper editando código.
 */
describe("las tres alturas de la hoja", () => {
  it("van de menor a mayor y ninguna se sale de la pantalla", () => {
    expect(ALTURAS).toEqual(["asomada", "media", "completa"]);
    const fs = ALTURAS.map((a) => FRACCION[a]);
    expect(fs).toEqual([...fs].sort((x, y) => x - y));
    expect(new Set(fs).size).toBe(3);
    for (const f of fs) {
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("cae exactamente en su altura cuando se suelta justo ahí", () => {
    for (const a of ALTURAS) expect(alSoltar(FRACCION[a])).toBe(a);
  });

  it("cae en la más cercana cuando se suelta a media camino", () => {
    /* Un pelo arriba de la asomada sigue siendo asomada; un pelo abajo de la
       media, media. El punto medio exacto es el único ambiguo y no se prueba:
       cualquiera de los dos lados es defendible y fijarlo aquí ataría la
       implementación sin proteger nada que el pasajero sienta. */
    expect(alSoltar(FRACCION.asomada + 0.02)).toBe("asomada");
    expect(alSoltar(FRACCION.media - 0.02)).toBe("media");
    expect(alSoltar(FRACCION.media + 0.02)).toBe("media");
    expect(alSoltar(FRACCION.completa - 0.02)).toBe("completa");
  });

  it("cierra cuando se arrastra por debajo de la mitad de la asomada", () => {
    expect(alSoltar(FRACCION.asomada / 2 - 0.01)).toBe("cerrar");
    expect(alSoltar(0)).toBe("cerrar");
    /* Y NO cierra justo encima de ese umbral: si cerrara, un arrastre corto
       hacia abajo perdería la parada que el pasajero acaba de tocar. */
    expect(alSoltar(FRACCION.asomada / 2 + 0.01)).not.toBe("cerrar");
  });

  it("con una fracción que no es número se queda en la media, no truena", () => {
    /* `NaN` sale de dividir entre un alto de pantalla 0, que pasa mientras el
       navegador está montando. Volver a la media es una decisión declarada:
       antes de esto, `NaN` recorría las tres comparaciones sin ganar ninguna y
       la hoja caía en la asomada por el orden del arreglo, no por una regla. */
    expect(alSoltar(Number.NaN)).toBe("media");
    expect(alSoltar(Number.POSITIVE_INFINITY)).toBe("media");
  });

  it("las flechas suben y bajan de una en una, y se detienen en los extremos", () => {
    expect(masArriba("asomada")).toBe("media");
    expect(masArriba("media")).toBe("completa");
    expect(masArriba("completa")).toBe("completa");
    expect(masAbajo("completa")).toBe("media");
    expect(masAbajo("media")).toBe("asomada");
    expect(masAbajo("asomada")).toBe("asomada");
  });

  it("subir y bajar es simétrico en el medio", () => {
    /* Nadie debería llegar a una altura de la que no pueda volver con la tecla
       contraria. Es la trampa de una escalera escrita a mano. */
    for (const a of ALTURAS) {
      const arriba = masArriba(a as AlturaDeLaHoja);
      if (arriba !== a) expect(masAbajo(arriba)).toBe(a);
    }
  });
});
