import { describe, it, expect } from "vitest";
import {
  verifyService,
  evaluateUnitRouteMatch,
  pointInPolygon,
  determineTiming,
  computeRouteMatchPct,
  computeCorridorPrecisionPct,
  assessEvidenceCoverage,
  buildSegmentIdf,
  computeWeightedRouteMatchPct,
  discreteFrechetKm,
  directionSimilarity,
  segmentKey,
  observableRouteSpan,
} from "./index.js";

const geofence = [
  { lat: 31.6904, lng: -106.4244 },
  { lat: 31.6914, lng: -106.4244 },
  { lat: 31.6914, lng: -106.4224 },
  { lat: 31.6904, lng: -106.4224 },
];

describe("verifyService", () => {
  const baseInput = {
    occurrenceId: "occ-1",
    expectedDeadline: new Date("2026-07-07T12:45:00Z"),
    toleranceMinutes: 5,
    routeStrictness: "destino_only" as const,
    geofencePolygon: geofence,
    excusableReasons: [] as const,
  };

  it("returns pendiente_evidencia when no GPS points", () => {
    const result = verifyService({ ...baseInput, evidencePoints: [] });
    expect(result.status).toBe("pendiente_evidencia");
    expect(result.observedUnitId).toBeNull();
  });

  it("returns cumplido when unit arrives on time", () => {
    const result = verifyService({
      ...baseInput,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    expect(result.status).toBe("cumplido");
    expect(result.timing).toBe("a_tiempo");
  });

  it("returns cumplido with timing tarde when late beyond tolerance", () => {
    const result = verifyService({
      ...baseInput,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:55:00Z"),
        },
      ],
    });
    expect(result.status).toBe("cumplido");
    expect(result.timing).toBe("tarde");
  });

  it("returns no_cumplido when no unit serves route", () => {
    const windowStart = new Date("2026-07-07T11:45:00Z");
    const windowEnd = new Date("2026-07-07T12:50:00Z");
    const points = [];
    for (let m = 0; m <= 65; m += 2) {
      points.push({
        imei: "unit-1",
        latitude: 31.8,
        longitude: -106.5,
        timestamp: new Date(windowStart.getTime() + m * 60_000),
      });
    }
    const result = verifyService({
      ...baseInput,
      coverageWindowStart: windowStart,
      coverageWindowEnd: windowEnd,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      evidencePoints: points,
    });
    expect(result.status).toBe("no_cumplido");
    expect(result.observedUnitId).toBeNull();
  });

  it("returns pendiente_evidencia when coverage has a large gap (never no_cumplido)", () => {
    const windowStart = new Date("2026-07-07T11:45:00Z");
    const windowEnd = new Date("2026-07-07T12:50:00Z");
    const result = verifyService({
      ...baseInput,
      coverageWindowStart: windowStart,
      coverageWindowEnd: windowEnd,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.8,
          longitude: -106.5,
          timestamp: new Date("2026-07-07T11:45:00Z"),
        },
        {
          imei: "unit-1",
          latitude: 31.8,
          longitude: -106.5,
          timestamp: new Date("2026-07-07T12:50:00Z"),
        },
      ],
    });
    expect(result.status).toBe("pendiente_evidencia");
    expect(result.ledgerSteps.some((s) => s.step === "cobertura_evidencia")).toBe(true);
  });

  it("no mezcla cobertura entre IMEIs de la flota (pendiente si ninguno cubre solo)", () => {
    const windowStart = new Date("2026-07-07T11:45:00Z");
    const windowEnd = new Date("2026-07-07T12:50:00Z");
    // Dos IMEIs con un punto cada uno en extremos: juntos “cubren”, por IMEI no.
    const result = verifyService({
      ...baseInput,
      coverageWindowStart: windowStart,
      coverageWindowEnd: windowEnd,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      evidencePoints: [
        {
          imei: "unit-a",
          latitude: 31.8,
          longitude: -106.5,
          timestamp: new Date("2026-07-07T11:45:00Z"),
        },
        {
          imei: "unit-b",
          latitude: 31.8,
          longitude: -106.5,
          timestamp: new Date("2026-07-07T12:50:00Z"),
        },
      ],
    });
    expect(result.status).toBe("pendiente_evidencia");
    const cov = result.ledgerSteps.find((s) => s.step === "cobertura_evidencia");
    expect(cov?.details).toMatchObject({ perImei: true });
  });

  it("never returns no_cumplido without evidence", () => {
    const result = verifyService({ ...baseInput, evidencePoints: [] });
    expect(result.status).not.toBe("no_cumplido");
  });
  it("prefers the unit that best matches KML when several enter the geofence", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6850, lng: -106.4280 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const result = verifyService({
      ...baseInput,
      kmlWaypoints: waypoints,
      evidencePoints: [
        // Unidad A: solo llega al destino (mala coincidencia de ruta)
        {
          imei: "unit-a",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:40:00Z"),
        },
        // Unidad B: sigue el KML y llega un poco después
        {
          imei: "unit-b",
          latitude: 31.6800,
          longitude: -106.4300,
          timestamp: new Date("2026-07-07T12:30:00Z"),
        },
        {
          imei: "unit-b",
          latitude: 31.6850,
          longitude: -106.4280,
          timestamp: new Date("2026-07-07T12:35:00Z"),
        },
        {
          imei: "unit-b",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    expect(result.status).toBe("cumplido");
    expect(result.observedUnitId).toBe("unit-b");
    expect(result.observedRouteMatchPct).toBe(100);
  });

  it("rejects geofence-only arrival when KML match is too low (kml_full)", () => {
    const waypoints = [
      { lat: 31.6500, lng: -106.4500 },
      { lat: 31.6600, lng: -106.4400 },
      { lat: 31.6700, lng: -106.4350 },
    ];
    const result = verifyService({
      ...baseInput,
      routeStrictness: "kml_full",
      kmlWaypoints: waypoints,
      evidencePoints: [
        {
          imei: "unit-a",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    expect(result.status).toBe("no_cumplido");
    expect(result.observedUnitId).toBeNull();
  });

  it("rejects high route coverage A when corridor precision B is low (kml_full)", () => {
    // Waypoints en línea; la unidad toca todos (A alto) pero la mayoría del GPS
    // está lejos de la ruta (B bajo) → no sirvió.
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6850, lng: -106.4280 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const onRoute = waypoints.map((wp, i) => ({
      imei: "wanderer",
      latitude: wp.lat,
      longitude: wp.lng,
      timestamp: new Date(`2026-07-07T12:${30 + i * 5}:00Z`),
    }));
    const offRoute = Array.from({ length: 12 }, (_, i) => ({
      imei: "wanderer",
      latitude: 31.75,
      longitude: -106.55,
      timestamp: new Date(`2026-07-07T12:${10 + i}:00Z`),
    }));
    const result = verifyService({
      ...baseInput,
      routeStrictness: "kml_full",
      kmlWaypoints: waypoints,
      kmlCorridorMeters: 120,
      kmlMatchMinPct: 60,
      kmlCorridorMinPct: 60,
      evidencePoints: [...offRoute, ...onRoute],
    });
    expect(result.status).toBe("no_cumplido");
    const cand = result.candidateUnits.find((c) => c.unitId === "wanderer");
    expect(cand?.routeMatchPct).toBeGreaterThanOrEqual(60);
    expect(cand?.corridorPrecisionPct).toBeLessThan(60);
  });

  it("accepts match only when A and B both clear the corridor thresholds", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6850, lng: -106.4280 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const result = verifyService({
      ...baseInput,
      kmlWaypoints: waypoints,
      kmlCorridorMeters: 120,
      evidencePoints: waypoints.map((wp, i) => ({
        imei: "unit-ok",
        latitude: wp.lat,
        longitude: wp.lng,
        timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
      })),
    });
    expect(result.status).toBe("cumplido");
    expect(result.observedUnitId).toBe("unit-ok");
    const cand = result.candidateUnits[0]!;
    expect(cand.routeMatchPct).toBe(100);
    expect(cand.corridorPrecisionPct).toBe(100);
  });

  it("honors configurable kmlMatchMinPct threshold (kml_full)", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.43 },
      { lat: 31.68273, lng: -106.42835 },
      { lat: 31.68545, lng: -106.4267 },
      { lat: 31.68818, lng: -106.42505 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    // Cubre el origen y el destino, 2 de 5 waypoints (40%) — el origen sí se
    // observó, así que esto sigue siendo un fallo real de match, no un
    // problema de observación.
    const points = [
      {
        imei: "unit-a",
        latitude: 31.68,
        longitude: -106.43,
        timestamp: new Date("2026-07-07T12:40:00Z"),
      },
      {
        imei: "unit-a",
        latitude: 31.6909,
        longitude: -106.4234,
        timestamp: new Date("2026-07-07T12:44:00Z"),
      },
    ];
    const fail = verifyService({
      ...baseInput,
      routeStrictness: "kml_full",
      kmlMatchMinPct: 60,
      kmlCorridorMinPct: 0,
      kmlWaypoints: waypoints,
      evidencePoints: points,
    });
    expect(fail.status).toBe("no_cumplido");

    const pass = verifyService({
      ...baseInput,
      routeStrictness: "kml_full",
      kmlMatchMinPct: 30,
      kmlCorridorMinPct: 0,
      kmlWaypoints: waypoints,
      evidencePoints: points,
    });
    expect(pass.status).toBe("cumplido");
    expect(pass.observedRouteMatchPct).toBeCloseTo(40, 5);
  });
});

describe("Ley 1 — la ventana debe cubrir el origen de la ruta", () => {
  const waypoints = [
    { lat: 31.68, lng: -106.43 },
    { lat: 31.68273, lng: -106.42835 },
    { lat: 31.68545, lng: -106.4267 },
    { lat: 31.68818, lng: -106.42505 },
    { lat: 31.6909, lng: -106.4234 },
  ];
  const baseInput = {
    occurrenceId: "occ-origen",
    expectedDeadline: new Date("2026-07-07T12:45:00Z"),
    toleranceMinutes: 5,
    routeStrictness: "kml_full" as const,
    geofencePolygon: geofence,
    excusableReasons: [] as const,
    kmlWaypoints: waypoints,
    kmlMatchMinPct: 60,
    kmlCorridorMinPct: 0,
  };

  it("pendiente_evidencia (no no_cumplido) cuando la evidencia solo cubre el tramo final de la ruta", () => {
    // Un solo punto, pegado al último waypoint — nada cerca del origen.
    const result = verifyService({
      ...baseInput,
      evidencePoints: [
        {
          imei: "unit-a",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    expect(result.status).toBe("pendiente_evidencia");
    const decision = result.ledgerSteps.find((s) => s.step === "decision");
    expect(decision?.details).toMatchObject({ reason: "observacion_insuficiente" });
  });

  it("no_cumplido normal cuando el origen sí se observó pero el match sigue bajo", () => {
    const result = verifyService({
      ...baseInput,
      evidencePoints: [
        {
          imei: "unit-a",
          latitude: 31.68,
          longitude: -106.43,
          timestamp: new Date("2026-07-07T12:40:00Z"),
        },
      ],
    });
    expect(result.status).toBe("no_cumplido");
  });

  it("respeta kmlOriginToleranceFraction configurado por contrato", () => {
    // El único punto está a mitad de ruta (fracción ~0.5) — con tolerancia
    // amplia (0.6) el motor sí se anima a juzgar no_cumplido.
    const result = verifyService({
      ...baseInput,
      kmlOriginToleranceFraction: 0.6,
      evidencePoints: [
        {
          imei: "unit-a",
          latitude: 31.68545,
          longitude: -106.4267,
          timestamp: new Date("2026-07-07T12:42:00Z"),
        },
      ],
    });
    expect(result.status).toBe("no_cumplido");
  });
});

describe("el match se califica sobre el tramo observable", () => {
  // 11 waypoints equiespaciados sobre una recta: fracciones 0, 0.1, ... 1.0.
  const waypoints = Array.from({ length: 11 }, (_, i) => ({
    lat: 31.68 + i * 0.00109,
    lng: -106.43 + i * 0.00066,
  }));
  const at = (i: number, minute: number) => ({
    imei: "unit-a",
    latitude: waypoints[i]!.lat,
    longitude: waypoints[i]!.lng,
    timestamp: new Date(`2026-07-07T12:${String(minute).padStart(2, "0")}:00Z`),
  });

  it("observableRouteSpan recorta el prefijo no observado y declara la fracción", () => {
    // Evidencia del waypoint 2 (fracción 0.2) en adelante.
    const points = [at(2, 30), at(5, 35), at(8, 40), at(10, 44)];
    const span = observableRouteSpan(points, waypoints, 0.12);
    expect(span.waypoints).toHaveLength(9);
    expect(span.fromFraction).toBeCloseTo(0.2, 2);
    expect(span.observableFraction).toBeCloseTo(0.8, 2);
  });

  it("sin prefijo perdido, el tramo observable es la ruta completa (regresión cero)", () => {
    const points = waypoints.map((_, i) => at(i, 30 + i));
    const span = observableRouteSpan(points, waypoints, 0.12);
    expect(span.waypoints).toHaveLength(waypoints.length);
    expect(span.observableFraction).toBe(1);
  });

  it("no cobra el prefijo no observado: un recorrido completo desde donde se ve da A alto", () => {
    // Se pierde el primer 20% (la ventana abrió tarde), pero de ahí en
    // adelante la unidad tocó TODOS los waypoints. Contra el KML completo
    // A sería ~82%; sobre el tramo observable es 100%.
    const points = waypoints.slice(2).map((_, i) => at(i + 2, 30 + i));
    const evaluation = evaluateUnitRouteMatch(points, {
      kmlWaypoints: waypoints,
      geofencePolygon: geofence,
      corridorKm: 0.12,
      minKmlPct: 60,
      minCorridorPct: 60,
      frechetMaxKm: 0.8,
    });
    expect(evaluation.routeMatchPct).toBe(100);
    expect(evaluation.observableFraction).toBeCloseTo(0.8, 2);
  });

  it("el umbral NO se afloja: huecos DENTRO del tramo observable siguen contando", () => {
    // Se pierde el mismo primer 20%, pero además la unidad se salta la
    // mitad del tramo que sí se observó — eso es un fallo real.
    const points = [at(2, 30), at(3, 32), at(9, 42), at(10, 44)];
    const evaluation = evaluateUnitRouteMatch(points, {
      kmlWaypoints: waypoints,
      geofencePolygon: geofence,
      corridorKm: 0.12,
      minKmlPct: 60,
      minCorridorPct: 60,
      frechetMaxKm: 0.8,
    });
    // 4 de los 9 waypoints observables ≈ 44% — por debajo del umbral de 60.
    expect(evaluation.routeMatchPct).toBeLessThan(60);
    expect(evaluation.servedRoute).toBe(false);
  });

  const baseInput = {
    occurrenceId: "occ-observable",
    expectedDeadline: new Date("2026-07-07T12:45:00Z"),
    toleranceMinutes: 5,
    routeStrictness: "kml_full" as const,
    geofencePolygon: geofence,
    excusableReasons: [] as const,
    kmlWaypoints: waypoints,
    kmlMatchMinPct: 60,
    kmlCorridorMinPct: 60,
  };

  it("verifyService declara observableFraction en el ledger, aparte del porcentaje", () => {
    const result = verifyService({
      ...baseInput,
      // El contrato tolera perder hasta 25% del arranque; aquí se perdió 20%.
      kmlOriginToleranceFraction: 0.25,
      evidencePoints: waypoints.slice(2).map((_, i) => at(i + 2, 30 + i)),
    });
    expect(result.status).toBe("cumplido");
    const decision = result.ledgerSteps.find((s) => s.step === "decision");
    expect(decision?.details).toMatchObject({ routeMatchPct: 100 });
    expect((decision?.details as { observableFraction: number }).observableFraction).toBeCloseTo(
      0.8,
      2,
    );
  });

  it("un tramo observable demasiado corto no acredita: cae a pendiente, no a cumplido inflado", () => {
    // Solo se vio el último waypoint. Sobre ese tramo A daría 100%, pero
    // acreditar con eso sería inventar evidencia que nadie observó.
    const result = verifyService({
      ...baseInput,
      evidencePoints: [at(10, 44)],
    });
    expect(result.status).toBe("pendiente_evidencia");
    expect(result.status).not.toBe("cumplido");
  });
});

describe("assessEvidenceCoverage", () => {
  const start = new Date("2026-07-09T10:00:00Z");
  const end = new Date("2026-07-09T11:00:00Z");

  it("sin puntos = insuficiente", () => {
    const a = assessEvidenceCoverage([], start, end);
    expect(a.sufficient).toBe(false);
    expect(a.coveragePct).toBe(0);
  });

  it("pings cada 2 min = suficiente", () => {
    const points: Date[] = [];
    for (let m = 0; m <= 60; m += 2) {
      points.push(new Date(start.getTime() + m * 60_000));
    }
    const a = assessEvidenceCoverage(points, start, end, {
      minCoveragePct: 80,
      maxGapMinutes: 10,
    });
    expect(a.sufficient).toBe(true);
    expect(a.coveragePct).toBe(100);
  });

  it("hueco de 20 min = insuficiente", () => {
    const points = [
      new Date("2026-07-09T10:00:00Z"),
      new Date("2026-07-09T10:05:00Z"),
      new Date("2026-07-09T10:25:00Z"),
      new Date("2026-07-09T10:30:00Z"),
      new Date("2026-07-09T11:00:00Z"),
    ];
    const a = assessEvidenceCoverage(points, start, end, {
      minCoveragePct: 80,
      maxGapMinutes: 10,
    });
    expect(a.sufficient).toBe(false);
    expect(a.maxGapMs).toBeGreaterThan(10 * 60_000);
  });

  it("coveredMs es coveragePct sin redondear", () => {
    const points = [
      new Date("2026-07-09T10:00:00Z"),
      new Date("2026-07-09T10:05:00Z"),
      new Date("2026-07-09T10:25:00Z"),
      new Date("2026-07-09T10:30:00Z"),
      new Date("2026-07-09T11:00:00Z"),
    ];
    const a = assessEvidenceCoverage(points, start, end, { maxGapMinutes: 10 });
    // El hueco de 20 min y el de 30 min no cuentan; sí los tramos de 5 min.
    expect(a.windowMs).toBe(60 * 60_000);
    expect(a.coveredMs).toBe(10 * 60_000);
    expect(a.coveredMs / a.windowMs * 100).toBeCloseTo(a.coveragePct, 10);
  });

  it("ventana sin puntos: coveredMs en cero, no en la ventana entera", () => {
    const a = assessEvidenceCoverage([], start, end);
    expect(a.coveredMs).toBe(0);
    expect(a.windowMs).toBe(60 * 60_000);
    expect(a.maxGapMs).toBe(60 * 60_000);
  });

  it("ventana de duración cero no divide entre cero", () => {
    const a = assessEvidenceCoverage([], start, start);
    expect(a.windowMs).toBe(0);
    expect(a.coveredMs).toBe(0);
    expect(a.coveragePct).toBe(100);
  });

  it("agregar ponderando por duración no es promediar porcentajes", () => {
    // Ventana corta con cobertura perfecta + ventana larga con la mitad.
    const corta = assessEvidenceCoverage(
      [new Date(start.getTime()), new Date(start.getTime() + 60_000)],
      start,
      new Date(start.getTime() + 60_000),
      { maxGapMinutes: 10 },
    );
    const larga = assessEvidenceCoverage(
      [
        new Date(start.getTime()),
        new Date(start.getTime() + 30 * 60_000),
        new Date(start.getTime() + 90 * 60_000),
      ],
      start,
      new Date(start.getTime() + 90 * 60_000),
      { maxGapMinutes: 40 },
    );
    const ponderada =
      ((corta.coveredMs + larga.coveredMs) / (corta.windowMs + larga.windowMs)) * 100;
    const promedioSimple = (corta.coveragePct + larga.coveragePct) / 2;
    // El promedio simple sobrevalora: la ventana corta pesa lo mismo que una
    // 90 veces más larga. Esta es justo la trampa que coveredMs evita.
    expect(promedioSimple).toBeGreaterThan(ponderada);
  });
});

describe("pointInPolygon", () => {
  it("detects point inside geofence", () => {
    expect(pointInPolygon({ lat: 31.6909, lng: -106.4234 }, geofence)).toBe(true);
  });

  it("detects point outside geofence", () => {
    expect(pointInPolygon({ lat: 31.7000, lng: -106.5000 }, geofence)).toBe(false);
  });
});

describe("determineTiming", () => {
  const deadline = new Date("2026-07-07T12:45:00Z");

  it("returns temprano when early beyond tolerance", () => {
    expect(determineTiming(new Date("2026-07-07T12:30:00Z"), deadline, 5)).toBe("temprano");
  });

  it("returns a_tiempo within tolerance", () => {
    expect(determineTiming(new Date("2026-07-07T12:48:00Z"), deadline, 5)).toBe("a_tiempo");
  });

  it("returns tarde when late beyond tolerance", () => {
    expect(determineTiming(new Date("2026-07-07T12:55:00Z"), deadline, 5)).toBe("tarde");
  });
});

describe("computeCorridorPrecisionPct", () => {
  it("returns 100 when all GPS points lie on the route", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const points = [
      { imei: "u1", latitude: 31.6800, longitude: -106.4300, timestamp: new Date() },
      { imei: "u1", latitude: 31.6909, longitude: -106.4234, timestamp: new Date() },
    ];
    expect(computeCorridorPrecisionPct(points, waypoints, 0.12)).toBe(100);
  });

  it("drops when most GPS points are outside the corridor", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const points = [
      { imei: "u1", latitude: 31.6800, longitude: -106.4300, timestamp: new Date() },
      { imei: "u1", latitude: 31.8, longitude: -106.5, timestamp: new Date() },
      { imei: "u1", latitude: 31.81, longitude: -106.51, timestamp: new Date() },
      { imei: "u1", latitude: 31.82, longitude: -106.52, timestamp: new Date() },
    ];
    expect(computeCorridorPrecisionPct(points, waypoints, 0.12)).toBe(25);
  });
});

describe("computeRouteMatchPct", () => {
  it("returns 100 when all waypoints covered", () => {
    const waypoints = [
      { lat: 31.6909, lng: -106.4234 },
      { lat: 31.6910, lng: -106.4230 },
    ];
    const points = [
      { imei: "u1", latitude: 31.6909, longitude: -106.4234, timestamp: new Date() },
      { imei: "u1", latitude: 31.6910, longitude: -106.4230, timestamp: new Date() },
    ];
    expect(computeRouteMatchPct(points, waypoints, 0.12)).toBe(100);
  });
});

describe("Fase 3 TF-IDF / Fréchet / dirección", () => {
  const shared = [
    { lat: 31.68, lng: -106.43 },
    { lat: 31.685, lng: -106.428 },
  ];
  const uniqueA = [
    ...shared,
    { lat: 31.69, lng: -106.42 },
    { lat: 31.695, lng: -106.415 },
  ];
  const uniqueB = [
    ...shared,
    { lat: 31.70, lng: -106.44 },
    { lat: 31.705, lng: -106.445 },
  ];

  it("gives rare segments higher IDF than shared avenues", () => {
    const idf = buildSegmentIdf([uniqueA, uniqueB]);
    const sharedKey = segmentKey(shared[0]!, shared[1]!);
    const rareKey = segmentKey(uniqueA[2]!, uniqueA[3]!);
    expect(idf.get(rareKey)!).toBeGreaterThan(idf.get(sharedKey)!);
  });

  it("weights unique colony segments higher than shared avenue", () => {
    const idf = buildSegmentIdf([uniqueA, uniqueB]);
    // GPS only on unique tip of A
    const points = uniqueA.slice(2).map((wp, i) => ({
      imei: "u",
      latitude: wp.lat,
      longitude: wp.lng,
      timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
    }));
    const weighted = computeWeightedRouteMatchPct(points, uniqueA, idf, 0.12);
    const uniform = computeRouteMatchPct(points, uniqueA, 0.12);
    // Con peso, cubrir solo el tramo raro aporta más % relativo que uniforme puro
    // (ambos <100, pero weighted no colapsa tanto por no tocar avenida compartida).
    expect(weighted).toBeGreaterThan(0);
    expect(uniform).toBeGreaterThan(0);
    expect(weighted).toBeGreaterThanOrEqual(uniform);
  });

  it("Fréchet is small for similar shape and large when reversed far away", () => {
    const kml = uniqueA;
    const similar = uniqueA.map((wp) => ({
      lat: wp.lat + 0.0001,
      lng: wp.lng + 0.0001,
    }));
    const far = uniqueA.map((wp) => ({
      lat: wp.lat + 0.05,
      lng: wp.lng + 0.05,
    }));
    expect(discreteFrechetKm(similar, kml)).toBeLessThan(0.05);
    expect(discreteFrechetKm(far, kml)).toBeGreaterThan(1);
  });

  it("directionSimilarity is high for same bearing and low for opposite", () => {
    const waypoints = [
      { lat: 31.68, lng: -106.43 },
      { lat: 31.69, lng: -106.42 },
      { lat: 31.70, lng: -106.41 },
    ];
    const sameDir = waypoints.map((wp, i) => ({
      imei: "u",
      latitude: wp.lat,
      longitude: wp.lng,
      timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
    }));
    const opposite = [...waypoints].reverse().map((wp, i) => ({
      imei: "u",
      latitude: wp.lat,
      longitude: wp.lng,
      timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
    }));
    expect(directionSimilarity(sameDir, waypoints)).toBeGreaterThan(0.8);
    expect(directionSimilarity(opposite, waypoints)).toBeLessThan(0.3);
  });

  it("uses TF-IDF corpus to prefer the route whose unique tip was driven", () => {
    const geofence = [
      { lat: 31.694, lng: -106.416 },
      { lat: 31.696, lng: -106.416 },
      { lat: 31.696, lng: -106.414 },
      { lat: 31.694, lng: -106.414 },
    ];
    const points = [
      ...uniqueA.map((wp, i) => ({
        imei: "unit-a",
        latitude: wp.lat,
        longitude: wp.lng,
        timestamp: new Date(`2026-07-07T12:${30 + i}:00Z`),
      })),
    ];
    const result = verifyService({
      occurrenceId: "occ-tfidf",
      expectedDeadline: new Date("2026-07-07T13:00:00Z"),
      toleranceMinutes: 15,
      routeStrictness: "kml_full",
      kmlMatchMinPct: 40,
      kmlCorridorMinPct: 40,
      kmlCorridorMeters: 150,
      frechetMaxKm: 2,
      geofencePolygon: geofence,
      kmlWaypoints: uniqueA,
      routeCorpus: [uniqueA, uniqueB],
      evidencePoints: points,
      excusableReasons: [],
    });
    expect(result.status).toBe("cumplido");
    expect(result.observedUnitId).toBe("unit-a");
    expect(result.candidateUnits[0]?.frechetKm).toBeLessThan(0.5);
  });
});

describe("Modo Rutas — destino_only", () => {
  const baseDestinoOnly = {
    occurrenceId: "occ-do",
    expectedDeadline: new Date("2026-07-07T12:45:00Z"),
    toleranceMinutes: 5,
    routeStrictness: "destino_only" as const,
    geofencePolygon: geofence,
    excusableReasons: [] as const,
  };

  const kmlWaypoints = [
    { lat: 31.6800, lng: -106.4300 },
    { lat: 31.6850, lng: -106.4280 },
    { lat: 31.6909, lng: -106.4234 },
  ];

  it("cumplido: unidad llega a geocerca y cubre mínimo de ruta", () => {
    // GPS sigue el KML y llega a la geocerca destino
    const result = verifyService({
      ...baseDestinoOnly,
      kmlWaypoints,
      kmlMatchMinPct: 40,
      kmlCorridorMinPct: 40,
      kmlCorridorMeters: 150,
      evidencePoints: kmlWaypoints.map((wp, i) => ({
        imei: "unit-1",
        latitude: wp.lat,
        longitude: wp.lng,
        timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
      })),
    });
    expect(result.status).toBe("cumplido");
    expect(result.observedUnitId).toBe("unit-1");
    expect(result.routeStrictnessApplied).toBe("destino_only");
  });

  it("pendiente_evidencia: unidad llega a geocerca pero recorrido no alcanza mínimo de ninguna ruta", () => {
    // Unidad llega al destino pero su recorrido por la ruta es 0% (no cubrió waypoints)
    const farWaypoints = [
      { lat: 31.6500, lng: -106.4500 },
      { lat: 31.6600, lng: -106.4400 },
      { lat: 31.6700, lng: -106.4350 },
    ];
    const result = verifyService({
      ...baseDestinoOnly,
      kmlWaypoints: farWaypoints,
      kmlMatchMinPct: 60,
      kmlCorridorMinPct: 60,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    // Llegó a la geocerca pero no puede atribuirse a esta ruta → pendiente, no no_cumplido
    expect(result.status).toBe("pendiente_evidencia");
    expect(result.observedUnitId).toBeNull();
    // Confirma que el ledger documenta el motivo correcto
    const decision = result.ledgerSteps.find((s) => s.step === "decision");
    expect(decision?.result).toBe("pendiente_evidencia");
    expect(decision?.details).toHaveProperty("reason", "llegada_sin_atribucion");
  });

  it("no_cumplido: ninguna unidad llegó a la geocerca (sin señal de servicio)", () => {
    const windowStart = new Date("2026-07-07T11:45:00Z");
    const windowEnd = new Date("2026-07-07T12:50:00Z");
    // GPS con cobertura suficiente pero lejos de la geocerca
    const points = [];
    for (let m = 0; m <= 65; m += 2) {
      points.push({
        imei: "unit-1",
        latitude: 31.8,
        longitude: -106.5,
        timestamp: new Date(windowStart.getTime() + m * 60_000),
      });
    }
    const result = verifyService({
      ...baseDestinoOnly,
      kmlWaypoints,
      coverageWindowStart: windowStart,
      coverageWindowEnd: windowEnd,
      evidenceMinCoveragePct: 80,
      evidenceMaxGapMinutes: 10,
      evidencePoints: points,
    });
    // De verdad no hubo servicio — ninguna unidad llegó
    expect(result.status).toBe("no_cumplido");
    expect(result.observedUnitId).toBeNull();
  });

  it("el destino solo nunca acredita cumplido sin recorrido mínimo", () => {
    // Contrato destino_only pero con umbral de ruta que la unidad no cumple
    const result = verifyService({
      ...baseDestinoOnly,
      kmlWaypoints,
      kmlMatchMinPct: 90,
      kmlCorridorMinPct: 90,
      evidencePoints: [
        // Solo llega al último waypoint (destino), no cubre 90% de la ruta
        {
          imei: "unit-1",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    // Llegó pero no cubre → pendiente (nunca cumplido sin recorrido)
    expect(result.status).toBe("pendiente_evidencia");
    expect(result.status).not.toBe("cumplido");
  });

  it("kml_full con misma situación sigue dando no_cumplido (no pendiente)", () => {
    // Misma situación que arriba pero con kml_full → no_cumplido (no pendiente)
    const farWaypoints = [
      { lat: 31.6500, lng: -106.4500 },
      { lat: 31.6600, lng: -106.4400 },
      { lat: 31.6700, lng: -106.4350 },
    ];
    const result = verifyService({
      ...baseDestinoOnly,
      routeStrictness: "kml_full",
      kmlWaypoints: farWaypoints,
      kmlMatchMinPct: 60,
      kmlCorridorMinPct: 60,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    // En kml_full: si no cubrió la ruta → no_cumplido directamente
    expect(result.status).toBe("no_cumplido");
  });
});

describe("evaluateUnitRouteMatch (identificación unidad↔ruta compartida)", () => {
  const params = {
    geofencePolygon: geofence,
    corridorKm: 0.12,
    minKmlPct: 60,
    minCorridorPct: 60,
    frechetMaxKm: 0.8,
    idf: null,
  };

  it("marca servedRoute cuando la unidad llega a la geocerca (sin KML)", () => {
    const evalRes = evaluateUnitRouteMatch(
      [
        {
          imei: "u",
          latitude: 31.6909,
          longitude: -106.4234,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
      params,
    );
    expect(evalRes.arrivalAt).not.toBeNull();
    expect(evalRes.servedRoute).toBe(true);
    expect(evalRes.routeMatchPct).toBe(100);
  });

  it("no marca servedRoute si nunca entra a la geocerca", () => {
    const evalRes = evaluateUnitRouteMatch(
      [
        {
          imei: "u",
          latitude: 31.5,
          longitude: -106.5,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
      params,
    );
    expect(evalRes.arrivalAt).toBeNull();
    expect(evalRes.servedRoute).toBe(false);
  });

  it("es la MISMA matemática que verifyService (mismos A/B/arrival/servedRoute)", () => {
    // Prueba de no-divergencia: el árbitro y la torre deben obtener idéntica
    // evaluación por unidad. Si esto se rompe, hay una segunda implementación.
    const kml = [
      { lat: 31.68, lng: -106.43 },
      { lat: 31.685, lng: -106.4265 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    const points = kml.map((wp, i) => ({
      imei: "unit-1",
      latitude: wp.lat,
      longitude: wp.lng,
      timestamp: new Date(`2026-07-07T12:${40 + i}:00Z`),
    }));
    const input = {
      occurrenceId: "occ-shared",
      expectedDeadline: new Date("2026-07-07T12:45:00Z"),
      toleranceMinutes: 15,
      routeStrictness: "kml_full" as const,
      kmlMatchMinPct: 40,
      kmlCorridorMinPct: 40,
      kmlCorridorMeters: 150,
      geofencePolygon: geofence,
      kmlWaypoints: kml,
      evidencePoints: points,
      excusableReasons: [] as const,
    };
    const result = verifyService(input);
    const corridorKm = Math.min(0.5, Math.max(0.01, 150 / 1000));
    const evalRes = evaluateUnitRouteMatch(points, {
      geofencePolygon: geofence,
      kmlWaypoints: kml,
      corridorKm,
      minKmlPct: 40,
      minCorridorPct: 40,
      frechetMaxKm: 0.8,
      idf: null,
    });
    const candidate = result.candidateUnits.find((c) => c.unitId === "unit-1")!;
    expect(evalRes.routeMatchPct).toBe(candidate.routeMatchPct);
    expect(evalRes.corridorPrecisionPct).toBe(candidate.corridorPrecisionPct);
    expect(evalRes.servedRoute).toBe(candidate.servedRoute);
    expect(evalRes.arrivalAt?.getTime() ?? null).toBe(
      candidate.arrivalAt?.getTime() ?? null,
    );
  });
});
