/**
 * Reunir los datos del historial de flota — la parte que sí toca base de datos.
 *
 * La medición vive en `historial-unidad.ts` y se prueba sin base de datos.
 * Aquí solo se consulta, se acota y se arma.
 *
 * Confidencialidad: todo cuelga de `carrierAccountId`, que es columna de la
 * propia fila y no un join. No existe camino por el que se cuele la operación
 * de otro carrier. Y a la inversa: esta superficie es del carrier sobre sí
 * mismo, así que sí ve a qué cliente sirvió — es su propio contrato.
 */

import { JTTEL_TZ } from "@/lib/local-time";
import { getRepos } from "@/lib/db";
import { type Periodo } from "@/lib/historial-periodo";
import {
  construirDias,
  REGLAS_POR_DEFECTO,
  type DiaDeUnidad,
  type PuntoDeUnidad,
  type ReglasDeLectura,
} from "@/lib/historial-unidad";

export type UnidadDeFlota = {
  id: string;
  label: string;
  plateNumber: string | null;
  activa: boolean;
};

export type FilaDeFlota = {
  unidad: UnidadDeFlota;
  dia: DiaDeUnidad;
};

/**
 * El día de cada unidad de la flota, sobre la misma franja.
 *
 * Se consulta una vez para todo el carrier y se reparte en memoria: una
 * consulta por unidad serían 52 viajes a la base para dibujar una pantalla.
 */
export async function cargarFlota(entrada: {
  carrierAccountId: string;
  periodo: Periodo;
  reglas?: ReglasDeLectura;
}): Promise<FilaDeFlota[]> {
  const repos = getRepos();
  const [unidades, puntos] = await Promise.all([
    repos.fleet.getUnitsForCarrier(entrada.carrierAccountId),
    repos.telemetry.getForCarrierWindow(
      entrada.carrierAccountId,
      entrada.periodo.desde,
      entrada.periodo.hasta,
    ),
  ]);

  const porUnidad = new Map<string, PuntoDeUnidad[]>();
  for (const p of puntos) {
    if (!p.unitId) continue;
    const lista = porUnidad.get(p.unitId);
    const punto: PuntoDeUnidad = {
      recordedAt: p.recordedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      imei: p.imei,
    };
    if (lista) lista.push(punto);
    else porUnidad.set(p.unitId, [punto]);
  }

  return unidades.map((u) => {
    const dias = construirDias({
      fechas: entrada.periodo.fechas,
      minutosDesde: entrada.periodo.minutosDesde,
      minutosHasta: entrada.periodo.minutosHasta,
      timeZone: JTTEL_TZ,
      puntos: porUnidad.get(u.id) ?? [],
      reglas: entrada.reglas ?? REGLAS_POR_DEFECTO,
    });

    return {
      unidad: {
        id: u.id,
        label: u.label,
        plateNumber: u.plateNumber,
        activa: u.active,
      },
      // La vista de flota mira un día a la vez: la profundidad de días vive
      // en la vista de la unidad, donde 30 tiras sí se pueden leer.
      dia: dias[0]!,
    };
  });
}

export type ServicioDeUnidad = {
  occurrenceId: string;
  serviceDate: string;
  ruta: string | null;
  turno: string | null;
  cliente: string | null;
  planta: string | null;
  estado: "cumplido" | "no_cumplido" | "pendiente_evidencia";
  timing: "temprano" | "a_tiempo" | "tarde" | null;
  lateExcusable: boolean;
  deadline: Date | null;
  llegada: Date | null;
};

export type ServiciosDelPeriodo = {
  /** Los que el árbitro acreditó a ESTA unidad. */
  deLaUnidad: ServicioDeUnidad[];
  /**
   * Cuántos servicios del carrier en el periodo no están acreditados a
   * ninguna unidad. No es un hueco de datos: el motor solo persiste la unidad
   * observada cuando el resultado salió cumplido, así que un no cumplido o un
   * pendiente jamás nombran unidad. La pantalla tiene que decirlo — si no, se
   * lee como si la unidad no hubiera trabajado.
   */
  sinUnidadAcreditada: number;
};

export async function cargarServiciosDeUnidad(entrada: {
  carrierAccountId: string;
  unitId: string;
  periodo: Periodo;
}): Promise<ServiciosDelPeriodo> {
  const repos = getRepos();
  const contratos = await repos.contracts.findForCarrier(entrada.carrierAccountId);
  if (contratos.length === 0) return { deLaUnidad: [], sinUnidadAcreditada: 0 };

  const porContrato = await Promise.all(
    contratos.map((c) =>
      repos.occurrences.findForContract(c.id, entrada.periodo.desde, entrada.periodo.hasta),
    ),
  );

  const enPeriodo = porContrato
    .flat()
    .filter((o) => entrada.periodo.fechas.includes(o.serviceDate));

  const deLaUnidad: ServicioDeUnidad[] = [];
  let sinUnidadAcreditada = 0;

  for (const o of enPeriodo) {
    const hecho = o.complianceFact;
    if (!hecho) continue;
    if (!hecho.observedUnitId) {
      sinUnidadAcreditada++;
      continue;
    }
    if (hecho.observedUnitId !== entrada.unitId) continue;

    deLaUnidad.push({
      occurrenceId: o.id,
      serviceDate: o.serviceDate,
      ruta: o.profile?.routeShift?.route?.name ?? null,
      turno: o.profile?.routeShift?.shift?.name ?? null,
      cliente: o.contract?.client?.name ?? null,
      planta: o.contract?.plant?.name ?? o.contract?.plantGroup?.name ?? null,
      estado: hecho.status,
      timing: hecho.timing ?? null,
      lateExcusable: hecho.lateExcusable,
      deadline: hecho.expectedDeadline ?? null,
      llegada: hecho.observedArrivalAt ?? null,
    });
  }

  deLaUnidad.sort((a, b) => {
    if (a.serviceDate !== b.serviceDate) return b.serviceDate.localeCompare(a.serviceDate);
    return (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0);
  });

  return { deLaUnidad, sinUnidadAcreditada };
}

/**
 * Los días de UNA unidad, para la vista de cerca.
 *
 * CARA, y con número medido. La telemetría se lee por carrier —no hay índice
 * por `unit_id`— así que para dibujar una unidad hay que traer los puntos de
 * toda la flota y filtrar en memoria. Medido el 2026-07-30 contra un carrier
 * de 82 unidades: **1 día 2.5 s · 7 días entre 14 y 18 s**.
 *
 * Se probó partirlo en una consulta por día en paralelo, esperando que se
 * solaparan: no mejoró nada (14–18 s también). El cuello no es la espera de la
 * consulta sino el volumen que se transfiere y se parsea, así que se dejó la
 * versión simple.
 *
 * La salida NO es recortar más el rango —el carrier necesita ver su semana—
 * sino una consulta por unidad en `@jtel/db` con índice
 * `(carrier_account_id, unit_id, recorded_at)`. Eso vive en el paquete, no
 * aquí. Mientras tanto el tope de días de `historial-periodo` acota la espera y la
 * pantalla dice cuándo recortó.
 */
export async function cargarDiasDeUnidad(entrada: {
  carrierAccountId: string;
  unitId: string;
  periodo: Periodo;
  reglas?: ReglasDeLectura;
}): Promise<DiaDeUnidad[]> {
  const repos = getRepos();
  const puntos = await repos.telemetry.getForCarrierWindow(
    entrada.carrierAccountId,
    entrada.periodo.desde,
    entrada.periodo.hasta,
  );

  return construirDias({
    fechas: entrada.periodo.fechas,
    minutosDesde: entrada.periodo.minutosDesde,
    minutosHasta: entrada.periodo.minutosHasta,
    timeZone: JTTEL_TZ,
    puntos: puntos
      .filter((p) => p.unitId === entrada.unitId)
      .map((p) => ({
        recordedAt: p.recordedAt,
        latitude: p.latitude,
        longitude: p.longitude,
        imei: p.imei,
      })),
    reglas: entrada.reglas ?? REGLAS_POR_DEFECTO,
  });
}
