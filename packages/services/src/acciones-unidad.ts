import type { Repositories } from "@jtel/db";
import {
  PALABRAS_DE_UNIDAD,
  choqueDeIdentidad,
  identidadCapturada,
  nombreComparable,
  palabrasDeNombreRepetido,
  palabrasDeVinRepetido,
  type ErrorDeUnidad,
} from "@jtel/domain";

/**
 * Dar de alta y corregir una unidad, con la cuenta de por medio — C4-e.
 *
 * El mismo orden que las acciones sobre un dispositivo (`acciones-dispositivo.ts`):
 *
 *   1. lo que se nombra es **de esta cuenta** (un id ajeno responde igual que
 *      uno inexistente);
 *   2. la regla del dominio limpia lo capturado y dice si choca con otra unidad
 *      de la cuenta — en palabras, con el nombre que chocó;
 *   3. el repositorio escribe;
 *   4. si la base rechaza lo que el paso 2 no vio —dos altas de la misma 2101
 *      al mismo tiempo—, el candado de la 0040 lo dice, y se traduce aquí.
 *
 * Quién puede pedirlo (coordinador y admin, `fleet.manage`) lo decide la ruta.
 */

export type ErrorDeAccionDeUnidad = ErrorDeUnidad | "unidad_no_encontrada";

export type ResultadoDeUnidad =
  | { ok: true; unitId: string; nombre: string }
  | { ok: false; error: ErrorDeAccionDeUnidad; mensaje: string };

const NO_ENCONTRADA = "Esa unidad no es de esta cuenta.";

/** El índice único que rechazó la escritura, si fue uno (Postgres 23505). */
function candadoQueChoco(e: unknown): string | null {
  const x = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } } | null;
  const codigo = x?.code ?? x?.cause?.code;
  if (codigo !== "23505") return null;
  return x?.constraint_name ?? x?.cause?.constraint_name ?? "";
}

function traducirCandado(e: unknown, identidad: { nombre: string; vin: string | null }): ResultadoDeUnidad | null {
  const candado = candadoQueChoco(e);
  if (candado === null) return null;
  if (candado === "units_vin_unico_por_cuenta" && identidad.vin) {
    return { ok: false, error: "vin_repetido", mensaje: palabrasDeVinRepetido(identidad.vin) };
  }
  // El de nombre, o uno sin nombre legible: lo único que puede repetirse al
  // dar de alta una unidad es su nombre o su VIN.
  return { ok: false, error: "nombre_repetido", mensaje: palabrasDeNombreRepetido(identidad.nombre) };
}

export async function darDeAltaUnidad(
  repos: Repositories,
  datos: { carrierId: string; nombre: string; placa: string; vin: string },
): Promise<ResultadoDeUnidad> {
  const capturada = identidadCapturada({ nombre: datos.nombre, placa: datos.placa, vin: datos.vin });
  if (!capturada.ok) return { ok: false, error: capturada.error, mensaje: PALABRAS_DE_UNIDAD[capturada.error] };
  const identidad = capturada.identidad;

  const choque = choqueDeIdentidad(identidad, await repos.fleet.identidadesDeUnidades(datos.carrierId));
  if (choque) return { ok: false, ...choque };

  try {
    const unidad = await repos.fleet.darDeAltaUnidad({
      carrierAccountId: datos.carrierId,
      label: identidad.nombre,
      plateNumber: identidad.placa,
      vin: identidad.vin,
    });
    return { ok: true, unitId: unidad.id, nombre: unidad.label };
  } catch (e) {
    const traducido = traducirCandado(e, identidad);
    if (traducido) return traducido;
    throw e;
  }
}

export async function corregirUnidad(
  repos: Repositories,
  datos: { carrierId: string; unitId: string; nombre: string; placa: string; vin: string },
): Promise<ResultadoDeUnidad> {
  const todas = await repos.fleet.identidadesDeUnidades(datos.carrierId);
  if (!todas.some((u) => u.id === datos.unitId)) {
    return { ok: false, error: "unidad_no_encontrada", mensaje: NO_ENCONTRADA };
  }

  const capturada = identidadCapturada({ nombre: datos.nombre, placa: datos.placa, vin: datos.vin });
  if (!capturada.ok) return { ok: false, error: capturada.error, mensaje: PALABRAS_DE_UNIDAD[capturada.error] };
  const identidad = capturada.identidad;

  const choque = choqueDeIdentidad(identidad, todas, datos.unitId);
  if (choque) return { ok: false, ...choque };

  try {
    const unidad = await repos.fleet.corregirUnidad(datos.carrierId, datos.unitId, {
      label: identidad.nombre,
      plateNumber: identidad.placa,
      vin: identidad.vin,
    });
    if (!unidad) return { ok: false, error: "unidad_no_encontrada", mensaje: NO_ENCONTRADA };
    return { ok: true, unitId: unidad.id, nombre: unidad.label };
  } catch (e) {
    const traducido = traducirCandado(e, identidad);
    if (traducido) return traducido;
    throw e;
  }
}

/**
 * ¿Ya hay en la cuenta un dispositivo EN SERVICIO con este nombre? Para el
 * alta vieja (`/api/carrier/devices`), que todavía deja teclear el nombre
 * hasta que C4-d la apague. El alta nueva no lo necesita: el nombre lo pone el
 * sistema con el consecutivo global (6.3), y no puede repetirse. La base lo
 * garantiza en los dos casos (0040, `devices_nombre_unico_en_servicio`).
 */
export async function nombreDeDispositivoEnUso(repos: Repositories, carrierId: string, nombre: string): Promise<boolean> {
  const buscado = nombreComparable(nombre);
  if (!buscado) return false;
  const dispositivos = await repos.fleet.getDevicesForCarrier(carrierId);
  return dispositivos.some((d) => d.retiredAt === null && d.label !== null && nombreComparable(d.label) === buscado);
}
