import type { Repositories } from "@jtel/db";
import {
  aunNoDisponible,
  estadoDePapel,
  localDateIso,
  parteDe,
  resumirPapeles,
  type EstadoDeDispositivo,
  type EstadoDePapel,
  type EstadoDeUnidad,
  type GrupoDeUnidad,
  type Parte,
  type ReglaDeTipo,
  type ResumenDePapeles,
} from "@jtel/domain";
import { clasificarFlotaDeCuenta } from "./flota-compas.js";

/**
 * El expediente de una unidad, de un dispositivo y de un chofer: la vista
 * completa de un id (Marco, Pieza 6 §H) con sus familias enteras.
 *
 * Gobierna `docs/Ficha-Expedientes.md` §2 y §3: **la estructura nace entera**, y
 * cada parte dice si está con datos, vacía o aún no disponible. Una parte que no
 * aplica —los servicios de una cuenta sin contrato, la baja de un dispositivo
 * activo, los documentos de un dispositivo— no es ninguno de los tres: el campo
 * no viene.
 *
 * La lógica de vigencia vive en `@jtel/domain` y es pura; esto junta las filas.
 * Existe antes que la pantalla, como la flota del #411.
 *
 * **El muro entre cuentas.** Cada cargador recibe la cuenta y devuelve `null`
 * si el id no es suyo: desde otra cuenta no hay forma de saber que existe.
 */

/** Cuántos servicios recientes trae la actividad de una unidad. */
export const SERVICIOS_DEL_EXPEDIENTE = 8;

type ReposDelExpediente = Pick<
  Repositories,
  "expedientes" | "fleet" | "livePositions" | "telemetry" | "occurrences"
>;

// ── Los documentos, comunes a unidad y chofer ────────────────────────────

export interface VersionDeFojaLeida {
  id: string;
  folio: string | null;
  emitidoEl: string | null;
  venceEl: string | null;
  venceCalculado: boolean;
  actorKind: string;
  actorId: string | null;
  nota: string | null;
  capturadaAt: Date;
}

export interface FojaLeida {
  id: string;
  capturadaAt: Date;
  actorKind: string;
  actorId: string | null;
  /** La vigente primero. Nunca vacía: una foja nace con su primera versión. */
  versiones: VersionDeFojaLeida[];
}

export interface PapelDelExpediente {
  tipo: { id: string; clave: string; nombre: string };
  regla: ReglaDeTipo | null;
  estado: EstadoDePapel;
  /** La foja vigente de este tipo, o `null` si nunca se capturó. */
  vigente: FojaLeida | null;
  /** Las fojas anteriores del mismo tipo: renovaciones. La más reciente primero. */
  anteriores: FojaLeida[];
}

export interface PapelesDelExpediente {
  mercado: { id: string; nombre: string; zonaHoraria: string };
  /** La fecha civil en la zona del mercado con la que se juzgó. */
  hoy: string;
  papeles: PapelDelExpediente[];
  resumen: ResumenDePapeles;
}

async function cargarPapeles(
  repos: Pick<Repositories, "expedientes">,
  carrierAccountId: string,
  sujeto: { unidadId: string } | { choferId: string },
  ahora: Date,
): Promise<Parte<PapelesDelExpediente>> {
  const mercado = await repos.expedientes.mercadoDeCuenta(carrierAccountId);
  if (!mercado) return aunNoDisponible("mercado_de_la_cuenta");

  const subject = "unidadId" in sujeto ? "unidad" : "chofer";
  const [catalogo, fojas] = await Promise.all([
    repos.expedientes.catalogo(mercado.id, subject),
    repos.expedientes.fojasDeSujeto(carrierAccountId, sujeto),
  ]);
  if (catalogo.length === 0) return { estado: "vacia" };

  const hoy = localDateIso(ahora, mercado.timeZone);
  const papeles = catalogo.map(({ tipo, regla }): PapelDelExpediente => {
    const delTipo = fojas.filter((f) => f.foja.documentTypeId === tipo.id).map(leerFoja);
    const [vigente = null, ...anteriores] = delTipo;
    const version = vigente?.versiones[0];
    const estado = estadoDePapel({
      regla,
      foja: version
        ? {
            folio: version.folio,
            emitidoEl: version.emitidoEl,
            venceEl: version.venceEl,
            venceCalculado: version.venceCalculado,
          }
        : null,
      hoy,
    });
    return { tipo: { id: tipo.id, clave: tipo.clave, nombre: tipo.name }, regla, estado, vigente, anteriores };
  });

  return {
    estado: "con_datos",
    valor: {
      mercado: { id: mercado.id, nombre: mercado.name, zonaHoraria: mercado.timeZone },
      hoy,
      papeles,
      resumen: resumirPapeles(papeles.map((p) => p.estado)),
    },
  };
}

function leerFoja(fila: {
  foja: { id: string; createdAt: Date; actorKind: string; actorId: string | null };
  versiones: Array<{
    id: string;
    folio: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    expiryCalculated: boolean;
    actorKind: string;
    actorId: string | null;
    note: string | null;
    createdAt: Date;
  }>;
}): FojaLeida {
  return {
    id: fila.foja.id,
    capturadaAt: fila.foja.createdAt,
    actorKind: fila.foja.actorKind,
    actorId: fila.foja.actorId,
    versiones: fila.versiones.map((v) => ({
      id: v.id,
      folio: v.folio,
      emitidoEl: v.issuedOn,
      venceEl: v.expiresOn,
      venceCalculado: v.expiryCalculated,
      actorKind: v.actorKind,
      actorId: v.actorId,
      nota: v.note,
      capturadaAt: v.createdAt,
    })),
  };
}

// ── Unidad ───────────────────────────────────────────────────────────────

export interface ExpedienteDeUnidad {
  unidad: { id: string; activa: boolean };
  identidad: {
    numeroEconomico: Parte<string>;
    placa: Parte<string>;
  };
  actividad: {
    /** Vacía si la unidad no tiene dispositivo, o si el suyo nunca reportó. */
    ultimaSenal: Parte<{ grupo: GrupoDeUnidad; estado: EstadoDeUnidad; at: Date }>;
    recorridos: Parte<never>;
    /** No viene si la cuenta no tiene contrato encendido: sin Vernier, no aplica. */
    servicios?: Parte<Awaited<ReturnType<Repositories["occurrences"]["ultimosServiciosDeUnidad"]>>>;
  };
  relaciones: {
    dispositivos: Parte<
      Array<{ deviceId: string; imei: string; etiqueta: string | null; desde: Date; hasta: Date | null; vigente: boolean }>
    >;
    choferes: Parte<never>;
  };
  documentos: Parte<PapelesDelExpediente>;
}

export async function cargarExpedienteDeUnidad(
  repos: ReposDelExpediente,
  entrada: { carrierAccountId: string; unitId: string; ahora: Date },
): Promise<ExpedienteDeUnidad | null> {
  const { carrierAccountId, unitId, ahora } = entrada;
  const unidad = await repos.expedientes.unidadDeCuenta(carrierAccountId, unitId);
  if (!unidad) return null;

  const [flota, asignaciones, conContrato, documentos] = await Promise.all([
    clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, { incluirInactivas: true }),
    repos.fleet.asignacionesDeUnidad(unitId),
    repos.expedientes.tieneContratoEncendido(carrierAccountId),
    cargarPapeles(repos, carrierAccountId, { unidadId: unitId }, ahora),
  ]);

  const enFlota = flota.flota.unidades.find((u) => u.unidad.id === unitId);
  const at = enFlota && enFlota.estado.tipo !== "sin_dispositivo" ? enFlota.estado.ultimaSenalAt : null;
  const ultimaSenal: ExpedienteDeUnidad["actividad"]["ultimaSenal"] =
    enFlota && at ? { estado: "con_datos", valor: { grupo: enFlota.grupo, estado: enFlota.estado, at } } : { estado: "vacia" };

  const actividad: ExpedienteDeUnidad["actividad"] = {
    ultimaSenal,
    recorridos: aunNoDisponible("flota_en_vivo"),
  };
  if (conContrato) {
    actividad.servicios = parteDe(await repos.occurrences.ultimosServiciosDeUnidad(unitId, SERVICIOS_DEL_EXPEDIENTE));
  }

  return {
    unidad: { id: unidad.id, activa: unidad.active },
    identidad: {
      numeroEconomico: parteDe(unidad.label),
      placa: parteDe(unidad.plateNumber),
    },
    actividad,
    relaciones: {
      dispositivos: parteDe(
        asignaciones.map((a) => ({
          deviceId: a.deviceId,
          imei: a.imei,
          etiqueta: a.etiqueta,
          desde: a.desde,
          hasta: a.hasta,
          vigente: a.desde <= ahora && (a.hasta === null || a.hasta > ahora),
        })),
      ),
      // `driver_assignments` liga al chofer con ruta × turno, no con la unidad:
      // no hay fuente para esta relación (ficha §3).
      choferes: aunNoDisponible("asignacion_de_choferes"),
    },
    documentos,
  };
}

// ── Dispositivo ──────────────────────────────────────────────────────────

export interface ExpedienteDeDispositivo {
  dispositivo: { id: string };
  identidad: {
    nombre: Parte<string>;
    imei: Parte<string>;
    /** Sólo si está de baja. */
    baja?: Parte<{ at: Date; motivo: string | null }>;
  };
  actividad: {
    ultimaSenal: Parte<{ estado: EstadoDeDispositivo; at: Date }>;
  };
  relaciones: {
    unidades: Parte<Array<{ unitId: string; etiqueta: string; desde: Date; hasta: Date | null; vigente: boolean }>>;
  };
  // Sin `documentos`: un dispositivo no lleva papeles (ficha §3, decidido el 16 sep).
}

export async function cargarExpedienteDeDispositivo(
  repos: ReposDelExpediente,
  entrada: { carrierAccountId: string; deviceId: string; ahora: Date },
): Promise<ExpedienteDeDispositivo | null> {
  const { carrierAccountId, deviceId, ahora } = entrada;
  const dispositivo = await repos.expedientes.dispositivoDeCuenta(carrierAccountId, deviceId);
  if (!dispositivo) return null;

  const [flota, asignaciones] = await Promise.all([
    clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, { incluirInactivas: true }),
    repos.expedientes.asignacionesDeDispositivo(deviceId),
  ]);
  const enFlota = flota.flota.dispositivos.find((d) => d.dispositivo.id === deviceId);
  const at = enFlota?.estado.ultimaSenalAt ?? null;

  const identidad: ExpedienteDeDispositivo["identidad"] = {
    nombre: parteDe(dispositivo.label),
    imei: parteDe(dispositivo.imei),
  };
  if (dispositivo.retiredAt) {
    identidad.baja = { estado: "con_datos", valor: { at: dispositivo.retiredAt, motivo: dispositivo.retiredReason } };
  }

  return {
    dispositivo: { id: dispositivo.id },
    identidad,
    actividad: {
      ultimaSenal: enFlota && at ? { estado: "con_datos", valor: { estado: enFlota.estado, at } } : { estado: "vacia" },
    },
    relaciones: {
      unidades: parteDe(
        asignaciones.map((a) => ({
          unitId: a.unitId,
          etiqueta: a.etiqueta,
          desde: a.desde,
          hasta: a.hasta,
          vigente: a.desde <= ahora && (a.hasta === null || a.hasta > ahora),
        })),
      ),
    },
  };
}

// ── Chofer ───────────────────────────────────────────────────────────────

export interface ExpedienteDeChofer {
  chofer: { id: string; activo: boolean; credencialesPurgadasAt: Date | null };
  identidad: {
    nombre: Parte<string>;
    licencia: Parte<string>;
  };
  actividad: {
    unidadesOperadas: Parte<never>;
  };
  relaciones: {
    rutas: Parte<Array<{ routeShiftId: string; ruta: string; turno: string; desde: string; hasta: string | null }>>;
  };
  documentos: Parte<PapelesDelExpediente>;
}

export async function cargarExpedienteDeChofer(
  repos: ReposDelExpediente,
  entrada: { carrierAccountId: string; driverId: string; ahora: Date },
): Promise<ExpedienteDeChofer | null> {
  const { carrierAccountId, driverId, ahora } = entrada;
  const fila = await repos.expedientes.choferDeCuenta(carrierAccountId, driverId);
  if (!fila) return null;

  const [asignaciones, documentos] = await Promise.all([
    repos.expedientes.asignacionesDeChofer(driverId),
    cargarPapeles(repos, carrierAccountId, { choferId: driverId }, ahora),
  ]);

  return {
    chofer: {
      id: fila.chofer.id,
      activo: fila.chofer.deactivatedAt === null,
      credencialesPurgadasAt: fila.chofer.credentialsPurgedAt,
    },
    identidad: {
      nombre: parteDe(fila.credenciales?.fullName),
      licencia: parteDe(fila.credenciales?.licenseNumber),
    },
    actividad: {
      // `compliance_facts.declaredDriverId` existe, pero nada lo escribe todavía.
      unidadesOperadas: aunNoDisponible("asignacion_de_choferes"),
    },
    relaciones: {
      // Hoy nada escribe `driver_assignments`. Si ya hay filas, se muestran:
      // «aún no disponible» nunca se dice de algo que la base tiene.
      rutas: asignaciones.length > 0 ? { estado: "con_datos", valor: asignaciones } : aunNoDisponible("asignacion_de_choferes"),
    },
    documentos,
  };
}
