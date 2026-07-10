import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import {
  createServiceProfileSchema,
  geofenceMatchesScope,
  operationalScopeFromContract,
  parseOperationalScope,
  scopedRowMatches,
} from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";
import { contractMatchesScope } from "@/lib/operational-scope";

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "servicios", scope, params);
}

async function memberPlantIdsForScope(
  repos: ReturnType<typeof getRepos>,
  clientAccountId: string,
  scope: NonNullable<ReturnType<typeof parseOperationalScope>>,
): Promise<string[]> {
  if (scope.kind !== "plant_group") return [];
  const plants = await repos.clients.getPlantsForAccount(clientAccountId);
  return plants.filter((p) => p.plantGroupId === scope.plantGroupId).map((p) => p.id);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const action = String(formData.get("action") ?? "create").trim();
  const plantId = String(formData.get("plantId") ?? "").trim();
  const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
  const formScope = parseOperationalScope({ plantId, plantGroupId });

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  async function scopeForProfile(profileId: string) {
    const profile = await repos.profiles.findById(profileId);
    if (!profile?.contract) return formScope;
    return operationalScopeFromContract(profile.contract);
  }

  if (action === "generar") {
    const profileId = String(formData.get("profileId") ?? "").trim();
    const fromDate = String(formData.get("fromDate") ?? "").trim();
    const toDate = String(formData.get("toDate") ?? "").trim();
    const redirectScope = profileId ? await scopeForProfile(profileId) : formScope;
    if (!profileId || !fromDate || !toDate) {
      return back(request, client.slug, redirectScope, { error: "Elige perfil y rango de fechas." });
    }
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return back(request, client.slug, redirectScope, { error: "Rango de fechas inválido." });
    }
    try {
      const createdIds = await repos.occurrences.generateForProfile(profileId, from, to);
      return back(request, client.slug, redirectScope, {
        created: "generado",
        n: String(createdIds.length),
      });
    } catch {
      return back(request, client.slug, redirectScope, {
        error: "No se pudieron generar las ocurrencias.",
      });
    }
  }

  if (action === "delete") {
    const profileId = String(formData.get("profileId") ?? "").trim();
    const redirectScope = profileId ? await scopeForProfile(profileId) : formScope;
    if (!profileId) {
      return back(request, client.slug, redirectScope, { error: "Perfil no indicado." });
    }
    const deleted = await repos.profiles.deleteProfile(profileId, client.id);
    if (!deleted) {
      return back(request, client.slug, redirectScope, {
        error: "No se puede eliminar: el perfil no existe o ya tiene ocurrencias generadas.",
      });
    }
    return back(request, client.slug, redirectScope, { created: "eliminado" });
  }

  if (!formScope) {
    return back(request, client.slug, null, { error: "Elige una unidad operativa." });
  }

  const scope = await repos.clients.resolveOperationalScope(client.id, formScope);
  if (!scope) {
    return back(request, client.slug, formScope, { error: "Unidad operativa no válida." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const contractId = String(formData.get("contractId") ?? "").trim();
  const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
  const geofenceId = String(formData.get("geofenceId") ?? "").trim();
  const referenceUnitIdRaw = String(formData.get("referenceUnitId") ?? "").trim();
  const possibleUnitIdsRaw = formData.getAll("possibleUnitIds").map((u) => String(u));
  const activeDays = formData
    .getAll("activeDays")
    .map((d) => Number(String(d)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const contract = contractId ? await repos.contracts.findById(contractId) : null;
  if (!contract || contract.clientAccountId !== client.id) {
    return back(request, client.slug, scope, { error: "Contrato no encontrado." });
  }

  const contractScope = operationalScopeFromContract(contract);
  if (!contractScope) {
    return back(request, client.slug, scope, { error: "Contrato sin alcance válido." });
  }

  if (!contractMatchesScope(contract, scope)) {
    return back(request, client.slug, scope, {
      error: "El contrato no corresponde a la unidad operativa seleccionada.",
    });
  }

  const routeShift = routeShiftId ? await repos.routes.findRouteShiftById(routeShiftId) : null;
  if (!routeShift || routeShift.clientAccountId !== client.id) {
    return back(request, client.slug, scope, { error: "Ruta + turno no válidos." });
  }
  if (!scopedRowMatches(routeShift, scope)) {
    return back(request, client.slug, scope, {
      error: "La ruta + turno no pertenecen a esta unidad operativa.",
    });
  }

  const geofence = geofenceId ? await repos.geofences.findById(geofenceId) : null;
  if (!geofence) {
    return back(request, client.slug, scope, { error: "Geocerca no encontrada." });
  }

  const memberPlantIds = await memberPlantIdsForScope(repos, client.id, scope);
  if (!geofenceMatchesScope(geofence, scope, memberPlantIds)) {
    return back(request, client.slug, scope, {
      error: "La geocerca no corresponde a esta unidad operativa.",
    });
  }

  const carrierUnits = await repos.fleet.getUnitsForCarrier(contract.carrierAccountId);
  const carrierUnitIds = new Set(carrierUnits.map((u) => u.id));
  const possibleUnitIds = possibleUnitIdsRaw.filter((id) => carrierUnitIds.has(id));
  const referenceUnitId =
    referenceUnitIdRaw && carrierUnitIds.has(referenceUnitIdRaw) ? referenceUnitIdRaw : undefined;

  const payload = {
    contractId,
    routeShiftId,
    geofenceId,
    name,
    possibleUnitIds,
    ...(referenceUnitId ? { referenceUnitId } : {}),
    activeDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5],
  };

  const parsed = createServiceProfileSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return back(request, client.slug, scope, {
      error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
    });
  }

  await repos.profiles.create(parsed.data);
  return back(request, client.slug, scope, { created: "perfil" });
}
