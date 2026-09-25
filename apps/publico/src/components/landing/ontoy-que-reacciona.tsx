"use client";

import { useEffect, useRef, useState } from "react";
import { useNivel } from "./nivel-contexto";

/**
 * **Ontoy en 2D, que reacciona** — las reacciones del diseño, para donde no hay
 * 3D.
 *
 * El 3D sólo se carga en el nivel alto. En medio y bajo —y en cualquier
 * teléfono— lo que hay es este Ontoy, y el diseño no lo deja quieto: brinca, se
 * ríe, se marea, se sonroja. Son **las mismas reacciones** que el 3D hace en
 * volumen, dibujadas en plano.
 *
 * ## Las reglas del universo que esto respeta
 *
 * - **Sólo por dato real o por acción de quien mira.** Aquí es lo segundo:
 *   nada de esto pasa solo. Ontoy no se ríe porque sí.
 * - **La versión original va sin boca.** La boca sólo sale en las reacciones —
 *   por eso el reposo no tiene ninguna.
 * - **Las reacciones suben con los clics seguidos** y **bajan de ritmo solas**,
 *   sin cortarse de golpe.
 * - **Con `reduced-motion` sólo cambia la cara.** Sin brincos, sin giros, sin
 *   estrellas: el gesto se ve, el movimiento no.
 *
 * ## Las tres caras, y por qué son tres
 *
 * | Cara | Dónde | Qué hace al tocarlo |
 * |---|---|---|
 * | `cosquillas` | «¡Ya viene!» | se ríe, y la risa sube con cada toque |
 * | `brinca` | el buscador | salta, da vueltas y se marea |
 * | `timido` | los personajes | se sonroja y se tapa la cara |
 *
 * Son las del diseño, y son distintas a propósito: cada sección le pregunta
 * otra cosa a Ontoy, y contestar siempre lo mismo lo volvería un adorno que se
 * mueve.
 */

export type Reaccion = "cosquillas" | "brinca" | "timido" | "dormido";

/** Lo que dice cada cara al tocarla, en orden. */
const DICHOS: Record<Reaccion, string[]> = {
  cosquillas: ["¡ja ja!", "¡jaja!", "¡ya, ya! jaja", "¡me haces llorar! jaja", "¡basta! JAJAJA"],
  brinca: ["¡uy!", "¡otra!", "¡más alto!", "ay… me mareé", "ya, ya… ay"],
  timido: ["…hola", "ay", "¡no me veas!", "¡basta! >///<"],
  /*
   * El dormido se despierta **a medias** y se vuelve a dormir: la sección dice
   * que Ontoy descansa cuando no hay corridas, y despertarlo del todo
   * contradiría la frase que tiene al lado.
   */
  dormido: ["¡cinco minutitos más!", "mmm…", "ya voy, ya voy", "…zzz"],
};

/** Los clics cuentan como racha si pasan menos de esto entre uno y otro. */
const RACHA_S = 1.4;

/** Y la racha se olvida sola pasado este rato sin tocarlo. */
const SE_CALMA_S = 3.5;

export function OntoyQueReacciona({
  reaccion,
  etiqueta = "tócalo",
  className,
}: {
  reaccion: Reaccion;
  /** Lo que se lee debajo mientras nadie lo ha tocado. */
  etiqueta?: string;
  className?: string;
}) {
  const { quieto } = useNivel();
  const [nivelDeRisa, setNivelDeRisa] = useState(-1);
  const ultimo = useRef(-99);
  const dichos = DICHOS[reaccion];

  /* La racha se calma sola: si no, Ontoy se queda riéndose para siempre. */
  useEffect(() => {
    if (nivelDeRisa < 0) return;
    const t = setTimeout(() => setNivelDeRisa(-1), SE_CALMA_S * 1000);
    return () => clearTimeout(t);
  }, [nivelDeRisa]);

  const tocar = () => {
    const ahora = performance.now() / 1000;
    setNivelDeRisa((r) =>
      ahora - ultimo.current < RACHA_S ? Math.min(r + 1, dichos.length - 1) : 0,
    );
    ultimo.current = ahora;
  };

  const reaccionando = nivelDeRisa >= 0;
  /* De 0 a 1: cuánto de fuerte va la reacción. Escala los gestos. */
  const fuerza = reaccionando ? (nivelDeRisa + 1) / dichos.length : 0;

  /* El tímido se tapa la cara al final de su racha, no desde el primer toque. */
  const tapandose = reaccion === "timido" && fuerza > 0.6;

  /*
   * El dormido sigue dormido: lo que cambia es que abre un ojo, y en el último
   * dicho —«…zzz»— vuelve a cerrarlo. Las zetas sólo se van mientras está
   * medio despierto.
   */
  const medioDespierto = reaccion === "dormido" && reaccionando && nivelDeRisa < dichos.length - 1;

  /* Con `reduced-motion` la cara cambia, pero el cuerpo no se mueve. */
  const gesto = quieto ? "" : gestoDelCuerpo(reaccion, fuerza, reaccionando);

  return (
    <button
      type="button"
      className={className ? `landing-reacciona ${className}` : "landing-reacciona"}
      onClick={tocar}
      aria-label={`Ontoy: tócalo`}
    >
      <svg viewBox="-16 -40 152 160" aria-hidden="true">
        {/*
         * Las zetas del sueño. **Se mueven**: suben y se desvanecen, una detrás
         * de otra. Es lo único de la portada que se anima sin que nadie la
         * toque, y se lo permite la sección: dice que Ontoy está durmiendo, y
         * alguien durmiendo respira.
         */}
        {reaccion === "dormido" && !quieto && !medioDespierto && (
          <g className="landing-zzz" aria-hidden="true">
            <text x="104" y="6" className="landing-z1">z</text>
            <text x="116" y="-8" className="landing-z2">z</text>
            <text x="128" y="-24" className="landing-z3">Z</text>
          </g>
        )}
        <g style={{ transform: gesto, transformOrigin: "60px 96px", transition: "transform .18s var(--curva)" }}>
          <ellipse cx="44" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
          <ellipse cx="76" cy="96" rx="9" ry="6" fill="var(--ontoy)" />
          <path
            d="M34 30 C40 18 60 16 74 19 C90 22 98 34 97 52 C96 68 94 80 86 88 C78 94 66 95 58 94 C46 95 34 92 28 82 C22 70 22 52 26 42 C28 36 30 33 34 30 Z"
            fill="var(--ontoy)"
          />

          {/* El rubor del tímido va DEBAJO de los ojos, como en el diseño. */}
          {reaccion === "timido" && reaccionando && (
            <>
              <ellipse cx="38" cy="66" rx="9" ry="5" fill="var(--ontoy-rubor)" opacity={0.75} />
              <ellipse cx="86" cy="64" rx="9" ry="5" fill="var(--ontoy-rubor)" opacity={0.75} />
            </>
          )}

          <Ojos reaccion={reaccion} fuerza={fuerza} reaccionando={reaccionando} />
          <Boca reaccion={reaccion} fuerza={fuerza} reaccionando={reaccionando} />

          {/*
           * Las manos flotantes. El tímido **se las lleva a la cara** al final
           * de su racha — se sonroja primero y se tapa cuando ya no aguanta.
           *
           * Y suben **a los lados**, no encima de los ojos. Encima se probó y
           * se lee mal: las manos son del mismo naranja que el cuerpo, así que
           * taparlos del todo no parece taparse la cara, **parece que le
           * borraron los ojos**. A los lados, con el rubor y los ojos cerrados
           * a la vista, el gesto se entiende y la cara sigue estando.
           */}
          <circle
            cx={tapandose ? 30 : 12}
            cy={tapandose ? 50 : 58}
            r={tapandose ? 10 : 7}
            fill="var(--ontoy)"
            style={{ transition: "all .18s var(--curva)" }}
          />
          <circle
            cx={tapandose ? 96 : 110}
            cy={tapandose ? 48 : 54}
            r={tapandose ? 10 : 7}
            fill="var(--ontoy)"
            style={{ transition: "all .18s var(--curva)" }}
          />
        </g>

        {/*
         * Las estrellas del mareo. Van FUERA del grupo que se mueve, porque
         * giran alrededor de Ontoy y no con él. Sólo en la cara que se marea, y
         * sólo cuando la racha ya va alta.
         */}
        {!quieto && reaccion === "brinca" && fuerza > 0.6 && (
          <path
            d="M8 -6 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z M110 -18 l2.4 5.6 5.6 .8 -4 4 .8 5.6 -4.8 -2.4 -4.8 2.4 .8 -5.6 -4 -4 5.6 -.8 Z"
            fill="var(--ontoy-estrella)"
          />
        )}
      </svg>
      <span className="landing-tocalo">{reaccionando ? dichos[nivelDeRisa] : etiqueta}</span>
    </button>
  );
}

/** Cómo se mueve el cuerpo según la cara y lo fuerte que vaya la reacción. */
function gestoDelCuerpo(reaccion: Reaccion, fuerza: number, reaccionando: boolean): string {
  if (!reaccionando) return "";
  if (reaccion === "brinca") {
    /* Salta, y al final de la racha da la vuelta: el mareo viene de ahí. */
    const alto = -10 - fuerza * 14;
    const giro = fuerza > 0.6 ? (fuerza - 0.6) * 900 : 0;
    return `translateY(${alto}px) rotate(${giro}deg)`;
  }
  if (reaccion === "cosquillas") {
    /* Se retuerce: la risa no levanta, sacude. */
    return `translateX(${fuerza * 4}px) rotate(${fuerza * 5}deg)`;
  }
  if (reaccion === "dormido") {
    /* Se remueve: el que no quiere levantarse se da la vuelta, no salta. */
    return `translateX(${fuerza * 5}px) rotate(${-fuerza * 4}deg)`;
  }
  /* El tímido se encoge y se echa para atrás. */
  return `translateY(${fuerza * 4}px) scale(${1 - fuerza * 0.05})`;
}

/**
 * Los ojos. Riendo y de tímido se cierran —dos arcos, la forma del universo—;
 * mareado son espirales.
 */
function Ojos({
  reaccion,
  fuerza,
  reaccionando,
}: {
  reaccion: Reaccion;
  fuerza: number;
  reaccionando: boolean;
}) {
  const mareado = reaccion === "brinca" && fuerza > 0.6;
  if (mareado) {
    return (
      <path
        d="M50 52 m-7 0 a7 7 0 1 1 7 7 a4 4 0 1 1 -4 -4 M76 50 m-7 0 a7 7 0 1 1 7 7 a4 4 0 1 1 -4 -4"
        fill="none"
        stroke="var(--pupila)"
        strokeWidth="2.4"
      />
    );
  }
  /* El dormido tiene los ojos cerrados SIEMPRE, salvo el que abre al despertar. */
  if (reaccion === "dormido") {
    const abreUno = reaccionando && fuerza < 0.9;
    return (
      <>
        <path
          d={abreUno ? "M66 51 q10 6 20 0" : "M40 53 q10 6 20 0 M66 51 q10 6 20 0"}
          fill="none"
          stroke="var(--pupila)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        {abreUno && (
          <>
            <circle cx="50" cy="52" r="11" fill="var(--ojo)" />
            <circle cx="50" cy="52" r="6" fill="var(--pupila)" />
          </>
        )}
      </>
    );
  }

  const cerrados = reaccionando && (reaccion === "cosquillas" || reaccion === "timido");
  if (cerrados) {
    return (
      <path
        d="M40 50 q10 7 20 0 M66 48 q10 7 20 0"
        fill="none"
        stroke="var(--pupila)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    );
  }
  return (
    <>
      <circle cx="50" cy="52" r="11" fill="var(--ojo)" />
      <circle cx="76" cy="50" r="11" fill="var(--ojo)" />
      <circle cx="50" cy="52" r="6" fill="var(--pupila)" />
      <circle cx="76" cy="50" r="6" fill="var(--pupila)" />
    </>
  );
}

/**
 * La boca. **Sólo existe cuando hay reacción**: la versión original de todos
 * los personajes va sin boca, y ésa es la regla que más se rompe sin querer.
 */
function Boca({
  reaccion,
  fuerza,
  reaccionando,
}: {
  reaccion: Reaccion;
  fuerza: number;
  reaccionando: boolean;
}) {
  if (!reaccionando) return null;

  if (reaccion === "dormido") {
    /* Una línea: el dormido que refunfuña no se ríe. */
    return (
      <path
        d="M54 74 h16"
        fill="none"
        stroke="var(--pupila)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    );
  }

  if (reaccion === "timido") {
    /* Una línea ondulada: ni contento ni triste, incómodo. */
    return (
      <path
        d="M52 74 q4 -3 8 0 t8 0"
        fill="none"
        stroke="var(--pupila)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    );
  }

  /* Riendo y brincando, la boca abierta crece con la racha. */
  return (
    <ellipse
      cx="63"
      cy="74"
      rx={6 + fuerza * 5}
      ry={7 + fuerza * 7}
      fill="var(--pupila)"
    />
  );
}
