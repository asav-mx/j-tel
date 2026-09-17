import type { Repositories } from "@jtel/db";
import {
  PALABRAS_DE_ERROR,
  esPrefijoDeModelo,
  motivoCapturado,
  procedeAsignar,
  procedeBaja,
  procedeSoltar,
  validarImei,
  type ErrorDeAccion,
} from "@jtel/domain";

/**
 * Las acciones sobre un dispositivo, con la cuenta de por medio — C4.
 *
 * Cada acción hace lo mismo en el mismo orden:
 *
 *   1. lo que se nombra es **de esta cuenta** (el muro entre carriers, Pieza
 *      1.C: un id ajeno responde igual que uno inexistente);
 *   2. la regla del dominio dice si procede;
 *   3. el repositorio escribe, en transacción;
 *   4. el error vuelve **en palabras de quien captura**, listo para la pantalla.
 *
 * Quién puede pedirla (coordinador y admin, provisional hasta la 6.29) lo
 * decide la ruta, que tiene la sesión. Aquí `por` es el id de ese usuario, y
 * `ahora` es la única hora posible: asignar y soltar son sólo «ahora»
 * (decisión del 16 sep 2026).
 */

export type ErrorDeAccionDeDispositivo =
  | ErrorDeAccion
  | "motivo_vacio"
  | "motivo_largo"
  | "imei_invalido"
  | "modelo_desconocido"
  | "imei_ya_en_la_cuenta"
  | "imei_en_otra_cuenta"
  | "dispositivo_no_encontrado"
  | "unidad_no_encontrada"
  | "cambio_simultaneo";

export type ResultadoDeAccion<T> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorDeAccionDeDispositivo; mensaje: string };

const PALABRAS: Record<Exclude<ErrorDeAccionDeDispositivo, "imei_invalido">, string> = {
  ...PALABRAS_DE_ERROR,
  modelo_desconocido: "Ese modelo no está en el catálogo de la plataforma.",
  imei_ya_en_la_cuenta: "Ese IMEI ya está dado de alta en esta cuenta.",
  imei_en_otra_cuenta:
    "Ese IMEI ya está dado de alta en otra cuenta. No se da de alta dos veces: pide a J-Tel que lo mueva.",
  dispositivo_no_encontrado: "Ese dispositivo no es de esta cuenta.",
  unidad_no_encontrada: "Esa unidad no es de esta cuenta.",
  cambio_simultaneo: "Alguien cambió este dispositivo al mismo tiempo. Vuelve a cargar la página y revisa.",
};

function falla(error: Exclude<ErrorDeAccionDeDispositivo, "imei_invalido">) {
  return { ok: false as const, error, mensaje: PALABRAS[error] };
}

/** Postgres dice 23505 cuando un índice único rechaza la escritura. */
function esChoqueDeCandado(e: unknown): boolean {
  const codigo = (e as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
  return codigo === "23505";
}

/** El dispositivo de la cuenta con la unidad donde está montado ahora. */
async function dispositivoConUnidad(repos: Repositories, carrierId: string, deviceId: string) {
  const dispositivo = await repos.expedientes.dispositivoDeCuenta(carrierId, deviceId);
  if (!dispositivo) return null;
  const asignaciones = await repos.expedientes.asignacionesDeDispositivo(carrierId, deviceId);
  const vigente = asignaciones.find((a) => a.hasta === null) ?? null;
  return { dispositivo, unidadVigenteId: vigente?.unitId ?? null };
}

export async function darDeAltaDispositivo(
  repos: Repositories,
  datos: { carrierId: string; imeiCapturado: string; prefijo: string },
): Promise<ResultadoDeAccion<{ deviceId: string; nombre: string }>> {
  const imei = validarImei(datos.imeiCapturado);
  if (!imei.ok) return { ok: false, error: "imei_invalido", mensaje: imei.motivo };
  if (!esPrefijoDeModelo(datos.prefijo)) return falla("modelo_desconocido");

  try {
    const r = await repos.fleet.darDeAltaDispositivo({
      carrierAccountId: datos.carrierId,
      imei: imei.imei,
      prefijo: datos.prefijo,
    });
    if (!r.ok) return falla(r.error);
    return { ok: true, deviceId: r.dispositivo.id, nombre: r.dispositivo.label! };
  } catch (e) {
    if (esChoqueDeCandado(e)) return falla("imei_ya_en_la_cuenta");
    throw e;
  }
}

export async function asignarDispositivo(
  repos: Repositories,
  datos: { carrierId: string; deviceId: string; unitId: string; por: string; ahora: Date },
): Promise<ResultadoDeAccion<{ unidadAnteriorId: string | null; dispositivoDesplazadoId: string | null }>> {
  const d = await dispositivoConUnidad(repos, datos.carrierId, datos.deviceId);
  if (!d) return falla("dispositivo_no_encontrado");
  const unidad = await repos.expedientes.unidadDeCuenta(datos.carrierId, datos.unitId);
  if (!unidad) return falla("unidad_no_encontrada");
  // El que la unidad traía y va a quedar en bodega (decisión 6 de la ficha).
  // La unidad ya es de la cuenta, así que sus asignaciones también.
  const desplazado = (await repos.fleet.asignacionesDeUnidad(unidad.id)).find((a) => a.hasta === null) ?? null;

  const procede = procedeAsignar(
    { retiredAt: d.dispositivo.retiredAt, unidadVigenteId: d.unidadVigenteId },
    { id: unidad.id, active: unidad.active },
  );
  if (!procede.ok) return falla(procede.error);

  try {
    await repos.fleet.assignDevice(unidad.id, d.dispositivo.id, datos.ahora, datos.por);
  } catch (e) {
    if (esChoqueDeCandado(e)) return falla("cambio_simultaneo");
    throw e;
  }
  return {
    ok: true,
    unidadAnteriorId: d.unidadVigenteId,
    dispositivoDesplazadoId: desplazado && desplazado.deviceId !== d.dispositivo.id ? desplazado.deviceId : null,
  };
}

export async function soltarDispositivo(
  repos: Repositories,
  datos: { carrierId: string; deviceId: string; motivo: string; por: string; ahora: Date },
): Promise<ResultadoDeAccion<{ unidadId: string }>> {
  const motivo = motivoCapturado(datos.motivo);
  if (!motivo.ok) return falla(motivo.error);

  const d = await dispositivoConUnidad(repos, datos.carrierId, datos.deviceId);
  if (!d) return falla("dispositivo_no_encontrado");
  const procede = procedeSoltar({ retiredAt: d.dispositivo.retiredAt, unidadVigenteId: d.unidadVigenteId });
  if (!procede.ok) return falla(procede.error);

  const cerrada = await repos.fleet.soltarDispositivo(d.dispositivo.id, {
    at: datos.ahora,
    por: datos.por,
    motivo: motivo.motivo,
  });
  // Entre leer y escribir, alguien más lo soltó o lo movió.
  if (!cerrada) return falla("cambio_simultaneo");
  return { ok: true, unidadId: cerrada.unitId };
}

export async function darDeBajaDispositivo(
  repos: Repositories,
  datos: { carrierId: string; deviceId: string; motivo: string; por: string; ahora: Date },
): Promise<ResultadoDeAccion<{ unidadSoltadaId: string | null }>> {
  const motivo = motivoCapturado(datos.motivo);
  if (!motivo.ok) return falla(motivo.error);

  const d = await dispositivoConUnidad(repos, datos.carrierId, datos.deviceId);
  if (!d) return falla("dispositivo_no_encontrado");
  const procede = procedeBaja({ retiredAt: d.dispositivo.retiredAt, unidadVigenteId: d.unidadVigenteId });
  if (!procede.ok) return falla(procede.error);

  const r = await repos.fleet.darDeBajaDispositivo(d.dispositivo.id, {
    at: datos.ahora,
    por: datos.por,
    motivo: motivo.motivo,
  });
  if (!r) return falla("ya_de_baja");
  return { ok: true, unidadSoltadaId: r.soltada?.unitId ?? null };
}
