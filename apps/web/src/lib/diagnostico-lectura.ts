/**
 * Lectura del microscopio: qué midió el motor, contra qué umbral, y por qué
 * decidió lo que decidió.
 *
 * TODO lo que sale de aquí viene del ledger que el motor selló en el momento
 * de verificar. Nada se recalcula al abrir la pantalla — la ley 2 no se afloja
 * ni siquiera para diagnosticar. Si una cifra no quedó sellada, aquí sale
 * `null` y la pantalla dice que no está; jamás un número derivado de los datos
 * de hoy, que sería contar otra corrida.
 *
 * Módulo puro: no toca base de datos y se prueba solo.
 */

import type { LedgerStep } from "@jtel/domain";

// ---------------------------------------------------------------------------
// Lo que el ledger trae
// ---------------------------------------------------------------------------

/** Una candidata evaluada contra la ruta, tal como quedó en el ledger. */
export type Candidata = {
  /**
   * Identificador con el que el motor agrupó los puntos. Es el `unitId` cuando
   * la evidencia traía la unidad resuelta, y el IMEI crudo cuando no. No se
   * adivina cuál es — por eso se llama `clave` y no `unidad`.
   */
  clave: string;
  /**
   * Los aparatos que emitieron la traza de esta candidata. Puede ser más de uno
   * si la unidad cambió de dispositivo a media ventana.
   *
   * **Vacío en todo lo sellado antes de C15**, y esa ausencia significa «no se
   * guardó», no «no hubo aparato»: hasta ese arreglo el imei se sobrescribía
   * con el id de la unidad y el aparato no llegaba al expediente. Quien lo
   * muestre tiene que distinguir las dos cosas.
   */
  imeis: string[];
  sirvioRuta: boolean;
  llegadaIso: string | null;
  matchRutaPct: number | null;
  precisionCorredorPct: number | null;
  frechetKm: number | null;
  similitudDireccion: number | null;
  /** Sobre qué fracción de la ruta se calculó el match (1 = la ruta completa). */
  fraccionObservable: number | null;
  formaOk: boolean | null;
};

/** Los umbrales del contrato congelados en la corrida. */
export type Umbrales = {
  hayKml: boolean;
  matchMinPct: number | null;
  corredorMinPct: number | null;
  corredorMetros: number | null;
  frechetMaxKm: number | null;
  coberturaMinPct: number | null;
  huecoMaxMinutos: number | null;
};

/** El paso de cobertura de evidencia, si el motor llegó a correrlo. */
export type Cobertura = {
  pct: number | null;
  huecoMaxMinutos: number | null;
  puntosEnVentana: number | null;
  suficiente: boolean;
  /** El motor mide cobertura por IMEI, no con la flota mezclada. */
  clave: string | null;
};

export type Decision = {
  resultado: string;
  /** Código crudo del motor. J-Staff lo quiere tal cual, sin traducir. */
  motivo: string | null;
  claveObservada: string | null;
  fraccionMasTempranaObservada: number | null;
  toleranciaDeOrigen: number | null;
};

// ---------------------------------------------------------------------------
// Las cuatro medidas
// ---------------------------------------------------------------------------

export type ClaveMedida = "match_ruta" | "precision_corredor" | "forma" | "cobertura";

export type Medida = {
  clave: ClaveMedida;
  nombre: string;
  /** Qué pregunta contesta esta cifra, en una línea. */
  pregunta: string;
  valor: number | null;
  umbral: number | null;
  unidad: "pct" | "km";
  /** Hacia dónde está lo bueno. Fréchet es la única donde menos es mejor. */
  direccion: "mayor_mejor" | "menor_mejor";
  /** Extremos del riel donde se dibuja valor y umbral. */
  escala: { min: number; max: number };
  /** `null` cuando falta el valor o el umbral: no se supone que pasó. */
  pasa: boolean | null;
  /**
   * La segunda mitad del dato. Un porcentaje de match sin decir sobre qué
   * tramo se calculó es medio dato, y es justo la mitad que explica los casos
   * en que el camión maneja bien y el número sale bajo.
   */
  nota: string | null;
};

// ---------------------------------------------------------------------------
// La lectura completa
// ---------------------------------------------------------------------------

export type LecturaDelMotor = {
  candidatas: Candidata[];
  /** La candidata sobre la que se leen las cuatro medidas. */
  decisiva: Candidata | null;
  /**
   * Por qué esa candidata y no otra:
   * - `gano` — el motor la acreditó y el hecho la nombra.
   * - `mas_cercana` — nadie acreditó; es la que quedó más arriba con la misma
   *   regla de orden del motor (el menor de match y corredor). Se declara
   *   aparte de `gano` a propósito: no es lo mismo la que sirvió que la que
   *   estuvo cerca.
   */
  papelDeLaDecisiva: "gano" | "mas_cercana" | null;
  umbrales: Umbrales;
  cobertura: Cobertura | null;
  decision: Decision | null;
  medidas: Medida[];
  /** Por qué el motor decidió lo que decidió, en una línea. */
  porQue: string;
};

// ---------------------------------------------------------------------------
// Utilidades de lectura del jsonb (sin adivinar tipos)
// ---------------------------------------------------------------------------

function num(d: Record<string, unknown> | undefined, k: string): number | null {
  const v = d?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function txt(d: Record<string, unknown> | undefined, k: string): string | null {
  const v = d?.[k];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function bool(d: Record<string, unknown> | undefined, k: string): boolean | null {
  const v = d?.[k];
  return typeof v === "boolean" ? v : null;
}

/** Porcentaje exacto, sin redondear a entero: un número redondeado se discute. */
export function pct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

/** Kilómetros con la precisión con la que el motor los selló. */
export function km(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(3)} km`;
}

// ---------------------------------------------------------------------------
// Extracción
// ---------------------------------------------------------------------------

export function candidatasDeLosPasos(pasos: readonly LedgerStep[]): Candidata[] {
  return pasos
    .filter((p) => p.step === "candidata")
    .map((p) => {
      const d = p.details as Record<string, unknown> | undefined;
      return {
        /*
         * C15 · `unidadId` primero; `imei` es el nombre viejo del MISMO valor.
         *
         * Las entradas selladas antes del arreglo escriben la unidad bajo
         * `imei:`, así que el respaldo no es cortesía: sin él, todo el
         * histórico se queda sin nombre de candidata. Y no se puede invertir el
         * orden — en las entradas nuevas `imei` ya no existe: existe `imeis`,
         * que son los aparatos y son otra cosa.
         */
        clave: txt(d, "unidadId") ?? txt(d, "imei") ?? "—",
        /**
         * Los aparatos que emitieron esa traza. Vacío en lo sellado antes del
         * arreglo, porque entonces el aparato se perdía al preparar la
         * evidencia — y eso hay que decirlo, no rellenarlo.
         */
        imeis: Array.isArray(d?.imeis)
          ? (d.imeis as unknown[]).filter((x): x is string => typeof x === "string")
          : [],
        sirvioRuta: p.result === "sirvio_ruta",
        llegadaIso: txt(d, "arrivalAt"),
        matchRutaPct: num(d, "routeMatchPct"),
        precisionCorredorPct: num(d, "corridorPrecisionPct"),
        frechetKm: num(d, "frechetKm"),
        similitudDireccion: num(d, "directionSimilarity"),
        fraccionObservable: num(d, "observableFraction"),
        formaOk: bool(d, "shapeOk"),
      };
    });
}

export function umbralesDeLosPasos(pasos: readonly LedgerStep[]): Umbrales {
  const candidata = pasos.find((p) => p.step === "candidata")?.details as
    | Record<string, unknown>
    | undefined;
  const decision = pasos.find((p) => p.step === "decision")?.details as
    | Record<string, unknown>
    | undefined;
  const coberturaPaso = pasos.find((p) => p.step === "cobertura_evidencia")?.details as
    | Record<string, unknown>
    | undefined;

  return {
    hayKml: bool(candidata, "hasKml") ?? bool(decision, "hasKml") ?? false,
    matchMinPct: num(candidata, "minKmlPct") ?? num(decision, "minKmlPct"),
    corredorMinPct: num(candidata, "minCorridorPct") ?? num(decision, "minCorridorPct"),
    corredorMetros: num(candidata, "corridorMeters") ?? num(decision, "corridorMeters"),
    frechetMaxKm: num(candidata, "frechetMaxKm"),
    coberturaMinPct: num(coberturaPaso, "minCoveragePct"),
    huecoMaxMinutos: num(coberturaPaso, "maxGapMinutesAllowed"),
  };
}

export function coberturaDeLosPasos(pasos: readonly LedgerStep[]): Cobertura | null {
  const paso = pasos.find((p) => p.step === "cobertura_evidencia");
  if (!paso) return null;
  const d = paso.details as Record<string, unknown> | undefined;
  return {
    pct: num(d, "coveragePct"),
    huecoMaxMinutos: num(d, "maxGapMinutes"),
    puntosEnVentana: num(d, "pointCountInWindow"),
    suficiente: paso.result === "suficiente",
    /*
     * C15 · `unidadId` primero, `bestImei` como respaldo de lo ya sellado.
     *
     * Los dos campos guardan el MISMO valor —un id de unidad—, así que esto no
     * cambia lo que se lee de ninguna entrada. Lo que cambia es de dónde: las
     * entradas nuevas traen el campo con su nombre verdadero, y `bestImei`
     * queda solo para las viejas, que son las que lo llamaban aparato.
     *
     * El respaldo no se puede quitar: lo sellado antes de este cambio no tiene
     * `unidadId`, y quitarlo dejaría ciega la lectura de todo el histórico.
     */
    clave: txt(d, "unidadId") ?? txt(d, "bestImei"),
  };
}

export function decisionDeLosPasos(pasos: readonly LedgerStep[]): Decision | null {
  const paso = [...pasos].reverse().find((p) => p.step === "decision");
  if (!paso) return null;
  const d = paso.details as Record<string, unknown> | undefined;
  return {
    resultado: paso.result,
    motivo: txt(d, "reason"),
    claveObservada: txt(d, "observedUnit"),
    fraccionMasTempranaObservada: num(d, "earliestObservedFraction"),
    toleranciaDeOrigen: num(d, "originToleranceFraction"),
  };
}

/**
 * La candidata sobre la que se leen las cuatro medidas.
 *
 * Si el motor acreditó una, es esa y punto — el ledger la nombra. Si no
 * acreditó a nadie, se toma la que quedó más arriba con la MISMA regla de
 * orden que usa el motor para rankear (el menor de match y corredor), porque
 * es la que su decisión estaba mirando. Se devuelve etiquetada para que la
 * pantalla nunca la presente como si hubiera servido la ruta.
 */
export function candidataDecisiva(
  candidatas: readonly Candidata[],
  decision: Decision | null,
): { candidata: Candidata | null; papel: "gano" | "mas_cercana" | null } {
  if (candidatas.length === 0) return { candidata: null, papel: null };

  if (decision?.claveObservada) {
    const ganadora = candidatas.find((c) => c.clave === decision.claveObservada);
    if (ganadora) return { candidata: ganadora, papel: "gano" };
  }

  const puntaje = (c: Candidata) =>
    Math.min(c.matchRutaPct ?? -1, c.precisionCorredorPct ?? -1);
  const mejor = [...candidatas].sort((a, b) => puntaje(b) - puntaje(a))[0]!;
  return { candidata: mejor, papel: "mas_cercana" };
}

// ---------------------------------------------------------------------------
// Las cuatro medidas, cada una con su umbral al lado
// ---------------------------------------------------------------------------

export function medidasDe(
  decisiva: Candidata | null,
  umbrales: Umbrales,
  cobertura: Cobertura | null,
  /** Cómo escribir una clave del motor para un humano. Por defecto, tal cual. */
  escribirClave: (clave: string) => string = (c) => c,
): Medida[] {
  const pasaMayor = (v: number | null, u: number | null) =>
    v == null || u == null ? null : v + 1e-9 >= u;
  const pasaMenor = (v: number | null, u: number | null) =>
    v == null || u == null ? null : v <= u + 1e-9;

  const fraccion = decisiva?.fraccionObservable ?? null;

  return [
    {
      clave: "match_ruta",
      nombre: "Match de ruta",
      pregunta: "De la ruta contratada, ¿cuánta pisó la unidad?",
      valor: decisiva?.matchRutaPct ?? null,
      umbral: umbrales.matchMinPct,
      unidad: "pct",
      direccion: "mayor_mejor",
      escala: { min: 0, max: 100 },
      pasa: pasaMayor(decisiva?.matchRutaPct ?? null, umbrales.matchMinPct),
      // El match se califica sobre el tramo que la ventana alcanzó a observar.
      // Enseñar el porcentaje sin decir sobre qué se calculó es lo que hace
      // que un recorrido perfecto parezca reprobado.
      nota:
        fraccion != null
          ? fraccion >= 0.999
            ? "calculado sobre la ruta completa"
            : `calculado sobre el ${(fraccion * 100).toFixed(1)}% final de la ruta — el arranque no se observó`
          : umbrales.hayKml
            ? // Los hechos sellados antes de que el motor guardara esta cifra
              // no la traen. Se dice; suponer «ruta completa» sería afirmar
              // algo que el registro no sostiene.
              "el ledger de esta corrida no selló sobre qué tramo se calificó"
            : null,
    },
    {
      clave: "precision_corredor",
      nombre: "Precisión de corredor",
      pregunta: "De los puntos GPS, ¿cuántos cayeron dentro del corredor?",
      valor: decisiva?.precisionCorredorPct ?? null,
      umbral: umbrales.corredorMinPct,
      unidad: "pct",
      direccion: "mayor_mejor",
      escala: { min: 0, max: 100 },
      pasa: pasaMayor(decisiva?.precisionCorredorPct ?? null, umbrales.corredorMinPct),
      nota:
        umbrales.corredorMetros == null
          ? null
          : `corredor de ${umbrales.corredorMetros.toFixed(0)} m a cada lado del trazado — va contra la ruta completa`,
    },
    {
      clave: "forma",
      nombre: "Forma",
      pregunta: "¿Qué tanto se separó el recorrido del trazado, en el peor punto?",
      valor: decisiva?.frechetKm ?? null,
      umbral: umbrales.frechetMaxKm,
      unidad: "km",
      direccion: "menor_mejor",
      escala: { min: 0, max: Math.max(umbrales.frechetMaxKm ?? 0.8, decisiva?.frechetKm ?? 0) * 1.25 },
      pasa: pasaMenor(decisiva?.frechetKm ?? null, umbrales.frechetMaxKm),
      // La forma desempata el ranking; no condena por sí sola. Decirlo evita
      // que alguien lea un Fréchet alto como la causa del resultado.
      nota:
        decisiva?.similitudDireccion == null
          ? "desempata el ranking; no decide el resultado por sí sola"
          : `dirección media ${decisiva.similitudDireccion.toFixed(3)} de 1.000 · desempata el ranking, no decide el resultado`,
    },
    {
      clave: "cobertura",
      nombre: "Cobertura de evidencia",
      pregunta: "De la ventana, ¿cuánto tiempo hubo señal?",
      valor: cobertura?.pct ?? null,
      umbral: umbrales.coberturaMinPct,
      unidad: "pct",
      direccion: "mayor_mejor",
      escala: { min: 0, max: 100 },
      pasa: cobertura == null ? null : cobertura.suficiente,
      // Se nombra la candidata medida: el motor evalúa la cobertura por unidad
      // y se queda con la mejor, así que esta cifra puede no ser de la misma
      // candidata cuyo match se está leyendo arriba.
      nota:
        cobertura?.huecoMaxMinutos == null
          ? null
          : `hueco más largo ${cobertura.huecoMaxMinutos.toFixed(1)} min · se permiten ${(umbrales.huecoMaxMinutos ?? 10).toFixed(1)} min${
              cobertura.clave ? ` · medida sobre ${escribirClave(cobertura.clave)}` : ""
            }`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Por qué el motor decidió lo que decidió, en una línea
// ---------------------------------------------------------------------------

/**
 * Una sola frase construida SOLO con lo sellado. Cuando el ledger no alcanza
 * para explicar, la frase lo dice — un hueco declarado antes que una
 * explicación bonita que no sostiene el registro.
 */
export function porQueDecidio(entrada: {
  pasos: readonly LedgerStep[];
  candidatas: readonly Candidata[];
  decisiva: Candidata | null;
  umbrales: Umbrales;
  cobertura: Cobertura | null;
  decision: Decision | null;
  escribirClave?: (clave: string) => string;
}): string {
  const { pasos, candidatas, decisiva, umbrales, cobertura, decision } = entrada;
  const escribirClave = entrada.escribirClave ?? ((c: string) => c);

  const evidencia = pasos.find((p) => p.step === "evidencia");
  if (evidencia?.result === "indisponible") {
    return "Pendiente por evidencia: no entró un solo punto GPS en la ventana de observación. Sin evidencia no hay incumplimiento — hay una pregunta sin responder.";
  }

  if (cobertura && !cobertura.suficiente) {
    return `Pendiente por evidencia: la señal cubrió ${pct(cobertura.pct)} de la ventana y el contrato pide ${pct(umbrales.coberturaMinPct)}${
      cobertura.huecoMaxMinutos != null
        ? `; el hueco más largo fue de ${cobertura.huecoMaxMinutos.toFixed(1)} min contra ${(umbrales.huecoMaxMinutos ?? 10).toFixed(1)} min permitidos`
        : ""
    }. El motor se detuvo antes de mirar la ruta.`;
  }

  if (!decision) {
    return "Medición no disponible: el ledger de esta corrida no llegó completo, así que no se puede decir con qué números se decidió.";
  }

  if (decision.motivo === "observacion_insuficiente") {
    const f = decision.fraccionMasTempranaObservada;
    const t = decision.toleranciaDeOrigen;
    return `Pendiente por evidencia: la evidencia más temprana sobre el trazado aparece hasta el ${((f ?? 0) * 100).toFixed(1)}% de la ruta y se tolera hasta el ${((t ?? 0) * 100).toFixed(1)}% — la ventana abrió cuando el recorrido ya iba andando, así que el motor no puede saber si ese arranque se hizo o no.`;
  }

  if (decision.motivo === "llegada_sin_atribucion") {
    return "Pendiente por evidencia: una unidad sí entró a la geocerca, pero su recorrido no alcanza el mínimo de ninguna ruta, así que no se le puede atribuir este servicio.";
  }

  if (decision.motivo === "ninguna_unidad_sirvio") {
    return `No cumplido: ninguna de las ${candidatas.length} candidatas entró a la geocerca del contrato dentro de la ventana.`;
  }

  if (decision.motivo === "ninguna_unidad_coincidio_ruta") {
    if (!decisiva) {
      return `No cumplido: ninguna de las ${candidatas.length} candidatas alcanzó los dos umbrales de ruta.`;
    }
    const fallaMatch =
      decisiva.matchRutaPct != null &&
      umbrales.matchMinPct != null &&
      decisiva.matchRutaPct < umbrales.matchMinPct;
    const fallaCorredor =
      decisiva.precisionCorredorPct != null &&
      umbrales.corredorMinPct != null &&
      decisiva.precisionCorredorPct < umbrales.corredorMinPct;
    const cual =
      fallaMatch && fallaCorredor
        ? `quedó en match ${pct(decisiva.matchRutaPct)} (umbral ${pct(umbrales.matchMinPct)}) y corredor ${pct(decisiva.precisionCorredorPct)} (umbral ${pct(umbrales.corredorMinPct)})`
        : fallaMatch
          ? `pasó el corredor con ${pct(decisiva.precisionCorredorPct)} pero se quedó en match ${pct(decisiva.matchRutaPct)}, con umbral ${pct(umbrales.matchMinPct)}`
          : fallaCorredor
            ? `pasó el match con ${pct(decisiva.matchRutaPct)} pero se quedó en corredor ${pct(decisiva.precisionCorredorPct)}, con umbral ${pct(umbrales.corredorMinPct)}`
            : `no acreditó aun con match ${pct(decisiva.matchRutaPct)} y corredor ${pct(decisiva.precisionCorredorPct)}: el tramo observable no dio para calificar`;
    const sobre =
      decisiva.fraccionObservable != null && decisiva.fraccionObservable < 0.999
        ? `, y ese match se calificó sobre el ${(decisiva.fraccionObservable * 100).toFixed(1)}% de la ruta que la ventana alcanzó a ver`
        : "";
    return `No cumplido: de ${candidatas.length} candidatas ninguna alcanzó los dos umbrales de ruta; la más cercana ${cual}${sobre}.`;
  }

  if (decision.resultado === "cumplido") {
    const sobre =
      decisiva?.fraccionObservable != null && decisiva.fraccionObservable < 0.999
        ? ` — el match se calificó sobre el ${(decisiva.fraccionObservable * 100).toFixed(1)}% de la ruta que la ventana alcanzó a ver`
        : "";
    return `Cumplido: ${decision.claveObservada ? escribirClave(decision.claveObservada) : "la unidad acreditada"} sirvió la ruta con match ${pct(decisiva?.matchRutaPct ?? null)} (umbral ${pct(umbrales.matchMinPct)}) y corredor ${pct(decisiva?.precisionCorredorPct ?? null)} (umbral ${pct(umbrales.corredorMinPct)}), y entró a la geocerca${sobre}.`;
  }

  return `${decision.resultado}${decision.motivo ? ` · ${decision.motivo}` : ""}: el ledger no trae una razón que se pueda leer en una línea. Los pasos completos están abajo.`;
}

/** Arma la lectura completa a partir de los pasos sellados. */
export function leerElMotor(
  pasos: readonly LedgerStep[],
  escribirClave: (clave: string) => string = (c) => c,
): LecturaDelMotor {
  const candidatas = candidatasDeLosPasos(pasos);
  const umbrales = umbralesDeLosPasos(pasos);
  const cobertura = coberturaDeLosPasos(pasos);
  const decision = decisionDeLosPasos(pasos);
  const { candidata: decisiva, papel } = candidataDecisiva(candidatas, decision);

  return {
    candidatas,
    decisiva,
    papelDeLaDecisiva: papel,
    umbrales,
    cobertura,
    decision,
    medidas: medidasDe(decisiva, umbrales, cobertura, escribirClave),
    porQue: porQueDecidio({
      pasos,
      candidatas,
      decisiva,
      umbrales,
      cobertura,
      decision,
      escribirClave,
    }),
  };
}
