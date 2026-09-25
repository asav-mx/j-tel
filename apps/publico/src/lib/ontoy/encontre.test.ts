import { describe, expect, it } from "vitest";
import { encontre } from "./encontre";

/*
 * **El resumen de la búsqueda.**
 *
 * Existe porque los plurales del español son donde estas frases se rompen, y
 * se rompen **en silencio**: «1 rutas» compila igual de bien que «1 ruta».
 */

describe("«Encontré …»", () => {
  it("con las dos cosas, las dice las dos", () => {
    expect(encontre(1, 3)).toBe("Encontré 1 ruta y 3 paradas.");
    expect(encontre(2, 2)).toBe("Encontré 2 rutas y 2 paradas.");
  });

  it("el singular es singular en las dos", () => {
    expect(encontre(1, 1)).toBe("Encontré 1 ruta y 1 parada.");
  });

  it("lo que no hay NO se nombra en cero", () => {
    /* «Encontré 1 ruta y 0 paradas» hace contar un cero que nadie preguntó. */
    expect(encontre(1, 0)).toBe("Encontré 1 ruta.");
    expect(encontre(0, 4)).toBe("Encontré 4 paradas.");
  });
});
