"use client";

import { useEffect, useRef } from "react";

export interface LlegadaEnLaHoja {
  /** Lo que se lee grande: «4–7 min», «Sin unidad a la vista», «Fuera de horario». */
  rotulo: string;
  /** La frase de apoyo. Va aparte del rótulo para que el rótulo no se vuelva una oración. */
  apoyo: string;
  /** El dato está vivo ahora: lleva el punto verde. **Sólo eso lo lleva.** */
  enVivo?: boolean;
  /** Es dato viejo: se apaga, y dice de cuándo es. Nunca se borra (escalera, 8.9). */
  vieja?: boolean;
  /**
   * Es la POSICIÓN VIEJA de una unidad («iba a 3 paradas»): lo último que se vio,
   * no dónde está. Se dice en pasado, **sin número grande** y con el anillo hueco
   * del dato viejo (8.9; decisión de ASAV, 22-sep).
   */
  pasada?: boolean;
}

/**
 * La hoja de una parada: lo que se sabe de ella, y la salida (8.10).
 *
 * ## Las dos cosas nunca se funden (8.3)
 *
 * Arriba, **lo medido**: qué unidad viene y en qué rango. Abajo, separada por su
 * línea, **la promesa**: cada cuántos minutos pasa. Son dos afirmaciones de
 * naturaleza distinta —una la midió el GPS hace segundos, la otra la declaró el
 * concesionario— y el pasajero tiene derecho a saber cuál está leyendo. Fundir
 * «pasa cada 12 min» con «viene en 4» produce una sola frase que nadie puede
 * verificar.
 *
 * Y la promesa se muestra **siempre**, aunque no haya una sola unidad en vivo
 * (8.2): vale por sí sola, como el horario impreso en un poste.
 *
 * ## La salida
 *
 * Cerrar con el botón, con la tecla de escape o tocando fuera. Tres salidas
 * porque la hoja tapa el mapa, y una hoja que no se sabe cerrar sobre un mapa
 * que el pasajero necesita es un callejón (8.10).
 */
export function HojaDeParada({
  nombre,
  direccion,
  llegadas,
  promesa,
  guardada,
  sePuedeGuardar,
  color,
  alGuardar,
  alCerrar,
}: {
  nombre: string;
  /** «Dirección → Centro». Sale de los datos del circuito, nunca del código. */
  direccion: string;
  llegadas: LlegadaEnLaHoja[];
  /** La promesa publicada, ya en palabras. Siempre visible (8.2). */
  promesa: string;
  guardada: boolean;
  /** `false` cuando el navegador no deja guardar. Se dice, no se esconde el botón. */
  sePuedeGuardar: boolean;
  color: string;
  alGuardar: () => void;
  alCerrar: () => void;
}) {
  const cerrarRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    cerrarRef.current?.focus();
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);

  return (
    <>
      <button type="button" className="ontoy-scrim" aria-label="Cerrar" onClick={alCerrar} />
      <section className="ontoy-hoja" role="dialog" aria-modal="false" aria-label={`Parada ${nombre}`}>
        <span className="ontoy-hoja-asa" aria-hidden="true" />
        <div className="ontoy-hoja-cabeza">
          <h2 className="ontoy-hoja-nombre">{nombre}</h2>
          <button
            type="button"
            className={`ontoy-guardar${guardada ? " guardada" : ""}`}
            style={{ ["--ruta" as string]: color }}
            onClick={alGuardar}
            disabled={!sePuedeGuardar}
            aria-pressed={guardada}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
            </svg>
            {guardada ? "Guardada" : "Guardar"}
          </button>
          <button ref={cerrarRef} type="button" className="ontoy-cerrar" onClick={alCerrar} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="ontoy-hoja-dir">{direccion}</p>

        {/* Lo MEDIDO. */}
        {llegadas.map((l, i) => (
          <div key={i} className={`ontoy-llegada${l.vieja ? " vieja" : ""}${l.pasada ? " pasada" : ""}`}>
            <span className="ontoy-llegada-rotulo mono">{l.rotulo}</span>
            <span className="ontoy-llegada-apoyo">
              {l.enVivo && <span className="ontoy-punto-vivo" aria-hidden="true" />}
              {l.pasada && <span className="ontoy-punto-viejo" aria-hidden="true" />}
              {l.apoyo}
            </span>
          </div>
        ))}

        {/* LA PROMESA, separada por su línea y siempre presente (8.2, 8.3). */}
        <p className="ontoy-hoja-promesa">{promesa}</p>
        <p className="ontoy-hoja-nota">
          {/*
            Aquí decía «la guarda en tu teléfono, no en ningún servidor», y la
            valla de `textos-de-privacidad` la tumbó con razón: una promesa
            absoluta sobre el destino de un dato afirma sobre TODA la pantalla,
            y en ésta los mosaicos del mapa sí se le piden a un tercero. El
            texto dice para qué sirve, que es lo que el pasajero necesita.
          */}
          {sePuedeGuardar
            ? "Guardar una parada la deja a la mano en este teléfono. No hace falta cuenta."
            : "Tu navegador no deja guardar nada en este teléfono, así que el atajo no está disponible. Todo lo demás funciona igual."}
        </p>
      </section>
    </>
  );
}
