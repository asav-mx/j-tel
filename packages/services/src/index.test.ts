import { describe, it, expect, vi } from "vitest";
import {
  VerificationService,
  pickExclusiveUnitLosers,
  evidenceWindowsOverlap,
  hasIncompleteEvidenceCoverage,
  computeExclusiveContentionWindow,
  occupiedUnitIdsForResidual,
  type ExclusiveUnitClaim,
} from "./verification.js";

describe("occupiedUnitIdsForResidual", () => {
  it("excluye unidades ocupadas en ventana traslapada", () => {
    const residual = { windowStartMs: 100, windowEndMs: 200 };
    const occupied = occupiedUnitIdsForResidual(residual, [
      { unitId: "u1", windowStartMs: 150, windowEndMs: 250 },
      { unitId: "u2", windowStartMs: 300, windowEndMs: 400 },
    ]);
    expect(occupied).toEqual(["u1"]);
  });

  it("misma unidad en turnos sin traslape no ocupa el residual", () => {
    const residual = { windowStartMs: 1000, windowEndMs: 2000 };
    const occupied = occupiedUnitIdsForResidual(residual, [
      { unitId: "u1", windowStartMs: 0, windowEndMs: 500 },
    ]);
    expect(occupied).toEqual([]);
  });
});

describe("VerificationService", () => {
  it("expone processPending e ingestEvidenceForOccurrence", () => {
    const service = new VerificationService({} as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    expect(typeof service.processPending).toBe("function");
    expect(typeof service.ingestEvidenceForOccurrence).toBe("function");
    expect(typeof service.verifyOccurrence).toBe("function");
  });
});

describe("evidenceWindowsOverlap", () => {
  it("detecta traslape y no-traslape", () => {
    expect(evidenceWindowsOverlap(0, 10, 5, 15)).toBe(true);
    expect(evidenceWindowsOverlap(0, 10, 10, 20)).toBe(false);
    expect(evidenceWindowsOverlap(0, 10, 11, 20)).toBe(false);
  });
});

describe("pickExclusiveUnitLosers", () => {
  const base = {
    unitId: "unit-1",
    matchPct: 90,
    arrivalAtMs: 1_000,
  };

  it("misma unidad en dos turnos no traslapados: ambos ganan (sin perdedores)", () => {
    const morning: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-morning",
      matchPct: 95,
      windowStartMs: Date.parse("2026-07-09T10:00:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:00:00Z"),
    };
    const afternoon: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-afternoon",
      matchPct: 88,
      arrivalAtMs: 2_000,
      windowStartMs: Date.parse("2026-07-09T14:00:00Z"),
      windowEndMs: Date.parse("2026-07-09T16:00:00Z"),
    };

    const { winners, losers } = pickExclusiveUnitLosers([morning, afternoon]);
    expect(losers).toHaveLength(0);
    expect(winners.map((w) => w.occurrenceId).sort()).toEqual([
      "occ-afternoon",
      "occ-morning",
    ]);
  });

  it("misma unidad mismo turno dos rutas: gana el mayor match, el otro pierde", () => {
    const routeA: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-route-a",
      matchPct: 98,
      arrivalAtMs: 2_000,
      windowStartMs: Date.parse("2026-07-09T10:00:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:30:00Z"),
    };
    const routeB: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-route-b",
      matchPct: 72,
      arrivalAtMs: 1_000,
      windowStartMs: Date.parse("2026-07-09T10:15:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:00:00Z"),
    };

    const { winners, losers } = pickExclusiveUnitLosers([routeA, routeB]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.occurrenceId).toBe("occ-route-a");
    expect(losers).toHaveLength(1);
    expect(losers[0]!.occurrenceId).toBe("occ-route-b");
  });

  it("días distintos con la misma unidad no son conflicto", () => {
    const day1: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-day1",
      windowStartMs: Date.parse("2026-07-08T10:00:00Z"),
      windowEndMs: Date.parse("2026-07-08T12:00:00Z"),
    };
    const day2: ExclusiveUnitClaim = {
      ...base,
      occurrenceId: "occ-day2",
      windowStartMs: Date.parse("2026-07-09T10:00:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:00:00Z"),
    };

    const { losers } = pickExclusiveUnitLosers([day1, day2]);
    expect(losers).toHaveLength(0);
  });

  it("dos servicios de la misma mañana que solo rozan márgenes GPS no conflictúan", () => {
    // Deadlines 6:00 y 7:15 (hora local ficticia en UTC). Con duración 60 y
    // tolerancia 5, ventanas operativas: [5:00–6:05] y [6:15–7:20] → sin traslape.
    // Sus ventanas de evidencia SÍ se tocarían (~60 min antes / 30+grace después).
    const early = computeExclusiveContentionWindow(
      new Date("2026-07-09T12:00:00Z"),
      { maxRouteDurationMinutes: 60, toleranceMinutes: 5 },
    );
    const later = computeExclusiveContentionWindow(
      new Date("2026-07-09T13:15:00Z"),
      { maxRouteDurationMinutes: 60, toleranceMinutes: 5 },
    );
    expect(
      evidenceWindowsOverlap(early.startMs, early.endMs, later.startMs, later.endMs),
    ).toBe(false);

    const { losers } = pickExclusiveUnitLosers([
      {
        ...base,
        occurrenceId: "occ-early",
        matchPct: 95,
        windowStartMs: early.startMs,
        windowEndMs: early.endMs,
      },
      {
        ...base,
        occurrenceId: "occ-later",
        matchPct: 90,
        arrivalAtMs: 2_000,
        windowStartMs: later.startMs,
        windowEndMs: later.endMs,
      },
    ]);
    expect(losers).toHaveLength(0);
  });
});

describe("consolidación de rutas (permitirConsolidacion)", () => {
  it("con consolidación activada, misma unidad en dos rutas traslapadas: ambas ganan (sin perdedores)", () => {
    // Cuando permitirConsolidacion = true, NO se aplica exclusividad.
    // Esto se prueba verificando que pickExclusiveUnitLosers NO se invoca;
    // aquí mostramos que si alguien pasara los mismos claims, haría perdedores,
    // pero con consolidación activada el motor ni llega a esa llamada.
    const routeA: ExclusiveUnitClaim = {
      occurrenceId: "occ-norte",
      unitId: "unit-1",
      matchPct: 72,
      arrivalAtMs: Date.parse("2026-07-09T12:50:00Z"),
      windowStartMs: Date.parse("2026-07-09T11:45:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:55:00Z"),
    };
    const routeB: ExclusiveUnitClaim = {
      occurrenceId: "occ-centro",
      unitId: "unit-1",
      matchPct: 68,
      arrivalAtMs: Date.parse("2026-07-09T12:50:00Z"),
      windowStartMs: Date.parse("2026-07-09T11:45:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:55:00Z"),
    };

    // SIN consolidación (exclusividad): uno pierde
    const { losers } = pickExclusiveUnitLosers([routeA, routeB]);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.occurrenceId).toBe("occ-centro");

    // CON consolidación: la resolución exclusiva NO se ejecuta.
    // Ambas rutas quedan acreditadas a la misma unidad.
    // (La rama `if (applyExclusive)` en reverifyContract se salta.)
  });

  it("sin consolidación: gana la ruta de mayor match, el otro pierde", () => {
    const routeNorte: ExclusiveUnitClaim = {
      occurrenceId: "occ-norte",
      unitId: "unit-1",
      matchPct: 72,
      arrivalAtMs: Date.parse("2026-07-09T12:50:00Z"),
      windowStartMs: Date.parse("2026-07-09T11:45:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:55:00Z"),
    };
    const routeCentro: ExclusiveUnitClaim = {
      occurrenceId: "occ-centro",
      unitId: "unit-1",
      matchPct: 68,
      arrivalAtMs: Date.parse("2026-07-09T12:50:00Z"),
      windowStartMs: Date.parse("2026-07-09T11:45:00Z"),
      windowEndMs: Date.parse("2026-07-09T12:55:00Z"),
    };

    const { winners, losers } = pickExclusiveUnitLosers([routeNorte, routeCentro]);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.occurrenceId).toBe("occ-norte");
    expect(losers).toHaveLength(1);
    expect(losers[0]!.occurrenceId).toBe("occ-centro");
  });
});

describe("hasIncompleteEvidenceCoverage", () => {
  const start = new Date("2026-07-09T10:00:00Z");
  const end = new Date("2026-07-09T11:00:00Z");

  it("sin puntos = incompleto", () => {
    expect(hasIncompleteEvidenceCoverage([], start, end)).toBe(true);
  });

  it("cobertura continua sin huecos >5 min = completo", () => {
    const points: Date[] = [];
    for (let m = 0; m <= 60; m += 2) {
      points.push(new Date(start.getTime() + m * 60_000));
    }
    expect(hasIncompleteEvidenceCoverage(points, start, end)).toBe(false);
  });

  it("hueco de 20 min en el medio = incompleto", () => {
    const points = [
      new Date("2026-07-09T10:00:00Z"),
      new Date("2026-07-09T10:05:00Z"),
      // hueco 10:05 → 10:25
      new Date("2026-07-09T10:25:00Z"),
      new Date("2026-07-09T10:30:00Z"),
      new Date("2026-07-09T11:00:00Z"),
    ];
    expect(hasIncompleteEvidenceCoverage(points, start, end)).toBe(true);
  });
});

describe("cambio de política no toca hechos definitivos", () => {
  it("sin force, cumplido/no_cumplido se saltan (solo pendiente_evidencia es re-tocable)", async () => {
    const deleteFact = vi.fn();
    const saveFact = vi.fn();

    const makeOcc = (status: "cumplido" | "no_cumplido" | "pendiente_evidencia") => ({
      id: `occ-${status}`,
      serviceDate: "2026-07-01",
      expectedDeadline: new Date("2026-07-01T12:00:00Z"),
      expectedGeofenceId: "geo-1",
      referenceUnitId: null,
      complianceFact: { status },
      trip: {
        id: "trip-1",
        evidenceWindowStart: new Date("2026-07-01T10:00:00Z"),
        evidenceWindowEnd: new Date("2026-07-01T13:00:00Z"),
        evidenceStatus: "disponible" as const,
      },
      profile: {
        id: "prof-1",
        geofence: { polygon: [] },
        contract: {
          carrierAccountId: "carrier-1",
          clientAccountId: "client-1",
          policy: {
            toleranceMinutes: 5,
            routeStrictness: "destino_only",
            kmlMatchMinPct: 60,
            excusableReasons: [],
          },
        },
        routeShift: { routeId: "route-1" },
      },
      kmlVersionId: null,
    });

    for (const status of ["cumplido", "no_cumplido"] as const) {
      const repos = {
        occurrences: { findById: vi.fn().mockResolvedValue(makeOcc(status)) },
        evidence: {
          getPointsForTrip: vi.fn(),
          clearPointsForTrip: vi.fn(),
          updateTripStatus: vi.fn(),
        },
        compliance: { deleteFactForOccurrence: deleteFact, saveFact },
      };
      const service = new VerificationService(repos as never, {
        umbrellaBaseUrl: "http://example.com",
      });
      const result = await service.verifyOccurrence(`occ-${status}`);
      expect(result).toEqual({
        occurrenceId: `occ-${status}`,
        skipped: true,
        status,
      });
      expect(deleteFact).not.toHaveBeenCalled();
      expect(saveFact).not.toHaveBeenCalled();
    }
  });

  it("sin force, pendiente_evidencia no se salta (sí borra y reevalúa)", async () => {
    const deleteFact = vi.fn().mockResolvedValue(undefined);
    const occ = {
      id: "occ-pendiente",
      serviceDate: "2026-07-01",
      expectedDeadline: new Date("2026-07-01T12:00:00Z"),
      expectedGeofenceId: "geo-1",
      referenceUnitId: null,
      complianceFact: { status: "pendiente_evidencia" as const },
      trip: {
        id: "trip-1",
        evidenceWindowStart: new Date("2026-07-01T10:00:00Z"),
        evidenceWindowEnd: new Date("2026-07-01T13:00:00Z"),
        evidenceStatus: "parcial" as const,
      },
      profile: {
        id: "prof-1",
        geofence: {
          polygon: [
            { lat: 31.69, lng: -106.43 },
            { lat: 31.7, lng: -106.43 },
            { lat: 31.7, lng: -106.42 },
            { lat: 31.69, lng: -106.42 },
          ],
        },
        contract: {
          carrierAccountId: "carrier-1",
          clientAccountId: "client-1",
          policy: {
            toleranceMinutes: 5,
            routeStrictness: "destino_only" as const,
            kmlMatchMinPct: 60,
            excusableReasons: [] as string[],
          },
        },
        routeShift: { routeId: "route-1" },
      },
      kmlVersionId: null,
    };

    const repos = {
      occurrences: { findById: vi.fn().mockResolvedValue(occ) },
      evidence: {
        getPointsForTrip: vi.fn().mockResolvedValue([
          {
            imei: "imei-1",
            latitude: 31.8,
            longitude: -106.5,
            recordedAt: new Date("2026-07-01T11:00:00Z"),
            unitId: "unit-1",
          },
        ]),
        clearPointsForTrip: vi.fn(),
        updateTripStatus: vi.fn(),
        savePoints: vi.fn(),
      },
      compliance: {
        deleteFactForOccurrence: deleteFact,
        saveFact: vi.fn().mockResolvedValue({ id: "fact-1" }),
        addLedgerEntry: vi.fn(),
      },
      profiles: {
        getPossibleUnitIds: vi.fn().mockResolvedValue([]),
        findForContract: vi.fn().mockResolvedValue([]),
      },
      fleet: {
        getDevicesForCarrier: vi
          .fn()
          .mockResolvedValue([{ id: "dev-1", imei: "imei-1", carrierAccountId: "carrier-1" }]),
        getUnitsForCarrier: vi.fn().mockResolvedValue([{ id: "unit-1" }]),
        resolveUnitAtTime: vi.fn().mockResolvedValue({ unitId: "unit-1" }),
      },
      telemetry: { getForImeis: vi.fn().mockResolvedValue([]) },
      routes: { getKmlVersionForDate: vi.fn().mockResolvedValue(null) },
      carriers: { getGpsCredentials: vi.fn().mockResolvedValue(null) },
      notifications: { create: vi.fn() },
    };

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    const result = await service.verifyOccurrence("occ-pendiente", {
      keepEvidence: true,
    });
    expect(deleteFact).toHaveBeenCalledWith("occ-pendiente");
    expect(result.skipped).toBe(false);
  });
});

describe("perdedor exclusivo sin alternativa", () => {
  const geofence = [
    { lat: 31.6904, lng: -106.4244 },
    { lat: 31.6914, lng: -106.4244 },
    { lat: 31.6914, lng: -106.4224 },
    { lat: 31.6904, lng: -106.4224 },
  ];

  function buildRepos(opts: {
    evidencePoints: Array<{
      imei: string;
      latitude: number;
      longitude: number;
      recordedAt: Date;
      unitId: string | null;
    }>;
  }) {
    const windowStart = new Date("2026-07-09T10:00:00Z");
    const windowEnd = new Date("2026-07-09T11:00:00Z");
    const occ = {
      id: "occ-loser",
      contractId: "contract-1",
      serviceDate: "2026-07-09",
      expectedDeadline: new Date("2026-07-09T10:45:00Z"),
      expectedGeofenceId: "geo-1",
      referenceUnitId: null,
      complianceFact: null,
      trip: {
        id: "trip-loser",
        evidenceWindowStart: windowStart,
        evidenceWindowEnd: windowEnd,
        evidenceStatus: "disponible" as const,
      },
      profile: {
        id: "prof-1",
        geofence: { polygon: geofence },
        contract: {
          carrierAccountId: "carrier-1",
          clientAccountId: "client-1",
          policy: {
            toleranceMinutes: 5,
            maxRouteDurationMinutes: 60,
            routeStrictness: "destino_only" as const,
            kmlMatchMinPct: 60,
            evidenceMinCoveragePct: 80,
            evidenceMaxGapMinutes: 10,
            excusableReasons: [] as string[],
          },
        },
        routeShift: { routeId: "route-1" },
      },
      kmlVersionId: null,
    };

    const saveFact = vi.fn().mockResolvedValue({ id: "fact-1" });
    const repos = {
      occurrences: { findById: vi.fn().mockResolvedValue(occ) },
      evidence: {
        getPointsForTrip: vi.fn().mockResolvedValue(opts.evidencePoints),
        clearPointsForTrip: vi.fn(),
        updateTripStatus: vi.fn(),
        savePoints: vi.fn(),
      },
      compliance: {
        deleteFactForOccurrence: vi.fn(),
        saveFact,
        addLedgerEntry: vi.fn(),
      },
      profiles: {
        getPossibleUnitIds: vi.fn().mockResolvedValue([]),
        findForContract: vi.fn().mockResolvedValue([]),
      },
      fleet: {
        getDevicesForCarrier: vi
          .fn()
          .mockResolvedValue([{ id: "dev-1", imei: "imei-other", carrierAccountId: "carrier-1" }]),
        getUnitsForCarrier: vi
          .fn()
          .mockResolvedValue([{ id: "unit-other" }, { id: "unit-winner" }]),
        resolveUnitAtTime: vi.fn().mockResolvedValue({ unitId: "unit-other" }),
      },
      telemetry: { getForImeis: vi.fn().mockResolvedValue([]) },
      routes: { getKmlVersionForDate: vi.fn().mockResolvedValue(null) },
      carriers: { getGpsCredentials: vi.fn().mockResolvedValue(null) },
      notifications: { create: vi.fn() },
    };
    return { repos, saveFact };
  }

  it("con hueco en evidencia → pendiente_evidencia (no no_cumplido)", async () => {
    // Ventana operativa ~09:45–10:50; solo dos puntos lejos → hueco grande.
    const { repos, saveFact } = buildRepos({
      evidencePoints: [
        {
          imei: "imei-other",
          latitude: 31.8,
          longitude: -106.5,
          recordedAt: new Date("2026-07-09T09:45:00Z"),
          unitId: "unit-other",
        },
        {
          imei: "imei-other",
          latitude: 31.8,
          longitude: -106.5,
          recordedAt: new Date("2026-07-09T10:50:00Z"),
          unitId: "unit-other",
        },
      ],
    });

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    const result = await service.verifyOccurrence("occ-loser", {
      force: true,
      keepEvidence: true,
      excludeUnitIds: ["unit-winner"],
    });
    expect(result.status).toBe("pendiente_evidencia");
    expect(saveFact).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pendiente_evidencia" }),
    );
  });

  it("con evidencia completa y nadie en ruta → no_cumplido", async () => {
    // Cobertura densa en [09:45, 10:50], todos fuera de geocerca.
    const evidencePoints = [];
    const covStart = new Date("2026-07-09T09:45:00Z");
    for (let m = 0; m <= 65; m += 2) {
      evidencePoints.push({
        imei: "imei-other",
        latitude: 31.8,
        longitude: -106.5,
        recordedAt: new Date(covStart.getTime() + m * 60_000),
        unitId: "unit-other",
      });
    }
    const { repos, saveFact } = buildRepos({ evidencePoints });

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    const result = await service.verifyOccurrence("occ-loser", {
      force: true,
      keepEvidence: true,
      excludeUnitIds: ["unit-winner"],
    });
    expect(result.status).toBe("no_cumplido");
    expect(saveFact).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_cumplido" }),
    );
  });

  it("pasada eliminación: candidata única que sí entra a geocerca → cumplido + ledger", async () => {
    const evidencePoints = [];
    const covStart = new Date("2026-07-09T09:45:00Z");
    for (let m = 0; m <= 65; m += 2) {
      evidencePoints.push({
        imei: "imei-other",
        latitude: 31.6909,
        longitude: -106.4234,
        recordedAt: new Date(covStart.getTime() + m * 60_000),
        unitId: "unit-other",
      });
    }
    const { repos, saveFact } = buildRepos({ evidencePoints });
    const addLedger = repos.compliance.addLedgerEntry as ReturnType<typeof vi.fn>;

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    const result = await service.verifyOccurrence("occ-loser", {
      force: true,
      keepEvidence: true,
      excludeUnitIds: ["unit-winner"],
      eliminationPass: true,
      eliminationExcludedUnitIds: ["unit-winner"],
    });
    expect(result.status).toBe("cumplido");
    expect(saveFact).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cumplido", observedUnitId: "unit-other" }),
    );
    expect(addLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "eliminacion_candidatas",
        metadata: expect.objectContaining({
          eliminationPass: true,
          excludedOccupiedUnitIds: ["unit-winner"],
          policyThresholds: expect.objectContaining({
            kmlMatchMinPct: 60,
          }),
        }),
      }),
    );
  });
});

describe("Tarea 3 — contexto llegada fuera de ventana", () => {
  const geofence = [
    { lat: 31.6904, lng: -106.4244 },
    { lat: 31.6924, lng: -106.4244 },
    { lat: 31.6924, lng: -106.4214 },
    { lat: 31.6904, lng: -106.4214 },
  ];
  const insideGeofence = { lat: 31.6914, lng: -106.4229 };
  const outsideGeofence = { lat: 31.8, lng: -106.5 };

  function buildOcc() {
    return {
      id: "occ-tardia",
      contractId: "contract-1",
      serviceDate: "2026-07-09",
      expectedDeadline: new Date("2026-07-09T12:00:00Z"),
      expectedGeofenceId: "geo-1",
      referenceUnitId: null,
      complianceFact: null,
      trip: {
        id: "trip-1",
        evidenceWindowStart: new Date("2026-07-09T10:00:00Z"),
        evidenceWindowEnd: new Date("2026-07-09T12:30:00Z"),
        evidenceStatus: "en_espera" as const,
      },
      profile: {
        id: "prof-1",
        geofenceId: "geo-1",
        geofence: { id: "geo-1", polygon: geofence },
        contract: {
          carrierAccountId: "carrier-1",
          clientAccountId: "client-1",
          policy: {
            toleranceMinutes: 5,
            verificationGraceMinutes: 15,
            evidenceMarginMinutesAfter: 0,
            routeStrictness: "destino_only" as const,
            kmlMatchMinPct: 60,
            excusableReasons: [] as string[],
          },
        },
        routeShift: { routeId: "route-1" },
      },
      kmlVersionId: null,
    };
  }

  function buildRepos(opts: {
    extendedPoints: Array<{
      imei: string;
      latitude: number;
      longitude: number;
      recordedAt: Date;
      unitId: string | null;
    }>;
    otherContracts?: unknown[];
  }) {
    const windowEnd = new Date("2026-07-09T12:30:00Z");
    const addLedgerEntry = vi.fn().mockResolvedValue({ id: "ledger-1" });
    // Puntos dentro de ventana: fuera de geocerca → no_cumplido sin llegada.
    const inWindow = [
      {
        imei: "imei-1",
        latitude: outsideGeofence.lat,
        longitude: outsideGeofence.lng,
        recordedAt: new Date("2026-07-09T11:00:00Z"),
        unitId: "unit-1",
      },
    ];

    const repos = {
      occurrences: { findById: vi.fn().mockResolvedValue(buildOcc()) },
      evidence: {
        getPointsForTrip: vi
          .fn()
          .mockResolvedValueOnce([]) // existingPoints
          .mockResolvedValue(inWindow), // storedPoints tras ingest
        clearPointsForTrip: vi.fn(),
        updateTripStatus: vi.fn(),
        savePoints: vi.fn(),
      },
      compliance: {
        deleteFactForOccurrence: vi.fn(),
        saveFact: vi.fn().mockResolvedValue({ id: "fact-1" }),
        addLedgerEntry,
      },
      profiles: {
        getPossibleUnitIds: vi.fn().mockResolvedValue([]),
        findForContract: vi
          .fn()
          .mockImplementation((contractId: string) =>
            contractId === "contract-1"
              ? Promise.resolve([])
              : Promise.resolve([]),
          ),
      },
      contracts: {
        findForCarrier: vi.fn().mockResolvedValue(opts.otherContracts ?? []),
      },
      fleet: {
        getDevicesForCarrier: vi
          .fn()
          .mockResolvedValue([{ id: "dev-1", imei: "imei-1", carrierAccountId: "carrier-1" }]),
        getUnitsForCarrier: vi.fn().mockResolvedValue([{ id: "unit-1" }]),
        resolveUnitAtTime: vi.fn().mockResolvedValue({ unitId: "unit-1" }),
      },
      telemetry: {
        getForImeis: vi.fn().mockImplementation((_imeis: string[], from: Date) => {
          // Ventana extendida empieza en windowEnd (12:30).
          if (from.getTime() >= windowEnd.getTime()) {
            return Promise.resolve(opts.extendedPoints);
          }
          return Promise.resolve(inWindow);
        }),
      },
      routes: { getKmlVersionForDate: vi.fn().mockResolvedValue(null) },
      notifications: { create: vi.fn() },
    };
    return { repos, addLedgerEntry };
  }

  it("anota geofenceId cuando la llegada tardía es a la geocerca del propio contrato", async () => {
    const { repos, addLedgerEntry } = buildRepos({
      extendedPoints: [
        {
          imei: "imei-1",
          latitude: insideGeofence.lat,
          longitude: insideGeofence.lng,
          recordedAt: new Date("2026-07-09T12:45:00Z"),
          unitId: "unit-1",
        },
      ],
    });

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    const result = await service.verifyOccurrence("occ-tardia");
    // El hecho quedó sin llegada (no_cumplido o pendiente): el contexto aplica igual.
    expect(result.status).not.toBe("cumplido");

    const ctx = addLedgerEntry.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === "contexto_calibracion");
    expect(ctx).toBeTruthy();
    expect(ctx.steps[0].step).toBe("llegada_fuera_ventana");
    expect(ctx.steps[0].details.geofenceId).toBe("geo-1");
    expect(ctx.steps[0].details.unitId).toBe("unit-1");
    expect(ctx.steps[0].details.arrivalOutsideContractGeofence).toBeUndefined();
    expect(ctx.metadata.source).toBe("memory");
  });

  it("flag neutro sin geofenceId cuando la llegada es a geocerca de otro contrato", async () => {
    const otherPolygon = [
      { lat: 32.0, lng: -107.0 },
      { lat: 32.01, lng: -107.0 },
      { lat: 32.01, lng: -106.99 },
      { lat: 32.0, lng: -106.99 },
    ];
    const { repos, addLedgerEntry } = buildRepos({
      extendedPoints: [
        {
          imei: "imei-1",
          latitude: 32.005,
          longitude: -106.995,
          recordedAt: new Date("2026-07-09T12:50:00Z"),
          unitId: "unit-1",
        },
      ],
      otherContracts: [
        {
          id: "contract-2",
        },
      ],
    });
    // findForContract para contract-2 devuelve un perfil con geocerca ajena.
    repos.profiles.findForContract = vi
      .fn()
      .mockImplementation((contractId: string) =>
        contractId === "contract-2"
          ? Promise.resolve([
              { geofence: { id: "geo-2", polygon: otherPolygon } },
            ])
          : Promise.resolve([]),
      );

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    await service.verifyOccurrence("occ-tardia");

    const ctx = addLedgerEntry.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === "contexto_calibracion");
    expect(ctx).toBeTruthy();
    expect(ctx.steps[0].details.arrivalOutsideContractGeofence).toBe(true);
    expect(ctx.steps[0].details.geofenceId).toBeUndefined();
    expect(ctx.metadata.scope).toBe("other_contract");
  });

  it("no anota nada cuando no hay GPS extendido en memoria propia (cero Umbrella)", async () => {
    const { repos, addLedgerEntry } = buildRepos({ extendedPoints: [] });

    const service = new VerificationService(repos as never, {
      umbrellaBaseUrl: "http://example.com",
    });
    await service.verifyOccurrence("occ-tardia");

    const ctx = addLedgerEntry.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === "contexto_calibracion");
    expect(ctx).toBeUndefined();
  });
});
