import { NextResponse } from "next/server";
import { cargarFlotaEnVivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { flotaParaPantalla } from "@/lib/casa/flota";

export const dynamic = "force-dynamic";

/**
 * Flota en vivo, la lectura que la pantalla pide cada 30 s.
 *
 * Devuelve exactamente lo mismo que la página dibuja al cargar
 * (`flotaParaPantalla`): la actualización no puede traducir distinto que la
 * primera carga. Sólo lee.
 *
 * La guardia es la del carrier de `account`: la flota de un transportista sólo
 * la ve el transportista.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuenta = url.searchParams.get("account")?.trim() ?? "";
  if (!cuenta) {
    return NextResponse.json({ error: "Falta la cuenta (account)." }, { status: 400 });
  }

  const g = await exigir(request, { tipo: "carrier", slug: cuenta }, "json");
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(cuenta);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "No hay un transportista con esa cuenta." }, { status: 404 });
  }

  const leida = new Date();
  const flota = await cargarFlotaEnVivo(repos, carrier.id, leida);
  const cuentaEnRuta = url.searchParams.get("enRuta") === "1" ? carrier.slug : null;
  return NextResponse.json(flotaParaPantalla(flota, { leida, cuenta: carrier.name, cuentaEnRuta }), {
    headers: { "Cache-Control": "no-store" },
  });
}
