"use client";

import { useEffect, type RefObject } from "react";
import { MS_POR_CUADRO, type Nivel } from "./nivel-de-rendimiento";

/**
 * **Los ojos de Ontoy, vivos** — la mecánica que comparten el wordmark del hero
 * y los personajes de la landing.
 *
 * Hace dos cosas, y las dos significan algo en este universo:
 *
 *  - **Siguen a quien está leyendo.** La mirada es señal, no adorno: al frente
 *    es «te habla a ti», y seguir el cursor es esa misma señal cuando hay un
 *    cursor de por medio.
 *  - **Parpadean** cada pocos segundos, con el intervalo movido a propósito
 *    para que no se vuelva un tic.
 *
 * ## Está aquí y no copiado en cada personaje
 *
 * Porque el parpadeo tiene que ser **el mismo** en todos: dos personajes en la
 * misma pantalla parpadeando con ritmos distintos se ven como dos dibujos, no
 * como dos habitantes del mismo mundo. Y porque la regla de `reduced-motion`
 * vale para todos, y una regla repetida en cinco archivos es una regla que
 * alguien va a olvidar en el sexto.
 *
 * ## Escribe el SVG por referencia, no por estado
 *
 * Un `setState` por cuadro volvería a renderizar el árbol sesenta veces por
 * segundo para mover unas elipses. El §15 pide lo contrario. React renderiza
 * el dibujo **una vez**; este bucle le escribe los atributos encima.
 *
 * ## Lo que el ojo espera encontrar
 *
 * Dentro de cada `<g>` que se le pase: una `ellipse.ojo-blanco` y una
 * `ellipse.ojo-pupila`. El blanco se aplasta al parpadear —el ojo no se
 * encoge, se cierra— y la pupila se aplasta y se desplaza.
 */

/** A qué distancia del ojo el desplazamiento de la pupila ya llegó a su tope. */
const DISTANCIA_TOPE = 220;

/** El parpadeo dura 0.18 s y se cierra justo a la mitad. */
const PARPADEO_S = 0.18;

/** Entre parpadeo y parpadeo: de 2.6 a 5.8 segundos. */
const ESPERA_MINIMA_S = 2.6;
const ESPERA_EXTRA_S = 3.2;

export interface OjoVivo {
  /** El `<g>` que envuelve el ojo. */
  ref: RefObject<SVGGElement | null>;
  /** El radio del blanco, en unidades del `viewBox` de ESE ojo. */
  blancoR: number;
  /** El radio de la pupila. */
  pupilaR: number;
  /** Cuánto se desplaza la pupila como mucho. Los ojos chicos se mueven menos. */
  alcance: number;
  /** El centro del ojo en su `viewBox`. Por omisión, 50/50. */
  centro?: { x: number; y: number };
}

export interface OjosVivos {
  ojos: OjoVivo[];
  nivel: Nivel;
  /** `prefers-reduced-motion`: no hay bucle y los ojos se quedan al frente. */
  quieto: boolean;
  /**
   * Un elemento que, al tocarse, hace parpadear. Es la única reacción de este
   * hook: las demás —reír, marearse— son de cada personaje.
   */
  alTocar?: RefObject<HTMLElement | null>;
}

export function useOjosVivos({
  ojos,
  nivel,
  quieto,
  alTocar,
}: OjosVivos): void {
  useEffect(() => {
    if (quieto) return;

    const vivos = ojos
      .map((o) => ({ ...o, g: o.ref.current }))
      .filter((o): o is OjoVivo & { g: SVGGElement } => Boolean(o.g));
    if (vivos.length === 0) return;

    /* Arrancan mirando arriba a la derecha, como el prototipo aprobado. */
    const donde = vivos.map(() => ({ x: 4, y: -3 }));
    const haciaDonde = vivos.map(() => ({ x: 4, y: -3 }));

    const arranque = performance.now();
    let parpadeoEn = -9;
    let proximoParpadeo = 2.2;

    const alMover = (ev: PointerEvent) => {
      /*
       * Sólo el ratón. Un toque no es «estar mirando desde ahí»: es haber
       * tocado y quitado el dedo, y dejar los ojos clavados en el último toque
       * los deja bizcos hasta el siguiente.
       */
      if (ev.pointerType !== "mouse") return;
      vivos.forEach((ojo, i) => {
        const r = ojo.g.getBoundingClientRect();
        const dx = ev.clientX - (r.left + r.width / 2);
        const dy = ev.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.min(1, d / DISTANCIA_TOPE) * ojo.alcance;
        haciaDonde[i] = { x: (dx / d) * m, y: (dy / d) * m };
      });
    };

    const parpadeaYa = () => {
      parpadeoEn = (performance.now() - arranque) / 1000;
    };

    window.addEventListener("pointermove", alMover, { passive: true });
    const tocable = alTocar?.current;
    tocable?.addEventListener("pointerdown", parpadeaYa);

    const minimoEntreCuadros = MS_POR_CUADRO[nivel];
    let anterior = arranque;
    let raf = 0;

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);

      const desde = ahora - anterior;
      if (desde < minimoEntreCuadros) return;
      /* El paso se acota: una pestaña que vuelve del fondo trae un salto enorme. */
      const dt = Math.min(0.05, desde / 1000);
      anterior = ahora;
      const t = (ahora - arranque) / 1000;

      /*
       * Suavizado exponencial: el ojo recorre siempre la misma FRACCIÓN de lo
       * que le falta, así que arranca rápido y frena solo. Va atado a `dt` y no
       * al cuadro, para que se vea igual a 60 que a 20 fps — que es de lo que
       * va todo el §15.
       */
      const k = 1 - Math.exp(-dt * 9);

      if (t > proximoParpadeo) {
        parpadeoEn = t;
        proximoParpadeo = t + ESPERA_MINIMA_S + Math.random() * ESPERA_EXTRA_S;
      }

      const desdeElParpadeo = t - parpadeoEn;
      const abierto =
        desdeElParpadeo < PARPADEO_S
          ? Math.abs(desdeElParpadeo / (PARPADEO_S / 2) - 1)
          : 1;

      vivos.forEach((ojo, i) => {
        const p = donde[i];
        const meta = haciaDonde[i];
        p.x += (meta.x - p.x) * k;
        p.y += (meta.y - p.y) * k;

        const c = ojo.centro ?? { x: 50, y: 50 };
        const blanco = ojo.g.querySelector("ellipse.ojo-blanco");
        const pupila = ojo.g.querySelector("ellipse.ojo-pupila");
        blanco?.setAttribute("ry", (ojo.blancoR * abierto).toFixed(2));
        pupila?.setAttribute("ry", (ojo.pupilaR * abierto).toFixed(2));
        pupila?.setAttribute("cx", (c.x + p.x).toFixed(2));
        pupila?.setAttribute("cy", (c.y + p.y * abierto).toFixed(2));
      });
    };

    raf = requestAnimationFrame(cuadro);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", alMover);
      tocable?.removeEventListener("pointerdown", parpadeaYa);
    };
    /*
     * `ojos` se rearma en cada render del padre, así que entra por longitud y
     * no por identidad: ponerlo entero reengancharía el bucle en cada render y
     * reiniciaría el parpadeo de todos.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, quieto, ojos.length, alTocar]);
}
