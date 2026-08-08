/**
 * C21 · Qué ocurrencias sin sellar cargan una hora límite que su turno ya no
 * produce.
 *
 * `renewRollingWindow` calcula la hora límite al crear la ocurrencia y la
 * congela en la fila. Nunca vuelve a tocarla, y **nada la revisa** cuando el
 * turno o la política cambian. Esto es lo que la revisa.
 *
 * Solo LEE. No escribe la corrección, no abre incidente y no toca un hecho:
 * corregir la ventana con la que se va a juzgar a un transportista es decisión
 * de Asav, no de un programa. Quien corrige es `corregir-deadlines`, con su
 * simulacro por omisión.
 *
 * ## Por qué esto no reimplementa el cálculo
 *
 * La comparación la hace `clasificarDiferencia`, que ya es pura, ya está
 * probada y es la MISMA que usa `corregir-deadlines` para decidir qué toca.
 * Dos definiciones de «esta hora límite está vieja» es cómo se llega a que el
 * aviso diga una cosa y el guion que corrige haga otra.
 *
 * ## El cero es una afirmación
 *
 * Un detector que devuelve cero se ve idéntico a uno que no corre. Por eso se
 * devuelve además `revisadas` —cuántas ocurrencias se examinaron—, y quien
 * llama trata `revisadas: 0` como falla del instrumento y no como buena
 * noticia: la ventana rodante genera treinta días por adelantado, así que si
 * no hay NADA que revisar, lo que falló fue la lectura o el generador, no el
 * mundo. Es la corrección de la regla 8 aplicada al medidor: **contar también
 * algo que TIENE que estar.**
 */

import { JTTEL_TZ } from "@jtel/domain";
import { clasificarDiferencia, type CausaDeDiferencia } from "./deadline-diff.js";
import type { Repositories } from "./repositories/index.js";

/** La anticipación de fábrica, la misma que aplica el generador al derivar. */
export const ANTICIPACION_POR_DEFECTO = 15;

/**
 * Una ocurrencia sin sellar cuya hora límite guardada no es la que hoy se
 * derivaría de su turno y su política.
 */
export type HoraLimiteDesalineada = {
  ocurrenciaId: string;
  contratoId: string;
  contratoNombre: string;
  clienteNombre: string;
  turnoId: string;
  turnoNombre: string;
  /** La hora de inicio que el turno declara HOY. */
  turnoInicio: string;
  anticipacionMinutos: number;
  rutaNombre: string;
  serviceDate: string;
  /** La congelada en la fila — la que se va a usar para juzgar. */
  guardada: Date;
  /** La que hoy se derivaría del turno y la política vigentes. */
  derivada: Date;
  causa: Exclude<CausaDeDiferencia, "ninguna">;
  difMinutos: number;
};

export type RevisionDeHorasLimite = {
  /** Cuántas ocurrencias sin sellar se examinaron. Ver «el cero es una afirmación». */
  revisadas: number;
  desalineadas: HoraLimiteDesalineada[];
};

export async function revisarHorasLimite(
  repos: Repositories,
): Promise<RevisionDeHorasLimite> {
  const filas = await repos.occurrences.futurasSinSellarParaRevision();

  const desalineadas: HoraLimiteDesalineada[] = [];

  for (const f of filas) {
    /*
     * La política se lee como el generador la lee: los campos que un contrato
     * no declara llegan `undefined` y el default se aplica aquí, igual que
     * allá. Leerla de otra forma haría que este aviso comparara contra una
     * regla que el motor no usa — verificar con el instrumento mal puesto.
     */
    const anticipacion = f.policy?.arrivalAnticipationMinutes ?? ANTICIPACION_POR_DEFECTO;
    const zona = f.policy?.timeZone ?? JTTEL_TZ;

    const { causa, correcto, difMinutos } = clasificarDiferencia({
      serviceDate: f.serviceDate,
      guardado: f.expectedDeadline,
      shiftStartTime: f.shiftStartTime,
      anticipationMinutes: anticipacion,
      timeZone: zona,
    });
    if (causa === "ninguna") continue;

    desalineadas.push({
      ocurrenciaId: f.id,
      contratoId: f.contractId,
      contratoNombre: f.contractName,
      clienteNombre: f.clientName,
      turnoId: f.shiftId,
      turnoNombre: f.shiftName,
      turnoInicio: f.shiftStartTime,
      anticipacionMinutos: anticipacion,
      rutaNombre: f.routeName,
      serviceDate: f.serviceDate,
      guardada: f.expectedDeadline,
      derivada: correcto,
      causa,
      difMinutos,
    });
  }

  return { revisadas: filas.length, desalineadas };
}
