import type { Repositories } from "@jtel/db";
import {
  fraseDeConfirmacion,
  planDeResello,
  resumenDelPlan,
  type ServicioAResellar,
} from "@jtel/services";

/**
 * Qué se re-sellaría en un rango de días de un contrato, antes de hacerlo.
 *
 * Es la lista que la pantalla de J-Staff enseña y que una persona tiene que
 * leer antes de teclear el sí. Usa el mismo `planDeResello` que el guion
 * `reverify-day.ts` (#401), así que la pantalla y el guion no pueden enseñar
 * cosas distintas del mismo día.
 */

/** Máximo de días por corrida. Cada día es una invocación al motor. */
export const MAX_DIAS_RESELLO = 31;

export function diasDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${desde}T12:00:00.000Z`);
  const fin = new Date(`${hasta}T12:00:00.000Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(fin.getTime()) || cur > fin) return out;
  while (cur <= fin) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export interface DiaDelPlan {
  dia: string;
  servicios: Array<Omit<ServicioAResellar, "horaLimite" | "selladoEn"> & { horaLimite: string; selladoEn: string | null }>;
  yaSellados: number;
}

export interface PlanDeReselloEnPantalla {
  contrato: { id: string; nombre: string; cliente: string; planta: string };
  desde: string;
  hasta: string;
  dias: DiaDelPlan[];
  resumen: ReturnType<typeof resumenDelPlan> & { dias: number };
  /** Lo que hay que teclear. Lleva la cifra de veredictos ya sellados de TODO el rango. */
  frase: string;
}

export async function leerPlanDeResello(
  repos: Repositories,
  entrada: { contractId: string; desde: string; hasta: string },
): Promise<PlanDeReselloEnPantalla | { error: string; status: number }> {
  const dias = diasDelRango(entrada.desde, entrada.hasta);
  if (dias.length === 0) return { error: "Rango de fechas inválido.", status: 400 };
  if (dias.length > MAX_DIAS_RESELLO) {
    return { error: `Máximo ${MAX_DIAS_RESELLO} días por corrida (pediste ${dias.length}).`, status: 400 };
  }

  const contrato = await repos.contracts.findById(entrada.contractId);
  if (!contrato) return { error: "Contrato no encontrado.", status: 404 };

  // Mediodía UTC cae en el mismo día civil en Ciudad Juárez: el repositorio
  // convierte con `localDateIso`, y así el filtro de la base coincide con `dia`.
  const ocurrencias = await repos.occurrences.findForContract(
    contrato.id,
    new Date(`${entrada.desde}T18:00:00.000Z`),
    new Date(`${entrada.hasta}T18:00:00.000Z`),
  );

  const todos: ServicioAResellar[] = [];
  const porDia: DiaDelPlan[] = [];
  for (const dia of dias) {
    const plan = planDeResello(ocurrencias, dia);
    if (plan.length === 0) continue;
    todos.push(...plan);
    porDia.push({
      dia,
      yaSellados: resumenDelPlan(plan).yaSellados,
      servicios: plan.map((s) => ({
        ...s,
        horaLimite: s.horaLimite.toISOString(),
        selladoEn: s.selladoEn ? s.selladoEn.toISOString() : null,
      })),
    });
  }

  const cliente = await repos.accounts.findById(contrato.clientAccountId);
  const planta = contrato.plant ? `${contrato.plant.name} (${contrato.plant.code})` : (contrato.plantGroup?.name ?? "—");
  return {
    contrato: { id: contrato.id, nombre: contrato.name, cliente: cliente?.name ?? "—", planta },
    desde: entrada.desde,
    hasta: entrada.hasta,
    dias: porDia,
    resumen: { ...resumenDelPlan(todos), dias: porDia.length },
    frase: fraseDeConfirmacion(todos),
  };
}
