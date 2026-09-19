import type { Repositories } from "@jtel/db";
import {
  JTTEL_TZ,
  PARADA_MINUTOS_POR_DEFECTO,
  SIN_SENAL_MINUTOS,
  TOLERANCIA_POR_GRADO,
  paradas as paradasDeLaTraza,
  type GradoDeTrazo,
  type Hueco,
  type Salto,
  type Parada,
  type PuntoTraza,
  type Ventana,
} from "@jtel/domain";
import { cortarPorModalidad, recorridoPorVentana, type CifrasDelPeriodo, type Lugar } from "./recorrido-del-dia.js";
import {
  modalidadDesdeEspeciales,
  trazoParaDibujar,
  ventanaCerrada,
  type LugarBreve,
  type RecorridoServido,
} from "./recorrido-servido.js";

/**
 * El recorrido de un dispositivo — Ver ‹dispositivo› → Recorridos y playback.
 *
 * Decidido por ASAV el 17 de septiembre de 2026 (prototipo aprobado): **una
 * sola traza del dispositivo, partida en etapas**, cada una con su unidad. La
 * pantalla del dispositivo contesta «¿qué hizo este aparato?»; para ver un
 * camión ya está Ver ‹unidad›.
 *
 * ## Las etapas
 *
 * La ventana se parte por las asignaciones **de esta cuenta** (el muro del
 * #435 ya va en la consulta):
 *
 *   · **unidad** — el tiempo en que estuvo asignado a una unidad. Se corta con
 *     los servicios especiales de *esa* unidad (Pieza 7), así que la etapa es
 *     lo mismo que Ver ‹unidad› dibuja en esas horas: el archivador sella cada
 *     punto con la asignación vigente en su instante (`resolveUnitAtTime`).
 *   · **bodega** — sin unidad, con puntos en esta cuenta. Los puntos traen la
 *     cuenta: prueban que el aparato estaba aquí. Se dibuja punteado y nada lo
 *     corta: sin unidad no hay servicio.
 *   · **sin_unidad_sin_puntos** — sin unidad y sin un solo punto en esta
 *     cuenta. **No se dice «en bodega»**: hoy no se puede distinguir el aparato
 *     callado en bodega del aparato que estaba en otra cuenta, porque cambiar
 *     de cuenta mueve la fila sin fecha (6.14). La frase de la pantalla, «sin
 *     unidad y sin puntos en esta cuenta», es verdad en los dos casos y nombra
 *     su alcance. Cuando el cambio de cuenta sea un evento con fecha, esta
 *     etapa se parte en «en bodega · sin puntos» y «sin registro en esta
 *     cuenta» (pendiente con nombre).
 *
 * «Sin registro en esta cuenta» **no** se saca de los puntos que el aparato
 * haya traído en otra cuenta: eso le diría a esta cuenta el horario del otro
 * cliente y abriría el muro por una puerta chica.
 *
 * Las cifras de cada etapa son suyas; las del periodo son la suma, y la
 * pantalla las nombra «del dispositivo» (§D): un total sin etiqueta se leería
 * como kilómetros de una unidad. Un hueco es silencio **dentro** de una etapa;
 * el tiempo entre dos etapas es un cambio, no un hueco.
 */

type Contenido = {
  tramos: PuntoTraza[][];
  huecos: Hueco[];
  saltos: Salto[];
  visitas: RecorridoServido["visitas"];
  ocultos: RecorridoServido["ocultos"];
  paradas: Parada[];
  cifras: CifrasDelPeriodo;
  puntosDibujados: number;
  simplificado: boolean;
};

export type EtapaDelDispositivo =
  | ({
      tipo: "unidad";
      desde: Date;
      hasta: Date;
      unidad: { id: string; etiqueta: string };
      /** Servicios especiales de esa unidad que tocan la etapa: los que cortan. */
      especiales: number;
      /** Quién la montó (0039); `null` si no quedó registrado. */
      asignadaPor: string | null;
      /** Si la etapa termina por soltarlo o moverlo dentro de la ventana: quién y por qué. */
      cerradaPor: string | null;
      motivoCierre: string | null;
    } & Contenido)
  | ({ tipo: "bodega"; desde: Date; hasta: Date } & Contenido)
  | { tipo: "sin_unidad_sin_puntos"; desde: Date; hasta: Date };

export type RecorridoDeDispositivoServido = {
  dispositivo: { id: string; etiqueta: string | null; imei: string };
  ventana: Ventana;
  cerrada: boolean;
  grado: GradoDeTrazo;
  toleranciaMetros: number;
  simplificado: boolean;
  puntosMedidos: number;
  puntosDibujados: number;
  paradaMinutos: number;
  /** La suma de las etapas: lo que recorrió **el dispositivo**. */
  cifras: CifrasDelPeriodo;
  /** Cuántas unidades distintas trajo en la ventana. */
  unidades: number;
  etapas: EtapaDelDispositivo[];
};

export type AsignacionDelDispositivo = {
  unitId: string;
  etiqueta: string;
  desde: Date;
  hasta: Date | null;
  asignadaPor: string | null;
  cerradaPor: string | null;
  motivoCierre: string | null;
};

type Esqueleto =
  | { tipo: "unidad"; desde: Date; hasta: Date; asignacion: AsignacionDelDispositivo; puntos: PuntoTraza[] }
  | { tipo: "sin_unidad"; desde: Date; hasta: Date; puntos: PuntoTraza[] };

/**
 * La ventana partida en etapas, con sus puntos. Función pura.
 *
 * Cada etapa es un intervalo semiabierto `[desde, hasta)`, salvo la última,
 * que incluye el fin de la ventana: un punto en el instante exacto de un cambio
 * es de la etapa que empieza, y ningún punto cae en dos. Las etapas cubren la
 * ventana entera, sin huecos entre ellas.
 */
export function etapasDeLaVentana(
  ventana: Ventana,
  asignaciones: AsignacionDelDispositivo[],
  puntos: PuntoTraza[],
): Array<Esqueleto & { tipoFinal: "unidad" | "bodega" | "sin_unidad_sin_puntos" }> {
  const a0 = ventana.desde.getTime();
  const z0 = ventana.hasta.getTime();

  const tocan = asignaciones
    .map((a) => ({
      a,
      desde: Math.max(a.desde.getTime(), a0),
      hasta: Math.min(a.hasta ? a.hasta.getTime() : Number.POSITIVE_INFINITY, z0),
    }))
    .filter((x) => x.hasta > x.desde)
    .sort((x, y) => x.desde - y.desde);

  const cortes: Array<{ desde: number; hasta: number; a: AsignacionDelDispositivo | null }> = [];
  let cursor = a0;
  for (const x of tocan) {
    // Un dispositivo va en una unidad a la vez; si dos filas se enciman, manda la que empezó después.
    const desde = Math.max(x.desde, cursor);
    if (desde > cursor) cortes.push({ desde: cursor, hasta: desde, a: null });
    if (x.hasta > desde) {
      cortes.push({ desde, hasta: x.hasta, a: x.a });
      cursor = x.hasta;
    }
  }
  if (cursor < z0 || cortes.length === 0) cortes.push({ desde: cursor, hasta: z0, a: null });

  const ordenados = [...puntos].sort((p, q) => p.at.getTime() - q.at.getTime());
  return cortes.map((c, i) => {
    const ultima = i === cortes.length - 1;
    const suyos = ordenados.filter((p) => {
      const t = p.at.getTime();
      return t >= c.desde && (ultima ? t <= c.hasta : t < c.hasta);
    });
    const desde = new Date(c.desde);
    const hasta = new Date(c.hasta);
    if (c.a) return { tipo: "unidad", desde, hasta, asignacion: c.a, puntos: suyos, tipoFinal: "unidad" };
    return { tipo: "sin_unidad", desde, hasta, puntos: suyos, tipoFinal: suyos.length > 0 ? "bodega" : "sin_unidad_sin_puntos" };
  });
}

type ReposDelRecorrido = Pick<Repositories, "expedientes" | "telemetry" | "geofences" | "occurrences">;

const breve = (l: Lugar): LugarBreve => ({ id: l.id, nombre: l.nombre, rol: l.rol });

/**
 * El recorrido de un dispositivo del carrier en una ventana, listo para servir.
 * `null` si el dispositivo no es de ese carrier: desde aquí no existe.
 */
export async function cargarRecorridoDeDispositivo(
  repos: ReposDelRecorrido,
  opciones: {
    carrierAccountId: string;
    deviceId: string;
    ventana: Ventana;
    grado: GradoDeTrazo;
    ahora: Date;
    timeZone?: string;
    paradaMinutos?: number;
  },
): Promise<RecorridoDeDispositivoServido | null> {
  const { carrierAccountId, deviceId, ventana, grado, ahora } = opciones;
  const timeZone = opciones.timeZone ?? JTTEL_TZ;
  const paradaMinutos = opciones.paradaMinutos ?? PARADA_MINUTOS_POR_DEFECTO;

  const dispositivo = await repos.expedientes.dispositivoDeCuenta(carrierAccountId, deviceId);
  if (!dispositivo) return null;

  const [filas, filasDeLugares, asignaciones, marcas] = await Promise.all([
    repos.telemetry.getForImeisDeCuenta(carrierAccountId, [dispositivo.imei], ventana.desde, ventana.hasta),
    repos.geofences.lugaresDeCarrier(carrierAccountId),
    repos.expedientes.asignacionesDeDispositivo(carrierAccountId, deviceId),
    repos.telemetry.getArchiveMarks(carrierAccountId),
  ]);

  const lugares: Lugar[] = filasDeLugares.map((g) => ({ id: g.id, nombre: g.name, rol: g.role, poligono: g.polygon }));
  const puntos: PuntoTraza[] = filas.map((f) => ({ lat: f.latitude, lng: f.longitude, at: f.recordedAt, speed: f.speed }));
  const toleranciaMetros = TOLERANCIA_POR_GRADO[grado];

  const esqueleto = etapasDeLaVentana(ventana, asignaciones, puntos);

  const etapas: EtapaDelDispositivo[] = await Promise.all(
    esqueleto.map(async (e): Promise<EtapaDelDispositivo> => {
      if (e.tipoFinal === "sin_unidad_sin_puntos") return { tipo: "sin_unidad_sin_puntos", desde: e.desde, hasta: e.hasta };

      const deLaEtapa = { desde: e.desde, hasta: e.hasta };
      // Sin unidad no hay servicio: la modalidad es «ninguna» y nada corta.
      const especiales =
        e.tipo === "unidad"
          ? await repos.occurrences.especialesDeUnidadEnVentana(carrierAccountId, e.asignacion.unitId, e.desde, e.hasta)
          : [];
      const recorrido = recorridoPorVentana({ ventana: deLaEtapa, puntos: e.puntos, lugares });
      const cortada = cortarPorModalidad(recorrido, modalidadDesdeEspeciales(especiales));
      const lasParadas = paradasDeLaTraza(recorrido.tramos.flat(), {
        minMinutos: paradaMinutos,
        umbralHuecoMinutos: SIN_SENAL_MINUTOS,
      });
      const dibujo = trazoParaDibujar({ recorrido, cortada, paradas: lasParadas, toleranciaMetros });
      const contenido: Contenido = {
        tramos: dibujo.tramos,
        huecos: recorrido.huecos,
        saltos: recorrido.saltos,
        visitas: recorrido.visitas.map((v) => ({ ...v, lugar: breve(v.lugar) })),
        ocultos: cortada.ocultos.map((o) => ({ ...o, lugar: breve(o.lugar) })),
        paradas: lasParadas,
        cifras: recorrido.cifras,
        puntosDibujados: dibujo.puntosDibujados,
        simplificado: dibujo.simplificado,
      };
      if (e.tipo === "sin_unidad") return { tipo: "bodega", desde: e.desde, hasta: e.hasta, ...contenido };

      // Quién la cerró sólo se dice si el cierre cae dentro de la ventana.
      const cierraAqui = e.asignacion.hasta !== null && e.asignacion.hasta.getTime() <= ventana.hasta.getTime();
      return {
        tipo: "unidad",
        desde: e.desde,
        hasta: e.hasta,
        unidad: { id: e.asignacion.unitId, etiqueta: e.asignacion.etiqueta },
        especiales: especiales.length,
        asignadaPor: e.asignacion.asignadaPor,
        cerradaPor: cierraAqui ? e.asignacion.cerradaPor : null,
        motivoCierre: cierraAqui ? e.asignacion.motivoCierre : null,
        ...contenido,
      };
    }),
  );

  const conContenido = etapas.filter((e) => e.tipo !== "sin_unidad_sin_puntos");
  const suma = (f: (c: CifrasDelPeriodo) => number) => conContenido.reduce((n, e) => n + f(e.cifras), 0);

  return {
    dispositivo: { id: dispositivo.id, etiqueta: dispositivo.label, imei: dispositivo.imei },
    ventana,
    cerrada: ventanaCerrada({ ventana, ahora, timeZone, imeis: [dispositivo.imei], marcas }),
    grado,
    toleranciaMetros,
    simplificado: conContenido.some((e) => e.simplificado),
    puntosMedidos: puntos.length,
    puntosDibujados: conContenido.reduce((n, e) => n + e.puntosDibujados, 0),
    paradaMinutos,
    cifras: {
      puntos: suma((c) => c.puntos),
      kmMedidos: suma((c) => c.kmMedidos),
      saltosDescartados: suma((c) => c.saltosDescartados),
      minutosConSenal: suma((c) => c.minutosConSenal),
      huecos: suma((c) => c.huecos),
    },
    unidades: new Set(etapas.flatMap((e) => (e.tipo === "unidad" ? [e.unidad.id] : []))).size,
    etapas,
  };
}
