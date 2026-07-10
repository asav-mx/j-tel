import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { circlePolygon, parseNumber } from "@/lib/geo";
import { parseOperationalScope } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "geocercas", scope, params);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  const ownerRef = String(formData.get("ownerRef") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "destino").trim();
  const lat = parseNumber(formData.get("lat"));
  const lng = parseNumber(formData.get("lng"));
  const radius = parseNumber(formData.get("radiusMeters"));

  const [refKind, ownerId] = ownerRef.includes(":")
    ? (ownerRef.split(":") as [string, string])
    : ["plant", ownerRef];

  const redirectScope =
    refKind === "plant_group" && ownerId
      ? parseOperationalScope({ plantGroupId: ownerId })
      : ownerId
        ? parseOperationalScope({ plantId: ownerId })
        : null;

  if (!ownerId) return back(request, client.slug, null, { error: "Elige planta o campus." });
  if (!name) return back(request, client.slug, redirectScope, { error: "El nombre de la geocerca es obligatorio." });
  if (lat === null || lat < -90 || lat > 90)
    return back(request, client.slug, redirectScope, { error: "Latitud inválida (debe estar entre -90 y 90)." });
  if (lng === null || lng < -180 || lng > 180)
    return back(request, client.slug, redirectScope, { error: "Longitud inválida (debe estar entre -180 y 180)." });
  if (radius === null || radius <= 0 || radius > 20000)
    return back(request, client.slug, redirectScope, { error: "Radio inválido (metros, entre 1 y 20000)." });

  const validRoles = ["destino", "base", "caseta", "otro"] as const;
  const geofenceRole = (validRoles as readonly string[]).includes(role)
    ? (role as (typeof validRoles)[number])
    : "destino";

  if (refKind === "plant_group") {
    const group = await repos.clients.getPlantGroupById(ownerId);
    if (!group || group.clientAccountId !== client.id) {
      return back(request, client.slug, redirectScope, { error: "El campus no pertenece a este cliente." });
    }
    await repos.geofences.create({
      ownerType: "plant_group",
      ownerPlantGroupId: ownerId,
      role: geofenceRole,
      name,
      polygon: circlePolygon(lat, lng, radius),
    });
  } else {
    const plant = await repos.clients.getPlantById(ownerId);
    if (!plant || plant.clientAccountId !== client.id) {
      return back(request, client.slug, redirectScope, { error: "La planta no pertenece a este cliente." });
    }
    await repos.geofences.create({
      ownerType: "plant",
      ownerPlantId: ownerId,
      role: geofenceRole,
      name,
      polygon: circlePolygon(lat, lng, radius),
    });
  }

  return back(request, client.slug, redirectScope, { created: "geocerca" });
}
