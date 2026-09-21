import { conCuenta } from "@/lib/casa/casas";

/**
 * Las direcciones y palabras de las acciones de Ver ‹circuito› — el carrier
 * asigna y suelta sus unidades (ficha de huecos de «asignar unidad», PR 2).
 *
 * Misma forma que `dispositivos.ts`: la dirección sólo nombra QUÉ acción se
 * abrió o qué pasó; la pantalla lo cuenta leyendo la base, así que una
 * dirección editada a mano no le hace decir nada falso.
 */

const RAIZ = "/casa/transportista/circuitos";

export type AccionDeCircuito = "asignar" | "soltar";
export type HechoDeCircuito = "asignada" | "soltada";

export function accionDeCircuito(valor: unknown): AccionDeCircuito | null {
  return valor === "asignar" || valor === "soltar" ? valor : null;
}

export function hechoDeCircuito(valor: unknown): HechoDeCircuito | null {
  return valor === "asignada" || valor === "soltada" ? valor : null;
}

function conParams(ruta: string, params: Record<string, string | null | undefined>, cuenta?: string | null) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return conCuenta(s ? `${ruta}?${s}` : ruta, cuenta);
}

export const rutasDeCircuito = {
  cuarto: (cuenta?: string | null) => conCuenta(RAIZ, cuenta),
  ver: (
    circuitId: string,
    cuenta?: string | null,
    params: {
      accion?: AccionDeCircuito;
      /** Con `accion=soltar`: cuál de sus asignaciones se está soltando. */
      asignacion?: string | null;
      hecho?: HechoDeCircuito;
      /** Con `hecho`: la unidad de la que habla; la frase la confirma contra la base. */
      unidad?: string | null;
    } = {},
  ) =>
    conParams(
      `${RAIZ}/${circuitId}`,
      { accion: params.accion, asignacion: params.asignacion, hecho: params.hecho, unidad: params.unidad },
      cuenta,
    ),
};

/** Sugerencias de motivo al soltar: tocar una llena el campo, no lo manda. */
export const SUGERENCIAS_SOLTAR = ["Entró a taller", "Pasa a otro servicio", "Sale de la flota"] as const;
