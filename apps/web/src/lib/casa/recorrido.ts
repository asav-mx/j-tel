import {
  JTTEL_TZ,
  addDaysIso,
  gradoParaVentana,
  instanteZonificado,
  localDateIso,
  ventanaDelDia,
  type GradoDeTrazo,
} from "@jtel/domain";
import { conCuenta } from "@/lib/casa/casas";
import { rutas } from "@/lib/casa/expedientes";

/**
 * Recorridos y playback (C3-c) — todo lo que la pantalla decide, sin DOM.
 *
 * La pantalla no recalcula la traza: dibuja lo que sirve `/api/casa/recorrido`.
 * Lo que vive aquí es lo propio de la pantalla —qué periodo se pide, cómo se
 * nombra, dónde va el marcador en cada instante, dónde se detiene el playback
 * y por qué— para probarlo contra casos conocidos.
 */

export const ZONA = JTTEL_TZ;
const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;

/* ─── El dato, como llega y como se usa ─────────────────────────────────── */

type Iso = string;
type LugarBreveJson = { id: string; nombre: string; rol: string };

/** `RecorridoServido` después de pasar por JSON: los instantes son cadenas ISO. */
export type RecorridoJson = {
  unidad: { id: string; etiqueta: string };
  ventana: { desde: Iso; hasta: Iso };
  cerrada: boolean;
  grado: GradoDeTrazo;
  toleranciaMetros: number;
  simplificado: boolean;
  puntosMedidos: number;
  puntosDibujados: number;
  tramos: Array<Array<{ lat: number; lng: number; at: Iso; speed: number | null }>>;
  huecos: Array<{ desde: Iso; hasta: Iso; minutos: number; lat: number; lng: number; latFin: number; lngFin: number }>;
  saltos: Array<{ desde: Iso; hasta: Iso; km: number; lat: number; lng: number; latFin: number; lngFin: number }>;
  visitas: Array<{ lugar: LugarBreveJson; entrada: Iso; entradaObservada: boolean; ultimoAdentro: Iso; salida: Iso | null }>;
  ocultos: Array<{ lugar: LugarBreveJson; desde: Iso; entradaObservada: boolean; hasta: Iso; salidaObservada: boolean }>;
  paradas: Array<{ desde: Iso; hasta: Iso; minutos: number; lat: number; lng: number }>;
  paradaMinutos: number;
  cifras: { puntos: number; kmMedidos: number; saltosDescartados: number; minutosConSenal: number; huecos: number };
  dispositivos: Array<{ etiqueta: string | null; desde: Iso; hasta: Iso | null }>;
};

export type Punto = { lat: number; lng: number; t: number; v: number };

/** Un tramo dibujado: lo que el playback recorre sin detenerse. */
export type Pedazo = { puntos: Punto[]; t0: number; t1: number };

/** Por qué se detiene el playback entre dos pedazos. */
export type Pausa =
  | { tipo: "hueco"; desde: number; hasta: number }
  | { tipo: "salto"; desde: number; hasta: number; km: number }
  | { tipo: "destino"; lugar: string; desde: number; hasta: number; entradaObservada: boolean; salidaObservada: boolean };

export function pedazosDe(r: RecorridoJson): Pedazo[] {
  return r.tramos
    .filter((t) => t.length > 0)
    .map((t) => {
      const puntos = t.map((p) => ({ lat: p.lat, lng: p.lng, t: Date.parse(p.at), v: p.speed ?? 0 }));
      return { puntos, t0: puntos[0]!.t, t1: puntos[puntos.length - 1]!.t };
    });
}

/**
 * La pausa entre cada par de pedazos seguidos.
 *
 * Dos pedazos se separan por una de tres razones, y la pantalla no puede decir
 * la misma frase para las tres: **un salto** —se midió, pero los dos puntos se
 * contradicen—, **un destino** de especial —se midió, pero adentro no se
 * dibuja (Pieza 7)— o **un hueco** —nadie midió—. El salto se reconoce por sus
 * dos extremos exactos; si la separación cae sobre un tramo oculto, es
 * destino; si no, es hueco.
 */
export function pausasEntre(pedazos: Pedazo[], r: Pick<RecorridoJson, "ocultos" | "saltos">): Pausa[] {
  const pausas: Pausa[] = [];
  for (let i = 0; i + 1 < pedazos.length; i += 1) {
    const fin = pedazos[i]!.t1;
    const inicio = pedazos[i + 1]!.t0;
    const salto = r.saltos.find((x) => Date.parse(x.desde) === fin && Date.parse(x.hasta) === inicio);
    if (salto) {
      pausas.push({ tipo: "salto", desde: fin, hasta: inicio, km: salto.km });
      continue;
    }
    const oculto = r.ocultos.find((o) => Date.parse(o.desde) <= inicio && Date.parse(o.hasta) >= fin);
    pausas.push(
      oculto
        ? {
            tipo: "destino",
            lugar: oculto.lugar.nombre,
            desde: Date.parse(oculto.desde),
            hasta: Date.parse(oculto.hasta),
            entradaObservada: oculto.entradaObservada,
            salidaObservada: oculto.salidaObservada,
          }
        : { tipo: "hueco", desde: fin, hasta: inicio },
    );
  }
  return pausas;
}

/**
 * Metros dentro de los cuales un hueco «no se movió»: la deriva del GPS de un
 * camión estacionado. Aprobado por ASAV el 18 sep 2026. Un hueco cuyos dos
 * extremos quedan más cerca que esto no deja corte visible en la línea —la de
 * antes y la de después se tocan—, así que se declara con una pastilla.
 */
export const HUECO_QUIETO_METROS = 50;

/**
 * Píxeles en pantalla dentro de los cuales dos marcas de hueco caen una encima
 * de la otra: el diámetro de la marca (radio 6 más el trazo). Una pastilla
 * junta **sólo** lo que se encima así; si a simple vista quedan separados,
 * cada uno lleva la suya (ASAV, 18 sep 2026). Por eso se mide en la pantalla y
 * no en el terreno: los mismos 10 m son una sola marca de lejos y dos de cerca.
 */
export const HUECOS_ENCIMADOS_PX = 14;

function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const k = Math.PI / 180;
  const dLat = (b.lat - a.lat) * k;
  const dLng = (b.lng - a.lng) * k;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
}

export type HuecoQuieto = { lat: number; lng: number; ms: number };

/**
 * Los huecos que no dejan corte visible.
 *
 * Un hueco con desplazamiento se ve solo: la línea se interrumpe y quedan sus
 * dos círculos, lejos uno del otro. Uno **sin** desplazamiento —el camión
 * estacionado que reporta cada hora— no: sus dos extremos caen en el mismo
 * punto y el mapa se ve continuo aunque la cinta diga «4 huecos». Así se vio el
 * Jeep el 18 sep 2026: sus ocho círculos quedaban además debajo del marcador
 * del playback.
 */
export function huecosQuietos(huecos: RecorridoJson["huecos"], metros: number = HUECO_QUIETO_METROS): HuecoQuieto[] {
  return huecos
    .filter((h) => metrosEntre({ lat: h.lat, lng: h.lng }, { lat: h.latFin, lng: h.lngFin }) <= metros)
    .map((h) => ({ lat: h.lat, lng: h.lng, ms: Date.parse(h.hasta) - Date.parse(h.desde) }));
}

/**
 * Junta en una pastilla los huecos quietos cuyas marcas se enciman **en la
 * pantalla**, con la proyección del zoom de ese momento. Se encadena: si A
 * toca a B y B toca a C, en pantalla son una sola mancha, y una sola pastilla.
 * La pastilla va donde cayó el primero.
 */
export function juntarEncimados(
  quietos: HuecoQuieto[],
  proyectar: (lat: number, lng: number) => { x: number; y: number },
  px: number = HUECOS_ENCIMADOS_PX,
): Array<{ lat: number; lng: number; n: number; ms: number }> {
  const puntos = quietos.map((q) => proyectar(q.lat, q.lng));
  const grupo = quietos.map((_, i) => i);
  const raiz = (i: number): number => (grupo[i] === i ? i : (grupo[i] = raiz(grupo[i]!)));
  for (let i = 0; i < quietos.length; i += 1) {
    for (let j = i + 1; j < quietos.length; j += 1) {
      if (Math.hypot(puntos[i]!.x - puntos[j]!.x, puntos[i]!.y - puntos[j]!.y) <= px) {
        grupo[Math.max(raiz(i), raiz(j))] = Math.min(raiz(i), raiz(j));
      }
    }
  }
  const salida = new Map<number, { lat: number; lng: number; n: number; ms: number }>();
  quietos.forEach((q, i) => {
    const r = raiz(i);
    const g = salida.get(r);
    if (g) {
      g.n += 1;
      g.ms += q.ms;
    } else salida.set(r, { lat: q.lat, lng: q.lng, n: 1, ms: q.ms });
  });
  return [...salida.values()];
}

/** La forma de cada pausa: la misma en la cinta y en el marcador detenido. */
export function glifoDePausa(p: Pausa): "sin-senal" | "en-destino" | "salto" {
  return p.tipo === "hueco" ? "sin-senal" : p.tipo === "salto" ? "salto" : "en-destino";
}

/** Cómo se nombra cada pausa en la cinta. */
export function nombreDePausa(p: Pausa): string {
  if (p.tipo === "hueco") return `Sin señal · ${duracion(p.hasta - p.desde)}`;
  // «La señal siguió» explica por qué la cinta muestra dos barras donde las cifras cuentan un tramo medido.
  if (p.tipo === "salto") return `Salto del GPS · ${p.km.toFixed(1)} km en ${duracion(p.hasta - p.desde)} · la señal siguió`;
  return `En ${p.lugar} · ${duracion(p.hasta - p.desde)}`;
}

/* ─── La ventana ────────────────────────────────────────────────────────── */

export type Periodo = { desde: number; hasta: number };

const diaDe = (t: number) => localDateIso(new Date(t), ZONA);
const inicioDelDia = (t: number) => ventanaDelDia(diaDe(t), ZONA).desde.getTime();

export type Atajo = { nombre: string; periodo: Periodo };

/** Los atajos de tiempo llano. Ninguno horneado: todos salen de `ahora`. */
export function atajosDeTiempo(ahora: number): Atajo[] {
  const hoy = diaDe(ahora);
  const inicioHoy = inicioDelDia(ahora);
  const ayer = ventanaDelDia(addDaysIso(hoy, -1), ZONA);
  return [
    { nombre: "Hoy", periodo: { desde: inicioHoy, hasta: ahora } },
    { nombre: "Ayer", periodo: { desde: ayer.desde.getTime(), hasta: ayer.hasta.getTime() } },
    { nombre: "Últimos 7 días", periodo: { desde: ventanaDelDia(addDaysIso(hoy, -6), ZONA).desde.getTime(), hasta: ahora } },
    { nombre: "Este mes", periodo: { desde: instanteZonificado(`${hoy.slice(0, 8)}01`, 0, ZONA).getTime(), hasta: ahora } },
  ];
}

/** Las flechas ‹ ›: mueven el tamaño de la ventana vigente, no «un día». */
export function mover(p: Periodo, sentido: -1 | 1): Periodo {
  const ancho = p.hasta - p.desde + 1;
  return { desde: p.desde + sentido * ancho, hasta: p.hasta + sentido * ancho };
}

/** Quitar el acote regresa al día completo que contiene el inicio. */
export function diaQueContiene(t: number): Periodo {
  const v = ventanaDelDia(diaDe(t), ZONA);
  return { desde: v.desde.getTime(), hasta: v.hasta.getTime() };
}

/** Un día y una hora del panel («2026-09-14», «06:00»), en la zona, a instante. */
export function instanteDelPanel(fecha: string, hora: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, m] = hora.split(":").map(Number);
  return instanteZonificado(fecha, h! * 60 + m!, ZONA).getTime();
}

export function panelDe(t: number): { fecha: string; hora: string } {
  return { fecha: diaDe(t), hora: hhmm(t) };
}

/** La brocha: fracciones de un pedazo a periodo, o `null` si no alcanza para acotar. */
export function acotar(pedazo: Pedazo, a: number, b: number): Periodo | null {
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(1, Math.max(a, b));
  const desde = Math.floor((pedazo.t0 + lo * (pedazo.t1 - pedazo.t0)) / SEGUNDO) * SEGUNDO;
  const hasta = Math.ceil((pedazo.t0 + hi * (pedazo.t1 - pedazo.t0)) / SEGUNDO) * SEGUNDO;
  return hasta - desde > 20 * SEGUNDO ? { desde, hasta } : null;
}

/** ¿La ventana llega hasta el ahora? Un minuto de holgura con la lectura. */
export function incluyeAhora(p: Periodo, leida: number): boolean {
  return p.hasta >= leida - MINUTO && p.desde <= leida;
}

/** La dirección de la pantalla, con la ventana y la cuenta. */
export function rutaDelRecorrido(unitId: string, p: Periodo, cuenta: string | null): string {
  const q = `desde=${encodeURIComponent(new Date(p.desde).toISOString())}&hasta=${encodeURIComponent(new Date(p.hasta).toISOString())}`;
  return conCuenta(`${rutas.unidad(unitId)}/recorrido?${q}`, cuenta);
}

/**
 * La forma de lo que sirve el recorrido. **Súbela cada vez que cambie qué se
 * dibuja o qué campos llegan.**
 *
 * La respuesta de una ventana cerrada se guarda un año en el navegador, y la
 * llave es la dirección (regla 10). Sin este número, quien vio un periodo
 * antes del cambio lo seguiría viendo como era — para siempre, porque «para
 * siempre» es justo lo que promete la caché. Pasó el 18 sep 2026: los saltos
 * del GPS empezaron a partir la traza, y lo congelado antes traía la recta de
 * 10 km y ningún campo `saltos`. El servidor no lo lee; sólo cambia la llave.
 *
 *   1 · C3 (16 sep 2026)
 *   2 · los saltos del GPS parten la traza y se declaran (18 sep 2026)
 */
export const FORMA_DEL_RECORRIDO = 2;

/**
 * La petición al endpoint. **El grado va escrito**, calculado aquí: así la
 * respuesta de una ventana cerrada puede guardarse para siempre (regla 10).
 */
export function peticionDelRecorrido(slug: string, unitId: string, p: Periodo): string {
  const ventana = { desde: new Date(p.desde), hasta: new Date(p.hasta) };
  const q = new URLSearchParams({
    account: slug,
    unidad: unitId,
    desde: ventana.desde.toISOString(),
    hasta: ventana.hasta.toISOString(),
    grado: String(gradoParaVentana(ventana)),
    forma: String(FORMA_DEL_RECORRIDO),
  });
  return `/api/casa/recorrido?${q}`;
}

/** Lee la ventana de la dirección; si no viene o no sirve, es «Hoy». */
export function periodoDeLaDireccion(desde: string | undefined, hasta: string | undefined, ahora: number): Periodo {
  const a = desde ? Date.parse(desde) : Number.NaN;
  const z = hasta ? Date.parse(hasta) : Number.NaN;
  if (Number.isFinite(a) && Number.isFinite(z) && z > a) return { desde: a, hasta: z };
  return atajosDeTiempo(ahora)[0]!.periodo;
}

/* ─── Cómo se dice ──────────────────────────────────────────────────────── */

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const partes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const SEMANA_EN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function leer(t: number) {
  const p = Object.fromEntries(partes.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return {
    dia: Number(p.day),
    mes: Number(p.month),
    semana: SEMANA_EN[p.weekday!]!,
    hh: p.hour!,
    mm: p.minute!,
    ss: p.second!,
  };
}

export const hhmm = (t: number) => {
  const p = leer(t);
  return `${p.hh}:${p.mm}`;
};
export const hhmmss = (t: number) => {
  const p = leer(t);
  return `${p.hh}:${p.mm}:${p.ss}`;
};
/** «dom 14 sep» */
export const diaCorto = (t: number) => {
  const p = leer(t);
  return `${DIAS[p.semana]} ${p.dia} ${MESES[p.mes - 1]}`;
};
/** «sáb 14 sep 10:18:30» */
export const sello = (t: number) => `${diaCorto(t)} ${hhmmss(t)}`;

/** «41:40», «2 h 05 min», «12 s» — como lectura de instrumento, sin «~». */
export function duracion(ms: number): string {
  const s = Math.round(ms / SEGUNDO);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const g = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m}:${String(g).padStart(2, "0")}`;
  return `${g} s`;
}

/** Cómo se nombra el periodo en su botón. */
export function etiquetaDelPeriodo(p: Periodo, leida: number): string {
  const mismoDia = diaDe(p.desde) === diaDe(p.hasta);
  const hastaAhora = Math.abs(p.hasta - leida) <= MINUTO;
  const desdeMedianoche = hhmm(p.desde) === "00:00";
  if (mismoDia && hastaAhora && desdeMedianoche) return `${diaCorto(p.desde)} · hasta ahora`;
  if (mismoDia && desdeMedianoche && p.hasta - p.desde >= 24 * 60 * MINUTO - 2 * MINUTO) {
    return `${diaCorto(p.desde)} · todo el día`;
  }
  if (mismoDia) return `${diaCorto(p.desde)} · ${hhmm(p.desde)}–${hhmm(p.hasta)}`;
  return `${diaCorto(p.desde)} ${hhmm(p.desde)} → ${diaCorto(p.hasta)} ${hhmm(p.hasta)}${hastaAhora ? " (ahora)" : ""}`;
}

/* ─── El playback ───────────────────────────────────────────────────────── */

/** Cualquier ventana se reproduce en unos 90 s de tiempo medido. */
export const SEGUNDOS_DE_PLAYBACK = 90;
export const VELOCIDADES_MANUALES = [30, 60, 180, 600] as const;

/** El tiempo que el playback recorre: sólo lo medido. Los huecos son altos, no se comprimen. */
export const tiempoConSenal = (pedazos: Pedazo[]) => pedazos.reduce((n, p) => n + (p.t1 - p.t0), 0);

export function velocidadAuto(pedazos: Pedazo[]): number {
  return Math.max(1, Math.round(tiempoConSenal(pedazos) / SEGUNDO / SEGUNDOS_DE_PLAYBACK));
}

/** Tocar el botón: auto → ×30 → ×60 → ×180 → ×600 → auto. `null` es auto. */
export function siguienteVelocidad(manual: number | null): number | null {
  if (manual === null) return VELOCIDADES_MANUALES[0];
  const i = VELOCIDADES_MANUALES.indexOf(manual as (typeof VELOCIDADES_MANUALES)[number]);
  return i >= 0 && i + 1 < VELOCIDADES_MANUALES.length ? VELOCIDADES_MANUALES[i + 1]! : null;
}

/** Rumbo de `a` a `b` en grados: 0 = norte, creciendo al este. */
export function rumbo(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const grados = (Math.atan2((b.lng - a.lng) * k, b.lat - a.lat) * 180) / Math.PI;
  return (grados + 360) % 360;
}

/** El último índice cuyo tiempo es ≤ t. */
function indiceEn(puntos: Punto[], t: number): number {
  let lo = 0;
  let hi = puntos.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (puntos[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type Posicion = { lat: number; lng: number; v: number; rumbo: number; indice: number };

/**
 * Dónde va el marcador en el instante `t` dentro de un pedazo.
 *
 * Entre dos puntos del **mismo tramo** se interpola —ahí no hay hueco: están a
 * menos de 15 min y así se dibuja la línea—. Nunca se interpola entre pedazos.
 */
export function posicionEn(pedazo: Pedazo, t: number): Posicion {
  const p = pedazo.puntos;
  const tt = Math.min(Math.max(t, pedazo.t0), pedazo.t1);
  const i = indiceEn(p, tt);
  const a = p[i]!;
  const b = p[Math.min(i + 1, p.length - 1)]!;
  const f = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
  const previo = p[Math.max(0, i - 1)]!;
  return {
    lat: a.lat + f * (b.lat - a.lat),
    lng: a.lng + f * (b.lng - a.lng),
    v: a.v + f * (b.v - a.v),
    rumbo: a === b ? rumbo(previo, a) : rumbo(a, b),
    indice: i,
  };
}

/** Los puntos ya recorridos de un pedazo en el instante `t`: la línea «hecha». */
export function recorridoHasta(pedazo: Pedazo, t: number): Array<[number, number]> {
  if (t <= pedazo.t0) return [];
  const pos = posicionEn(pedazo, t);
  const hechos = pedazo.puntos.slice(0, pos.indice + 1).map((q) => [q.lat, q.lng] as [number, number]);
  if (t < pedazo.t1) hechos.push([pos.lat, pos.lng]);
  return hechos;
}

/* ─── La ventana vacía (regla 11) ───────────────────────────────────────── */

export type AsignacionDeLaUnidad = {
  deviceId: string;
  etiqueta: string;
  desde: number;
  hasta: number | null;
  /** El último punto que ha dado ese dispositivo, en cualquier unidad; `null` si nunca. */
  ultimoPunto: number | null;
};

/**
 * Qué se puede decir de una ventana sin puntos. **Ninguna de las tres
 * respuestas afirma que la unidad trabajó o no trabajó**: dicen qué se pudo
 * medir y qué no (Pieza 1 §D).
 */
export type Vacio =
  | { tipo: "sin_dispositivo" }
  | { tipo: "no_reporto"; dispositivos: AsignacionDeLaUnidad[] }
  | { tipo: "reporto_fuera"; dispositivos: AsignacionDeLaUnidad[] };

export function vacioDe(p: Periodo, asignaciones: AsignacionDeLaUnidad[]): Vacio {
  const enLaVentana = asignaciones.filter((a) => a.desde <= p.hasta && (a.hasta === null || a.hasta > p.desde));
  if (enLaVentana.length === 0) return { tipo: "sin_dispositivo" };
  const fuera = enLaVentana.filter((a) => a.ultimoPunto !== null && (a.ultimoPunto < p.desde || a.ultimoPunto > p.hasta));
  return fuera.length > 0 ? { tipo: "reporto_fuera", dispositivos: fuera } : { tipo: "no_reporto", dispositivos: enLaVentana };
}
