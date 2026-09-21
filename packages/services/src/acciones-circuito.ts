import type { Repositories } from "@jtel/db";
import { motivoCapturado, PALABRAS_DE_ERROR } from "@jtel/domain";

/**
 * El carrier asigna y suelta **sus** unidades en un circuito — ficha de huecos
 * de «asignar unidad», PR 2 (21 sep 2026).
 *
 * Hasta hoy sólo J-Staff asignaba (`/api/jstaff/circuitos/[id]/unidades`), y
 * ese poder no cambia. Esto es la otra mano: quien sabe qué camión sale hoy es
 * el transportista.
 *
 * Mismo orden que las acciones de dispositivo:
 *
 *   1. lo que se nombra es **de esta cuenta** — el universo lo da
 *      `listUnidadesAsignablesDelCarrier`, que exige las dos cerraduras (la
 *      unidad es suya y la concesión del circuito lo tiene ligado). Una unidad
 *      ajena, o un circuito donde no está ligado, responde igual que una que no
 *      existe;
 *   2. procede o no, con el aviso de por medio;
 *   3. el repositorio escribe — `assignUnit`, la misma de J-Staff, con su regla
 *      de «una sola vigente». No hay segunda lógica de asignar;
 *   4. el error vuelve en palabras de quien captura.
 *
 * Asignar y soltar son **eventos con fecha**, nunca reemplazos: se cierra una
 * fila y se abre otra, y la cerrada se queda con su motivo y su autor (0048).
 */

export type ErrorDeAccionDeCircuito =
  | "motivo_vacio"
  | "motivo_largo"
  | "unidad_no_asignable"
  | "ya_corre_aqui"
  | "falta_confirmar"
  | "asignacion_no_encontrada"
  | "cambio_simultaneo";

export type ResultadoDeAccionDeCircuito<T> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorDeAccionDeCircuito; mensaje: string };

const PALABRAS: Record<ErrorDeAccionDeCircuito, string> = {
  motivo_vacio: PALABRAS_DE_ERROR.motivo_vacio,
  motivo_largo: PALABRAS_DE_ERROR.motivo_largo,
  unidad_no_asignable: "Esa unidad no es de esta cuenta, o esta cuenta no está ligada a la concesión de este circuito.",
  ya_corre_aqui: "Esa unidad ya está asignada a este circuito.",
  falta_confirmar:
    "Esa unidad cambió de circuito mientras lo revisabas. Revisa de dónde sale y vuelve a confirmar.",
  asignacion_no_encontrada: "Esa unidad no está asignada a este circuito, o ya se había soltado.",
  cambio_simultaneo: "Alguien movió esta unidad al mismo tiempo. Vuelve a cargar la página y revisa.",
};

function falla(error: ErrorDeAccionDeCircuito) {
  return { ok: false as const, error, mensaje: PALABRAS[error] };
}

/** Postgres dice 23505 cuando un índice único rechaza la escritura. */
function esChoqueDeCandado(e: unknown): boolean {
  const codigo = (e as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
  return codigo === "23505";
}

/**
 * El motivo que escribe el sistema en la asignación que se cierra al jalar la
 * unidad a otro circuito. Quien asigna no escribió «soltar de B», pero eso fue
 * lo que pasó en B, y su historia lo tiene que decir — con quién, en
 * `cerrada_por`. Es la misma frase que ya escribe J-Staff.
 */
export const motivoDeReasignacion = (circuitoNuevo: string) => `Reasignada a ${circuitoNuevo}`;

/**
 * Asigna una unidad del carrier a un circuito.
 *
 * **El aviso no es cortesía de la pantalla, es condición del servidor**
 * (decisión de Asav §4, 21 sep): si la unidad corre otro circuito —de ésta o de
 * otra concesión—, la asignación sólo procede cuando el formulario trae
 * `confirmaCierreDe` con el id de ESE circuito, que es el que la pantalla le
 * enseñó antes de confirmar. Si entre ver y confirmar la unidad se movió a un
 * tercero, el id ya no cuadra y se vuelve a preguntar: nadie cierra callado un
 * circuito que no vio.
 */
export async function asignarUnidadACircuito(
  repos: Repositories,
  datos: {
    carrierId: string;
    circuitId: string;
    unitId: string;
    /** El circuito que la pantalla avisó que se cerraría; null si la vio libre. */
    confirmaCierreDe: string | null;
    por: string;
  },
): Promise<
  ResultadoDeAccionDeCircuito<{
    asignacionId: string;
    unidad: string;
    cerroEn: { circuitoId: string; nombre: string | null } | null;
  }>
> {
  const asignables = await repos.circuits.listUnidadesAsignablesDelCarrier(datos.carrierId, datos.circuitId);
  const unidad = asignables.find((u) => u.unitId === datos.unitId);
  if (!unidad) return falla("unidad_no_asignable");
  if (unidad.ocupadaEnCircuitoId === datos.circuitId) return falla("ya_corre_aqui");
  if ((unidad.ocupadaEnCircuitoId ?? null) !== (datos.confirmaCierreDe || null)) return falla("falta_confirmar");

  const circuito = await repos.circuits.getCircuit(datos.circuitId);
  if (!circuito) return falla("unidad_no_asignable");

  try {
    const { abierta, cerrada } = await repos.circuits.assignUnit({
      circuitId: datos.circuitId,
      unitId: unidad.unitId,
      // De la unidad, nunca del formulario: el universo ya exigió que sea suya.
      carrierAccountId: unidad.carrierAccountId,
      motivoDelCierre: motivoDeReasignacion(circuito.name),
      actorId: datos.por,
    });
    return {
      ok: true,
      asignacionId: abierta.id,
      unidad: unidad.label,
      cerroEn: cerrada ? { circuitoId: cerrada.circuitId, nombre: unidad.ocupadaEnCircuito ?? null } : null,
    };
  } catch (e) {
    if (esChoqueDeCandado(e)) return falla("cambio_simultaneo");
    throw e;
  }
}

/**
 * Suelta una unidad del carrier de un circuito. El motivo es obligatorio: es lo
 * único de la fila que nadie puede reconstruir después.
 *
 * Pasa por `soltarAsignacionDeCuenta` —las dos cerraduras en el `WHERE`—, nunca
 * por `endAssignment`, que no comprueba de quién es y queda sólo para J-Staff.
 */
export async function soltarUnidadDeCircuito(
  repos: Repositories,
  datos: { carrierId: string; circuitId: string; assignmentId: string; motivo: string; por: string },
): Promise<ResultadoDeAccionDeCircuito<{ unidadId: string }>> {
  const motivo = motivoCapturado(datos.motivo);
  if (!motivo.ok) return falla(motivo.error);

  const cerrada = await repos.circuits.soltarAsignacionDeCuenta(
    datos.carrierId,
    datos.circuitId,
    datos.assignmentId,
    motivo.motivo,
    datos.por,
  );
  if (!cerrada) return falla("asignacion_no_encontrada");
  return { ok: true, unidadId: cerrada.unitId };
}
