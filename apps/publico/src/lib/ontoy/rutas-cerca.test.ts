import { describe, expect, it } from "vitest";
import { distanciaALaRuta, ordenarRutas } from "./rutas-cerca";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

/* Sólo lo que el orden mira; el resto del contrato no participa. */
const ruta = (id: string, nombre: string): RutaDeLaCiudad =>
  ({ circuito_id: id, nombre, color_hex: "#1E6FD9", promesa: null }) as unknown as RutaDeLaCiudad;

const parada = (rutaId: string, nombre: string, lat: number, lon: number): ParadaDeLaCiudad => ({
  id: `${rutaId}-${nombre}`,
  ruta: rutaId,
  nombre,
  sentido: null,
  lat,
  lon,
});

/* Un punto de referencia y tres rutas a distancias claramente distintas. */
const YO = { lat: 31.7, lon: -106.42 };
const CERCA = ruta("cerca", "Zaragoza–Sur");
const MEDIA = ruta("media", "Circuito Norte");
const LEJOS = ruta("lejos", "Aeropuerto");

const PARADAS = [
  parada("cerca", "a", 31.701, -106.42), // ~110 m
  parada("media", "b", 31.71, -106.42), // ~1.1 km
  parada("lejos", "c", 31.78, -106.42), // ~8.9 km
];

describe("con ubicación: por distancia", () => {
  const { rutas, porDistancia } = ordenarRutas([LEJOS, MEDIA, CERCA], PARADAS, YO);

  it("la más cercana primero, y lo dice", () => {
    expect(rutas.map((r) => r.ruta.circuito_id)).toEqual(["cerca", "media", "lejos"]);
    expect(porDistancia).toBe(true);
  });

  it("cada una trae su distancia, para que el orden se pueda comprobar", () => {
    expect(rutas.every((r) => r.distanciaM !== null)).toBe(true);
    expect(Math.round(rutas[0]!.distanciaM! / 10) * 10).toBeLessThan(200);
  });

  it("la distancia de una ruta es la de su parada MÁS cercana, no la de cualquiera", () => {
    const dos = [parada("r", "lejana", 31.78, -106.42), parada("r", "pegada", 31.7005, -106.42)];
    expect(distanciaALaRuta(YO, "r", dos)).toBeLessThan(100);
  });

  it("las paradas de OTRA ruta no cuentan para ésta", () => {
    expect(distanciaALaRuta(YO, "cerca", [parada("otra", "pegadísima", 31.7, -106.42)])).toBeNull();
  });
});

describe("sin ubicación: alfabético, y NO son «cercanas»", () => {
  const { rutas, porDistancia } = ordenarRutas([LEJOS, MEDIA, CERCA], PARADAS, null);

  it("en orden alfabético en español", () => {
    expect(rutas.map((r) => r.ruta.nombre)).toEqual(["Aeropuerto", "Circuito Norte", "Zaragoza–Sur"]);
  });

  /*
   * La bandera que le prohíbe a la pantalla titular «cerca de ti». Sin
   * ubicación estas tres no son las más cercanas: son tres rutas. El dato sería
   * correcto y el título falso (Marco §D).
   */
  it("avisa que NO es por distancia, para que el encabezado no mienta", () => {
    expect(porDistancia).toBe(false);
  });

  it("ninguna finge una distancia que nadie midió", () => {
    expect(rutas.every((r) => r.distanciaM === null)).toBe(true);
  });
});

describe("una ruta sin paradas publicadas", () => {
  const SIN = ruta("sin", "Aaa Sin Paradas");

  it("no se esconde, pero no se cuela entre las cercanas ni inventa número", () => {
    const { rutas } = ordenarRutas([SIN, CERCA, MEDIA], PARADAS, YO);
    expect(rutas.map((r) => r.ruta.circuito_id)).toEqual(["cerca", "media", "sin"]);
    expect(rutas.at(-1)!.distanciaM).toBeNull();
  });

  it("con TODAS sin paradas, el orden no puede decirse por distancia", () => {
    const { porDistancia } = ordenarRutas([SIN], [], YO);
    expect(porDistancia).toBe(false);
  });
});
