import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";

export async function POST(request: Request) {
  const formData = await request.formData();
  const carrierSlug = formStr(formData, "carrierSlug");
  const unitId = formStr(formData, "unitId");
  const deviceId = formStr(formData, "deviceId");

  if (!unitId || !deviceId) {
    return NextResponse.json(
      { error: "Debes elegir una unidad y un GPS" },
      { status: 400 },
    );
  }

  const repos = getRepos();
  await repos.fleet.assignDevice(unitId, deviceId, new Date());
  const account = carrierSlug ? `?account=${encodeURIComponent(carrierSlug)}` : "";
  return NextResponse.redirect(new URL(`/carrier/flota${account}`, request.url));
}
