/**
 * Cómo se midió — los cuatro pasos del expediente del servicio.
 *
 * Proyección del razonamiento del árbitro para la cara CLIENTE.
 *
 * Por qué existe una proyección y no se pasa el ledger:
 * el ledger crudo trae, en sus pasos `candidata`, el IMEI de cada unidad que
 * *no* sirvió la ruta. Eso es flota del transportista, y Pieza 4 del Marco lo
 * prohíbe en la cara cliente. La compuerta del cargador se queda intacta: lo
 * que cruza es esto.
 *
 * La garantía de "cero candidatas perdedoras" es estructural, no un filtro:
 * esta función NUNCA lee el paso `candidata`. Todo lo del paso 1 sale de
 * `decision`, que describe solo a la ganadora. No hay filtro que se pueda
 * olvidar de correr.
 *
 * Y la unidad se nombra con la etiqueta legible que el cliente ya ve, jamás
 * con `decision.details.observedUnit`, que es un IMEI.
 *
 * Pura por diseño, como `leerCobertura`: entra lo que quedó escrito, sale lo
 * que se puede afirmar. No decide nada — el árbitro ya decidió.
 */

import { leerCobertura } from "@jtel/services";

/** Una medición con el umbral contra el que se comparó. Nunca una sin el otro. */
export type MedidaPaso = {
  etiqueta: string;
  valor: string;
  /** El umbral del contrato. `null` solo cuando el paso no tiene umbral que enunciar. */
  umbral: string | null;
};

export type PasoMedicion = {
  numero: 1 | 2 | 3 | 4;
  pregunta: string;
  /** `no_registrado` cuando el dato no quedó escrito. Nunca se infiere para rellenar. */
  estado: "medido" | "no_registrado";
  /** La lectura en palabras. El usuario lee, no calcula. */
  respuesta: string;
  medidas: MedidaPaso[];
  /** De dónde salió este paso. La pantalla no finge que los cuatro vienen del mismo lugar. */
  procedencia: string;
  /** Por qué falta, cuando falta. */
  nota: string | null;
};

/** Por qué no se pudo emparejar el ledger con este sello. */
export type RazonSinLedger = "no_entry" | "ambiguous" | "out_of_tolerance";

const RAZON_SIN_LEDGER: Record<RazonSinLedger, string> = {
  no_entry: "No quedó registrada la corrida de verificación que produjo este sello.",
  ambiguous:
    "Hay más de una corrida de verificación después del sello y no hay con qué desempatar cuál lo produjo.",
  out_of_tolerance:
    "La corrida de verificación más cercana quedó demasiado lejos del sello para atribuírsela.",
};

const PROCEDENCIA_LEDGER = "Registro de la verificación que produjo este sello";
const PROCEDENCIA_HECHO = "Hecho sellado y política congelada del contrato";

/** Exacto, nunca redondeado a la baja: un número con "~" se lee como estimación. */
function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Las duraciones se escriben como duraciones, jamás con formato de hora:
 * "10 min antes", nunca "10:00 antes" — que se leería como hora del día.
 */
function duracion(minutos: number): string {
  const abs = Math.abs(minutos);
  const horas = Math.floor(abs / 60);
  const mins = abs % 60;
  const redondeado = Number.isInteger(mins) ? String(mins) : mins.toFixed(1);
  if (horas === 0) return `${redondeado} min`;
  return `${horas} h ${redondeado} min`;
}

type PasoLedger = { step?: string; result?: string; details?: Record<string, unknown> };

function leerDecision(steps: unknown): PasoLedger["details"] | null {
  if (!Array.isArray(steps)) return null;
  const paso = (steps as PasoLedger[]).find((s) => s?.step === "decision");
  return paso?.details ?? null;
}

/** El motor escribe `evidencia: indisponible` cuando no llegó ni un punto. */
function evidenciaIndisponible(steps: unknown): boolean {
  if (!Array.isArray(steps)) return false;
  return (steps as PasoLedger[]).some(
    (s) => s?.step === "evidencia" && s?.result === "indisponible",
  );
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type EntradaPasos = {
  /** Los `steps` del ledger YA emparejado con este sello. `null` si no emparejó. */
  steps: unknown;
  /** Por qué no emparejó. `null` cuando sí emparejó. */
  razonSinLedger: RazonSinLedger | null;
  /** La etiqueta legible de la unidad. NUNCA el IMEI. */
  unidadObservadaLabel: string | null;
  /** Ya formateada con su fecha completa: un turno nocturno cruza la medianoche. */
  llegadaTexto: string | null;
  deadlineTexto: string | null;
  /** Positivo = llegó antes del deadline; negativo = llegó después. */
  margenMinutos: number | null;
  toleranciaMinutos: number | null;
  timing: string | null;
};

/**
 * Los cuatro pasos, cada uno con su procedencia declarada.
 *
 * Nunca devuelve menos de cuatro: un paso que no se pudo medir se devuelve
 * como `no_registrado` con su razón. Un hueco mudo y un paso medido no pueden
 * verse igual — esa es la diferencia entre declarar y ocultar.
 */
export function proyectarPasosMedicion(entrada: EntradaPasos): PasoMedicion[] {
  const {
    steps,
    razonSinLedger,
    unidadObservadaLabel,
    llegadaTexto,
    deadlineTexto,
    margenMinutos,
    toleranciaMinutos,
    timing,
  } = entrada;

  const notaSinLedger = razonSinLedger ? RAZON_SIN_LEDGER[razonSinLedger] : null;
  const decision = notaSinLedger ? null : leerDecision(steps);
  const cobertura = notaSinLedger ? null : leerCobertura(steps);

  // ── 1 · Qué unidad prestó el servicio ────────────────────────────────────
  // Solo de `decision`: describe a la ganadora y a nadie más.
  const pasoUnidad: PasoMedicion = (() => {
    const medidas: MedidaPaso[] = [];
    // Sin trazado contratado, el motor no compara contra nada: deja los
    // porcentajes en 100 como relleno y NO emite los mínimos. Mostrarlos sería
    // afirmar "coincidió perfecto con el trazado" de una ruta que no tiene
    // trazado — un número correcto sosteniendo algo falso. Se omiten.
    const hayTrazado = decision?.hasKml === true;
    const coincidencia = hayTrazado ? num(decision?.routeMatchPct) : null;
    const minCoincidencia = num(decision?.minKmlPct);
    const precision = hayTrazado ? num(decision?.corridorPrecisionPct) : null;
    const minPrecision = num(decision?.minCorridorPct);
    const corredorMetros = hayTrazado ? num(decision?.corridorMeters) : null;

    if (coincidencia != null) {
      medidas.push({
        etiqueta: "Coincidencia con el trazado",
        valor: pct(coincidencia),
        umbral: minCoincidencia != null ? `mínimo del contrato ${pct(minCoincidencia)}` : null,
      });
    }
    if (precision != null) {
      medidas.push({
        etiqueta: "Precisión de corredor",
        valor: pct(precision),
        umbral: minPrecision != null ? `mínimo del contrato ${pct(minPrecision)}` : null,
      });
    }
    if (corredorMetros != null) {
      medidas.push({
        etiqueta: "Ancho del corredor",
        valor: `${corredorMetros.toFixed(0)} m`,
        umbral: null,
      });
    }

    // Unidad acreditada pero sin trazado que comparar: se puede afirmar cuál
    // fue y por qué, sin inventar una medida de trazado.
    if (unidadObservadaLabel && !hayTrazado && decision) {
      return {
        numero: 1,
        pregunta: "¿Qué unidad prestó el servicio?",
        estado: "medido",
        respuesta: unidadObservadaLabel,
        medidas,
        procedencia: PROCEDENCIA_LEDGER,
        nota: "Esta ruta no tiene trazado contratado, así que no hubo contra qué comparar el recorrido. La unidad se acreditó por su entrada a la geocerca del destino.",
      };
    }

    if (!unidadObservadaLabel || medidas.length === 0) {
      return {
        numero: 1,
        pregunta: "¿Qué unidad prestó el servicio?",
        estado: "no_registrado",
        respuesta: unidadObservadaLabel
          ? unidadObservadaLabel
          : "No se acreditó una unidad para este servicio.",
        medidas,
        procedencia: PROCEDENCIA_LEDGER,
        nota:
          notaSinLedger ??
          "El árbitro no acreditó unidad en este sello, y sin unidad acreditada no hay medida de trazado que mostrar.",
      };
    }

    return {
      numero: 1,
      pregunta: "¿Qué unidad prestó el servicio?",
      estado: "medido",
      respuesta: unidadObservadaLabel,
      medidas,
      procedencia: PROCEDENCIA_LEDGER,
      // El método no se persiste con nombre: se muestran las dos medidas
      // contra sus mínimos en vez de citar una etiqueta que no existe.
      nota: null,
    };
  })();

  // ── 2 · Hubo evidencia suficiente ────────────────────────────────────────
  const pasoEvidencia: PasoMedicion = (() => {
    // Sin un solo punto en la ventana el motor corta antes de medir cobertura.
    // Eso NO es un dato faltante: es la respuesta, y es "no".
    if (!cobertura && evidenciaIndisponible(steps) && !notaSinLedger) {
      return {
        numero: 2,
        pregunta: "¿Hubo evidencia suficiente para juzgar?",
        estado: "medido",
        respuesta: "No. No se recibió ningún punto de evidencia en la ventana.",
        medidas: [],
        procedencia: PROCEDENCIA_LEDGER,
        nota: "Sin evidencia no hay incumplimiento: por eso este servicio quedó pendiente y no se juzgó.",
      };
    }

    if (!cobertura) {
      return {
        numero: 2,
        pregunta: "¿Hubo evidencia suficiente para juzgar?",
        estado: "no_registrado",
        respuesta: "No se registró la medición de cobertura para este servicio.",
        medidas: [],
        procedencia: PROCEDENCIA_LEDGER,
        // Sin afirmar la causa: este sello no la trae, y por qué no la trae no
        // se puede saber desde aquí. Inventar el motivo sería igual de falso
        // que inventar el número.
        nota:
          notaSinLedger ??
          "Este sello no trae la medición de cobertura. No se deriva de los puntos: lo que no se midió entonces no se inventa ahora.",
      };
    }

    const medidas: MedidaPaso[] = [
      {
        etiqueta: "Cobertura de la ventana",
        valor: pct(cobertura.pct),
        umbral: `mínimo del contrato ${pct(cobertura.minimoPct)}`,
      },
    ];
    if (cobertura.mayorHuecoMinutos != null) {
      medidas.push({
        etiqueta: "Hueco de señal más largo",
        valor: duracion(cobertura.mayorHuecoMinutos),
        umbral:
          cobertura.huecoMaximoPermitido != null
            ? `máximo del contrato ${duracion(cobertura.huecoMaximoPermitido)}`
            : null,
      });
    }

    const alcanza = cobertura.pct >= cobertura.minimoPct;
    return {
      numero: 2,
      pregunta: "¿Hubo evidencia suficiente para juzgar?",
      estado: "medido",
      respuesta: alcanza
        ? "Sí. La ventana quedó cubierta por encima del mínimo del contrato."
        : "No. La ventana no alcanzó el mínimo de cobertura del contrato.",
      medidas,
      procedencia: PROCEDENCIA_LEDGER,
      nota: null,
    };
  })();

  // ── 3 · Entró a la geocerca del destino ──────────────────────────────────
  // Sin radio, a propósito. `geofences` guarda un polígono, no un radio, y no
  // tiene versionado: el polígono de hoy no es necesariamente contra el que se
  // midió. Mostrarlo haría que el paso mienta sobre cómo se midió. La hora de
  // entrada sí es verdad congelada, y sola sigue siendo verdad.
  const pasoGeocerca: PasoMedicion = llegadaTexto
    ? {
        numero: 3,
        pregunta: "¿Entró a la geocerca del destino?",
        estado: "medido",
        respuesta: "Sí.",
        medidas: [{ etiqueta: "Hora de entrada", valor: llegadaTexto, umbral: null }],
        procedencia: PROCEDENCIA_HECHO,
        nota: "La forma de la geocerca no se archiva con el hecho, así que no se muestra: solo se afirma la hora, que sí quedó congelada.",
      }
    : {
        numero: 3,
        pregunta: "¿Entró a la geocerca del destino?",
        estado: "no_registrado",
        respuesta: "No quedó registrada una entrada a la geocerca del destino.",
        medidas: [],
        procedencia: PROCEDENCIA_HECHO,
        nota: null,
      };

  // ── 4 · Llegó dentro del plazo ───────────────────────────────────────────
  // No sale del ledger: el deadline y la tolerancia viven en el hecho y en la
  // política congelada. Es mejor así — es la política de ese día, no la de hoy.
  const pasoPlazo: PasoMedicion = (() => {
    if (!llegadaTexto || !deadlineTexto) {
      return {
        numero: 4,
        pregunta: "¿Llegó dentro del plazo acordado?",
        estado: "no_registrado",
        respuesta: "Sin llegada registrada no hay plazo contra el cual compararla.",
        medidas: deadlineTexto
          ? [{ etiqueta: "Plazo acordado", valor: deadlineTexto, umbral: null }]
          : [],
        procedencia: PROCEDENCIA_HECHO,
        nota: null,
      };
    }

    const medidas: MedidaPaso[] = [
      { etiqueta: "Llegada observada", valor: llegadaTexto, umbral: null },
      { etiqueta: "Plazo acordado", valor: deadlineTexto, umbral: null },
    ];
    if (margenMinutos != null) {
      medidas.push({
        etiqueta: "Margen",
        valor:
          margenMinutos >= 0
            ? `${duracion(margenMinutos)} antes`
            : `${duracion(margenMinutos)} de retraso`,
        umbral:
          toleranciaMinutos != null
            ? `tolerancia del contrato ±${duracion(toleranciaMinutos)}`
            : null,
      });
    }

    // La etiqueta nunca va sola: el carrier que se defiende necesita ver por
    // cuánto pasó o falló.
    const etiqueta =
      timing === "temprano"
        ? "Temprano"
        : timing === "a_tiempo"
          ? "A tiempo"
          : timing === "tarde"
            ? "Tarde"
            : null;
    const respuesta =
      etiqueta && margenMinutos != null
        ? `${etiqueta} · ${margenMinutos >= 0 ? `${duracion(margenMinutos)} antes del plazo` : `${duracion(margenMinutos)} después del plazo`}`
        : (etiqueta ?? "No se registró la puntualidad de esta llegada.");

    return {
      numero: 4,
      pregunta: "¿Llegó dentro del plazo acordado?",
      estado: etiqueta ? "medido" : "no_registrado",
      respuesta,
      medidas,
      procedencia: PROCEDENCIA_HECHO,
      nota: null,
    };
  })();

  return [pasoUnidad, pasoEvidencia, pasoGeocerca, pasoPlazo];
}
