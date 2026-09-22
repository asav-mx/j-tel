import { describe, expect, it } from "vitest";
import { distanciaEnPalabras, distanciaM, paradasCerca } from "@/lib/ontoy/paradas-cerca";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

const YO = { lat: 31.7, lon: -106.4 };

/** Una parada a `metros` al norte del pasajero (1° de latitud ≈ 111 195 m). */
const alNorte = (id: string, metros: number, sentido: ParadaDeLaCiudad["sentido"] = "ida"): ParadaDeLaCiudad => ({
  id,
  ruta: "r",
  nombre: id,
  sentido,
  lat: YO.lat + metros / 111_195,
  lon: YO.lon,
});

describe("las paradas cerca de ti", () => {
  it("mide en metros, en línea recta", () => {
    expect(distanciaM(YO, alNorte("a", 500))).toBeCloseTo(500, -1);
  });

  it("ordena de la más cercana a la más lejana", () => {
    const r = paradasCerca(YO, [alNorte("lejos", 800), alNorte("cerca", 120), alNorte("medio", 400)]);
    expect(r.map((p) => p.id)).toEqual(["cerca", "medio", "lejos"]);
  });

  it("fuera del radio no hay «cercana»: la lista puede quedar vacía, y la pantalla lo dice", () => {
    expect(paradasCerca(YO, [alNorte("lejos", 1500)])).toEqual([]);
  });

  it("no pasa del máximo", () => {
    const muchas = Array.from({ length: 12 }, (_, i) => alNorte(`p${i}`, 50 + i * 20));
    expect(paradasCerca(YO, muchas)).toHaveLength(5);
  });

  it("la misma esquina en ida y en vuelta son dos paradas: el pasajero escoge a dónde va", () => {
    const r = paradasCerca(YO, [alNorte("esquina-ida", 200, "ida"), alNorte("esquina-vuelta", 210, "vuelta")]);
    expect(r).toHaveLength(2);
  });

  it("la distancia en palabras no promete más precisión de la que da un teléfono", () => {
    expect(distanciaEnPalabras(37)).toBe("a 40 m");
    expect(distanciaEnPalabras(4)).toBe("a 10 m");
    expect(distanciaEnPalabras(333)).toBe("a 350 m");
    expect(distanciaEnPalabras(980)).toBe("a 1 km");
  });
});
