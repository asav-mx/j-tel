import { describe, it, expect } from "vitest";
import {
  summarizeRouteDuration,
  routeLengthKm,
  estimateRouteDurationMinutes,
  deriveObservationWindow,
  computeEvidenceWindow,
  contractPolicySchema,
  DEFAULT_ROUTE_AVG_SPEED_KMH,
} from "./index.js";

/** Trazado sintético: una recta al oriente, 21 waypoints, ~9.5 km. */
const RUTA = Array.from({ length: 21 }, (_, i) => ({
  lat: 31.7,
  lng: -106.5 + i * 0.005,
}));

const DEADLINE = new Date("2026-07-30T12:45:00Z");
const enMinutos = (base: Date, min: number) => new Date(base.getTime() + min * 60_000);

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
    // El p50 crudo daría 52; pero la muestra de 56 venía recortada por la
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
    // Default 20 km/h: ruta de recolección con paradas, no flujo libre.
    expect(estimateRouteDurationMinutes(10, DEFAULT_ROUTE_AVG_SPEED_KMH)).toBe(30);
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

describe("computeEvidenceWindow", () => {
  const politica = contractPolicySchema.parse({
    toleranceMinutes: 5,
    routeStrictness: "kml_full",
  });

  it("sin hechos de la ruta da exactamente la ventana de siempre", () => {
    // Regresión cero para quien no sabe nada de la ruta: la torre en vivo, la
    // ficha de servicio, la corrección de deadlines.
    const v = computeEvidenceWindow(DEADLINE, politica);

    expect(v.windowStart.toISOString()).toBe(enMinutos(DEADLINE, -60).toISOString());
    expect(v.windowEnd.toISOString()).toBe(enMinutos(DEADLINE, 45).toISOString());
    expect(v.basis).toBe("politica");
  });

  it("respeta los márgenes del contrato, no los defaults", () => {
    const v = computeEvidenceWindow(DEADLINE, {
      ...politica,
      evidenceMarginMinutesBefore: 70,
      verificationGraceMinutes: 20,
      evidenceMarginMinutesAfter: 35,
    });

    expect(v.beforeMinutes).toBe(70);
    expect(v.afterMinutes).toBe(55);
  });

  it("con la duración medida de la ruta, abre antes", () => {
    const v = computeEvidenceWindow(DEADLINE, politica, {
      measuredDurationMinutes: 96,
    });

    expect(v.beforeMinutes).toBe(120);
    expect(v.basis).toBe("medida");
    // El lado de después no se mueve.
    expect(v.windowEnd.toISOString()).toBe(enMinutos(DEADLINE, 45).toISOString());
  });

  it("sin historia usa el KML: Huertas-B, 29.5 km, deja de arrancar ciego", () => {
    const v = computeEvidenceWindow(DEADLINE, politica, { routeLengthKm: 29.5 });

    // 29.5 km ÷ 20 km/h = 88.5 min → × 1.25 = 111 (la ruta dura 96 reales).
    expect(v.beforeMinutes).toBe(111);
    expect(v.basis).toBe("estimada_geometria");
  });

  it("una ruta corta no angosta nada: el margen del contrato es el piso", () => {
    const v = computeEvidenceWindow(DEADLINE, politica, { routeLengthKm: 5 });

    expect(v.beforeMinutes).toBe(60);
  });

  it("el interruptor de emergencia devuelve la ventana de política", () => {
    const v = computeEvidenceWindow(
      DEADLINE,
      { ...politica, windowDerivationEnabled: false },
      { measuredDurationMinutes: 370, routeLengthKm: 30 },
    );

    expect(v.beforeMinutes).toBe(60);
    expect(v.basis).toBe("politica");
  });

  it("las perillas de la ventana vienen con default: una política vieja no se rompe", () => {
    // Los contratos ya guardados no traen estos campos en su jsonb.
    const vieja = contractPolicySchema.parse({
      toleranceMinutes: 5,
      routeStrictness: "kml_full",
    });

    expect(vieja.windowDerivationEnabled).toBe(true);
    expect(vieja.windowSlackPct).toBe(25);
    expect(vieja.routeAvgSpeedKmh).toBe(20);
    expect(vieja.maxWindowBeforeMinutes).toBe(360);
    expect(vieja.routeDurationPercentile).toBe(90);
    expect(vieja.routeDurationMinSamples).toBe(3);
  });

  it("el techo del contrato acota la ventana de una ruta larguísima", () => {
    const v = computeEvidenceWindow(
      DEADLINE,
      { ...politica, maxWindowBeforeMinutes: 180 },
      { measuredDurationMinutes: 370 },
    );

    expect(v.beforeMinutes).toBe(180);
    expect(v.cappedByMax).toBe(true);
  });
});

/**
 * El ancho de la ventana son MINUTOS REALES, no minutos de reloj de pared.
 *
 * La versión anterior restaba con `setMinutes`, que es aritmética de
 * calendario en la zona del PROCESO. Dos días al año eso no es lo mismo: en
 * el cambio de horario, "tres horas antes" de reloj y "180 minutos antes" de
 * verdad son instantes distintos. Y como depende de la zona del proceso, la
 * misma ocurrencia salía con una ventana en la laptop de Juárez y otra en el
 * cron de Vercel en UTC — la misma familia de bug que corrió 294 hechos a la
 * hora equivocada.
 *
 * La ruta no dura una hora más porque el reloj se atrase. Estas pruebas
 * blindan eso.
 */
describe("la ventana en los días de cambio de horario", () => {
  const ZONA = "America/Ciudad_Juarez";
  const politica = contractPolicySchema.parse({
    toleranceMinutes: 5,
    routeStrictness: "kml_full",
  });
  // 144 medidos × 1.25 = 180 min de "antes". Tres horas exactas, para que el
  // corrimiento del cambio de horario se vea de un vistazo.
  const RUTA_DE_TRES_HORAS = { measuredDurationMinutes: 144 };

  const relojDePared = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA,
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
    }).format(d);

  /** Corre `fn` como si el proceso viviera en `tz`. */
  const conZonaDelProceso = <T,>(tz: string, fn: () => T): T => {
    const previa = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      process.env.TZ = previa;
    }
  };

  it("el día que el reloj se atrasa, la ventana sigue durando 180 minutos", () => {
    // 1 de noviembre de 2026: a las 02:00 el reloj vuelve a la 01:00.
    // Deadline 03:45 de Juárez, ya en horario de invierno.
    const deadline = new Date("2026-11-01T10:45:00Z");

    // Corrida en la zona del contrato, que es donde la aritmética de
    // calendario se equivocaba: ahí daba 00:45 local — 240 minutos reales.
    const v = conZonaDelProceso(ZONA, () =>
      computeEvidenceWindow(deadline, politica, RUTA_DE_TRES_HORAS),
    );

    expect(v.beforeMinutes).toBe(180);
    expect(v.windowStart.toISOString()).toBe("2026-11-01T07:45:00.000Z");
    expect(deadline.getTime() - v.windowStart.getTime()).toBe(180 * 60_000);
    // De 01:45 a 03:45 son dos horas de reloj de pared, pero tres reales:
    // la hora repetida se vive una sola vez y la ventana la cuenta.
    expect(relojDePared(v.windowStart)).toBe("2026-11-01, 01:45");
    expect(relojDePared(deadline)).toBe("2026-11-01, 03:45");
  });

  it("el día que el reloj se adelanta, tampoco se acorta", () => {
    // 8 de marzo de 2026: a las 02:00 el reloj salta a las 03:00.
    // Deadline 05:45 de Juárez, ya en horario de verano.
    const deadline = new Date("2026-03-08T11:45:00Z");

    // En la zona del contrato, la aritmética de calendario abría a las 03:45
    // local: 120 minutos reales de ventana en vez de 180.
    const v = conZonaDelProceso(ZONA, () =>
      computeEvidenceWindow(deadline, politica, RUTA_DE_TRES_HORAS),
    );

    expect(v.beforeMinutes).toBe(180);
    expect(v.windowStart.toISOString()).toBe("2026-03-08T08:45:00.000Z");
    expect(deadline.getTime() - v.windowStart.getTime()).toBe(180 * 60_000);
    // De 01:45 a 05:45 son cuatro horas de reloj de pared y tres reales:
    // la hora que no existió no se observa.
    expect(relojDePared(v.windowStart)).toBe("2026-03-08, 01:45");
    expect(relojDePared(deadline)).toBe("2026-03-08, 05:45");
  });

  it("la zona del proceso no mueve la ventana", () => {
    // El candado de verdad: con la aritmética de calendario, esta misma
    // ocurrencia daba 06:45Z corriendo en una máquina con zona de Juárez y
    // 07:45Z corriendo en UTC. La ventana no puede depender de dónde corrió
    // el generador.
    const deadline = new Date("2026-11-01T10:45:00Z");

    const inicios = ["UTC", ZONA, "Asia/Tokyo"].map((tz) =>
      conZonaDelProceso(tz, () =>
        computeEvidenceWindow(deadline, politica, RUTA_DE_TRES_HORAS).windowStart.toISOString(),
      ),
    );

    expect(new Set(inicios).size).toBe(1);
    expect(inicios[0]).toBe("2026-11-01T07:45:00.000Z");
  });

  it("sin hechos de la ruta tampoco depende de la zona del proceso", () => {
    // La ventana de política —la que usan la torre y la ficha— pasa por la
    // misma aritmética, así que hereda el mismo blindaje. Y el caso es peor
    // de lo que parece: con calendario local, restarle 60 minutos a un
    // deadline de 03:45 del día que el reloj salta caía en las 02:45 que no
    // existieron, JavaScript lo empujaba de vuelta a 03:45 y la ventana
    // quedaba de ANCHO CERO — el motor se quedaba ciego el día entero.
    const deadline = new Date("2026-03-08T09:45:00Z");

    const inicios = ["UTC", ZONA, "Asia/Tokyo"].map((tz) =>
      conZonaDelProceso(tz, () =>
        computeEvidenceWindow(deadline, politica).windowStart.toISOString(),
      ),
    );

    expect(new Set(inicios).size).toBe(1);
    expect(inicios[0]).toBe("2026-03-08T08:45:00.000Z");
    // 60 minutos reales, no un instante vacío.
    expect(deadline.getTime() - new Date(inicios[0]!).getTime()).toBe(60 * 60_000);
  });
});
