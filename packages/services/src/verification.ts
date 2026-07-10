import { verifyService } from "@jtel/verification";
import { createUmbrellaProvider, ingestEvidenceForTrip } from "@jtel/gps-umbrella";
import type { Repositories } from "@jtel/db";
import type { ContractPolicy } from "@jtel/domain";

export interface VerificationServiceConfig {
  umbrellaBaseUrl: string;
  umbrellaUserId?: string;
  umbrellaPassword?: string;
}

export class VerificationService {
  // Un proveedor por carrier (cacheado por corrida) para reutilizar el token y
  // evitar 429. Cada carrier puede usar un proveedor/credenciales distintos.
  private providersByCarrier = new Map<
    string,
    ReturnType<typeof createUmbrellaProvider>
  >();

  constructor(
    private repos: Repositories,
    private config: VerificationServiceConfig,
  ) {}

  private buildProvider(provider: string, baseUrl: string, userId: string, password: string) {
    switch (provider) {
      case "umbrella":
        return createUmbrellaProvider({ baseUrl, credentials: { userId, password } });
      default:
        throw new Error(`Proveedor GPS no soportado todavía: ${provider}`);
    }
  }

  /**
   * Devuelve el proveedor GPS del carrier usando sus credenciales guardadas en
   * la base. Si el carrier aún no configuró credenciales, cae al respaldo por
   * variables de entorno globales (transición).
   */
  private async getProviderForCarrier(carrierAccountId: string) {
    const cached = this.providersByCarrier.get(carrierAccountId);
    if (cached) return cached;

    const creds = await this.repos.carriers.getGpsCredentials(carrierAccountId);

    const provider = creds
      ? this.buildProvider(
          creds.provider,
          creds.baseUrl ?? this.config.umbrellaBaseUrl,
          creds.userId,
          creds.password,
        )
      : this.buildProvider(
          "umbrella",
          this.config.umbrellaBaseUrl,
          this.config.umbrellaUserId ?? "demo_user",
          this.config.umbrellaPassword ?? "demo_pass",
        );

    this.providersByCarrier.set(carrierAccountId, provider);
    return provider;
  }

  async processPending(now = new Date()) {
    const pending = await this.repos.occurrences.findPendingVerification(now);
    const results = [];

    for (const row of pending) {
      try {
        const result = await this.verifyOccurrence(row.occurrence.id);
        results.push(result);
      } catch (err) {
        results.push({
          occurrenceId: row.occurrence.id,
          skipped: true,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Recalcula hechos de un contrato con la política actual (p. ej. tras cambiar
   * umbral KML / tolerancia). Reusa evidencia GPS ya guardada cuando existe.
   */
  async reverifyContract(
    contractId: string,
    opts: { daysBack?: number; now?: Date } = {},
  ) {
    const daysBack = opts.daysBack ?? 14;
    const now = opts.now ?? new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - daysBack);
    const fromIso = from.toISOString().slice(0, 10);

    const occs = await this.repos.occurrences.findForContract(contractId);
    const targets = occs.filter((o) => {
      if (!o.trip) return false;
      if (o.serviceDate < fromIso) return false;
      // Solo servicios cuyo deadline ya pasó (o está en ventana de gracia).
      return o.expectedDeadline.getTime() <= now.getTime() + 60 * 60 * 1000;
    });

    const results = [];
    for (const occ of targets) {
      try {
        results.push(
          await this.verifyOccurrence(occ.id, { force: true, keepEvidence: true }),
        );
      } catch (err) {
        results.push({
          occurrenceId: occ.id,
          skipped: true,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  async verifyOccurrence(
    occurrenceId: string,
    opts: { force?: boolean; keepEvidence?: boolean } = {},
  ) {
    const occurrence = await this.repos.occurrences.findById(occurrenceId);
    if (!occurrence?.trip) {
      throw new Error("Ocurrencia o viaje no encontrado");
    }

    const trip = occurrence.trip;
    const existingPoints = await this.repos.evidence.getPointsForTrip(trip.id);
    const reuseEvidence = Boolean(opts.keepEvidence && existingPoints.length > 0);

    // Sin force: cumplido/no_cumplido son definitivos; pendiente se reintenta.
    if (occurrence.complianceFact) {
      if (
        !opts.force &&
        occurrence.complianceFact.status !== "pendiente_evidencia"
      ) {
        return { occurrenceId, skipped: true, status: occurrence.complianceFact.status };
      }
      await this.repos.compliance.deleteFactForOccurrence(occurrenceId);
      if (!reuseEvidence) {
        await this.repos.evidence.clearPointsForTrip(trip.id);
        await this.repos.evidence.updateTripStatus(trip.id, "en_espera");
      }
    }

    const profile = occurrence.profile!;
    const contract = profile.contract!;
    const policy = contract.policy as ContractPolicy;

    const possibleUnitIds = await this.repos.profiles.getPossibleUnitIds(profile.id);
    const devices = await this.repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const units = await this.repos.fleet.getUnitsForCarrier(contract.carrierAccountId);

    const candidateDevices = devices.filter((d) => {
      if (possibleUnitIds.length === 0) return true;
      return units.some(
        (u) => possibleUnitIds.includes(u.id) && d.carrierAccountId === contract.carrierAccountId,
      );
    });

    const imeis = candidateDevices.map((d) => d.imei);
    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));

    const resolveUnit = async (imei: string, at: Date) => {
      const device = imeiToDevice.get(imei);
      if (!device) return null;
      const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, at);
      if (!assignment) return null;
      return { unitId: assignment.unitId, deviceId: device.id };
    };

    let ingestSource: "memory" | "umbrella" | "none" | "cached" = "none";
    let ingestStatus: "disponible" | "parcial" | "indisponible" = "indisponible";
    let ingestPointCount = 0;

    if (reuseEvidence) {
      ingestSource = "cached";
      ingestPointCount = existingPoints.length;
      ingestStatus =
        trip.evidenceStatus === "disponible" || trip.evidenceStatus === "parcial"
          ? trip.evidenceStatus
          : existingPoints.some((p) => p.unitId)
            ? "disponible"
            : "parcial";
    } else {
      // 1) Memoria propia primero (telemetry_points).
      // 2) Si no hay, Umbrella en vivo.
      const memoryPoints = await this.repos.telemetry.getForImeis(
        imeis,
        trip.evidenceWindowStart,
        trip.evidenceWindowEnd,
      );

      if (memoryPoints.length > 0) {
        const resolved = memoryPoints.map((p) => ({
          imei: p.imei,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed ?? undefined,
          recordedAt: p.recordedAt,
          deviceId: p.deviceId ?? undefined,
          unitId: p.unitId ?? undefined,
        }));
        await this.repos.evidence.savePoints(trip.id, resolved);
        ingestStatus = resolved.some((p) => p.unitId) ? "disponible" : "parcial";
        await this.repos.evidence.updateTripStatus(trip.id, ingestStatus);
        ingestSource = "memory";
        ingestPointCount = resolved.length;
      } else {
        const provider = await this.getProviderForCarrier(contract.carrierAccountId);
        const ingestResult = await ingestEvidenceForTrip(provider, {
          tripId: trip.id,
          imeis,
          windowStart: trip.evidenceWindowStart,
          windowEnd: trip.evidenceWindowEnd,
          resolveUnit,
          savePoints: async (points) => {
            await this.repos.evidence.savePoints(trip.id, points);
          },
          updateStatus: async (status) => {
            await this.repos.evidence.updateTripStatus(trip.id, status);
          },
        });
        ingestSource = ingestResult.pointCount > 0 ? "umbrella" : "none";
        ingestStatus = ingestResult.status;
        ingestPointCount = ingestResult.pointCount;
      }
    }

    // Construye imei→unidad una sola vez (preferir unitId ya en evidencia).
    const storedPoints = reuseEvidence
      ? existingPoints
      : await this.repos.evidence.getPointsForTrip(trip.id);
    const imeiToUnitId = new Map<string, string>();
    const unresolvedImeis = new Set<string>();
    for (const point of storedPoints) {
      if (point.unitId) {
        imeiToUnitId.set(point.imei, point.unitId);
      } else if (!imeiToUnitId.has(point.imei)) {
        unresolvedImeis.add(point.imei);
      }
    }
    for (const imei of unresolvedImeis) {
      const device = imeiToDevice.get(imei);
      if (!device) continue;
      const sample = storedPoints.find((p) => p.imei === imei)!;
      const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, sample.recordedAt);
      if (assignment) imeiToUnitId.set(imei, assignment.unitId);
    }

    const evidencePoints = storedPoints.map((p) => ({
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? undefined,
      timestamp: p.recordedAt,
    }));

    const geofence = profile.geofence!;
    // Cargar KML por routeId (no routeShiftId). Si la ocurrencia ya trae versión, úsala.
    const routeId = profile.routeShift?.routeId;
    let kmlWaypoints: Array<{ lat: number; lng: number }> | undefined;
    if (occurrence.kmlVersionId && routeId) {
      const byId = await this.repos.routes.getKmlVersionForDate(
        routeId,
        occurrence.expectedDeadline,
      );
      kmlWaypoints = byId?.waypoints;
    } else if (routeId) {
      const byRoute = await this.repos.routes.getKmlVersionForDate(
        routeId,
        occurrence.expectedDeadline,
      );
      kmlWaypoints = byRoute?.waypoints;
    }

    const enrichedPoints = evidencePoints.map((p) => ({
      ...p,
      // Agrupar por unidad cuando se conoce; si no, por IMEI.
      imei: imeiToUnitId.get(p.imei) ?? p.imei,
    }));

    const verification = verifyService({
      occurrenceId,
      expectedDeadline: occurrence.expectedDeadline,
      toleranceMinutes: policy.toleranceMinutes,
      routeStrictness: policy.routeStrictness,
      kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
      geofencePolygon: geofence.polygon,
      kmlWaypoints,
      evidencePoints: enrichedPoints,
      excusableReasons: policy.excusableReasons,
    });

    let observedUnitId: string | null = null;
    if (verification.observedUnitId) {
      const winner = verification.candidateUnits.find(
        (c) => c.unitId === verification.observedUnitId || c.servedRoute,
      );
      const candidate =
        (winner ? units.find((u) => u.id === winner.unitId)?.id : null) ??
        imeiToUnitId.get(verification.observedUnitId) ??
        units.find((u) => u.id === verification.observedUnitId)?.id ??
        null;
      // Solo persistir UUID de unidad real (nunca un IMEI crudo).
      observedUnitId = candidate && units.some((u) => u.id === candidate) ? candidate : null;
    }

    const fact = await this.repos.compliance.saveFact({
      serviceOccurrenceId: occurrenceId,
      tripId: trip.id,
      expectedDeadline: occurrence.expectedDeadline,
      expectedGeofenceId: occurrence.expectedGeofenceId,
      referenceUnitId: occurrence.referenceUnitId,
      observedUnitId,
      observedArrivalAt: verification.observedArrivalAt,
      observedRouteMatchPct: verification.observedRouteMatchPct,
      status: verification.status,
      timing: verification.timing,
      lateExcusable: verification.lateExcusable,
      routeStrictnessApplied: verification.routeStrictnessApplied,
      contractPolicySnapshot: policy,
    });

    await this.repos.compliance.addLedgerEntry({
      tripId: trip.id,
      serviceOccurrenceId: occurrenceId,
      action: "verificacion_automatica",
      steps: verification.ledgerSteps,
      metadata: {
        ingestStatus,
        ingestSource,
        pointCount: ingestPointCount,
        candidateUnits: verification.candidateUnits,
      },
    });

    if (verification.status === "pendiente_evidencia") {
      await this.repos.notifications.create({
        accountId: contract.clientAccountId,
        type: "sin_evidencia",
        title: "Servicio pendiente por evidencia",
        body: `El servicio del ${occurrence.serviceDate} quedó pendiente por falta de evidencia GPS.`,
        metadata: { occurrenceId },
      });
    } else if (verification.timing === "tarde" && !verification.lateExcusable) {
      await this.repos.notifications.create({
        accountId: contract.clientAccountId,
        type: "tarde",
        title: "Servicio con retraso",
        body: `El servicio del ${occurrence.serviceDate} cumplió la ruta pero llegó tarde.`,
        metadata: { occurrenceId, factId: fact?.id },
      });
    }

    return {
      occurrenceId,
      skipped: false,
      status: verification.status,
      factId: fact?.id,
      ingestSource,
      pointCount: ingestPointCount,
    };
  }

  async ingestEvidenceForOccurrence(occurrenceId: string) {
    const occurrence = await this.repos.occurrences.findById(occurrenceId);
    if (!occurrence?.trip) throw new Error("Ocurrencia o viaje no encontrado");

    const profile = occurrence.profile!;
    const contract = profile.contract!;
    const possibleUnitIds = await this.repos.profiles.getPossibleUnitIds(profile.id);
    const devices = await this.repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const imeis =
      possibleUnitIds.length === 0
        ? devices.map((d) => d.imei)
        : devices.map((d) => d.imei);
    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));

    const memoryPoints = await this.repos.telemetry.getForImeis(
      imeis,
      occurrence.trip.evidenceWindowStart,
      occurrence.trip.evidenceWindowEnd,
    );
    if (memoryPoints.length > 0) {
      const resolved = await Promise.all(
        memoryPoints.map(async (p) => {
          const device = imeiToDevice.get(p.imei);
          let unitId: string | undefined;
          let deviceId: string | undefined;
          if (device) {
            const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, p.recordedAt);
            if (assignment) {
              unitId = assignment.unitId;
              deviceId = device.id;
            }
          }
          return {
            imei: p.imei,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ?? undefined,
            recordedAt: p.recordedAt,
            deviceId,
            unitId,
          };
        }),
      );
      await this.repos.evidence.savePoints(occurrence.trip.id, resolved);
      const status = resolved.some((p) => p.unitId) ? "disponible" : "parcial";
      await this.repos.evidence.updateTripStatus(occurrence.trip.id, status);
      return { pointCount: resolved.length, status, source: "memory" as const };
    }

    const provider = await this.getProviderForCarrier(contract.carrierAccountId);
    return ingestEvidenceForTrip(provider, {
      tripId: occurrence.trip.id,
      imeis,
      windowStart: occurrence.trip.evidenceWindowStart,
      windowEnd: occurrence.trip.evidenceWindowEnd,
      resolveUnit: async (imei, at) => {
        const device = imeiToDevice.get(imei);
        if (!device) return null;
        const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, at);
        if (!assignment) return null;
        return { unitId: assignment.unitId, deviceId: device.id };
      },
      savePoints: async (points) => {
        await this.repos.evidence.savePoints(occurrence.trip!.id, points);
      },
      updateStatus: async (status) => {
        await this.repos.evidence.updateTripStatus(occurrence.trip!.id, status);
      },
    });
  }
}
