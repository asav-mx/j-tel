import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

export async function POST(request: Request) {
  // Purga/operación de J-Staff: se comprueba ANTES de leer o tocar nada.
  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: "/jstaff/demos" });
  if (!g.ok) return g.respuesta;

  const form = await request.formData();
  const templateId = form.get("templateId") as string;
  const repos = getRepos();

  const templates = await repos.demos.getTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const clients = await repos.accounts.listByType("client");
  for (const client of clients) {
    const contracts = await repos.contracts.findForClient(client.id);
    for (const c of contracts) {
      await repos.contracts.activate(c.id);
    }
  }

  return NextResponse.redirect(new URL("/jstaff/demos", request.url));
}
