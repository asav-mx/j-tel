import { NextResponse } from "next/server";
import { reanudarVerificacion } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { rutasDeContratos } from "@/lib/casa/contratos";

/**
 * Reanudar la verificación de un contrato (0041). Sólo el admin de plataforma.
 *
 * Vale desde ahora y no pide motivo: reanudar es volver a lo normal (decisión 6
 * de Asav). Lo que cayó en la pausa queda sin generar.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const contractId = String(form.get("contractId") ?? "").trim();

  const g = await exigir(request, { tipo: "jstaff-pausa-verificacion" }, { redirigirA: rutasDeContratos.lista() });
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const contrato = contractId ? await repos.pausas.contrato(contractId) : null;
  if (!contrato) return NextResponse.redirect(new URL(rutasDeContratos.lista(), request.url), 303);

  const r = await reanudarVerificacion(repos, { contractId, ahora: new Date(), actor: { kind: "human", id: g.identidad.userId } });
  const destino = r.ok ? rutasDeContratos.contrato(contractId) : `${rutasDeContratos.contrato(contractId)}?error=${encodeURIComponent(r.mensaje)}`;
  return NextResponse.redirect(new URL(destino, request.url), 303);
}
