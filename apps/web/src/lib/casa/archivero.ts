import type { CuartoDeExpedientes, DispositivoDelCuarto, UnidadDelCuarto } from "@jtel/services";
import type { EstadoGlifo } from "@/components/casa/glifo";
import { conCuenta } from "@/lib/casa/casas";
import { rutasDeDispositivos, senalViva } from "@/lib/casa/dispositivos";
import { RAIZ_EXPEDIENTES, datoDeResumen, edad, glifoDeDispositivo, glifoDePapel, rutas } from "@/lib/casa/expedientes";
import { normalizar } from "@/lib/casa/servicios-especiales";

/**
 * El archivero de Expedientes — todo lo que la puerta decide, sin DOM.
 *
 * Gobierna `docs/Ficha-Construccion-Expedientes-V2-Archivero.md` con sus
 * enmiendas del 19-sep. El expediente no cambia; esto es la puerta: el tablero
 * (buscador, «Piden atención», las tarjetas de los cajones) y el cajón (chips,
 * buscador propio, secciones).
 *
 * El servidor arma las piezas ya en palabras (`armarArchivero`) y la pantalla
 * sólo filtra. Así la pieza dice lo mismo en el tablero, en la búsqueda y en su
 * cajón, y todo lo que se decide aquí se prueba sin navegador.
 *
 * **La ley de coherencia** (la de Vernier, ficha §3): los chips cuentan lo que
 * la lista muestra con la búsqueda aplicada, **sin** su propio filtro. Por eso
 * los conteos y la lista salen de la misma base (`laBase`).
 */

export type Cajon = "unidades" | "dispositivos" | "choferes";

export const CAJONES: readonly Cajon[] = ["unidades", "dispositivos", "choferes"];

/**
 * La clase de una unidad en el archivero (enmienda 1). «Al día» sólo se dice de
 * lo que se juzgó: lo que no se pudo juzgar va a `sin_juzgar`, con su causa.
 */
export type ClaseDeUnidad = "piden" | "sin_juzgar" | "al_dia" | "inactiva";

/** Por qué una unidad está sin juzgar. Cada causa se dice en una línea. */
export type CausaSinJuzgar = "sin_regla" | "sin_catalogo" | "sin_mercado";

/** Los cuatro grupos del inventario (Marco 6.6; enmienda 3). No se enciman. */
export type ClaseDeDispositivo = "desconectado" | "en_bodega" | "en_unidad" | "de_baja";

export type ClaseDeChofer = "activo" | "de_baja";

/** Una pieza ya en palabras. Plana: cruza del servidor al navegador tal cual. */
export interface PiezaDelArchivero {
  id: string;
  cajon: Cajon;
  clase: ClaseDeUnidad | ClaseDeDispositivo | ClaseDeChofer;
  /** Entra a «Piden atención» del tablero. */
  pideAtencion: boolean;
  /** Fuera de servicio: inactiva o de baja. Va plegada al final, fuera de los chips. */
  plegada: boolean;
  causa: CausaSinJuzgar | null;
  glifo: EstadoGlifo | null;
  nombre: string;
  apoyo: string;
  dato: string;
  etiqueta: string;
  datoVivo: boolean;
  apagada: boolean;
  ficha: string | null;
  /** Dónde busca el buscador, ya normalizado. */
  pajar: string;
}

export type Archivero = Record<Cajon, PiezaDelArchivero[]>;

// ── Rutas ────────────────────────────────────────────────────────────────

export const RAIZ_CAJON: Record<Cajon, string> = {
  unidades: `${RAIZ_EXPEDIENTES}/unidades`,
  dispositivos: `${RAIZ_EXPEDIENTES}/dispositivos`,
  choferes: `${RAIZ_EXPEDIENTES}/choferes`,
};

export function rutaDelCajon(cajon: Cajon, cuenta?: string | null): string {
  return conCuenta(RAIZ_CAJON[cajon], cuenta);
}

// ── Unidades ─────────────────────────────────────────────────────────────

export function claseDeUnidad(u: Pick<UnidadDelCuarto, "activa" | "papeles">): { clase: ClaseDeUnidad; causa: CausaSinJuzgar | null } {
  if (!u.activa) return { clase: "inactiva", causa: null };
  if (u.papeles.estado === "aun_no_disponible") return { clase: "sin_juzgar", causa: "sin_mercado" };
  if (u.papeles.estado === "vacia") return { clase: "sin_juzgar", causa: "sin_catalogo" };
  const r = u.papeles.valor;
  // Lo que pide algo gana aunque otro papel no tenga regla: ya hay algo que hacer.
  if (r.pidenAlgo > 0) return { clase: "piden", causa: null };
  if (r.estaAlDia) return { clase: "al_dia", causa: null };
  return { clase: "sin_juzgar", causa: "sin_regla" };
}

/** La línea que explica una causa (Asav: sin causa, «Sin juzgar» parece limbo). */
export function lineaDeCausa(causa: CausaSinJuzgar, mercado: string | null): string {
  switch (causa) {
    case "sin_regla":
      return `Sin regla cargada para su mercado${mercado ? ` (${mercado})` : ""}: hasta que el catálogo la tenga, sus papeles no se declaran al día ni faltantes.`;
    case "sin_catalogo":
      return "El catálogo de su mercado no tiene papeles de unidad: no hay contra qué juzgarlas.";
    case "sin_mercado":
      return "La cuenta no tiene mercado: sin catálogo, sus papeles no se pueden juzgar.";
  }
}

const ETIQUETA_DE_CAUSA: Record<CausaSinJuzgar, string> = {
  sin_regla: "sin regla",
  sin_catalogo: "sin papeles",
  sin_mercado: "sin mercado",
};

export function piezaDeUnidad(u: UnidadDelCuarto, cuentaEnRuta: string | null): PiezaDelArchivero {
  const { clase, causa } = claseDeUnidad(u);
  const r = u.papeles.estado === "con_datos" ? u.papeles.valor : null;
  // El dato: cuántos papeles piden algo, o por qué no se sabe.
  const { dato, etiqueta } =
    clase === "inactiva"
      ? { dato: "—", etiqueta: "inactiva" }
      : causa
        ? { dato: "—", etiqueta: ETIQUETA_DE_CAUSA[causa] }
        : datoDeResumen(r!);
  return {
    id: u.id,
    cajon: "unidades",
    clase,
    pideAtencion: clase === "piden",
    plegada: clase === "inactiva",
    causa,
    // La hoja de su peor papel (enmienda 4: el skill manda). Sin papeles que
    // juzgar, la hoja de «falta la regla», como el cuarto de antes.
    glifo: (r?.peor && glifoDePapel(r.peor)) || "papel-falta-la-regla",
    nombre: u.numeroEconomico,
    apoyo: u.placa ?? "sin placa",
    dato,
    etiqueta,
    datoVivo: false,
    apagada: clase === "al_dia" || clase === "inactiva",
    ficha: rutas.unidad(u.id, cuentaEnRuta),
    pajar: normalizar([u.numeroEconomico, u.placa ?? "", u.vin ?? ""].join(" ")),
  };
}

// ── Dispositivos ─────────────────────────────────────────────────────────

/**
 * ¿Pide atención? El desconectado, y el de bodega que **nunca reportó**
 * (enmienda 3): lo que lo distingue no es el silencio —en bodega todos callan—
 * sino no haber dicho nunca una palabra. El recién dado de alta que nadie ha
 * prendido también entra: se compró y nadie lo ha probado.
 */
export function dispositivoPideAtencion(d: Pick<DispositivoDelCuarto, "estado">): boolean {
  if (d.estado.grupo === "desconectado") return true;
  return d.estado.grupo === "en_bodega" && d.estado.ultimaSenalAt === null;
}

export function piezaDeDispositivo(d: DispositivoDelCuarto, ahora: Date, cuentaEnRuta: string | null): PiezaDelArchivero {
  const { glifo } = glifoDeDispositivo(d.estado);
  const clase = d.estado.grupo;
  const pide = dispositivoPideAtencion(d);
  const senal = d.estado.ultimaSenalAt;
  return {
    id: d.id,
    cajon: "dispositivos",
    clase,
    pideAtencion: pide,
    plegada: clase === "de_baja",
    causa: null,
    glifo,
    nombre: d.nombre ?? d.imei,
    apoyo: d.estado.grupo === "de_baja" ? (d.estado.retiredReason ?? "sin motivo") : d.unidad ? `en ${d.unidad}` : "en bodega",
    dato: senal ? edad(senal, ahora) : "—",
    etiqueta: senal ? "última señal" : "nunca reportó",
    datoVivo: senalViva(d.estado, ahora),
    // Pide algo o no: el cuadro ya dice el grupo; lo que no pide nada suelta el peso.
    apagada: !pide,
    ficha: rutasDeDispositivos.ver(d.id, cuentaEnRuta, { desde: "dispositivos" }),
    // Se busca por la palabra de su grupo, no por la falta de unidad: un
    // dispositivo de baja tampoco tiene unidad, y no está en bodega.
    pajar: normalizar([d.nombre ?? "", d.imei, d.unidad ? `unidad ${d.unidad}` : "", glifoDeDispositivo(d.estado).palabra].join(" ")),
  };
}

// ── Choferes ─────────────────────────────────────────────────────────────

type ChoferDelCuarto = Extract<CuartoDeExpedientes["choferes"], { estado: "con_datos" }>["valor"][number];

/**
 * Sin glifo y sin ficha: el cuarto no juzga sus papeles todavía y Ver ‹chofer›
 * no existe (llegan con el PR E). Una forma aquí afirmaría un estado que nadie
 * midió; una liga, una puerta que no lleva a ningún lado.
 */
export function piezaDeChofer(c: ChoferDelCuarto): PiezaDelArchivero {
  return {
    id: c.id,
    cajon: "choferes",
    clase: c.activo ? "activo" : "de_baja",
    pideAtencion: false,
    plegada: !c.activo,
    causa: null,
    glifo: null,
    nombre: c.nombre ?? "Credenciales purgadas",
    apoyo: c.licencia ?? "sin licencia",
    dato: "—",
    etiqueta: c.activo ? "sin juzgar" : "de baja",
    datoVivo: false,
    apagada: !c.activo,
    ficha: null,
    pajar: normalizar([c.nombre ?? "", c.licencia ?? ""].join(" ")),
  };
}

// ── El archivero entero ──────────────────────────────────────────────────

export function armarArchivero(cuarto: CuartoDeExpedientes, ahora: Date, cuentaEnRuta: string | null): Archivero {
  return {
    unidades: cuarto.unidades.map((u) => piezaDeUnidad(u, cuentaEnRuta)),
    dispositivos: [...cuarto.dispositivos.enServicio, ...cuarto.dispositivos.deBaja].map((d) => piezaDeDispositivo(d, ahora, cuentaEnRuta)),
    choferes: cuarto.choferes.estado === "con_datos" ? cuarto.choferes.valor.map(piezaDeChofer) : [],
  };
}

// ── Buscar ───────────────────────────────────────────────────────────────

/** «Todas las palabras», como en Vernier: cada término tecleado tiene que aparecer. */
export function pasaBusqueda(p: Pick<PiezaDelArchivero, "pajar">, q: string): boolean {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean);
  return terminos.every((t) => p.pajar.includes(t));
}

export function hayBusqueda(q: string): boolean {
  return normalizar(q).trim().length > 0;
}

/** El buscador del tablero: atraviesa los tres cajones y agrupa por cajón. */
export function buscarEnTodo(a: Archivero, q: string): Archivero {
  return {
    unidades: a.unidades.filter((p) => pasaBusqueda(p, q)),
    dispositivos: a.dispositivos.filter((p) => pasaBusqueda(p, q)),
    choferes: a.choferes.filter((p) => pasaBusqueda(p, q)),
  };
}

// ── El tablero ───────────────────────────────────────────────────────────

/** «Piden atención»: la bandeja del día, de todos los tipos juntos. */
export function piezasQuePidenAtencion(a: Archivero): PiezaDelArchivero[] {
  return [...a.unidades, ...a.dispositivos, ...a.choferes].filter((p) => p.pideAtencion);
}

export interface TarjetaDeCajon {
  cajon: Cajon;
  nombre: string;
  /** Lo que está en servicio. Lo inactivo o de baja vive plegado en el cajón. */
  cifra: number;
  /** Lo que pide algo, en negritas; `null` si nada. */
  piden: string | null;
  /** El resto, en partes que suman la cifra; vacío dice que el cajón está vacío. */
  partes: string[];
  vacio: string | null;
}

const NOMBRE_DEL_CAJON: Record<Cajon, string> = { unidades: "Unidades", dispositivos: "Dispositivos", choferes: "Choferes" };

export function nombreDelCajon(cajon: Cajon): string {
  return NOMBRE_DEL_CAJON[cajon];
}

const cuantas = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * La tarjeta de un cajón. Las partes suman la cifra: una línea que dijera
 * «2 sin señal · 3 en unidad · 4 en bodega» de 7 dispositivos sumaría 9 (Marco
 * §D, el dato correcto que miente por cómo se agrupa). En unidades «piden algo»
 * es una parte de la suma; en dispositivos va aparte, porque atraviesa grupos
 * (el que nunca reportó sigue en bodega).
 */
export function tarjetaDeCajon(cajon: Cajon, piezas: PiezaDelArchivero[]): TarjetaDeCajon {
  const enServicio = piezas.filter((p) => !p.plegada);
  const n = (clase: PiezaDelArchivero["clase"]) => enServicio.filter((p) => p.clase === clase).length;
  const piden = enServicio.filter((p) => p.pideAtencion).length;
  const base = { cajon, nombre: NOMBRE_DEL_CAJON[cajon], cifra: enServicio.length };
  if (enServicio.length === 0) {
    const vacio = {
      unidades: "Sin unidades dadas de alta",
      dispositivos: "Sin dispositivos en servicio",
      choferes: "Sin choferes dados de alta",
    }[cajon];
    return { ...base, piden: null, partes: [], vacio };
  }
  if (cajon === "unidades") {
    return {
      ...base,
      piden: piden > 0 ? `${piden} ${piden === 1 ? "pide algo" : "piden algo"}` : null,
      partes: [
        n("sin_juzgar") > 0 ? `${n("sin_juzgar")} sin juzgar` : null,
        n("al_dia") > 0 ? `${n("al_dia")} al día` : null,
      ].filter((x): x is string => x !== null),
      vacio: null,
    };
  }
  if (cajon === "dispositivos") {
    return {
      ...base,
      piden: piden > 0 ? `${piden} ${piden === 1 ? "pide algo" : "piden algo"}` : null,
      partes: [
        n("en_unidad") > 0 ? `${n("en_unidad")} en unidad` : null,
        n("en_bodega") > 0 ? `${n("en_bodega")} en bodega` : null,
        n("desconectado") > 0 ? cuantas(n("desconectado"), "desconectado", "desconectados") : null,
      ].filter((x): x is string => x !== null),
      vacio: null,
    };
  }
  return { ...base, piden: null, partes: [cuantas(enServicio.length, "activo", "activos")], vacio: null };
}

// ── El cajón ─────────────────────────────────────────────────────────────

export interface Chip {
  clave: string;
  nombre: string;
  pasa: (p: PiezaDelArchivero) => boolean;
}

const TODAS = (p: PiezaDelArchivero) => !p.plegada;
const DE_CLASE = (clase: PiezaDelArchivero["clase"]) => (p: PiezaDelArchivero) => p.clase === clase;

/** Los chips de cada cajón (ficha §3 con las enmiendas 1 y 3). Choferes no lleva. */
export const CHIPS: Record<Cajon, Chip[]> = {
  unidades: [
    { clave: "todas", nombre: "Todas", pasa: TODAS },
    { clave: "piden", nombre: "Piden algo", pasa: DE_CLASE("piden") },
    { clave: "sin_juzgar", nombre: "Sin juzgar", pasa: DE_CLASE("sin_juzgar") },
    { clave: "al_dia", nombre: "Al día", pasa: DE_CLASE("al_dia") },
  ],
  dispositivos: [
    { clave: "todos", nombre: "Todos", pasa: TODAS },
    { clave: "desconectado", nombre: "Desconectados", pasa: DE_CLASE("desconectado") },
    { clave: "en_unidad", nombre: "En unidad", pasa: DE_CLASE("en_unidad") },
    { clave: "en_bodega", nombre: "En bodega", pasa: DE_CLASE("en_bodega") },
  ],
  choferes: [],
};

/** La base: lo que el buscador del cajón deja pasar. De aquí salen los conteos y la lista. */
export function laBase(piezas: PiezaDelArchivero[], q: string): PiezaDelArchivero[] {
  return piezas.filter((p) => pasaBusqueda(p, q));
}

export function conteosDeChips(cajon: Cajon, base: PiezaDelArchivero[]): Record<string, number> {
  return Object.fromEntries(CHIPS[cajon].map((c) => [c.clave, base.filter(c.pasa).length]));
}

export interface Seccion {
  clave: string;
  titulo: string;
  piezas: PiezaDelArchivero[];
  /** Las líneas que explican la sección (las causas de «Sin juzgar»). */
  explicacion: string[];
}

const SECCIONES: Record<Cajon, Array<{ clave: string; titulo: string; pasa: (p: PiezaDelArchivero) => boolean }>> = {
  unidades: [
    { clave: "piden", titulo: "Piden algo", pasa: DE_CLASE("piden") },
    { clave: "sin_juzgar", titulo: "Sin juzgar", pasa: DE_CLASE("sin_juzgar") },
    { clave: "al_dia", titulo: "Al día", pasa: DE_CLASE("al_dia") },
  ],
  // Las secciones son los grupos del inventario, igual que los chips: el conteo
  // de un chip y el de su sección no pueden decir cosas distintas. Lo que pide
  // algo sube por el orden (desconectados primero) y, dentro de bodega, el que
  // nunca reportó va arriba y sin apagar.
  dispositivos: [
    { clave: "desconectado", titulo: "Desconectados", pasa: DE_CLASE("desconectado") },
    { clave: "en_bodega", titulo: "En bodega", pasa: DE_CLASE("en_bodega") },
    { clave: "en_unidad", titulo: "En unidad", pasa: DE_CLASE("en_unidad") },
  ],
  choferes: [{ clave: "activos", titulo: "Choferes", pasa: DE_CLASE("activo") }],
};

/** Lo plegado al final: fuera de los chips, con su propia cuenta. */
export const PLEGADAS: Record<Cajon, string> = { unidades: "Inactivas", dispositivos: "De baja", choferes: "De baja" };

/**
 * Las secciones de un cajón con el chip aplicado. Una sección sin piezas no se
 * dibuja: el chip ya dijo cuántas hay, y un encabezado en cero debajo es ruido.
 */
export function seccionesDelCajon(
  cajon: Cajon,
  base: PiezaDelArchivero[],
  chip: string,
  mercado: string | null,
): { secciones: Seccion[]; plegadas: PiezaDelArchivero[] } {
  const filtro = CHIPS[cajon].find((c) => c.clave === chip) ?? CHIPS[cajon][0];
  const visibles = filtro ? base.filter(filtro.pasa) : base.filter(TODAS);
  const secciones = SECCIONES[cajon]
    .map(({ clave, titulo, pasa }) => {
      const piezas = visibles.filter(pasa);
      if (cajon === "dispositivos" && clave === "en_bodega") {
        // El que nunca reportó arriba; el orden de lo demás se respeta.
        piezas.sort((a, b) => Number(b.pideAtencion) - Number(a.pideAtencion));
      }
      const causas = [...new Set(piezas.map((p) => p.causa).filter((c): c is CausaSinJuzgar => c !== null))];
      return { clave, titulo, piezas, explicacion: causas.map((c) => lineaDeCausa(c, mercado)) };
    })
    .filter((s) => s.piezas.length > 0);
  // Lo plegado sólo acompaña a «Todas»: con un chip elegido, se está mirando otra cosa.
  const esTodas = !filtro || filtro.pasa === TODAS;
  return { secciones, plegadas: esTodas ? base.filter((p) => p.plegada) : [] };
}

/**
 * A dónde manda la dirección vieja de Dispositivos (ficha V2 §4): al cajón, con
 * la misma dirección de parámetros. Nada se pierde en el camino.
 */
export function destinoDeLaDireccionVieja(params: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    for (const valor of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, valor);
  }
  const s = q.toString();
  return s ? `${RAIZ_CAJON.dispositivos}?${s}` : RAIZ_CAJON.dispositivos;
}
