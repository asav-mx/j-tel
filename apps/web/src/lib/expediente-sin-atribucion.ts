/**
 * El expediente de un servicio sin atribución — Parte 1, la lectura.
 *
 * Funciones puras: no tocan la base, no deciden nada, no mueven un veredicto.
 * Toman lo que quedó sellado y arman lo que la pantalla enseña.
 *
 * Ficha: `docs/marco-limpio/Ficha-Expediente-Sin-Atribucion.md`.
 *
 * ---
 *
 * **La ley que gobierna este archivo entero, y por la que existe separado de la
 * pantalla:** todo campo nuevo nace vacío hacia atrás. De los 397 servicios
 * acusados con una llegada registrada, el tramo observable está sellado en 121,
 * la cobertura llana en 67 y el aparato en 29. **La ausencia significa «no se
 * preguntó», no «salió bien»** — y un hueco dibujado igual que un cero rompe la
 * ley el primer día.
 *
 * Por eso cada dato viaja con su procedencia y no hay forma de construir uno
 * sin declararla.
 */
import type { CandidatasSnapshot, MotivoDeCandidata } from "@jtel/domain";

/**
 * De dónde salió cada dato. No se colapsan nunca.
 *
 *   sello          — lo que el árbitro guardó al juzgar. Se muestra tal cual.
 *   hoy            — calculado ahora con lo guardado. Si la tabla de la que
 *                    sale cambió, el número cambia (C24): hay que decirlo.
 *   no_preguntado  — el motor de esa época no lo calculaba. NO es cero, no es
 *                    vacío, y la pantalla lo dice CON PALABRAS.
 */
export type Procedencia = "sello" | "hoy" | "no_preguntado";

export type Medida = {
  etiqueta: string;
  /** null solo cuando la procedencia es `no_preguntado`. */
  valor: number | null;
  /** El umbral del contrato al lado. Un dato sin su lectura es medio dato. */
  umbral: number | null;
  sufijo: string;
  decimales: number;
  procedencia: Procedencia;
  /** Aclaración obligatoria cuando el nombre del número no basta (C17). */
  nota?: string;
};

export type MotivoVista = {
  texto: string;
  /** A quién se le preguntó — C25 a la vista, no en un comentario. */
  poblacion: "candidata" | "viaje";
  medido: number | null;
  umbral: number | null;
  procedencia: Procedencia;
};

export type SenalVista = {
  coberturaPct: number;
  huecoMaximoMin: number;
  cadenciaMedianaS: number | null;
  puntos: number;
  procedencia: Procedencia;
};

export type EmpalmeVista = {
  rutaNombre: string;
  fecha: string;
  procedencia: Procedencia;
};

export type CandidataVista = {
  clave: string;
  etiqueta: string;
  llegadaAt: string | null;
  acredito: boolean;
  medidas: Medida[];
  motivos: MotivoVista[];
  /** null con procedencia declarada aparte: ver `senalProcedencia`. */
  senal: SenalVista | null;
  empalme: EmpalmeVista | null;
};

export type ExpedienteSinAtribucion = {
  /** Cuántas se evaluaron EN TOTAL. La ley del corte: sin esto el filtro esconde. */
  evaluadas: number;
  /**
   * Cuántas LLEGARON a la geocerca — de todas las evaluadas, no de las que
   * quedaron en la lista.
   *
   * Va aparte porque el titular habla de llegadas y la lista habla del corte, y
   * **son dos números distintos**: en un servicio real de julio llegaron 15 y
   * pasaron el corte 13. Escribir «13 unidades llegaron» sobre la lista
   * recortada es correcto como conteo y falso como afirmación — §D del Marco,
   * eje del alcance.
   */
  llegaron: number;
  criterio: "llego_y_cerca" | "solo_llegada";
  candidatas: CandidataVista[];
  /** De dónde salió el expediente entero. */
  origen: "sello" | "ledger";
  /**
   * Qué NO se preguntó en esta época, en palabras. La pantalla las imprime;
   * no las traduce a huecos.
   */
  noSePregunto: string[];
};

/** Piso de corredor para entrar al expediente. Mismo número que el motor. */
export const PISO_CORREDOR_PCT = 5;

type CandidataCruda = {
  unitId?: string | null;
  arrivalAt?: string | Date | null;
  servedRoute?: boolean;
  routeMatchPct?: number | null;
  routeMatchPlainPct?: number | null;
  corridorPrecisionPct?: number | null;
  observableFraction?: number | null;
  frechetKm?: number | null;
  motivos?: MotivoDeCandidata[];
};

export type UmbralesSellados = {
  minKmlPct: number | null;
  minCorridorPct: number | null;
  originToleranceFraction: number | null;
};

function iso(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.toISOString();
}

function n(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const TEXTO_COMPUERTA: Record<MotivoDeCandidata["compuerta"], string> = {
  no_llego: "No entró a la geocerca del destino",
  tramo_observable: "No se le vio suficiente ruta para poder calificarla",
  cobertura_de_trazado: "No recorrió suficiente del trazado contratado",
  precision_de_corredor: "No se mantuvo sobre el trazado contratado",
};

/**
 * El motivo, tal como lo selló el motor.
 *
 * **No se deduce cuando falta.** Deducirlo con los números que sí quedaron sería
 * escribir un hecho que nadie observó dentro de un expediente sellado, y además
 * saldría mal: sobre los 397 acusados, la causa derivada de lo sellado **se
 * equivoca en 260 de 285 (91.2 %)** — dice conducta del transportista donde hubo
 * fallo de observación (C25). En su lugar se dice que no se preguntó.
 */
export function motivosDe(
  c: CandidataCruda,
  umbrales: UmbralesSellados,
): MotivoVista[] {
  if (!c.motivos || c.motivos.length === 0) {
    if (c.servedRoute) return [];
    return [
      {
        texto: "El motivo de esta candidata no se preguntó cuando se selló",
        poblacion: "candidata",
        medido: null,
        umbral: null,
        procedencia: "no_preguntado",
      },
    ];
  }
  return c.motivos.map((m) => ({
    texto: TEXTO_COMPUERTA[m.compuerta] ?? m.compuerta,
    poblacion: m.poblacion,
    medido: n(m.medido),
    umbral: n(m.umbral) ?? umbralDe(m.compuerta, umbrales),
    procedencia: "sello" as const,
  }));
}

function umbralDe(
  compuerta: MotivoDeCandidata["compuerta"],
  u: UmbralesSellados,
): number | null {
  if (compuerta === "cobertura_de_trazado") return u.minKmlPct;
  if (compuerta === "precision_de_corredor") return u.minCorridorPct;
  if (compuerta === "tramo_observable") {
    return u.originToleranceFraction === null ? null : 1 - u.originToleranceFraction;
  }
  return null;
}

/**
 * Las medidas de una candidata, cada una con su umbral y su procedencia.
 *
 * ⚠ **C17 vive aquí:** `routeMatchPct` va ponderada por TF-IDF y **no se lee
 * como porcentaje llano** — medido sobre los 397, la ponderada tiene mediana
 * 25.4 % y la llana 100 %. Cuando existen las dos, van las dos rotuladas.
 * Cuando solo existe la ponderada —330 de 397—, se dice que la llana no se
 * guardó **en vez de recalcularla y presentarla como del sello**.
 */
export function medidasDe(c: CandidataCruda, u: UmbralesSellados): Medida[] {
  const medidas: Medida[] = [];

  medidas.push({
    etiqueta: "Cobertura del trazado",
    valor: n(c.routeMatchPct),
    umbral: u.minKmlPct,
    sufijo: "%",
    decimales: 1,
    procedencia: n(c.routeMatchPct) === null ? "no_preguntado" : "sello",
    nota: "la que decide · ponderada",
  });

  const llana = n(c.routeMatchPlainPct);
  medidas.push({
    etiqueta: "Cobertura del trazado, llana",
    valor: llana,
    umbral: null,
    sufijo: "%",
    decimales: 1,
    procedencia: llana === null ? "no_preguntado" : "sello",
    nota: llana === null ? undefined : "no decide · legible como porcentaje",
  });

  medidas.push({
    etiqueta: "Precisión de corredor",
    valor: n(c.corridorPrecisionPct),
    umbral: u.minCorridorPct,
    sufijo: "%",
    decimales: 1,
    procedencia: n(c.corridorPrecisionPct) === null ? "no_preguntado" : "sello",
  });

  const frac = n(c.observableFraction);
  medidas.push({
    etiqueta: "Tramo de ruta observable",
    valor: frac === null ? null : frac * 100,
    umbral:
      u.originToleranceFraction === null ? null : (1 - u.originToleranceFraction) * 100,
    sufijo: "%",
    decimales: 1,
    procedencia: frac === null ? "no_preguntado" : "sello",
    nota: frac === null ? undefined : "sobre esto se calculó la cobertura",
  });

  return medidas;
}

export type ArmarVistaInput = {
  /** El expediente sellado, cuando existe. Manda sobre el ledger. */
  snapshot: CandidatasSnapshot | null;
  /** Las candidatas del último asiento del ledger — la única fuente de lo viejo. */
  ledgerCandidatas: CandidataCruda[];
  umbrales: UmbralesSellados;
  /** Cómo se llama cada unidad, si se puede resolver. */
  etiquetaDe: (clave: string) => string | null;
  /** Qué otra ruta acreditó esa unidad ese día. Siempre lectura de HOY. */
  empalmeDe: (clave: string) => { rutaNombre: string; fecha: string } | null;
  senalDe?: (clave: string) => Omit<SenalVista, "procedencia"> | null;
};

/**
 * Arma el expediente. Devuelve `null` cuando no hay nada que enseñar — ninguna
 * candidata evaluada—, que es distinto de «hay cero candidatas relevantes».
 */
export function armarExpediente(
  input: ArmarVistaInput,
): ExpedienteSinAtribucion | null {
  const desdeSello = input.snapshot !== null;

  const crudas: CandidataCruda[] = desdeSello
    ? input.snapshot!.candidatas.map((c) => ({
        unitId: c.unidadId,
        arrivalAt: c.llegadaAt,
        servedRoute: c.acredito,
        motivos: c.motivos,
      }))
    : input.ledgerCandidatas;

  const evaluadas = desdeSello ? input.snapshot!.evaluadas : input.ledgerCandidatas.length;
  if (crudas.length === 0 && evaluadas === 0) return null;

  /*
   * El corte de dos criterios. Sobre lo sellado ya viene aplicado —el motor lo
   * hizo al congelarlo—; sobre el ledger se aplica aquí, con el mismo piso.
   */
  let criterio: ExpedienteSinAtribucion["criterio"];
  let relevantes: CandidataCruda[];
  if (desdeSello) {
    relevantes = crudas;
    criterio =
      input.snapshot!.criterio === "llego_a_geocerca" ? "solo_llegada" : "llego_y_cerca";
  } else {
    const llegaron = crudas.filter((c) => iso(c.arrivalAt) !== null);
    const cercanas = llegaron.filter((c) => (n(c.corridorPrecisionPct) ?? 0) > PISO_CORREDOR_PCT);
    relevantes = cercanas.length > 0 ? cercanas : llegaron;
    criterio = cercanas.length > 0 ? "llego_y_cerca" : "solo_llegada";
  }

  const ordenadas = [...relevantes].sort((a, b) => {
    const sa = Math.min(n(a.routeMatchPct) ?? -1, n(a.corridorPrecisionPct) ?? -1);
    const sb = Math.min(n(b.routeMatchPct) ?? -1, n(b.corridorPrecisionPct) ?? -1);
    return sb - sa;
  });

  const candidatas: CandidataVista[] = ordenadas.map((c) => {
    const clave = c.unitId ?? "";
    const senalCruda = input.senalDe?.(clave) ?? null;
    return {
      clave,
      etiqueta: input.etiquetaDe(clave) ?? clave,
      llegadaAt: iso(c.arrivalAt),
      acredito: Boolean(c.servedRoute),
      medidas: medidasDe(c, input.umbrales),
      motivos: motivosDe(c, input.umbrales),
      senal: senalCruda
        ? { ...senalCruda, procedencia: desdeSello ? "sello" : "hoy" }
        : null,
      // El empalme se deriva cruzando el ledger del día: siempre es lectura de hoy.
      empalme: (() => {
        const e = input.empalmeDe(clave);
        return e ? { ...e, procedencia: "hoy" as const } : null;
      })(),
    };
  });

  /*
   * Qué no se preguntó en esta época. Se enuncia una vez arriba, en palabras, y
   * además cada dato lo lleva en su renglón: sin la frase, un lector cuenta
   * huecos y concluye que el sistema falla; con ella sabe que el sistema de
   * entonces no hacía esa pregunta.
   */
  const noSePregunto: string[] = [];
  if (!desdeSello) {
    const algunoSinMotivo = candidatas.some((c) =>
      c.motivos.some((m) => m.procedencia === "no_preguntado"),
    );
    if (algunoSinMotivo) {
      noSePregunto.push("por qué no acreditó cada candidata, una por una");
    }
    if (candidatas.some((c) => c.medidas.some((m) => m.etiqueta.includes("llana") && m.valor === null))) {
      noSePregunto.push("la cobertura del trazado en su forma legible");
    }
    if (
      candidatas.some((c) =>
        c.medidas.some((m) => m.etiqueta.includes("observable") && m.valor === null),
      )
    ) {
      noSePregunto.push("cuánta ruta alcanzó a verse de cada candidata");
    }
    noSePregunto.push("qué trazado contratado se usó para calificar");
  }

  return {
    evaluadas,
    // De TODAS las evaluadas, no de las que quedaron en la lista.
    llegaron: crudas.filter((c) => iso(c.arrivalAt) !== null).length,
    criterio,
    candidatas,
    origen: desdeSello ? "sello" : "ledger",
    noSePregunto,
  };
}

/** Las candidatas del último asiento del ledger que sí juzgó. */
export function candidatasDelLedger(ledger: unknown[]): CandidataCruda[] {
  type Entrada = {
    createdAt?: Date | string;
    metadata?: { candidateUnits?: CandidataCruda[] } | null;
  };
  const conCandidatas = (ledger as Entrada[]).filter((e) =>
    Array.isArray(e?.metadata?.candidateUnits),
  );
  if (conCandidatas.length === 0) return [];
  const ultima = conCandidatas.reduce((mejor, e) => {
    const t = new Date(e.createdAt ?? 0).getTime();
    const tm = new Date(mejor.createdAt ?? 0).getTime();
    return t >= tm ? e : mejor;
  });
  return ultima.metadata!.candidateUnits!;
}
