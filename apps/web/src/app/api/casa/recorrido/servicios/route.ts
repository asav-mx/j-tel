import { NextResponse } from "next/server";
import { JTTEL_TZ } from "@jtel/domain";
import { serviciosDeUnidadEnDia } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * GET /api/casa/recorrido/servicios?account=<slug>&unidad=<id>&dia=YYYY-MM-DD
 *
 * Los servicios declarados de una unidad en un día: los atajos de la operación
 * del recorrido (ficha C3, decisión 2). Sin caché: la sección reservada depende
 * de los contratos y concesiones vigentes, y el horario de un circuito sólo se
 * ofrece el día de hoy.
 */
export const dynamic = "force-dynamic";

function error(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuenta = url.searchParams.get("account")?.trim() ?? "";
  if (!cuenta) return error("Falta la cuenta (account).", 400);

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, "json");
  if (!g.ok) return g.respuesta;

  const unitId = url.searchParams.get("unidad")?.trim() ?? "";
  if (!unitId) return error("Falta la unidad (unidad).", 400);
  const dia = url.searchParams.get("dia") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(Date.parse(`${dia}T12:00:00Z`))) {
    return error("El día va como AAAA-MM-DD.", 400);
  }

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") return error("No hay un transportista con esa cuenta.", 404);

  const servicios = await serviciosDeUnidadEnDia(repos, {
    carrierAccountId: carrier.id,
    unitId,
    dia,
    ahora: new Date(),
    timeZone: JTTEL_TZ,
  });
  if (!servicios) return error("Esa unidad no es de esta cuenta.", 404);
  return NextResponse.json(servicios, { headers: { "Cache-Control": "no-store" } });
}
