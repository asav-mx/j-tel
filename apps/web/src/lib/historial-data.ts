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

import { resumirUnidadDia, type ResumenUnidadDia } from "@jtel/db";
import { JTTEL_TZ } from "@/lib/local-time";
import { getRepos } from "@/lib/db";
import { type Periodo } from "@/lib/historial-periodo";
import { tiraDeFlota, type TramoDeFlota } from "@/lib/historial-flota";
import {
  construirDias,
  ventanasDelPeriodo,
  REGLAS_POR_DEFECTO,
  SALTO_GPS_KMH,
  type DiaDeUnidad,
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
  /** El día ya resumido por la base: conteos, kilómetros y huecos. */
  resumen: ResumenUnidadDia;
  /** La tira de dos clases. A esta escala es lo que se puede leer. */
  tira: TramoDeFlota[];
};

/**
 * El día de cada unidad de la flota, sobre la misma franja.
 *
 * La base resume y devuelve una fila por unidad; antes traía los puntos crudos
 * de todo el carrier —58 464 filas para dibujar 82 tiras— y los segmentaba en
 * memoria. El trabajo de recorrer decenas de miles de puntos no era necesario
 * para contestar la pregunta de esta pantalla, y por eso ya no se hace.
 *
 * Medido de punta a punta sobre la pantalla, mediana de cinco cargas en
 * caliente contra un carrier de 82 unidades (2026-07-30):
 *
 *   día completo   3385 ms → **530 ms**
 *   franja de 6 h  1290 ms → **325 ms**
 *
 * Las reglas de lectura viajan a la consulta en vez de quedarse en el default
 * del paquete. La pantalla escribe al pie "silencios de más de N min": si la
 * consulta usara otro número, ese texto estaría mintiendo.
 */
export async function cargarFlota(entrada: {
  carrierAccountId: string;
  periodo: Periodo;
  reglas?: ReglasDeLectura;
}): Promise<FilaDeFlota[]> {
  const repos = getRepos();
  const reglas = entrada.reglas ?? REGLAS_POR_DEFECTO;

  // La flota mira UNA franja: la primera del periodo. La profundidad de días
  // vive en la vista de la unidad, donde las tiras sí se pueden comparar.
  const [ventana] = ventanasDelPeriodo({
    fechas: entrada.periodo.fechas,
    minutosDesde: entrada.periodo.minutosDesde,
    minutosHasta: entrada.periodo.minutosHasta,
    timeZone: JTTEL_TZ,
  });

  const [unidades, resumen] = await Promise.all([
    repos.fleet.getUnitsForCarrier(entrada.carrierAccountId),
    ventana
      ? repos.telemetry.resumenDiarioPorUnidad(entrada.carrierAccountId, [ventana], {
          huecoMinutos: reglas.huecoMinutos,
          saltoKmh: SALTO_GPS_KMH,
        })
      : Promise.resolve([]),
  ]);

  const porUnidad = new Map(resumen.map((r) => [r.unitId, r]));

  return unidades.map((u) => {
    /*
     * La consulta solo devuelve unidades que reportaron algo, así que las
     * demás se completan desde el inventario — una unidad que no aparece se
     * lee como una unidad que no existe, y sin dato es justo lo que hay que
     * poder ver.
     *
     * El vacío se arma con `resumirUnidadDia`, la misma función que usa la
     * base, y no con un objeto de ceros a mano: así una unidad muda y una que
     * reportó pasan por el mismo cálculo y sus huecos se cuentan igual.
     */
    const dia =
      porUnidad.get(u.id) ??
      resumirUnidadDia({
        unitId: u.id,
        fecha: ventana?.fecha ?? entrada.periodo.fechaHasta,
        desde: ventana?.desde ?? entrada.periodo.desde,
        hasta: ventana?.hasta ?? entrada.periodo.hasta,
        equipos: 0,
        bloques: [],
      });

    return {
      unidad: {
        id: u.id,
        label: u.label,
        plateNumber: u.plateNumber,
        activa: u.active,
      },
      resumen: dia,
      tira: tiraDeFlota(dia, dia.bloques),
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
 * Aquí sí se traen los puntos, y a propósito: las tres clases —en movimiento,
 * detenida, sin dato— salen de un barrido con anclas sobre las coordenadas, y
 * eso no se resuelve con una función de ventana en SQL. Se calculan con la
 * implementación que ya existe y está probada, en vez de tener una segunda
 * versión de la misma regla esperando a divergir.
 *
 * Lo que cambió es cuántos puntos se traen: la consulta filtra la unidad en la
 * base y entra por el índice `(carrier_account_id, unit_id, recorded_at)`, así
 * que llegan los cientos de esa unidad y no las decenas de miles de la flota
 * entera. Con una tira sola en pantalla, segmentar cientos de puntos no cuesta
 * nada.
 *
 * Medido de punta a punta sobre la pantalla, mediana de cinco cargas en
 * caliente (2026-07-30):
 *
 *   1 día   1762 ms → **905 ms**
 *   3 días  4908 ms → **1140 ms**
 *
 * Con eso `MAX_DIAS` subió a 31 — el mes que pide la auditoría. Los números de
 * ese alcance viven junto a la constante, en `historial-periodo.ts`.
 */
export async function cargarDiasDeUnidad(entrada: {
  carrierAccountId: string;
  unitId: string;
  periodo: Periodo;
  reglas?: ReglasDeLectura;
}): Promise<DiaDeUnidad[]> {
  const repos = getRepos();
  const puntos = await repos.telemetry.getForUnitWindow(
    entrada.carrierAccountId,
    entrada.unitId,
    entrada.periodo.desde,
    entrada.periodo.hasta,
  );

  return construirDias({
    fechas: entrada.periodo.fechas,
    minutosDesde: entrada.periodo.minutosDesde,
    minutosHasta: entrada.periodo.minutosHasta,
    timeZone: JTTEL_TZ,
    puntos: puntos.map((p) => ({
      recordedAt: p.recordedAt,
      latitude: p.latitude,
      longitude: p.longitude,
      imei: p.imei,
    })),
    reglas: entrada.reglas ?? REGLAS_POR_DEFECTO,
  });
}
