import type { Repositories } from "@jtel/db";
import { huellaDeLlave } from "@jtel/domain";
import { saludDelLector, type SaludDelLector } from "@jtel/domain/sincronizacion";

/**
 * El cuarto Lectores — el inventario de toda la plataforma (J-Staff).
 *
 * No clasifica por cuenta: **la pregunta de esta casa es si la plataforma está
 * sana** (decisión de Asav, 23-sep-2026), y partir la lista por transportista
 * escondería justo al lector que dejó de hablar. Cada lector dice de quién es.
 *
 * Aquí sólo se agrupa y se traduce lo que la base trajo. **La regla de qué es
 * estar mudo no vive aquí**: es de `@jtel/domain` (`saludDelLector`, con su
 * constante de 4 h de servicio), y se le pregunta con el horario del circuito
 * que el plan le asigna a la unidad del lector.
 */

/** Los grupos del inventario, en el orden en que se leen. */
export const GRUPOS_DE_LECTOR = ["en_unidad", "en_bodega", "mudo", "de_baja"] as const;

export type GrupoDeLector = (typeof GRUPOS_DE_LECTOR)[number];

export interface LectorDelInventario {
  id: string;
  /** `LEC-003`. */
  nombre: string;
  /** Los últimos seis de su llave, para comparar a ojo con el aparato. */
  huella: string;
  carrier: string;
  carrierAccountId: string;
  /** El número económico donde está montado, si lo está. */
  unidad: string | null;
  unitId: string | null;
  /** El circuito que el PLAN le asigna a esa unidad. Nunca el recorrido. */
  circuito: string | null;
  /** Su última entrega aceptada, o null si nunca ha entregado nada. */
  ultimoContacto: Date | null;
  /** Desde cuándo se le cuenta el silencio: su última entrega, o su alta. */
  salud: SaludDelLector;
  bajaEn: Date | null;
  bajaMotivo: string | null;
}

export interface CuartoDeLectores {
  grupos: Record<GrupoDeLector, LectorDelInventario[]>;
  /** Los que están en servicio: todo menos los de baja. */
  enServicio: number;
  total: number;
}

/**
 * En qué grupo cae un lector.
 *
 * **Mudo gana sobre en unidad**, porque es lo que pide hacer algo: un lector
 * montado y callado no se lee como uno montado y hablando. Un lector en bodega
 * no puede estar mudo — no hay servicio contra el cual contarle el silencio—,
 * y por eso la salud sólo se mira cuando tiene unidad.
 */
export function grupoDe(lector: {
  bajaEn: Date | null;
  unitId: string | null;
  salud: SaludDelLector;
}): GrupoDeLector {
  if (lector.bajaEn) return "de_baja";
  if (!lector.unitId) return "en_bodega";
  return lector.salud.estado === "mudo" ? "mudo" : "en_unidad";
}

export async function cuartoDeLectores(
  repos: Repositories,
  ahora: Date = new Date(),
): Promise<CuartoDeLectores> {
  const filas = await repos.libroDeBoletos.inventarioDeLectores();

  const lectores: LectorDelInventario[] = filas.map((f) => {
    const ultimoContacto = f.ultimaEntrega ? new Date(f.ultimaEntrega) : null;
    /*
     * Desde el alta cuando nunca ha entregado: un lector dado de alta hace diez
     * minutos no lleva callado desde el principio de los tiempos.
     */
    const desde = ultimoContacto ?? f.altaEn;
    const salud = saludDelLector({
      ultimoContacto: desde.getTime(),
      ahora: ahora.getTime(),
      horario:
        f.inicioLocal && f.finLocal && f.zona
          ? { inicioLocal: f.inicioLocal, finLocal: f.finLocal, zona: f.zona }
          : null,
    });
    return {
      id: f.id,
      nombre: f.label,
      huella: huellaDeLlave(f.llavePublica),
      carrier: f.carrier,
      carrierAccountId: f.carrierAccountId,
      unidad: f.unidad ?? null,
      unitId: f.unitId ?? null,
      circuito: f.circuito ?? null,
      ultimoContacto,
      salud,
      bajaEn: f.bajaEn ?? null,
      bajaMotivo: f.bajaMotivo ?? null,
    };
  });

  const grupos = Object.fromEntries(GRUPOS_DE_LECTOR.map((g) => [g, [] as LectorDelInventario[]])) as Record<
    GrupoDeLector,
    LectorDelInventario[]
  >;
  for (const l of lectores) grupos[grupoDe(l)].push(l);

  return {
    grupos,
    enServicio: lectores.filter((l) => !l.bajaEn).length,
    total: lectores.length,
  };
}
