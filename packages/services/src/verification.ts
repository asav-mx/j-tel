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
  constructor(
    private repos: Repositories,
    private config: VerificationServiceConfig,
  ) {}

  async processPending(now = new Date()) {
    const pending = await this.repos.occurrences.findPendingVerification(now);
    const results = [];

    for (const row of pending) {
      const result = await this.verifyOccurrence(row.occurrence.id);
      results.push(result);
    }

    return results;
  }

  async verifyOccurrence(occurrenceId: string) {
    const occurrence = await this.repos.occurrences.findById(occurrenceId);
    if (!occurrence?.trip) {
      throw new Error("Ocurrencia o viaje no encontrado");
    }

    if (occurrence.complianceFact) {
      return { occurrenceId, skipped: true, status: occurrence.complianceFact.status };
    }

    const profile = occurrence.profile!;
    const contract = profile.contract!;
    const policy = contract.policy as ContractPolicy;
    const trip = occurrence.trip;

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

    const provider = createUmbrellaProvider({
      baseUrl: this.config.umbrellaBaseUrl,
      credentials: {
        userId: this.config.umbrellaUserId ?? "demo_user",
        password: this.config.umbrellaPassword ?? "demo_pass",
      },
    });

    const ingestResult = await ingestEvidenceForTrip(provider, {
      tripId: trip.id,
      imeis,
      windowStart: trip.evidenceWindowStart,
      windowEnd: trip.evidenceWindowEnd,
      resolveUnit: async (imei, at) => {
        const device = imeiToDevice.get(imei);
        if (!device) return null;
        const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, at);
        if (!assignment) return null;
        return { unitId: assignment.unitId, deviceId: device.id };
      },
      savePoints: async (points) => {
        await this.repos.evidence.savePoints(trip.id, points);
      },
      updateStatus: async (status) => {
        await this.repos.evidence.updateTripStatus(trip.id, status);
      },
    });

    const evidencePoints = (await this.repos.evidence.getPointsForTrip(trip.id)).map((p) => ({
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? undefined,
      timestamp: p.recordedAt,
    }));

    const geofence = profile.geofence!;
    const kmlVersion = occurrence.kmlVersionId
      ? await this.repos.routes.getKmlVersionForDate(profile.routeShiftId, occurrence.expectedDeadline)
      : null;

    const imeiToUnitId = new Map<string, string>();
    for (const point of evidencePoints) {
      const device = imeiToDevice.get(point.imei);
      if (!device) continue;
      const assignment = await this.repos.fleet.resolveUnitAtTime(device.id, point.timestamp);
      if (assignment) imeiToUnitId.set(point.imei, assignment.unitId);
    }

    const enrichedPoints = evidencePoints.map((p) => ({
      ...p,
      imei: imeiToUnitId.get(p.imei) ?? p.imei,
    }));

    const verification = verifyService({
      occurrenceId,
      expectedDeadline: occurrence.expectedDeadline,
      toleranceMinutes: policy.toleranceMinutes,
      routeStrictness: policy.routeStrictness,
      geofencePolygon: geofence.polygon,
      kmlWaypoints: kmlVersion?.waypoints,
      evidencePoints: enrichedPoints,
      excusableReasons: policy.excusableReasons,
    });

    let observedUnitId: string | null = null;
    if (verification.observedUnitId) {
      const winner = verification.candidateUnits.find(
        (c) => c.unitId === verification.observedUnitId || c.servedRoute,
      );
      if (winner) {
        observedUnitId =
          units.find((u) => u.id === winner.unitId)?.id ??
          imeiToUnitId.get(verification.observedUnitId) ??
          verification.observedUnitId;
      }
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
        ingestStatus: ingestResult.status,
        pointCount: ingestResult.pointCount,
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
    } else if (verification.timing === "tarde" && verification.status === "no_cumplido") {
      await this.repos.notifications.create({
        accountId: contract.clientAccountId,
        type: "tarde",
        title: "Servicio con retraso",
        body: `El servicio del ${occurrence.serviceDate} no cumplió por retraso.`,
        metadata: { occurrenceId, factId: fact?.id },
      });
    }

    return {
      occurrenceId,
      skipped: false,
      status: verification.status,
      factId: fact?.id,
    };
  }

  async ingestEvidenceForOccurrence(occurrenceId: string) {
    const occurrence = await this.repos.occurrences.findById(occurrenceId);
    if (!occurrence?.trip) throw new Error("Ocurrencia o viaje no encontrado");

    const profile = occurrence.profile!;
    const contract = profile.contract!;
    const possibleUnitIds = await this.repos.profiles.getPossibleUnitIds(profile.id);
    const devices = await this.repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const imeis = devices
      .filter((d) => possibleUnitIds.length === 0 || possibleUnitIds.some(() => true))
      .map((d) => d.imei);
    const imeiToDevice = new Map(devices.map((d) => [d.imei, d]));

    const provider = createUmbrellaProvider({
      baseUrl: this.config.umbrellaBaseUrl,
      credentials: {
        userId: this.config.umbrellaUserId ?? "demo_user",
        password: this.config.umbrellaPassword ?? "demo_pass",
      },
    });

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
