import { NextResponse } from "next/server";
import { loadJornada } from "@/lib/jornada-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fecha = url.searchParams.get("fecha")?.trim() ?? "";
  const turno = url.searchParams.get("turno")?.trim() ?? "";
  const account = url.searchParams.get("account")?.trim() ?? "";
  const groupId = url.searchParams.get("groupId")?.trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !turno || !account || !groupId) {
    return NextResponse.json(
      { error: "Requiere fecha (YYYY-MM-DD), turno, account y groupId" },
      { status: 400 },
    );
  }

  const data = await loadJornada({
    plantGroupId: groupId,
    accountSlug: account,
    fecha,
    turnoId: turno,
  });
  if (!data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json(data);
}
