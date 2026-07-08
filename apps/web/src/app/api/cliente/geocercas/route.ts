import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { circlePolygon, parseNumber } from "@/lib/geo";

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/configuracion/geocercas", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente/configuracion/geocercas", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  const plantId = String(formData.get("plantId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "destino").trim();
  const lat = parseNumber(formData.get("lat"));
  const lng = parseNumber(formData.get("lng"));
  const radius = parseNumber(formData.get("radiusMeters"));

  if (!plantId) return back(request, client.slug, { error: "Elige una planta." });
  if (!name) return back(request, client.slug, { error: "El nombre de la geocerca es obligatorio." });
  if (lat === null || lat < -90 || lat > 90)
    return back(request, client.slug, { error: "Latitud inválida (debe estar entre -90 y 90)." });
  if (lng === null || lng < -180 || lng > 180)
    return back(request, client.slug, { error: "Longitud inválida (debe estar entre -180 y 180)." });
  if (radius === null || radius <= 0 || radius > 20000)
    return back(request, client.slug, { error: "Radio inválido (metros, entre 1 y 20000)." });

  // La planta debe pertenecer al cliente activo.
  const plant = await repos.clients.getPlantById(plantId);
  if (!plant || plant.clientAccountId !== client.id) {
    return back(request, client.slug, { error: "La planta no pertenece a este cliente." });
  }

  const validRoles = ["destino", "base", "caseta", "otro"] as const;
  const geofenceRole = (validRoles as readonly string[]).includes(role)
    ? (role as (typeof validRoles)[number])
    : "destino";

  await repos.geofences.create({
    ownerType: "plant",
    ownerPlantId: plantId,
    role: geofenceRole,
    name,
    polygon: circlePolygon(lat, lng, radius),
  });

  return back(request, client.slug, { created: "geocerca" });
}
