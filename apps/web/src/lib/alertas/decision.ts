/**
 * Qué se avisa y qué no — las decisiones de la plomería de alertas, sin base
 * de datos y sin correo, para que se puedan probar solas.
 *
 * El sistema ya DETECTA problemas (`ingest_alerts`, `/api/salud`). Lo que no
 * existía es la entrega: hasta hoy, el único aviso que salía del sistema era
 * un issue de GitHub que el vigilante abre cada 15 min, y un issue no suena en
 * el teléfono de nadie.
 *
 * La regla que gobierna este archivo es la contraria a la que uno esperaría de
 * un sistema de alertas: **casi nada avisa**. Una alerta que grita seguido
 * enseña a ignorarla, y el día que grite por lo que importa ya nadie la lee.
 * Por eso los tipos que avisan son una lista blanca corta y explícita
 * (`CLASES_QUE_AVISAN`), y todo lo demás —rate limits, errores sueltos de
 * archivo, un servicio no cumplido— viaja en el resumen diario.
 *
 * Un servicio `no_cumplido` NO avisa, y es deliberado: eso es un veredicto
 * normal del árbitro funcionando bien, no una falla de plataforma. El día que
 * lo tarde grite, el canal se vuelve ruido.
 *
 * ## Cómo se evita avisar dos veces de lo mismo, sin tabla nueva
 *
 * Cada corrida atiende una CUBETA de tiempo: el intervalo completo anterior,
 * alineado al reloj (`(piso − intervalo, piso]`). Las cubetas embonan sin
 * traslape y sin hueco, así que un hecho instantáneo —una alerta que se abrió,
 * una que se resolvió, un servicio que cruzó su momento de juicio— cae en
 * exactamente UNA cubeta y se avisa exactamente UNA vez. Sin estado guardado y
 * sin migración.
 *
 * El precio, dicho de frente: si una corrida del cron se salta, los avisos de
 * esa cubeta se pierden. No se pierde el problema —el incidente sigue abierto,
 * `/api/salud` sigue en 503, el vigilante externo sigue abriendo su issue y el
 * resumen diario lo vuelve a contar—, pero ese correo concreto no sale. Se
 * eligió así a sabiendas: la alternativa era una tabla nueva de entregas, y
 * una migración no cabe en este carril.
 *
 * Quién anuncia qué, para que nadie anuncie dos veces:
 *  - `heartbeat_stale` lo abre y lo cierra el cron de heartbeat → aquí se
 *    recoge por cubeta.
 *  - `watermark_lag` (archivador callado) lo abre y lo cierra ESTE cron → lo
 *    anuncia la misma corrida que lo detecta, y por eso queda fuera del barrido
 *    por cubeta.
 */

import type { CausaDeDiferencia, HoraLimiteDesalineada } from "@jtel/db";
import { duracion, instanteSellado } from "@/lib/formato-tiempo";

/** Cada cuánto corre `/api/cron/alertas`. Es también el ancho de la cubeta. */
export const INTERVALO_ALERTAS_MINUTOS = 5;

/**
 * Cuánto se espera después del momento en que un servicio YA se podía juzgar
 * (deadline + gracia del contrato) antes de considerarlo un faltante.
 *
 * El cron de verificación corre cada minuto, así que media hora es un margen
 * enorme a propósito: lo que se busca no es un retraso de la cola, es un
 * servicio que se quedó fuera de ella.
 */
export const MARGEN_SIN_VEREDICTO_MINUTOS = 30;

/**
 * Cuántos días hacia atrás se miran los servicios sin veredicto.
 *
 * Acota dos cosas: el tamaño de la consulta, y el ruido de un rezago histórico
 * que nadie va a atender hoy. El resumen diario declara el corte para que la
 * ventana no se lea como "no hay nada más".
 */
export const DIAS_SIN_VEREDICTO = 3;

/**
 * Los únicos tipos de `ingest_alerts` que producen un correo inmediato.
 *
 * `rate_limit` y `archive_error` quedan fuera a propósito: son transitorios y
 * el archivador reintenta. Se cuentan en el resumen diario, que es donde un
 * repunte de transitorios sí se ve como patrón.
 */
export const CLASES_QUE_AVISAN = ["heartbeat_stale", "watermark_lag"] as const;

/**
 * De las anteriores, las que se recogen por cubeta de tiempo.
 *
 * `watermark_lag` no está aquí y no es un olvido: lo abre y lo cierra esta
 * misma plomería, así que lo anuncia la corrida que lo detecta. Si además se
 * barriera por cubeta, cada caída del archivador mandaría dos correos.
 */
export const CLASES_POR_CUBETA = ["heartbeat_stale"] as const;

export type Ventana = { desde: Date; hasta: Date };

/**
 * La cubeta que le toca a esta corrida: el intervalo completo anterior,
 * alineado al reloj.
 *
 * Se alinea al reloj y no a "ahora − intervalo" justamente porque el cron
 * llega con retraso variable. Alineada, la cubeta de las 10:05 es siempre
 * (10:00, 10:05], corra el cron a las 10:05:02 o a las 10:05:47, y las cubetas
 * de dos corridas seguidas nunca se traslapan.
 */
export function cubetaDeCorrida(
  ahora: Date,
  intervaloMinutos: number = INTERVALO_ALERTAS_MINUTOS,
): Ventana {
  const ms = intervaloMinutos * 60_000;
  const piso = Math.floor(ahora.getTime() / ms) * ms;
  return { desde: new Date(piso - ms), hasta: new Date(piso) };
}

/** Medio abierta: `(desde, hasta]`. Así las cubetas embonan sin traslape. */
export function dentroDe(v: Ventana, instante: Date | null | undefined): boolean {
  if (!instante) return false;
  const t = instante.getTime();
  return t > v.desde.getTime() && t <= v.hasta.getTime();
}

export const minutosEntre = (ahora: Date, antes: Date) =>
  (ahora.getTime() - antes.getTime()) / 60_000;

/**
 * El instante en que un servicio deja de estar "en cola" y pasa a ser un
 * faltante: deadline + gracia del contrato + el margen de arriba.
 *
 * La suma de los dos primeros es la misma que usa `findPendingVerification`
 * para decidir a quién le toca turno. Aquí solo se le agrega la espera.
 */
export function instanteSinVeredicto(
  deadline: Date,
  graciaMinutos: number,
  margenMinutos: number = MARGEN_SIN_VEREDICTO_MINUTOS,
): Date {
  return new Date(deadline.getTime() + (graciaMinutos + margenMinutos) * 60_000);
}

/**
 * Una medición y su lectura, siempre juntas.
 *
 * Regla del skill de UI: ningún número viaja solo. `47.3 min` no dice nada;
 * `47.3 min · umbral 30 min` ya trae la conclusión puesta y no obliga a quien
 * lo lee a calcular a las 3 de la mañana.
 */
export type Medicion = { etiqueta: string; valor: string; lectura: string };

/**
 * Un aviso, con las cuatro partes que el skill exige de un hallazgo. Si le
 * falta una, vuelve a ser dato crudo: una alerta sin consecuencia es ruido, y
 * una sin acción deja al que la lee preguntándose qué se supone que haga.
 */
export type Aviso = {
  clase:
    | "ingesta-detenida"
    | "ingesta-restablecida"
    | "archivador-callado"
    | "archivador-restablecido"
    | "sin-veredicto"
    | "hora-limite-vieja"
    /**
     * La ventana de evidencia congelada que ya no es la que se derivaría.
     * Clase propia y no la de la hora límite: son dos campos con dos causas y
     * dos arreglos, y compartir clase haría que el asunto del correo nombrara
     * el campo equivocado.
     */
    | "ventana-desalineada"
    /**
     * Un correo provocado a mano para comprobar que el canal llega. Tiene clase
     * propia y no reusa la de un hallazgo: si compartiera clase, el asunto
     * diría «Hora límite desalineada» y la notificación del teléfono se leería
     * como un hallazgo real antes de que nadie abriera el correo.
     */
    | "simulacro";
  /** La afirmación: qué pasa, en una frase, como hecho. */
  titulo: string;
  /** La evidencia: cada número con su umbral al lado. */
  mediciones: Medicion[];
  /** Qué cuesta. Sin esto es una alerta, no un hallazgo. */
  consecuencia: string;
  /** Una sola, con el rol que la ejecuta. */
  accion: string;
  /** Lista larga opcional (los servicios de un grupo, p. ej.). */
  detalle?: string[];
  /**
   * Un desglose largo, cuando el hallazgo es uno y sus filas son muchas.
   *
   * Existe por las 47 ventanas: el correo llevaba 47 avisos, uno por ruta×turno,
   * y **47 correos-hallazgo entrenan a ignorar el remitente** igual que 47
   * correos sueltos. Es un solo hallazgo —la ventana congelada envejeció— con
   * 47 renglones de evidencia, y así se escribe.
   */
  tabla?: { titulo: string; columnas: string[]; filas: string[][] };
  /** El instante del hecho que se anuncia, no el de la corrida. */
  instante: Date;
};

/** Lo mínimo que este módulo necesita saber de una fila de `ingest_alerts`. */
export type AlertaLeida = {
  id: string;
  kind: string;
  severity: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
  metadata: Record<string, unknown> | null;
};

const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Un decimal. Exactitud, no "~". */
const un = (n: number) => Number(n.toFixed(1)).toString();

export function avisoIngestaDetenida(alerta: AlertaLeida, ahora: Date): Aviso {
  const umbral = numero(alerta.metadata?.staleMinutesThreshold);
  const edadPunto = numero(alerta.metadata?.latestPointAgeMinutes);
  const puntosUltimaHora = numero(alerta.metadata?.pointsLastHour);

  const mediciones: Medicion[] = [
    {
      etiqueta: "Abierta",
      valor: instanteSellado(alerta.createdAt),
      lectura: `hace ${duracion(minutosEntre(ahora, alerta.createdAt))}`,
    },
  ];
  if (edadPunto !== null) {
    mediciones.push({
      etiqueta: "Último punto de GPS",
      valor: duracion(edadPunto),
      lectura: umbral !== null ? `umbral ${umbral} min` : "sin umbral declarado",
    });
  }
  if (puntosUltimaHora !== null) {
    mediciones.push({
      etiqueta: "Puntos en la última hora",
      valor: String(puntosUltimaHora),
      lectura: "en operación normal no baja de cero",
    });
  }

  return {
    clase: "ingesta-detenida",
    titulo: alerta.message,
    mediciones,
    consecuencia:
      "Los servicios cuyo deadline caiga dentro de este silencio se van a sellar como pendiente por evidencia. Sin puntos no hay con qué juzgar, y sin evidencia nunca es incumplimiento — así que no se pierde la verdad, pero el cliente se queda sin resultado.",
    accion: "Revisar credenciales y respuesta de Umbrella · J-Staff",
    instante: alerta.createdAt,
  };
}

export function avisoIngestaRestablecida(alerta: AlertaLeida, ahora: Date): Aviso {
  const abierta = minutosEntre(alerta.resolvedAt ?? ahora, alerta.createdAt);
  return {
    clase: "ingesta-restablecida",
    titulo: `Volvió la ingesta que se había detenido: ${alerta.message}`,
    mediciones: [
      {
        etiqueta: "Estuvo detenida",
        valor: duracion(abierta),
        lectura: `de ${instanteSellado(alerta.createdAt)} a ${instanteSellado(alerta.resolvedAt ?? ahora)}`,
      },
    ],
    consecuencia:
      "Los servicios que se sellaron como pendiente por evidencia durante ese silencio no se re-juzgan solos si su ventana ya cerró.",
    accion: `Revisar qué servicios quedaron pendientes en esa ventana y decidir si se re-verifican · J-Staff`,
    instante: alerta.resolvedAt ?? ahora,
  };
}

export function avisoArchivadorCallado(
  lectura: { edadMinutos: number; umbralMinutos: number; carriersConMarca: number },
  ahora: Date,
): Aviso {
  return {
    clase: "archivador-callado",
    titulo: `El archivador lleva ${duracion(lectura.edadMinutos)} sin escribir.`,
    mediciones: [
      {
        etiqueta: "Silencio del archivador",
        valor: duracion(lectura.edadMinutos),
        lectura: `umbral ${lectura.umbralMinutos} min · el cron corre cada 10 min, así que el umbral ya tolera dos corridas perdidas`,
      },
      {
        etiqueta: "Corridas de archivo perdidas",
        valor: un(lectura.edadMinutos / 10),
        lectura: "una corrida cada 10 min",
      },
      {
        etiqueta: "Carriers con marca de agua",
        valor: String(lectura.carriersConMarca),
        lectura: "se reporta el peor de todos, no el promedio",
      },
    ],
    consecuencia:
      "La memoria propia deja de crecer. Aunque Umbrella tenga los puntos, el árbitro no los ve, y todo servicio que se juzgue mientras dure el silencio se juzga con evidencia incompleta.",
    accion: "Revisar la corrida de /api/cron/archive en Vercel · J-Staff",
    instante: ahora,
  };
}

export function avisoArchivadorRestablecido(
  alerta: AlertaLeida,
  ahora: Date,
): Aviso {
  const callado = minutosEntre(ahora, alerta.createdAt);
  return {
    clase: "archivador-restablecido",
    titulo: "El archivador volvió a escribir.",
    mediciones: [
      {
        etiqueta: "Estuvo callado",
        valor: duracion(callado),
        lectura: `de ${instanteSellado(alerta.createdAt)} a ${instanteSellado(ahora)}`,
      },
    ],
    consecuencia:
      "Si el dato de GPS sigue atrasado, el archivador está poniéndose al día y todavía no alcanza el presente.",
    accion: "Confirmar en /api/salud que el dato de GPS ya volvió a su umbral · J-Staff",
    instante: ahora,
  };
}

/** Un servicio que ya pasó su momento de juicio y no tiene hecho sellado. */
export type ServicioSinVeredicto = {
  ocurrenciaId: string;
  contratoId: string;
  contratoNombre: string;
  clienteNombre: string;
  carrierNombre: string;
  /** Cómo se identifica el servicio: ruta × turno. */
  rutaTurno: string;
  serviceDate: string;
  deadline: Date;
  graciaMinutos: number;
  /** Si además no tiene fila de viaje: nunca entró siquiera a la cola. */
  sinViaje: boolean;
};

export type GrupoSinVeredicto = {
  clave: string;
  contratoNombre: string;
  clienteNombre: string;
  carrierNombre: string;
  serviceDate: string;
  servicios: ServicioSinVeredicto[];
  /** El primero del grupo en cruzar su momento de juicio. */
  primerCruce: Date;
};

/**
 * Agrupa por contrato y día de servicio, que es la unidad en la que se avisa.
 *
 * Un correo por servicio sería justo la alerta que grita seguido: un turno con
 * 18 servicios mandaría 18 correos por la misma causa.
 */
export function agruparSinVeredicto(
  servicios: ServicioSinVeredicto[],
  margenMinutos: number = MARGEN_SIN_VEREDICTO_MINUTOS,
): GrupoSinVeredicto[] {
  const grupos = new Map<string, GrupoSinVeredicto>();

  for (const s of servicios) {
    const clave = `${s.contratoId}|${s.serviceDate}`;
    const cruce = instanteSinVeredicto(s.deadline, s.graciaMinutos, margenMinutos);
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        clave,
        contratoNombre: s.contratoNombre,
        clienteNombre: s.clienteNombre,
        carrierNombre: s.carrierNombre,
        serviceDate: s.serviceDate,
        servicios: [s],
        primerCruce: cruce,
      });
      continue;
    }
    grupo.servicios.push(s);
    if (cruce < grupo.primerCruce) grupo.primerCruce = cruce;
  }

  return [...grupos.values()].sort(
    (a, b) => a.primerCruce.getTime() - b.primerCruce.getTime(),
  );
}

/**
 * De todos los grupos con faltantes, solo avisan los que CRUZARON en esta
 * cubeta — es decir, aquellos cuyo primer faltante se volvió faltante ahorita.
 *
 * Un grupo que ya avisó no vuelve a avisar aunque durante el día se le sumen
 * más servicios: el correo dice el conteo del momento y el resumen diario da
 * el número final. Sin esto, un contrato con un turno entero atorado mandaría
 * un correo cada cinco minutos toda la mañana.
 */
export function gruposQueAvisan(
  grupos: GrupoSinVeredicto[],
  cubeta: Ventana,
): GrupoSinVeredicto[] {
  return grupos.filter((g) => dentroDe(cubeta, g.primerCruce));
}

export function avisoSinVeredicto(grupo: GrupoSinVeredicto, ahora: Date): Aviso {
  const sinViaje = grupo.servicios.filter((s) => s.sinViaje).length;
  const mediciones: Medicion[] = [
    {
      etiqueta: "Servicios sin veredicto",
      valor: String(grupo.servicios.length),
      lectura: `contrato ${grupo.contratoNombre} · servicio del ${grupo.serviceDate}`,
    },
    {
      etiqueta: "El primero cruzó",
      valor: instanteSellado(grupo.primerCruce),
      lectura: `deadline + gracia del contrato + ${MARGEN_SIN_VEREDICTO_MINUTOS} min de espera`,
    },
  ];
  if (sinViaje > 0) {
    mediciones.push({
      etiqueta: "Sin fila de viaje",
      valor: `${sinViaje} de ${grupo.servicios.length}`,
      lectura:
        "la cola de verificación solo toma ocurrencias con viaje, así que estos nunca entraron a ella",
    });
  }

  return {
    clase: "sin-veredicto",
    titulo: `${grupo.servicios.length} servicio${grupo.servicios.length === 1 ? "" : "s"} de ${grupo.clienteNombre} pasaron su momento de juicio sin hecho sellado.`,
    mediciones,
    consecuencia:
      "El cliente no va a recibir resultado de estos servicios, y el faltante no se ve en ninguna pantalla: no salen como pendiente por evidencia ni como no cumplido — no salen. Es el silencio más caro del sistema, porque se parece a que todo está bien.",
    accion: "Re-verificar el día del contrato desde J-Staff y revisar por qué quedaron fuera de la cola · J-Staff",
    detalle: grupo.servicios.map(
      (s) =>
        `${s.rutaTurno} · deadline ${instanteSellado(s.deadline)} · gracia ${s.graciaMinutos} min${s.sinViaje ? " · sin fila de viaje" : ""}`,
    ),
    instante: grupo.primerCruce,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * C21 · La hora límite que su turno ya no produce
 *
 * `renewRollingWindow` calcula la hora límite al crear la ocurrencia y la
 * congela en la fila. Nunca vuelve a tocarla, y nada la revisa cuando el turno
 * o la política cambian. El 7 de agosto de 2026 eso ya había costado doce
 * ocurrencias selladas contra una ventana vieja entre que se descubrió el
 * defecto y se corrigió — el precio de C21 no es el defecto, es su latencia.
 *
 * Esto no corrige: avisa. Corregir la ventana con la que se va a juzgar es
 * decisión de Asav, y un cron que corrige en silencio no se distingue de uno
 * que no corre.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Cuántos servicios se enumeran en el correo antes de resumir el resto.
 *
 * Un turno movido puede arrastrar cientos de ocurrencias, y un correo con
 * trescientas líneas no se lee. El recorte se DICE en el cuerpo: una lista
 * truncada en silencio se lee como la lista completa.
 */
export const TOPE_DETALLE_DESALINEADAS = 15;

/**
 * La lectura viene de `@jtel/db`, donde vive junto a la consulta que la
 * produce y a `clasificarDiferencia`. Aquí solo se le da forma de aviso: este
 * archivo decide QUÉ se dice, no cómo se mide.
 */
export type OcurrenciaDesalineada = HoraLimiteDesalineada;

export type GrupoDesalineado = {
  clave: string;
  contratoNombre: string;
  clienteNombre: string;
  turnoNombre: string;
  turnoInicio: string;
  anticipacionMinutos: number;
  causa: Exclude<CausaDeDiferencia, "ninguna">;
  difMinutos: number;
  ocurrencias: OcurrenciaDesalineada[];
  /** La primera del grupo en cruzar su hora límite: el reloj de la decisión. */
  primeraEnSellarse: Date;
  ultimaEnSellarse: Date;
};

/**
 * Agrupa por contrato × turno × corrimiento, que es la unidad en la que se
 * avisa porque es la unidad en la que se causa: alguien movió UN turno, y
 * todas sus ocurrencias se corrieron LO MISMO.
 *
 * El corrimiento entra en la clave y no es un detalle. Dos corrimientos
 * distintos dentro del mismo turno no son un cambio con dos caras: son dos
 * historias, y sumarlas en un solo aviso es la causa C20 —la etiqueta que
 * junta dos cosas distintas— cometida en el correo que avisa de otra.
 */
export function agruparDesalineadas(
  ocurrencias: OcurrenciaDesalineada[],
): GrupoDesalineado[] {
  const grupos = new Map<string, GrupoDesalineado>();

  for (const o of ocurrencias) {
    const clave = `${o.contratoId}|${o.turnoId}|${o.difMinutos}`;
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, {
        clave,
        contratoNombre: o.contratoNombre,
        clienteNombre: o.clienteNombre,
        turnoNombre: o.turnoNombre,
        turnoInicio: o.turnoInicio,
        anticipacionMinutos: o.anticipacionMinutos,
        causa: o.causa,
        difMinutos: o.difMinutos,
        ocurrencias: [o],
        primeraEnSellarse: o.guardada,
        ultimaEnSellarse: o.guardada,
      });
      continue;
    }
    grupo.ocurrencias.push(o);
    if (o.guardada < grupo.primeraEnSellarse) grupo.primeraEnSellarse = o.guardada;
    if (o.guardada > grupo.ultimaEnSellarse) grupo.ultimaEnSellarse = o.guardada;
  }

  // Por el reloj, no por tamaño: lo que primero se vuelve irreversible va
  // arriba. Es la regla del horizonte del skill — ordena por cuándo revienta.
  return [...grupos.values()].sort(
    (a, b) => a.primeraEnSellarse.getTime() - b.primeraEnSellarse.getTime(),
  );
}

/**
 * Qué dice el corrimiento sobre su origen, sin adivinar quién lo hizo.
 *
 * `clasificarDiferencia` ya separa las dos formas y la distinción vale porque
 * la acción es distinta: un marco temporal equivocado es un defecto nuestro,
 * y un ajuste de minutos es una política que se movió y todavía no alcanzó a
 * lo generado.
 */
function lecturaDeCausa(causa: Exclude<CausaDeDiferencia, "ninguna">): string {
  return causa === "zona"
    ? "el marco temporal no es el de la medianoche civil del contrato"
    : "el turno o la anticipación de la política cambiaron después de generarse";
}

export function avisoHoraLimiteVieja(
  grupo: GrupoDesalineado,
  ahora: Date,
  revisadas: number,
): Aviso {
  const n = grupo.ocurrencias.length;
  /*
   * `difMinutos` es `derivada − guardada`, así que POSITIVO significa que la
   * derivada cae después: la guardada va ADELANTADA. Se escribe así, con el
   * signo dicho una sola vez, porque la primera redacción decía «tarde» junto
   * a «va antes» en la misma línea — el valor contradiciendo a su lectura.
   * No lo atrapó ninguna prueba: lo atrapó leer el correo.
   */
  const guardadaVaAntes = grupo.difMinutos > 0;

  const mediciones: Medicion[] = [
    {
      etiqueta: "Servicios sin sellar",
      valor: String(n),
      lectura: `de ${revisadas} revisados · turno «${grupo.turnoNombre}» de ${grupo.contratoNombre}`,
    },
    {
      etiqueta: "Corrimiento",
      valor: `${duracion(Math.abs(grupo.difMinutos))} ${guardadaVaAntes ? "temprano" : "tarde"}`,
      lectura: `la hora límite guardada va ${guardadaVaAntes ? "antes" : "después"} de la que hoy se derivaría · ${lecturaDeCausa(grupo.causa)}`,
    },
    {
      etiqueta: "El turno declara",
      valor: grupo.turnoInicio,
      lectura: `anticipación ${grupo.anticipacionMinutos} min de la política del contrato`,
    },
    {
      etiqueta: "El primero se juzga",
      valor: instanteSellado(grupo.primeraEnSellarse),
      lectura: `dentro de ${duracion(minutosEntre(grupo.primeraEnSellarse, ahora))} · desde ahí ya no se corrige, se re-verifica`,
    },
    {
      etiqueta: "El último se juzga",
      valor: instanteSellado(grupo.ultimaEnSellarse),
      lectura: "hasta ahí llega la ventana en la que la decisión todavía sirve",
    },
  ];

  const listadas = grupo.ocurrencias
    .slice()
    .sort((a, b) => a.guardada.getTime() - b.guardada.getTime());
  const detalle = listadas
    .slice(0, TOPE_DETALLE_DESALINEADAS)
    .map(
      (o) =>
        `${o.rutaNombre} · ${o.serviceDate} · guardada ${instanteSellado(o.guardada)} · hoy se derivaría ${instanteSellado(o.derivada)}`,
    );
  if (listadas.length > TOPE_DETALLE_DESALINEADAS) {
    detalle.push(
      `y ${listadas.length - TOPE_DETALLE_DESALINEADAS} más, no listadas aquí — el conteo de arriba sí las incluye`,
    );
  }

  return {
    clase: "hora-limite-vieja",
    titulo: `${n} servicio${n === 1 ? "" : "s"} de ${grupo.clienteNombre} van a juzgarse con una hora límite que su turno ya no produce.`,
    mediciones,
    consecuencia:
      "La hora límite se congela al generar la ocurrencia y nada la revisa cuando el turno cambia, así que estos servicios se van a sellar contra una ventana que ya no es la del turno. Un resultado sellado así no se corrige después: se re-verifica, y cada re-verificación mete una versión más en la historia del hecho.",
    accion:
      "Decidir si se corrigen antes de que se sellen o si se dejan, y correr `corregir-deadlines` si se corrigen · Asav",
    detalle,
    instante: grupo.primeraEnSellarse,
  };
}

/**
 * La ventana congelada — Frente A.
 *
 * Hermano de `avisoHoraLimiteVieja`, y el mismo mecanismo en otro campo: la
 * ventana se calcula al crear el viaje y **nadie la vuelve a mirar**, mientras
 * la derivación aprende de una historia que crece.
 *
 * ⚠ **Las dos causas van SEPARADAS y nunca sumadas.** Que la ventana se ensanche
 * porque se midieron más recorridos (`medida`) es el sistema aprendiendo —lo
 * esperado— y que se mueva porque alguien tocó una perilla (`politica`) es una
 * decisión de una persona. **Tienen dueños distintos y arreglos distintos**, y un
 * aviso que las mezclara mandaría a revisar la perilla equivocada.
 */
export type GrupoParaAviso = {
  contratoNombre: string;
  rutaNombre: string;
  turnoNombre: string;
  ocurrencias: number;
  congeladaMin: number;
  congeladaMax: number;
  derivadaMinutos: number;
  ensanchan: number;
  angostan: number;
  baseHoy: "medida" | "estimada_geometria" | "politica";
  muestras: number;
  proxima: string;
};

/**
 * UN aviso para todas las ventanas desalineadas de la corrida, con su desglose
 * como tabla.
 *
 * La primera versión mandaba **un aviso por ruta×turno**: con 47 grupos, un
 * correo con 47 hallazgos. Es la lección del vigilante por el otro lado —no un
 * canal que grita seguido, sino uno que grita mucho de una vez—, y el efecto es
 * el mismo: se archiva sin leer. El hallazgo es **uno solo** —la ventana
 * congelada envejeció mientras la historia crecía— y los 47 renglones son su
 * evidencia, no 47 noticias.
 */
export function avisoVentanasDesalineadas(
  grupos: GrupoParaAviso[],
  ahora: Date,
  revisadas: number,
): Aviso {
  const servicios = grupos.reduce((n, g) => n + g.ocurrencias, 0);
  const ensanchan = grupos.reduce((n, g) => n + g.ensanchan, 0);
  const angostan = grupos.reduce((n, g) => n + g.angostan, 0);

  /*
   * Las causas se cuentan por separado y NUNCA se suman en un total.
   * `medida` es la historia creciendo —el sistema aprendiendo—; `politica` es
   * que alguien movió una perilla. Tienen dueños distintos y arreglos
   * distintos, y un solo número mandaría a revisar el equivocado.
   */
  const porBase = new Map<GrupoParaAviso["baseHoy"], number>();
  for (const g of grupos) porBase.set(g.baseHoy, (porBase.get(g.baseHoy) ?? 0) + g.ocurrencias);
  const nombreBase: Record<GrupoParaAviso["baseHoy"], string> = {
    medida: "la duración medida de la ruta se movió",
    estimada_geometria: "no hay historia suficiente: hoy se estimaría sobre la geometría",
    politica: "cambió la política del contrato, no la medición",
  };
  const causas = [...porBase]
    .sort((a, b) => b[1] - a[1])
    .map(([base, n]) => `${n} ${nombreBase[base]}`)
    .join(" · ");

  const proxima = grupos.reduce((p, g) => (g.proxima < p ? g.proxima : p), grupos[0]!.proxima);
  const pct = ((servicios / revisadas) * 100).toFixed(1);

  return {
    clase: "ventana-desalineada",
    titulo: `${servicios} servicios sin sellar van a juzgarse con una ventana de evidencia que ya no es la que hoy se derivaría.`,
    mediciones: [
      {
        etiqueta: "Servicios sin sellar",
        valor: String(servicios),
        lectura: `de ${revisadas} revisados · ${pct} % de todo lo que todavía no se ha juzgado`,
      },
      {
        etiqueta: "Rutas y turnos",
        valor: String(grupos.length),
        lectura: "cada uno con su propia ventana; el desglose va abajo",
      },
      {
        /*
         * Las dos direcciones, separadas y sin total. Ensanchar hace que el
         * árbitro mire MÁS recorrido; angostar, que mire MENOS — y mirar menos
         * es la mecánica de las acusaciones que no se sostienen. Sumarlas en
         * «843 desalineadas» esconde que unas van en el sentido contrario.
         */
        etiqueta: "Hacia dónde se moverían",
        valor: `${ensanchan} se ensanchan`,
        lectura: `${angostan} se angostan · ensanchar hace que el árbitro mire más recorrido; angostar, que mire menos`,
      },
      {
        etiqueta: "Por qué cambió",
        valor: causas,
        lectura: "la historia que crece y la perilla que alguien mueve tienen dueños distintos",
      },
      {
        etiqueta: "El primero se juzga",
        valor: proxima,
        lectura: "desde ahí ya no se corrige, se re-verifica",
      },
    ],
    consecuencia:
      "La ventana es la frontera de lo que el árbitro alcanza a ver, y estos servicios se van a juzgar con una que se congeló cuando la ruta tenía menos historia. Lo que quede fuera de la ventana no se mira, y se califica igual: contra el trazado completo.",
    /*
     * No dice si algún veredicto cambiaría. **No lo sabe**: otra ventana es otra
     * evidencia y otro emparejamiento, y saberlo exige correr el árbitro — D4.
     * Insinuarlo aquí convertiría un aviso en una promesa.
     */
    accion:
      "Decidir si se re-dimensionan antes de que se sellen o si se dejan · Asav",
    tabla: {
      titulo: "Desglose por ruta y turno",
      columnas: ["Ruta", "Turno", "Contrato", "Serv.", "Congelada", "Hoy", "Muestras"],
      filas: grupos.map((g) => [
        g.rutaNombre,
        g.turnoNombre,
        g.contratoNombre,
        String(g.ocurrencias),
        /*
         * Rango, no representante. Dentro de un ruta×turno conviven ventanas de
         * 60 y de 120 minutos porque cada ocurrencia se congeló en un momento
         * distinto; escribir la del primer servicio como si fuera la del grupo
         * es un dato correcto vuelto afirmación falsa por la agrupación.
         */
        g.congeladaMin === g.congeladaMax
          ? `${g.congeladaMin} min`
          : `${g.congeladaMin}–${g.congeladaMax} min`,
        `${g.derivadaMinutos} min`,
        String(g.muestras),
      ]),
    },
    detalle: [
      "Este aviso NO dice si algún veredicto cambiaría: eso exige volver a correr el árbitro.",
    ],
    instante: ahora,
  };
}

/**
 * Un aviso de SIMULACRO: se manda a propósito, por el canal de verdad, para
 * comprobar que el camino completo llega hasta una bandeja.
 *
 * Existe por la regla 16, y no es celo: **un instrumento no está probado hasta
 * que se comprueba que su aviso llega a un humano.** Dos generaciones del
 * vigilante pasaron por sanas estando mudas — la primera vivía dentro de lo que
 * vigilaba, la segunda detectaba perfecto y no podía hablar: 117 corridas, cero
 * avisos, nueve días. La independencia era necesaria y no suficiente.
 *
 * Y hace falta aquí en particular porque **hoy el detector encuentra cero**: al
 * 7 de agosto de 2026 no queda ninguna ocurrencia sin sellar con la hora límite
 * vieja. Una corrida limpia no distingue un canal sano de uno roto.
 *
 * Provocar el aviso moviendo un turno real está descartado: eso ensucia datos
 * de un cliente vivo para probar una plomería. El simulacro dice la verdad
 * sobre sí mismo y no toca nada.
 *
 * **Se anuncia como simulacro en el asunto, en el título y en la acción.** Un
 * correo de prueba que se lee como hallazgo real es un dato correcto en el
 * lugar equivocado —§D del Marco— y haría que alguien fuera a buscar 47
 * servicios que no existen.
 */
export function avisoDeSimulacro(ahora: Date): Aviso {
  return {
    clase: "simulacro",
    titulo:
      "SIMULACRO · Esto no es un hallazgo: es la prueba de que este canal llega a una persona.",
    mediciones: [
      {
        etiqueta: "Qué se está probando",
        valor: "el camino del aviso",
        lectura: "detectar y avisar son dos cosas, y la segunda casi nunca se prueba",
      },
      {
        etiqueta: "Provocado",
        valor: instanteSellado(ahora),
        lectura: "a mano, con ?simular=1 · ninguna corrida programada manda esto",
      },
      {
        etiqueta: "Servicios afectados",
        valor: "0",
        lectura: "ninguno · el simulacro no lee la base ni toca un hecho",
      },
    ],
    consecuencia:
      "Ninguna. Este correo no describe ningún servicio ni ninguna ocurrencia: existe solo para que quien lo recibe confirme que lo recibió. Si llegó, el instrumento cuenta como probado; si no llegó, el detector podría estar funcionando perfecto y nadie se enteraría igual.",
    accion: "Confirmar que este correo llegó · J-Staff. No hay nada más que hacer",
    instante: ahora,
  };
}

/**
 * El asunto del correo. Lleva el conteo adelante para que se lea completo en
 * la notificación del teléfono, sin abrirlo.
 */
export function asuntoDe(aviso: Aviso): string {
  switch (aviso.clase) {
    case "ingesta-detenida":
      return `J-Telemetry · Ingesta detenida`;
    case "ingesta-restablecida":
      return `J-Telemetry · Ingesta restablecida`;
    case "archivador-callado":
      return `J-Telemetry · Archivador callado`;
    case "archivador-restablecido":
      return `J-Telemetry · Archivador restablecido`;
    case "sin-veredicto":
      return `J-Telemetry · Servicios sin veredicto`;
    case "hora-limite-vieja":
      return `J-Telemetry · Hora límite desalineada`;
    /*
     * Nombra la VENTANA y no la hora límite, aunque el mecanismo sea el mismo:
     * quien lo lea en el teléfono tiene que saber qué campo mirar antes de
     * abrir el correo, y son dos campos con dos arreglos.
     */
    case "ventana-desalineada":
      return `J-Telemetry · Ventana de evidencia desalineada`;
    case "simulacro":
      return `J-Telemetry · SIMULACRO · prueba del canal de avisos`;
  }
}
