"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProntoEnLaCalle } from "@/components/ontoy/pronto-en-la-calle";
import {
  FRACCION,
  alSoltar,
  masAbajo,
  masArriba,
  type AlturaDeLaHoja,
} from "@/lib/ontoy/alturas-de-la-hoja";
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
 *
 * ## Las tres alturas, y por qué NUNCA saca al pasajero del mapa
 *
 * La hoja se arrastra entre **asomada, media y completa** (las fracciones y el
 * veredicto al soltar, en `alturas-de-la-hoja.ts`). Esto no es un adorno: es lo
 * que permite que tocar una parada deje de ser un viaje a otra pantalla.
 *
 * Antes, tocar a Tino en el mapa de la ciudad abría la ruta entera con su lista
 * de paradas, y el pasajero perdía de vista dónde estaba parado justo cuando
 * acababa de señalarlo. Ahora la respuesta llega **encima del mapa**, y bajarla
 * a la asomada devuelve el mapa sin perder la parada.
 *
 * En la asomada no hay velo ninguno: el mapa se sigue usando —arrastrar,
 * acercar, tocar otra parada— porque a esa altura la hoja acompaña, no
 * interrumpe. De la media hacia arriba sí hay uno, pero **transparente**: sólo
 * recoge el toque de fuera para cerrar (8.10). Que no tiña está medido contra
 * las láminas, y el porqué está escrito junto a la regla en `ontoy.css`.
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
  alturaInicial = "media",
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
  /** Con qué altura nace. La hoja de un toque nace en la media (§2 del diseño). */
  alturaInicial?: AlturaDeLaHoja;
}) {
  const cerrarRef = useRef<HTMLButtonElement | null>(null);
  const [altura, setAltura] = useState<AlturaDeLaHoja>(alturaInicial);
  /**
   * La fracción mientras el dedo la tiene. `null` cuando no se está arrastrando,
   * y entonces manda `altura`.
   *
   * Son dos cosas distintas a propósito: durante el arrastre la hoja sigue al
   * dedo **sin transición** —si la tuviera, iría siempre un poco atrás y se
   * sentiría pegajosa—, y al soltar vuelve a mandar la altura, que sí se anima.
   */
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  /**
   * **Cuánto mide la barra de abajo**, medido del DOM y no escrito aquí.
   *
   * La hoja no puede tapar la barra: la barra es la salida de cualquier pantalla
   * (8.10), y una hoja que la cubre deja al pasajero con una salida menos justo
   * encima del mapa. En las láminas del diseño la barra se ve debajo de la hoja
   * en las tres alturas.
   *
   * Se **mide** en vez de escribirse porque el estándar dice 64 px y la barra de
   * hoy mide 75: la palabra subió a 12 px en el #589 y eso la creció. Un número
   * copiado aquí volvería a separarse de la realidad la próxima vez que alguien
   * toque la barra —y lo está haciendo hoy—, sin que ninguna prueba lo notara.
   */
  const [altoBarra, setAltoBarra] = useState(0);
  useEffect(() => {
    const barra = document.querySelector(".ontoy-barra");
    setAltoBarra(barra ? Math.round(barra.getBoundingClientRect().height) : 0);
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    cerrarRef.current?.focus();
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);

  /**
   * El arrastre del asa.
   *
   * **Los oyentes van en `window`, no en el asa**, y esto ya costó una vez: en
   * «Tus paradas» los puse en el asa con `setPointerCapture` y, como React mueve
   * el nodo al reordenar, el `pointerup` nunca llegaba y la lista se quedaba
   * «arrastrando» para siempre. Aquí el nodo no se mueve, pero el dedo sí sale
   * de un asa de 5 px de alto en cuanto empieza a moverse: en el asa, el gesto
   * se perdería en el primer milímetro.
   */
  const alAgarrar = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const alto = window.innerHeight;
      if (!alto) return;
      const mover = (ev: PointerEvent) => {
        /* La hoja ocupa de su borde hasta abajo: la fracción es lo que queda
           debajo del dedo. */
        setArrastrando(Math.min(1, Math.max(0, (alto - ev.clientY) / alto)));
      };
      const soltar = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        window.removeEventListener("pointercancel", soltar);
        setArrastrando(null);
        const veredicto = alSoltar((alto - ev.clientY) / alto);
        if (veredicto === "cerrar") alCerrar();
        else setAltura(veredicto);
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
      window.addEventListener("pointercancel", soltar);
    },
    [alCerrar],
  );

  const fraccion = arrastrando ?? FRACCION[altura];

  return (
    <>
      {/*
        * **El velo sólo de la media hacia arriba.** En la asomada el mapa se
        * sigue usando; un velo ahí apagaría justo lo que el pasajero está
        * mirando y convertiría una hoja que acompaña en una que interrumpe.
        */}
      {altura !== "asomada" && (
        <button type="button" className="ontoy-scrim transparente" aria-label="Cerrar" onClick={alCerrar} />
      )}
      <section
        className={`ontoy-hoja${arrastrando !== null ? " arrastrando" : ""}`}
        style={{
          ["--alto-hoja" as string]: String(fraccion),
          ["--alto-barra" as string]: `${altoBarra}px`,
        }}
        role="dialog"
        aria-modal="false"
        aria-label={`Parada ${nombre}`}
      >
        {/*
          * El asa es un control de verdad, no un adorno: se arrastra con el dedo
          * y **sube y baja con las flechas**. Un arrastre no es alcanzable con
          * teclado ni con un conmutador, y sin las flechas quien navega así se
          * quedaría con la altura con la que abrió.
          */}
        <button
          type="button"
          className="ontoy-hoja-asa"
          onPointerDown={alAgarrar}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); setAltura(masArriba(altura)); }
            if (e.key === "ArrowDown") { e.preventDefault(); setAltura(masAbajo(altura)); }
          }}
          aria-label={`Alto de la hoja: ${altura}. Usa las flechas para subirla o bajarla.`}
        >
          <span aria-hidden="true" />
        </button>
        <div className="ontoy-hoja-cuerpo">
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
        {/*
          * Lo MEDIDO, **dentro de su tarjeta**. El estándar la describe —hueso,
          * radio 22, anillo arena, separador de 1 px entre filas— y no es
          * decoración: la tarjeta es lo que dice dónde termina lo que midió el
          * GPS y dónde empieza la promesa, que va fuera y debajo. Sin ella, las
          * dos cosas son una lista sola (8.3).
          */}
        <div className="ontoy-hoja-medido">
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
        </div>

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
        </div>
      </section>
    </>
  );
}
