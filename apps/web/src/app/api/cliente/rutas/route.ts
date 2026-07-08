import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { parseNumber } from "@/lib/geo";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/configuracion/rutas", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

/** Parsea waypoints desde texto con líneas "lat,lng". Ignora líneas vacías. */
function parseWaypoints(text: string): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    if (parts.length < 2) continue;
    const lat = parseNumber(parts[0]);
    const lng = parseNumber(parts[1]);
    if (lat === null || lng === null) continue;
    out.push({ lat, lng });
  }
  return out;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente/configuracion/rutas", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  if (action === "route") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return back(request, client.slug, { error: "El nombre de la ruta es obligatorio." });
    await repos.routes.createRoute(client.id, name);
    return back(request, client.slug, { created: "ruta" });
  }

  if (action === "shift") {
    const name = String(formData.get("name") ?? "").trim();
    const startTime = String(formData.get("startTime") ?? "").trim();
    if (!name) return back(request, client.slug, { error: "El nombre del turno es obligatorio." });
    if (!TIME_RE.test(startTime))
      return back(request, client.slug, { error: "Hora de inicio inválida (usa HH:MM)." });
    await repos.routes.createShift(client.id, name, startTime);
    return back(request, client.slug, { created: "turno" });
  }

  if (action === "routeshift") {
    const routeId = String(formData.get("routeId") ?? "").trim();
    const shiftId = String(formData.get("shiftId") ?? "").trim();
    const deadlineTime = String(formData.get("deadlineTime") ?? "").trim();
    const waypointsText = String(formData.get("waypoints") ?? "").trim();

    if (!routeId || !shiftId)
      return back(request, client.slug, { error: "Elige ruta y turno." });
    if (!TIME_RE.test(deadlineTime))
      return back(request, client.slug, { error: "Hora límite inválida (usa HH:MM)." });

    const waypoints = waypointsText ? parseWaypoints(waypointsText) : [];
    const kmlContent =
      waypoints.length > 0 ? JSON.stringify({ waypoints }) : undefined;

    try {
      await repos.routes.createRouteShift({
        clientAccountId: client.id,
        routeId,
        shiftId,
        deadlineTime,
        kmlContent,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
      });
    } catch {
      return back(request, client.slug, {
        error: "Ya existe esta combinación de ruta + turno.",
      });
    }
    return back(request, client.slug, { created: "routeshift" });
  }

  return back(request, client.slug, { error: "Acción no reconocida." });
}
