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
      const result = await repos.occurrences.generateForProfile(profileId, from, to, {
        rollingDays: 30,
      });
      if (result.createdIds.length === 0 && result.skippedExisting > 0) {
        return back(request, client.slug, redirectScope, {
          created: "ya_existian",
          n: String(result.skippedExisting),
        });
      }
      if (result.createdIds.length === 0) {
        return back(request, client.slug, redirectScope, {
          error: result.clamped
            ? "El rango queda fuera de la ventana operativa (30 días) o de la vigencia del contrato."
            : "No hay días activos del perfil en ese rango.",
        });
      }
      return back(request, client.slug, redirectScope, {
        created: result.clamped ? "generado_acotado" : "generado",
        n: String(result.createdIds.length),
        ...(result.skippedExisting > 0 ? { skipped: String(result.skippedExisting) } : {}),
      });
    } catch (err) {
      console.error("[cliente/servicios] generar ocurrencias:", err);
      return back(request, client.slug, redirectScope, {
        error: "No se pudieron generar las ocurrencias.",
      });
    }
  }

  if (action === "update") {
    const profileId = String(formData.get("profileId") ?? "").trim();
    const redirectScope = profileId ? await scopeForProfile(profileId) : formScope;
    if (!profileId) {
      return back(request, client.slug, redirectScope, { error: "Perfil no indicado." });
    }

    const profile = await repos.profiles.findById(profileId);
    if (!profile?.contract || profile.contract.clientAccountId !== client.id) {
      return back(request, client.slug, redirectScope, { error: "Perfil no encontrado." });
    }

    const scope = redirectScope
      ? await repos.clients.resolveOperationalScope(client.id, redirectScope)
      : null;
    if (!scope) {
      return back(request, client.slug, redirectScope, { error: "Unidad operativa no válida." });
    }

    const name = String(formData.get("name") ?? "").trim();
    const codeRaw = String(formData.get("code") ?? "").trim();
    const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
    const geofenceId = String(formData.get("geofenceId") ?? "").trim();
    const activeDays = formData
      .getAll("activeDays")
      .map((d) => Number(String(d)))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

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

    const payload = {
      routeShiftId,
      geofenceId,
      name,
      ...(codeRaw ? { code: codeRaw } : {}),
      activeDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5],
    };

    const parsed = createServiceProfileSchema
      .omit({ contractId: true, possibleUnitIds: true, referenceUnitId: true })
      .safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return back(request, client.slug, scope, {
        error: `Revisa los datos: ${first?.path.join(".") || ""} ${first?.message ?? ""}`.trim(),
      });
    }

    const result = await repos.profiles.updateProfile(profileId, client.id, parsed.data);
    if (!result.ok) {
      if (result.reason === "duplicate_code") {
        return back(request, client.slug, scope, {
          error: "Ese código ya lo usa otro perfil. Elige otro.",
        });
      }
      return back(request, client.slug, scope, { error: "Perfil no encontrado." });
    }

    return back(request, client.slug, scope, { created: "perfil_actualizado" });
  }

  if (action === "bulk_geofence") {
    const geofenceId = String(formData.get("geofenceId") ?? "").trim();
    if (!formScope || formScope.kind !== "plant" || !formScope.plantId) {
      return back(request, client.slug, formScope, {
        error: "La corrección masiva de geocerca solo aplica a planta (no campus).",
      });
    }
    if (!geofenceId) {
      return back(request, client.slug, formScope, { error: "Elige la geocerca correcta." });
    }
    const scope = await repos.clients.resolveOperationalScope(client.id, formScope);
    if (!scope || scope.kind !== "plant") {
      return back(request, client.slug, formScope, { error: "Unidad operativa no válida." });
    }
    const geofence = await repos.geofences.findById(geofenceId);
    if (!geofence) {
      return back(request, client.slug, scope, { error: "Geocerca no encontrada." });
    }
    const memberPlantIds = await memberPlantIdsForScope(repos, client.id, scope);
    if (!geofenceMatchesScope(geofence, scope, memberPlantIds)) {
      return back(request, client.slug, scope, {
        error: "La geocerca no corresponde a esta planta.",
      });
    }
    const { updated } = await repos.profiles.bulkSetGeofenceForPlant(
      scope.plantId,
      client.id,
      geofenceId,
    );
    return back(request, client.slug, scope, {
      created: `geocerca_actualizada_${updated}`,
    });
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

  if (action !== "create") {
    return back(request, client.slug, formScope, { error: "Acción no reconocida." });
  }

  if (!formScope) {
    return back(request, client.slug, null, { error: "Elige una unidad operativa." });
  }

  const scope = await repos.clients.resolveOperationalScope(client.id, formScope);
  if (!scope) {
    return back(request, client.slug, formScope, { error: "Unidad operativa no válida." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const contractId = String(formData.get("contractId") ?? "").trim();
  const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
  const geofenceId = String(formData.get("geofenceId") ?? "").trim();
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

  if (contract.status !== "active" && contract.status !== "demo") {
    return back(request, client.slug, scope, {
      error: "Activa el contrato antes de crear perfiles de servicio.",
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

  // Flota: la asigna el carrier. El cliente no elige ni ve unidades aquí.
  const payload = {
    contractId,
    routeShiftId,
    geofenceId,
    name,
    ...(codeRaw ? { code: codeRaw } : {}),
    possibleUnitIds: [] as string[],
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
