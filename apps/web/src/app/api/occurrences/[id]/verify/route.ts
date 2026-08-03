import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { VerificationService } from "@jtel/services";

function backToSoporte(request: Request, params: Record<string, string>) {
  const url = new URL("/jstaff/soporte", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

/**
 * Re-sync / verificar desde J-Staff (formulario HTML).
 * Sin force: solo reintenta pendiente_evidencia; cumplido/no_cumplido se omiten.
 * Responde con redirect a /jstaff/soporte (nunca JSON crudo en el navegador).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await exigir(request, { tipo: "jstaff" }, { redirigirA: "/jstaff/soporte" });
  if (!g.ok) return g.respuesta;

  const { id } = await params;
  const repos = getRepos();
  const service = new VerificationService(repos);

  try {
    // TODO: reemplazar null con session.userId cuando se implemente autenticación.
    const result = await service.verifyOccurrence(id, { actorKind: "human", actorId: null });
    if (result.skipped) {
      return backToSoporte(request, {
        resync: "skip",
        status: String(result.status ?? ""),
      });
    }
    return backToSoporte(request, {
      resync: "ok",
      status: String(result.status ?? ""),
    });
  } catch (err) {
    console.error("[occurrences/verify]", err);
    return backToSoporte(request, {
      error: err instanceof Error ? err.message : "Error al verificar.",
    });
  }
}
