/**
 * Paso 1 · la densidad de la evidencia.
 *
 * Lo que vigilan, y el orden importa:
 *
 *   1. Que NO gobierne — ningún veredicto se mueve por su existencia. Es lo
 *      único que hace al paso 1 seguro de construir hoy.
 *   2. Que use la definición de `medir-cadencia` —mediana del hueco entre
 *      puntos consecutivos del MISMO aparato— y no puntos÷duración. Si el hecho
 *      y el instrumento midieran cosas distintas, comparar el «antes» con el
 *      «después» del cambio no querría decir nada.
 *   3. Que un aparato con un solo punto NO cuente como cadencia cero.
 */
import { describe, it, expect } from "vitest";
import { medirDensidad, verifyService } from "./index.js";
import type { GpsPoint, VerificationInput } from "@jtel/domain";

const T0 = new Date("2026-09-01T12:00:00Z");

function p(imei: string, segundos: number): GpsPoint {
  return {
    imei,
    latitude: 31.7,
    longitude: -106.4,
    timestamp: new Date(T0.getTime() + segundos * 1000),
  } as GpsPoint;
}

const VENTANA = { start: T0, end: new Date(T0.getTime() + 3600 * 1000) };

describe("la densidad usa la definición de medir-cadencia", () => {
  it("es la mediana del hueco entre puntos consecutivos del mismo aparato", () => {
    // Un aparato cada 60 s exactos — el régimen de julio de Planta 47.
    const puntos = [0, 60, 120, 180, 240].map((s) => p("A", s));
    const d = medirDensidad(puntos, VENTANA);
    expect(d.huecoMedianaS).toBe(60);
    expect(d.aparatos).toBe(1);
    expect(d.puntos).toBe(5);
  });

  it("NO es puntos ÷ duración — un cociente se mueve por el denominador", () => {
    /*
     * Dos aparatos con la MISMA cadencia (60 s) pero uno corrió la mitad del
     * tiempo. Un cociente daría cosas distintas; la mediana del hueco, no.
     */
    const puntos = [
      ...[0, 60, 120, 180, 240, 300].map((s) => p("A", s)),
      ...[0, 60, 120].map((s) => p("B", s)),
    ];
    const d = medirDensidad(puntos, VENTANA);
    expect(d.huecoMedianaS).toBe(60);
  });

  it("agrupa por APARATO, no por unidad — una unidad puede cambiar de aparato", () => {
    // A cada 30 s, B cada 90 s: la mediana de las dos cadencias es 60.
    const puntos = [
      ...[0, 30, 60, 90].map((s) => p("A", s)),
      ...[0, 90, 180, 270].map((s) => p("B", s)),
    ];
    const d = medirDensidad(puntos, VENTANA);
    expect(d.aparatos).toBe(2);
    expect(d.huecoMedianaS).toBe(60);
    // Y el peor se declara aparte: es el que más se acerca al piso.
    expect(d.huecoPeorS).toBe(90);
  });

  it("un aparato con un solo punto no tiene cadencia — y no cuenta como cero", () => {
    const d = medirDensidad([p("A", 0), p("B", 0), p("B", 40)], VENTANA);
    expect(d.aparatos).toBe(1);
    expect(d.huecoMedianaS).toBe(40);
  });

  it("sin puntos no inventa una densidad", () => {
    const d = medirDensidad([], VENTANA);
    expect(d.huecoMedianaS).toBeNull();
    expect(d.huecoPeorS).toBeNull();
    expect(d.aparatos).toBe(0);
  });

  it("solo mira dentro de la ventana: el árbitro juzgó con eso", () => {
    const dentro = [0, 60, 120].map((s) => p("A", s));
    const fuera = [-600, -540].map((s) => p("A", s));
    const d = medirDensidad([...fuera, ...dentro], VENTANA);
    expect(d.puntos).toBe(3);
  });
});

describe("el paso 1 NO gobierna", () => {
  const GEOCERCA = [
    { lat: 31.72, lng: -106.4 },
    { lat: 31.73, lng: -106.4 },
    { lat: 31.73, lng: -106.39 },
    { lat: 31.72, lng: -106.39 },
  ];

  function entrada(puntos: GpsPoint[]): VerificationInput {
    return {
      occurrenceId: "occ-1",
      expectedDeadline: new Date(T0.getTime() + 3600 * 1000),
      toleranceMinutes: 10,
      routeStrictness: "kml_full",
      geofencePolygon: GEOCERCA,
      evidencePoints: puntos,
    } as VerificationInput;
  }

  it("el veredicto es el mismo con evidencia densa y con evidencia rala", () => {
    /*
     * La MISMA geometría, dos cadencias: 10 s y 120 s. Mientras el piso esté
     * apagado, el veredicto no puede distinguirlas. Si algún día esta prueba se
     * pone roja sin que nadie encienda el paso 4, la densidad empezó a gobernar
     * sin que se decidiera.
     */
    const densa: GpsPoint[] = [];
    for (let s = 0; s <= 600; s += 10) {
      densa.push({ ...p("A", s), latitude: 31.725, longitude: -106.395 } as GpsPoint);
    }
    const rala: GpsPoint[] = [];
    for (let s = 0; s <= 600; s += 120) {
      rala.push({ ...p("A", s), latitude: 31.725, longitude: -106.395 } as GpsPoint);
    }

    const vDensa = verifyService(entrada(densa));
    const vRala = verifyService(entrada(rala));

    expect(vDensa.status).toBe(vRala.status);
    expect(vDensa.observedUnitId).toBe(vRala.observedUnitId);
  });

  it("se anota en el ledger declarando que no gobierna", () => {
    const puntos = [0, 60, 120].map((s) => ({
      ...p("A", s),
      latitude: 31.725,
      longitude: -106.395,
    })) as GpsPoint[];
    const v = verifyService(entrada(puntos));
    const paso = v.ledgerSteps.find((s) => s.step === "densidad_evidencia");

    expect(paso).toBeDefined();
    // Que lo declare importa: un número junto a un veredicto invita a leerlo
    // como causa, y hasta el paso 4 no lo es.
    expect(paso!.details!.gobierna).toBe(false);
    expect(v.densidadEvidencia).not.toBeNull();
  });
});
