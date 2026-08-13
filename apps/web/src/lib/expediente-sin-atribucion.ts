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

/**
 * Lo que se observó de la FLOTA cuando ninguna candidata llegó.
 *
 * «Nadie llegó» sigue siendo un hallazgo, y hasta ahora la pantalla lo decía
 * como si no hubiera pasado nada: lista vacía bajo un titular de «0 unidades
 * llegaron». Son **204 de los 608 acusados**. Esto es lo que sí se puede
 * enseñar de ellos sin inventar nada.
 */
export type LecturaSinLlegadas = {
  /** Cuántas emitieron algún punto en la ventana. Distingue «no fue» de «no se vio». */
  conSenal: number;
  /** Cuántas pisaron el corredor del trazado, aunque no llegaran al destino. */
  tocaronElTrazado: number;
  /** Puntos de evidencia del viaje entero — si la flota reportó ese día. */
  puntosDeLaFlota: number;
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
  criterio: "llego_y_cerca" | "solo_llegada" | "sin_llegadas";
  /** Solo cuando `llegaron === 0`. Es el hallazgo de ese caso, no su ausencia. */
  sinLlegadas: LecturaSinLlegadas | null;
  candidatas: CandidataVista[];
  /**
   * De dónde salió el expediente entero.
   *
   *   sello        — el hecho lo trae congelado. Se muestra tal cual.
   *   ledger       — el hecho es anterior a la Parte 2 (sello en `null`) y se
   *                  lee del asiento que juzgó. Trae huecos declarados.
   *   reconstruido — **el hecho trae el sello VACÍO.** Se sellaron 4 servicios
   *                  con la lista en blanco antes de que el motor supiera
   *                  guardar el caso «nadie llegó». El hecho no se toca; lo que
   *                  se enseña se calcula HOY del ledger, y va marcado.
   */
  origen: "sello" | "ledger" | "reconstruido";
  /**
   * Qué NO se preguntó en esta época, en palabras. La pantalla las imprime;
   * no las traduce a huecos.
   */
  noSePregunto: string[];
};

/** Piso de corredor para entrar al expediente. Mismo número que el motor. */
export const PISO_CORREDOR_PCT = 5;

/**
 * Cuántas enseñar cuando NINGUNA llegó.
 *
 * Sin llegada no hay corte natural —el criterio es «llegó y se acercó»— y sin
 * tope se listaría la flota entera: 42 filas en el servicio que lo destapó. Se
 * muestran las que más se acercaron, y el total evaluado va arriba, que es lo
 * que impide que el tope esconda.
 */
export const MAX_SIN_LLEGADAS = 5;

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
/**
 * Qué dice la cobertura al lado del número, según sobre cuánta ruta se calculó.
 *
 * Sin el tramo sellado no se puede decir sobre qué se calculó — y **no se
 * inventa**: se dice que la ponderación existe y ya.
 */
export function notaDeCobertura(
  fraccion: number | null,
  u: UmbralesSellados,
): string {
  if (fraccion === null) return "la que decide · ponderada";
  const pct = fraccion * 100;
  const piso =
    u.originToleranceFraction === null ? 85 : (1 - u.originToleranceFraction) * 100;
  if (pct + 1e-9 >= piso) {
    return `la que decide · ponderada · sobre el ${pct.toFixed(1)}% de la ruta`;
  }
  // El tramo no alcanza el piso: el porcentaje NO se puede leer solo.
  return `⚠ calculada SOLO sobre el ${pct.toFixed(1)}% de la ruta que se alcanzó a ver`;
}

export function medidasDe(c: CandidataCruda, u: UmbralesSellados): Medida[] {
  const medidas: Medida[] = [];

  medidas.push({
    etiqueta: "Cobertura del trazado",
    valor: n(c.routeMatchPct),
    umbral: u.minKmlPct,
    sufijo: "%",
    decimales: 1,
    procedencia: n(c.routeMatchPct) === null ? "no_preguntado" : "sello",
    /*
     * ⚠ La cobertura se calcula sobre EL TRAMO QUE SE ALCANZÓ A VER, no sobre la
     * ruta. Cuando ese tramo es un pedacito, un «100 %» es cierto y no dice
     * nada — y junto a un «no acreditó» hace pensar que el sistema está roto.
     *
     * Medido el 13 de agosto de 2026 sobre 24 404 candidatas con tramo
     * observable sellado: **de las 2 823 con cobertura ≥ 60 %, 1 791 (63.4 %)
     * la calcularon sobre ≤ 15 % de la ruta**, y **1 128 muestran 100 % sobre
     * ≤ 5 %**. No es un caso raro: es la mayoría de las coberturas altas.
     *
     * El motor ya lo sabía —su propio comentario dice que «un 78 % sobre el
     * 60 % de la ruta no es un 78 % de la ruta»— y las rechaza por el piso del
     * tramo observable. Lo que fallaba era la LECTURA: los dos números vivían
     * en renglones distintos y se podían leer por separado.
     *
     * Aquí se fusionan: donde el tramo es chico, el porcentaje **no se puede
     * leer solo**.
     */
    nota: notaDeCobertura(n(c.observableFraction), u),
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
  /** Puntos de evidencia del viaje entero — contesta «¿reportó el GPS ese día?». */
  puntosDeLaFlota?: number;
};

/**
 * Arma el expediente. Devuelve `null` cuando no hay nada que enseñar — ninguna
 * candidata evaluada—, que es distinto de «hay cero candidatas relevantes».
 */
export function armarExpediente(
  input: ArmarVistaInput,
): ExpedienteSinAtribucion | null {
  /*
   * El sello manda — salvo cuando viene VACÍO y el ledger sí tiene candidatas.
   *
   * Cuatro servicios se sellaron con la lista en blanco antes de que el motor
   * supiera guardar el caso «nadie llegó». **El hecho no se toca ni se
   * reescribe**: lo que se enseña se calcula hoy del asiento que juzgó, y va
   * marcado como tal. Los puntos nunca se perdieron; lo que faltó fue el
   * resumen que el motor no armó.
   */
  const selloVacio =
    input.snapshot !== null &&
    input.snapshot.candidatas.length === 0 &&
    input.ledgerCandidatas.length > 0;
  const desdeSello = input.snapshot !== null && !selloVacio;

  const crudas: CandidataCruda[] = desdeSello
    ? input.snapshot!.candidatas.map((c) => ({
        unitId: c.unidadId,
        arrivalAt: c.llegadaAt,
        servedRoute: c.acredito,
        motivos: c.motivos,
      }))
    : input.ledgerCandidatas;

  // El total evaluado sale del sello aunque su lista viniera vacía: ese número
  // sí lo congeló el motor y es el que manda.
  const evaluadas = input.snapshot
    ? input.snapshot.evaluadas
    : input.ledgerCandidatas.length;
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
    if (llegaron.length === 0) {
      /*
       * Nadie llegó. Antes esto dejaba la lista vacía bajo un titular de «0
       * unidades llegaron», que es la pantalla que no explica nada — el caso que
       * Asav abrió y con razón: 42 candidatas evaluadas y ni una fila.
       *
       * Se muestran las que MÁS SE ACERCARON al trazado, aunque ninguna haya
       * entrado a la geocerca. No es un premio de consolación: es la única
       * respuesta honesta a «dónde anduvieron», y sale del mismo ledger.
       */
      relevantes = [...crudas].filter(
        (c) => (n(c.corridorPrecisionPct) ?? 0) > 0 || (n(c.routeMatchPct) ?? 0) > 0,
      );
      criterio = "sin_llegadas";
    } else {
      const cercanas = llegaron.filter(
        (c) => (n(c.corridorPrecisionPct) ?? 0) > PISO_CORREDOR_PCT,
      );
      relevantes = cercanas.length > 0 ? cercanas : llegaron;
      criterio = cercanas.length > 0 ? "llego_y_cerca" : "solo_llegada";
    }
  }

  const ordenadas = [...relevantes]
    .sort((a, b) => {
      const sa = Math.min(n(a.routeMatchPct) ?? -1, n(a.corridorPrecisionPct) ?? -1);
      const sb = Math.min(n(b.routeMatchPct) ?? -1, n(b.corridorPrecisionPct) ?? -1);
      return sb - sa;
    })
    // El tope va DESPUÉS de ordenar: cortar antes dejaría fuera justo a las que
    // más se acercaron, que son las únicas que este caso puede enseñar.
    .slice(0, criterio === "sin_llegadas" ? MAX_SIN_LLEGADAS : relevantes.length);

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
    // El trazado sí quedó sellado cuando el hecho trae expediente, aunque su
    // lista viniera vacía: no se enuncia como faltante en ese caso.
    if (!input.snapshot) {
      noSePregunto.push("qué trazado contratado se usó para calificar");
    }
  }

  const llegaronTotal = crudas.filter((c) => iso(c.arrivalAt) !== null).length;

  return {
    evaluadas,
    // De TODAS las evaluadas, no de las que quedaron en la lista.
    llegaron: llegaronTotal,
    sinLlegadas:
      llegaronTotal === 0
        ? {
            conSenal: crudas.filter(
              (c) => (input.senalDe?.(c.unitId ?? "")?.puntos ?? 0) > 0,
            ).length,
            tocaronElTrazado: crudas.filter(
              (c) => (n(c.corridorPrecisionPct) ?? 0) > 0,
            ).length,
            puntosDeLaFlota: input.puntosDeLaFlota ?? 0,
          }
        : null,
    criterio,
    candidatas,
    origen: desdeSello ? "sello" : selloVacio ? "reconstruido" : "ledger",
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
