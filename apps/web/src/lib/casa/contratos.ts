/**
 * «Contratos» de J-Staff — las direcciones y cómo se dice el estado (0041).
 *
 * Vive bajo «Cuentas y demos», donde J-Staff ya administra cuentas (decisión 7
 * de Asav, 19 sep 2026). Aquí se pausa y se reanuda la verificación de un
 * contrato, en su ficha: una acción se ejecuta en el expediente de su
 * sustantivo (Ley de Acción).
 */

export const RAIZ_CONTRATOS = "/casa/jstaff/cuentas-y-demos/contratos";

export type AccionDeContrato = "pausar" | "revisar" | "reanudar";

export const rutasDeContratos = {
  lista: () => RAIZ_CONTRATOS,
  contrato: (contractId: string) => `${RAIZ_CONTRATOS}/${contractId}`,
  /** Un paso de la ficha, llevando lo tecleado para no perderlo si hay error. */
  accion: (contractId: string, accion: AccionDeContrato, campos: { fecha?: string; motivo?: string } = {}, error?: string) => {
    const q = new URLSearchParams({ accion });
    if (campos.fecha) q.set("fecha", campos.fecha.slice(0, 10));
    if (campos.motivo) q.set("motivo", campos.motivo.slice(0, 400));
    if (error) q.set("error", error.slice(0, 300));
    return `${RAIZ_CONTRATOS}/${contractId}?${q.toString()}`;
  },
};

/**
 * El estado comercial del contrato, en palabras — y **dicho como comercial**.
 *
 * `suspended` es una etiqueta vieja que ningún proceso lee; la pausa de la
 * verificación es otra cosa y sí detiene al motor. Dos cosas que se llaman casi
 * igual y sólo una hace algo es una trampa esperando lector (Asav, 19 sep
 * 2026): por eso esta palabra nunca va sola, siempre con «comercial».
 */
export const ESTADO_COMERCIAL: Record<string, string> = {
  draft: "borrador",
  demo: "demo",
  active: "activo",
  suspended: "suspendido",
};
