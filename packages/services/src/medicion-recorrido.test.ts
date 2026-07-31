import { describe, it, expect } from "vitest";
import { measureBestTraversal, corridorKmFromMeters } from "./medicion-recorrido.js";

/** Trazado recto de 21 waypoints, ~9.5 km. */
const RUTA = Array.from({ length: 21 }, (_, i) => ({
  lat: 31.7,
  lng: -106.5 + i * 0.005,
}));

const CORREDOR_KM = 0.12;
const DEADLINE = new Date("2026-07-30T12:45:00Z");
const enMinutos = (min: number) => new Date(DEADLINE.getTime() + min * 60_000);

function puntoEnRuta(unitId: string, i: number, min: number) {
  return {
    imei: unitId,
    latitude: RUTA[i]!.lat,
    longitude: RUTA[i]!.lng,
    timestamp: enMinutos(min),
  };
}

describe("corridorKmFromMeters", () => {
  it("es el mismo corredor que usa el motor al calificar", () => {
    expect(corridorKmFromMeters(120)).toBeCloseTo(0.12);
    expect(corridorKmFromMeters(undefined)).toBeCloseTo(0.12);
    expect(corridorKmFromMeters(5000)).toBe(0.5); // techo
    expect(corridorKmFromMeters(1)).toBe(0.01); // piso
  });
});

describe("measureBestTraversal", () => {
  it("mide la unidad que más evidencia dejó sobre el corredor", () => {
    const puntos = [
      // La que sí hizo la ruta: 21 puntos, de -96 a -16 min.
      ...RUTA.map((_, i) => puntoEnRuta("unidad-que-recorrio", i, -96 + i * 4)),
      // Otra que solo rozó el corredor al final.
      puntoEnRuta("unidad-de-paso", 19, -30),
      puntoEnRuta("unidad-de-paso", 20, -25),
      puntoEnRuta("unidad-de-paso", 20, -20),
    ];

    const best = measureBestTraversal(puntos, RUTA, CORREDOR_KM);

    expect(best?.unitId).toBe("unidad-que-recorrio");
    expect(best?.measurement.durationMinutes).toBe(80);
    expect(best?.measurement.pointsInCorridor).toBe(21);
  });

  it("mide aunque el servicio no haya cumplido: es observación, no veredicto", () => {
    // Sin llegada conocida (nadie acreditó), la medición existe igual — es
    // justo la ruta que hoy falla por ventana corta la que más la necesita.
    const puntos = RUTA.slice(0, 10).map((_, i) => puntoEnRuta("u1", i, -60 + i * 5));

    const best = measureBestTraversal(puntos, RUTA, CORREDOR_KM);

    expect(best?.measurement.durationMinutes).toBe(45);
  });

  it("cierra en la llegada de la unidad acreditada, no en su último punto", () => {
    const puntos = [
      ...RUTA.map((_, i) => puntoEnRuta("u1", i, -90 + i * 4)),
      // Estacionada sobre el corredor tres horas después de llegar.
      puntoEnRuta("u1", 20, 60),
      puntoEnRuta("u1", 20, 180),
    ];

    const best = measureBestTraversal(puntos, RUTA, CORREDOR_KM, {
      arrivalAtByUnit: new Map([["u1", DEADLINE]]),
    });

    expect(best?.measurement.durationMinutes).toBe(90);
  });

  it("declara la cota inferior cuando la ventana recortó el arranque", () => {
    const ventana = { start: enMinutos(-60), end: enMinutos(45) };
    const puntos = RUTA.map((_, i) => puntoEnRuta("u1", i, -96 + i * 4)).filter(
      (p) => p.timestamp >= ventana.start,
    );

    const best = measureBestTraversal(puntos, RUTA, CORREDOR_KM, {
      arrivalAtByUnit: new Map([["u1", DEADLINE]]),
      window: ventana,
    });

    expect(best?.measurement.lowerBound).toBe(true);
    expect(best?.measurement.durationMinutes).toBe(60);
  });

  it("descarta unidades con evidencia demasiado pobre", () => {
    const puntos = [puntoEnRuta("u1", 0, -60), puntoEnRuta("u1", 1, -50)];

    expect(measureBestTraversal(puntos, RUTA, CORREDOR_KM)).toBeNull();
    expect(
      measureBestTraversal(puntos, RUTA, CORREDOR_KM, { minPointsInCorridor: 2 }),
    ).not.toBeNull();
  });

  it("sin trazado, sin puntos o sin nada en corredor no mide", () => {
    const lejos = Array.from({ length: 5 }, (_, i) => ({
      imei: "u1",
      latitude: 31.9,
      longitude: -106.9,
      timestamp: enMinutos(-60 + i * 5),
    }));

    expect(measureBestTraversal(lejos, RUTA, CORREDOR_KM)).toBeNull();
    expect(measureBestTraversal([], RUTA, CORREDOR_KM)).toBeNull();
    expect(measureBestTraversal(lejos, [], CORREDOR_KM)).toBeNull();
  });
});
