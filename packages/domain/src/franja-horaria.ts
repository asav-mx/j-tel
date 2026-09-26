/**
 * La promesa de un circuito por franja horaria (Marco 9.1c).
 *
 * Hasta la 0044, un circuito prometía **un solo número para todo el día**
 * (`circuits.declared_frequency_minutes`). El Marco manda otra cosa: la tabla
 * publicada puede prometer distinto por franja —«cada 10 min de 6 a 9; cada
 * 20 el resto del día»—, y lo medido se juzga contra la promesa vigente de
 * **esa** franja, nunca contra un promedio del día. Juzgar la hora pico con la
 * tabla del valle es la afirmación falsa del alcance (Marco §D).
 *
 * Tres decisiones de Asav (20-sep-2026), y las tres viven aquí:
 *
 * 1. **La promesa es un conjunto que se lee completo** — no una franja suelta.
 *    Aquí no hay «versionar el renglón»: quien pide la promesa vigente recibe
 *    todas las franjas de una vez, nunca una mezcla de dos versiones.
 * 2. **Distingue día**: entre semana, sábado o domingo. Nunca los siete días.
 * 3. **El horario de servicio manda.** Una franja fuera de él se rechaza al
 *    capturar, con su razón — nunca en silencio. Y un hueco dentro del
 *    horario que ninguna franja cubre es «sin promesa declarada» para ese
 *    tramo: no se rellena con la franja vecina.
 *
 * Las horas se comparan como texto `HH:MM`, igual que `enHorarioDeServicio`:
 * en 24 horas con cero a la izquierda, el orden de texto es el del reloj, y
 * construir fechas para compararlas obligaría a inventar un día por nada.
 */

import { addDaysIso, instanteZonificado, localDateIso, localTimeHHMM, tipoDeDiaLocal, type TipoDeDiaCivil } from "./tiempo.js";

export type TipoDeDiaCircuito = TipoDeDiaCivil;

export type SentidoDeFranja = "ida" | "vuelta" | null;

/** Una franja tal como se captura: sin id, sin vigencia — sólo la promesa. */
export interface FranjaCapturada {
  diaTipo: TipoDeDiaCircuito;
  /** `null` = promete igual en los dos sentidos. */
  sentido: SentidoDeFranja;
  /** `HH:MM` o `HH:MM:SS`, hora local del circuito. */
  desdeLocal: string;
  hastaLocal: string;
  frequencyMinutes: number;
}

// ── Por qué se rechaza una franja al capturar ────────────────────────────

export type RazonRechazoFranja =
  /** Cae, total o parcialmente, fuera del horario de servicio del circuito. */
  | "fuera_de_horario_de_servicio"
  /** Se encima con otra franja del mismo día y el mismo sentido efectivo. */
  | "se_encima_con_otra";

export interface FranjaRechazada {
  franja: FranjaCapturada;
  motivo: RazonRechazoFranja;
}

/** Cómo se lee en la pantalla, para que quien captura entienda sin adivinar. */
export function explicarRechazoFranja(r: FranjaRechazada): string {
  const rango = `${r.franja.desdeLocal.slice(0, 5)}–${r.franja.hastaLocal.slice(0, 5)}`;
  switch (r.motivo) {
    case "fuera_de_horario_de_servicio":
      return `La franja ${rango} cae fuera del horario de servicio del circuito.`;
    case "se_encima_con_otra":
      return `La franja ${rango} se encima con otra franja del mismo día.`;
  }
}

/**
 * ¿Una franja cabe ENTERA dentro del horario de servicio?
 *
 * **Aguanta que el horario cruce la medianoche**, igual que
 * `enHorarioDeServicio`: un servicio de 22:00 a 06:00 es real, y una
 * comparación ingenua rechazaría cualquier franja de la madrugada. Las
 * franjas mismas NO cruzan medianoche — es la simplificación de esta primera
 * versión, y una franja así se declara como dos.
 *
 * Contención completa, no traslape: una franja que empieza antes de que abra
 * el circuito, aunque termine dentro del horario, se rechaza entera. Aceptar
 * el pedazo que sí cabe sería inventar una franja que nadie declaró.
 */
export function franjaDentroDelHorario(
  franja: Pick<FranjaCapturada, "desdeLocal" | "hastaLocal">,
  inicioServicioLocal: string,
  finServicioLocal: string,
): boolean {
  const desde = franja.desdeLocal.slice(0, 5);
  const hasta = franja.hastaLocal.slice(0, 5);
  if (desde >= hasta) return false; // la franja misma no cruza medianoche.

  const inicio = inicioServicioLocal.slice(0, 5);
  const fin = finServicioLocal.slice(0, 5);
  if (inicio === fin) return true; // servicio 24 h: todo cabe.

  if (inicio < fin) {
    // Horario normal, sin cruzar medianoche.
    return desde >= inicio && hasta <= fin;
  }
  // Horario nocturno (cruza medianoche): la franja cabe si vive entera en el
  // tramo de la noche (desde el inicio hasta medianoche) o entera en el tramo
  // de la madrugada (desde medianoche hasta el fin).
  return desde >= inicio || hasta <= fin;
}

/** ¿Dos franjas se refieren al mismo sentido, o al menos una promete a los dos? */
function mismoSentidoEfectivo(a: SentidoDeFranja, b: SentidoDeFranja): boolean {
  return a === null || b === null || a === b;
}

/** ¿Dos intervalos `[desde, hasta)` se traslapan, comparando como `HH:MM`? */
function seTraslapan(
  a: Pick<FranjaCapturada, "desdeLocal" | "hastaLocal">,
  b: Pick<FranjaCapturada, "desdeLocal" | "hastaLocal">,
): boolean {
  const aDesde = a.desdeLocal.slice(0, 5);
  const aHasta = a.hastaLocal.slice(0, 5);
  const bDesde = b.desdeLocal.slice(0, 5);
  const bHasta = b.hastaLocal.slice(0, 5);
  return aDesde < bHasta && bDesde < aHasta;
}

/**
 * Valida un conjunto de franjas antes de guardarlo. Nunca en silencio
 * (decisión 3 de Asav, 20-sep): cada franja inválida sale con su motivo.
 *
 * **Todo o nada, la decide quien llama.** Esta función sólo separa válidas de
 * rechazadas; no decide si guardar las válidas y avisar de las rechazadas, o
 * rechazar el conjunto entero. La pantalla es quien tiene que decírselo a un
 * humano — aquí sólo vive el criterio.
 *
 * El traslape entre franjas NO lo pidió Asav en sus tres decisiones, pero se
 * rechaza igual: dos franjas del mismo día y sentido cubriendo el mismo
 * instante vuelve ambigua «la promesa vigente en ese instante», que es
 * justo lo que 9.1c existe para que nunca lo sea. Es la misma familia que el
 * candado de «una vigente» que ya sostiene la base en paradas y asignaciones.
 */
export function validarFranjas(
  franjas: FranjaCapturada[],
  horario: { inicioLocal: string; finLocal: string },
): { validas: FranjaCapturada[]; rechazadas: FranjaRechazada[] } {
  const validas: FranjaCapturada[] = [];
  const rechazadas: FranjaRechazada[] = [];

  for (const franja of franjas) {
    if (!franjaDentroDelHorario(franja, horario.inicioLocal, horario.finLocal)) {
      rechazadas.push({ franja, motivo: "fuera_de_horario_de_servicio" });
      continue;
    }

    const seEncima = validas.some(
      (v) =>
        v.diaTipo === franja.diaTipo &&
        mismoSentidoEfectivo(v.sentido, franja.sentido) &&
        seTraslapan(v, franja),
    );
    if (seEncima) {
      rechazadas.push({ franja, motivo: "se_encima_con_otra" });
      continue;
    }

    validas.push(franja);
  }

  return { validas, rechazadas };
}

// ── Leer la promesa en un instante ───────────────────────────────────────

export type PromesaEnInstante =
  | { declarada: true; frequencyMinutes: number; franja: FranjaCapturada }
  /**
   * El instante cae DENTRO del horario de servicio, y ninguna franja lo
   * cubre. Es la respuesta honesta de la decisión 3: no se rellena con la
   * franja vecina. Distinto de estar fuera de horario, que es otra pregunta
   * (`enHorarioDeServicio`) y no la contesta esta función.
   */
  | { declarada: false };

/**
 * La promesa vigente para un día, una hora y un sentido — o la declaración
 * honesta de que no hay ninguna.
 *
 * No mira el horario de servicio: eso ya lo decidió `franjaDentroDelHorario`
 * al capturar, y quien llama decide aparte si el instante está en horario.
 * Aquí sólo se busca, entre las franjas ya válidas de ese día, la que cubre
 * la hora pedida.
 */
/**
 * **Hasta dónde llega una franja, para LEERLA** — con el fin del día incluido.
 *
 * Las franjas son `[desde, hasta)` y se comparan en `HH:MM`. Eso deja fuera,
 * sin querer, el último minuto del día: una franja capturada «todo el día»
 * como 00:00–23:59 no cubría las 23:59, y durante ese minuto la app decía «Sin
 * frecuencia publicada para esta hora» de una ruta que sí la publica
 * (auditoría a1, 26-sep; lo destapó una prueba que corrió a las 23:59).
 *
 * **Un «hasta» de 23:59 —con cualquier segundo— se lee como fin del día.** No
 * sólo 23:59:59: el editor de J-Staff captura con `<input type="time">`, que no
 * puede escribir 24:00, así que «hasta el final del día» se guarda como 23:59
 * (`23:59:00` en la base). Una franja que de verdad quisiera terminar a las
 * 23:59 y no un minuto después no se puede distinguir de ésa, y la que se
 * escribe es la de todo el día.
 *
 * Sólo para leer la promesa. Validar al capturar sigue comparando lo escrito.
 */
export function hastaParaLeer(hastaLocal: string): string {
  const hasta = hastaLocal.slice(0, 5);
  return hasta === "23:59" ? "24:00" : hasta;
}

export function promesaEnInstante(
  franjas: FranjaCapturada[],
  entrada: { diaTipo: TipoDeDiaCircuito; horaLocal: string; sentido: "ida" | "vuelta" },
): PromesaEnInstante {
  const hora = entrada.horaLocal.slice(0, 5);
  const franja = franjas.find(
    (f) =>
      f.diaTipo === entrada.diaTipo &&
      (f.sentido === null || f.sentido === entrada.sentido) &&
      f.desdeLocal.slice(0, 5) <= hora &&
      hora < hastaParaLeer(f.hastaLocal),
  );
  if (!franja) return { declarada: false };
  return { declarada: true, frequencyMinutes: franja.frequencyMinutes, franja };
}

// ── La promesa de AHORA, para quien la publica ───────────────────────────

/**
 * La promesa que se le dice al pasajero en este momento (Pieza 8.2), leída de
 * **la única fuente de la promesa: las franjas** (decisión de Asav, 21 sep
 * 2026). `circuits.declared_frequency_minutes` ya no es promesa.
 *
 * Tres casos, y no se funden:
 *
 * - `sin_capturar` — el circuito no tiene ninguna promesa vigente. Ontoy dice
 *   que la ruta no publica cada cuánto pasa; nunca inventa una cadencia.
 * - `sin_franja` — hay promesa, pero ninguna franja cubre esta hora en ningún
 *   sentido. Es la decisión 3 del 20-sep: ese tramo no tiene promesa, y no se
 *   rellena con la franja vecina.
 * - `declarada` — los minutos de cada sentido; `null` en el sentido que esta
 *   hora no cubre.
 *
 * Por sentido y no un solo número porque una franja puede prometer distinto a
 * la ida y a la vuelta: fundirlos sería el promedio que el 9.1c prohíbe.
 */
export type PromesaAhora =
  | { estado: "sin_capturar" }
  | { estado: "sin_franja" }
  | { estado: "declarada"; ida: number | null; vuelta: number | null };

export function promesaAhora(
  franjasVigentes: FranjaCapturada[] | null,
  instante: Date,
  zona: string,
): PromesaAhora {
  if (franjasVigentes === null) return { estado: "sin_capturar" };
  const cuando = { diaTipo: tipoDeDiaLocal(instante, zona), horaLocal: localTimeHHMM(instante, zona) };
  const minutos = (sentido: "ida" | "vuelta") => {
    const p = promesaEnInstante(franjasVigentes, { ...cuando, sentido });
    return p.declarada ? p.frequencyMinutes : null;
  };
  const ida = minutos("ida");
  const vuelta = minutos("vuelta");
  if (ida === null && vuelta === null) return { estado: "sin_franja" };
  return { estado: "declarada", ida, vuelta };
}

// ── Hasta cuándo vale lo que se publicó ──────────────────────────────────

/**
 * El primer instante, después de `instante`, en que lo que una pantalla dice
 * de un circuito PUEDE cambiar: el inicio o el fin de una franja, la apertura o
 * el cierre del servicio, o la medianoche local (cambia el tipo de día y la
 * fecha de arranque). Nació para la lista de rutas de Ontoy: se arma una vez en
 * el servidor, y sin esto se quedaba diciendo la promesa de una franja que ya
 * terminó — afirmar algo que ya no es cierto.
 *
 * No decide QUÉ cambia, sólo CUÁNDO puede cambiar: una frontera de más cuesta
 * un refresco de más, una de menos cuesta una afirmación falsa. Por eso entran
 * las horas de todas las franjas sin filtrar por tipo de día.
 *
 * `horasLocales` en `HH:MM` o `HH:MM:SS`, del reloj del circuito.
 */
export function proximaFronteraDeLoPublicado(horasLocales: string[], instante: Date, zona: string): Date {
  const hoy = localDateIso(instante, zona);
  const medianoche = instanteZonificado(addDaysIso(hoy, 1), 0, zona);
  let proxima = medianoche;
  for (const h of horasLocales) {
    const [hh, mm] = h.slice(0, 5).split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const t = instanteZonificado(hoy, hh! * 60 + mm!, zona);
    if (t.getTime() > instante.getTime() && t.getTime() < proxima.getTime()) proxima = t;
  }
  return proxima;
}

/**
 * **Lo que Ontoy le dice al pasajero de la promesa — en un solo lugar**
 * (21-sep-2026). Vivía en la app pública; el expediente de J-Staff la enseña
 * («Ontoy ahorita dice: …») y la pantalla vieja tenía una copia que ya se había
 * separado en el caso de ida y vuelta distintas. Una sola frase, leída por los
 * dos lados.
 *
 * - sin capturar: la ruta no publica frecuencia;
 * - sin franja a esta hora: no se rellena con la franja vecina;
 * - declarada: la del sentido pedido; sin sentido, las dos si difieren — nunca
 *   un promedio.
 *
 * `null` mientras no llega: no se dice nada que no se sabe.
 *
 * ✎ **26-sep-2026:** «Pasa cada 12 min», como la lámina 1/02 (antes «Frecuencia ·
 * cada 12 min»). La lámina dibuja un rango («12–15»); aquí **no hay rango** porque
 * el dato no lo tiene: la franja guarda UN número por sentido, y partir de un
 * número para decir dos sería inventar (ASAV). Si algún día la captura permite
 * declarar un rango, la frase lo dirá. La firma («· según la concesión») la pone
 * cada pantalla del pasajero, sólo sobre lo declarado.
 */
export function promesaEnPalabras(promesa: PromesaAhora | null, sentido: "ida" | "vuelta" | null): string | null {
  if (!promesa) return null;
  if (promesa.estado === "sin_capturar") return "Esta ruta no publica cada cuánto pasa";
  if (promesa.estado === "sin_franja") return "Sin frecuencia publicada para esta hora";
  const cada = (n: number | null) => (n === null ? "sin frecuencia a esta hora" : `cada ${n} min`);
  if (sentido) {
    const n = promesa[sentido];
    return n === null ? "Sin frecuencia publicada para esta hora" : `Pasa cada ${n} min`;
  }
  /* Los dos vacíos no son «iguales»: antes esto decía «cada null min». */
  if (promesa.ida === null && promesa.vuelta === null) return "Sin frecuencia publicada para esta hora";
  if (promesa.ida === promesa.vuelta) return `Pasa cada ${promesa.ida} min`;
  return `Pasa de ida ${cada(promesa.ida)} · de vuelta ${cada(promesa.vuelta)}`;
}
