import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createContractSchema, type EnforcementRules } from "@jtel/domain";

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/configuracion/contratos", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function buildEnforcementRule(formData: FormData): EnforcementRules[] {
  const type = String(formData.get("enforcementType") ?? "").trim();
  const tolerance = toInt(formData.get("enforcementTolerance"), 0);

  if (type === "no_pago_viaje") {
    return [{ type: "no_pago_viaje", toleranceMinutes: Math.max(1, tolerance) }];
  }
  if (type === "rebate_escalonado") {
    return [
      {
        type: "rebate_escalonado",
        toleranceMinutes: Math.max(1, tolerance),
        baseRebatePercent: Number(formData.get("baseRebatePercent") ?? 0),
        baseFailureCount: Math.max(1, toInt(formData.get("baseFailureCount"), 1)),
        additionalRebatePercent: Number(formData.get("additionalRebatePercent") ?? 0),
      },
    ];
  }
  if (type === "reembolso") {
    const amountRaw = String(formData.get("reembolsoAmount") ?? "").trim();
    const amount = amountRaw ? Number(amountRaw) : undefined;
    return [{ type: "reembolso", ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}) }];
  }
  return [];
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const action = String(formData.get("action") ?? "create").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente/configuracion/contratos", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "activate") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    if (!contract || contract.clientAccountId !== client.id) {
      return back(request, client.slug, { error: "Contrato no encontrado." });
    }
    await repos.contracts.activate(contractId);
    return back(request, client.slug, { created: "activado" });
  }

  const name = String(formData.get("name") ?? "").trim();
  const carrierAccountId = String(formData.get("carrierAccountId") ?? "").trim();
  const target = String(formData.get("target") ?? "plant").trim();
  const plantId = String(formData.get("plantId") ?? "").trim();
  const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
  const toleranceMinutes = toInt(formData.get("toleranceMinutes"), 0);
  const verificationGraceMinutes = toInt(formData.get("verificationGraceMinutes"), 15);
  const routeStrictness = String(formData.get("routeStrictness") ?? "destino_only").trim();
  const evidenceMarginMinutesBefore = toInt(formData.get("evidenceMarginMinutesBefore"), 60);
  const evidenceMarginMinutesAfter = toInt(formData.get("evidenceMarginMinutesAfter"), 30);
  const allowAlternateDestination = formData.get("allowAlternateDestination") === "on";
  const excusableReasons = formData.getAll("excusableReasons").map((r) => String(r));

  const payload = {
    carrierAccountId,
    clientAccountId: client.id,
    ...(target === "group"
      ? { plantGroupId: plantGroupId || undefined }
      : { plantId: plantId || undefined }),
    name,
    status: "draft" as const,
    policy: {
      toleranceMinutes,
      verificationGraceMinutes,
      routeStrictness,
      allowAlternateDestination,
      excusableReasons,
      enforcementRules: buildEnforcementRule(formData),
      evidenceMarginMinutesBefore,
      evidenceMarginMinutesAfter,
    },
  };

  const parsed = createContractSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return back(request, client.slug, {
      error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
    });
  }

  const carrier = await repos.accounts.findById(parsed.data.carrierAccountId);
  if (!carrier || carrier.type !== "carrier") {
    return back(request, client.slug, { error: "Elige un carrier válido." });
  }

  await repos.contracts.create(parsed.data);
  return back(request, client.slug, { created: "contrato" });
}
