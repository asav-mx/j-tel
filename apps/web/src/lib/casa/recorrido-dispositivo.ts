import { gradoParaVentana } from "@jtel/domain";
import { conCuenta } from "@/lib/casa/casas";
import type { Puerta } from "@/lib/casa/dispositivos";
import { RAIZ_EXPEDIENTES } from "@/lib/casa/expedientes";
import { duracion, hhmm, pausasEntre, pedazosDe, sello, diaCorto, type Pausa, type Pedazo, type Periodo, type RecorridoJson } from "@/lib/casa/recorrido";

/**
 * Recorridos y playback en Ver ‹dispositivo› — lo que la pantalla decide, sin DOM.
 *
 * El servidor entrega la ventana partida en etapas (`cargarRecorridoDeDispositivo`).
 * Aquí se aplanan en los pedazos que el playback recorre, se decide dónde se
 * detiene —un hueco o un destino dentro de una etapa, **un cambio** entre dos— y
 * cómo se dice cada cosa. Aprobado por ASAV con el prototipo del 17 sep 2026.
 */

type Iso = string;
type Contenido = Pick<RecorridoJson, "tramos" | "huecos" | "visitas" | "ocultos" | "paradas" | "cifras" | "simplificado">;

export type EtapaJson =
  | ({
      tipo: "unidad";
      desde: Iso;
      hasta: Iso;
      unidad: { id: string; etiqueta: string };
      especiales: number;
      asignadaPor: string | null;
      cerradaPor: string | null;
      motivoCierre: string | null;
    } & Contenido)
  | ({ tipo: "bodega"; desde: Iso; hasta: Iso } & Contenido)
  | { tipo: "sin_unidad_sin_puntos"; desde: Iso; hasta: Iso };

export type RecorridoDeDispositivoJson = {
  dispositivo: { id: string; etiqueta: string | null; imei: string };
  ventana: { desde: Iso; hasta: Iso };
  cerrada: boolean;
  simplificado: boolean;
  puntosMedidos: number;
  cifras: RecorridoJson["cifras"];
  unidades: number;
  etapas: EtapaJson[];
  /** id de quien montó o soltó → su correo (o el id, si no se pudo leer). */
  autores: Record<string, string>;
};

/** Un pedazo del playback, con la etapa a la que pertenece. */
export type PedazoDeEtapa = Pedazo & { etapa: number; sinUnidad: boolean };

/** Por qué se detiene el playback del dispositivo: lo de la unidad, más el cambio de etapa. */
export type PausaDelDispositivo =
  | Pausa
  | {
      tipo: "cambio";
      /** Etapa que termina (la del pedazo anterior) y etapa donde sigue. */
      sale: number;
      entra: number;
      /** Etapas sin puntos que quedaron entre las dos: no hay pedazo que las recorra. */
      entre: number[];
    };

const conContenido = (e: EtapaJson): e is Exclude<EtapaJson, { tipo: "sin_unidad_sin_puntos" }> =>
  e.tipo !== "sin_unidad_sin_puntos";

/** Los pedazos de todas las etapas, en orden. */
export function pedazosDelDispositivo(r: Pick<RecorridoDeDispositivoJson, "etapas">): PedazoDeEtapa[] {
  return r.etapas.flatMap((e, etapa) =>
    conContenido(e) ? pedazosDe(e as unknown as RecorridoJson).map((p) => ({ ...p, etapa, sinUnidad: e.tipo === "bodega" })) : [],
  );
}

/**
 * La pausa entre cada par de pedazos seguidos. Dentro de una etapa, las mismas
 * dos razones que en Ver ‹unidad› (hueco o destino, con los ocultos de *esa*
 * etapa). Entre etapas, un cambio: **no es un hueco**, aunque no haya puntos
 * de por medio — el aparato cambió de lugar, y eso se dice.
 */
export function pausasDelDispositivo(pedazos: PedazoDeEtapa[], r: Pick<RecorridoDeDispositivoJson, "etapas">): PausaDelDispositivo[] {
  const pausas: PausaDelDispositivo[] = [];
  for (let i = 0; i + 1 < pedazos.length; i += 1) {
    const a = pedazos[i]!;
    const b = pedazos[i + 1]!;
    if (a.etapa !== b.etapa) {
      const entre = [];
      for (let k = a.etapa + 1; k < b.etapa; k += 1) entre.push(k);
      pausas.push({ tipo: "cambio", sale: a.etapa, entra: b.etapa, entre });
      continue;
    }
    const etapa = r.etapas[a.etapa]!;
    const ocultos = conContenido(etapa) ? etapa.ocultos : [];
    pausas.push(pausasEntre([a, b], { ocultos })[0]!);
  }
  return pausas;
}

/** Los huecos de todas las etapas, para los círculos del mapa. */
export function huecosDelDispositivo(r: Pick<RecorridoDeDispositivoJson, "etapas">): RecorridoJson["huecos"] {
  return r.etapas.flatMap((e) => (conContenido(e) ? e.huecos : []));
}

/** Suma de lo que duraron los huecos de todas las etapas. */
export function duracionDeHuecos(r: Pick<RecorridoDeDispositivoJson, "etapas">): number {
  return huecosDelDispositivo(r).reduce((n, h) => n + (Date.parse(h.hasta) - Date.parse(h.desde)), 0);
}

/* ─── Cómo se dice ──────────────────────────────────────────────────────── */

/** El nombre corto de una etapa: la unidad, «bodega», o su alcance. */
export function nombreDeEtapa(e: EtapaJson): string {
  if (e.tipo === "unidad") return e.unidad.etiqueta;
  if (e.tipo === "bodega") return "En bodega";
  return "Sin unidad y sin puntos";
}

/** «07:42 → 11:10»; con el día si la ventana cruza días. */
export function horasDeEtapa(e: Pick<EtapaJson, "desde" | "hasta">, ventana: { desde: Iso; hasta: Iso }): string {
  const a = Date.parse(e.desde);
  const z = Date.parse(e.hasta);
  const variosDias = diaCorto(Date.parse(ventana.desde)) !== diaCorto(Date.parse(ventana.hasta));
  const f = (t: number) => (variosDias ? `${diaCorto(t)} ${hhmm(t)}` : hhmm(t));
  return `${f(a)} → ${f(z)}`;
}

/** Qué regla de corte aplicó, en palabras. */
export function reglaDeEtapa(e: EtapaJson): string {
  if (e.tipo === "unidad") {
    return e.especiales > 0 ? "con servicio especial: se corta en destino" : "sin servicio especial: la traza no se corta";
  }
  if (e.tipo === "bodega") return "sin unidad: se dibuja punteado y nada lo corta";
  return "sin unidad ni puntos en esta cuenta";
}

const quien = (id: string | null, autores: Record<string, string>) => (id ? (autores[id] ?? id) : null);

/**
 * La línea de quién y por qué bajo cada etapa. Para una etapa de unidad, quién
 * la montó; para la bodega, quién la soltó de la unidad anterior y por qué.
 * `null` si no hay nada que decir: nunca se inventa un autor.
 */
export function quienDeEtapa(etapas: EtapaJson[], i: number, autores: Record<string, string>): string | null {
  const e = etapas[i]!;
  const previa = i > 0 ? etapas[i - 1] : undefined;
  if (e.tipo === "unidad") {
    if (i === 0) return null;
    const por = quien(e.asignadaPor, autores);
    return por ? `Lo asignó ${por} · ${hhmm(Date.parse(e.desde))}` : `Asignado a las ${hhmm(Date.parse(e.desde))} · sin registro de quién`;
  }
  if (e.tipo === "bodega" && previa?.tipo === "unidad") {
    const por = quien(previa.cerradaPor, autores);
    const motivo = previa.motivoCierre ? ` · «${previa.motivoCierre}»` : "";
    return `${por ? `Lo soltó ${por}` : "Soltado, sin registro de quién"} · ${hhmm(Date.parse(e.desde))}${motivo}`;
  }
  if (e.tipo === "sin_unidad_sin_puntos") {
    return "Aquí no tuvo unidad ni dio un solo punto. Con eso no se puede saber dónde estuvo.";
  }
  return null;
}

export type TextoDelCambio = { titulo: string; rango: string; motivo: string | null; porque: string; accion: string; entraABodega: boolean };

/** Lo que dice el aviso cuando el playback se detiene en un cambio de etapa. */
export function textoDelCambio(
  r: Pick<RecorridoDeDispositivoJson, "etapas" | "autores">,
  pausa: Extract<PausaDelDispositivo, { tipo: "cambio" }>,
  continuaEn: number,
): TextoDelCambio {
  const sale = r.etapas[pausa.sale]!;
  const entra = r.etapas[pausa.entra]!;
  const hora = hhmm(Date.parse(entra.desde));
  const soltada = pausa.entre.length === 0 && sale.tipo === "unidad" ? sale : null;
  const motivo = soltada?.motivoCierre ? `«${soltada.motivoCierre}»` : null;
  const antes = pausa.entre
    .map((k) => r.etapas[k]!)
    .map((e) => ` Antes, ${hhmm(Date.parse(e.desde))}–${hhmm(Date.parse(e.hasta))}: sin unidad y sin puntos en esta cuenta.`)
    .join("");

  if (entra.tipo === "unidad") {
    const por = quien(entra.asignadaPor, r.autores);
    return {
      titulo: sale.tipo === "unidad" && pausa.entre.length === 0 ? `De la ${sale.unidad.etiqueta} a la ${entra.unidad.etiqueta}` : `Montado en la ${entra.unidad.etiqueta}`,
      rango: `${hora} · ${por ? `lo asignó ${por}` : "sin registro de quién lo asignó"}`,
      motivo,
      porque: `Lo que sigue es de la ${entra.unidad.etiqueta} y se corta con sus servicios.${antes}`,
      accion: `Continuar en la ${entra.unidad.etiqueta} · ${hhmm(continuaEn)}`,
      entraABodega: false,
    };
  }
  const por = soltada ? quien(soltada.cerradaPor, r.autores) : null;
  return {
    titulo: soltada ? `Deja la ${soltada.unidad.etiqueta}` : "En bodega",
    rango: soltada ? `${hora} · ${por ? `lo soltó ${por}` : "sin registro de quién lo soltó"}` : hora,
    motivo,
    porque: `Desde aquí no va en ninguna unidad.${antes}`,
    accion: `Continuar en bodega · ${hhmm(continuaEn)}`,
    entraABodega: true,
  };
}

/** El rango de un hueco o un cambio, dicho como lectura. */
export const rangoDe = (desde: number, hasta: number) => `${sello(desde)} → ${sello(hasta)} · ${duracion(hasta - desde)}`;

/* ─── Las direcciones ───────────────────────────────────────────────────── */

/** La dirección de la pantalla con su ventana. La puerta va en `puerta`: `desde` es de la ventana. */
export const rutaDeRecorridoDeDispositivo = (deviceId: string, p: Periodo, cuenta: string | null, puerta: Puerta = "expedientes") => {
  const q = `${puerta === "dispositivos" ? "puerta=dispositivos&" : ""}desde=${encodeURIComponent(new Date(p.desde).toISOString())}&hasta=${encodeURIComponent(new Date(p.hasta).toISOString())}`;
  return conCuenta(`${RAIZ_EXPEDIENTES}/dispositivo/${deviceId}/recorrido?${q}`, cuenta);
};

/** La petición al endpoint, con el grado escrito para que lo cerrado se congele (regla 10). */
export function peticionDelRecorridoDeDispositivo(slug: string, deviceId: string, p: Periodo): string {
  const ventana = { desde: new Date(p.desde), hasta: new Date(p.hasta) };
  const q = new URLSearchParams({
    account: slug,
    dispositivo: deviceId,
    desde: ventana.desde.toISOString(),
    hasta: ventana.hasta.toISOString(),
    grado: String(gradoParaVentana(ventana)),
  });
  return `/api/casa/recorrido/dispositivo?${q}`;
}
