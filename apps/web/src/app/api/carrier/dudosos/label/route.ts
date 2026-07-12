import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

/**
 * Etiquetado de calibración del carrier (Tarea B).
 * Solo escribe occurrence_ground_truth + ledger.
 * Nunca altera compliance_facts / saveFact.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    account?: string;
    occurrenceId?: string;
    verdict?: "cumplido" | "no_hecho";
    unitId?: string | null;
    notes?: string | null;
  } | null;

  const accountSlug = String(body?.account ?? "").trim();
  const occurrenceId = String(body?.occurrenceId ?? "").trim();
  const verdict = body?.verdict;
  const unitId = body?.unitId ? String(body.unitId).trim() : null;
  const notes = body?.notes ? String(body.notes).trim() : null;

  if (!accountSlug || !occurrenceId || (verdict !== "cumplido" && verdict !== "no_hecho")) {
    return NextResponse.json(
      { error: "Faltan account, occurrenceId o verdict (cumplido|no_hecho)" },
      { status: 400 },
    );
  }
  if (verdict === "cumplido" && !unitId) {
    return NextResponse.json(
      { error: "Si se hizo, indica la unidad" },
      { status: 400 },
    );
  }

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(accountSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  const occurrence = await repos.occurrences.findById(occurrenceId);
  if (!occurrence?.trip || !occurrence.profile?.contract) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  const contract = occurrence.profile.contract;
  if (contract.carrierAccountId !== carrier.id) {
    return NextResponse.json({ error: "No autorizado para este servicio" }, { status: 403 });
  }

  // Solo dudosos residuales: no_cumplido. No tocamos hechos.
  const factStatus = occurrence.complianceFact?.status;
  if (factStatus !== "no_cumplido") {
    return NextResponse.json(
      { error: "Solo se etiquetan servicios en no_cumplido" },
      { status: 400 },
    );
  }

  if (unitId) {
    const units = await repos.fleet.getUnitsForCarrier(carrier.id);
    if (!units.some((u) => u.id === unitId)) {
      return NextResponse.json({ error: "Unidad no pertenece a este carrier" }, { status: 400 });
    }
  }

  const row = await repos.occurrenceGroundTruth.upsert({
    occurrenceId,
    operatorVerdict: verdict,
    operatorUnitId: verdict === "cumplido" ? unitId : null,
    primaryCause: verdict === "no_hecho" ? "no_trip" : null,
    notes,
    recordedBy: `carrier:${carrier.slug}`,
  });

  await repos.compliance.addLedgerEntry({
    tripId: occurrence.trip.id,
    serviceOccurrenceId: occurrenceId,
    action: "etiquetado_carrier_gt",
    steps: [
      {
        step: "etiquetado_carrier",
        result: verdict,
        details: {
          unitId: verdict === "cumplido" ? unitId : null,
          notes,
          // Calibración únicamente — no altera el hecho del cliente.
          mutatesFact: false,
        },
      },
    ],
    metadata: {
      carrierAccountId: carrier.id,
      carrierSlug: carrier.slug,
      groundTruthId: row.id,
      mutatesFact: false,
    },
  });

  return NextResponse.json({
    ok: true,
    occurrenceId,
    verdict: row.operatorVerdict,
    unitId: row.operatorUnitId,
    // El hecho visible al cliente no cambia.
    factUnchanged: true,
  });
}
