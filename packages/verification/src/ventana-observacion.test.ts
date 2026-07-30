import { describe, it, expect } from "vitest";
import {
  measureRouteTraversal,
  summarizeRouteDuration,
  routeLengthKm,
  estimateRouteDurationMinutes,
  deriveObservationWindow,
  DEFAULT_ROUTE_AVG_SPEED_KMH,
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

describe("summarizeRouteDuration", () => {
  const muestras = (...mins: number[]) => mins.map((durationMinutes) => ({ durationMinutes }));

  it("toma el percentil alto: la ventana cubre el día lento, no el típico", () => {
    // 10 días; el p90 por rango más cercano es el noveno valor ordenado.
    const r = summarizeRouteDuration(
      muestras(60, 62, 65, 66, 70, 71, 73, 80, 96, 100),
      { percentile: 90 },
    );

    expect(r.minutes).toBe(96);
    expect(r.sampleCount).toBe(10);
  });

  it("devuelve una duración que de verdad ocurrió, no un promedio de dos días", () => {
    const r = summarizeRouteDuration(muestras(40, 90, 200), { percentile: 50, minSamples: 3 });

    expect(r.minutes).toBe(90);
  });

  it("sin muestras suficientes no hay duración medida", () => {
    const r = summarizeRouteDuration(muestras(90, 95), { minSamples: 3 });

    expect(r.minutes).toBeNull();
    expect(r.sampleCount).toBe(2);
  });

  it("una medición recortada levanta un piso: la ruta duró AL MENOS eso", () => {
    // El p90 crudo daría 56; pero la muestra de 56 venía recortada por la
    // ventana, así que el resumen no puede quedar por debajo de ella.
    const r = summarizeRouteDuration(
      [
        { durationMinutes: 50 },
        { durationMinutes: 52 },
        { durationMinutes: 56, lowerBound: true },
      ],
      { percentile: 50, minSamples: 3 },
    );

    expect(r.minutes).toBe(56);
    expect(r.lowerBoundCount).toBe(1);
  });

  it("descarta muestras imposibles (cero, negativas, no finitas)", () => {
    const r = summarizeRouteDuration(
      [
        { durationMinutes: 0 },
        { durationMinutes: -5 },
        { durationMinutes: Number.NaN },
        { durationMinutes: 80 },
        { durationMinutes: 90 },
        { durationMinutes: 100 },
      ],
      { minSamples: 3, percentile: 100 },
    );

    expect(r.sampleCount).toBe(3);
    expect(r.minutes).toBe(100);
  });
});

describe("routeLengthKm y estimateRouteDurationMinutes", () => {
  it("mide el largo del trazado siguiendo sus waypoints", () => {
    expect(routeLengthKm(RUTA)).toBeCloseTo(9.47, 1);
    expect(routeLengthKm([])).toBe(0);
    expect(routeLengthKm([{ lat: 31.7, lng: -106.5 }])).toBe(0);
  });

  it("estima la duración de una ruta sin historia: largo entre velocidad", () => {
    expect(estimateRouteDurationMinutes(30, 25)).toBe(72);
    expect(estimateRouteDurationMinutes(10, DEFAULT_ROUTE_AVG_SPEED_KMH)).toBe(24);
  });

  it("no estima nada con largo o velocidad imposibles", () => {
    expect(estimateRouteDurationMinutes(0, 25)).toBeNull();
    expect(estimateRouteDurationMinutes(-3, 25)).toBeNull();
    expect(estimateRouteDurationMinutes(30, 0)).toBeNull();
  });
});

describe("deriveObservationWindow", () => {
  // La política de hoy: 60 min antes, 45 después (gracia 15 + margen 30).
  const politica = { minBeforeMinutes: 60, afterMinutes: 45 };

  it("el caso que originó el arreglo: 96 min de ruta contra 60 de ventana", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
    });

    // 96 × 1.25 = 120 min de "antes" — la ventana ya cubre el arranque.
    expect(v.beforeMinutes).toBe(120);
    expect(v.basis).toBe("medida");
    expect(v.routeDurationMinutes).toBe(96);
    expect(v.windowStart.toISOString()).toBe(enMinutos(DEADLINE, -120).toISOString());
    expect(v.cappedByMax).toBe(false);
  });

  it("el lado de después no lo toca: gracia y margen posterior quedan igual", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
    });

    expect(v.afterMinutes).toBe(45);
    expect(v.windowEnd.toISOString()).toBe(enMinutos(DEADLINE, 45).toISOString());
    expect(v.widthMinutes).toBe(165);
  });

  it("nunca queda más angosta que la ventana del contrato", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 20,
    });

    expect(v.beforeMinutes).toBe(60);
    expect(v.basis).toBe("medida");
  });

  it("el techo corta las mediciones locas y lo declara", () => {
    // La ruta de 370 min del diagnóstico: pediría 463 min de ventana.
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 370,
      maxBeforeMinutes: 360,
    });

    expect(v.beforeMinutes).toBe(360);
    expect(v.cappedByMax).toBe(true);
  });

  it("un techo mal configurado por debajo del piso no angosta la ventana", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
      maxBeforeMinutes: 10,
    });

    expect(v.beforeMinutes).toBe(60);
  });

  it("sin historia, dimensiona con la geometría del trazado", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: null,
      routeLengthKm: 30,
      avgSpeedKmh: 25,
    });

    // 30 km ÷ 25 km/h = 72 min → 72 × 1.25 = 90.
    expect(v.beforeMinutes).toBe(90);
    expect(v.basis).toBe("estimada_geometria");
    expect(v.routeDurationMinutes).toBe(72);
  });

  it("saca el largo del propio trazado cuando no se lo dan calculado", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      kmlWaypoints: RUTA,
      avgSpeedKmh: 25,
    });

    expect(v.basis).toBe("estimada_geometria");
    expect(v.routeDurationMinutes).toBeCloseTo(22.7, 1);
    // La ruta es corta: manda el piso del contrato.
    expect(v.beforeMinutes).toBe(60);
  });

  it("la historia le gana a la geometría", () => {
    const v = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
      routeLengthKm: 30,
    });

    expect(v.basis).toBe("medida");
    expect(v.beforeMinutes).toBe(120);
  });

  it("sin historia y sin trazado, la ventana es la de política de siempre", () => {
    const v = deriveObservationWindow(DEADLINE, politica);

    expect(v.basis).toBe("politica");
    expect(v.routeDurationMinutes).toBeNull();
    expect(v.beforeMinutes).toBe(60);
    expect(v.widthMinutes).toBe(105);
  });

  it("es monótona: una ruta más larga nunca abre una ventana más angosta", () => {
    let previa = 0;
    for (const duracion of [10, 45, 60, 96, 150, 229, 370, 600]) {
      const v = deriveObservationWindow(DEADLINE, {
        ...politica,
        measuredDurationMinutes: duracion,
      });
      expect(v.beforeMinutes).toBeGreaterThanOrEqual(previa);
      previa = v.beforeMinutes;
    }
  });

  it("la holgura es configurable por contrato", () => {
    const sinHolgura = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
      slackPct: 0,
    });
    const conMucha = deriveObservationWindow(DEADLINE, {
      ...politica,
      measuredDurationMinutes: 96,
      slackPct: 50,
    });

    expect(sinHolgura.beforeMinutes).toBe(96);
    expect(conMucha.beforeMinutes).toBe(144);
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
