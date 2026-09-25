"use client";

import { useEffect, useRef, useState } from "react";

/**
 * **El rendimiento adaptable de la landing** — §15 del handoff de identidad.
 *
 * La portada tiene calle animada, personajes que miran y, en su nivel más
 * alto, Ontoy en 3D. Nada de eso puede costarle la página a quien la abre en
 * un teléfono de hace cinco años con datos contados. Así que la página **elige
 * cuánto moverse**:
 *
 * | Nivel | Ritmo | Qué trae |
 * |---|---|---|
 * | **alto** | 60 fps | todo, con el 3D de Ontoy con sombras |
 * | **medio** | 32 fps | todo, con el 3D **sin sombras y a 1x** |
 * | **bajo** | 20 fps | sin 3D; Ontoy en 2D y lo mínimo moviéndose |
 *
 * Los tres son de §15 del handoff, tal cual. **El 3D no es exclusivo de
 * `alto`**: sólo `bajo` se queda sin él.
 *
 * ## Dos cosas separadas, y antes eran una sola
 *
 * Este módulo decide **dos** cosas que parecen la misma y no lo son:
 *
 * - **`cargarEl3D`** — si se baja `three` y se monta la escena. Se decide
 *   **una vez**, al abrir, y **no se revoca nunca**.
 * - **`nivel`** — a qué ritmo se mueve todo. Puede **bajar** si la página va
 *   lenta de verdad.
 *
 * Mezclarlas fue el defecto que hizo que el 3D **no se viera nunca**: la
 * medición de fps bajaba el nivel a `medio`, el componente del 3D dependía del
 * nivel, y al cambiar se limpiaba el efecto y **se destruía la escena**. El 3D
 * estaba construido, con sus trucos y todo, y no llegaba a aparecer.
 *
 * Y es que son preguntas distintas. «¿Puede este aparato con el 3D?» se
 * contesta al abrir y la respuesta no cambia mientras la pestaña esté abierta.
 * «¿Va lenta la página ahora?» cambia todo el tiempo — y **desmontar la escena
 * a media mirada es peor que dibujarla a 40 fps**.
 *
 * ## La medición espera a que la página termine de montar
 *
 * Antes medía los primeros 4 segundos. Esos cuatro segundos son exactamente
 * cuando la página está montando todo: hidratando, pidiendo las fuentes,
 * arrancando la calle, resolviendo el `layout`. **Medía el arranque, no la
 * capacidad** — y con eso condenaba a `medio` a máquinas que van de sobra.
 *
 * Ahora espera al `load` y a que el navegador esté desocupado, y sólo entonces
 * mira tres segundos. Y **sólo baja cuando el resultado es claro**: el piso es
 * holgado a propósito, porque una medición dudosa que empeora la página es peor
 * que no medir.
 *
 * ## `reduced-motion` no es un nivel
 *
 * Es otra cosa: quien lo pide no quiere menos cuadros, quiere **que no se
 * mueva**. No se le baja el nivel; se le apaga el movimiento y se le deja la
 * cara.
 */
export type Nivel = "alto" | "medio" | "bajo";

/** Los milisegundos mínimos entre cuadros de cada nivel. `alto` no se limita. */
export const MS_POR_CUADRO: Record<Nivel, number> = {
  alto: 0,
  medio: 1000 / 32,
  bajo: 1000 / 20,
};

/** Cuánto se mira la página a sí misma, ya montada. */
const VENTANA_DE_MEDICION_MS = 3000;

/** Y cuánto se espera tras el `load` antes de empezar a mirar. */
const CALMA_TRAS_MONTAR_MS = 1500;

/**
 * Lo que el aparato declara de sí mismo.
 *
 * ## La regla: **se baja por señales malas, no por falta de señales**
 *
 * Ésta es la corrección del 25 de septiembre, y viene de un teléfono de verdad:
 * un Android con Chrome, que es el teléfono típico de un pasajero de Juárez,
 * salía en 2D — y con `?nivel=alto` en la dirección mostraba el 3D **completo y
 * suave**. El aparato podía; el detector lo castigaba.
 *
 * Es el mismo error que tuvo con Safari, con otro disfraz. Antes castigaba a
 * quien **no declaraba** memoria; luego, corregido eso, seguía castigando por
 * dos cosas que tampoco dicen nada de lo que un aparato puede:
 *
 *  - **El dedo.** `pointer: coarse` dice que es táctil, no que sea lento. Un
 *    teléfono de 2026 mueve este Ontoy sin despeinarse, y mandarlo a `medio`
 *    por ser teléfono es juzgarlo por lo que es y no por lo que hace.
 *  - **`deviceMemory` ≤ 4.** Chrome **no reporta la memoria real**: la redondea
 *    a la baja y la **topa en 8**, así que un teléfono de 6 GB dice «4». Tratar
 *    ese 4 como «aparato modesto» es leer como dato lo que es un tope.
 *
 * Así que ya no se deduce capacidad de indicios blandos. Se baja **sólo cuando
 * el aparato dice algo malo de sí mismo**:
 *
 * | Señal | Qué es | Nivel |
 * |---|---|---|
 * | `saveData` | lo pidió quien navega | `bajo` |
 * | 2G o slow-2G | la red no da | `bajo` |
 * | `deviceMemory` ≤ 2 | poca memoria, **declarada** | `bajo` |
 * | `hardwareConcurrency` ≤ 2 | poco procesador | `bajo` |
 * | nada de lo anterior | — | `alto` |
 *
 * Y lo que no se declara **no cuenta en contra**: sin `deviceMemory` no se
 * inventa una cifra, y sin `hardwareConcurrency` tampoco.
 *
 * `medio` ya no se elige al abrir: **se cae a él** si la medición de fps
 * encuentra que la página va lenta de verdad. Es la diferencia entre suponer y
 * medir — y §15 lo permite, porque en `medio` el 3D sigue estando, sólo que sin
 * sombras y a 1x.
 */
export function nivelDeclarado(): Nivel {
  if (typeof navigator === "undefined") return "medio";

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const enlace = nav.connection ?? {};

  /*
   * Lo que habla del ENLACE manda sobre todo lo demás y va primero: quien pide
   * ahorrar datos ya dijo lo que quiere, y no hay que deducirlo de nada.
   */
  if (enlace.saveData) return "bajo";
  if (/(^|\b)(slow-)?2g\b/.test(enlace.effectiveType ?? "")) return "bajo";

  /*
   * Y lo que el aparato declara de malo de sí mismo. Los dos son `undefined`
   * en algún navegador, y por eso se comprueba el tipo: **ausente no es poco**.
   */
  const memoria = nav.deviceMemory;
  if (typeof memoria === "number" && memoria <= 2) return "bajo";

  const nucleos = nav.hardwareConcurrency;
  if (typeof nucleos === "number" && nucleos <= 2) return "bajo";

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
 * El nivel de esta visita, si se carga el 3D, y si el movimiento está apagado.
 *
 * `quieto` es `prefers-reduced-motion`. Quien lo tiene puesto **no entra a la
 * medición de fps**: no hay bucle que medir, y medir los cuadros de algo que no
 * se mueve daría un número sin sentido del que luego se sacarían conclusiones.
 */
export function useNivelDeRendimiento(): {
  nivel: Nivel;
  cargarEl3D: boolean;
  el3DLigero: boolean;
  quieto: boolean;
} {
  /*
   * `bajo` y `false` es lo que el servidor rinde, y con lo que el cliente tiene
   * que empezar para que la hidratación case. Lo demás se sabe tras montar.
   */
  const [nivel, setNivel] = useState<Nivel>("bajo");
  const [cargarEl3D, setCargarEl3D] = useState(false);
  const [el3DLigero, setEl3DLigero] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const yaBajo = useRef(false);

  useEffect(() => {
    const sinMovimiento =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    setQuieto(sinMovimiento);

    const aMano = nivelPedidoEnLaUrl(location.search);
    const elegido = aMano ?? nivelDeclarado();
    setNivel(elegido);

    /*
     * **Ésta es la decisión que no se revoca.** Si el aparato da para el 3D al
     * abrir, el 3D se carga y se queda: lo que venga después puede cambiar el
     * RITMO, nunca quitar la escena de debajo de quien la está mirando.
     *
     * Y el 3D es de `alto` **y de `medio`**, que es lo que dice §15 —«medio: 32
     * fps; el 3D sin sombras y a resolución 1x»—. Atarlo sólo a `alto` fue una
     * lectura mía de más: dejaba escrito en la escena un camino de medio que no
     * se podía alcanzar, y mandaba a 2D a teléfonos que sí pueden. Sin 3D se
     * queda sólo `bajo`, que es lo que §15 dice de `bajo`.
     */
    setCargarEl3D(elegido !== "bajo");
    setEl3DLigero(elegido === "medio");

    /*
     * Un nivel pedido a mano no se corrige solo: quien escribe `?nivel=alto`
     * está pidiendo ver ese nivel, y que la página se lo bajara al primer
     * tropiezo haría imposible revisarlo.
     */
    if (sinMovimiento || aMano) return;

    let raf = 0;
    let dejarDeEsperar: (() => void) | null = null;

    /** Mira los cuadros un rato y baja de nivel sólo si va claramente lenta. */
    const medir = () => {
      let cuadros = 0;
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
         * Pisos holgados, y a propósito. El de `alto` no es 45 sino 32: entre
         * 32 y 60 fps la página se ve perfectamente bien, y bajar de nivel ahí
         * cambiaría algo que nadie está notando. Se baja cuando **se nota**.
         */
        const piso = elegido === "alto" ? 32 : elegido === "medio" ? 20 : 0;

        if (fps < piso && !yaBajo.current) {
          yaBajo.current = true;
          setNivel(unEscalonAbajo(elegido));
        }
      };
      raf = requestAnimationFrame(contar);
    };

    /*
     * Y se mide **cuando la página ya terminó de montar**, no mientras lo hace.
     * Medir el arranque —hidratación, fuentes, la calle poniéndose en marcha—
     * es medir lo que nunca se repite, y condenaba a `medio` a máquinas que van
     * de sobra.
     */
    const cuandoEsteMontada = () => {
      const pedir = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
      const soltar = window.cancelIdleCallback ?? clearTimeout;
      const t = setTimeout(() => {
        const id = pedir(() => medir(), { timeout: 2000 });
        dejarDeEsperar = () => soltar(id as never);
      }, CALMA_TRAS_MONTAR_MS);
      dejarDeEsperar = () => clearTimeout(t);
    };

    if (document.readyState === "complete") {
      cuandoEsteMontada();
    } else {
      window.addEventListener("load", cuandoEsteMontada, { once: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      dejarDeEsperar?.();
      window.removeEventListener("load", cuandoEsteMontada);
    };
  }, []);

  return { nivel, cargarEl3D, el3DLigero, quieto };
}
