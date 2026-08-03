/**
 * Salud de la señal de una unidad — la sección más valiosa del expediente.
 *
 * Responde algo que no depende del árbitro y que el transportista no puede
 * sacar de ningún otro lado: **¿este camión se ve, y desde cuándo deja de
 * verse?** Es telemetría cruda; ningún veredicto entra aquí.
 *
 * ── La lectura declarada, y su condición ────────────────────────────────────
 *
 * La ficha pide que, *cuando el patrón lo sostenga*, la pantalla enuncie la
 * conclusión: *"cambiar el rastreador en mayo no resolvió los huecos: la unidad
 * los concentra antes y después, así que el problema no es el aparato."* Eso le
 * sirve al carrier porque le dice **dónde no buscar**.
 *
 * Medido el 2026-08-02 contra producción: de **82 unidades, ninguna ha cambiado
 * de rastreador** — 82 asignaciones, 82 abiertas, cero cerradas. El modelo lo
 * soporta (`deviceAssignments` tiene `validFrom`/`validTo`); es que el hecho no
 * ha ocurrido.
 *
 * Así que la lectura se construye condicional, y su ausencia también informa:
 * si una unidad concentra huecos y su aparato lleva ahí desde el alta, eso ya
 * le dice al transportista que no hay un cambio de equipo al cual atribuirlos.
 *
 * **Nunca dicta la causa.** Se reporta el hecho y, cuando hay un cambio de
 * equipo, si el patrón se movió o no. "El aparato no es" es una conclusión que
 * los datos sostienen; "el chofer apaga el GPS" no lo es, y no se escribe.
 */

export type MesDeSenal = {
  /** `YYYY-MM`, cortado en el reloj de la operación. */
  mes: string;
  puntos: number;
  huecos: number;
  minutosSinVer: number;
};

export type PeriodoDeRastreador = {
  imei: string;
  etiqueta: string | null;
  desde: Date;
  /** `null` = sigue instalado. */
  hasta: Date | null;
};

export type BarraDeMes = {
  mes: string;
  /** El mes escrito para leerse: "julio 2026". */
  etiqueta: string;
  huecos: number;
  minutosSinVer: number;
  puntos: number;
  /** Alto relativo de la barra, 0–1, contra el peor mes de la serie. */
  proporcion: number;
  /** Verdadero cuando en este mes se instaló otro rastreador. */
  cambioDeRastreador: boolean;
};

export type SaludDeSenal = {
  barras: BarraDeMes[];
  /** El peor mes, para poner la escala al lado de las barras. */
  maximoHuecos: number;
  totalHuecos: number;
  totalMinutos: number;
  /**
   * La lectura declarada, o `null` cuando el patrón no la sostiene.
   *
   * Nunca se escribe una conclusión que los datos no aguanten: sin cambio de
   * rastreador no hay antes ni después que comparar, y sin meses suficientes a
   * cada lado tampoco.
   */
  lectura: string | null;
  /**
   * Por qué NO hay lectura. Se muestra: una sección que calla deja a quien
   * mira suponiendo que el sistema no supo, en vez de que no había qué decir.
   */
  sinLectura: string | null;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-07" → "julio 2026". Sin `Date`: la cadena ya viene en el reloj bueno. */
export function nombreDeMes(mes: string): string {
  const [anio, mm] = mes.split("-");
  const i = Number(mm) - 1;
  return i >= 0 && i < 12 ? `${MESES[i]} ${anio}` : mes;
}

/** El mes civil (`YYYY-MM`) de un instante, en el reloj que se le pase. */
export function mesDeInstante(d: Date, timeZone: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const anio = partes.find((p) => p.type === "year")?.value ?? "";
  const mm = partes.find((p) => p.type === "month")?.value ?? "";
  return `${anio}-${mm}`;
}

/**
 * Cuántos meses de datos hacen falta a cada lado de un cambio de rastreador
 * para poder decir si el cambio sirvió.
 *
 * Dos y no uno: con un solo mes de cada lado, un mes flojo por cualquier otra
 * razón —una unidad parada en el taller, una semana de lluvias— se leería como
 * el efecto del cambio. La afirmación se publica o no se publica; no se publica
 * a medias con un "parece que".
 */
export const MESES_MINIMOS_POR_LADO = 2;

export function construirSaludSenal(entrada: {
  meses: MesDeSenal[];
  rastreadores: PeriodoDeRastreador[];
  timeZone: string;
}): SaludDeSenal {
  const { meses, rastreadores, timeZone } = entrada;

  // Un cambio de rastreador es una instalación que NO es la primera: la
  // primera es el alta de la unidad, no un cambio.
  const instalaciones = [...rastreadores]
    .sort((a, b) => a.desde.getTime() - b.desde.getTime())
    .slice(1)
    .map((r) => mesDeInstante(r.desde, timeZone));
  const mesesConCambio = new Set(instalaciones);

  const maximoHuecos = meses.reduce((m, x) => Math.max(m, x.huecos), 0);

  const barras: BarraDeMes[] = meses.map((m) => ({
    mes: m.mes,
    etiqueta: nombreDeMes(m.mes),
    huecos: m.huecos,
    minutosSinVer: m.minutosSinVer,
    puntos: m.puntos,
    proporcion: maximoHuecos === 0 ? 0 : m.huecos / maximoHuecos,
    cambioDeRastreador: mesesConCambio.has(m.mes),
  }));

  const totalHuecos = meses.reduce((s, m) => s + m.huecos, 0);
  const totalMinutos = meses.reduce((s, m) => s + m.minutosSinVer, 0);

  const { lectura, sinLectura } = leer(barras, rastreadores);

  return { barras, maximoHuecos, totalHuecos, totalMinutos, lectura, sinLectura };
}

function leer(
  barras: BarraDeMes[],
  rastreadores: PeriodoDeRastreador[],
): { lectura: string | null; sinLectura: string | null } {
  if (barras.length === 0) {
    return {
      lectura: null,
      sinLectura: "Esta unidad no tiene un solo punto en el archivo, así que no hay señal que medir.",
    };
  }

  const indiceCambio = barras.findIndex((b) => b.cambioDeRastreador);

  if (indiceCambio === -1) {
    // La ausencia informa, y por eso se escribe en vez de callarse: le dice al
    // transportista que no hay un cambio de equipo al cual atribuir los huecos.
    return {
      lectura: null,
      sinLectura:
        rastreadores.length <= 1
          ? "Esta unidad ha traído el mismo rastreador desde su alta: no hay un cambio de equipo al que atribuir los huecos."
          : "Los cambios de rastreador de esta unidad caen fuera del periodo que se está mirando.",
    };
  }

  const antes = barras.slice(0, indiceCambio);
  const despues = barras.slice(indiceCambio);
  if (antes.length < MESES_MINIMOS_POR_LADO || despues.length < MESES_MINIMOS_POR_LADO) {
    return {
      lectura: null,
      sinLectura: `Hay un cambio de rastreador en ${barras[indiceCambio]!.etiqueta}, pero todavía no hay ${MESES_MINIMOS_POR_LADO} meses de cada lado para decir si sirvió.`,
    };
  }

  const promedio = (xs: BarraDeMes[]) => xs.reduce((s, b) => s + b.huecos, 0) / xs.length;
  const antesProm = promedio(antes);
  const despuesProm = promedio(despues);
  const mes = barras[indiceCambio]!.etiqueta;

  // El umbral de "cambió de verdad": una tercera parte. Por debajo de eso, dos
  // promedios distintos son ruido de meses con distinta operación, no efecto
  // del aparato.
  const bajo = despuesProm <= antesProm * (2 / 3);
  const subio = despuesProm >= antesProm * (4 / 3);

  if (bajo) {
    return {
      lectura: `Cambiar el rastreador en ${mes} bajó los huecos: ${antesProm.toFixed(1)} al mes antes contra ${despuesProm.toFixed(1)} después.`,
      sinLectura: null,
    };
  }
  if (subio) {
    return {
      lectura: `Los huecos subieron después de cambiar el rastreador en ${mes}: ${antesProm.toFixed(1)} al mes antes contra ${despuesProm.toFixed(1)} después.`,
      sinLectura: null,
    };
  }
  return {
    lectura: `Cambiar el rastreador en ${mes} no movió los huecos: ${antesProm.toFixed(1)} al mes antes contra ${despuesProm.toFixed(1)} después. El problema no es el aparato.`,
    sinLectura: null,
  };
}
