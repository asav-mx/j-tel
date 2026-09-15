/**
 * La flota de Compás: en qué estado está cada unidad y cada dispositivo.
 *
 * Todo aquí es **puro**: recibe filas y un instante, devuelve estados. No lee la
 * base ni sabe de pantallas. Existe antes que la pantalla a propósito: la
 * pantalla sale del rediseño, y lo que afirma sobre cada unidad no debe
 * depender de cómo se dibuje.
 *
 * Vocabulario: **dispositivo**, como lo define la Pieza 1 del Marco, y
 * **unidad**, el camión. Un dispositivo que no está en una unidad no tiene
 * unidad y no se le inventa una (Marco 6.16): para eso existe el inventario
 * (Marco 6.6).
 *
 * Los grupos, decididos el 15 de septiembre de 2026:
 *
 *   Unidades       EN LÍNEA · EN DESTINO · DESCONECTADO · SIN DISPOSITIVO
 *   Dispositivos   EN UNIDAD · EN BODEGA · DESCONECTADO · DE BAJA
 */

import { SIN_SENAL_MINUTOS } from "./senal.js";

// ── Los números ──────────────────────────────────────────────────────────

/**
 * Por debajo de esta velocidad, una unidad en línea se dibuja **detenida**
 * (círculo) y no **en movimiento** (flecha rotada al rumbo).
 *
 * **Por qué no cero.** Un GPS parado no reporta cero: la posición tiembla unos
 * metros entre fixes y eso sale como velocidad de un dígito. Con el corte en
 * cero, un camión estacionado en el patio aparecería «en movimiento» con la
 * flecha girando al azar, que es afirmar un rumbo que nadie recorrió.
 *
 * **Por qué 5.** Es la cifra que se propuso el 15 de septiembre de 2026 y se
 * aceptó: un camión que de verdad avanza, aun en fila o maniobrando, pasa de
 * ahí. **No está medida contra los FTC927 en la calle.** Si la medición dice
 * otra cosa, este es el único lugar que cambia.
 */
export const VELOCIDAD_DETENIDA_KMH = 5;

/**
 * Horas sin señal a partir de las cuales un dispositivo **montado** está
 * DESCONECTADO.
 *
 * **Por qué 24 y no los 15 min de señal vieja.** Un camión apagado de noche deja
 * de reportar sin que nada esté mal. Con 15 min, cada madrugada la flota entera
 * saldría desconectada, y un aviso que no llega nunca a cero entrena a
 * ignorarlo (Marco 6.17). Veinticuatro horas es un día de operación completo
 * sin una sola señal: eso ya no es un camión dormido.
 *
 * **Sólo los montados.** Un dispositivo en bodega apagado en su caja es lo
 * normal y no se acusa: se muestra su última señal y ya.
 */
export const DESCONECTADO_HORAS = 24;

const MS_MIN = 60_000;
const MS_HORA = 60 * MS_MIN;

// ── Las filas que entran ─────────────────────────────────────────────────

export interface UnidadDeFlota {
  id: string;
  label: string;
}

export interface DispositivoDeFlota {
  id: string;
  imei: string;
  label: string | null;
  retiredAt: Date | null;
  retiredReason: string | null;
}

export interface AsignacionDeFlota {
  unitId: string;
  deviceId: string;
  validFrom: Date;
  validTo: Date | null;
}

/** La posición viva de un dispositivo (`live_positions`). */
export interface PosicionViva {
  imei: string;
  recordedAt: Date;
  /** En km/h. El puente de Traccar ya convirtió los nudos. */
  speed: number | null;
  /** Grados, 0 = norte. */
  heading: number | null;
}

/**
 * La última señal de un dispositivo: lo más reciente entre su posición viva y
 * su último punto archivado.
 *
 * **Por qué las dos.** `live_positions` sólo existe desde el recolector; un
 * dispositivo con historia archivada y sin fila viva saldría «nunca reportó»,
 * que es falso. Y al revés, si el archivo llegó más lejos que la posición viva,
 * lo más reciente es el archivo. Sólo la posición viva trae velocidad y rumbo:
 * cuando gana el archivo, no se sabe si iba en movimiento, y no se inventa.
 */
export interface UltimaSenal {
  at: Date;
  speed: number | null;
  heading: number | null;
}

export function ultimaSenalDe(
  viva: PosicionViva | undefined,
  ultimoArchivadoAt: Date | undefined,
): UltimaSenal | null {
  if (viva && (!ultimoArchivadoAt || viva.recordedAt >= ultimoArchivadoAt)) {
    return { at: viva.recordedAt, speed: viva.speed, heading: viva.heading };
  }
  if (ultimoArchivadoAt) return { at: ultimoArchivadoAt, speed: null, heading: null };
  return null;
}

// ── La unión dispositivo ↔ unidad ────────────────────────────────────────

/** Una asignación está vigente en `ahora` si ya empezó y no ha terminado. */
export function asignacionVigente(a: AsignacionDeFlota, ahora: Date): boolean {
  return a.validFrom <= ahora && (a.validTo === null || a.validTo > ahora);
}

export interface UnionDeFlota {
  /** Los dispositivos vigentes de cada unidad, SIN los de baja. */
  dispositivosPorUnidad: Map<string, Array<{ dispositivo: DispositivoDeFlota; desde: Date }>>;
  /** La unidad vigente de cada dispositivo que no está de baja. */
  unidadPorDispositivo: Map<string, { unidadId: string; desde: Date }>;
  /**
   * Lo que la base permite y el Marco no: se dice, no se esconde ni se
   * resuelve en silencio.
   */
  anomalias: {
    /** Una unidad con más de un dispositivo vigente. */
    unidadesConVariosDispositivos: Array<{ unidadId: string; dispositivoIds: string[] }>;
    /** Un dispositivo vigente en más de una unidad a la vez. */
    dispositivosEnVariasUnidades: Array<{ dispositivoId: string; unidadIds: string[] }>;
    /**
     * Un dispositivo de baja con asignación abierta. De baja no cuenta (Marco
     * 6.5), así que no le da estado a su unidad; pero la asignación abierta es
     * un error de captura que hay que ver.
     */
    dispositivosDeBajaMontados: Array<{ dispositivoId: string; unidadId: string }>;
  };
}

export function unirDispositivosConUnidades(
  dispositivos: DispositivoDeFlota[],
  asignaciones: AsignacionDeFlota[],
  ahora: Date,
): UnionDeFlota {
  const porId = new Map(dispositivos.map((d) => [d.id, d]));
  const dispositivosPorUnidad: UnionDeFlota["dispositivosPorUnidad"] = new Map();
  const unidadesDeCadaDispositivo = new Map<string, Array<{ unidadId: string; desde: Date }>>();
  const anomalias: UnionDeFlota["anomalias"] = {
    unidadesConVariosDispositivos: [],
    dispositivosEnVariasUnidades: [],
    dispositivosDeBajaMontados: [],
  };

  for (const a of asignaciones) {
    if (!asignacionVigente(a, ahora)) continue;
    const d = porId.get(a.deviceId);
    // Una asignación a un dispositivo que no es de esta cuenta no es de esta flota.
    if (!d) continue;
    if (d.retiredAt) {
      anomalias.dispositivosDeBajaMontados.push({ dispositivoId: d.id, unidadId: a.unitId });
      continue;
    }
    const enUnidad = dispositivosPorUnidad.get(a.unitId) ?? [];
    enUnidad.push({ dispositivo: d, desde: a.validFrom });
    dispositivosPorUnidad.set(a.unitId, enUnidad);

    const deDispositivo = unidadesDeCadaDispositivo.get(d.id) ?? [];
    deDispositivo.push({ unidadId: a.unitId, desde: a.validFrom });
    unidadesDeCadaDispositivo.set(d.id, deDispositivo);
  }

  for (const [unidadId, lista] of dispositivosPorUnidad) {
    if (lista.length > 1) {
      anomalias.unidadesConVariosDispositivos.push({
        unidadId,
        dispositivoIds: lista.map((x) => x.dispositivo.id),
      });
    }
  }

  const unidadPorDispositivo: UnionDeFlota["unidadPorDispositivo"] = new Map();
  for (const [dispositivoId, lista] of unidadesDeCadaDispositivo) {
    if (lista.length > 1) {
      anomalias.dispositivosEnVariasUnidades.push({
        dispositivoId,
        unidadIds: lista.map((x) => x.unidadId),
      });
    }
    // Con varias, la más reciente: es la última que alguien declaró.
    const masReciente = [...lista].sort((x, y) => y.desde.getTime() - x.desde.getTime())[0]!;
    unidadPorDispositivo.set(dispositivoId, masReciente);
  }

  return { dispositivosPorUnidad, unidadPorDispositivo, anomalias };
}

// ── El estado de una unidad ──────────────────────────────────────────────

export type PosturaEnLinea =
  /** Flecha llena rotada al rumbo. */
  | "en_movimiento"
  /** Círculo lleno. */
  | "detenida"
  /**
   * La señal es fresca pero no trae velocidad (vino del archivo, no de la
   * posición viva). No se afirma ni movimiento ni reposo.
   */
  | "sin_velocidad";

export type EstadoDeUnidad =
  | {
      tipo: "en_linea";
      dispositivoId: string;
      postura: PosturaEnLinea;
      ultimaSenalAt: Date;
      velocidadKmh: number | null;
      /** Sólo con postura `en_movimiento`: sin movimiento no hay rumbo que afirmar. */
      rumbo: number | null;
    }
  | {
      /**
       * Sólo servicio especial, el único donde el árbitro sella una llegada. Se
       * muestra la hora de llegada, nunca la edad ni la posición posterior: la
       * traza se corta al llegar (Pieza 5 §E).
       */
      tipo: "en_destino";
      dispositivoId: string | null;
      llegadaAt: Date;
    }
  | {
      /**
       * Montada, con señal de más de 15 min y menos de 24 h, o recién montada
       * sin señal todavía. **Su grupo está por decidir**: no es EN LÍNEA (no
       * está transmitiendo) ni DESCONECTADO (no lleva 24 h). Ver
       * `grupoDeUnidad`.
       */
      tipo: "callada";
      dispositivoId: string;
      ultimaSenalAt: Date | null;
    }
  | {
      tipo: "desconectado";
      dispositivoId: string;
      /** `null` si nunca reportó. */
      ultimaSenalAt: Date | null;
    }
  | { tipo: "sin_dispositivo" };

export interface EntradaDeUnidad {
  /** Los dispositivos vigentes de la unidad, sin los de baja. */
  dispositivos: Array<{ dispositivo: DispositivoDeFlota; desde: Date }>;
  /** La última señal de cada dispositivo, por IMEI. */
  senalPorImei: Map<string, UltimaSenal>;
  /**
   * La llegada vigente de la unidad a su destino, si la hay.
   *
   * **De dónde sale:** de la llegada que ya selló el árbitro
   * (`compliance_facts.observed_arrival_at`, con la unidad acreditada). El
   * árbitro sólo sella llegada en servicio especial —el único con una llegada
   * final—, así que esto no necesita saber la modalidad del servicio, que es
   * material del Marco pendiente y no se improvisa aquí. Una unidad en circuito
   * no llega a destino: sirve su circuito.
   *
   * **Lo que falta decidir:** hasta cuándo sigue vigente una llegada sellada.
   * Por eso esta función la recibe ya resuelta, y hoy nadie la pasa: ninguna
   * unidad sale «en destino» hasta que eso se decida.
   */
  llegadaVigenteAt?: Date | null;
}

/**
 * En qué estado está una unidad en `ahora`.
 *
 * Con varios dispositivos vigentes (una anomalía, ver `unirDispositivosConUnidades`)
 * manda el de señal más reciente: si alguno transmite, la unidad transmite.
 */
export function estadoDeUnidad(entrada: EntradaDeUnidad, ahora: Date): EstadoDeUnidad {
  if (entrada.dispositivos.length === 0) return { tipo: "sin_dispositivo" };

  // El dispositivo que manda: el de señal más reciente; sin señales, el montado
  // más recientemente.
  const candidatos = entrada.dispositivos.map((x) => ({
    ...x,
    senal: entrada.senalPorImei.get(x.dispositivo.imei) ?? null,
  }));
  candidatos.sort((a, b) => {
    const ta = a.senal?.at.getTime() ?? -Infinity;
    const tb = b.senal?.at.getTime() ?? -Infinity;
    if (ta !== tb) return tb - ta;
    return b.desde.getTime() - a.desde.getTime();
  });
  const manda = candidatos[0]!;

  if (entrada.llegadaVigenteAt) {
    return { tipo: "en_destino", dispositivoId: manda.dispositivo.id, llegadaAt: entrada.llegadaVigenteAt };
  }

  const senal = manda.senal;
  if (senal && ahora.getTime() - senal.at.getTime() <= SIN_SENAL_MINUTOS * MS_MIN) {
    const postura: PosturaEnLinea =
      senal.speed === null
        ? "sin_velocidad"
        : senal.speed >= VELOCIDAD_DETENIDA_KMH
          ? "en_movimiento"
          : "detenida";
    return {
      tipo: "en_linea",
      dispositivoId: manda.dispositivo.id,
      postura,
      ultimaSenalAt: senal.at,
      velocidadKmh: senal.speed,
      rumbo: postura === "en_movimiento" ? senal.heading : null,
    };
  }

  if (estaDesconectado(senal?.at ?? null, manda.desde, ahora)) {
    return { tipo: "desconectado", dispositivoId: manda.dispositivo.id, ultimaSenalAt: senal?.at ?? null };
  }
  return { tipo: "callada", dispositivoId: manda.dispositivo.id, ultimaSenalAt: senal?.at ?? null };
}

/**
 * Un dispositivo montado está desconectado si pasaron más de 24 h desde lo
 * último que se sabe de él: su última señal, **o el momento en que se montó**.
 *
 * Se cuenta desde el montaje porque un dispositivo que salió de bodega hace dos
 * horas —con su última señal de hace una semana, cuando estaba en caja— no está
 * desconectado: todavía no tuvo un día para reportar desde el camión.
 */
export function estaDesconectado(ultimaSenalAt: Date | null, montadoDesde: Date, ahora: Date): boolean {
  const referencia = ultimaSenalAt && ultimaSenalAt > montadoDesde ? ultimaSenalAt : montadoDesde;
  return ahora.getTime() - referencia.getTime() > DESCONECTADO_HORAS * MS_HORA;
}

export type GrupoDeUnidad = "en_linea" | "en_destino" | "desconectado" | "sin_dispositivo";

/**
 * Los grupos de unidades que existen para una cuenta, en su orden.
 *
 * **Sin contrato, EN DESTINO no aparece.** No es un grupo vacío: es un grupo que
 * no existe, porque sin contrato no hay servicio especial ni llegada que sellar.
 * Mostrarlo en cero afirmaría que se buscó y no hubo.
 */
export function gruposDeUnidad(cuenta: { tieneContrato: boolean }): GrupoDeUnidad[] {
  return cuenta.tieneContrato
    ? ["en_linea", "en_destino", "desconectado", "sin_dispositivo"]
    : ["en_linea", "desconectado", "sin_dispositivo"];
}

/** Los grupos del inventario de dispositivos (Marco 6.6), en su orden. */
export const GRUPOS_DE_DISPOSITIVO = ["en_unidad", "en_bodega", "desconectado", "de_baja"] as const;

/**
 * El grupo en que se lista una unidad.
 *
 * Devuelve `null` para `callada` porque **ese grupo no está decidido**: los
 * cuatro grupos acordados no la cubren, y ponerla en EN LÍNEA afirmaría que
 * transmite, y en DESCONECTADO, que lleva un día sin hacerlo. Se decide antes de
 * construir una pantalla que la liste.
 */
export function grupoDeUnidad(estado: EstadoDeUnidad): GrupoDeUnidad | null {
  switch (estado.tipo) {
    case "en_linea":
      return "en_linea";
    case "en_destino":
      return "en_destino";
    case "desconectado":
      return "desconectado";
    case "sin_dispositivo":
      return "sin_dispositivo";
    case "callada":
      return null;
  }
}

// ── El estado de un dispositivo (el inventario, Marco 6.6) ───────────────

export type EstadoDeDispositivo =
  | { grupo: "en_unidad"; unidadId: string; montadoDesde: Date; ultimaSenalAt: Date | null }
  | { grupo: "en_bodega"; ultimaSenalAt: Date | null }
  | { grupo: "desconectado"; unidadId: string; montadoDesde: Date; ultimaSenalAt: Date | null }
  | { grupo: "de_baja"; retiredAt: Date; retiredReason: string | null; ultimaSenalAt: Date | null };

export function estadoDeDispositivo(
  dispositivo: DispositivoDeFlota,
  union: UnionDeFlota,
  senal: UltimaSenal | null,
  ahora: Date,
): EstadoDeDispositivo {
  const ultimaSenalAt = senal?.at ?? null;
  if (dispositivo.retiredAt) {
    return {
      grupo: "de_baja",
      retiredAt: dispositivo.retiredAt,
      retiredReason: dispositivo.retiredReason,
      ultimaSenalAt,
    };
  }
  const montado = union.unidadPorDispositivo.get(dispositivo.id);
  if (!montado) return { grupo: "en_bodega", ultimaSenalAt };
  if (estaDesconectado(ultimaSenalAt, montado.desde, ahora)) {
    return { grupo: "desconectado", unidadId: montado.unidadId, montadoDesde: montado.desde, ultimaSenalAt };
  }
  return { grupo: "en_unidad", unidadId: montado.unidadId, montadoDesde: montado.desde, ultimaSenalAt };
}

// ── La flota completa ────────────────────────────────────────────────────

export interface FlotaClasificada {
  unidades: Array<{ unidad: UnidadDeFlota; estado: EstadoDeUnidad; grupo: GrupoDeUnidad | null }>;
  dispositivos: Array<{ dispositivo: DispositivoDeFlota; estado: EstadoDeDispositivo }>;
  anomalias: UnionDeFlota["anomalias"];
}

export function clasificarFlota(entrada: {
  unidades: UnidadDeFlota[];
  dispositivos: DispositivoDeFlota[];
  asignaciones: AsignacionDeFlota[];
  posicionesVivas: PosicionViva[];
  /** El último punto archivado de cada IMEI. */
  ultimoArchivadoPorImei: Map<string, Date>;
  /** Ver `EntradaDeUnidad.llegadaVigenteAt`: hoy no hay fuente. */
  llegadaVigentePorUnidad?: Map<string, Date>;
  ahora: Date;
}): FlotaClasificada {
  const { ahora } = entrada;
  const union = unirDispositivosConUnidades(entrada.dispositivos, entrada.asignaciones, ahora);

  const vivaPorImei = new Map(entrada.posicionesVivas.map((p) => [p.imei, p]));
  const senalPorImei = new Map<string, UltimaSenal>();
  for (const d of entrada.dispositivos) {
    const s = ultimaSenalDe(vivaPorImei.get(d.imei), entrada.ultimoArchivadoPorImei.get(d.imei));
    if (s) senalPorImei.set(d.imei, s);
  }

  const unidades = entrada.unidades.map((unidad) => {
    const estado = estadoDeUnidad(
      {
        dispositivos: union.dispositivosPorUnidad.get(unidad.id) ?? [],
        senalPorImei,
        llegadaVigenteAt: entrada.llegadaVigentePorUnidad?.get(unidad.id) ?? null,
      },
      ahora,
    );
    return { unidad, estado, grupo: grupoDeUnidad(estado) };
  });

  const dispositivos = entrada.dispositivos.map((dispositivo) => ({
    dispositivo,
    estado: estadoDeDispositivo(dispositivo, union, senalPorImei.get(dispositivo.imei) ?? null, ahora),
  }));

  return { unidades, dispositivos, anomalias: union.anomalias };
}
