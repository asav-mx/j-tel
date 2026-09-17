import type { Repositories } from "@jtel/db";
import { JTTEL_TZ, instanteZonificado, localDateIso, ventanaDelDia } from "@jtel/domain";
import type { Modalidad } from "./recorrido-del-dia.js";

/**
 * Los servicios declarados de una unidad en un día — los atajos «de la
 * operación» del recorrido (ficha C3, decisión 2).
 *
 * **Lo declarado fija la ventana y nada más** (decisión 13): esto sólo da
 * horas para acotar el periodo. No se dibuja, no se compara, no dice si se
 * cumplió.
 *
 * El código no conoce ningún cliente, ruta ni circuito: los lee.
 */

export type ServicioDeclarado = {
  nombre: string;
  modalidad: Modalidad;
  desde: Date;
  hasta: Date;
};

export type ServiciosDelDia =
  /** El carrier no tiene contrato de especial ni concesión: la sección no existe. */
  | { reservada: false }
  | {
      reservada: true;
      dia: string;
      servicios: ServicioDeclarado[];
      /**
       * Circuitos que la unidad corría ese día y cuyo horario de entonces no se
       * guardó. El horario de un circuito vive en columnas que se sobrescriben:
       * aplicar el de hoy a un día pasado produciría una ventana falsa, así que
       * no se ofrece botón — pero tampoco se dice «sin servicios declarados»,
       * que sería falso.
       */
      circuitosSinHorario: string[];
    };

type Repos = Pick<Repositories, "fleet" | "expedientes">;

const minutosDe = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
};

/** `null` si la unidad no es de ese carrier: desde aquí no existe. */
export async function serviciosDeUnidadEnDia(
  repos: Repos,
  opciones: { carrierAccountId: string; unitId: string; dia: string; ahora: Date; timeZone?: string },
): Promise<ServiciosDelDia | null> {
  const { carrierAccountId, unitId, dia, ahora } = opciones;
  const timeZone = opciones.timeZone ?? JTTEL_TZ;

  const unidades = await repos.fleet.getUnitsForCarrier(carrierAccountId);
  if (!unidades.some((u) => u.id === unitId)) return null;
  if (!(await repos.expedientes.ligadoAServiciosDeclarados(carrierAccountId, ahora))) {
    return { reservada: false };
  }

  const delDia = ventanaDelDia(dia, timeZone);
  const [especiales, circuitos] = await Promise.all([
    repos.expedientes.especialesDeUnidadQueEmpiezanEntre(carrierAccountId, unitId, delDia.desde, delDia.hasta),
    repos.expedientes.circuitosDeUnidadEntre(carrierAccountId, unitId, delDia.desde, delDia.hasta),
  ]);

  const servicios: ServicioDeclarado[] = especiales.map((e) => ({
    nombre: `${e.cliente} · ${e.ruta}`,
    modalidad: "especial",
    desde: e.ventanaDesde,
    hasta: e.ventanaHasta,
  }));
  const circuitosSinHorario: string[] = [];
  const vistos = new Set<string>();
  for (const c of circuitos) {
    if (vistos.has(c.circuitoId)) continue;
    vistos.add(c.circuitoId);
    if (dia !== localDateIso(ahora, c.zona)) {
      circuitosSinHorario.push(c.nombre);
      continue;
    }
    const inicio = minutosDe(c.inicioLocal);
    const fin = minutosDe(c.finLocal);
    servicios.push({
      nombre: c.nombre,
      modalidad: "circuito",
      desde: instanteZonificado(dia, inicio, c.zona),
      hasta: instanteZonificado(dia, fin > inicio ? fin : fin + 1440, c.zona),
    });
  }

  servicios.sort((a, b) => a.desde.getTime() - b.desde.getTime());
  return { reservada: true, dia, servicios, circuitosSinHorario };
}
