import { pegarAlTrazado, proyectarSobreTrazado } from "@jtel/domain";

/**
 * Pegar una parada **al trazado de su sentido** — la regla que usan crear y
 * corregir, en un solo lugar.
 *
 * Nació de Oasis (21 sep 2026): la pantalla nunca preguntaba el sentido, el
 * servidor guardaba «de los dos» y la pegaba a la ida. En Oasis la ida y la
 * vuelta van por calles distintas, así que la vuelta terminaba con paradas
 * inventadas sobre la calle equivocada. Y mover una parada también la pegaba a
 * la ida, fuera cual fuera su sentido.
 *
 * Tres reglas:
 *
 * 1. **El sentido no tiene valor por defecto.** Sin él, la parada no se crea:
 *    «ambos» es una respuesta que alguien da, no lo que queda cuando nadie
 *    contestó.
 * 2. **Se pega al trazado de ESE sentido**, y si ese trazado no existe se dice,
 *    en vez de pegarla al otro.
 * 3. **«Ambos» se pega a la ida y se mide contra la vuelta**: si queda lejos,
 *    se avisa — quizá no sirve a los dos.
 */

/** `null` = sirve a los dos sentidos. */
export type SentidoDeParada = "ida" | "vuelta" | null;

type Trazado = { sentido: string; coordinates: unknown };
const coords = (t: Trazado) => t.coordinates as Array<[number, number]>;
const nombre = (s: "ida" | "vuelta") => (s === "ida" ? "la ida" : "la vuelta");

/**
 * Lee el sentido de un cuerpo. **Tiene que venir**: ausente es un error, no
 * «ambos». `null` sí es válido: es «ambos», dicho a propósito.
 */
export function leerSentido(cuerpo: Record<string, unknown>): { ok: true; sentido: SentidoDeParada } | { ok: false } {
  if (!("sentido" in cuerpo)) return { ok: false };
  const s = cuerpo.sentido;
  if (s === null || s === "ida" || s === "vuelta") return { ok: true, sentido: s };
  return { ok: false };
}

/**
 * Dónde queda una parada puesta en `punto` con `sentido`, y qué avisar.
 * `sinPegar` respeta la decisión de quien editó de soltar el pegado.
 */
export function pegarParadaASuSentido(entrada: {
  punto: { lat: number; lon: number };
  sentido: SentidoDeParada;
  trazados: Trazado[];
  toleranciaMetros: number;
  sinPegar?: boolean;
}):
  | { ok: true; destino: { lat: number; lon: number }; avisos: string[] }
  | { ok: false; error: string } {
  const { punto, sentido, trazados, toleranciaMetros } = entrada;
  const deIda = trazados.find((t) => t.sentido === "ida");
  const deVuelta = trazados.find((t) => t.sentido === "vuelta");
  const principal = sentido === "vuelta" ? deVuelta : deIda;
  if (!principal) {
    return {
      ok: false,
      error: `Este circuito no tiene trazado de ${nombre(sentido === "vuelta" ? "vuelta" : "ida")}: súbelo antes de poner paradas de ese sentido.`,
    };
  }

  const avisos: string[] = [];
  let destino = punto;
  if (!entrada.sinPegar) {
    const pegado = pegarAlTrazado(punto, coords(principal), toleranciaMetros);
    if (pegado) {
      destino = { lat: pegado.proyeccion.lat, lon: pegado.proyeccion.lon };
      if (pegado.aviso) avisos.push(pegado.aviso);
    }
  }

  if (sentido === null && deVuelta) {
    const aviso = avisoDeLejania(destino, "vuelta", deVuelta, toleranciaMetros, "ambos");
    if (aviso) avisos.push(aviso);
  }
  return { ok: true, destino, avisos };
}

/**
 * Qué avisar cuando a una parada se le CORRIGE el sentido sin moverla: si su
 * lugar de hoy queda lejos del trazado (o los trazados) del sentido nuevo, lo
 * dice con los metros — la parada no se mueve sola, hay que moverla.
 */
export function avisosAlCorregirSentido(entrada: {
  punto: { lat: number; lon: number };
  sentido: SentidoDeParada;
  trazados: Trazado[];
  toleranciaMetros: number;
}): string[] {
  const avisos: string[] = [];
  for (const s of entrada.sentido === null ? (["ida", "vuelta"] as const) : [entrada.sentido]) {
    const t = entrada.trazados.find((x) => x.sentido === s);
    if (!t) {
      avisos.push(`Este circuito no tiene trazado de ${nombre(s)}.`);
      continue;
    }
    const aviso = avisoDeLejania(entrada.punto, s, t, entrada.toleranciaMetros, "corregir");
    if (aviso) avisos.push(aviso);
  }
  return avisos;
}

function avisoDeLejania(
  punto: { lat: number; lon: number },
  s: "ida" | "vuelta",
  trazado: Trazado,
  toleranciaMetros: number,
  caso: "ambos" | "corregir",
): string | null {
  const p = proyectarSobreTrazado(punto, coords(trazado));
  if (!p || p.distanciaMetros <= toleranciaMetros) return null;
  const metros = Math.round(p.distanciaMetros);
  return caso === "ambos"
    ? `Queda a ${metros} m del trazado de ${nombre(s)} (la tolerancia es ${toleranciaMetros} m): ¿de verdad sirve a los dos sentidos?`
    : `Queda a ${metros} m del trazado de ${nombre(s)}: muévela a donde va de verdad.`;
}
