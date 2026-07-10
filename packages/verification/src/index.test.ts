import { describe, it, expect } from "vitest";
import {
  verifyService,
  pointInPolygon,
  determineTiming,
  computeRouteMatchPct,
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

  it("returns no_cumplido when late beyond tolerance", () => {
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
    expect(result.status).toBe("no_cumplido");
    expect(result.timing).toBe("tarde");
  });

  it("returns no_cumplido when no unit serves route", () => {
    const result = verifyService({
      ...baseInput,
      evidencePoints: [
        {
          imei: "unit-1",
          latitude: 31.8000,
          longitude: -106.5000,
          timestamp: new Date("2026-07-07T12:44:00Z"),
        },
      ],
    });
    expect(result.status).toBe("no_cumplido");
    expect(result.observedUnitId).toBeNull();
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
    expect(computeRouteMatchPct(points, waypoints)).toBe(100);
  });
});
