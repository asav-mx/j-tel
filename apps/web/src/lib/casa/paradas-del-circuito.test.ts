import { describe, expect, it } from "vitest";
import { distanciasEnPalabras, medirParadas } from "./paradas-del-circuito";

/*
 * Una recta sobre el ecuador para la ida y otra ~1.1 km al norte para la
 * vuelta: el caso de Oasis, donde la vuelta va por otra calle. A 0° de latitud,
 * 0.001° de latitud son ~110.6 m.
 */
const IDA: Array<[number, number]> = [
  [0, 0],
  [0.036, 0],
];
const VUELTA: Array<[number, number]> = [
  [0.036, 0.01],
  [0, 0.01],
];
const TRAZADOS = [
  { sentido: "ida" as const, coordinates: IDA },
  { sentido: "vuelta" as const, coordinates: VUELTA },
];
const parada = (sentido: "ida" | "vuelta" | null, lat: number) => ({
  stopId: "p",
  name: "P",
  qrSlug: "qr-1",
  sentido,
  latitude: lat,
  longitude: 0.01,
});

describe("medirParadas — cada parada contra el trazado de SU sentido", () => {
  it("una de ida pegada a la ida está cerca, aunque la vuelta vaya lejos", () => {
    const [m] = medirParadas([parada("ida", 0.00002)], TRAZADOS, 25);
    expect(m!.distancias).toHaveLength(1);
    expect(m!.distancias[0]!.metros!).toBeLessThan(5);
    expect(m!.lejos).toBe(false);
  });

  it("una de «ambos» se mide contra los dos, y la que queda lejos de la vuelta lo dice", () => {
    const [m] = medirParadas([parada(null, 0.00002)], TRAZADOS, 25);
    expect(m!.distancias.map((d) => d.sentido)).toEqual(["ida", "vuelta"]);
    expect(m!.lejos).toBe(true);
    expect(distanciasEnPalabras(m!)).toMatch(/^ida \d+ m · vuelta \d+ m$/);
  });

  it("una de vuelta se mide contra la vuelta, no contra la ida", () => {
    const [m] = medirParadas([parada("vuelta", 0.01)], TRAZADOS, 25);
    expect(m!.distancias).toEqual([{ sentido: "vuelta", metros: expect.any(Number) }]);
    expect(m!.lejos).toBe(false);
  });

  it("sin trazado en su sentido no inventa una distancia ni la marca lejos", () => {
    const [m] = medirParadas([parada("vuelta", 0.01)], [TRAZADOS[0]!], 25);
    expect(m!.distancias).toEqual([{ sentido: "vuelta", metros: null }]);
    expect(m!.lejos).toBe(false);
    expect(distanciasEnPalabras(m!)).toBe("sin trazado");
  });
});
