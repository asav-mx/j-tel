import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { formStr, formStrOrUndefined } from "@/lib/form";

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = formStr(formData, "carrierSlug");
  const label = formStr(formData, "label");
  const plateNumber = formStrOrUndefined(formData, "plateNumber");

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
