import { NOMBRE_DEL_VEREDICTO, PALABRA_DEL_TIMING, type Veredicto } from "@jtel/domain";
import type { OcurrenciaDeLaLista } from "@jtel/services";
import { conCuenta } from "@/lib/casa/casas";
import type { Periodo } from "@/lib/casa/periodo";

/**
 * Servicios especiales (Vernier V1) — todo lo que la lista decide, sin DOM.
 *
 * La lista llega del servidor ya acotada a la ventana. Lo de aquí son lentes
 * sobre esa lista —contrato, turno, búsqueda, veredicto— y cómo se agrupa.
 * Nada de esto juzga: el veredicto, el timing y el motivo vienen sellados.
 *
 * **La ley de coherencia (ficha §2):** los conteos cuentan exactamente lo que
 * la lista muestra —ventana, contrato, turno y búsqueda— **sin** aplicar el
 * propio filtro de veredicto. Un número arriba que no cuadre con las piezas
 * abajo es un defecto. Por eso los dos salen de la misma función
 * (`loQueSeCuenta`) y la lista es sólo esa misma base con el chip de veredicto
 * encima.
 *
 * No es el agregado del periodo del Marco §D.3: aquél afirma la verdad del
 * periodo entero y por eso no se deja filtrar. Esta franja afirma otra cosa —
 * cuántas piezas hay debajo con cada sello— y se rotula así: `‹N› servicios`
 * justo encima de las piezas que cuenta.
 */

export type Filtros = {
  contratoId: string | null;
  turnoId: string | null;
  q: string;
  veredicto: Veredicto | null;
};

export const SIN_FILTROS: Filtros = { contratoId: null, turnoId: null, q: "", veredicto: null };

export const VEREDICTOS: Veredicto[] = ["cumplido", "pendiente_evidencia", "no_cumplido"];

/** La palabra de cada chip de conteo, en el número que pide la cifra: «1 cumplido», «4 cumplidos». */
export function palabraDelConteo(v: Veredicto, n: number): string {
  if (v === "pendiente_evidencia") return "pendiente de evidencia";
  const palabra = v === "cumplido" ? "cumplido" : "no cumplido";
  return n === 1 ? palabra : `${palabra}s`;
}

/** Minúsculas y sin acentos: «Mié» y «mie» son la misma búsqueda. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «jue 17 sep» de una fecha civil. No depende de la zona: la fecha ya es civil. */
export function fechaCorta(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** «jueves 17 de septiembre de 2026». */
export function fechaLarga(fechaIso: string): string {
  const d = new Date(`${fechaIso}T12:00:00Z`);
  const mes = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(d);
  return `${DIAS_LARGOS[d.getUTCDay()]} ${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}`;
}

/**
 * Dónde busca el buscador: ruta, unidad, turno, fecha, contrato y veredicto
 * (ficha §2). El motivo corto va también: es lo que la pieza dice.
 */
export function pajarDe(o: OcurrenciaDeLaLista): string {
  return normalizar(
    [
      o.ruta,
      o.unidadObservada ? `unidad ${o.unidadObservada}` : "sin unidad observada",
      o.turno.nombre,
      o.fecha,
      fechaCorta(o.fecha),
      fechaLarga(o.fecha),
      o.contrato.nombre,
      NOMBRE_DEL_VEREDICTO[o.veredicto],
      o.timing ? PALABRA_DEL_TIMING[o.timing] : "",
      o.motivo.corto,
    ].join(" "),
  );
}

/** «Todas las palabras»: cada término tecleado tiene que aparecer. */
export function pasaBusqueda(o: OcurrenciaDeLaLista, q: string): boolean {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean);
  if (terminos.length === 0) return true;
  const pajar = pajarDe(o);
  return terminos.every((t) => pajar.includes(t));
}

/**
 * La base: lo que la lista muestra **antes** del chip de veredicto. De aquí
 * salen los conteos y de aquí sale la lista.
 */
export function loQueSeCuenta(ocurrencias: OcurrenciaDeLaLista[], f: Filtros): OcurrenciaDeLaLista[] {
  return ocurrencias.filter(
    (o) =>
      (!f.contratoId || o.contrato.id === f.contratoId) &&
      (!f.turnoId || o.turno.id === f.turnoId) &&
      pasaBusqueda(o, f.q),
  );
}

export type Conteos = { total: number } & Record<Veredicto, number>;

export function conteos(base: OcurrenciaDeLaLista[]): Conteos {
  const c: Conteos = { total: base.length, cumplido: 0, pendiente_evidencia: 0, no_cumplido: 0 };
  for (const o of base) c[o.veredicto] += 1;
  return c;
}

/** La lista: la misma base con el chip de veredicto encima. */
export function laLista(base: OcurrenciaDeLaLista[], veredicto: Veredicto | null): OcurrenciaDeLaLista[] {
  return veredicto ? base.filter((o) => o.veredicto === veredicto) : base;
}

/* ─── Los chips de turno ───────────────────────────────────────────────── */

export type ChipDeTurno = { id: string; nombre: string; ventana: string; orden: number };

const ventanaEnPalabras = (v: OcurrenciaDeLaLista["ventana"]) =>
  v.hasta === null ? `${v.desde} · tolerancia no registrada` : `${v.desde}–${v.hasta}`;

/** Minutos del día de la llegada exigida, para ordenar T1 → T2 → T3 aunque vengan de días distintos. */
const minutoDelDia = (v: OcurrenciaDeLaLista["ventana"]) => {
  const [h, m] = v.desde.split(":").map(Number);
  return h! * 60 + m!;
};

/**
 * Los turnos que hay en la ventana (con el contrato elegido), con su ventana
 * de llegada. Salen de las ocurrencias, no de una lista fija: un turno de otra
 * cuenta o de otro número de turnos se ve igual. Si el mismo turno trae
 * ventanas distintas en la ventana elegida —cambió su hora, o dos contratos lo
 * comparten con distinta tolerancia—, el chip lo dice en vez de elegir una.
 */
export function turnosDeLaVentana(ocurrencias: OcurrenciaDeLaLista[], contratoId: string | null): ChipDeTurno[] {
  const porTurno = new Map<string, { nombre: string; contrato: string; ventanas: Set<string>; orden: number }>();
  for (const o of ocurrencias) {
    if (contratoId && o.contrato.id !== contratoId) continue;
    const t = porTurno.get(o.turno.id) ?? {
      nombre: o.turno.nombre,
      contrato: o.contrato.nombre,
      ventanas: new Set<string>(),
      orden: Infinity,
    };
    t.ventanas.add(ventanaEnPalabras(o.ventana));
    t.orden = Math.min(t.orden, minutoDelDia(o.ventana));
    porTurno.set(o.turno.id, t);
  }
  const nombres = [...porTurno.values()].map((t) => t.nombre);
  return [...porTurno.entries()]
    .map(([id, t]) => ({
      id,
      // Dos turnos con el mismo nombre (de dos clientes) no pueden verse iguales:
      // el contrato los separa.
      nombre: nombres.filter((n) => n === t.nombre).length > 1 ? `${t.nombre} · ${t.contrato}` : t.nombre,
      ventana: t.ventanas.size === 1 ? [...t.ventanas][0]! : "ventanas distintas",
      orden: t.orden,
    }))
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

/* ─── Los bloques ──────────────────────────────────────────────────────── */

export type Bloque = { clave: string; titulo: string; piezas: OcurrenciaDeLaLista[] };

/**
 * Bloques cronológicos: la fecha más reciente arriba; dentro de cada fecha, los
 * turnos en el orden en que ocurren. El riesgo **no** ordena la lista: el
 * triage se hace con los chips de conteo (ficha §2).
 *
 * El título es `‹DÍA FECHA› · ‹turno› · ‹ventana›`. Si la ventana es de un solo
 * día, omite la fecha — salvo que la ocurrencia sea de otra fecha civil (un
 * turno que cruza la medianoche): entonces la fecha va, porque callarla haría
 * pasar el turno de ayer por el de hoy.
 */
export function bloques(lista: OcurrenciaDeLaLista[], diaDeLaVentana: string | null): Bloque[] {
  // Dos turnos con el mismo nombre (de dos clientes) harían dos bloques con el
  // mismo título: el contrato los separa, igual que en sus chips.
  const idsPorNombre = new Map<string, Set<string>>();
  for (const o of lista) idsPorNombre.set(o.turno.nombre, (idsPorNombre.get(o.turno.nombre) ?? new Set()).add(o.turno.id));
  const nombreDelTurno = (o: OcurrenciaDeLaLista) =>
    (idsPorNombre.get(o.turno.nombre)?.size ?? 0) > 1 ? `${o.turno.nombre} · ${o.contrato.nombre}` : o.turno.nombre;

  const porClave = new Map<string, { fecha: string; turno: string; ventanas: Set<string>; primera: number; piezas: OcurrenciaDeLaLista[] }>();
  for (const o of lista) {
    const clave = `${o.fecha}|${o.turno.id}`;
    const b = porClave.get(clave) ?? { fecha: o.fecha, turno: nombreDelTurno(o), ventanas: new Set<string>(), primera: Infinity, piezas: [] };
    b.ventanas.add(ventanaEnPalabras(o.ventana));
    b.primera = Math.min(b.primera, Date.parse(o.llegadaExigida));
    b.piezas.push(o);
    porClave.set(clave, b);
  }
  return [...porClave.entries()]
    // Mismo día y misma hora (el mismo turno en dos contratos): desempata el
    // nombre del bloque, para que el orden no dependa de cómo llegaron las filas.
    .sort(([, a], [, b]) =>
      a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : a.primera - b.primera || a.turno.localeCompare(b.turno, "es"),
    )
    .map(([clave, b]) => {
      const ventana = b.ventanas.size === 1 ? [...b.ventanas][0]! : "ventanas distintas";
      const conFecha = diaDeLaVentana === null || b.fecha !== diaDeLaVentana;
      return {
        clave,
        titulo: [conFecha ? fechaCorta(b.fecha) : null, b.turno, ventana].filter(Boolean).join(" · "),
        piezas: [...b.piezas].sort((x, y) => Date.parse(x.llegadaExigida) - Date.parse(y.llegadaExigida) || x.ruta.localeCompare(y.ruta)),
      };
    });
}

/**
 * La fila de contratos sólo existe si la cuenta tiene más de uno (ficha §2).
 * Con uno solo no hay nada que elegir, y una fila de un chip es ruido.
 */
export function hayFilaDeContratos(contratos: Array<{ id: string }>): boolean {
  return contratos.length > 1;
}

/* ─── Las direcciones ──────────────────────────────────────────────────── */

export const CUARTO = "/casa/transportista/servicios-especiales";

/** El cuarto, con su ventana si se da. */
export function rutaDelCuarto(cuenta: string | null, p?: Periodo): string {
  if (!p) return conCuenta(CUARTO, cuenta);
  const q = `desde=${encodeURIComponent(new Date(p.desde).toISOString())}&hasta=${encodeURIComponent(new Date(p.hasta).toISOString())}`;
  return conCuenta(`${CUARTO}?${q}`, cuenta);
}

/** El acta de una ocurrencia. */
export function rutaDelActa(ocurrenciaId: string, cuenta: string | null): string {
  return conCuenta(`${CUARTO}/${ocurrenciaId}`, cuenta);
}

/** El glifo de cada veredicto: la cuarta familia de formas, el hexágono. */
export const GLIFO_DEL_VEREDICTO = {
  cumplido: "sello-cumplido",
  pendiente_evidencia: "sello-pendiente",
  no_cumplido: "sello-no-cumplido",
} as const satisfies Record<Veredicto, string>;
