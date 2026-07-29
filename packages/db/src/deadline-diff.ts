/**
 * Por qué el deadline guardado de una ocurrencia difiere de lo que hoy se
 * calcularía. Lógica pura — se prueba sin base de datos.
 */

import { computeExpectedDeadline, instanteZonificado } from "@jtel/domain";

/**
 * Por qué difiere un deadline de lo que hoy se calcularía.
 *
 * `zona` — el instante ni siquiera está anclado a la medianoche civil del
 * contrato: el marco temporal es otro. Es el bug del 2026-07-28, y se corrige.
 *
 * `deriva` — el marco es correcto y la diferencia es de minutos: la ocurrencia
 * se generó con una anticipación que después cambió en la política. No es un
 * bug; es una decisión de producto sobre si una ocurrencia sin juzgar debe
 * reflejar la política vigente. Por eso va aparte y detrás de su propia
 * bandera.
 */
export type CausaDeDiferencia = "zona" | "deriva" | "ninguna";

/** Umbral que separa un marco temporal equivocado de un ajuste de minutos. */
export const MINUTOS_MARCO_DISTINTO = 60;

export function clasificarDiferencia(input: {
  serviceDate: string;
  /** Deadline tal como está guardado. */
  guardado: Date;
  shiftStartTime: string;
  anticipationMinutes: number;
  timeZone: string;
}): { causa: CausaDeDiferencia; correcto: Date; difMinutos: number } {
  const correcto = computeExpectedDeadline(
    input.serviceDate,
    input.shiftStartTime,
    input.anticipationMinutes,
    input.timeZone,
  );
  const difMinutos = Math.round((correcto.getTime() - input.guardado.getTime()) / 60_000);
  if (difMinutos === 0) return { causa: "ninguna", correcto, difMinutos };

  // ¿El guardado está anclado a la medianoche civil del contrato? Si lo está,
  // la diferencia es de minutos y viene de la política, no de la zona.
  const medianoche = instanteZonificado(input.serviceDate, 0, input.timeZone);
  const minutosImplicitos = Math.round(
    (input.guardado.getTime() - medianoche.getTime()) / 60_000,
  );
  const [h, m] = input.shiftStartTime.split(":").map(Number);
  const minutosCorrectos = (h ?? 0) * 60 + (m ?? 0) - input.anticipationMinutes;
  const desanclaje = Math.abs(minutosImplicitos - minutosCorrectos);

  return {
    causa: desanclaje >= MINUTOS_MARCO_DISTINTO ? "zona" : "deriva",
    correcto,
    difMinutos,
  };
}

