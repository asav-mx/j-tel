import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { VerificationService } from "@jtel/services";

export const maxDuration = 300;

function error(mensaje: string, status = 400) {
  return NextResponse.json({ ok: false, error: mensaje }, { status });
}

/**
 * Re-sella un día de un contrato. **Re-emite el juicio** sobre la jornada de un
 * cliente: el Marco dice que el hecho no se reescribe nunca, así que esto sólo
 * pasa con la lista delante y un sí tecleado.
 *
 * Hasta el 15 de septiembre de 2026 bastaba un `window.confirm` genérico —«¿Re-
 * verificar…?»— sin decir cuáles ni cuántos, y el formulario por rango podía
 * tocar un mes de jornadas de un jalón. El guion `reverify-day.ts` ya pedía lista
 * y sí desde el #401; la pantalla, que la aprieta cualquiera con acceso a
 * J-Staff, era el camino fácil y seguía abierto.
 *
 * Ahora la ruta exige, además de J-Staff:
 *   · `esperadas`: los ids que `/api/jstaff/reverify-day/plan` enseñó para ese
 *     día. Si el día cambió desde la lista, el motor no re-sella nada.
 *   · `confirmacion` = `RESELLAR <autorizados>`, lo que la persona tecleó con la
 *     cifra de veredictos ya sellados de todo el rango.
 * Y registra quién: el usuario de la sesión va al ledger.
 */
export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const body = (await request.json().catch(() => null)) as {
    contractId?: string;
    serviceDate?: string;
    keepEvidence?: boolean;
    esperadas?: unknown;
    confirmacion?: string;
    autorizados?: number;
  } | null;

  const contractId = String(body?.contractId ?? "").trim();
  const serviceDate = String(body?.serviceDate ?? "").trim();
  if (!contractId || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return error("Elige contrato y fecha (YYYY-MM-DD).");
  }

  const esperadas = body?.esperadas;
  if (!Array.isArray(esperadas) || esperadas.length === 0 || !esperadas.every((x) => typeof x === "string")) {
    return error("Falta la lista de lo que se va a re-sellar. Pide la lista primero; sin lista no hay nada que autorizar.");
  }

  const autorizados = Number(body?.autorizados);
  if (!Number.isInteger(autorizados) || autorizados < 0 || String(body?.confirmacion ?? "").trim() !== `RESELLAR ${autorizados}`) {
    return error("La confirmación no coincide con la cifra autorizada. No se re-selló nada.");
  }

  const repos = getRepos();
  const contract = await repos.contracts.findById(contractId);
  if (!contract) return error("Contrato no encontrado.", 404);

  try {
    const service = new VerificationService(repos);
    const results = await service.reverifyContract(contractId, {
      serviceDate,
      keepEvidence: body?.keepEvidence !== false,
      exclusiveUnits: true,
      actorKind: "human:jstaff",
      actorId: g.identidad.userId,
      actorIntent: "decision",
      esperadas: esperadas as string[],
    });

    return NextResponse.json({
      ok: true,
      dia: serviceDate,
      resultados: (results as Array<{ occurrenceId: string; status?: string; error?: string }>).map((r) => ({
        occurrenceId: r.occurrenceId,
        status: r.status ?? null,
        error: r.error ?? null,
      })),
    });
  } catch (err) {
    console.error("[jstaff/reverify-day]", err);
    return error(err instanceof Error ? err.message : "Error al re-verificar.", 409);
  }
}
