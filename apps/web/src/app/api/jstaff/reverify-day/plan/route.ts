import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { leerPlanDeResello } from "@/lib/plan-resello";

/**
 * La lista de lo que se re-sellaría, sin re-sellar nada.
 *
 * Sólo lee. Es el paso que la pantalla exige antes del sí: sin esta lista no
 * hay `esperadas` que mandar, y `/api/jstaff/reverify-day` se niega sin ellas.
 */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const body = (await request.json().catch(() => null)) as {
    contractId?: string;
    desde?: string;
    hasta?: string;
  } | null;
  const contractId = String(body?.contractId ?? "").trim();
  const desde = String(body?.desde ?? "").trim();
  const hasta = String(body?.hasta ?? desde).trim();
  if (!contractId || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ ok: false, error: "Elige contrato y fechas (YYYY-MM-DD)." }, { status: 400 });
  }

  const plan = await leerPlanDeResello(getRepos(), { contractId, desde, hasta });
  if ("error" in plan) return NextResponse.json({ ok: false, error: plan.error }, { status: plan.status });
  return NextResponse.json({ ok: true, plan });
}
