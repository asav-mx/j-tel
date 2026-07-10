import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createContractSchema, type EnforcementRules, parseOperationalScope, operationalScopeColumns } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "contratos", scope, params);
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
    const url = new URL("/cliente", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "activate") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    if (!contract || contract.clientAccountId !== client.id) {
      return back(request, client.slug, null, { error: "Contrato no encontrado." });
    }
    await repos.contracts.activate(contractId);
    const scope = parseOperationalScope({
      plantId: contract.plantId,
      plantGroupId: contract.plantGroupId,
    });
    return back(request, client.slug, scope, { created: "activado" });
  }

  if (action === "delete") {
    const contractId = String(formData.get("contractId") ?? "").trim();
    const contract = contractId ? await repos.contracts.findById(contractId) : null;
    const scope = contract
      ? parseOperationalScope({
          plantId: contract.plantId,
          plantGroupId: contract.plantGroupId,
        })
      : null;

    const deleted = contractId
      ? await repos.contracts.deleteDraft(contractId, client.id)
      : null;
    if (!deleted) {
      return back(request, client.slug, scope, {
        error: "No se pudo eliminar. Solo borradores sin perfiles de servicio.",
      });
    }
    return back(request, client.slug, scope, { created: "eliminado" });
  }

  const plantId = String(formData.get("plantId") ?? "").trim();
  const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
  const scope = parseOperationalScope({ plantId, plantGroupId });
  if (!scope) {
    return back(request, client.slug, null, { error: "Elige una unidad operativa válida." });
  }

  const resolved = await repos.clients.resolveOperationalScope(client.id, scope);
  if (!resolved) {
    return back(request, client.slug, scope, { error: "Unidad operativa no válida." });
  }

  const scopeCols = operationalScopeColumns(resolved);

  if (action !== "create") {
    return back(request, client.slug, resolved, { error: "Acción no reconocida." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const carrierAccountId = String(formData.get("carrierAccountId") ?? "").trim();
  const arrivalAnticipationMinutes = toInt(formData.get("arrivalAnticipationMinutes"), 15);
  const maxRouteDurationMinutes = toInt(formData.get("maxRouteDurationMinutes"), 60);
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
    ...scopeCols,
    name,
    status: "draft" as const,
    policy: {
      toleranceMinutes,
      arrivalAnticipationMinutes,
      maxRouteDurationMinutes,
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
    return back(request, client.slug, resolved, {
      error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
    });
  }

  const carrier = await repos.accounts.findById(parsed.data.carrierAccountId);
  if (!carrier || carrier.type !== "carrier") {
    return back(request, client.slug, resolved, { error: "Elige un carrier válido." });
  }

  const authorized = await repos.commercial.isAuthorized(client.id, carrier.id);
  if (!authorized) {
    return back(request, client.slug, resolved, {
      error: "Ese carrier no está autorizado para este cliente. Contacta a JTEL.",
    });
  }

  const existing = await repos.contracts.findOpenForScopeAndCarrier(
    client.id,
    carrier.id,
    scopeCols,
  );
  if (existing) {
    const statusLabel =
      existing.status === "active"
        ? "activo"
        : existing.status === "draft"
          ? "borrador"
          : existing.status;
    return back(request, client.slug, resolved, {
      error: `Ya existe un contrato ${statusLabel} para ${carrier.name} en esta unidad operativa («${existing.name}»). Actívalo, elimínalo si es borrador, o suspende el anterior.`,
    });
  }

  await repos.contracts.create(parsed.data);
  return back(request, client.slug, resolved, { created: "contrato" });
}
