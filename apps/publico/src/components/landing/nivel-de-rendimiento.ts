"use client";

import { useEffect, useRef, useState } from "react";

/**
 * **El rendimiento adaptable de la landing** — §15 del handoff de identidad.
 *
 * La portada tiene calle animada, personajes que miran y, en su nivel más
 * alto, Ontoy en 3D. Nada de eso puede costarle la página a quien la abre en
 * un teléfono de hace cinco años con datos contados — que es exactamente el
 * pasajero al que Ontoy sirve. Así que la página **elige cuánto moverse**:
 *
 * | Nivel | Ritmo | Qué trae |
 * |---|---|---|
 * | **alto** | 60 fps | todo, con el 3D de Ontoy |
 * | **medio** | 32 fps | todo menos el 3D |
 * | **bajo** | 20 fps | sin 3D; Ontoy en 2D y lo mínimo moviéndose |
 *
 * **El 3D sólo en «alto»** (decisión de ASAV, 24-sep-2026), y diferido: lo
 * primero que se ve es Ontoy en 2D, siempre, y el 3D llega después, cuando la
 * página ya es usable. En medio y bajo no llega nunca.
 *
 * ## Por qué empieza en «bajo» y sube, y no al revés
 *
 * El nivel se decide en el navegador —el servidor no sabe qué teléfono hay del
 * otro lado— y esta página es **estática**: el HTML que llega es el mismo para
 * todos. Si el primer render supusiera «alto», dos cosas saldrían mal: React
 * marcaría hidratación desigual en cuanto el aparato resultara modesto, y —lo
 * que de verdad importa— **el teléfono más lento sería el que empieza cargando
 * lo más pesado**, justo al revés de lo que se busca.
 *
 * Así que arranca en `bajo`, que es el nivel que no pide nada, y **sube** en
 * cuanto mide. El salto de ritmo al subir se nota menos que una portada que
 * tarda en aparecer.
 *
 * ## Y por qué mide los fps además de preguntar
 *
 * Lo que el navegador declara —memoria, núcleos, tipo de red— es una pista, no
 * una medición: un teléfono puede declarar 8 GB y estar con veinte pestañas
 * abiertas y la batería en ahorro. Así que durante los primeros segundos la
 * página **se mira a sí misma**, y si no alcanza el ritmo de su nivel, baja.
 * Sólo baja: subir por una racha buena haría que el nivel oscilara, y un
 * cambio de ritmo cada pocos segundos se nota más que ir un escalón abajo.
 *
 * ## `reduced-motion` no es un nivel
 *
 * Es otra cosa y por eso va aparte: quien lo pide no quiere menos cuadros,
 * quiere **que no se mueva**. No se le baja el nivel; se le apaga el
 * movimiento y se le deja la cara (la regla del sistema de diseño: con
 * `reduced-motion` sólo cambia la cara).
 */
export type Nivel = "alto" | "medio" | "bajo";

/** Los milisegundos mínimos entre cuadros de cada nivel. `alto` no se limita. */
export const MS_POR_CUADRO: Record<Nivel, number> = {
  alto: 0,
  medio: 1000 / 32,
  bajo: 1000 / 20,
};

/** Cuánto se mira la página a sí misma antes de decidir que va lenta (§15). */
const VENTANA_DE_MEDICION_MS = 4000;

/**
 * Lo que el aparato declara de sí mismo.
 *
 * Es la misma regla del prototipo aprobado, y su orden importa: primero lo que
 * habla del **enlace** (ahorro de datos, 2G), porque quien pide ahorrar datos
 * ya dijo lo que quiere y no hay que deducirlo; después lo que habla del
 * **aparato**.
 *
 * `pointer: coarse` —el dedo— cuenta como señal de teléfono. Un teléfono con
 * cuatro núcleos o menos va a `bajo`; uno con más, a `medio`. El escritorio
 * con memoria de sobra es el único que llega a `alto`.
 */
export function nivelDeclarado(): Nivel {
  if (typeof navigator === "undefined") return "bajo";

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const enlace = nav.connection ?? {};
  const memoria = nav.deviceMemory ?? 4;
  const nucleos = nav.hardwareConcurrency ?? 4;
  const dedo =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  if (enlace.saveData) return "bajo";
  if (/2g/.test(enlace.effectiveType ?? "")) return "bajo";
  if (memoria <= 2) return "bajo";
  if (dedo && nucleos <= 4) return "bajo";
  if (memoria <= 4 || dedo) return "medio";
  return "alto";
}

/** `?nivel=alto|medio|bajo` para poder verlos los tres sin cambiar de teléfono (§15). */
export function nivelPedidoEnLaUrl(busqueda: string): Nivel | null {
  const m = /[?&]nivel=(alto|medio|bajo)\b/.exec(busqueda);
  return m ? (m[1] as Nivel) : null;
}

/** Un escalón hacia abajo. `bajo` ya no baja más. */
function unEscalonAbajo(n: Nivel): Nivel {
  return n === "alto" ? "medio" : "bajo";
}

/**
 * El nivel de esta visita, y si el movimiento está apagado.
 *
 * `quieto` es `prefers-reduced-motion`. Quien lo tiene puesto **no entra a la
 * medición de fps**: no hay bucle que medir, y medir los cuadros de algo que
 * no se mueve daría un número sin sentido del que luego se sacarían
 * conclusiones.
 */
export function useNivelDeRendimiento(): { nivel: Nivel; quieto: boolean } {
  /*
   * `bajo` y `quieto: false` es lo que el servidor rinde, y con lo que el
   * cliente tiene que empezar para que la hidratación case. Lo demás se sabe
   * después de montar.
   */
  const [nivel, setNivel] = useState<Nivel>("bajo");
  const [quieto, setQuieto] = useState(false);
  const yaBajo = useRef(false);

  useEffect(() => {
    const sinMovimiento =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    setQuieto(sinMovimiento);

    const elegido = nivelPedidoEnLaUrl(location.search) ?? nivelDeclarado();
    setNivel(elegido);

    /*
     * Un nivel pedido a mano no se corrige solo: quien escribe `?nivel=alto`
     * está pidiendo ver ese nivel, y que la página se lo bajara al primer
     * tropiezo haría imposible revisarlo.
     */
    if (sinMovimiento || nivelPedidoEnLaUrl(location.search)) return;

    let cuadros = 0;
    let raf = 0;
    const arranque = performance.now();

    const contar = (ahora: number) => {
      cuadros += 1;
      const transcurrido = ahora - arranque;

      if (transcurrido < VENTANA_DE_MEDICION_MS) {
        raf = requestAnimationFrame(contar);
        return;
      }

      const fps = (cuadros * 1000) / transcurrido;
      /*
       * El piso de cada nivel, con holgura: se compara contra un poco menos
       * del ritmo nominal porque los primeros cuadros de una página siempre
       * son los peores —se está montando todo— y bajar de nivel por el arranque
       * castigaría a aparatos que van bien.
       */
      const piso = elegido === "alto" ? 45 : elegido === "medio" ? 26 : 0;

      if (fps < piso && !yaBajo.current) {
        yaBajo.current = true;
        setNivel(unEscalonAbajo(elegido));
      }
    };

    raf = requestAnimationFrame(contar);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { nivel, quieto };
}
