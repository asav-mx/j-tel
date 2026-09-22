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

  const { id, assignmentId } = await ctx.params;
  // Sin un quién no se suelta: el cierre queda firmado (0048).
  if (!g.identidad.userId) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const motivo = new URL(request.url).searchParams.get("motivo") ?? undefined;
  const repos = getRepos();

  /*
   * La asignación tiene que ser DE ESTE circuito y estar vigente. Antes se
   * soltaba por id nada más, y la dirección de un circuito podía cerrar la
   * asignación de otro (ficha de Circuitos, A2). Una ajena responde igual que
   * una que no existe.
   */
  const deEste = (await repos.circuits.listAssignments(id)).find((a) => a.id === assignmentId && a.validTo === null);
  if (!deEste) {
    return NextResponse.json({ error: "Esa asignación no existe o ya estaba terminada" }, { status: 404 });
  }

  // Quién suelta, de la sesión — nunca del formulario (0048).
  const terminada = await repos.circuits.endAssignment(assignmentId, motivo, g.identidad.userId);
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
