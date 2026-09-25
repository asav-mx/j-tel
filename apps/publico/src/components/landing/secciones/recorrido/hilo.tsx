"use client";

import { useEffect, useRef } from "react";
import { useNivel } from "../../nivel-contexto";
import { MS_POR_CUADRO } from "../../nivel-de-rendimiento";
import { EL_BARRIO, PiezaDelBarrio, dondeVa } from "./barrio";

/**
 * **El camino del recorrido** — la ruta como una calle que serpentea por el
 * barrio, con sus cinco paradas, por la que Cami baja **a la vez que tú**.
 *
 * Es la columna que acompaña a las cinco tarjetas de «El recorrido»: conforme
 * la sección pasa por la pantalla, Cami avanza de parada en parada, y en cada
 * parada **Tino lo mira venir**. El movimiento no es decorativo — es lo que
 * hace que «Súbete. Baja despacio» signifique algo, y lo que sostiene la frase
 * de entrada: «ya sabes leer su mirada».
 *
 * ## Curvas, y no una línea recta
 *
 * El camino es el del diseño, tal cual. Una recta se leía como una barra de
 * progreso, y **una ruta no es una barra de progreso**: es una calle que da
 * vueltas por una ciudad. El barrio alrededor es lo que la vuelve una ciudad y
 * no un diagrama — y en la landing el barrio es ilustración, que está bien:
 * aquí no hay un mapa de nada, hay un dibujo.
 *
 * ## Las paradas y Cami se colocan SOBRE el camino, no se adivinan
 *
 * `getPointAtLength` da el punto exacto del trazado a una fracción de su largo.
 * Es lo único que permite retocar la curva sin recolocar a mano cinco paradas y
 * un camión — y sin eso, cualquier cambio del camino los dejaría flotando al
 * lado, que es justo como se ve un recorrido mal hecho.
 *
 * De ahí sale también **a qué lado se planta cada Tino**: al derecho si su
 * parada cae en la mitad izquierda del lienzo, al izquierdo si cae en la
 * derecha. Es una regla, no una lista escrita a mano, y se recoloca sola.
 *
 * Cami además **se inclina hacia donde va**: la tangente sale de mirar un punto
 * un poco más adelante en el mismo trazado. Un camión que baja una curva sin
 * girar se ve como una calcomanía resbalando.
 *
 * ## La escalera de estados vive en la mirada y en la placa
 *
 * No en el color. Cinco Tinos del color de la ruta, todos iguales, y lo que
 * cambia es **hacia dónde miran y qué dice su placa**: lo ven venir de lejos y
 * lo siguen con los ojos, levantan la vista cuando ya casi, abren la boca
 * cuando llega, lo ven irse, y se quedan mirando al suelo. El color es
 * identidad, nunca estado (8.8c) — apagar la cabeza de las paradas sin camión
 * sería justo lo contrario.
 *
 * ## Las placas cuentan paradas
 *
 * El prototipo las traía contando minutos, y el texto de entrada lo decía: «su
 * placa cuenta los minutos». Sin corredor calibrado la app no da minutos
 * (8.9b), así que cuentan **a cuántas paradas viene Cami** — y la de enfrente,
 * cuando lo tiene encima, dice «¡ya!». Todas en blanco, con el color de la ruta
 * en la franja del filo de abajo (enmienda (f)).
 *
 * ## Va atado al scroll, no a un reloj
 *
 * Porque lo que cuenta la sección es que **tú** bajas y Cami baja contigo. Con
 * un reloj propio, Cami llegaría al final mientras alguien sigue leyendo la
 * primera tarjeta, y la promesa de la sección se rompería sola.
 *
 * Con `prefers-reduced-motion` la posición se escribe igual pero sin suavizar:
 * el camino sigue diciendo dónde va Cami, sin animación de por medio.
 */

/** Dónde queda cada parada a lo largo del camino, de 0 (arriba) a 1 (abajo). */
const PARADAS = [0.1, 0.3, 0.5, 0.7, 0.9];

/**
 * El camino, copiado del diseño. Serpentea de un lado al otro del lienzo y
 * **se sale por arriba y por abajo a propósito**: una ruta no empieza ni acaba
 * en el borde de una sección, sólo pasa por ahí.
 */
const CAMINO =
  "M150 -20 C150 60 70 80 70 180 S230 300 230 420 S70 540 70 660 S150 800 150 940";

/** El alto del `viewBox`. */
const ALTO = 900;

/**
 * Lo que mide la placa de cada Tino, y cuánto se aparta del camino su poste.
 *
 * El ancho sale de medir el texto más largo que puede escribir —«a 4 paradas»,
 * 63.4 unidades en Bricolage 11— y dejarle doce a cada lado. La placa tapa el
 * camino por detrás, así que cada unidad de más es calle escondida.
 */
const ANCHO_PLACA = 88;
const SEPARACION = 14 + ANCHO_PLACA / 2;

/**
 * A qué altura del poste quedan los ojos. Hace falta para que el Tino mire a
 * Cami **desde donde tiene la cara**, y no desde sus pies: midiendo desde el
 * pie, un camión que pasa al lado saldría «hacia arriba» y los ojos se irían al
 * cielo justo cuando lo tienen enfrente.
 */
const ALTO_DE_LA_CARA = 49;

/**
 * **Los cinco estados de un Tino en su parada**, por la distancia a la que
 * viene Cami, medida en fracción del recorrido. Son los del diseño.
 */
type Estado = "viene" | "yaviene" | "llego" | "seva" | "espera";

/** La banda en la que se considera que Cami **está** en la parada. */
const LLEGO = 0.014;

function estadoDeLaParada(d: number): Estado {
  if (d > 0.06) return "viene";
  if (d > LLEGO) return "yaviene";
  if (d >= -LLEGO) return "llego";
  if (d > -0.08) return "seva";
  return "espera";
}

export function Hilo({ seccion }: { seccion: React.RefObject<HTMLElement | null> }) {
  const { nivel, quieto } = useNivel();
  const lienzo = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = lienzo.current;
    if (!svg) return;

    /*
     * Se mide sobre el trazado SIN `pathLength`: ese atributo reescala las
     * cuentas de distancia del navegador, y con él `getPointAtLength` dejaría
     * de hablar en las unidades del dibujo.
     */
    const trazado = svg.querySelector<SVGPathElement>("[data-pieza='trazado']");
    if (!trazado) return;
    const largo = trazado.getTotalLength();

    const recorrido = svg.querySelector<SVGPathElement>("[data-pieza='recorrido']");
    const cami = svg.querySelector<SVGGElement>("[data-pieza='cami']");
    const enElCamino = PARADAS.map((_, i) =>
      svg.querySelector<SVGCircleElement>(`[data-pieza='marca-${i}']`),
    );
    const postes = PARADAS.map((_, i) =>
      svg.querySelector<SVGGElement>(`[data-pieza='parada-${i}']`),
    );
    const miradas = PARADAS.map((_, i) =>
      svg.querySelector<SVGGElement>(`[data-pieza='mirada-${i}']`),
    );
    const sonrisas = PARADAS.map((_, i) =>
      svg.querySelector<SVGPathElement>(`[data-pieza='sonrisa-${i}']`),
    );
    const bocas = PARADAS.map((_, i) =>
      svg.querySelector<SVGEllipseElement>(`[data-pieza='boca-${i}']`),
    );
    const placas = PARADAS.map((_, i) =>
      svg.querySelector<SVGTextElement>(`[data-pieza='placa-${i}']`),
    );

    /** El punto del camino a una fracción de su largo. */
    const puntoEn = (f: number) =>
      trazado.getPointAtLength(Math.max(0, Math.min(1, f)) * largo);

    /*
     * Las paradas no se mueven: se colocan una sola vez. Se hace aquí y no en
     * el marcado porque `getPointAtLength` necesita un trazado ya montado en el
     * documento — antes de eso no hay geometría que preguntar.
     */
    const sitios = PARADAS.map((f, i) => {
      const p = puntoEn(f);
      /* A la derecha si la parada cae en la mitad izquierda, y al revés. */
      const lado = p.x < 150 ? 1 : -1;
      const poste = { x: p.x + lado * SEPARACION, y: p.y };
      enElCamino[i]?.setAttribute("cx", p.x.toFixed(1));
      enElCamino[i]?.setAttribute("cy", p.y.toFixed(1));
      postes[i]?.setAttribute("transform", `translate(${poste.x.toFixed(1)} ${poste.y.toFixed(1)})`);
      return { p, poste };
    });

    /** Cuánto de la sección ya pasó: 0 al entrar por abajo, 1 al salir por arriba. */
    const avance = () => {
      const el = seccion.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (window.innerHeight * 0.6 - r.top) / r.height));
    };

    let donde = avance();
    let raf = 0;
    let anterior = performance.now();
    const minimo = MS_POR_CUADRO[nivel];

    const pintar = () => {
      const p = puntoEn(donde);
      /* La tangente, de un punto un poco más adelante: Cami gira en las curvas. */
      const siguiente = puntoEn(Math.min(1, donde + 0.01));
      const giro =
        (Math.atan2(siguiente.y - p.y, siguiente.x - p.x) * 180) / Math.PI - 90;
      cami?.setAttribute(
        "transform",
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${giro.toFixed(1)})`,
      );

      /* Lo ya recorrido se pinta entero; lo que falta se queda tenue. */
      recorrido?.setAttribute("stroke-dasharray", `${(donde * 1000).toFixed(1)} 1000`);

      /*
       * **Dónde va Cami, en índices de parada.** La cuenta se saca de aquí y no
       * de dividir distancias: dividiendo salía «a 1, a 1, a 3, a 3, a 5», que
       * no es una cuenta de nada — dos paradas seguidas no pueden estar las dos
       * a una parada de distancia.
       *
       * Y cuando Cami está EN una parada, su índice es el de esa parada, no la
       * cuenta continua: el suavizado deja a `donde` un pelo por detrás, y ese
       * pelo bastaba para que el techo saltara un entero — la parada de al lado
       * decía «a 2 paradas» con el camión parado en la anterior. La cuenta y el
       * «¡ya!» tienen que salir de la misma regla o se contradicen en pantalla.
       */
      const enParada = PARADAS.findIndex((f) => Math.abs(f - donde) <= LLEGO);
      const indiceDeCami = enParada >= 0 ? enParada : (donde - PARADAS[0]) / 0.2;

      PARADAS.forEach((f, i) => {
        const estado = estadoDeLaParada(f - donde);

        /*
         * **La mirada.** Cuando lo ve venir o lo ve irse, los ojos apuntan al
         * camión de verdad: el vector va del Tino a Cami, normalizado. Cuando
         * ya casi llega levanta la vista, y cuando no hay nadie mira al suelo.
         */
        const hacia = { x: 0, y: 0 };
        if (estado === "viene" || estado === "seva") {
          const vx = p.x - sitios[i].poste.x;
          const vy = p.y - (sitios[i].poste.y - ALTO_DE_LA_CARA);
          const n = Math.hypot(vx, vy) || 1;
          hacia.x = (vx / n) * 2;
          hacia.y = (vy / n) * 2;
        } else if (estado === "yaviene") {
          hacia.y = -2;
        } else if (estado === "espera") {
          hacia.y = 2;
        }
        miradas[i]?.setAttribute(
          "transform",
          `translate(${hacia.x.toFixed(2)} ${hacia.y.toFixed(2)})`,
        );
        sonrisas[i]?.setAttribute("opacity", estado === "yaviene" ? "1" : "0");
        bocas[i]?.setAttribute("opacity", estado === "llego" ? "1" : "0");

        const placa = placas[i];
        if (!placa) return;
        const faltan = Math.max(1, Math.ceil(i - indiceDeCami));
        /*
         * Una parada por la que Cami YA pasó no dice un número: decir «a 0» o
         * repetir una cuenta que ya no corre sería afirmar algo falso sobre una
         * parada que ahora mismo no tiene camión en camino.
         */
        placa.textContent =
          estado === "llego"
            ? "¡ya!"
            : f < donde
              ? "—"
              : `a ${faltan} ${faltan === 1 ? "parada" : "paradas"}`;
      });
    };

    if (quieto) {
      /* Sin suavizado: se escribe la posición al entrar y en cada scroll. */
      const alRodar = () => {
        donde = avance();
        pintar();
      };
      window.addEventListener("scroll", alRodar, { passive: true });
      window.addEventListener("resize", alRodar);
      alRodar();
      return () => {
        window.removeEventListener("scroll", alRodar);
        window.removeEventListener("resize", alRodar);
      };
    }

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      const desde = ahora - anterior;
      if (desde < minimo) return;
      const dt = Math.min(0.05, desde / 1000);
      anterior = ahora;
      /* Suavizado: el scroll da saltos y Cami no puede teletransportarse. */
      donde += (avance() - donde) * (1 - Math.exp(-dt * 5));
      pintar();
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [nivel, quieto, seccion]);

  return (
    <svg
      ref={lienzo}
      className="landing-hilo"
      viewBox={`0 0 300 ${ALTO}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/*
       * El barrio va DETRÁS del camino: la calle pasa por delante de las casas,
       * no por debajo. Y va en colores de barrio, nunca en el de la ruta — la
       * tiendita no es de ninguna ruta (8.8c).
       */}
      {EL_BARRIO.map((b, i) => (
        <g key={`${b.que}-${i}`} transform={dondeVa(b)}>
          <PiezaDelBarrio que={b.que} />
        </g>
      ))}

      {/*
       * Tres capas, como el diseño: el acotamiento claro que despega la calle
       * del fondo y de los tejados —la regla 8.8c del mapa, que aquí vale
       * igual—, el camino entero en tenue, y encima lo ya recorrido en firme.
       */}
      <path
        data-pieza="trazado"
        d={CAMINO}
        stroke="var(--hueso)"
        strokeWidth="30"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={CAMINO}
        stroke="var(--ruta)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        data-pieza="recorrido"
        d={CAMINO}
        stroke="var(--ruta)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        pathLength="1000"
        strokeDasharray="0 1000"
      />

      {/* La marca de la parada, sobre el camino. */}
      {PARADAS.map((f, i) => (
        <circle
          key={`marca-${f}`}
          data-pieza={`marca-${i}`}
          cx="150"
          cy="0"
          r="6"
          fill="var(--blanco)"
          stroke="var(--carbon)"
          strokeWidth="3"
        />
      ))}

      {/* Y Tino esperando al lado, en su poste. El 0,0 del grupo es el pie. */}
      {PARADAS.map((f, i) => (
        <g key={f} data-pieza={`parada-${i}`}>
          <rect x="-2.5" y="-30" width="5" height="30" fill="var(--carbon)" />
          <rect x="-9" y="-4.5" width="18" height="4.5" rx="2.2" fill="var(--carbon)" />

          <circle cx="0" cy="-47" r="17" fill="var(--ruta)" />
          <circle cx="-6" cy="-49" r="5" fill="var(--ojo)" />
          <circle cx="6" cy="-49" r="5" fill="var(--ojo)" />
          <g data-pieza={`mirada-${i}`}>
            <circle cx="-6" cy="-49" r="2.6" fill="var(--pupila)" />
            <circle cx="6" cy="-49" r="2.6" fill="var(--pupila)" />
          </g>
          <path
            data-pieza={`sonrisa-${i}`}
            d="M-5 -41 q5 4 10 0"
            fill="none"
            stroke="var(--pupila)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0"
          />
          <ellipse
            data-pieza={`boca-${i}`}
            cx="0"
            cy="-39"
            rx="3.2"
            ry="2.8"
            fill="var(--pupila)"
            opacity="0"
          />

          {/*
           * La placa cuelga del poste, bajo la barbilla, y **escribe la
           * unidad**, como todas las de la portada. Con cinco placas contando
           * 1…5 a la vez se entendería igual, pero es la misma frase que en la
           * calle y en los personajes, y una portada que la escribe en tres
           * sitios y la abrevia en el cuarto enseña que la unidad es opcional.
           */}
          <rect
            x={-ANCHO_PLACA / 2}
            y="-28"
            width={ANCHO_PLACA}
            height="21"
            rx="5"
            fill="var(--carbon)"
          />
          {/* La franja del color de la ruta en el filo de abajo (enmienda (f)). */}
          <rect
            x={-ANCHO_PLACA / 2}
            y="-10"
            width={ANCHO_PLACA}
            height="3"
            rx="1.5"
            fill="var(--ruta)"
          />
          <circle cx={-ANCHO_PLACA / 2} cy="-18.5" r="4.5" fill="var(--ruta)" />
          <circle cx={ANCHO_PLACA / 2} cy="-18.5" r="4.5" fill="var(--ruta)" />
          <text
            data-pieza={`placa-${i}`}
            x="0"
            y="-13.5"
            textAnchor="middle"
            fill="var(--blanco)"
            style={{ font: "800 11px var(--titular)" }}
          >
            a {i + 1} {i === 0 ? "parada" : "paradas"}
          </text>
        </g>
      ))}

      {/* Cami, visto desde arriba, que gira con las curvas del camino. */}
      <g data-pieza="cami">
        <rect x="-26" y="-34" width="52" height="68" rx="14" fill="var(--ruta)" />
        <rect x="-18" y="-30" width="36" height="12" rx="4" fill="var(--hueso)" />
        <rect x="-20" y="-12" width="40" height="22" rx="8" fill="var(--carbon)" />
        <ellipse cx="-8" cy="-1" rx="7" ry="5" fill="var(--ojo)" />
        <ellipse cx="8" cy="-1" rx="7" ry="5" fill="var(--ojo)" />
        <circle cx="-8" cy="-1" r="3.2" fill="var(--pupila)" />
        <circle cx="8" cy="-1" r="3.2" fill="var(--pupila)" />
        <circle cx="-13" cy="24" r="4" fill="var(--hueso)" />
        <circle cx="13" cy="24" r="4" fill="var(--hueso)" />
      </g>
    </svg>
  );
}
