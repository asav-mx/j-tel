import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { destinoDeVuelta } from "@/lib/casa/volver";

/**
 * Retira un aviso **con motivo, firmado** (0052). Un aviso no se edita ni se
 * borra: se retira, y queda en la historia qué se le dijo al pasajero y cuándo.
 * Ontoy deja de enseñarlo en su siguiente consulta (15 s o menos).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string; avisoId: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id, avisoId } = await ctx.params;
  const form = await request.formData();
  const volver = (params: Record<string, string>) => {
    const url = new URL(destinoDeVuelta(form) ?? `/casa/jstaff/circuitos/${id}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.hash = "avisos";
    return NextResponse.redirect(url, 303);
  };

  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 280) || null;
  const r = await getRepos().circuits.retirarAviso(id, avisoId, { motivo, por: g.identidad.userId });
  if (!r.ok) {
    if (r.error === "no_existe") return volver({ error: "Ese aviso no es de este circuito" });
    if (r.error === "falta_quien") return volver({ error: "Inicia sesión: el retiro queda firmado." });
    return volver({ error: "No se retiró: di por qué — queda escrito." });
  }
  return volver({ ok: r.retirado ? "Aviso retirado. Ontoy deja de enseñarlo en su siguiente consulta." : "Ese aviso ya estaba retirado." });
}
