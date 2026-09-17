import { SIN_SENAL_MINUTOS } from "@jtel/domain";
import type { DispositivoDelInventario } from "@jtel/services";
import { conCuenta } from "@/lib/casa/casas";
import { RAIZ_EXPEDIENTES } from "@/lib/casa/expedientes";

/**
 * El cuarto Dispositivos y las acciones de Ver ‹dispositivo› (C4), en lo que se
 * ve: rutas, palabras y el «hecho» que se dice después de actuar. Vive aparte
 * de las páginas para poder probarlo.
 *
 * Prototipo aprobado el 17 de septiembre de 2026:
 * https://claude.ai/artifact/FGi58hto8teEYappBAQw1Z
 */

export const RAIZ_DISPOSITIVOS = "/casa/transportista/dispositivos";

/** Las acciones que abren un panel en su pantalla (`?accion=`). */
export type AccionDeDispositivo = "alta" | "asignar" | "soltar" | "baja";

/** De dónde se llegó a Ver ‹dispositivo›: tiene dos puertas, y se vuelve a la que se usó. */
export type Puerta = "dispositivos" | "expedientes";

function conParams(ruta: string, params: Record<string, string | null | undefined>, cuenta?: string | null) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return conCuenta(s ? `${ruta}?${s}` : ruta, cuenta);
}

export const rutasDeDispositivos = {
  cuarto: (cuenta?: string | null, params: { accion?: "alta"; hecho?: string; dispositivo?: string } = {}) =>
    conParams(RAIZ_DISPOSITIVOS, params, cuenta),
  /**
   * La ficha vive en Expedientes (#421) y se llega desde los dos cuartos. `desde`
   * sólo se escribe cuando no es la puerta de siempre, para que las ligas viejas
   * sigan limpias.
   */
  ver: (
    id: string,
    cuenta?: string | null,
    params: { desde?: Puerta; accion?: Exclude<AccionDeDispositivo, "alta">; hecho?: string } = {},
  ) =>
    conParams(
      `${RAIZ_EXPEDIENTES}/dispositivo/${id}`,
      { desde: params.desde === "dispositivos" ? "dispositivos" : null, accion: params.accion, hecho: params.hecho },
      cuenta,
    ),
};

/** Lee `?desde=` sin confiar en él: cualquier otra cosa es la puerta de siempre. */
export function puertaDe(valor: unknown): Puerta {
  return valor === "dispositivos" ? "dispositivos" : "expedientes";
}

/** El apoyo de un dispositivo en el inventario: dos o tres palabras. */
export function apoyoDeInventario(d: Pick<DispositivoDelInventario, "unidad" | "estado">): string {
  if (d.estado.grupo === "de_baja") return d.estado.retiredReason ?? "sin motivo";
  // «Nunca ha reportado» ya lo dice el dato (`nunca · última señal`); repetirlo
  // en el apoyo lo cortaba a 375 px y no agregaba nada.
  return d.unidad ? `en ${d.unidad}` : "sin unidad";
}

/**
 * ¿El dato del dispositivo va en cobre? Sólo si está montado **y** su señal es
 * de dentro de los 15 min de `SIN_SENAL_MINUTOS`. El prototipo pintaba de cobre
 * a todo lo que estaba en unidad; con datos reales, «hace 3.8 h» salía en el
 * color de la vida sin serlo (skill: el cobre sólo donde hay vida). Es el mismo
 * umbral con que Flota en vivo separa EN LÍNEA de SIN SEÑAL.
 */
export function senalViva(estado: DispositivoDelInventario["estado"], ahora: Date): boolean {
  if (estado.grupo !== "en_unidad" || !estado.ultimaSenalAt) return false;
  return ahora.getTime() - estado.ultimaSenalAt.getTime() <= SIN_SENAL_MINUTOS * 60_000;
}

/**
 * Las sugerencias sólo llenan el texto: el motivo lo escribe quien actúa y se
 * guarda tal cual (decisión 7 de la ficha).
 */
export const SUGERENCIAS = {
  soltar: ["Entró a taller", "Se cambia de unidad", "Falla del dispositivo"],
  baja: ["Se quemó", "Se perdió", "Se devolvió al proveedor"],
} as const;

/** Un texto que viene en la dirección, recortado. Nunca se usa para afirmar un dato. */
export function textoDeRuta(valor: unknown, largo = 300): string | null {
  return typeof valor === "string" && valor.trim() ? valor.slice(0, largo) : null;
}
