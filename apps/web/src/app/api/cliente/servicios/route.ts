import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import {
  createServiceProfileSchema,
  geofenceMatchesScope,
  operationalScopeFromContract,
  parseOperationalScope,
  scopedRowMatches,
  dayForDateQuery,
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

  // Ancla de todo lo que sigue: las comprobaciones de pertenencia que esta
  // ruta ya hacía comparaban contra el cliente que decía el cuerpo.
  const g = await exigir(request, { tipo: "cliente", slug: clientSlug }, { redirigirA: "/cliente" });
  if (!g.ok) return g.respuesta;
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

    /*
     * Pertenecer a la cuenta y ser dueño del recurso son preguntas distintas.
     *
     * La guardia de arriba demuestra que perteneces a este cliente; no dice
     * nada del `profileId` que mandas. `generateForProfile` recibe el id
     * crudo y no filtra por cuenta, así que sin esto un cliente autenticado
     * podía generar ocurrencias sobre el perfil de OTRO cliente — creando
     * servicios esperados en una operación ajena. Es la misma lección que
     * dejó `carrier/assign`.
     */
    const perfilDestino = await repos.profiles.findById(profileId);
    if (!perfilDestino || perfilDestino.contract?.clientAccountId !== client.id) {
      return back(request, client.slug, formScope, { error: "Perfil no encontrado." });
    }
    // Mediodía UTC vía la función canónica: construir la fecha a mano la
    // resolvería en la zona del proceso, que es el defecto que corrió los
    // deadlines seis horas. Aquí solo acota un rango, pero el patrón no se
    // repite ni donde no muerde.
    const from = dayForDateQuery(fromDate);
    const to = dayForDateQuery(toDate);
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
    } catch {
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
      // No resolvió: sin sitio no hay página a la cual volver (ver configApiBack).
      return back(request, client.slug, null, { error: "Sitio no válido." });
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
        error: "La ruta + turno no pertenecen a este sitio.",
      });
    }

    const geofence = geofenceId ? await repos.geofences.findById(geofenceId) : null;
    if (!geofence) {
      return back(request, client.slug, scope, { error: "Geocerca no encontrada." });
    }

    const memberPlantIds = await memberPlantIdsForScope(repos, client.id, scope);
    if (!geofenceMatchesScope(geofence, scope, memberPlantIds)) {
      return back(request, client.slug, scope, {
        error: "La geocerca no corresponde a este sitio.",
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
      // No resolvió: sin sitio no hay página a la cual volver (ver configApiBack).
      return back(request, client.slug, null, { error: "Sitio no válido." });
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
    return back(request, client.slug, null, { error: "Elige un sitio." });
  }

  const scope = await repos.clients.resolveOperationalScope(client.id, formScope);
  if (!scope) {
    // No resolvió: sin sitio no hay página a la cual volver (ver configApiBack).
    return back(request, client.slug, null, { error: "Sitio no válido." });
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
      error: "El contrato no corresponde al sitio seleccionado.",
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
      error: "La ruta + turno no pertenecen a este sitio.",
    });
  }

  const geofence = geofenceId ? await repos.geofences.findById(geofenceId) : null;
  if (!geofence) {
    return back(request, client.slug, scope, { error: "Geocerca no encontrada." });
  }

  const memberPlantIds = await memberPlantIdsForScope(repos, client.id, scope);
  if (!geofenceMatchesScope(geofence, scope, memberPlantIds)) {
    return back(request, client.slug, scope, {
      error: "La geocerca no corresponde a este sitio.",
    });
  }

  // ── Tres categorías de unidades (Marco Pieza 4) ──────────────────────────
  // 1. Unidad OBSERVADA: identificada por el árbitro sirviendo ESA planta.
  //    La planta SÍ la ve (verdad operativa).
  // 2. Catálogo DECLARADO (possibleUnitIds / serviceProfileUnits): unidades
  //    que el carrier asigna a este contrato. La planta SÍ lo ve (declarativo,
  //    inspecciones, cumplimiento legal). Si está vacío, el motor evalúa TODA
  //    la flota del carrier (ver verification.ts → getPossibleUnitIds).
  //    Hoy se guarda vacío — la pantalla de asignación es una ficha aparte.
  // 3. Inventario COMPLETO del carrier: NUNCA visible para la planta.
  //    Ni la lista, ni etiquetas, ni telemetría, ni conteos.
  //
  // NO entregar getUnitsForCarrier a la cara cliente bajo ningún concepto.
  // Si un mapa queda vacío sin unidad observada, eso es correcto.
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
