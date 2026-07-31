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
    | "sin-veredicto";
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
  }
}
