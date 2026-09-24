"use client";

import { useEffect, useRef } from "react";
import { paradasEnPalabras } from "@/lib/ontoy/llegadas";
import type { ParadaPorDelante } from "@/lib/ontoy/llegadas";

/**
 * **La hoja de Cami** — tocar un camión enseña sus próximas paradas.
 *
 * Lo que contesta es «¿por dónde va y qué le sigue?», que es la pregunta que el
 * pasajero se hace cuando ve un camión en el mapa y no sabe si le conviene
 * caminar hacia adelante o quedarse donde está.
 *
 * ## Lo que NO dice, y es lo que la hace honesta
 *
 * **No dice cuándo llega a ninguna de ellas.** Sin el corredor calibrado no hay
 * minuto que dar (8.9b), y un «en 4 min» aquí sería una llegada inventada. Dice
 * en paradas, que es lo que la posición real sostiene por sí sola.
 *
 * **No es una promesa de que va a pasar.** Son las paradas que tiene por
 * delante en su trazado; si el camión se sale del corredor, desaparece de la
 * app sin drama (8.4) y esta hoja se queda sin nada que decir — y lo dice, en
 * vez de enseñar las paradas de la ruta como si fueran las suyas.
 *
 * ## Con dato viejo contesta, pero en pasado
 *
 * Un camión con posición vieja **no se borra** —no se fue a ningún lado— y
 * tampoco se dibuja como si fuera de ahorita (8.9). Su hoja dice «iba» y no
 * «va», y la lista va apagada: es por dónde se le vio, no por dónde está.
 */
export function HojaDeCami({
  economico,
  color,
  edad,
  fresca,
  paradas,
  alCerrar,
}: {
  /** El número que trae pintado el camión (8.5): «viene la 2120». */
  economico: string;
  color: string;
  /** «hace 10 s». Nunca falta: sin edad, el dato no se muestra. */
  edad: string;
  /** Si su posición todavía dice dónde está. */
  fresca: boolean;
  /** Las que tiene por delante, ya contadas. Vacía es un caso legítimo. */
  paradas: ParadaPorDelante[];
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
      <section
        className={`ontoy-hoja ontoy-hoja-cami${fresca ? "" : " vieja"}`}
        role="dialog"
        aria-modal="false"
        aria-label={`Camión ${economico}`}
      >
        <span className="ontoy-hoja-asa" aria-hidden="true" />
        <div className="ontoy-hoja-cabeza">
          <h2 className="ontoy-hoja-nombre">
            {/* La placa lleva la franja de su ruta: el color nunca va solo (8.8c). */}
            <span className="ontoy-placa" style={{ ["--ruta" as string]: color }}>
              {economico}
            </span>
          </h2>
          <button ref={cerrarRef} type="button" className="ontoy-cerrar" onClick={alCerrar} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="ontoy-hoja-dir">
          {fresca ? <span className="ontoy-punto-vivo" aria-hidden="true" /> : <span className="ontoy-punto-viejo" aria-hidden="true" />}
          {fresca ? "va por aquí" : "por aquí iba"} · posición de {edad}
        </p>

        {paradas.length === 0 ? (
          /*
           * Pasa cuando la unidad no cae en el trazado. No es un error ni un
           * hueco que rellenar: es que no hay próximas paradas que se puedan
           * sostener, y decirlo es más barato que inventarlas.
           */
          <p className="ontoy-vacio">
            No podemos decir qué paradas le siguen. Está fuera del corredor de su ruta.
          </p>
        ) : (
          <ol className="ontoy-cami-paradas">
            {paradas.map((p) => (
              <li key={p.id} className="ontoy-cami-parada">
                <span className="ontoy-cami-parada-nombre">{p.nombre}</span>
                <span className="ontoy-cami-parada-cuenta cifra">{paradasEnPalabras(p.paradas)}</span>
              </li>
            ))}
          </ol>
        )}

        <p className="ontoy-hoja-nota">
          {/*
           * Por qué en paradas y no en minutos, dicho en la pantalla y no sólo
           * en el código: el pasajero que se pregunta «¿y a qué hora?» merece
           * saber que no se lo estamos escondiendo, sino que todavía no se mide.
           */}
          Contadas desde donde se le vio. Todavía no decimos minutos: para eso hay que medir cuánto
          tarda esta ruta, y apenas empezó a rodar.
        </p>
      </section>
    </>
  );
}
