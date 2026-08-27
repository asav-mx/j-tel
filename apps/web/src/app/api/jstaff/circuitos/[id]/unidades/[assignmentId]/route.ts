import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Termina la asignación: la unidad deja de publicarse.
 *
 * Se llama DELETE por el verbo de HTTP, pero **no borra nada** — igual que el
 * DELETE de una parada la retira sin borrarla. Cierra la vigencia y guarda el
 * motivo, que es lo único de esta fila que nadie puede reconstruir después.
 */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string; assignmentId: string }> },
) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { assignmentId } = await ctx.params;
  const motivo = new URL(request.url).searchParams.get("motivo") ?? undefined;

  const terminada = await getRepos().circuits.endAssignment(assignmentId, motivo);
  if (!terminada) {
    return NextResponse.json(
      { error: "Esa asignación no existe o ya estaba terminada" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    asignacionId: terminada.id,
    hasta: terminada.validTo,
    motivo: terminada.motivo,
  });
}
