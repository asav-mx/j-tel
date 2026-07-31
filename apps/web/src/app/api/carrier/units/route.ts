import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = String(formData.get("carrierSlug") ?? "").trim();
  const g = await exigir(
    request,
    { tipo: "carrier", slug: carrierSlug },
    { redirigirA: `/carrier/flota?account=${encodeURIComponent(carrierSlug)}` },
  );
  if (!g.ok) return g.respuesta;

  const label = String(formData.get("label") ?? "").trim();
  const plateNumber = String(formData.get("plateNumber") ?? "").trim() || undefined;

  if (!label) {
    return NextResponse.json({ error: "El número / nombre de la unidad es requerido" }, { status: 400 });
  }

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  await repos.fleet.createUnit(carrier.id, label, plateNumber);
  return NextResponse.redirect(new URL(`/carrier/flota?account=${carrier.slug}`, request.url));
}
