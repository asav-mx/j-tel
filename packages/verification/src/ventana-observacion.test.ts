import { describe, it, expect } from "vitest";
import {
  measureRouteTraversal,
  summarizeRouteDuration,
  deriveObservationWindow,
} from "./index.js";

/**
 * Trazado sintético: una línea recta al oriente sobre la misma latitud.
 * 21 waypoints cada 0.005° de longitud ≈ 0.47 km → ~9.5 km de largo.
 */
const RUTA = Array.from({ length: 21 }, (_, i) => ({
  lat: 31.7,
  lng: -106.5 + i * 0.005,
}));

const CORREDOR_KM = 0.12;
const DEADLINE = new Date("2026-07-30T12:45:00Z");

const enMinutos = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);

/** Un punto GPS sobre el waypoint `i`, a `min` minutos del ancla. */
function puntoEnRuta(i: number, ancla: Date, min: number) {
  return {
    imei: "unidad-1",
    latitude: RUTA[i]!.lat,
    longitude: RUTA[i]!.lng,
    timestamp: enMinutos(ancla, min),
  };
}

describe("measureRouteTraversal", () => {
  it("mide del primer punto en corredor hasta la llegada a la geocerca", () => {
    // Arranca 96 min antes del deadline y llega justo al deadline.
    const inicio = enMinutos(DEADLINE, -96);
    const puntos = RUTA.map((_, i) => puntoEnRuta(i, inicio, i * 4));

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM, { arrivalAt: DEADLINE });

    expect(m.durationMinutes).toBe(96);
    expect(m.startedAt?.toISOString()).toBe(inicio.toISOString());
    expect(m.endedAt?.toISOString()).toBe(DEADLINE.toISOString());
    expect(m.pointsInCorridor).toBe(21);
    expect(m.lowerBound).toBe(false);
  });

  it("ignora los puntos que andaban fuera del corredor", () => {
    const inicio = enMinutos(DEADLINE, -60);
    const puntos = [
      // Media hora dando vueltas a ~1.1 km del trazado: no es recorrido de esta ruta.
      { imei: "unidad-1", latitude: 31.71, longitude: -106.5, timestamp: enMinutos(inicio, -30) },
      puntoEnRuta(0, inicio, 0),
      puntoEnRuta(10, inicio, 30),
      puntoEnRuta(20, inicio, 60),
    ];

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM);

    expect(m.pointsInCorridor).toBe(3);
    expect(m.durationMinutes).toBe(60);
  });

  it("sin llegada conocida, cierra en el último punto en corredor", () => {
    const inicio = enMinutos(DEADLINE, -80);
    const puntos = RUTA.slice(0, 11).map((_, i) => puntoEnRuta(i, inicio, i * 5));

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM);

    expect(m.durationMinutes).toBe(50);
  });

  it("una unidad estacionada sobre el corredor después de llegar no infla la duración", () => {
    const inicio = enMinutos(DEADLINE, -90);
    const puntos = [
      ...RUTA.map((_, i) => puntoEnRuta(i, inicio, i * 4)),
      // Se queda 3 horas parada en el último waypoint, ya dentro de la planta.
      puntoEnRuta(20, inicio, 120),
      puntoEnRuta(20, inicio, 270),
    ];

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM, { arrivalAt: DEADLINE });

    expect(m.durationMinutes).toBe(90);
  });

  it("ordena la evidencia: no depende de cómo venga la lista", () => {
    const inicio = enMinutos(DEADLINE, -70);
    const puntos = [
      puntoEnRuta(20, inicio, 70),
      puntoEnRuta(0, inicio, 0),
      puntoEnRuta(10, inicio, 35),
    ];

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM);

    expect(m.durationMinutes).toBe(70);
    expect(m.startedAt?.toISOString()).toBe(inicio.toISOString());
  });

  it("declara cota inferior cuando el recorrido ya venía andando al abrir la ventana", () => {
    const ventana = { start: enMinutos(DEADLINE, -60), end: enMinutos(DEADLINE, 45) };
    // La ruta arrancó 96 min antes, pero el motor solo tiene lo de su ventana.
    const inicio = enMinutos(DEADLINE, -96);
    const puntos = RUTA.map((_, i) => puntoEnRuta(i, inicio, i * 4)).filter(
      (p) => p.timestamp >= ventana.start,
    );

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM, {
      arrivalAt: DEADLINE,
      window: ventana,
    });

    expect(m.lowerBound).toBe(true);
    // 60 min observados de los 96 reales: el número está recortado y lo dice.
    expect(m.durationMinutes).toBe(60);
  });

  it("no declara cota inferior cuando el arranque se vio con holgura", () => {
    const ventana = { start: enMinutos(DEADLINE, -120), end: enMinutos(DEADLINE, 45) };
    const inicio = enMinutos(DEADLINE, -96);
    const puntos = RUTA.map((_, i) => puntoEnRuta(i, inicio, i * 4));

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM, {
      arrivalAt: DEADLINE,
      window: ventana,
    });

    expect(m.lowerBound).toBe(false);
    expect(m.durationMinutes).toBe(96);
  });

  it("sin llegada y pegado al cierre de la ventana, también es cota inferior", () => {
    const ventana = { start: enMinutos(DEADLINE, -120), end: enMinutos(DEADLINE, 45) };
    const inicio = enMinutos(DEADLINE, -60);
    const puntos = RUTA.map((_, i) => puntoEnRuta(i, inicio, i * 5)); // último a +45

    const m = measureRouteTraversal(puntos, RUTA, CORREDOR_KM, { window: ventana });

    expect(m.lowerBound).toBe(true);
  });

  it("sin evidencia en corredor, sin trazado o sin puntos no inventa duración", () => {
    const inicio = enMinutos(DEADLINE, -60);
    const lejos = [
      { imei: "u", latitude: 31.9, longitude: -106.9, timestamp: inicio },
      { imei: "u", latitude: 31.91, longitude: -106.91, timestamp: enMinutos(inicio, 30) },
    ];

    expect(measureRouteTraversal(lejos, RUTA, CORREDOR_KM).durationMinutes).toBeNull();
    expect(measureRouteTraversal([], RUTA, CORREDOR_KM).durationMinutes).toBeNull();
    expect(measureRouteTraversal(lejos, [], CORREDOR_KM).durationMinutes).toBeNull();
  });
});

describe("el ciclo completo: medir con la ventana rota y salir de ella", () => {
  it("converge subiendo hasta que el arranque deja de quedar fuera", () => {
    // La ruta dura 96 min de verdad; el contrato abre 60. La primera medición
    // sale recortada, así que la ventana no puede quedarse quieta esperando un
    // dato que ella misma impide observar: cada ronda abre un poco más hasta
    // que la medición deja de topar con el borde.
    const inicioReal = enMinutos(DEADLINE, -96);
    const recorridoCompleto = RUTA.map((_, i) => puntoEnRuta(i, inicioReal, i * 4));

    let ventana = { start: enMinutos(DEADLINE, -60), end: enMinutos(DEADLINE, 45) };
    let anchoAntes = 60;
    const duraciones: number[] = [];
    let rondas = 0;

    for (; rondas < 10; rondas++) {
      const vistos = recorridoCompleto.filter((p) => p.timestamp >= ventana.start);
      const m = measureRouteTraversal(vistos, RUTA, CORREDOR_KM, {
        arrivalAt: DEADLINE,
        window: ventana,
      });
      duraciones.push(m.durationMinutes!);
      if (!m.lowerBound) break;

      const resumen = summarizeRouteDuration(
        // Tres días iguales: lo que importa aquí es el ciclo, no la dispersión.
        Array.from({ length: 3 }, () => ({
          durationMinutes: m.durationMinutes!,
          lowerBound: m.lowerBound,
        })),
      );
      const derivada = deriveObservationWindow(DEADLINE, {
        minBeforeMinutes: 60,
        afterMinutes: 45,
        measuredDurationMinutes: resumen.minutes,
      });
      expect(derivada.beforeMinutes).toBeGreaterThan(anchoAntes);
      anchoAntes = derivada.beforeMinutes;
      ventana = { start: derivada.windowStart, end: derivada.windowEnd };
    }

    // Converge, y en pocas rondas: la primera medición ya es la mitad del camino.
    expect(rondas).toBeLessThanOrEqual(4);
    // La última medición es la duración real, sin recorte.
    expect(duraciones[duraciones.length - 1]).toBe(96);
    // Y cada ronda vio más recorrido que la anterior.
    expect([...duraciones].sort((a, b) => a - b)).toEqual(duraciones);
    expect(duraciones[0]).toBe(60);
  });
});
