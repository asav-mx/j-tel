import { NextResponse } from "next/server";
import { darDeAltaUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * El alta vieja de unidades (/carrier/flota). Sigue viva hasta C4-d.
 *
 * Desde C4-e pasa por la misma acción que la casa nueva (`darDeAltaUnidad`):
 * nombre limpio y **ningún nombre repetido en la cuenta**. La 2101 duplicada de
 * juarez-bus del 18 sep 2026 nació por aquí o por algo igual de sin candado.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = String(formData.get("carrierSlug") ?? "").trim();
  const g = await exigir(
    request,
    { tipo: "carrier", slug: carrierSlug },
    { redirigirA: `/carrier/flota?account=${encodeURIComponent(carrierSlug)}` },
  );
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  const r = await darDeAltaUnidad(repos, {
    carrierId: carrier.id,
    nombre: String(formData.get("label") ?? ""),
    placa: String(formData.get("plateNumber") ?? ""),
    vin: "",
  });
  if (!r.ok) return NextResponse.json({ error: r.mensaje }, { status: 400 });
  return NextResponse.redirect(new URL(`/carrier/flota?account=${carrier.slug}`, request.url));
}
