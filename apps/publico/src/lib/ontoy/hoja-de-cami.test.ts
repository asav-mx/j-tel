import { describe, expect, it } from "vitest";
import { laMasCercanaDeTi, renglonesDeCami, tituloDeCami } from "./hoja-de-cami";

const P = (id: string, paradas: number) => ({ id, nombre: id, paradas });

describe("tituloDeCami — la lámina 6-prototipo/04", () => {
  it("fresca va en presente", () => {
    expect(tituloDeCami("2120", "hacia Centro", true)).toBe("La 2120 va hacia Centro");
  });
  it("vieja va en pasado (8.9)", () => {
    expect(tituloDeCami("2120", "hacia Centro", false)).toBe("La 2120 iba hacia Centro");
  });
  it("sin sentido no se inventa uno", () => {
    expect(tituloDeCami("2120", null, true)).toBe("La 2120");
  });
});

describe("laMasCercanaDeTi — sólo entre las que le faltan al camión", () => {
  const coords = [
    { id: "a", lat: 31.70, lon: -106.438 },
    { id: "b", lat: 31.72, lon: -106.438 },
    { id: "ya-paso", lat: 31.7301, lon: -106.438 },
  ];
  it("escoge la más cerca de las próximas", () => {
    expect(laMasCercanaDeTi([P("a", 1), P("b", 2)], coords, { lat: 31.73, lon: -106.438 })).toBe("b");
  });
  it("una que ya pasó no cuenta, aunque esté más cerca", () => {
    expect(laMasCercanaDeTi([P("a", 1), P("b", 2)], coords, { lat: 31.7301, lon: -106.438 })).toBe("b");
  });
  it("con 3 km de margen tampoco: no se puede afirmar cuál es (#613)", () => {
    expect(laMasCercanaDeTi([P("a", 1), P("b", 2)], coords, { lat: 31.73, lon: -106.438, margenM: 3000 })).toBeNull();
  });
  it("con GPS normal sí", () => {
    expect(laMasCercanaDeTi([P("a", 1), P("b", 2)], coords, { lat: 31.73, lon: -106.438, margenM: 20 })).toBe("b");
  });
  it("sin ubicación no hay «más cerca»", () => {
    expect(laMasCercanaDeTi([P("a", 1)], coords, null)).toBeNull();
  });
});

describe("renglonesDeCami — las notas de la lámina", () => {
  it("la siguiente, en camino, y la tuya resaltada", () => {
    const r = renglonesDeCami([P("a", 1), P("b", 2), P("c", 3)], "c");
    expect(r.map((x) => x.nota)).toEqual(["la siguiente", "en camino", "la más cerca de ti"]);
    expect(r.map((x) => x.resaltada)).toEqual([false, false, true]);
  });
  it("si la siguiente es la tuya, dice que es la tuya", () => {
    expect(renglonesDeCami([P("a", 1), P("b", 2)], "a")[0].nota).toBe("la más cerca de ti");
  });
  it("sin ubicación ninguna se resalta", () => {
    expect(renglonesDeCami([P("a", 1), P("b", 2)], null).some((x) => x.resaltada)).toBe(false);
  });
});
