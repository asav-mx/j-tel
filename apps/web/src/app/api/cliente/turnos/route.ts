import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { parseOperationalScope, operationalScopeColumns } from "@jtel/domain";
import { configApiBack } from "@/lib/config-api-back";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function back(
  request: Request,
  slug: string,
  scope: ReturnType<typeof parseOperationalScope>,
  params: Record<string, string>,
) {
  return configApiBack(request, slug, "turnos", scope, params);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientSlug = String(formData.get("clientSlug") ?? "").trim();

  // Ancla de todo lo que sigue: las comprobaciones de pertenencia que esta
  // ruta ya hacía comparaban contra el cliente que decía el cuerpo.
  const g = await exigir(request, { tipo: "cliente", slug: clientSlug }, { redirigirA: "/cliente" });
  if (!g.ok) return g.respuesta;
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
    return back(request, client.slug, null, { error: "Elige un sitio." });
  }

  const scope = await repos.clients.resolveOperationalScope(client.id, parsedScope);
  if (!scope) {
    // No resolvió: el alcance del formulario no existe, así que no hay página
    // de sitio a la cual volver. El aviso va al inicio corporativo.
    return back(request, client.slug, null, { error: "Sitio no válido." });
  }

  const scopeCols = operationalScopeColumns(scope);

  if (action === "shift") {
    const name = String(formData.get("name") ?? "").trim();
    const startTimeRaw = String(formData.get("startTime") ?? "").trim();
    const startTime = startTimeRaw.length >= 5 ? startTimeRaw.slice(0, 5) : startTimeRaw;
    if (!name) return back(request, client.slug, scope, { error: "El nombre del turno es obligatorio." });
    if (!TIME_RE.test(startTime)) {
      return back(request, client.slug, scope, {
        error: `Hora de inicio inválida (${startTimeRaw || "vacía"}). Usa formato HH:MM, ej. 07:00.`,
      });
    }
    const startTimeDb = `${startTime}:00`;
    const duplicate = await repos.routes.findShiftByNameAndTime(scope, name, startTimeDb);
    if (duplicate) {
      return back(request, client.slug, scope, {
        error: `Ya existe el turno «${name}» con inicio ${startTime}.`,
      });
    }
    await repos.routes.createShift({
      clientAccountId: client.id,
      ...scopeCols,
      name,
      startTime: startTimeDb,
    });
    return back(request, client.slug, scope, { created: "turno" });
  }

  if (action === "updateShift") {
    const shiftId = String(formData.get("shiftId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const startTimeRaw = String(formData.get("startTime") ?? "").trim();
    const startTime = startTimeRaw.length >= 5 ? startTimeRaw.slice(0, 5) : startTimeRaw;
    if (!shiftId) return back(request, client.slug, scope, { error: "Turno no indicado." });
    if (!name) return back(request, client.slug, scope, { error: "El nombre del turno es obligatorio." });
    if (!TIME_RE.test(startTime)) {
      return back(request, client.slug, scope, {
        error: `Hora de inicio inválida (${startTimeRaw || "vacía"}). Usa formato HH:MM, ej. 07:00.`,
      });
    }
    const startTimeDb = `${startTime}:00`;
    const result = await repos.routes.updateShift(shiftId, client.id, scope, {
      name,
      startTime: startTimeDb,
    });
    if (!result.ok) {
      if (result.reason === "not_found") {
        return back(request, client.slug, scope, { error: "Turno no encontrado." });
      }
      return back(request, client.slug, scope, {
        error: `Ya existe el turno «${name}» con inicio ${startTime}.`,
      });
    }
    return back(request, client.slug, scope, { created: "turno_actualizado" });
  }

  if (action === "deleteShift") {
    const shiftId = String(formData.get("shiftId") ?? "").trim();
    if (!shiftId) return back(request, client.slug, scope, { error: "Turno no indicado." });
    const result = await repos.routes.deleteShift(shiftId, client.id, scope);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return back(request, client.slug, scope, { error: "Turno no encontrado." });
      }
      if (result.reason === "profiles") {
        return back(request, client.slug, scope, {
          error: "No se puede eliminar: hay rutas o perfiles de servicio con este turno. Elimínalos primero.",
        });
      }
      return back(request, client.slug, scope, {
        error: "No se puede eliminar: ya hay servicios verificados con este turno.",
      });
    }
    return back(request, client.slug, scope, { created: "turno_eliminado" });
  }

  return back(request, client.slug, scope, { error: "Acción no reconocida." });
}
