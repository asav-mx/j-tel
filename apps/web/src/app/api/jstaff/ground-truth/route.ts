import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: "/jstaff/verificacion" });
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const contractId = String(form.get("contractId") ?? "").trim();
  const serviceDate = String(form.get("serviceDate") ?? "").trim();
  const expectedAllCumplido =
    form.get("expectedAllCumplido") === "true" || form.get("expectedAllCumplido") === "on";
  const notes = String(form.get("notes") ?? "").trim() || null;
  const recordedBy = String(form.get("recordedBy") ?? "jstaff").trim() || "jstaff";

  if (!contractId || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return NextResponse.json(
      { error: "contractId y serviceDate (YYYY-MM-DD) son requeridos" },
      { status: 400 },
    );
  }

  const repos = getRepos();
  const contract = await repos.contracts.findById(contractId);
  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  await repos.groundTruth.upsert({
    contractId,
    serviceDate,
    expectedAllCumplido,
    notes,
    recordedBy,
  });

  return NextResponse.redirect(new URL("/jstaff/verificacion", request.url));
}
