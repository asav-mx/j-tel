import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { formStr } from "@/lib/form";

export async function POST(request: Request) {
  const form = await request.formData();
  const contractId = formStr(form, "contractId");
  const serviceDate = formStr(form, "serviceDate");
  const expectedAllCumplido =
    form.get("expectedAllCumplido") === "true" || form.get("expectedAllCumplido") === "on";
  const notes = formStr(form, "notes") || null;
  const recordedBy = formStr(form, "recordedBy", "jstaff") || "jstaff";

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
