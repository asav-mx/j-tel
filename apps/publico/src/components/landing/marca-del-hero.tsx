"use client";

import { useRef } from "react";
import { useNivel } from "./nivel-contexto";
import { useOjosVivos } from "./ojos-vivos";
import {
  CaraDeOntoy,
  OJOS_DEL_WORDMARK,
  OJOS_DE_ONTOY,
  WordmarkConOjos,
} from "./ontoy";

/**
 * **El renglón de la marca del hero**: el wordmark gigante y Ontoy, vivos.
 *
 * La etiqueta, el título, la frase y el botón los rinde el servidor y llegan en
 * el HTML, así que la portada **dice lo que tiene que decir antes de que corra
 * una línea de JavaScript**. Si el JS no llega nunca, lo que se pierde es el
 * parpadeo.
 *
 * ## Los cuatro ojos parpadean juntos, y es a propósito
 *
 * Un solo bucle mueve los dos ojos del wordmark y los dos de Ontoy. Si cada
 * personaje llevara el suyo, parpadearían con ritmos distintos y se verían
 * como dos dibujos en la misma página en vez de dos habitantes del mismo
 * mundo. También es la mitad de trabajo por cuadro.
 *
 * ## Ontoy 2D es lo primero que se ve, siempre
 *
 * Decisión de ASAV del 24-sep: el 3D entra en la versión 1, pero **diferido y
 * sólo en el nivel alto**, y lo que ocupa su lugar mientras tanto —y para
 * siempre, en medio y bajo— es este Ontoy en 2D, animado. El 3D llega en su
 * propio PR y se monta encima de esto, no en su lugar.
 */
export function MarcaDelHero() {
  const { nivel, quieto } = useNivel();

  const caja = useRef<HTMLDivElement>(null);
  const wordmarkA = useRef<SVGGElement>(null);
  const wordmarkB = useRef<SVGGElement>(null);
  const ontoyIzq = useRef<SVGGElement>(null);
  const ontoyDer = useRef<SVGGElement>(null);

  useOjosVivos({
    nivel,
    quieto,
    alTocar: caja,
    ojos: [
      { ref: wordmarkA, ...OJOS_DEL_WORDMARK.a },
      { ref: wordmarkB, ...OJOS_DEL_WORDMARK.b },
      { ref: ontoyIzq, ...OJOS_DE_ONTOY.izq },
      { ref: ontoyDer, ...OJOS_DE_ONTOY.der },
    ],
  });

  return (
    <div className="landing-hero-marca" ref={caja}>
      <WordmarkConOjos
        className="landing-wordmark-gigante"
        ojoA={wordmarkA}
        ojoB={wordmarkB}
        interactivo={!quieto}
      />
      <div className="landing-hero-ontoy">
        <CaraDeOntoy titulo="Ontoy" ojoIzq={ontoyIzq} ojoDer={ontoyDer} />
      </div>
    </div>
  );
}
