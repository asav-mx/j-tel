import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { parseNumber } from "@/lib/geo";
import { parseKmlWaypoints } from "@/lib/kml";
import { parseOperationalScope, operationalScopeColumns } from "@jtel/domain";
import { scopeQueryParams } from "@/lib/operational-scope";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function back(request: Request, slug: string, params: Record<string, string>) {
  const url = new URL("/cliente/configuracion/rutas", request.url);
  url.searchParams.set("account", slug);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

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

async function readKmlFromForm(formData: FormData): Promise<{
  kmlContent?: string;
  waypoints?: Array<{ lat: number; lng: number }>;
}> {
  const file = formData.get("kmlFile");
  if (file instanceof File && file.size > 0) {
    const kmlContent = await file.text();
    const waypoints = parseKmlWaypoints(kmlContent);
    return { kmlContent, waypoints: waypoints.length > 0 ? waypoints : undefined };
  }
  const waypointsText = String(formData.get("waypoints") ?? "").trim();
  if (!waypointsText) return {};
  const waypoints = parseWaypoints(waypointsText);
  if (waypoints.length === 0) return {};
  return { kmlContent: JSON.stringify({ waypoints }), waypoints };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();
  const plantId = String(formData.get("plantId") ?? "").trim();
  const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(clientSlug);
  if (!client || client.type !== "client") {
    const url = new URL("/cliente/configuracion/rutas", request.url);
    url.searchParams.set("error", "Cliente no encontrado.");
    return NextResponse.redirect(url, 303);
  }

  const parsedScope = parseOperationalScope({ plantId, plantGroupId });
  if (!parsedScope) {
    return back(request, client.slug, { error: "Elige una unidad operativa." });
  }

  const scope = await repos.clients.resolveOperationalScope(client.id, parsedScope);
  if (!scope) {
    return back(request, client.slug, { error: "Unidad operativa no válida." });
  }

  const scopeParams = scopeQueryParams(scope);
  const scopeCols = operationalScopeColumns(scope);

  if (action === "route") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return back(request, client.slug, { ...scopeParams, error: "El nombre de la ruta es obligatorio." });
    }
    const route = await repos.routes.createRoute({
      clientAccountId: client.id,
      ...scopeCols,
      name,
    });
    const kml = await readKmlFromForm(formData);
    if (kml.kmlContent) {
      await repos.routes.addKmlVersion({
        routeId: route.id,
        kmlContent: kml.kmlContent,
        waypoints: kml.waypoints,
      });
    }
    return back(request, client.slug, { ...scopeParams, created: "ruta" });
  }

  if (action === "shift") {
    const name = String(formData.get("name") ?? "").trim();
    const startTime = String(formData.get("startTime") ?? "").trim();
    if (!name) return back(request, client.slug, { ...scopeParams, error: "El nombre del turno es obligatorio." });
    if (!TIME_RE.test(startTime)) {
      return back(request, client.slug, { ...scopeParams, error: "Hora de inicio inválida (usa HH:MM)." });
    }
    await repos.routes.createShift({
      clientAccountId: client.id,
      ...scopeCols,
      name,
      startTime,
    });
    return back(request, client.slug, { ...scopeParams, created: "turno" });
  }

  if (action === "kml") {
    const routeId = String(formData.get("routeId") ?? "").trim();
    if (!routeId) return back(request, client.slug, { ...scopeParams, error: "Elige una ruta." });
    const kml = await readKmlFromForm(formData);
    if (!kml.kmlContent) {
      return back(request, client.slug, { ...scopeParams, error: "Sube un archivo KML/KMZ o pega waypoints." });
    }
    await repos.routes.addKmlVersion({
      routeId,
      kmlContent: kml.kmlContent,
      waypoints: kml.waypoints,
    });
    return back(request, client.slug, { ...scopeParams, created: "kml" });
  }

  if (action === "routeshift") {
    const routeId = String(formData.get("routeId") ?? "").trim();
    const shiftId = String(formData.get("shiftId") ?? "").trim();
    if (!routeId || !shiftId) {
      return back(request, client.slug, { ...scopeParams, error: "Elige ruta y turno." });
    }
    try {
      await repos.routes.createRouteShift({
        clientAccountId: client.id,
        ...scopeCols,
        routeId,
        shiftId,
      });
    } catch {
      return back(request, client.slug, {
        ...scopeParams,
        error: "Ya existe esta combinación de ruta + turno.",
      });
    }
    return back(request, client.slug, { ...scopeParams, created: "routeshift" });
  }

  return back(request, client.slug, { ...scopeParams, error: "Acción no reconocida." });
}
