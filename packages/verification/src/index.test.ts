import { describe, it, expect } from "vitest";
import {
  verifyService,
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

  it("rejects geofence-only arrival when KML match is too low", () => {
    const waypoints = [
      { lat: 31.6500, lng: -106.4500 },
      { lat: 31.6600, lng: -106.4400 },
      { lat: 31.6700, lng: -106.4350 },
    ];
    const result = verifyService({
      ...baseInput,
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

  it("rejects high route coverage A when corridor precision B is low", () => {
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

  it("honors configurable kmlMatchMinPct threshold", () => {
    const waypoints = [
      { lat: 31.6800, lng: -106.4300 },
      { lat: 31.6850, lng: -106.4280 },
      { lat: 31.6909, lng: -106.4234 },
    ];
    // Solo cubre 1 de 3 waypoints (~33%)
    const points = [
      {
        imei: "unit-a",
        latitude: 31.6909,
        longitude: -106.4234,
        timestamp: new Date("2026-07-07T12:44:00Z"),
      },
    ];
    const fail = verifyService({
      ...baseInput,
      kmlMatchMinPct: 60,
      kmlCorridorMinPct: 0,
      kmlWaypoints: waypoints,
      evidencePoints: points,
    });
    expect(fail.status).toBe("no_cumplido");

    const pass = verifyService({
      ...baseInput,
      kmlMatchMinPct: 30,
      kmlCorridorMinPct: 0,
      kmlWaypoints: waypoints,
      evidencePoints: points,
    });
    expect(pass.status).toBe("cumplido");
    expect(pass.observedRouteMatchPct).toBeCloseTo(100 / 3, 5);
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
