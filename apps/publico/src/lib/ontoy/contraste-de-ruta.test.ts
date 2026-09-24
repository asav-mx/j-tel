import { describe, it, expect } from "vitest";
import {
  contraste,
  haloParaLaTraza,
  luminancia,
  MINIMO_SOBRE_EL_MAPA,
} from "./contraste-de-ruta";

/*
 * La 8.8c pide 3:1 sobre el mapa en las dos pieles. El color de una ruta no lo
 * escoge la app —es el que traen pintado los camiones—, así que lo que se prueba
 * aquí es lo único que la app sí controla: que el halo aparezca cuando hace
 * falta y no cuando no.
 */

const PAPEL_CLARO = "#EFEBE3";
const PAPEL_OSCURO = "#2B323B";

describe("contraste", () => {
  it("mide la razón de WCAG entre dos colores", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 6);
  });

  it("un hex que no se puede leer devuelve null, no un número inventado", () => {
    expect(contraste("azul", PAPEL_CLARO)).toBeNull();
    expect(luminancia("#12345")).toBeNull();
  });
});

describe("haloParaLaTraza — lo único que la app puede hacer por la 8.8c", () => {
  it("un color que cumple solo NO lleva halo: no se engorda por si acaso", () => {
    // Un azul profundo sobre papel claro se ve sin ayuda.
    expect(contraste("#1C2148", PAPEL_CLARO)!).toBeGreaterThan(MINIMO_SOBRE_EL_MAPA);
    expect(haloParaLaTraza("#1C2148", PAPEL_CLARO)).toBe(0);
  });

  it("UN AMARILLO DE RUTA sobre papel claro no cumple, y por eso lleva halo", () => {
    // El caso real: #FFB81C es un color de ruta legítimo —es el que trae el
    // camión pintado— y sobre el papel claro mide menos de 3:1.
    expect(contraste("#FFB81C", PAPEL_CLARO)!).toBeLessThan(MINIMO_SOBRE_EL_MAPA);
    expect(haloParaLaTraza("#FFB81C", PAPEL_CLARO)).toBeGreaterThan(0);
  });

  it("el mismo amarillo sobre la piel de noche sí cumple, y ahí no lleva halo", () => {
    // Las dos pieles se miden aparte: un color no es legible «en general».
    expect(haloParaLaTraza("#FFB81C", PAPEL_OSCURO)).toBe(0);
  });

  it("el halo crece con lo que falta, pero tiene tope", () => {
    // Un gris casi igual al papel es el peor caso, y aun así la traza no se
    // vuelve el doble de gorda: un color ilegible no se arregla engordando.
    expect(haloParaLaTraza("#EEEAE2", PAPEL_CLARO)).toBeLessThanOrEqual(6);
    expect(haloParaLaTraza("#EEEAE2", PAPEL_CLARO)).toBeGreaterThan(
      haloParaLaTraza("#8A8A8A", PAPEL_CLARO),
    );
  });

  it("si no se puede medir, el halo va puesto: no medir no es cumplir", () => {
    expect(haloParaLaTraza("no-es-un-color", PAPEL_CLARO)).toBeGreaterThan(0);
  });
});
