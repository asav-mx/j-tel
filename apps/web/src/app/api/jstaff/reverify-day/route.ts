import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { VerificationService } from "@jtel/services";

export const maxDuration = 300;

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/jstaff/soporte", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

/**
 * Re-verifica un día de un contrato con force (política actual).
 * Solo desde J-Staff — sobrescribe hechos cerrados de ese día.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const contractId = String(formData.get("contractId") ?? "").trim();
  const serviceDate = String(formData.get("serviceDate") ?? "").trim();

  if (!contractId || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return back(request, {
      error: "Elige contrato y fecha (YYYY-MM-DD).",
    });
  }

  const repos = getRepos();
  const contract = await repos.contracts.findById(contractId);
  if (!contract) {
    return back(request, { error: "Contrato no encontrado." });
  }

  try {
    const service = new VerificationService(repos, getUmbrellaConfig());
    const results = await service.reverifyContract(contractId, {
      serviceDate,
      keepEvidence: false,
      exclusiveUnits: true,
    });

    const byStatus = new Map<string, number>();
    let errors = 0;
    for (const r of results) {
      if ((r as { error?: string }).error) {
        errors += 1;
        continue;
      }
      const s = String((r as { status?: string }).status ?? "?");
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    }

    const summary = [...byStatus.entries()]
      .map(([k, n]) => `${k}:${n}`)
      .join(", ");

    return back(request, {
      reverify: "ok",
      n: String(results.length),
      day: serviceDate,
      summary: summary || "sin resultados",
      ...(errors > 0 ? { errs: String(errors) } : {}),
    });
  } catch (err) {
    console.error("[jstaff/reverify-day]", err);
    return back(request, {
      error: err instanceof Error ? err.message : "Error al re-verificar.",
    });
  }
}
