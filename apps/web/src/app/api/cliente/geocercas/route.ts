import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";
import { circlePolygon, parseNumber } from "@/lib/geo";
import { parseOperationalScope } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";
import { redirectWithParams } from "@/lib/redirect";

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "geocercas", scope, params);
}

function scopeFromOwnerRef(ownerRef: string) {
  const [refKind, ownerId] = ownerRef.includes(":")
    ? (ownerRef.split(":") as [string, string])
    : ["plant", ownerRef];
  if (!ownerId) return { refKind, ownerId: "", redirectScope: null };
  const redirectScope =
    refKind === "plant_group"
      ? parseOperationalScope({ plantGroupId: ownerId })
      : parseOperationalScope({ plantId: ownerId });
  return { refKind, ownerId, redirectScope };
}

function parseGeofenceFields(formData: FormData) {
  const name = formStr(formData, "name");
  const role = formStr(formData, "role", "destino");
  const lat = parseNumber(formData.get("lat"));
  const lng = parseNumber(formData.get("lng"));
  const radius = parseNumber(formData.get("radiusMeters"));
  const validRoles = ["destino", "base", "caseta", "otro"] as const;
  const geofenceRole = (validRoles as readonly string[]).includes(role)
    ? (role as (typeof validRoles)[number])
    : "destino";
  return { name, geofenceRole, lat, lng, radius };
}

function validateGeofenceFields(
  fields: ReturnType<typeof parseGeofenceFields>,
): string | null {
  if (!fields.name) return "El nombre de la geocerca es obligatorio.";
  if (fields.lat === null || fields.lat < -90 || fields.lat > 90) {
    return "Latitud inválida (debe estar entre -90 y 90).";
  }
  if (fields.lng === null || fields.lng < -180 || fields.lng > 180) {
    return "Longitud inválida (debe estar entre -180 y 180).";
  }
  if (fields.radius === null || fields.radius <= 0 || fields.radius > 20000) {
    return "Radio inválido (metros, entre 1 y 20000).";
  }
  return null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = formStr(formData, "clientSlug");
  const action = formStr(formData, "action", "create");

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    return redirectWithParams(request, "/cliente", { error: "Cliente no encontrado." });
  }

  const ownerRef = formStr(formData, "ownerRef");
  const { refKind, ownerId, redirectScope } = scopeFromOwnerRef(ownerRef);

  if (action === "update") {
    const geofenceId = formStr(formData, "geofenceId");
    if (!geofenceId) {
      return back(request, client.slug, redirectScope, { error: "Geocerca no indicada." });
    }
    if (!(await repos.geofences.belongsToClient(geofenceId, client.id))) {
      return back(request, client.slug, redirectScope, { error: "Geocerca no encontrada." });
    }

    const fields = parseGeofenceFields(formData);
    const validationError = validateGeofenceFields(fields);
    if (validationError) {
      return back(request, client.slug, redirectScope, { error: validationError });
    }

    await repos.geofences.update(geofenceId, {
      name: fields.name,
      role: fields.geofenceRole,
      polygon: circlePolygon(fields.lat!, fields.lng!, fields.radius!),
    });
    return back(request, client.slug, redirectScope, { created: "geocerca_actualizada" });
  }

  if (action === "delete") {
    const geofenceId = formStr(formData, "geofenceId");
    if (!geofenceId) {
      return back(request, client.slug, redirectScope, { error: "Geocerca no indicada." });
    }
    if (!(await repos.geofences.belongsToClient(geofenceId, client.id))) {
      return back(request, client.slug, redirectScope, { error: "Geocerca no encontrada." });
    }

    const block = await repos.geofences.deleteBlockReason(geofenceId);
    if (block === "profiles") {
      return back(request, client.slug, redirectScope, {
        error: "No se puede eliminar: hay perfiles de servicio con esta geocerca. Elimínalos primero.",
      });
    }
    if (block === "occurrences") {
      return back(request, client.slug, redirectScope, {
        error: "No se puede eliminar: ya hay servicios generados con esta geocerca.",
      });
    }

    await repos.geofences.delete(geofenceId);
    return back(request, client.slug, redirectScope, { created: "geocerca_eliminada" });
  }

  // create (default)
  if (!ownerId) return back(request, client.slug, null, { error: "Elige planta o campus." });

  const fields = parseGeofenceFields(formData);
  const validationError = validateGeofenceFields(fields);
  if (validationError) {
    return back(request, client.slug, redirectScope, { error: validationError });
  }

  if (refKind === "plant_group") {
    const group = await repos.clients.getPlantGroupById(ownerId);
    if (!group || group.clientAccountId !== client.id) {
      return back(request, client.slug, redirectScope, { error: "El campus no pertenece a este cliente." });
    }
    await repos.geofences.create({
      ownerType: "plant_group",
      ownerPlantGroupId: ownerId,
      role: fields.geofenceRole,
      name: fields.name,
      polygon: circlePolygon(fields.lat!, fields.lng!, fields.radius!),
    });
  } else {
    const plant = await repos.clients.getPlantById(ownerId);
    if (!plant || plant.clientAccountId !== client.id) {
      return back(request, client.slug, redirectScope, { error: "La planta no pertenece a este cliente." });
    }
    await repos.geofences.create({
      ownerType: "plant",
      ownerPlantId: ownerId,
      role: fields.geofenceRole,
      name: fields.name,
      polygon: circlePolygon(fields.lat!, fields.lng!, fields.radius!),
    });
  }

  return back(request, client.slug, redirectScope, { created: "geocerca" });
}
