"use client";

import { useEffect, useRef, useState } from "react";
import { useNivel } from "../nivel-contexto";
import { MS_POR_CUADRO } from "../nivel-de-rendimiento";
import { OntoyQueReacciona } from "../ontoy-que-reacciona";

/**
 * **«Personajes»** — la hoja de las miradas.
 *
 * Es la sección que enseña la gramática del universo: **la mirada es una
 * señal**, no un adorno. Al frente te habla a ti, de lado es «de allá viene»,
 * arriba es «¡ya viene!», cerrados es que no hay dato. Los tres personajes
 * mueven las pupilas a la vez, y la lista de al lado dice qué significa cada
 * posición.
 *
 * Los tres se mueven **juntos** a propósito: lo que se enseña no es lo que hace
 * cada personaje, es que **todos leen igual**. Tres miradas distintas al mismo
 * tiempo enseñarían tres dibujos en vez de un idioma.
 *
 * ## Dos cambios sobre el diseño
 *
 * **«Ontoy te avisa» dice ahora «Ontoy te dice».** «Avisar» es el verbo de las
 * notificaciones, y las notificaciones (8.13) esperan a que el servicio real
 * ruede semanas. En una tarjeta que define qué es cada personaje, ese verbo se
 * lee como una promesa. «Te dice» es lo que Ontoy hace hoy — y es la misma
 * palabra del lead de la portada: *si no sabe, te lo dice*.
 *
 * **La placa de Tino cuenta paradas.** Como en la calle y en la muestra de
 * color: sin corredor calibrado no hay minutos (8.9b).
 *
 * ## La sección va sobre carbón
 *
 * Es la única de la portada que se sale del lienzo claro, y no por variar: los
 * ojos son blancos con pupila carbón, y sobre banqueta el blanco del ojo casi
 * no se separa del fondo. Sobre carbón, la mirada es lo primero que se ve —
 * que es de lo que trata la sección.
 */

/**
 * Las seis miradas del universo, con lo que significan.
 *
 * Salen del sistema de diseño tal cual. El orden no es decorativo: empieza por
 * la que te incluye a ti y acaba en la que dice que no hay nada que mirar.
 */
const MIRADAS = [
  { posicion: "Al frente", significa: "Te habla a ti", x: 0, y: 0, cerrados: false },
  { posicion: "De lado", significa: "De allá viene", x: -4.6, y: 0, cerrados: false },
  { posicion: "Arriba", significa: "¡Ya viene!", x: 0, y: -2.6, cerrados: false },
  { posicion: "Abajo", significa: "Revisando o esperando", x: 0, y: 2.6, cerrados: false },
  { posicion: "Al otro lado", significa: "Ya se va", x: 4.6, y: 0, cerrados: false },
  /*
   * Cerrados es la única que no es una dirección, y la que más importa: en la
   * app significa **que no hay dato**, no que el camión no venga. La sección de
   * instalar lo dice con todas sus letras.
   */
  { posicion: "Cerrados", significa: "Descansando: no hay dato", x: 0, y: 0, cerrados: true },
];

/** Cada cuántos segundos pasa sola a la siguiente mirada. */
const CADA_S = 2.4;
/** Y cuánto se espera después de que alguien la escoja a mano. */
const TRAS_TOCAR_S = 6;

export function Personajes() {
  const { nivel, quieto } = useNivel();
  const [cual, setCual] = useState(0);
  const tocadaEn = useRef(-99);

  /* El paso solo por las seis miradas, que se detiene si alguien escoge. */
  useEffect(() => {
    if (quieto) return;
    let raf = 0;
    /*
     * El reloj es `performance.now()` a secas, el mismo que usa `escoger`: si
     * cada uno contara desde su propio cero, «hace cuánto tocaron» saldría de
     * restar dos relojes distintos y el paso automático se quedaría parado o
     * no se detendría nunca.
     */
    let ultimoCambio = performance.now() / 1000;
    const minimo = MS_POR_CUADRO[nivel];
    let anterior = performance.now();

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      if (ahora - anterior < minimo) return;
      anterior = ahora;
      const t = ahora / 1000;
      if (t - tocadaEn.current > TRAS_TOCAR_S && t - ultimoCambio > CADA_S) {
        ultimoCambio = t;
        setCual((c) => (c + 1) % MIRADAS.length);
      }
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [nivel, quieto]);

  const mirada = MIRADAS[cual];

  const escoger = (i: number) => {
    tocadaEn.current = performance.now() / 1000;
    setCual(i);
  };

  return (
    <section id="personajes" className="landing-personajes">
      <div className="landing-caja landing-personajes-caja">
        <div className="landing-personajes-dicho">
          <p className="landing-rotulo landing-rotulo-claro">Así se lee Ontoy</p>
          <h2>No hace falta leer. Sus ojos te lo dicen.</h2>
          <p className="landing-lead landing-lead-claro">
            Cada personaje es un dato: <strong>Ontoy te dice</strong>, Cami es tu camión y Páris
            es tu parada. Toca cada mirada.
          </p>
        </div>

        {/*
         * Los tres dibujos y la lista **uno al lado del otro**, como el diseño:
         * debajo, la lista quedaba a una pantalla de distancia de las caras que
         * describe, y lo que se toca en una tiene que verse en la otra sin
         * mover la página.
         */}
        <div className="landing-miradas">
          <div className="landing-miradas-dibujo">
            <figure>
              {/*
               * Ontoy aquí es el ÚNICO que reacciona al tocarlo. Los otros dos
               * siguen la mirada y nada más: es la regla del universo — sólo
               * Ontoy responde al clic.
               */}
              <OntoyQueReacciona reaccion="timido" className="landing-ontoy-personaje" />
              <figcaption>
                <b>Ontoy</b>
                <span>te dice</span>
              </figcaption>
            </figure>
            <figure>
              <Cami mirada={mirada} />
              <figcaption>
                <b>Cami</b>
                <span>tu camión</span>
              </figcaption>
            </figure>
            <figure>
              <Tino mirada={mirada} />
              <figcaption>
                <b>Páris</b>
                <span>tu parada</span>
              </figcaption>
            </figure>
          </div>

          <ul className="landing-miradas-lista">
            {MIRADAS.map((m, i) => (
              <li key={m.posicion}>
                <button
                  type="button"
                  onClick={() => escoger(i)}
                  onPointerEnter={() => escoger(i)}
                  aria-pressed={i === cual}
                >
                  <b>{m.posicion}</b>
                  <span>{m.significa}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

type Mirada = (typeof MIRADAS)[number];

/** Ontoy. Sus pupilas se mueven enteras; con los ojos cerrados son dos arcos. */
function Ontoy({ mirada }: { mirada: Mirada }) {
  return (
    <svg viewBox="0 0 120 120" aria-label="Ontoy">
      <ellipse cx="44" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
      <ellipse cx="76" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
      <path
        d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
        fill="var(--ontoy)"
      />
      {mirada.cerrados ? (
        <path
          d="M40 53 q10 6 20 0 M66 51 q10 6 20 0"
          fill="none"
          stroke="var(--pupila)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="50" cy="52" r="11" fill="var(--ojo)" />
          <circle cx="76" cy="50" r="11" fill="var(--ojo)" />
          <g className="landing-pupilas" transform={`translate(${mirada.x} ${mirada.y})`}>
            <circle cx="50" cy="52" r="6" fill="var(--pupila)" />
            <circle cx="76" cy="50" r="6" fill="var(--pupila)" />
          </g>
        </>
      )}
      <circle cx="14" cy="80" r="6" fill="var(--ontoy)" />
      <circle cx="108" cy="78" r="6" fill="var(--ontoy)" />
    </svg>
  );
}

/** Cami. Sus ojos son ovalados, y cerrados van en blanco sobre el carbón del parabrisas. */
function Cami({ mirada }: { mirada: Mirada }) {
  return (
    <svg viewBox="0 0 120 120" aria-label="Cami">
      <rect x="32" y="90" width="14" height="12" rx="4" fill="var(--llanta)" />
      <rect x="74" y="90" width="14" height="12" rx="4" fill="var(--llanta)" />
      <rect x="26" y="14" width="68" height="80" rx="16" fill="var(--ruta)" />
      <rect x="40" y="19" width="40" height="13" rx="4" fill="var(--hueso)" />
      <text
        x="60"
        y="29.5"
        textAnchor="middle"
        fill="var(--carbon)"
        style={{ font: "800 10px var(--titular)" }}
      >
        51
      </text>
      <rect x="32" y="36" width="56" height="30" rx="10" fill="var(--carbon)" />
      {mirada.cerrados ? (
        <path
          d="M41 50 q8 5 16 0 M63 50 q8 5 16 0"
          fill="none"
          stroke="var(--ojo)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ) : (
        <>
          <ellipse cx="49" cy="51" rx="9.5" ry="7" fill="var(--ojo)" />
          <ellipse cx="71" cy="51" rx="9.5" ry="7" fill="var(--ojo)" />
          <g className="landing-pupilas" transform={`translate(${mirada.x * 0.7} ${mirada.y * 0.7})`}>
            <ellipse cx="49" cy="51" rx="4.4" ry="4.6" fill="var(--pupila)" />
            <ellipse cx="71" cy="51" rx="4.4" ry="4.6" fill="var(--pupila)" />
          </g>
        </>
      )}
      <circle cx="42" cy="80" r="5" fill="var(--hueso)" />
      <circle cx="78" cy="80" r="5" fill="var(--hueso)" />
      <circle cx="14" cy="66" r="6" fill="var(--ruta)" />
      <circle cx="106" cy="66" r="6" fill="var(--ruta)" />
    </svg>
  );
}

/**
 * Tino, con su placa. Aquí el poste va en hueso porque la sección es oscura: en
 * carbón sobre carbón el poste desaparecería.
 *
 * **La placa cuenta paradas**, como en toda la portada.
 */
function Tino({ mirada }: { mirada: Mirada }) {
  return (
    <svg viewBox="0 0 120 120" aria-label="Páris">
      <rect x="57" y="36" width="6" height="72" fill="var(--hueso)" />
      <rect x="46" y="106" width="28" height="7" rx="3.5" fill="var(--hueso)" />
      <circle cx="60" cy="38" r="26" fill="var(--ruta)" />
      {mirada.cerrados ? (
        <path
          d="M43 37 q8 5 16 0 M61 37 q8 5 16 0"
          fill="none"
          stroke="var(--pupila)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="51" cy="36" r="7.5" fill="var(--ojo)" />
          <circle cx="69" cy="36" r="7.5" fill="var(--ojo)" />
          <g className="landing-pupilas" transform={`translate(${mirada.x * 0.6} ${mirada.y * 0.6})`}>
            <circle cx="51" cy="36" r="4" fill="var(--pupila)" />
            <circle cx="69" cy="36" r="4" fill="var(--pupila)" />
          </g>
        </>
      )}
      {/*
       * La placa es más ancha que la del prototipo y la letra más chica, y es
       * por lo mismo de siempre: **escribe la unidad**. «a 3» a secas, en la
       * placa de una parada, se lee como tres minutos con la misma facilidad.
       */}
      {/*
       * Aquí la placa va en hueso, no en carbón: la sección es oscura y una
       * placa carbón sobre fondo carbón desaparecería. La franja del color de
       * la ruta va igual en el filo de abajo (enmienda (f)).
       */}
      <rect x="12" y="89" width="96" height="3" rx="1.5" fill="var(--ruta)" />
      <rect x="12" y="70" width="96" height="19" rx="6" fill="var(--hueso)" />
      <text
        x="60"
        y="83.5"
        textAnchor="middle"
        fill="var(--carbon)"
        style={{ font: "800 9px var(--titular)" }}
      >
        51 · a 3 paradas
      </text>
    </svg>
  );
}
