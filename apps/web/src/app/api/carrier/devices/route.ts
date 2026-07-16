import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { formStr, formStrOrUndefined } from "@/lib/form";

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = formStr(formData, "carrierSlug");
  const imei = formStr(formData, "imei");
  const label = formStrOrUndefined(formData, "label");

  if (!imei) {
    return NextResponse.json({ error: "El IMEI es requerido" }, { status: 400 });
  }

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
