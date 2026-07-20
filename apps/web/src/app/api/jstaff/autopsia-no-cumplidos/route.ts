import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import {
  classifyOne,
  buildSummary,
  reportToCsv,
  type AutopsiaRow,
  type AutopsiaReport,
} from "@/lib/autopsia";

export const maxDuration = 120;

/**
 * GET /api/jstaff/autopsia-no-cumplidos?contractId=...&from=...&to=...&format=csv
 *
 * Reporte de solo lectura. No escribe en saveFact, no reverifica,
 * no llama a Umbrella. Las cubetas son etiquetas internas de análisis.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId")?.trim();
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  const format = url.searchParams.get("format")?.trim()?.toLowerCase();

  if (!contractId) {
    return NextResponse.json({ error: "contractId es requerido" }, { status: 400 });
  }
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "from y to requeridos en formato YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const repos = getRepos();

  const contract = await repos.contracts.findById(contractId);
  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const occurrences = await repos.occurrences.findForContract(
    contractId,
    new Date(`${from}T00:00:00`),
    new Date(`${to}T23:59:59`),
  );

  const noCumplidos = occurrences.filter(
    (o) => o.complianceFact?.status === "no_cumplido",
  );

  const rows: AutopsiaRow[] = [];

  for (const occ of noCumplidos) {
    const fact = occ.complianceFact!;
    const trip = occ.trip;
    const profile = occ.profile;
    const policySnapshot = fact.contractPolicySnapshot as {
      evidenceMinCoveragePct?: number;
      evidenceMaxGapMinutes?: number;
    } | null;

    // Ledger del trip (congelado, solo lectura)
    const ledger = trip
      ? await repos.compliance.getLedgerForTrip(trip.id)
      : [];

    // Puntos de evidencia del trip (para brinco GPS)
    const evidencePoints = trip
      ? await repos.evidence.getPointsForTrip(trip.id)
      : [];

    const { mainBucket, signals, raw } = classifyOne(
      {
        status: fact.status,
        observedUnitId: fact.observedUnitId ?? null,
        observedRouteMatchPct: fact.observedRouteMatchPct ?? null,
      },
      ledger.map((e) => ({
        action: e.action,
        steps: (e.steps ?? []) as Array<{
          step: string;
          result: string;
          details?: Record<string, unknown>;
        }>,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
      })),
      evidencePoints.map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        recordedAt: p.recordedAt,
        imei: p.imei,
      })),
      policySnapshot,
    );

    rows.push({
      occurrenceId: occ.id,
      serviceDate: occ.serviceDate,
      profileName: profile?.name ?? occ.serviceProfileId,
      routeName: profile?.routeShift?.route?.name ?? null,
      referenceUnitId: occ.referenceUnitId ?? null,
      mainBucket,
      signals,
      raw,
    });
  }

  const report: AutopsiaReport = {
    contractId,
    from,
    to,
    summary: buildSummary(rows),
    rows,
  };

  if (format === "csv") {
    return new NextResponse(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="autopsia-${from}-${to}.csv"`,
      },
    });
  }

  return NextResponse.json(report);
}
