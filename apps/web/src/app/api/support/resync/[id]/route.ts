import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { VerificationService } from "@jtel/services";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await params;
  const repos = getRepos();
  const service = new VerificationService(repos, getUmbrellaConfig());

  try {
    // TODO: reemplazar null con session.userId cuando se implemente autenticación.
    const result = await service.verifyOccurrence(id, { actorKind: "human", actorId: null });
    return NextResponse.json({ ok: true, ...result, action: "resync" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
