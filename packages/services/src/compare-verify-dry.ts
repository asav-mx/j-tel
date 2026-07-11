/**
 * Dry-run: compara hechos guardados vs lo que diría el motor actual (Fase 1+2)
 * SIN escribir a la DB.
 *
 *   SERVICE_DATE=2026-07-09 pnpm --filter @jtel/services exec tsx src/compare-verify-dry.ts
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import type { ContractPolicy } from "@jtel/domain";
import { verifyService } from "@jtel/verification";
import { computeExclusiveContentionWindow } from "./verification.js";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const serviceDate = process.env.SERVICE_DATE ?? "2026-07-09";
  const filter = (process.env.CONTRACT ?? "santos dumont|campus santos").toLowerCase();

  const db = createDb(process.env.DATABASE_URL!);
  const repos = createRepositories(db);

  const clients = await repos.accounts.listByType("client");
  const contracts = [];
  for (const client of clients) {
    contracts.push(...(await repos.contracts.findForClient(client.id)));
  }
  const contract = contracts.find((c) => {
    const hay = `${c.name ?? ""} ${c.plantGroup?.name ?? ""} ${c.plant?.name ?? ""}`.toLowerCase();
    return filter.split("|").some((f) => hay.includes(f.trim()));
  });
  if (!contract) {
    console.error(
      "Sin contrato. Disponibles:",
      contracts.map((c) => c.name),
    );
    process.exit(1);
  }

  const policy = contract.policy as ContractPolicy;
  const occs = (await repos.occurrences.findForContract(contract.id)).filter(
    (o) => o.serviceDate === serviceDate && o.trip,
  );

  console.log(
    `\nDry-run · ${contract.name} · ${serviceDate} · ${occs.length} ocurrencias (sin escribir)\n`,
  );
  console.log(
    "política corredor:",
    `${policy.kmlCorridorMeters ?? 120} m`,
    "| A≥",
    policy.kmlMatchMinPct ?? 60,
    "| B≥",
    policy.kmlCorridorMinPct ?? 60,
    "| cov≥",
    policy.evidenceMinCoveragePct ?? 80,
    "% gap≤",
    policy.evidenceMaxGapMinutes ?? 10,
    "min",
  );
  console.log("");

  const counts = {
    same: 0,
    changed: 0,
    toPendiente: 0,
    toCumplido: 0,
    toNoCumplido: 0,
  };

  for (const thin of occs) {
    const occ = await repos.occurrences.findById(thin.id);
    if (!occ?.trip || !occ.profile?.geofence) {
      console.log(`? ${(thin.profile?.name ?? thin.id).toString().padEnd(28)} sin geocerca/trip — skip`);
      continue;
    }
    const trip = occ.trip;
    const profile = occ.profile;
    const geofence = profile.geofence;
    const points = await repos.evidence.getPointsForTrip(trip.id);
    const devices = await repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
    const units = await repos.fleet.getUnitsForCarrier(contract.carrierAccountId);
    const imeiToUnit = new Map<string, string>();
    for (const p of points) {
      if (p.unitId) imeiToUnit.set(p.imei, p.unitId);
    }
    for (const p of points) {
      if (imeiToUnit.has(p.imei)) continue;
      const device = devices.find((d) => d.imei === p.imei);
      if (!device) continue;
      const asg = await repos.fleet.resolveUnitAtTime(device.id, p.recordedAt);
      if (asg) imeiToUnit.set(p.imei, asg.unitId);
    }

    const routeId = profile.routeShift?.routeId;
    const kml = routeId
      ? await repos.routes.getKmlVersionForDate(routeId, occ.expectedDeadline)
      : null;

    const cov = computeExclusiveContentionWindow(occ.expectedDeadline, policy);
    const result = verifyService({
      occurrenceId: occ.id,
      expectedDeadline: occ.expectedDeadline,
      toleranceMinutes: policy.toleranceMinutes,
      routeStrictness: policy.routeStrictness,
      kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
      kmlCorridorMeters: policy.kmlCorridorMeters ?? 120,
      kmlCorridorMinPct: policy.kmlCorridorMinPct ?? 60,
      geofencePolygon: geofence.polygon,
      kmlWaypoints: kml?.waypoints,
      evidencePoints: points.map((p) => ({
        imei: imeiToUnit.get(p.imei) ?? p.imei,
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed ?? undefined,
        timestamp: p.recordedAt,
      })),
      excusableReasons: policy.excusableReasons,
      coverageWindowStart: new Date(cov.startMs),
      coverageWindowEnd: new Date(cov.endMs),
      evidenceMinCoveragePct: policy.evidenceMinCoveragePct ?? 80,
      evidenceMaxGapMinutes: policy.evidenceMaxGapMinutes ?? 10,
    });

    const oldStatus = occ.complianceFact?.status ?? "sin_hecho";
    const name = profile.name ?? profile.code ?? occ.id.slice(0, 8);
    const unit =
      units.find((u) => u.id === result.observedUnitId)?.name ??
      result.observedUnitId?.slice(0, 8) ??
      "—";
    const changed = oldStatus !== result.status;
    if (!changed) counts.same += 1;
    else {
      counts.changed += 1;
      if (result.status === "pendiente_evidencia") counts.toPendiente += 1;
      if (result.status === "cumplido") counts.toCumplido += 1;
      if (result.status === "no_cumplido") counts.toNoCumplido += 1;
    }

    const mark = changed ? "Δ" : "=";
    const a = result.candidateUnits.find((c) => c.unitId === result.observedUnitId);
    console.log(
      `${mark} ${String(name).padEnd(28)} ${String(oldStatus).padEnd(20)} → ${result.status.padEnd(20)} unit=${String(unit).padEnd(8)} A=${result.observedRouteMatchPct?.toFixed?.(0) ?? "—"} B=${a?.corridorPrecisionPct?.toFixed?.(0) ?? "—"}`,
    );
  }

  console.log("\nResumen:");
  console.log(`  iguales: ${counts.same}`);
  console.log(`  cambian: ${counts.changed}`);
  console.log(`    → pendiente_evidencia: ${counts.toPendiente}`);
  console.log(`    → cumplido: ${counts.toCumplido}`);
  console.log(`    → no_cumplido: ${counts.toNoCumplido}`);
  console.log("\n(No se escribió nada en la DB.)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
