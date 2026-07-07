import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createContractSchema } from "@jtel/domain";

export async function GET() {
  const repos = getRepos();
  const tecma = await repos.accounts.findBySlug("tecma");
  if (!tecma) return NextResponse.json([]);

  const contracts = await repos.contracts.findForClient(tecma.id);
  return NextResponse.json(contracts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const repos = getRepos();
  const contract = await repos.contracts.create(parsed.data);
  return NextResponse.json(contract, { status: 201 });
}
