import type { FranjaCapturada, SentidoDeFranja, TipoDeDiaCircuito } from "@jtel/domain";

/**
 * La captura de la promesa por franja (Marco 9.1c) en el expediente del
 * circuito de J-Staff — lo que la pantalla y la ruta necesitan y no es del
 * dominio: leer lo que llega del navegador, proponer una primera promesa y
 * decirla en palabras.
 *
 * **La promesa tiene UNA fuente: las franjas** (decisión de Asav, 21 sep 2026).
 * `circuits.declared_frequency_minutes` deja de ser promesa; mientras el PR B
 * no mude a Ontoy, esta pantalla enseña lado a lado lo que Ontoy publica hoy y
 * lo capturado aquí, para que el desacuerdo se vea y no pase callado.
 *
 * Guardar reusa `savePromiseTable` —todo o nada, contra el horario y sin
 * encimarse— y validar reusa `validarFranjas`. Aquí no vive una segunda regla.
 */

export const DIAS: ReadonlyArray<{ tipo: TipoDeDiaCircuito; nombre: string }> = [
  { tipo: "entre_semana", nombre: "Entre semana" },
  { tipo: "sabado", nombre: "Sábado" },
  { tipo: "domingo", nombre: "Domingo" },
];

export const SENTIDOS: ReadonlyArray<{ valor: SentidoDeFranja; nombre: string }> = [
  { valor: null, nombre: "Los dos sentidos" },
  { valor: "ida", nombre: "Sólo ida" },
  { valor: "vuelta", nombre: "Sólo vuelta" },
];

/** Tope de la frecuencia que se acepta: más de 3 h entre camiones no es un circuito, es un error de dedo. */
export const FRECUENCIA_MAX = 180;
/** Tope de franjas por versión: 3 días × 2 sentidos × varias franjas cabe de sobra. */
export const FRANJAS_MAX = 60;

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Lee las franjas que manda el navegador. No valida contra el horario ni el
 * traslape — eso es `validarFranjas`, al guardar —: aquí sólo se rechaza lo que
 * no es una franja. Y una franja que empieza cuando termina, o después, se
 * rechaza AQUÍ con su razón verdadera: el dominio la contaría como «fuera del
 * horario», que para quien captura sería una pista falsa.
 */
export function leerFranjasCapturadas(
  crudo: unknown,
): { ok: true; franjas: FranjaCapturada[] } | { ok: false; error: string } {
  if (!Array.isArray(crudo)) return { ok: false, error: "No llegaron franjas." };
  if (crudo.length > FRANJAS_MAX) return { ok: false, error: `Son más de ${FRANJAS_MAX} franjas.` };

  const franjas: FranjaCapturada[] = [];
  for (const [i, f] of crudo.entries()) {
    const n = i + 1;
    const x = (f ?? {}) as Record<string, unknown>;
    const diaTipo = x.diaTipo;
    if (!DIAS.some((d) => d.tipo === diaTipo)) return { ok: false, error: `La franja ${n} no dice qué tipo de día.` };
    const sentido = x.sentido ?? null;
    if (sentido !== null && sentido !== "ida" && sentido !== "vuelta") {
      return { ok: false, error: `La franja ${n} trae un sentido que no existe.` };
    }
    const desde = String(x.desdeLocal ?? "");
    const hasta = String(x.hastaLocal ?? "");
    if (!HORA.test(desde) || !HORA.test(hasta)) {
      return { ok: false, error: `La franja ${n} necesita hora de inicio y de fin, como 06:00.` };
    }
    if (desde.slice(0, 5) >= hasta.slice(0, 5)) {
      return {
        ok: false,
        error: `La franja ${n} (${desde.slice(0, 5)}–${hasta.slice(0, 5)}) termina antes de empezar. Si cruza la medianoche, decláralas como dos.`,
      };
    }
    const frecuencia = Number(x.frequencyMinutes);
    if (!Number.isInteger(frecuencia) || frecuencia < 1 || frecuencia > FRECUENCIA_MAX) {
      return { ok: false, error: `La franja ${n} necesita cada cuántos minutos, entre 1 y ${FRECUENCIA_MAX}.` };
    }
    franjas.push({
      diaTipo: diaTipo as TipoDeDiaCircuito,
      sentido: sentido as SentidoDeFranja,
      desdeLocal: desde.slice(0, 5),
      hastaLocal: hasta.slice(0, 5),
      frequencyMinutes: frecuencia,
    });
  }
  return { ok: true, franjas };
}

/**
 * La propuesta para un circuito que ya declaraba un número único y no tiene
 * franjas: ese número, todo el horario, los tres tipos de día. **Es una
 * propuesta, no una conversión**: llega prellenada y un humano la guarda. Con
 * horario nocturno no se propone nada —una franja no cruza la medianoche, y
 * partirla en dos por quien captura es decidir por él.
 */
export function propuestaDesdeNumero(
  numero: number | null,
  horario: { inicioLocal: string; finLocal: string },
): FranjaCapturada[] {
  const inicio = horario.inicioLocal.slice(0, 5);
  const fin = horario.finLocal.slice(0, 5);
  if (numero === null || inicio >= fin) return [];
  return DIAS.map((d) => ({
    diaTipo: d.tipo,
    sentido: null,
    desdeLocal: inicio,
    hastaLocal: fin,
    frequencyMinutes: numero,
  }));
}

/** «06:00–09:00 · cada 10 min · los dos sentidos». */
export function franjaEnPalabras(f: FranjaCapturada): string {
  const sentido = SENTIDOS.find((s) => s.valor === f.sentido)?.nombre.toLowerCase() ?? "los dos sentidos";
  return `${f.desdeLocal.slice(0, 5)}–${f.hastaLocal.slice(0, 5)} · cada ${f.frequencyMinutes} min · ${sentido}`;
}
