import type { PlanDeReselloEnPantalla } from "@/lib/plan-resello";

/**
 * La parte de la pantalla de re-sello que se puede probar sin navegador: qué
 * cuenta como sí, y cómo se recorren los días una vez dado.
 */

/** Exacta, salvo espacios alrededor. La misma regla que el guion (#401). */
export function confirmaFrase(tecleado: string, frase: string): boolean {
  return tecleado.trim() === frase;
}

export type ResultadoDeDia =
  | { dia: string; ok: true; resultados: Array<{ occurrenceId: string; status: string | null; error: string | null }> }
  | { dia: string; ok: false; error: string };

/**
 * Re-sella día por día lo autorizado. Cada día viaja con SUS ids y la frase
 * tecleada; el servidor la vuelve a comprobar.
 *
 * **Se detiene en el primer día que falla.** Si un día cambió entre la lista y
 * el sí, lo autorizado ya no describe lo que hay, y seguir con los demás días
 * sería re-sellar una parte de algo que se aprobó entero.
 */
export async function reselloPorDias(entrada: {
  plan: PlanDeReselloEnPantalla;
  tecleado: string;
  keepEvidence: boolean;
  enviar: (cuerpo: Record<string, unknown>) => Promise<{ status: number; json: unknown }>;
  alAvanzar?: (hechos: number, total: number, dia: string) => void;
}): Promise<{ dias: ResultadoDeDia[]; detenido: boolean }> {
  const { plan } = entrada;
  if (!confirmaFrase(entrada.tecleado, plan.frase)) {
    return { dias: [], detenido: true };
  }
  const dias: ResultadoDeDia[] = [];
  for (let i = 0; i < plan.dias.length; i++) {
    const d = plan.dias[i]!;
    entrada.alAvanzar?.(i, plan.dias.length, d.dia);
    let r: { status: number; json: unknown };
    try {
      r = await entrada.enviar({
        contractId: plan.contrato.id,
        serviceDate: d.dia,
        keepEvidence: entrada.keepEvidence,
        esperadas: d.servicios.map((s) => s.occurrenceId),
        confirmacion: entrada.tecleado.trim(),
        autorizados: plan.resumen.yaSellados,
      });
    } catch (err) {
      dias.push({ dia: d.dia, ok: false, error: err instanceof Error ? err.message : "Error de red" });
      return { dias, detenido: true };
    }
    const cuerpo = r.json as { ok?: boolean; error?: string; resultados?: [] } | null;
    if (r.status >= 400 || !cuerpo?.ok) {
      dias.push({ dia: d.dia, ok: false, error: cuerpo?.error ?? `HTTP ${r.status}` });
      return { dias, detenido: true };
    }
    dias.push({ dia: d.dia, ok: true, resultados: cuerpo.resultados ?? [] });
  }
  entrada.alAvanzar?.(plan.dias.length, plan.dias.length, "");
  return { dias, detenido: false };
}
