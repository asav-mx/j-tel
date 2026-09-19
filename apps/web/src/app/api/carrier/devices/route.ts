import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { validarImei } from "@jtel/domain";
import { nombreDeDispositivoEnUso } from "@jtel/services";

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
  // se registra, Traccar nunca lo recibe y la tabla no crece. Ver `imei.ts` en `@jtel/domain`.
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

  // Ningún nombre repetido entre los dispositivos en servicio de la cuenta
  // (C4-e). El alta nueva no lo necesita —el nombre lo pone el sistema—, pero
  // ésta todavía deja teclearlo. La base lo garantiza igual (0040).
  const YA_HAY = "Ya hay un GPS en servicio con ese nombre en esta cuenta.";
  if (label && (await nombreDeDispositivoEnUso(repos, carrier.id, label))) {
    return NextResponse.json({ error: YA_HAY }, { status: 400 });
  }

  try {
    await repos.fleet.createDevice(carrier.id, imei, label);
  } catch (e) {
    const x = e as { constraint_name?: string; cause?: { constraint_name?: string } };
    const candado = x?.constraint_name ?? x?.cause?.constraint_name;
    return NextResponse.json(
      { error: candado === "devices_nombre_unico_en_servicio" ? YA_HAY : "No se pudo registrar el GPS (¿IMEI duplicado?)" },
      { status: 400 },
    );
  }

  return NextResponse.redirect(new URL(`/carrier/flota?account=${carrier.slug}`, request.url));
}
