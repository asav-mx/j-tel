import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
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

    // Ancla de todo lo que sigue: las comprobaciones de pertenencia que esta
    // ruta ya hacía comparaban contra el cliente que decía el cuerpo.
    const g = await exigir(request, { tipo: "cliente", slug: clientSlug }, { redirigirA: "/cliente" });
    if (!g.ok) return g.respuesta;

    const repos = getRepos();
    const client = await repos.accounts.findBySlug(clientSlug);
    if (!client || client.type !== "client") {
      const url = new URL("/cliente", request.url);
      url.searchParams.set("error", "Cliente no encontrado.");
      return NextResponse.redirect(url, 303);
    }

    const parsedScope = parseOperationalScope({ plantId, plantGroupId });
    if (!parsedScope) {
      return back(request, client.slug, null, { error: "Elige un sitio." });
    }

    scope = await repos.clients.resolveOperationalScope(client.id, parsedScope);
    if (!scope) {
      // No resolvió: sin sitio no hay página a la cual volver (ver configApiBack).
      return back(request, client.slug, null, { error: "Sitio no válido." });
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
      const variantId = String(formData.get("variantId") ?? "").trim() || undefined;
      const kml = await readKmlFromForm(formData);
      if (kml.error) {
        return back(request, client.slug, scope, { error: kml.error });
      }
      if (!kml.kmlContent) {
        return back(request, client.slug, scope, { error: "Sube un archivo KML/KMZ o pega waypoints." });
      }
      await repos.routes.addKmlVersion({
        routeId,
        variantId,
        kmlContent: kml.kmlContent,
        waypoints: kml.waypoints,
      });
      return back(request, client.slug, scope, { created: "kml" });
    }

    // --- Variantes de trazado ---
    // VARIANTE = caminos alternos que coexisten hoy (ej. MEX-45 o Panamericana).
    // NO confundir con VERSIÓN = historia temporal de una variante.

    if (action === "variant_create") {
      const routeId = String(formData.get("routeId") ?? "").trim();
      const variantName = String(formData.get("variantName") ?? "").trim();
      if (!routeId) return back(request, client.slug, scope, { error: "Elige una ruta." });
      if (!variantName) return back(request, client.slug, scope, { error: "Nombre de variante obligatorio." });

      const kml = await readKmlFromForm(formData);
      if (kml.error) return back(request, client.slug, scope, { error: kml.error });
      if (!kml.kmlContent) {
        return back(request, client.slug, scope, { error: "Sube un KML o pega waypoints para la variante." });
      }

      const variant = await repos.routes.createVariant(client.id, scope, { routeId, name: variantName });
      if (!variant) {
        return back(request, client.slug, scope, { error: "Ruta no válida para esta unidad." });
      }
      await repos.routes.addKmlVersion({
        routeId,
        variantId: variant.id,
        kmlContent: kml.kmlContent,
        waypoints: kml.waypoints,
      });
      return back(request, client.slug, scope, { created: "variante_creada" });
    }

    if (action === "variant_status") {
      const variantId = String(formData.get("variantId") ?? "").trim();
      const newStatus = String(formData.get("status") ?? "").trim();
      if (!variantId || !["activa", "legacy"].includes(newStatus)) {
        return back(request, client.slug, scope, { error: "Datos de variante inválidos." });
      }
      const result = await repos.routes.updateVariantStatus(
        variantId,
        client.id,
        scope,
        newStatus as "activa" | "legacy",
      );
      if (!result.ok) {
        if (result.reason === "last_active") {
          return back(request, client.slug, scope, {
            error: "No se puede dejar la ruta sin variantes activas. El motor necesita al menos una para verificar.",
          });
        }
        return back(request, client.slug, scope, { error: "Variante no encontrada." });
      }
      return back(request, client.slug, scope, { created: "variante_actualizada" });
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
