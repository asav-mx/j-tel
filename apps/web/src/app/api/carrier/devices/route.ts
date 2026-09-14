import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { validarImei } from "@/lib/imei";

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = String(formData.get("carrierSlug") ?? "").trim();
  const g = await exigir(
    request,
    { tipo: "carrier", slug: carrierSlug },
    { redirigirA: `/carrier/flota?account=${encodeURIComponent(carrierSlug)}` },
  );
  if (!g.ok) return g.respuesta;

  const label = String(formData.get("label") ?? "").trim() || undefined;

  // Normaliza (fuera espacios y guiones) y valida largo y dígito verificador
  // ANTES de guardar. Un IMEI mal tecleado no truena en ninguna otra parte:
  // se registra, Traccar nunca lo recibe y la tabla no crece. Ver `@/lib/imei`.
  const validacion = validarImei(String(formData.get("imei") ?? ""));
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.motivo }, { status: 400 });
  }
  const imei = validacion.imei;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(carrierSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  try {
    await repos.fleet.createDevice(carrier.id, imei, label);
  } catch {
    return NextResponse.json(
      { error: "No se pudo registrar el GPS (¿IMEI duplicado?)" },
      { status: 400 },
    );
  }

  return NextResponse.redirect(new URL(`/carrier/flota?account=${carrier.slug}`, request.url));
}
