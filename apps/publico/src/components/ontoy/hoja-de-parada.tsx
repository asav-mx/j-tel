"use client";

import { useEffect, useRef } from "react";
import { ProntoEnLaCalle } from "@/components/ontoy/pronto-en-la-calle";
import { tinoEnLaParada } from "@/lib/ontoy/munecos";

export interface LlegadaEnLaHoja {
  /** Lo que se lee grande: «4–7 min», «Sin unidad a la vista», «Fuera de horario». */
  rotulo: string;
  /**
   * El rótulo **partido en cifra y unidad**, cuando lo es: `{ valor: "3",
   * unidad: "paradas" }`. Con esto la hoja dibuja el número grande y su palabra
   * chica, como el diseño.
   *
   * Va aparte y **no se deduce del rótulo**. Partir «a 3 paradas» con una
   * expresión aquí sería adivinar la forma de una frase que se arma en otro
   * archivo: el día que diga «a 1 parada» en singular, o «iba a 3 paradas», el
   * corte se equivoca en silencio. Quien construye el rótulo tiene el número;
   * lo manda.
   *
   * Los rótulos que **no son una cifra** —«Fuera de horario», «Preguntando…»—
   * no lo traen, y la hoja los dibuja enteros.
   */
  cifra?: { valor: string; unidad: string };
  /** El número de la unidad, para su placa. Sólo cuando hay una unidad medida. */
  placa?: string;
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
  porArrancar,
  promesa,
  promesaDeclarada = false,
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
  /** El color de la ruta, para la franja de las placas. */
  /**
   * La ruta todavía no arranca. Cuando viene, **reemplaza a las llegadas y a la
   * promesa**: no hay unidad que contar ni frecuencia que prometer sobre un
   * servicio que no ha salido.
   */
  porArrancar?: { ruta: string; arrancaEl: string | null } | null;
  /** La promesa publicada, ya en palabras. Siempre visible (8.2) — salvo por arrancar. */
  promesa: string;
  /**
   * Si esa promesa **la declaró la concesión**. De eso depende que lleve su
   * firma al lado, y no de cómo esté escrita.
   *
   * Es la regla del #377 aplicada aquí: **el rótulo sigue la fuente, no el
   * estado.** «Esta ruta no publica cada cuánto pasa» es una frase nuestra
   * sobre un hueco — firmarla «según la concesión» le atribuiría a alguien
   * algo que justamente no dijo, que es la ley de no exponer al operador
   * invertida.
   */
  promesaDeclarada?: boolean;
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
          {/*
            * **Tino, de la parada que estás mirando.** Mira de lado —«de allá
            * viene»— sólo cuando hay una unidad medida en camino; al frente
            * cuando no la hay, y dormido cuando la ruta está cerrada.
            *
            * La mirada sale de lo mismo que la fila de abajo, así que no puede
            * decir una cosa distinta de la que dice el dato: es la misma
            * pregunta contestada dos veces, y contestada una sola vez.
            */}
          <span
            className="ontoy-hoja-tino"
            aria-hidden="true"
            dangerouslySetInnerHTML={{
              __html: tinoEnLaParada({
                color,
                mirada: porArrancar ? "dormido" : llegadas.some((l) => l.enVivo) ? "de-lado" : "al-frente",
                guardada,
              }),
            }}
          />
          <h2 className="ontoy-hoja-nombre">{nombre}</h2>
          <button ref={cerrarRef} type="button" className="ontoy-cerrar" onClick={alCerrar} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="ontoy-hoja-dir">{direccion}</p>

        {/*
          * **Por arrancar reemplaza a todo lo de abajo**, no se suma.
          *
          * La 8.2 dice que la promesa se muestra siempre, «como el horario
          * impreso en un poste». Un poste de una ruta que no ha salido no
          * tiene horario impreso todavía: lo que tiene es la fecha en que lo
          * va a tener. Enseñar «pasa cada 15 min» aquí sería prometer sobre
          * algo que nadie ha operado ni medido.
          */}
        {porArrancar ? (
          <ProntoEnLaCalle color={color} ruta={porArrancar.ruta} arrancaEl={porArrancar.arrancaEl} />
        ) : (
          <>
        {/* Lo MEDIDO. */}
        {llegadas.map((l, i) => (
          <div
            key={i}
            className={`ontoy-llegada${l.cifra ? " con-cifra" : ""}${l.vieja ? " vieja" : ""}${l.pasada ? " pasada" : ""}`}
          >
            {l.placa && (
              <span className="ontoy-placa" style={{ ["--ruta" as string]: color }}>
                {l.placa}
              </span>
            )}
            <span className="ontoy-llegada-dicho">
              <span className="ontoy-llegada-apoyo">
                {l.enVivo && <span className="ontoy-punto-vivo" aria-hidden="true" />}
                {l.pasada && <span className="ontoy-punto-viejo" aria-hidden="true" />}
                {l.apoyo}
              </span>
            </span>
            {/*
              * Con cifra, el número grande y su palabra chica. Sin ella, el
              * rótulo entero —«Fuera de horario» no tiene un número que agrandar,
              * y agrandarle la primera palabra lo volvería un titular falso.
              */}
            {l.cifra ? (
              <span className="ontoy-llegada-cifra">
                <b className="cifra">{l.cifra.valor}</b>
                <span className="ontoy-llegada-unidad">{l.cifra.unidad}</span>
              </span>
            ) : (
              <span className="ontoy-llegada-rotulo cifra">{l.rotulo}</span>
            )}
          </div>
        ))}

        {/* LA PROMESA, separada por su línea y siempre presente (8.2, 8.3). */}
        <p className="ontoy-hoja-promesa">
          <span>{promesa}</span>
          {promesaDeclarada && <span className="ontoy-hoja-firma">según la concesión</span>}
        </p>
          </>
        )}
        {/*
          * **«Guarda tu parada» baja al final y se vuelve el botón principal.**
          *
          * Era una pastilla chica arriba, junto al nombre. Es **la** acción de
          * esta hoja —lo que convierte «una parada» en «tu parada»— y el
          * estándar pide un solo botón principal por pantalla, al final, con
          * sus 52 px de alto. Arriba competía por el lugar con la salida y se
          * leía como un adorno del título.
          */}
        <button
          type="button"
          className={`ontoy-boton ontoy-boton-principal ontoy-hoja-guardar${guardada ? " guardada" : ""}`}
          onClick={alGuardar}
          disabled={!sePuedeGuardar}
          aria-pressed={guardada}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
          </svg>
          {guardada ? "Guardada" : "Guarda tu parada"}
        </button>

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
