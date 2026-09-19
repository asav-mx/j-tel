import type { Repositories } from "@jtel/db";
import {
  CLAVE_DE_LA_LICENCIA,
  PALABRAS_DE_CHOFER,
  choqueDeChofer,
  identidadDeChoferCapturada,
  palabrasDeChoferRepetido,
  palabrasDeLicenciaRepetida,
  vencimientoCapturado,
  type ErrorDeChofer,
} from "@jtel/domain";

/**
 * Dar de alta y corregir un chofer, con la cuenta de por medio — Choferes V1.
 *
 * El mismo orden que la unidad (`acciones-unidad.ts`, C4-e):
 *
 *   1. lo que se nombra es **de esta cuenta** (un id ajeno responde igual que
 *      uno inexistente);
 *   2. la regla del dominio limpia lo capturado y dice si choca con otro chofer
 *      activo de la cuenta — en palabras, con el nombre que chocó;
 *   3. el repositorio escribe;
 *   4. si la base rechaza lo que el paso 2 no vio —dos altas a la vez—, el
 *      candado de la 0042 lo dice, y se traduce aquí.
 *
 * Quién puede pedirlo (coordinador y admin, `fleet.manage`) lo decide la ruta.
 */

export type ErrorDeAccionDeChofer = ErrorDeChofer | "chofer_no_encontrado" | "sin_papel_de_licencia";

export type ResultadoDeChofer =
  | { ok: true; driverId: string; nombre: string }
  | { ok: false; error: ErrorDeAccionDeChofer; mensaje: string };

const NO_ENCONTRADO = "Ese chofer no es de esta cuenta.";

type Actor = { kind: string; id: string | null };

/** El índice único que rechazó la escritura, si fue uno (Postgres 23505). */
function candadoQueChoco(e: unknown): string | null {
  const x = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } } | null;
  const codigo = x?.code ?? x?.cause?.code;
  if (codigo !== "23505") return null;
  return x?.constraint_name ?? x?.cause?.constraint_name ?? "";
}

function traducirCandado(e: unknown, identidad: { nombre: string; licencia: string }): ResultadoDeChofer | null {
  const candado = candadoQueChoco(e);
  if (candado === null) return null;
  if (candado === "driver_credentials_licencia_unica_por_cuenta") {
    return { ok: false, error: "licencia_repetida", mensaje: palabrasDeLicenciaRepetida(identidad.licencia) };
  }
  // El de nombre, o uno sin nombre legible: lo único que puede repetirse al dar
  // de alta un chofer es su nombre o su licencia.
  return { ok: false, error: "nombre_repetido", mensaje: palabrasDeChoferRepetido(identidad.nombre) };
}

/**
 * El tipo «Licencia» del catálogo del mercado de la cuenta, si lo tiene. Ahí
 * vive el vencimiento (enmienda 2). Sin mercado, o sin ese papel en su
 * catálogo, el vencimiento no tiene dónde guardarse, y la pantalla no lo pide.
 */
export async function papelDeLicenciaDeCuenta(
  repos: Pick<Repositories, "expedientes">,
  carrierId: string,
): Promise<{ documentTypeId: string } | null> {
  const mercado = await repos.expedientes.mercadoDeCuenta(carrierId);
  if (!mercado) return null;
  const catalogo = await repos.expedientes.catalogo(mercado.id, "chofer");
  const licencia = catalogo.find((c) => c.tipo.clave === CLAVE_DE_LA_LICENCIA);
  return licencia ? { documentTypeId: licencia.tipo.id } : null;
}

export async function darDeAltaChofer(
  repos: Repositories,
  datos: { carrierId: string; nombre: string; licencia: string; venceEl: string; actor: Actor },
): Promise<ResultadoDeChofer> {
  const capturada = identidadDeChoferCapturada({ nombre: datos.nombre, licencia: datos.licencia });
  if (!capturada.ok) return { ok: false, error: capturada.error, mensaje: PALABRAS_DE_CHOFER[capturada.error] };
  const identidad = capturada.identidad;
  const vence = vencimientoCapturado(datos.venceEl);
  if (!vence.ok) return { ok: false, error: vence.error, mensaje: PALABRAS_DE_CHOFER[vence.error] };

  const choque = choqueDeChofer(identidad, await repos.expedientes.identidadesDeChoferes(datos.carrierId));
  if (choque) return { ok: false, ...choque };

  const papel = await papelDeLicenciaDeCuenta(repos, datos.carrierId);
  if (!papel && vence.fecha) {
    // La pantalla no ofrece el campo en ese caso; si llega igual, no se tira en silencio.
    return {
      ok: false,
      error: "sin_papel_de_licencia",
      mensaje: "El catálogo de su mercado no tiene «Licencia»: el vencimiento no tiene dónde guardarse. Da de alta sin él.",
    };
  }

  try {
    const chofer = await repos.expedientes.darDeAltaChofer({
      carrierAccountId: datos.carrierId,
      nombre: identidad.nombre,
      licencia: identidad.licencia,
      papelDeLicencia: papel ? { documentTypeId: papel.documentTypeId, venceEl: vence.fecha } : null,
      actor: datos.actor,
    });
    return { ok: true, driverId: chofer.id, nombre: identidad.nombre };
  } catch (e) {
    const traducido = traducirCandado(e, identidad);
    if (traducido) return traducido;
    throw e;
  }
}

export async function corregirChofer(
  repos: Repositories,
  datos: { carrierId: string; driverId: string; nombre: string; licencia: string; actor: Actor },
): Promise<ResultadoDeChofer> {
  const todos = await repos.expedientes.identidadesDeChoferes(datos.carrierId);
  if (!todos.some((c) => c.id === datos.driverId)) {
    return { ok: false, error: "chofer_no_encontrado", mensaje: NO_ENCONTRADO };
  }

  const capturada = identidadDeChoferCapturada({ nombre: datos.nombre, licencia: datos.licencia });
  if (!capturada.ok) return { ok: false, error: capturada.error, mensaje: PALABRAS_DE_CHOFER[capturada.error] };
  const identidad = capturada.identidad;

  const choque = choqueDeChofer(identidad, todos, datos.driverId);
  if (choque) return { ok: false, ...choque };

  const papel = await papelDeLicenciaDeCuenta(repos, datos.carrierId);
  try {
    const fila = await repos.expedientes.corregirChofer(
      datos.carrierId,
      datos.driverId,
      { nombre: identidad.nombre, licencia: identidad.licencia },
      papel,
      datos.actor,
    );
    if (!fila) return { ok: false, error: "chofer_no_encontrado", mensaje: NO_ENCONTRADO };
    return { ok: true, driverId: datos.driverId, nombre: identidad.nombre };
  } catch (e) {
    const traducido = traducirCandado(e, identidad);
    if (traducido) return traducido;
    throw e;
  }
}
