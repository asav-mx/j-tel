import { describe, expect, it } from "vitest";
import { distanciaEnPalabras, distanciaM, distanciaParaDecir, esImprecisa, margenEnPalabras } from "@/lib/ontoy/distancia";

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

describe("la ubicación imprecisa no dice metros (auditoría a1, 25-sep)", () => {
  it("con GPS normal dice la distancia", () => {
    expect(distanciaParaDecir(48, 20)).toBe("a 50 m");
  });
  it("con 3 km de margen no dice metros", () => {
    expect(distanciaParaDecir(48, 3000)).toBeNull();
  });
  it("el corte es 100 m: 100 todavía alcanza, 101 ya no", () => {
    expect(esImprecisa(100)).toBe(false);
    expect(esImprecisa(101)).toBe(true);
  });
  it("sin margen (el teléfono no lo dio) no se castiga", () => {
    expect(esImprecisa(null)).toBe(false);
    expect(distanciaParaDecir(48, null)).toBe("a 50 m");
  });
  it("el margen se dice hacia arriba, nunca achicado", () => {
    expect(margenEnPalabras(560)).toBe("unos 600 m");
    expect(margenEnPalabras(3000)).toBe("unos 3 km");
    expect(margenEnPalabras(2410)).toBe("unos 2.5 km");
  });
});
