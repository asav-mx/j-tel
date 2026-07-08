import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export async function POST(request: Request) {
  const formData = await request.formData();
  const unitId = String(formData.get("unitId") ?? "").trim();
  const deviceId = String(formData.get("deviceId") ?? "").trim();

  if (!unitId || !deviceId) {
    return NextResponse.json(
      { error: "Debes elegir una unidad y un GPS" },
      { status: 400 },
    );
  }

  const repos = getRepos();
  await repos.fleet.assignDevice(unitId, deviceId, new Date());
  return NextResponse.redirect(new URL("/carrier/flota", request.url));
}
