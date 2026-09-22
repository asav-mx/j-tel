import { describe, expect, it } from "vitest";
import { distanciaEnPalabras, distanciaM } from "@/lib/ontoy/distancia";

const YO = { lat: 31.7, lon: -106.4 };

/** Un punto a `metros` al norte del pasajero (1° de latitud ≈ 111 195 m). */
const alNorte = (metros: number) => ({ lat: YO.lat + metros / 111_195, lon: YO.lon });

/*
 * ✎ 22-sep-2026: este archivo era `paradas-cerca.test.ts` y cubría además el
 * escogedor de paradas cercanas, que se retiró con su sección. Lo que escoge
 * ahora la parada por la que se toma una ruta vive en `rutas-cerca.test.ts`,
 * incluido el caso de la misma esquina en ida y en vuelta.
 */
describe("la aritmética de la distancia", () => {
  it("mide en metros, en línea recta", () => {
    expect(distanciaM(YO, alNorte(500))).toBeCloseTo(500, -1);
  });

  it("es simétrica: da igual quién sea a y quién b", () => {
    expect(distanciaM(YO, alNorte(500))).toBeCloseTo(distanciaM(alNorte(500), YO), 6);
  });

  it("la distancia en palabras no promete más precisión de la que da un teléfono", () => {
    expect(distanciaEnPalabras(37)).toBe("a 40 m");
    expect(distanciaEnPalabras(333)).toBe("a 350 m");
    expect(distanciaEnPalabras(980)).toBe("a 1 km");
  });

  /*
   * Por debajo del grano del redondeo no se dice «a 0 m»: literalmente cierto y
   * se lee como un defecto. El GPS de un teléfono tampoco distingue esos metros.
   */
  it("nunca dice «a 0 m»", () => {
    expect(distanciaEnPalabras(4)).toBe("a 10 m");
    expect(distanciaEnPalabras(0)).toBe("a 10 m");
  });
});
