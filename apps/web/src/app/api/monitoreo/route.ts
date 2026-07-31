import { NextResponse } from "next/server";
import { loadMonitoreo } from "@/lib/monitoreo-data";
import { exigir } from "@/lib/guardia-api";
import type { OperationalScope } from "@jtel/domain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fecha = url.searchParams.get("fecha")?.trim() ?? "";
  const turno = url.searchParams.get("turno")?.trim() ?? "";
  const account = url.searchParams.get("account")?.trim() ?? "";
  const groupId = url.searchParams.get("groupId")?.trim() ?? "";
  const plantId = url.searchParams.get("plantId")?.trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !turno || !account || (!groupId && !plantId)) {
    return NextResponse.json(
      { error: "Requiere fecha (YYYY-MM-DD), turno, account y groupId|plantId" },
      { status: 400 },
    );
  }

  // Lectura de la operación de una planta: solo su cliente.
  const g = await exigir(request, { tipo: "cliente", slug: account }, "json");
  if (!g.ok) return g.respuesta;

  const scope: OperationalScope = plantId
    ? { kind: "plant", plantId }
    : { kind: "plant_group", plantGroupId: groupId };

  const data = await loadMonitoreo({
    scope,
    accountSlug: account,
    fecha,
    turnoId: turno,
  });
  if (!data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json(data);
}
