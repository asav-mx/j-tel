import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { createContractSchema } from "@jtel/domain";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("account")?.trim() ?? "";
  if (!slug) {
    return NextResponse.json({ error: "Requiere account" }, { status: 400 });
  }

  const g = await exigir(request, { tipo: "cliente", slug }, "json");
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const client = await repos.accounts.findBySlug(slug);
  if (!client || client.type !== "client") return NextResponse.json([]);

  const contracts = await repos.contracts.findForClient(client.id);
  return NextResponse.json(contracts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // El cuerpo ya validado trae su propio clientAccountId: no hace falta
  // confiar en un slug aparte, se exige contra el dueño real del contrato.
  const g = await exigir(
    request,
    { tipo: "cliente-por-id", accountId: parsed.data.clientAccountId },
    "json",
  );
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const contract = await repos.contracts.create(parsed.data);
  return NextResponse.json(contract, { status: 201 });
}
