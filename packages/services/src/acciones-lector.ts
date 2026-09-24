import type { Repositories } from "@jtel/db";
import {
  MOTIVO_SISTEMA,
  PALABRAS_DE_ERROR_DE_LECTOR,
  llavePublicaBienFormada,
  motivoCapturado,
  procedeAsignarLector,
  procedeBajaDeLector,
  procedeSoltarLector,
  type ErrorDeAccionDeLector,
} from "@jtel/domain";

/**
 * Las acciones sobre un lector — la pantalla «Lectores» de J-Staff.
 *
 * Espejo de `acciones-dispositivo.ts`, y por las mismas razones: la regla del
 * dominio dice si procede, el repositorio escribe en transacción, y el error
 * vuelve **en palabras de quien captura**. Quién puede pedirla lo decide la
 * ruta, que tiene la sesión.
 *
 * ## El muro aquí no es el de siempre, y conviene decirlo
 *
 * En dispositivos el muro es «este aparato es de esta cuenta»: un carrier no ve
 * lo ajeno. **J-Staff cruza cuentas a propósito** —es el operador de la
 * plataforma—, así que el muro que queda es otro, y es el que de verdad
 * importa para el libro:
 *
 *   **un lector sólo se monta en una unidad de SU MISMO transportista.**
 *
 * Sin eso, el libro atribuiría un quemado a la unidad de una cuenta y el lector
 * a otra, y el día que la Pieza 10 reparta dinero no habría forma de saber a
 * quién le tocaba. No es una comodidad de pantalla: es que el renglón pueda
 * sostenerse.
 */

export type ErrorDeAccionDeLectorConCuenta =
  | ErrorDeAccionDeLector
  | "motivo_vacio"
  | "motivo_largo"
  | "llave_mal_formada"
  | "llave_ya_registrada"
  | "lector_no_encontrado"
  | "unidad_no_encontrada"
  | "unidad_de_otro_transportista"
  | "cuenta_no_encontrada"
  | "cambio_simultaneo";

export type ResultadoDeAccionDeLector<T> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorDeAccionDeLectorConCuenta; mensaje: string };

const PALABRAS: Record<ErrorDeAccionDeLectorConCuenta, string> = {
  ...PALABRAS_DE_ERROR_DE_LECTOR,
  llave_ya_registrada:
    "Esa llave ya está registrada en otro lector. Dos lectores con la misma llave harían que el libro no pudiera decir cuál de los dos quemó.",
  lector_no_encontrado: "Ese lector no existe.",
  unidad_no_encontrada: "Esa unidad no existe o está inactiva.",
  unidad_de_otro_transportista:
    "Esa unidad es de otro transportista. Un lector sólo se monta en un camión de su propia cuenta.",
  cuenta_no_encontrada: "Ese transportista no existe.",
  cambio_simultaneo: "Alguien movió este lector al mismo tiempo. Vuelve a cargar la página y revisa.",
};

const falla = (error: ErrorDeAccionDeLectorConCuenta) => ({
  ok: false as const,
  error,
  mensaje: PALABRAS[error],
});

/** Postgres dice 23505 cuando un índice único rechaza la escritura. */
function esChoqueDeCandado(e: unknown): boolean {
  const codigo =
    (e as { code?: string; cause?: { code?: string } } | null)?.code ??
    (e as { cause?: { code?: string } } | null)?.cause?.code;
  return codigo === "23505";
}

/** El lector con la unidad donde está montado ahora. */
async function lectorConUnidad(repos: Repositories, lectorId: string) {
  const lector = await repos.libroDeBoletos.lectorPorId(lectorId);
  if (!lector) return null;
  const vigente = await repos.libroDeBoletos.asignacionVigenteDeLector(lectorId);
  return { lector, unidadVigenteId: vigente?.unitId ?? null, unidadVigente: vigente?.unidad ?? null };
}

export async function darDeAltaLector(
  repos: Repositories,
  datos: { carrierId: string; llaveCapturada: string; unitId?: string | null; por: string | null },
): Promise<ResultadoDeAccionDeLector<{ lectorId: string; nombre: string; unidad: string | null }>> {
  const llave = String(datos.llaveCapturada ?? "").trim().toLowerCase();
  if (!llavePublicaBienFormada(llave)) return falla("llave_mal_formada");

  const cuenta = await repos.accounts.findById(datos.carrierId);
  if (!cuenta || cuenta.type !== "carrier") return falla("cuenta_no_encontrada");

  /* La unidad se comprueba ANTES de crear nada: un alta que deja el lector
     creado y sin montar por un error de captura obliga a ir a buscarlo. */
  let unidad: { id: string; label: string } | null = null;
  if (datos.unitId) {
    const asignables = await repos.libroDeBoletos.unidadesAsignables(datos.carrierId);
    const elegida = asignables.find((u) => u.id === datos.unitId);
    if (!elegida) return falla("unidad_no_encontrada");
    unidad = elegida;
  }

  const alta = await repos.libroDeBoletos.altaDeLector({
    carrierAccountId: datos.carrierId,
    llavePublica: llave,
    por: datos.por,
  });
  if (!alta.ok) return falla(alta.error);

  if (unidad) {
    await repos.libroDeBoletos.asignarLector(alta.lector.id, unidad.id, new Date(), datos.por);
  }
  return {
    ok: true,
    lectorId: alta.lector.id,
    nombre: alta.lector.label,
    unidad: unidad?.label ?? null,
  };
}

export async function asignarLector(
  repos: Repositories,
  datos: { lectorId: string; unitId: string; por: string | null; ahora: Date },
): Promise<ResultadoDeAccionDeLector<{ unidad: string }>> {
  const l = await lectorConUnidad(repos, datos.lectorId);
  if (!l) return falla("lector_no_encontrado");

  const unidad = await repos.libroDeBoletos.unidadPorId(datos.unitId);
  if (!unidad || !unidad.active) return falla("unidad_no_encontrada");
  /* El muro de esta pantalla: el lector y el camión son del mismo dueño. Se
     dice con su nombre en vez de esconderlo tras «no existe», porque quien
     pregunta es J-Staff y ve las dos cuentas de todos modos. */
  if (unidad.carrierAccountId !== l.lector.carrierAccountId) {
    return falla("unidad_de_otro_transportista");
  }

  const procede = procedeAsignarLector(
    { bajaEn: l.lector.bajaEn, unidadVigenteId: l.unidadVigenteId },
    { id: unidad.id, active: unidad.active },
  );
  if (!procede.ok) return falla(procede.error);

  try {
    await repos.libroDeBoletos.asignarLector(l.lector.id, unidad.id, datos.ahora, datos.por);
  } catch (e) {
    if (esChoqueDeCandado(e)) return falla("cambio_simultaneo");
    throw e;
  }
  return { ok: true, unidad: unidad.label };
}

export async function soltarLector(
  repos: Repositories,
  datos: { lectorId: string; motivo: string; por: string | null; ahora: Date },
): Promise<ResultadoDeAccionDeLector<{ solto: true }>> {
  const l = await lectorConUnidad(repos, datos.lectorId);
  if (!l) return falla("lector_no_encontrado");

  const motivo = motivoCapturado(datos.motivo);
  if (!motivo.ok) return falla(motivo.error);

  const procede = procedeSoltarLector({ bajaEn: l.lector.bajaEn, unidadVigenteId: l.unidadVigenteId });
  if (!procede.ok) return falla(procede.error);

  await repos.libroDeBoletos.soltarLector(l.lector.id, {
    at: datos.ahora,
    por: datos.por,
    motivo: motivo.motivo,
  });
  return { ok: true, solto: true };
}

/**
 * Dar de baja: fecha, motivo y quién, **y la llave revocada en el instante**.
 *
 * Es lo que separa esta baja de la de un GPS: desde que esta escritura
 * confirma, los lotes de ese aparato se rechazan y el intento queda escrito.
 * Por eso no hay baja con fecha futura — una revocación programada es una
 * llave viva.
 */
export async function darDeBajaLector(
  repos: Repositories,
  datos: { lectorId: string; motivo: string; por: string | null; ahora: Date },
): Promise<ResultadoDeAccionDeLector<{ solto: boolean }>> {
  const l = await lectorConUnidad(repos, datos.lectorId);
  if (!l) return falla("lector_no_encontrado");

  const motivo = motivoCapturado(datos.motivo);
  if (!motivo.ok) return falla(motivo.error);

  const procede = procedeBajaDeLector({ bajaEn: l.lector.bajaEn, unidadVigenteId: l.unidadVigenteId });
  if (!procede.ok) return falla(procede.error);

  const r = await repos.libroDeBoletos.bajaDeLector(l.lector.id, {
    at: datos.ahora,
    por: datos.por,
    motivo: MOTIVO_SISTEMA.baja(motivo.motivo),
  });
  /* Null es «ya estaba de baja»: la condición vive en el WHERE, así que dos
     bajas simultáneas no se pisan el motivo. */
  if (!r) return falla("ya_de_baja");
  return { ok: true, solto: r.soltada !== null };
}
