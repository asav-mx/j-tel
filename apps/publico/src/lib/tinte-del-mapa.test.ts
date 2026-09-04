import { describe, it, expect } from "vitest";
import { TINTE_DE_DIA, TINTE_DE_NOCHE, tinteDelMapa } from "./tinte-del-mapa";

describe("el teñido del mapa", () => {
  it("de noche invierte; de día no", () => {
    /*
     * La inversión es la diferencia que se ve: sin ella el mapa se queda blanco
     * y encandila. Es lo que se comprueba en la pantalla leyendo el `filter`
     * rendido, y aquí queda fijado el valor que esa lectura espera.
     */
    expect(tinteDelMapa(true)).toContain("invert(1)");
    expect(tinteDelMapa(false)).not.toContain("invert");
  });

  it("es UNA sola copia de los cinco números, para las dos pantallas", () => {
    // Estaban escritos dos veces, y el comentario de la segunda decía «mismo
    // teñido que la vista de la ruta» — la confesión, no el remedio.
    expect(tinteDelMapa(true)).toBe(TINTE_DE_NOCHE);
    expect(tinteDelMapa(false)).toBe(TINTE_DE_DIA);
    expect(TINTE_DE_NOCHE).not.toBe(TINTE_DE_DIA);
  });
});
