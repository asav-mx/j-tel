"use client";

/**
 * El pip **sale del aparato del camión, nunca del teléfono del pasajero.**
 *
 * No es un detalle de implementación: es la regla del diseño. Si el sonido y el
 * verde salieran de la pantalla del pasajero, una grabación bastaría para
 * engañar a un chofer que va manejando y sólo oye. Por eso el lector hace su
 * propio ruido, y por eso este archivo vive del lado del lector.
 *
 * El navegador no deja sonar hasta que alguien toca la pantalla, así que el
 * contexto se abre con el botón de encender el lector — que es el mismo gesto
 * con el que se pide la cámara.
 */

let contexto: AudioContext | null = null;

export function despertarElSonido(): void {
  try {
    contexto ??= new AudioContext();
    void contexto.resume();
  } catch {
    /* sin sonido, el lector sigue: queda el semáforo */
  }
}

function tono(frecuencia: number, desde: number, duracion: number): void {
  if (!contexto) return;
  const t = contexto.currentTime + desde;
  const oscilador = contexto.createOscillator();
  const ganancia = contexto.createGain();
  oscilador.type = "square";
  oscilador.frequency.value = frecuencia;
  ganancia.gain.setValueAtTime(0.0001, t);
  ganancia.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  oscilador.connect(ganancia).connect(contexto.destination);
  oscilador.start(t);
  oscilador.stop(t + duracion + 0.05);
}

/** Uno agudo y corto si pasa; dos graves si no. Se distinguen sin mirar. */
export function pip(pasa: boolean): void {
  try {
    if (pasa) {
      tono(1250, 0, 0.13);
    } else {
      tono(340, 0, 0.16);
      tono(340, 0.22, 0.22);
    }
  } catch {
    /* igual que arriba */
  }
}
