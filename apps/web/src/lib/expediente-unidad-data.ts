/**
 * Expediente de la unidad — la tercera identidad con expediente propio.
 *
 * Responde: **¿cómo se ha portado este camión?**
 *
 * ── Las dos leyes de la ficha ───────────────────────────────────────────────
 *
 * 1. **El rastreador no es la identidad de la unidad.** Una unidad puede traer
 *    varios aparatos a lo largo de su vida; su historia es una sola y no se
 *    parte cuando el equipo se cambia.
 * 2. **La unidad no tiene resultado propio.** Los servicios que cubrió sí
 *    tienen el suyo. Aquí se ve cómo se comporta el camión; si cumplió o no
 *    vive en cada servicio.
 *
 * ── Lo que la auditoría dejó fuera, medido el 2026-08-02 ────────────────────
 *
 * - **La barra de la vida de la unidad** (§2.3). Hay **1 registro de taller en
 *   82 unidades**: la barra saldría plana, y una barra plana no dice "esta
 *   unidad no ha ido al taller" — dice "aquí no hay nada que ver", que es
 *   distinto y desalienta mirar. Se construye cuando haya registros suficientes
 *   para que la barra tenga forma.
 * - **Modelo, año, asientos, verificación vehicular**: no existen en `units`.
 *   No se muestran ni se inventan.
 * - **Rendimiento de diésel**: necesita dos cargas de la misma unidad para
 *   restar odómetros. Hay 1 captura en toda la flota.
 * - **Próximo servicio en N km**: `maintenance_records` no guarda intervalo.
 * - **Choferes**: 0 en la base. Bloque reservado y declarado.
 *
 * ── Y la distinción que gobierna las dos pestañas ───────────────────────────
 *
 * Con una fila de taller y una de diésel en toda la flota, las pestañas no
 * pueden leerse como *"este transportista no da mantenimiento ni carga
 * combustible"*. **No es que no lo haga: es que no lo está capturando aquí.**
 * En la cara del auditado esa diferencia es la que separa un dato faltante de
 * una acusación, y por eso va escrita en cada pestaña vacía.
 */

import { getRepos } from "@/lib/db";
import { JTTEL_TZ, SIN_SENAL_MINUTOS, localDateIso } from "@jtel/domain";
import {
  construirSaludSenal,
  type PeriodoDeRastreador,
  type SaludDeSenal,
} from "@/lib/salud-senal";

/** Cuántos meses hacia atrás mira el expediente. */
export const MESES_DEL_EXPEDIENTE = 12;

/** Cuántos servicios recientes se listan. */
const ULTIMOS_SERVICIOS = 8;

export type RastreadorDeUnidad = {
  imei: string;
  etiqueta: string | null;
  desde: string;
  hasta: string | null;
  vigente: boolean;
};

export type ServicioCubierto = {
  ocurrenciaId: string;
  fecha: string;
  ruta: string;
  turno: string;
  resultado: "cumplido" | "no_cumplido" | "pendiente";
  timing: string | null;
};

export type PestanaVacia = {
  /** Qué se buscó, en el idioma de quien opera. */
  titulo: string;
  /**
   * La distinción que evita la acusación: no capturado ≠ no hecho.
   *
   * Va escrita en la pantalla, no en un comentario. Con una fila en toda la
   * flota, una pestaña vacía sin esta frase le dice al transportista que el
   * sistema cree que no da mantenimiento.
   */
  nota: string;
};

export type ExpedienteUnidad = {
  unidad: {
    id: string;
    label: string;
    plateNumber: string | null;
    activa: boolean;
    alta: string;
  };
  /** Navegación entre hermanas, con el conteo de flota (§2.1). */
  hermanas: { anterior: { id: string; label: string } | null; siguiente: { id: string; label: string } | null; indice: number; total: number };
  /** Lo que se sabe de identidad. Solo lo que existe (§5). */
  identidad: { etiqueta: string; valor: string; lectura: string | null }[];
  /** Lo que la ficha pedía y el modelo no tiene. Se declara, no se calla. */
  identidadAusente: string[];
  salud: SaludDeSenal;
  /**
   * El periodo que las barras CUBREN de verdad.
   *
   * No es lo mismo que la ventana que se pidió. Decir "6 huecos en 12 meses"
   * cuando el archivo tiene cinco semanas afirma once meses limpios que nadie
   * midió — el eje del ALCANCE de §D, con el número correcto.
   */
  periodoCubierto: string;
  /** Hasta dónde llega el archivo. Sin esto, "sin huecos antes" miente. */
  alcanceArchivo: string;
  rastreadores: RastreadorDeUnidad[];
  serviciosCubiertos: { cumplidos: number; pendientes: number; total: number };
  ultimosServicios: ServicioCubierto[];
  taller: { descripcion: string; estado: string; programado: string | null; completado: string | null }[];
  tallerVacio: PestanaVacia | null;
  diesel: { fecha: string; litros: number; costo: number | null; odometro: number | null }[];
  dieselVacio: PestanaVacia | null;
  /** Kilometraje, si alguna carga trae odómetro. Siempre con su fecha. */
  kilometraje: { valor: number; lectura: string } | null;
  /** Bloques reservados con su razón. Ninguno omitido en silencio. */
  reservados: { titulo: string; razon: string }[];
};

export const RESERVADOS: { titulo: string; razon: string }[] = [
  {
    titulo: "Quiénes la manejaron",
    razon:
      "El chofer se declara; el GPS identifica unidades, no personas. El modelo de choferes existe desde la migración 0016 y todavía nadie ha declarado uno, así que la tabla saldría vacía. Vuelve cuando haya declaraciones que mostrar.",
  },
  {
    titulo: "La vida de la unidad",
    razon:
      "La barra de meses en servicio, taller y fuera. Hay 1 registro de taller en toda la flota: la barra saldría plana, y una barra plana no dice «esta unidad no ha ido al taller», dice «aquí no hay nada que ver». Se construye cuando haya registros suficientes para que tenga forma.",
  },
  {
    titulo: "Cumplimiento agregado de la unidad",
    razon:
      "Un porcentaje de cumplimiento por camión. La unidad no tiene resultado propio: lo tienen los servicios que cubrió. Si se decide mostrarlo, se decide con la compuerta de Ola 2.",
  },
  {
    titulo: "Rendimiento de diésel y próximo servicio",
    razon:
      "El rendimiento necesita dos cargas de la misma unidad para restar odómetros, y hay 1 captura en toda la flota. El «próximo servicio en N km» necesita un intervalo que las órdenes de taller no guardan.",
  },
];

function fecha(d: Date): string {
  return localDateIso(d, JTTEL_TZ);
}

export async function loadExpedienteUnidad(
  carrier: { id: string; name: string },
  unitId: string,
): Promise<ExpedienteUnidad | null> {
  const repos = getRepos();
  const ahora = new Date();

  const flota = await repos.fleet.getUnitsForCarrier(carrier.id);
  const unidad = flota.find((u) => u.id === unitId);
  // La pertenencia se resuelve contra la flota del carrier: un identificador de
  // otra cuenta simplemente no aparece, y la pantalla no se entera de que
  // existe.
  if (!unidad) return null;

  const desde = new Date(ahora);
  desde.setMonth(desde.getMonth() - MESES_DEL_EXPEDIENTE);
  const desdeFecha = fecha(desde);

  const [meses, asignaciones, primerPunto, porResultado, ultimos, taller, diesel] =
    await Promise.all([
      repos.telemetry.huecosPorMesDeUnidad(carrier.id, unitId, desde, {
        timeZone: JTTEL_TZ,
        umbralMinutos: SIN_SENAL_MINUTOS,
      }),
      repos.fleet.asignacionesDeUnidad(unitId),
      repos.telemetry.primerPuntoDeCarrier(carrier.id),
      repos.occurrences.serviciosCubiertosPorUnidad(unitId, desdeFecha),
      repos.occurrences.ultimosServiciosDeUnidad(unitId, ULTIMOS_SERVICIOS),
      repos.fleet.getMaintenanceForCarrier(carrier.id),
      repos.fleet.getFuelForCarrier(carrier.id, desde),
    ]);

  const periodos: PeriodoDeRastreador[] = asignaciones.map((a) => ({
    imei: a.imei,
    etiqueta: a.etiqueta,
    desde: a.desde,
    hasta: a.hasta,
  }));

  const salud = construirSaludSenal({ meses, rastreadores: periodos, timeZone: JTTEL_TZ });

  const ordenadas = [...flota].sort((a, b) => a.label.localeCompare(b.label, "es"));
  const i = ordenadas.findIndex((u) => u.id === unitId);
  const hermana = (x: (typeof ordenadas)[number] | undefined) =>
    x ? { id: x.id, label: x.label } : null;

  const tallerDeUnidad = taller.filter((m) => m.unitId === unitId);
  const dieselDeUnidad = diesel.filter((f) => f.unitId === unitId);

  const conOdometro = dieselDeUnidad
    .filter((f) => f.odometerKm != null)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];

  const vigente = periodos.find((r) => r.hasta === null) ?? periodos.at(-1) ?? null;

  const identidad: ExpedienteUnidad["identidad"] = [
    { etiqueta: "Estado", valor: unidad.active ? "Activa" : "Inactiva", lectura: null },
    {
      etiqueta: "Placa",
      valor: unidad.plateNumber ?? "sin capturar",
      lectura: null,
    },
    { etiqueta: "En el sistema desde", valor: fecha(unidad.createdAt), lectura: null },
    {
      etiqueta: "Rastreador",
      valor: vigente ? (vigente.etiqueta ?? vigente.imei) : "sin asignar",
      // Todo número con su lectura: un IMEI sin fecha de instalación no dice
      // desde cuándo se está midiendo con ese aparato.
      lectura: vigente ? `instalado ${fecha(vigente.desde)}` : null,
    },
  ];

  const kilometraje = conOdometro?.odometerKm != null
    ? {
        valor: conOdometro.odometerKm,
        // NUNCA como kilometraje de hoy: es el de la última carga capturada, y
        // entre esa carga y ahora el camión siguió rodando.
        lectura: `al ${fecha(conOdometro.recordedAt)}, de la última carga capturada`,
      }
    : null;

  const cumplidos = Number(porResultado.find((r) => r.status === "cumplido")?.total ?? 0);
  const pendientes = Number(
    porResultado.find((r) => r.status === "pendiente_evidencia")?.total ?? 0,
  );

  const notaNoCapturado =
    "No es que no ocurra: es que no se está capturando aquí. En toda la flota hay una sola captura, así que esta pestaña mide qué tanto se usa el módulo, no qué tanto se atiende el camión.";

  return {
    unidad: {
      id: unidad.id,
      label: unidad.label,
      plateNumber: unidad.plateNumber,
      activa: unidad.active,
      alta: fecha(unidad.createdAt),
    },
    hermanas: {
      anterior: hermana(ordenadas[i - 1]),
      siguiente: hermana(ordenadas[i + 1]),
      indice: i + 1,
      total: ordenadas.length,
    },
    identidad,
    identidadAusente: [
      "Modelo y año",
      "Número de asientos",
      "Verificación vehicular",
    ],
    salud,
    periodoCubierto:
      salud.barras.length === 0
        ? "sin meses con archivo"
        : salud.barras.length === 1
          ? `en ${salud.barras[0]!.etiqueta}`
          : `entre ${salud.barras[0]!.etiqueta} y ${salud.barras.at(-1)!.etiqueta}`,
    alcanceArchivo: primerPunto
      ? `El archivo de telemetría empieza el ${fecha(primerPunto)}. Antes de esa fecha no hay huecos porque no hay archivo, que no es lo mismo que no haberlos tenido.`
      : "No hay telemetría archivada para este transportista.",
    rastreadores: periodos.map((r) => ({
      imei: r.imei,
      etiqueta: r.etiqueta,
      desde: fecha(r.desde),
      hasta: r.hasta ? fecha(r.hasta) : null,
      vigente: r.hasta === null,
    })),
    serviciosCubiertos: { cumplidos, pendientes, total: cumplidos + pendientes },
    ultimosServicios: ultimos.map((s) => ({
      ocurrenciaId: s.ocurrenciaId,
      fecha: s.fecha,
      ruta: s.ruta,
      turno: s.turno,
      resultado:
        s.status === "cumplido"
          ? ("cumplido" as const)
          : s.status === "no_cumplido"
            ? ("no_cumplido" as const)
            : ("pendiente" as const),
      timing: s.timing ?? null,
    })),
    taller: tallerDeUnidad.map((m) => ({
      descripcion: m.description,
      estado: m.status,
      programado: m.scheduledAt ? fecha(m.scheduledAt) : null,
      completado: m.completedAt ? fecha(m.completedAt) : null,
    })),
    tallerVacio:
      tallerDeUnidad.length === 0
        ? { titulo: "Sin órdenes de taller capturadas para esta unidad.", nota: notaNoCapturado }
        : null,
    diesel: dieselDeUnidad.map((f) => ({
      fecha: fecha(f.recordedAt),
      litros: f.liters,
      costo: f.cost ?? null,
      odometro: f.odometerKm ?? null,
    })),
    dieselVacio:
      dieselDeUnidad.length === 0
        ? { titulo: "Sin cargas de diésel capturadas para esta unidad.", nota: notaNoCapturado }
        : null,
    kilometraje,
    reservados: RESERVADOS,
  };
}
