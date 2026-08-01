import { getRepos } from "@/lib/db";
import { isOperationalHours } from "@jtel/services";
import { JTTEL_TZ, type OperationalScope } from "@jtel/domain";
import { SIN_SENAL_MINUTOS } from "@/lib/monitoreo-umbrales";

/**
 * Cuál de los cuatro estados de la torre toca mostrar (Ficha-Monitoreo §5).
 *
 * Es **una sola pantalla**: lo que cambia es qué ocupa el lugar del mapa. El
 * orden de precedencia no es arbitrario —
 *
 *  1. **Cuenta nueva** manda sobre todo: si no hay telemetría configurada,
 *     decir "no estamos recibiendo señal" sería mentir. Nunca hubo señal que
 *     recibir.
 *  2. **Sistema sin señal** manda sobre el turno: si el archivador se cayó, lo
 *     que la torre sabe del turno no vale, y afirmarlo sería peor que callar.
 *  3. **Sin turno activo** cuando no hay ventana de evidencia abierta.
 *  4. **En vuelo** es lo que queda.
 */

export type PasoAlta = {
  titulo: string;
  listo: boolean;
  detalle: string;
};

export type EstadoTorre =
  | { tipo: "vuelo" }
  | { tipo: "cuenta_nueva"; pasos: PasoAlta[] }
  | {
      tipo: "sin_senal";
      /** Hace cuánto entró el último punto. Null: nunca ha entrado ninguno. */
      edadMinutos: number | null;
      /** Fecha y hora locales completas de esa última lectura. */
      ultimaLectura: string | null;
      /** Servicios de este turno que quedan sin poder observarse. */
      serviciosEnRiesgo: number;
    }
  | {
      tipo: "sin_turno";
      /** La ingesta sigue viva: el silencio es porque no toca, no porque falló. */
      telemetriaViva: boolean;
      edadMinutos: number | null;
    };

/** "2026-08-01 04:12" — instante con su fecha, como pide toda evidencia. */
export function fechaHoraLocal(at: Date, timeZone = JTTEL_TZ): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}`;
}

export async function diagnosticarTorre(opts: {
  scope: OperationalScope;
  clientAccountId: string;
  /** Hay turnos configurados en este alcance. */
  hayTurnos: boolean;
  /** El turno seleccionado tiene ventana de evidencia abierta ahora mismo. */
  enVuelo: boolean;
  /** Servicios abiertos del turno seleccionado — el alcance de una caída. */
  serviciosAbiertos: number;
  now?: Date;
}): Promise<EstadoTorre> {
  const repos = getRepos();
  const now = opts.now ?? new Date();

  const [contratos, geocercas] = await Promise.all([
    repos.contracts.findForClient(opts.clientAccountId),
    repos.geofences.findForScope(opts.scope, opts.clientAccountId),
  ]);

  const delAlcance = contratos.filter((c) =>
    opts.scope.kind === "plant"
      ? c.plantId === opts.scope.plantId
      : c.plantGroupId === opts.scope.plantGroupId,
  );

  // La telemetría se pregunta por carrier contratado. El conteo de su flota no
  // sale de aquí: la planta no ve el inventario de su carrier (Marco, ley 3).
  const carrierIds = [...new Set(delAlcance.map((c) => c.carrierAccountId))];
  let dispositivos = 0;
  let edadMinutos: number | null = null;
  for (const carrierId of carrierIds) {
    const devices = await repos.fleet.getDevicesForCarrier(carrierId);
    dispositivos += devices.length;
    const edad = await repos.telemetry.latestPointAgeMinutes(carrierId);
    if (edad !== null) {
      edadMinutos = edadMinutos === null ? edad : Math.min(edadMinutos, edad);
    }
  }

  const pasos: PasoAlta[] = [
    {
      titulo: "Contrato de alta",
      listo: delAlcance.length > 0,
      detalle: "define umbrales, tolerancias y con qué transportista se opera",
    },
    {
      titulo: "Geocerca de destino",
      listo: geocercas.length > 0,
      detalle: "es la frontera que decide cuándo una unidad llegó",
    },
    {
      titulo: "Rutas y turnos",
      listo: opts.hayTurnos,
      detalle: "el trazado contratado y las horas de entrada del personal",
    },
    {
      titulo: "Conexión de telemetría",
      listo: dispositivos > 0,
      detalle: "los equipos GPS que reportan la posición de las unidades",
    },
  ];

  if (pasos.some((p) => !p.listo)) return { tipo: "cuenta_nueva", pasos };

  // Mismo umbral y misma ventana horaria que el dead-man switch de ingesta:
  // dos criterios distintos para "el sistema dejó de ver" harían que la torre
  // y las alertas se contradijeran.
  const operativo = isOperationalHours(now);
  if (operativo && (edadMinutos === null || edadMinutos > SIN_SENAL_MINUTOS)) {
    return {
      tipo: "sin_senal",
      edadMinutos,
      // Fecha completa, no solo la hora: un turno nocturno cruza la medianoche
      // y "04:12" a secas no dice de qué día se dejó de ver.
      ultimaLectura:
        edadMinutos === null
          ? null
          : fechaHoraLocal(new Date(now.getTime() - edadMinutos * 60_000)),
      serviciosEnRiesgo: opts.serviciosAbiertos,
    };
  }

  if (!opts.enVuelo) {
    return {
      tipo: "sin_turno",
      telemetriaViva: edadMinutos !== null && edadMinutos <= SIN_SENAL_MINUTOS,
      edadMinutos,
    };
  }

  return { tipo: "vuelo" };
}
