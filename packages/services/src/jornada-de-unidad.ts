import { addDaysIso, armarJornada, type Jornada, type PuntoTraza } from "@jtel/domain";
import { aperturaDeclaradaEnFecha } from "@jtel/domain/publico";
import type { Repositories } from "@jtel/db";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/**
 * La lectura de la jornada de una unidad — PR B de la ficha de la jornada
 * (21-sep-2026). Junta lo ya guardado y se lo da a `armarJornada`, que es donde
 * vive la regla. **No escribe nada.**
 *
 * ## Quién lee, y por qué con la cuenta de la concesión
 *
 * **Sólo J-Staff, por ahora.** La concesión es J-Tel, y J-Staff mira el
 * circuito como su concesión dueña: los pasos se leen con
 * `circuito.concessionAccountId`, por la misma puerta del muro que usa la torre
 * (9.14). La cara del transportista —la jornada de SUS unidades— llega después,
 * con su muro, si ASAV lo decide.
 *
 * ## Las posiciones, sólo mientras estuvo asignada AQUÍ
 *
 * Lo que la unidad hizo fuera de este circuito es negocio del transportista
 * (9.14, cajón privado) y no es de esta jornada. Por eso las posiciones se leen
 * sólo dentro de las asignaciones de la unidad a este circuito, con la cuenta
 * del carrier de cada asignación (el muro de `telemetry_points`, Pieza 1.C).
 * Se piden con un margen de una hora a cada lado del día —siempre dentro de la
 * asignación—: sirve para saber si había señal en la apertura, no para contar.
 *
 * **Las asignaciones las trae quien llama**, leídas con `listAssignments` desde
 * la cara de J-Staff: esa lectura entrega las de TODOS los carriers del
 * circuito y la valla `guardia-asignar-circuito` sólo la deja vivir bajo
 * `/jstaff/`. Este módulo no la abre por la puerta de atrás.
 */

/** Una asignación de unidad a circuito, como la entrega `listAssignments`. */
export interface AsignacionParaJornada {
  unitId: string;
  unitLabel: string;
  carrierAccountId: string;
  validFrom: Date;
  validTo: Date | null;
}

/** Margen de lectura a cada lado del día: evidencia de los bordes, nada más. */
const MARGEN_MS = 60 * 60_000;

export type JornadaDeUnidad =
  | { estado: "no_existe" }
  | { estado: "no_ha_abierto"; abre: Date }
  | { estado: "sin_asignacion" }
  | {
      estado: "jornada";
      circuito: { id: string; nombre: string; zona: string };
      unidad: { id: string; etiqueta: string };
      fecha: string;
      jornada: Jornada;
    };

export async function cargarJornadaParaJStaff(
  repos: Repositories,
  e: { circuitId: string; unitId: string; fecha: string; ahora: Date; asignaciones: AsignacionParaJornada[] },
): Promise<JornadaDeUnidad> {
  const circuito = await repos.circuits.getCircuit(e.circuitId);
  if (!circuito) return { estado: "no_existe" };
  const zona = circuito.timeZone;

  const apertura = aperturaDeclaradaEnFecha(circuito.serviceStartLocal, e.fecha, zona);
  let cierre = aperturaDeclaradaEnFecha(circuito.serviceEndLocal, e.fecha, zona);
  // Cierre a la misma hora o antes que la apertura: el servicio cruza medianoche (o dura 24 h).
  if (cierre.getTime() <= apertura.getTime()) {
    cierre = aperturaDeclaradaEnFecha(circuito.serviceEndLocal, addDaysIso(e.fecha, 1), zona);
  }
  if (e.ahora.getTime() < apertura.getTime()) return { estado: "no_ha_abierto", abre: apertura };
  const finDelDia = cierre.getTime() < e.ahora.getTime() ? cierre : e.ahora;

  /*
   * Las asignaciones de ESTA unidad a ESTE circuito que tocan el día. Sin
   * ninguna, no hay jornada: la unidad no corría aquí, y sus posiciones no son
   * de este circuito.
   */
  const asignaciones = e.asignaciones.filter(
    (a) =>
      a.unitId === e.unitId &&
      a.validFrom.getTime() <= finDelDia.getTime() &&
      (a.validTo === null || a.validTo.getTime() >= apertura.getTime()),
  );
  if (asignaciones.length === 0) return { estado: "sin_asignacion" };

  // La jornada va de la apertura (o desde que se asignó) al cierre (o hasta que se soltó, o ahora).
  const desde = new Date(Math.max(apertura.getTime(), Math.min(...asignaciones.map((a) => a.validFrom.getTime()))));
  const hasta = new Date(
    Math.min(finDelDia.getTime(), Math.max(...asignaciones.map((a) => a.validTo?.getTime() ?? Infinity))),
  );

  const lecturas = asignaciones.map((a) => {
    const de = Math.max(a.validFrom.getTime(), desde.getTime() - MARGEN_MS);
    const a_ = Math.min(a.validTo?.getTime() ?? Infinity, hasta.getTime() + MARGEN_MS, e.ahora.getTime());
    return de < a_
      ? repos.telemetry.getForUnitWindow(a.carrierAccountId, e.unitId, new Date(de), new Date(a_))
      : Promise.resolve([]);
  });

  const [filasPorAsignacion, pasos, medidoHasta, paradas, trazados] = await Promise.all([
    Promise.all(lecturas),
    repos.pasosPorParada.listarPasosDeUnidad(circuito.concessionAccountId, e.circuitId, e.unitId, desde, hasta),
    repos.pasosPorParada.marcaDeDeteccion(e.circuitId, e.unitId, VERSION_DEL_DETECTOR),
    repos.circuits.listStopsEnInstante(e.circuitId, hasta),
    repos.circuits.getPaths(e.circuitId),
  ]);

  const puntos: PuntoTraza[] = filasPorAsignacion.flat().map((f) => ({
    lat: Number(f.latitude),
    lng: Number(f.longitude),
    at: f.recordedAt,
    speed: f.speed === null ? null : Number(f.speed),
  }));

  const jornada = armarJornada({
    ventana: { desde, hasta },
    puntos,
    paradas: paradas.map((p) => ({
      stopId: p.stopId,
      nombre: p.name,
      sentido: p.sentido as "ida" | "vuelta" | null,
      lat: Number(p.latitude),
      lon: Number(p.longitude),
    })),
    // Sólo la versión del detector que corre hoy: los pasos apilan por versión.
    pasos: pasos
      .filter((p) => p.detectorVersion === VERSION_DEL_DETECTOR)
      .map((p) => ({
        stopId: p.stopId,
        sentido: p.sentido as "ida" | "vuelta",
        pasoDesde: p.pasoDesde,
        pasoHasta: p.pasoHasta,
      })),
    trazados: trazados.map((t) => ({
      sentido: t.sentido as "ida" | "vuelta",
      coordinates: t.coordinates as Array<[number, number]>,
    })),
    medidoHasta,
    silencioSegundos: circuito.staleAfterSeconds,
    corredorMetros: circuito.corridorToleranceMeters,
  });

  return {
    estado: "jornada",
    circuito: { id: circuito.id, nombre: circuito.name, zona },
    unidad: { id: e.unitId, etiqueta: asignaciones[0]!.unitLabel },
    fecha: e.fecha,
    jornada,
  };
}
