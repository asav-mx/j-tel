import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { VerificationService } from "@jtel/services";

export const maxDuration = 300;

function wantsJson(request: Request, formData: FormData) {
  const format = String(formData.get("format") ?? "").trim().toLowerCase();
  if (format === "json") return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function redirectBack(request: Request, params: Record<string, string>) {
  const url = new URL("/jstaff/soporte", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

function jsonOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function jsonErr(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Re-verifica un día de un contrato con force (política / geocerca actual del perfil).
 * Por defecto reutiliza evidencia ya guardada (rápido; ideal tras cambiar geocerca).
 * keepEvidence=0 fuerza re-ingesta GPS.
 *
 * Respuesta: redirect HTML por defecto, o JSON si Accept: application/json / format=json.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const asJson = wantsJson(request, formData);
  const contractId = String(formData.get("contractId") ?? "").trim();
  const serviceDate = String(formData.get("serviceDate") ?? "").trim();
  const keepRaw = String(formData.get("keepEvidence") ?? "1").trim();
  const keepEvidence = keepRaw !== "0" && keepRaw.toLowerCase() !== "false";

  if (!contractId || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    const msg = "Elige contrato y fecha (YYYY-MM-DD).";
    return asJson ? jsonErr(msg) : redirectBack(request, { error: msg });
  }

  const repos = getRepos();
  const contract = await repos.contracts.findById(contractId);
  if (!contract) {
    const msg = "Contrato no encontrado.";
    return asJson ? jsonErr(msg) : redirectBack(request, { error: msg });
  }

  try {
    const service = new VerificationService(repos, getUmbrellaConfig());
    const results = await service.reverifyContract(contractId, {
      serviceDate,
      keepEvidence,
      exclusiveUnits: true,
      // TODO: reemplazar null con session.userId cuando se implemente autenticación J-Staff.
      actorKind: "human",
      actorId: null,
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

    if (asJson) {
      return jsonOk({
        ok: true,
        day: serviceDate,
        n: results.length,
        summary: summary || "sin resultados",
        keepEvidence,
        errors,
        byStatus: Object.fromEntries(byStatus),
      });
    }

    return redirectBack(request, {
      reverify: "ok",
      n: String(results.length),
      day: serviceDate,
      summary: summary || "sin resultados",
      ...(errors > 0 ? { errs: String(errors) } : {}),
    });
  } catch (err) {
    console.error("[jstaff/reverify-day]", err);
    const msg = err instanceof Error ? err.message : "Error al re-verificar.";
    return asJson ? jsonErr(msg, 500) : redirectBack(request, { error: msg });
  }
}
