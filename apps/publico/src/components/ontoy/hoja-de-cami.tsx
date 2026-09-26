"use client";

import { useEffect, useRef } from "react";
import { useAltoDeLaBarra } from "@/lib/ontoy/alto-de-la-barra";
import type { ParadaPorDelante } from "@/lib/ontoy/llegadas";
import { renglonesDeCami, tituloDeCami } from "@/lib/ontoy/hoja-de-cami";
import { tinoEnLaParada } from "@/lib/ontoy/munecos";
import { CamiDeFrente } from "@/components/ontoy/pronto-en-la-calle";

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
  ruta,
  hacia,
  color,
  edad,
  fresca,
  paradas,
  masCercana,
  estaGuardada,
  alAbrirParada,
  alCerrar,
}: {
  /** El número que trae pintado el camión (8.5): «viene la 2120». */
  economico: string;
  /** El nombre de la ruta: «Ruta Insurgentes · posición de hace 10 s». */
  ruta: string;
  /** «hacia Centro», del sentido en que va. `null` si no se sabe. */
  hacia: string | null;
  color: string;
  /** «hace 10 s». Nunca falta: sin edad, el dato no se muestra. */
  edad: string;
  /** Si su posición todavía dice dónde está. */
  fresca: boolean;
  /** Las que tiene por delante, ya contadas. Vacía es un caso legítimo. */
  paradas: ParadaPorDelante[];
  /** La más cerca de ti entre ésas, o `null` sin ubicación (`laMasCercanaDeTi`). */
  masCercana: string | null;
  estaGuardada: (paradaId: string) => boolean;
  /** Tocar un renglón abre esa parada, como en la lámina. */
  alAbrirParada: (paradaId: string) => void;
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

  /* Arriba de la barra, no encima de ella (8.10): ver `useAltoDeLaBarra`. */
  const altoBarra = useAltoDeLaBarra();
  const hastaLaBarra = { ["--alto-barra" as string]: `${altoBarra}px` };
  const renglones = renglonesDeCami(paradas, masCercana);

  return (
    <>
      <button type="button" className="ontoy-scrim" style={hastaLaBarra} aria-label="Cerrar" onClick={alCerrar} />
      <section
        style={hastaLaBarra}
        className={`ontoy-hoja ontoy-hoja-cami${fresca ? "" : " vieja"}`}
        role="dialog"
        aria-modal="false"
        aria-label={`Camión ${economico}`}
      >
        <span className="ontoy-hoja-asa" aria-hidden="true">
          <span />
        </span>
        {/*
          * **El cuerpo es el que lleva el margen.** Sin él la hoja iba de orilla
          * a orilla de la pantalla: el texto pegado a x = 0 y a x = 390.
          */}
        <div className="ontoy-hoja-cuerpo">
          <div className="ontoy-hoja-cabeza">
            {/* Cami de frente: te está hablando a ti (la mirada es señal). */}
            <CamiDeFrente color={color} ruta={ruta} tam={60} className="ontoy-cami-frente" />
            <div className="ontoy-cami-titulos">
              <h2 className="ontoy-cami-titulo">{tituloDeCami(economico, hacia, fresca)}</h2>
              <p className="ontoy-cami-dir">
                {fresca ? <span className="ontoy-punto-vivo" aria-hidden="true" /> : <span className="ontoy-punto-viejo" aria-hidden="true" />}
                Ruta {ruta} · posición de {edad}
              </p>
            </div>
            <button ref={cerrarRef} type="button" className="ontoy-cerrar" onClick={alCerrar} aria-label="Cerrar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {renglones.length === 0 ? (
            /*
             * Pasa cuando la unidad no cae en el trazado. No es un error ni un
             * hueco que rellenar: es que no hay próximas paradas que se puedan
             * sostener, y decirlo es más barato que inventarlas.
             */
            <p className="ontoy-vacio">
              No podemos decir qué paradas le siguen. Está fuera del corredor de su ruta.
            </p>
          ) : (
            <>
              <h3 className="ontoy-cami-sus">Sus próximas paradas</h3>
              <ol className="ontoy-cami-paradas">
                {renglones.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`ontoy-cami-parada${p.resaltada ? " resaltada" : ""}`}
                      onClick={() => alAbrirParada(p.id)}
                    >
                      <span
                        className="ontoy-cami-parada-tino"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{
                          __html: tinoEnLaParada({ color, mirada: "al-frente", guardada: estaGuardada(p.id) }),
                        }}
                      />
                      <span className="ontoy-cami-parada-texto">
                        <span className="ontoy-cami-parada-nombre">{p.nombre}</span>
                        <span className="ontoy-cami-parada-nota">{p.nota}</span>
                      </span>
                      <span className="ontoy-cami-parada-cuenta">
                        <span className="cifra">{p.paradas}</span> {p.paradas === 1 ? "parada" : "paradas"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="ontoy-hoja-nota">
            {/*
             * Por qué en paradas y no en minutos, dicho en la pantalla y no sólo
             * en el código (#566): el pasajero que se pregunta «¿y a qué hora?»
             * merece saber que no se lo estamos escondiendo, sino que todavía no
             * se mide. La primera frase es la de la lámina.
             */}
            Contadas desde donde se le vio. Toca una parada para abrirla. Todavía no decimos minutos: para
            eso hay que medir cuánto tarda esta ruta, y apenas empezó a rodar.
          </p>
        </div>
      </section>
    </>
  );
}
