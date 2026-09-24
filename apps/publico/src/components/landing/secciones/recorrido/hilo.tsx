"use client";

import { useEffect, useRef } from "react";
import { useNivel } from "../../nivel-contexto";
import { MS_POR_CUADRO } from "../../nivel-de-rendimiento";

/**
 * **El hilo del recorrido** — la ruta como una línea vertical, con sus cinco
 * paradas, por la que Cami baja **a la vez que tú**.
 *
 * Es la columna que acompaña a las cinco tarjetas de «El recorrido»: conforme
 * la sección pasa por la pantalla, Cami avanza de parada en parada y la de
 * enfrente se enciende. El movimiento no es decorativo — es lo que hace que
 * «Súbete. Baja despacio» signifique algo.
 *
 * ## Las placas cuentan paradas
 *
 * El prototipo las traía contando minutos, y el texto de entrada lo decía:
 * «su placa cuenta los minutos». Sin corredor calibrado la app no da minutos
 * (8.9b), así que cuentan **a cuántas paradas viene Cami** — y la de enfrente,
 * cuando lo tiene encima, dice «¡ya!».
 *
 * ## Va atado al scroll, no a un reloj
 *
 * Porque lo que cuenta la sección es que **tú** bajas y Cami baja contigo. Con
 * un reloj propio, Cami llegaría al final mientras alguien sigue leyendo la
 * primera tarjeta, y la promesa de la sección se rompería sola.
 *
 * Con `prefers-reduced-motion` la posición se escribe igual pero sin suavizar:
 * el hilo sigue diciendo dónde va Cami, sin animación de por medio.
 */

/** Dónde queda cada parada a lo largo del hilo, de 0 (arriba) a 1 (abajo). */
const PARADAS = [0.1, 0.3, 0.5, 0.7, 0.9];

/** El alto del `viewBox`. La línea va de 40 a 860 para dejar aire arriba y abajo. */
const ALTO = 900;
const DESDE = 40;
const HASTA = 860;

const enY = (f: number) => DESDE + (HASTA - DESDE) * f;

export function Hilo({ seccion }: { seccion: React.RefObject<HTMLElement | null> }) {
  const { nivel, quieto } = useNivel();
  const lienzo = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = lienzo.current;
    if (!svg) return;

    const cami = svg.querySelector<SVGGElement>("[data-pieza='cami']");
    const placas = PARADAS.map((_, i) =>
      svg.querySelector<SVGTextElement>(`[data-pieza='placa-${i}']`),
    );
    const cabezas = PARADAS.map((_, i) =>
      svg.querySelector<SVGCircleElement>(`[data-pieza='cabeza-${i}']`),
    );

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
      const y = enY(donde);
      cami?.setAttribute("transform", `translate(150 ${y.toFixed(1)})`);

      /*
       * **Dónde va Cami, en índices de parada.** La cuenta se saca de aquí y no
       * de dividir distancias: dividiendo salía «a 1, a 1, a 3, a 3, a 5», que
       * no es una cuenta de nada — dos paradas seguidas no pueden estar las dos
       * a una parada de distancia.
       */
      const indiceDeCami = (donde - PARADAS[0]) / 0.2;

      placas.forEach((placa, i) => {
        const faltan = Math.max(1, Math.ceil(i - indiceDeCami));
        const encima = Math.abs(PARADAS[i] - donde) < 0.045;
        if (placa) {
          /*
           * Una parada por la que Cami YA pasó no dice un número: decir «a 0» o
           * repetir una cuenta que ya no corre sería afirmar algo falso sobre
           * una parada que ahora mismo no tiene camión en camino.
           */
          placa.textContent = encima
            ? "¡ya!"
            : PARADAS[i] < donde
              ? "—"
              : `a ${faltan} ${faltan === 1 ? "parada" : "paradas"}`;
        }
        /* La parada donde está Cami se llena; las demás se quedan huecas. */
        cabezas[i]?.setAttribute("fill-opacity", encima ? "1" : "0.55");
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
       * La traza, con su halo del color del lienzo: es la regla 8.8c del mapa,
       * y aquí vale igual — una línea del color de la ruta sobre el fondo puede
       * no separarse lo suficiente, y el halo la separa sin tocarle el color.
       */}
      <path
        d={`M150 ${DESDE} L150 ${HASTA}`}
        stroke="var(--lienzo)"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M150 ${DESDE} L150 ${HASTA}`}
        stroke="var(--ruta)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />

      {PARADAS.map((f, i) => (
        <g key={f} transform={`translate(150 ${enY(f)})`}>
          {/* Tino, chiquito, en cada parada. */}
          <circle cx="0" cy="0" r="17" fill="var(--ruta)" data-pieza={`cabeza-${i}`} fillOpacity="0.55" />
          <circle cx="-6" cy="-2" r="5" fill="var(--ojo)" />
          <circle cx="6" cy="-2" r="5" fill="var(--ojo)" />
          <circle cx="-6" cy="-2" r="2.6" fill="var(--pupila)" />
          <circle cx="6" cy="-2" r="2.6" fill="var(--pupila)" />
          {/*
           * La placa **escribe la unidad**, como todas las de la portada. Con
           * cinco placas contando 1…5 a la vez se entendería igual, pero es la
           * misma frase que en la calle y en los personajes, y una portada que
           * la escribe en tres sitios y la abrevia en el cuarto enseña que la
           * unidad es opcional.
           */}
          <rect x="24" y="-12" width="104" height="24" rx="5" fill="var(--carbon)" />
          <text
            data-pieza={`placa-${i}`}
            x="76"
            y="4"
            textAnchor="middle"
            fill="var(--blanco)"
            style={{ font: "800 11px var(--titular)" }}
          >
            a {i + 1} {i === 0 ? "parada" : "paradas"}
          </text>
        </g>
      ))}

      {/* Cami, de frente y visto desde arriba del hilo. */}
      <g data-pieza="cami" transform={`translate(150 ${enY(0)})`}>
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
