import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { parseNumber } from "@/lib/geo";
import { parseKmlWaypoints } from "@/lib/kml";
import { parseOperationalScope, operationalScopeColumns } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";

export const maxDuration = 60;

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "rutas", scope, params);
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
  error?: string;
}> {
  const file = formData.get("kmlFile");
  if (file instanceof File && file.size > 0) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".kmz")) {
      return {
        error:
          "KMZ aún no soportado en subida directa. Exporta el trazado como .kml o pega waypoints.",
      };
    }
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
  let clientSlug = "";
  let scope: ReturnType<typeof parseOperationalScope> = null;

  try {
    const formData = await request.formData();
    clientSlug = String(formData.get("clientSlug") ?? "").trim();
    const plantId = String(formData.get("plantId") ?? "").trim();
    const plantGroupId = String(formData.get("plantGroupId") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();

    const repos = getRepos();
    const client = await repos.accounts.findBySlug(clientSlug);
    if (!client || client.type !== "client") {
      const url = new URL("/cliente", request.url);
      url.searchParams.set("error", "Cliente no encontrado.");
      return NextResponse.redirect(url, 303);
    }

    const parsedScope = parseOperationalScope({ plantId, plantGroupId });
    if (!parsedScope) {
      return back(request, client.slug, null, { error: "Elige una unidad operativa." });
    }

    scope = await repos.clients.resolveOperationalScope(client.id, parsedScope);
    if (!scope) {
      return back(request, client.slug, parsedScope, { error: "Unidad operativa no válida." });
    }

    const scopeCols = operationalScopeColumns(scope);

    if (action === "route") {
      const name = String(formData.get("name") ?? "").trim();
      const shiftId = String(formData.get("shiftId") ?? "").trim();
      if (!name) {
        return back(request, client.slug, scope, { error: "El nombre de la ruta es obligatorio." });
      }
      if (!shiftId) {
        return back(request, client.slug, scope, {
          error: "Elige un turno registrado en Turnos.",
        });
      }
      const shift = await repos.routes.findShiftInScope(shiftId, client.id, scope);
      if (!shift) {
        return back(request, client.slug, scope, { error: "Turno no válido para esta unidad." });
      }
      const duplicate = await repos.routes.findRouteShiftByNameAndShift(scope, name, shiftId);
      if (duplicate) {
        return back(request, client.slug, scope, {
          error: `Ya existe la ruta «${name}» para el turno «${shift.name}».`,
        });
      }
      const kml = await readKmlFromForm(formData);
      if (kml.error) {
        return back(request, client.slug, scope, { error: kml.error });
      }
      try {
        await repos.routes.createRouteWithShift({
          clientAccountId: client.id,
          ...scopeCols,
          name,
          shiftId,
          kmlContent: kml.kmlContent,
          waypoints: kml.waypoints,
        });
      } catch (err) {
        console.error("[rutas] createRouteWithShift failed:", err);
        return back(request, client.slug, scope, {
          error: "No se pudo crear la ruta. Revisa turno y trazado.",
        });
      }
      return back(request, client.slug, scope, { created: "ruta" });
    }

    if (action === "updateRouteShift") {
      const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
      const name = String(formData.get("name") ?? "").trim();
      const shiftId = String(formData.get("shiftId") ?? "").trim();
      if (!routeShiftId) {
        return back(request, client.slug, scope, { error: "Ruta no indicada." });
      }
      if (!name) {
        return back(request, client.slug, scope, { error: "El nombre de la ruta es obligatorio." });
      }
      if (!shiftId) {
        return back(request, client.slug, scope, { error: "Elige un turno." });
      }
      const result = await repos.routes.updateRouteShift(routeShiftId, client.id, scope, {
        name,
        shiftId,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return back(request, client.slug, scope, { error: "Ruta no encontrada." });
        }
        if (result.reason === "invalid_shift") {
          return back(request, client.slug, scope, { error: "Turno no válido para esta unidad." });
        }
        const shift = await repos.routes.findShiftInScope(shiftId, client.id, scope);
        return back(request, client.slug, scope, {
          error: `Ya existe la ruta «${name}» para el turno «${shift?.name ?? "elegido"}».`,
        });
      }
      return back(request, client.slug, scope, { created: "ruta_actualizada" });
    }

    if (action === "deleteRouteShift") {
      const routeShiftId = String(formData.get("routeShiftId") ?? "").trim();
      if (!routeShiftId) return back(request, client.slug, scope, { error: "Ruta no indicada." });
      const result = await repos.routes.deleteRouteShift(routeShiftId, client.id, scope);
      if (!result.ok) {
        if (result.reason === "not_found") {
          return back(request, client.slug, scope, { error: "Ruta no encontrada." });
        }
        if (result.reason === "profiles") {
          return back(request, client.slug, scope, {
            error: "No se puede eliminar: hay perfiles de servicio con esta ruta. Elimínalos primero.",
          });
        }
        return back(request, client.slug, scope, {
          error: "No se puede eliminar: ya hay servicios verificados con esta ruta.",
        });
      }
      return back(request, client.slug, scope, { created: "ruta_eliminada" });
    }

    if (action === "kml") {
      const routeId = String(formData.get("routeId") ?? "").trim();
      if (!routeId) return back(request, client.slug, scope, { error: "Elige una ruta." });
      const kml = await readKmlFromForm(formData);
      if (kml.error) {
        return back(request, client.slug, scope, { error: kml.error });
      }
      if (!kml.kmlContent) {
        return back(request, client.slug, scope, { error: "Sube un archivo KML/KMZ o pega waypoints." });
      }
      await repos.routes.addKmlVersion({
        routeId,
        kmlContent: kml.kmlContent,
        waypoints: kml.waypoints,
      });
      return back(request, client.slug, scope, { created: "kml" });
    }

    return back(request, client.slug, scope, { error: "Acción no reconocida." });
  } catch (err) {
    console.error("[rutas] POST failed:", err);
    if (clientSlug) {
      return back(request, clientSlug, scope, {
        error: "Error al procesar la solicitud. Si subiste un archivo grande, prueba con .kml más pequeño.",
      });
    }
    const url = new URL("/cliente", request.url);
    url.searchParams.set("error", "Error al procesar la solicitud.");
    return NextResponse.redirect(url, 303);
  }
}
