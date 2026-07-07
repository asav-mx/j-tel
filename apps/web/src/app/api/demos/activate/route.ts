import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";

export async function POST(request: Request) {
  const form = await request.formData();
  const templateId = form.get("templateId") as string;
  const repos = getRepos();

  const templates = await repos.demos.getTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  }

  const tecma = await repos.accounts.findBySlug("tecma");
  if (tecma) {
    const contracts = await repos.contracts.findForClient(tecma.id);
    for (const c of contracts) {
      await repos.contracts.activate(c.id);
    }
  }

  return NextResponse.redirect(new URL("/jstaff/demos", request.url));
}
