import type { Repositories } from "@jtel/db";
import { pairLedgerEntryWithFact } from "@jtel/db";
import {
  JTTEL_TZ,
  SIN_LEDGER,
  huecosDeSenal,
  lecturaDePasos,
  motivoDelSello,
  ordenarPorTiempo,
  partirEnCortes,
  saltosDeGps,
  ventanaDeLlegada,
  type HechoParaLeer,
  type LecturaDelLedger,
  type MotivoDelSello,
  type TimingDelSello,
  type Veredicto,
} from "@jtel/domain";

/**
 * Vernier V1 — lo que el cuarto «Servicios especiales» y su acta leen
 * (`docs/Ficha-Construccion-Vernier-V1.md`).
 *
 * **Sólo lee lo sellado.** No importa el motor, no toca `VerificationService`,
 * no vuelve a pasar la evidencia por ninguna regla. Lo cuida
 * `servicios-especiales.test.ts` con un repositorio espía: cualquier método
 * fuera de las lecturas de `repos.vernier` revienta la prueba.
 *
 * Vocabulario del Marco (Pieza 1.A), el de la ficha §0: cada pieza de la lista
 * es una **ocurrencia**; su verdad guardada es el **hecho**; el contrato ya
 * concreto es el **perfil**.
 */

export type ReposDeVernier = Pick<Repositories, "vernier">;

/** Una ocurrencia sellada, lista para la pieza. Sin `Date`: viaja al navegador. */
export type OcurrenciaDeLaLista = {
  id: string;
  /** La fecha civil de la ocurrencia, `2026-09-17`. */
  fecha: string;
  contrato: { id: string; nombre: string };
  ruta: string;
  turno: { id: string; nombre: string };
  /** «06:45–06:50»: llegada exigida → límite con tolerancia, de lo sellado. */
  ventana: { desde: string; hasta: string | null };
  /** La llegada exigida, ISO: ordena los turnos dentro del día. */
  llegadaExigida: string;
  veredicto: Veredicto;
  timing: TimingDelSello | null;
  unidadObservada: string | null;
  /** Cuándo se selló el hecho vigente, ISO. */
  selladoAt: string;
  /** El hecho vigente reemplazó a otro: la leyenda de «una sola vez» sería falsa. */
  resellado: boolean;
  motivo: MotivoDelSello;
};

export type CuartoDeServiciosEspeciales = {
  zona: string;
  /** Todos los contratos de la cuenta, no sólo los que tienen algo en la ventana. */
  contratos: Array<{ id: string; nombre: string }>;
  ocurrencias: OcurrenciaDeLaLista[];
};

/**
 * La zona del cuarto: la del mercado de la cuenta; si la cuenta no tiene
 * mercado, la de la política de su contrato (decisión 6 de Asav, 18 sep 2026).
 *
 * El último respaldo es la zona que la propia política trae por omisión
 * (`contractPolicySchema.timeZone`), para los contratos cuyo jsonb se guardó
 * antes de que existiera la llave: no es una zona nueva, es la misma.
 */
export function zonaDelCuarto(zonaDelMercado: string | null, contratos: Array<{ zona: string | null }>): string {
  return zonaDelMercado ?? contratos.find((c) => c.zona)?.zona ?? JTTEL_TZ;
}

/** La zona del cuarto, leída: la pantalla la necesita antes de saber qué ventana pedir. */
export async function zonaDeLaCuenta(repos: ReposDeVernier, carrierAccountId: string): Promise<string> {
  const [zonaMercado, contratos] = await Promise.all([
    repos.vernier.zonaDelMercado(carrierAccountId),
    repos.vernier.contratosDeCarrier(carrierAccountId),
  ]);
  return zonaDelCuarto(zonaMercado, contratos);
}

const tolerancia = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

type FilaConHecho = {
  veredicto: Veredicto;
  timing: TimingDelSello | null;
  llegada: Date | null;
  llegadaExigida: Date;
  tolerancia: unknown;
  tardeExcusable: boolean;
  motivoExcusable: string | null;
};

function hechoDe(f: FilaConHecho): HechoParaLeer {
  return {
    veredicto: f.veredicto,
    timing: f.timing,
    llegada: f.llegada,
    llegadaExigida: f.llegadaExigida,
    toleranciaMin: tolerancia(f.tolerancia),
    tardeExcusable: f.tardeExcusable,
    motivoExcusable: f.motivoExcusable,
  };
}

/**
 * Lo que el ledger del sello vigente dice, o `SIN_LEDGER` si no se puede saber
 * cuál entrada es la suya. Ante la duda no se empareja (`ledger-pairing.ts`).
 */
function lecturaEmparejada<T extends { action: string; createdAt: Date }>(
  entradas: readonly T[],
  selladoAt: Date,
  leer: (entrada: T) => LecturaDelLedger,
): LecturaDelLedger {
  const par = pairLedgerEntryWithFact(entradas, selladoAt);
  return par.paired ? leer(par.entry) : SIN_LEDGER;
}

/**
 * El cuarto: las ocurrencias con hecho de la cuenta cuya llegada exigida cae
 * en la ventana, cada una con su motivo leído del sello.
 *
 * El filtro por contrato, turno, búsqueda y veredicto es de la pantalla y no
 * de aquí: son lentes sobre esta misma lista, y los conteos cuentan lo que la
 * lista muestra (ficha §2).
 */
export async function cargarServiciosEspeciales(
  repos: ReposDeVernier,
  entrada: { carrierAccountId: string; desde: Date; hasta: Date },
): Promise<CuartoDeServiciosEspeciales> {
  const { carrierAccountId, desde, hasta } = entrada;
  const [contratos, zonaMercado, filas] = await Promise.all([
    repos.vernier.contratosDeCarrier(carrierAccountId),
    repos.vernier.zonaDelMercado(carrierAccountId),
    repos.vernier.ocurrenciasSelladas(carrierAccountId, desde, hasta),
  ]);
  const zona = zonaDelCuarto(zonaMercado, contratos);
  const pasos = await repos.vernier.pasosDelSello(filas.map((f) => f.ocurrenciaId));

  const ocurrencias = filas.map((f): OcurrenciaDeLaLista => {
    const hecho = hechoDe(f as FilaConHecho);
    const lectura = lecturaEmparejada(pasos.get(f.ocurrenciaId) ?? [], f.selladoAt, (p) => ({
      emparejado: true,
      evidenciaIndisponible: p.evidenciaIndisponible,
      decision: p.decision ? lecturaDePasos([{ ...p.decision, step: "decision" }]).decision : null,
      cobertura: p.cobertura ? lecturaDePasos([{ ...p.cobertura, step: "cobertura_evidencia" }]).cobertura : null,
    }));
    return {
      id: f.ocurrenciaId,
      fecha: f.fecha,
      contrato: { id: f.contratoId, nombre: f.contrato },
      ruta: f.ruta,
      turno: { id: f.turnoId, nombre: f.turno },
      ventana: ventanaDeLlegada(f.llegadaExigida, hecho.toleranciaMin, zona),
      llegadaExigida: f.llegadaExigida.toISOString(),
      veredicto: f.veredicto as Veredicto,
      timing: f.timing as TimingDelSello | null,
      unidadObservada: f.unidadObservada,
      selladoAt: f.selladoAt.toISOString(),
      resellado: f.resellado,
      motivo: motivoDelSello(hecho, lectura, zona),
    };
  });

  return { zona, contratos: contratos.map((c) => ({ id: c.id, nombre: c.nombre })), ocurrencias };
}

/* ─── El acta ─────────────────────────────────────────────────────────── */

type Iso = string;

/** Un renglón de la línea de hechos: hora en mono y lo que se midió. */
export type HechoDeLaLinea =
  | { tipo: "primer_punto"; at: Iso }
  | { tipo: "hueco"; desde: Iso; hasta: Iso; minutos: number }
  | { tipo: "salto"; desde: Iso; hasta: Iso; km: number }
  | { tipo: "entrada_destino"; at: Iso };

export type TrazaDelActa =
  /** Ninguna traza es de esta ocurrencia: no hubo unidad observada. Dibujar candidatas sería especular. */
  | { tipo: "sin_unidad_observada" }
  /** Hubo unidad observada, pero el viaje no guardó un solo punto suyo. */
  | { tipo: "sin_puntos"; unidad: string }
  | {
      tipo: "con_puntos";
      unidad: string;
      /** Tramos medidos, partidos en huecos y saltos, cortados en la llegada. */
      tramos: Array<Array<{ lat: number; lng: number; at: Iso; speed: number | null }>>;
      huecos: Array<{ desde: Iso; hasta: Iso; minutos: number; lat: number; lng: number; latFin: number; lngFin: number }>;
      saltos: Array<{ desde: Iso; hasta: Iso; km: number; lat: number; lng: number; latFin: number; lngFin: number }>;
      /** `false` sólo si el sello no guarda la hora de llegada: sin ella no hay dónde cortar, y se dice. */
      cortadaEnLaLlegada: boolean;
      destino: { id: string; nombre: string; poligono: Array<{ lat: number; lng: number }> } | null;
      hechos: HechoDeLaLinea[];
    };

export type ActaDeOcurrencia = {
  zona: string;
  id: string;
  fecha: string;
  veredicto: Veredicto;
  timing: TimingDelSello | null;
  motivo: MotivoDelSello;
  selladoAt: Iso;
  /** Cuándo se reemplazó cada sello anterior. Vacío = el hecho vigente es el único que hubo. */
  resellos: Iso[];
  identidad: {
    perfil: { nombre: string; codigo: string };
    ruta: string;
    turno: string;
    ventana: { desde: string; hasta: string | null };
    contrato: string;
    /** Del perfil **hoy**: no se congelan con el hecho. */
    unidadesPosibles: string[];
    unidadObservada: string | null;
  };
  traza: TrazaDelActa;
  /** Lo que el transportista aportó en la pantalla vieja. Vacío = no hay nada presentado. */
  aportaciones: Array<{ id: string; motivo: string | null; nota: string | null; estado: string; creadaAt: Iso }>;
};

/**
 * El acta de una ocurrencia, o `null` si no es de esta cuenta o no tiene hecho.
 *
 * La traza se dibuja con los puntos de evidencia **de la unidad observada** que
 * el viaje guardó —los mismos con que juzgó el motor—, partida en huecos y
 * saltos y cortada al entrar a la geocerca de destino: la hora de entrada es la
 * llegada sellada (Pieza 7, especial). Sin unidad observada no hay traza.
 */
export async function cargarActa(
  repos: ReposDeVernier,
  entrada: { carrierAccountId: string; ocurrenciaId: string },
): Promise<ActaDeOcurrencia | null> {
  const { carrierAccountId, ocurrenciaId } = entrada;
  const f = await repos.vernier.ocurrenciaDelActa(carrierAccountId, ocurrenciaId);
  if (!f) return null;

  const [contratos, zonaMercado, posibles, resellos, entradas, aportaciones, puntos, destino] = await Promise.all([
    repos.vernier.contratosDeCarrier(carrierAccountId),
    repos.vernier.zonaDelMercado(carrierAccountId),
    repos.vernier.unidadesPosiblesDelPerfil(f.perfilId),
    repos.vernier.resellosDeOcurrencia(ocurrenciaId),
    repos.vernier.entradasQueSellan(ocurrenciaId),
    repos.vernier.aportacionesDeOcurrencia(carrierAccountId, ocurrenciaId),
    f.unidadObservadaId ? repos.vernier.puntosDeLaUnidadObservada(f.tripId, f.unidadObservadaId) : Promise.resolve([]),
    f.unidadObservadaId ? repos.vernier.geocercaDeDestino(f.destinoId) : Promise.resolve(null),
  ]);
  const zona = zonaDelCuarto(zonaMercado, contratos);
  const hecho = hechoDe(f as FilaConHecho);
  const lectura = lecturaEmparejada(entradas, f.selladoAt, (e) => lecturaDePasos(e.steps));

  let traza: TrazaDelActa;
  if (!f.unidadObservadaId) {
    traza = { tipo: "sin_unidad_observada" };
  } else if (puntos.length === 0) {
    traza = { tipo: "sin_puntos", unidad: f.unidadObservada ?? "unidad" };
  } else {
    traza = trazaDeLaUnidad(puntos, f.llegada, f.unidadObservada ?? "unidad", destino);
  }

  return {
    zona,
    id: f.ocurrenciaId,
    fecha: f.fecha,
    veredicto: f.veredicto as Veredicto,
    timing: f.timing as TimingDelSello | null,
    motivo: motivoDelSello(hecho, lectura, zona),
    selladoAt: f.selladoAt.toISOString(),
    resellos: resellos.map((r) => r.reemplazadoAt.toISOString()),
    identidad: {
      perfil: { nombre: f.perfil, codigo: f.perfilCodigo },
      ruta: f.ruta,
      turno: f.turno,
      ventana: ventanaDeLlegada(f.llegadaExigida, hecho.toleranciaMin, zona),
      contrato: f.contrato,
      unidadesPosibles: posibles.map((u) => u.etiqueta),
      unidadObservada: f.unidadObservada,
    },
    traza,
    aportaciones: aportaciones.map((a) => ({
      id: a.id,
      motivo: a.motivo,
      nota: a.nota,
      estado: a.estado,
      creadaAt: a.creadaAt.toISOString(),
    })),
  };
}

/**
 * La traza de la unidad observada: ordenada, cortada en la llegada sellada,
 * partida en huecos y saltos. Ningún punto se inventa ni se borra; lo de
 * después de la llegada no se dibuja porque la geocerca es la frontera de la
 * evidencia (Pieza 1.C y Pieza 7).
 */
export function trazaDeLaUnidad(
  puntosCrudos: Array<{ lat: number; lng: number; speed: number | null; at: Date }>,
  llegada: Date | null,
  unidad: string,
  destino: { id: string; nombre: string; poligono: Array<{ lat: number; lng: number }> } | null,
): Extract<TrazaDelActa, { tipo: "con_puntos" }> {
  const ordenados = ordenarPorTiempo(puntosCrudos);
  const puntos = llegada ? ordenados.filter((p) => p.at.getTime() <= llegada.getTime()) : ordenados;
  const iso = (d: Date) => d.toISOString();
  const huecos = huecosDeSenal(puntos);
  const saltos = saltosDeGps(puntos);

  const hechos: HechoDeLaLinea[] = [];
  if (puntos[0]) hechos.push({ tipo: "primer_punto", at: iso(puntos[0].at) });
  for (const h of huecos) hechos.push({ tipo: "hueco", desde: iso(h.desde), hasta: iso(h.hasta), minutos: h.minutos });
  for (const s of saltos) hechos.push({ tipo: "salto", desde: iso(s.desde), hasta: iso(s.hasta), km: s.km });
  if (llegada) hechos.push({ tipo: "entrada_destino", at: iso(llegada) });
  const momento = (h: HechoDeLaLinea) => Date.parse(h.tipo === "hueco" || h.tipo === "salto" ? h.desde : h.at);
  hechos.sort((a, b) => momento(a) - momento(b));

  return {
    tipo: "con_puntos",
    unidad,
    tramos: partirEnCortes(puntos).map((t) => t.map((p) => ({ lat: p.lat, lng: p.lng, at: iso(p.at), speed: p.speed }))),
    huecos: huecos.map((h) => ({ ...h, desde: iso(h.desde), hasta: iso(h.hasta) })),
    saltos: saltos.map((s) => ({ ...s, desde: iso(s.desde), hasta: iso(s.hasta) })),
    cortadaEnLaLlegada: llegada !== null,
    destino,
    hechos,
  };
}
