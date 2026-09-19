import type { Repositories } from "@jtel/db";
import {
  PAPELES_QUE_ESPERAN_AL_ABOGADO,
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
  "expedientes" | "fleet" | "livePositions" | "telemetry" | "occurrences" | "geofences"
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
  /**
   * Los tipos del catálogo que esperan la palabra del abogado (examen médico y
   * antidoping, sólo de chofer). **No están en `papeles` ni cuentan en el
   * resumen**: se dicen «aún no disponible», sin captura (Choferes V1,
   * enmienda 4). Vacío en una unidad.
   */
  enEspera: Array<{ id: string; clave: string; nombre: string }>;
}

/** ¿Este tipo de papel espera al abogado? Sólo los de chofer. */
function esperaAlAbogado(subject: "unidad" | "chofer", clave: string): boolean {
  return subject === "chofer" && PAPELES_QUE_ESPERAN_AL_ABOGADO.includes(clave);
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
  const enEspera = catalogo
    .filter(({ tipo }) => esperaAlAbogado(subject, tipo.clave))
    .map(({ tipo }) => ({ id: tipo.id, clave: tipo.clave, nombre: tipo.name }));
  const juzgables = catalogo.filter(({ tipo }) => !esperaAlAbogado(subject, tipo.clave));
  if (juzgables.length === 0 && enEspera.length === 0) return { estado: "vacia" };

  const hoy = localDateIso(ahora, mercado.timeZone);
  const papeles = juzgables.map(({ tipo, regla }): PapelDelExpediente => {
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
      enEspera,
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
    /** Desde C4-e (0040). Vacío si nadie lo ha capturado: ninguna unidad de antes lo tiene. */
    vin: Parte<string>;
  };
  actividad: {
    /** Vacía si la unidad no tiene dispositivo, o si el suyo nunca reportó. */
    ultimaSenal: Parte<{ grupo: GrupoDeUnidad; estado: EstadoDeUnidad; at: Date }>;
    /**
     * La puerta a Recorridos y playback (C3). Con datos si la unidad ha traído
     * dispositivo alguna vez; vacía si nunca: no habría nada medido que ver.
     */
    recorridos: Parte<{ primerDispositivoDesde: Date }>;
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
    recorridos:
      asignaciones.length > 0
        ? { estado: "con_datos", valor: { primerDispositivoDesde: asignaciones[0]!.desde } }
        : { estado: "vacia" },
  };
  if (conContrato) {
    actividad.servicios = parteDe(await repos.occurrences.ultimosServiciosDeUnidad(unitId, SERVICIOS_DEL_EXPEDIENTE));
  }

  return {
    unidad: { id: unidad.id, activa: unidad.active },
    identidad: {
      numeroEconomico: parteDe(unidad.label),
      placa: parteDe(unidad.plateNumber),
      vin: parteDe(unidad.vin),
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
  dispositivo: {
    id: string;
    /**
     * Su estado del inventario aunque nunca haya reportado: las acciones de
     * Ver ‹dispositivo› (C4-c) dependen de si está montado o de baja, no de
     * si tiene señal. `null` sólo si la clasificación no lo encontró.
     */
    estado: EstadoDeDispositivo | null;
  };
  identidad: {
    nombre: Parte<string>;
    imei: Parte<string>;
    /** Sólo si está de baja. `por` es null en las bajas anteriores a la 0039. */
    baja?: Parte<{ at: Date; motivo: string | null; por: string | null }>;
  };
  actividad: {
    ultimaSenal: Parte<{ estado: EstadoDeDispositivo; at: Date }>;
  };
  relaciones: {
    /**
     * Quién abrió y cerró cada asignación, y por qué se cerró (0039). Null en
     * lo anterior a la 0039: no quedó registrado.
     */
    unidades: Parte<
      Array<{
        unitId: string;
        etiqueta: string;
        desde: Date;
        hasta: Date | null;
        vigente: boolean;
        asignadaPor: string | null;
        cerradaPor: string | null;
        motivoCierre: string | null;
      }>
    >;
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
    repos.expedientes.asignacionesDeDispositivo(carrierAccountId, deviceId),
  ]);
  const enFlota = flota.flota.dispositivos.find((d) => d.dispositivo.id === deviceId);
  const at = enFlota?.estado.ultimaSenalAt ?? null;

  const identidad: ExpedienteDeDispositivo["identidad"] = {
    nombre: parteDe(dispositivo.label),
    imei: parteDe(dispositivo.imei),
  };
  if (dispositivo.retiredAt) {
    identidad.baja = {
      estado: "con_datos",
      valor: { at: dispositivo.retiredAt, motivo: dispositivo.retiredReason, por: dispositivo.retiredBy ?? null },
    };
  }

  return {
    dispositivo: { id: dispositivo.id, estado: enFlota?.estado ?? null },
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
          asignadaPor: a.asignadaPor ?? null,
          cerradaPor: a.cerradaPor ?? null,
          motivoCierre: a.motivoCierre ?? null,
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
    /** Declarado, no medido (Plan-Choferes §1): el chofer que el transportista dijo en cada servicio. */
    unidadesOperadas: Parte<Array<{ unitId: string; etiqueta: string; servicios: number; ultimo: Date }>>;
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

  const [asignaciones, documentos, operadas] = await Promise.all([
    repos.expedientes.asignacionesDeChofer(driverId),
    cargarPapeles(repos, carrierAccountId, { choferId: driverId }, ahora),
    repos.expedientes.unidadesDeChoferDeclarado(carrierAccountId, driverId),
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
      // La fuente es el chofer declarado en cada servicio (enmienda 5), no la
      // asignación. Hoy nada lo escribe; si la base ya tiene alguno, se
      // muestra: «aún no disponible» nunca se dice de algo que la base tiene.
      unidadesOperadas:
        operadas.length > 0
          ? {
              estado: "con_datos",
              valor: operadas.map((o) => ({
                unitId: o.unitId,
                etiqueta: o.etiqueta,
                servicios: Number(o.servicios),
                ultimo: o.ultimo instanceof Date ? o.ultimo : new Date(o.ultimo),
              })),
            }
          : aunNoDisponible("chofer_declarado"),
    },
    relaciones: {
      // Hoy nada escribe `driver_assignments`. Si ya hay filas, se muestran:
      // «aún no disponible» nunca se dice de algo que la base tiene.
      rutas: asignaciones.length > 0 ? { estado: "con_datos", valor: asignaciones } : aunNoDisponible("asignacion_de_choferes"),
    },
    documentos,
  };
}

// ── El cuarto: la puerta a los expedientes de la cuenta ──────────────────

export interface UnidadDelCuarto {
  id: string;
  numeroEconomico: string;
  placa: string | null;
  /** El VIN (0040): el buscador del archivero lo encuentra por aquí. */
  vin: string | null;
  activa: boolean;
  /**
   * El resumen de sus papeles. Aún no disponible si la cuenta no tiene
   * mercado; vacío si el catálogo de su mercado no tiene papeles de unidad.
   */
  papeles: Parte<ResumenDePapeles>;
}

export interface DispositivoDelCuarto {
  id: string;
  nombre: string | null;
  imei: string;
  estado: EstadoDeDispositivo;
  /** El número económico de la unidad donde está montado, si lo está. */
  unidad: string | null;
}

export interface ChoferDelCuarto {
  id: string;
  nombre: string | null;
  licencia: string | null;
  activo: boolean;
  /**
   * El resumen de sus papeles, como el de una unidad: aún no disponible sin
   * mercado, vacío si su catálogo no tiene papeles de chofer que se puedan
   * juzgar. Los que esperan al abogado no cuentan (enmienda 4).
   */
  papeles: Parte<ResumenDePapeles>;
}

export interface CuartoDeExpedientes {
  mercado: { nombre: string; hoy: string } | null;
  unidades: UnidadDelCuarto[];
  /** En servicio primero; los de baja al final, sin esconderse. */
  dispositivos: { enServicio: DispositivoDelCuarto[]; deBaja: DispositivoDelCuarto[] };
  choferes: Parte<ChoferDelCuarto[]>;
  /**
   * Cuántos papeles de la flota **activa** le piden algo al transportista.
   * `null` sin mercado. Una unidad inactiva no opera: sus papeles faltantes se
   * ven en su pieza, pero no inflan una alarma que tiene que poder llegar a
   * cero (6.17).
   */
  papelesQuePidenAlgo: number | null;
}

/** Primero lo que pide algo, como las unidades; los de baja al final; luego por nombre. */
function ordenarChoferes(choferes: ChoferDelCuarto[]): ChoferDelCuarto[] {
  const piden = (c: ChoferDelCuarto) => (c.papeles.estado === "con_datos" ? c.papeles.valor.pidenAlgo : 0);
  return [...choferes].sort(
    (a, b) =>
      Number(b.activo) - Number(a.activo) ||
      piden(b) - piden(a) ||
      (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
  );
}

const ORDEN_DEL_PEOR = [
  "vencido",
  "falta",
  "falta_la_fecha",
  "por_vencer",
  "falta_la_regla",
  "vigente",
  "sin_vencimiento",
  "no_capturado",
];

/**
 * El cuarto de Expedientes de una cuenta, leído de una pasada.
 *
 * No arma un expediente por unidad: con 80 unidades serían cientos de consultas.
 * Lee el catálogo una vez, las fojas vigentes de toda la cuenta una vez, y
 * juzga cada unidad con la misma `estadoDePapel` que usa su expediente — así el
 * cuarto y la ficha no pueden decir cosas distintas del mismo papel.
 *
 * El orden es el de la ficha §1: primero lo que pide hacer algo.
 */
export async function cargarCuartoDeExpedientes(
  repos: ReposDelExpediente,
  entrada: { carrierAccountId: string; ahora: Date },
): Promise<CuartoDeExpedientes> {
  const { carrierAccountId, ahora } = entrada;
  const [mercado, flota, unidadesRaw, fojas, choferes] = await Promise.all([
    repos.expedientes.mercadoDeCuenta(carrierAccountId),
    clasificarFlotaDeCuenta(repos, carrierAccountId, ahora, { incluirInactivas: true }),
    repos.fleet.getUnitsForCarrier(carrierAccountId),
    repos.expedientes.fojasVigentesDeUnidadesDeCuenta(carrierAccountId),
    repos.expedientes.choferesDeCuenta(carrierAccountId),
  ]);

  const hoy = mercado ? localDateIso(ahora, mercado.timeZone) : null;
  const [catalogo, catalogoDeChofer, fojasDeChoferes] = mercado
    ? await Promise.all([
        repos.expedientes.catalogo(mercado.id, "unidad"),
        repos.expedientes.catalogo(mercado.id, "chofer"),
        repos.expedientes.fojasVigentesDeChoferesDeCuenta(carrierAccountId),
      ])
    : [[], [], []];
  // Examen médico y antidoping esperan al abogado: no se juzgan (enmienda 4).
  const juzgablesDeChofer = catalogoDeChofer.filter(({ tipo }) => !esperaAlAbogado("chofer", tipo.clave));

  // La foja vigente de cada (unidad, tipo): la capturada más recientemente.
  // Las fojas llegan de la más reciente a la más vieja, así que gana la primera.
  const vigente = new Map<string, (typeof fojas)[number]>();
  for (const f of fojas) {
    const llave = `${f.foja.unitId}|${f.foja.documentTypeId}`;
    if (!vigente.has(llave)) vigente.set(llave, f);
  }

  const unidades: UnidadDelCuarto[] = unidadesRaw.map((u) => {
    let papeles: Parte<ResumenDePapeles>;
    if (!mercado || !hoy) papeles = aunNoDisponible("mercado_de_la_cuenta");
    else if (catalogo.length === 0) papeles = { estado: "vacia" };
    else {
      const estados = catalogo.map(({ tipo, regla }) => {
        const f = vigente.get(`${u.id}|${tipo.id}`);
        return estadoDePapel({
          regla,
          foja: f
            ? {
                folio: f.version.folio,
                emitidoEl: f.version.issuedOn,
                venceEl: f.version.expiresOn,
                venceCalculado: f.version.expiryCalculated,
              }
            : null,
          hoy,
        });
      });
      papeles = { estado: "con_datos", valor: resumirPapeles(estados) };
    }
    return { id: u.id, numeroEconomico: u.label, placa: u.plateNumber, vin: u.vin ?? null, activa: u.active, papeles };
  });

  const peso = (u: UnidadDelCuarto) => {
    if (u.papeles.estado !== "con_datos") return { piden: 0, peor: ORDEN_DEL_PEOR.length };
    const r = u.papeles.valor;
    return { piden: r.pidenAlgo, peor: r.peor ? ORDEN_DEL_PEOR.indexOf(r.peor) : ORDEN_DEL_PEOR.length };
  };
  unidades.sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1;
    const pa = peso(a);
    const pb = peso(b);
    return pb.piden - pa.piden || pa.peor - pb.peor || a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true });
  });

  // Los papeles de cada chofer, con la misma regla que la unidad y su ficha.
  const vigenteDeChofer = new Map<string, (typeof fojasDeChoferes)[number]>();
  for (const f of fojasDeChoferes) {
    const llave = `${f.foja.driverId}|${f.foja.documentTypeId}`;
    if (!vigenteDeChofer.has(llave)) vigenteDeChofer.set(llave, f);
  }
  const papelesDeChofer = (driverId: string): Parte<ResumenDePapeles> => {
    if (!mercado || !hoy) return aunNoDisponible("mercado_de_la_cuenta");
    if (juzgablesDeChofer.length === 0) return { estado: "vacia" };
    const estados = juzgablesDeChofer.map(({ tipo, regla }) => {
      const f = vigenteDeChofer.get(`${driverId}|${tipo.id}`);
      return estadoDePapel({
        regla,
        foja: f
          ? { folio: f.version.folio, emitidoEl: f.version.issuedOn, venceEl: f.version.expiresOn, venceCalculado: f.version.expiryCalculated }
          : null,
        hoy,
      });
    });
    return { estado: "con_datos", valor: resumirPapeles(estados) };
  };

  const etiquetaDeUnidad = new Map(unidadesRaw.map((u) => [u.id, u.label]));
  const dispositivos = flota.flota.dispositivos.map(({ dispositivo, estado }): DispositivoDelCuarto => ({
    id: dispositivo.id,
    nombre: dispositivo.label,
    imei: dispositivo.imei,
    estado,
    unidad: "unidadId" in estado ? (etiquetaDeUnidad.get(estado.unidadId) ?? null) : null,
  }));
  const porNombre = (a: DispositivoDelCuarto, b: DispositivoDelCuarto) =>
    (a.nombre ?? a.imei).localeCompare(b.nombre ?? b.imei, "es", { numeric: true });

  const papelesQuePidenAlgo = mercado
    ? unidades.reduce((s, u) => s + (u.activa && u.papeles.estado === "con_datos" ? u.papeles.valor.pidenAlgo : 0), 0)
    : null;

  return {
    mercado: mercado && hoy ? { nombre: mercado.name, hoy } : null,
    unidades,
    dispositivos: {
      enServicio: dispositivos.filter((d) => d.estado.grupo !== "de_baja").sort(porNombre),
      deBaja: dispositivos.filter((d) => d.estado.grupo === "de_baja").sort(porNombre),
    },
    choferes: parteDe(ordenarChoferes(choferes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      licencia: c.licencia,
      activo: c.deactivatedAt === null,
      papeles: papelesDeChofer(c.id),
    })))),
    papelesQuePidenAlgo,
  };
}
