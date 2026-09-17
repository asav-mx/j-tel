import type { Repositories } from "@jtel/db";
import { GRUPOS_DE_DISPOSITIVO, type EstadoDeDispositivo } from "@jtel/domain";
import { clasificarFlotaDeCuenta } from "./flota-compas.js";

/**
 * El cuarto Dispositivos — el inventario del transportista (Marco 6.6), C4-b.
 *
 * No clasifica nada: la clasificación es la de Flota en vivo y Expedientes
 * (`clasificarFlotaDeCuenta`, #411). Aquí sólo se agrupa en el orden del
 * inventario —EN UNIDAD · EN BODEGA · DESCONECTADO · DE BAJA— y se le pone a
 * cada dispositivo el número económico de su unidad, para que la pantalla no
 * tenga que cruzar ids.
 *
 * `unidades` es lo que el panel de asignar de Ver ‹dispositivo› ofrece (C4-c):
 * las activas de la cuenta, cada una con el dispositivo que trae ahora. Una
 * unidad inactiva no recibe dispositivo (`procedeAsignar`), así que no se
 * ofrece: un botón que la regla va a rechazar es una promesa falsa (6.19).
 */

export interface DispositivoDelInventario {
  id: string;
  nombre: string | null;
  imei: string;
  estado: EstadoDeDispositivo;
  /** El número económico de la unidad donde está montado, si lo está. */
  unidad: string | null;
}

export interface UnidadParaAsignar {
  id: string;
  numeroEconomico: string;
  /** El dispositivo que trae montado ahora, o null si está libre. */
  trae: { id: string; nombre: string } | null;
}

export interface CuartoDeDispositivos {
  grupos: Record<(typeof GRUPOS_DE_DISPOSITIVO)[number], DispositivoDelInventario[]>;
  total: number;
  unidades: UnidadParaAsignar[];
}

type Repos = Parameters<typeof clasificarFlotaDeCuenta>[0] & Pick<Repositories, "fleet">;

const porNombre = (a: { nombre: string | null; imei: string }, b: { nombre: string | null; imei: string }) =>
  (a.nombre ?? a.imei).localeCompare(b.nombre ?? b.imei, "es", { numeric: true });

export async function cargarCuartoDeDispositivos(
  repos: Repos,
  entrada: { carrierAccountId: string; ahora: Date },
): Promise<CuartoDeDispositivos> {
  const { carrierAccountId, ahora } = entrada;
  const [{ flota }, unidadesRaw] = await Promise.all([
    clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, { incluirInactivas: true }),
    repos.fleet.getUnitsForCarrier(carrierAccountId),
  ]);
  const etiqueta = new Map(unidadesRaw.map((u) => [u.id, u.label]));

  const grupos: CuartoDeDispositivos["grupos"] = { en_unidad: [], en_bodega: [], desconectado: [], de_baja: [] };
  const traePorUnidad = new Map<string, { id: string; nombre: string }>();
  for (const { dispositivo, estado } of flota.dispositivos) {
    const unidadId = "unidadId" in estado ? estado.unidadId : null;
    grupos[estado.grupo].push({
      id: dispositivo.id,
      nombre: dispositivo.label,
      imei: dispositivo.imei,
      estado,
      unidad: unidadId ? (etiqueta.get(unidadId) ?? null) : null,
    });
    if (unidadId) traePorUnidad.set(unidadId, { id: dispositivo.id, nombre: dispositivo.label ?? dispositivo.imei });
  }
  for (const g of GRUPOS_DE_DISPOSITIVO) grupos[g].sort(porNombre);

  const unidades = unidadesRaw
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, numeroEconomico: u.label, trae: traePorUnidad.get(u.id) ?? null }))
    .sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true }));

  return { grupos, total: flota.dispositivos.length, unidades };
}
