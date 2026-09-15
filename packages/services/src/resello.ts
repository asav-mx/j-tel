/**
 * Qué se va a re-sellar, dicho antes de hacerlo.
 *
 * Re-verificar con `force` borra el hecho sellado de cada servicio y sella uno
 * nuevo. Eso **no escribe datos: re-emite el juicio** sobre las jornadas de un
 * cliente, y el Marco lo prohíbe en una línea —«el hecho no se reescribe nunca;
 * la justificación se adjunta y la consecuencia se ajusta»—. Cuando haga falta
 * de todos modos (una geocerca corregida, un defecto del motor), que sea con la
 * lista delante y un sí explícito de una persona.
 *
 * Aquí vive la parte que se puede probar sin base ni terminal: qué servicios
 * entran, cómo se enseñan y qué respuesta cuenta como sí.
 */

export type Veredicto = "cumplido" | "no_cumplido" | "pendiente_evidencia";

/** Lo mínimo de una ocurrencia que hace falta para decidir y para enseñarla. */
export interface OcurrenciaParaResello {
  id: string;
  serviceDate: string;
  expectedDeadline: Date;
  trip?: unknown | null;
  complianceFact?: { status: string; materializedAt?: Date | null } | null;
  profile?: { name?: string | null; code?: string | null } | null;
}

export interface ServicioAResellar {
  occurrenceId: string;
  perfil: string;
  horaLimite: Date;
  /** `null` = sin hecho todavía: se sella por primera vez, no se re-sella. */
  veredicto: Veredicto | null;
  selladoEn: Date | null;
}

/**
 * Los servicios de un día que `reverifyContract` va a tocar.
 *
 * **El mismo filtro que `reverifyContract` con `serviceDate`**: con viaje, y de
 * esa fecha. Si divergieran, la lista enseñaría una cosa y el motor haría otra;
 * por eso `reverifyContract` recibe los ids de esta lista en `esperadas` y se
 * niega si no coinciden.
 */
export function planDeResello(ocurrencias: OcurrenciaParaResello[], serviceDate: string): ServicioAResellar[] {
  return ocurrencias
    .filter((o) => Boolean(o.trip) && o.serviceDate === serviceDate)
    .map((o) => ({
      occurrenceId: o.id,
      perfil: o.profile?.code || o.profile?.name || "(sin perfil)",
      horaLimite: o.expectedDeadline,
      veredicto: (o.complianceFact?.status as Veredicto | undefined) ?? null,
      selladoEn: o.complianceFact?.materializedAt ?? null,
    }))
    .sort((a, b) => a.horaLimite.getTime() - b.horaLimite.getTime() || a.perfil.localeCompare(b.perfil));
}

export function resumenDelPlan(plan: ServicioAResellar[]) {
  const porVeredicto: Record<Veredicto, number> = { cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0 };
  let sinHecho = 0;
  for (const s of plan) {
    if (s.veredicto) porVeredicto[s.veredicto] += 1;
    else sinHecho += 1;
  }
  return { total: plan.length, yaSellados: plan.length - sinHecho, sinHecho, porVeredicto };
}

/**
 * Lo que hay que teclear para decir que sí. Lleva el número de veredictos ya
 * sellados que se van a reescribir: quien lo teclea tiene que haber leído la
 * cifra, y un «s» de costumbre no alcanza.
 */
export function fraseDeConfirmacion(plan: ServicioAResellar[]): string {
  return `RESELLAR ${resumenDelPlan(plan).yaSellados}`;
}

/** Exacta, salvo espacios alrededor. Ni minúsculas ni otra cifra. */
export function confirma(respuesta: string | null | undefined, plan: ServicioAResellar[]): boolean {
  return (respuesta ?? "").trim() === fraseDeConfirmacion(plan);
}

/** Sin `--aplicar`, nunca se escribe. */
export function modoDeResello(argv: string[]): "simulacion" | "aplicar" {
  return argv.includes("--aplicar") ? "aplicar" : "simulacion";
}

/** La tabla que se enseña, en la hora de la planta. */
export function tablaDelPlan(plan: ServicioAResellar[], timeZone: string): string {
  const hora = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const dia = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const filas = plan.map(
    (s) =>
      `  ${hora(s.horaLimite)}  ${s.perfil.padEnd(28).slice(0, 28)}  ${(s.veredicto ?? "sin hecho").padEnd(19)}  ${s.selladoEn ? `sellado ${dia(s.selladoEn)}` : "—"}`,
  );
  return ["  límite  perfil                        veredicto hoy        ", ...filas].join("\n");
}
