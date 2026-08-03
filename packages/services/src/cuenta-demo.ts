/**
 * Los dos cerrojos de una cuenta de ejemplo.
 *
 * El 2026-08-03 se midió en producción: **84 hechos vinculantes sellados sobre
 * cuentas que nadie declaró como operación real** — Honeywell 30, PRUEBA REAL 54,
 * contra los 866 de Tecma. De esos 84, **52 son acusaciones formales**
 * (`no_cumplido`) con expediente, evidencia y motivo escrito, contra
 * transportistas por servicios que nadie prestó.
 *
 * El plan tenía anotados 73. Son 84 porque el motor siguió sellando mientras el
 * número esperaba en una lista. Es la única causa conocida que **crece sola**.
 *
 * Por qué DOS cerrojos y no uno: el vocabulario del sistema declara la condición
 * de ejemplo en dos lugares distintos, y ninguno implica al otro.
 *
 *   1. `accounts.is_demo` — la cuenta cliente es de ejemplo.
 *   2. `service_contracts.status = 'demo'` — el contrato es de ejemplo.
 *
 * Hoy (2026-08-03) solo el primero muerde: los cuatro contratos de producción
 * tienen `status = 'active'`, incluidos los dos de cuentas demo, porque el seed
 * escribió `active` en todos. El segundo cerrojo no atrapa nada **todavía** — y
 * ese es justamente el motivo de ponerlo ahora. Un contrato de ejemplo colgado de
 * una cuenta real es una combinación que el esquema permite y que nada impide
 * crear mañana; cerrar solo `is_demo` deja medio agujero abierto con forma de
 * puerta legítima.
 *
 * Esto NO retira los 84 ya sellados. Retirarlos lleva firma y motivo, y va aparte.
 * Aquí solo se cierra la llave.
 */

/** Por cuál de los dos cerrojos no se puede sellar. Se guarda para poder decirlo. */
export type MotivoCuentaDemo = "cuenta_marcada_demo" | "contrato_marcado_demo";

/**
 * Lo mínimo que hay que saber de un servicio para decidir si su cuenta es real.
 * Se pide en esta forma —y no la ocurrencia entera— para que la regla se pueda
 * ejercer en una prueba sin montar media base.
 */
export interface OrigenDelServicio {
  /** `accounts.is_demo` de la cuenta CLIENTE del contrato. */
  cuentaClienteEsDemo?: boolean | null;
  /** `service_contracts.status`. */
  estadoDelContrato?: string | null;
}

export const ESTADO_CONTRATO_DEMO = "demo";

/**
 * Devuelve por qué NO se puede sellar sobre este servicio, o `null` si sí se puede.
 *
 * Devuelve el motivo en vez de un booleano a propósito: cuando el motor se salte
 * un servicio, el registro tiene que poder decir cuál de los dos cerrojos fue.
 * Un "se saltó" sin causa es exactamente el silencio que costó 35 días.
 *
 * El orden de comprobación es estable (cuenta antes que contrato) para que el
 * motivo reportado no dependa del azar cuando ambos cerrojos aplican.
 */
export function motivoCuentaDemo(origen: OrigenDelServicio): MotivoCuentaDemo | null {
  if (origen.cuentaClienteEsDemo === true) return "cuenta_marcada_demo";
  if (origen.estadoDelContrato === ESTADO_CONTRATO_DEMO) return "contrato_marcado_demo";
  return null;
}

/** Azúcar sobre `motivoCuentaDemo` para los sitios donde el motivo no se usa. */
export function esCuentaDeEjemplo(origen: OrigenDelServicio): boolean {
  return motivoCuentaDemo(origen) !== null;
}
