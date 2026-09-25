"use client";

import { useEffect, useRef, useState } from "react";
import { useNivel } from "../nivel-contexto";
import type { Ontoy3D } from "./escena";

/**
 * **Ontoy en 3D, cargado tarde y sólo cuando conviene.**
 *
 * Decisión de ASAV del 24-sep-2026, y este archivo es donde vive entera:
 *
 *  - **Sólo en el nivel alto.** En medio y bajo no se descarga ni un byte de
 *    `three`.
 *  - **Diferido**, después de que la página ya es usable.
 *  - **Ontoy en 2D es lo primero que se ve, siempre.** El 3D no lo reemplaza
 *    hasta estar dibujado, y si nunca llega, el 2D se queda — que es lo que ve
 *    todo el mundo en medio y bajo.
 *  - **Desde npm, en nuestro paquete.** Nunca un CDN ajeno.
 *
 * ## Las tres puertas antes de bajar `three`
 *
 * 1. **El nivel al abrir.** Sólo `alto` — y esa respuesta **no se revoca**: si
 *    después la página va lenta, baja el RITMO, pero la escena no se quita de
 *    debajo de quien la está mirando. Mezclar las dos cosas fue el defecto que
 *    hacía que el 3D no se viera nunca.
 * 2. **Que se vea.** Un `IntersectionObserver` espera a que el hueco esté a la
 *    vista. Quien abre la portada y baja de golpe al pie no llega a pedirlo.
 * 3. **Que el navegador esté desocupado.** `requestIdleCallback` con un tope de
 *    tiempo, para no competir con lo que la página todavía está montando. El
 *    tope existe porque en una pestaña de fondo la inactividad puede no llegar
 *    nunca.
 *
 * Y una cuarta que no es puerta sino cortesía: con `prefers-reduced-motion` el
 * 3D **sí** se monta, pero quieto. Quien lo pide no quiere que no haya nada;
 * quiere que no se mueva.
 *
 * ## Por qué no `next/dynamic`
 *
 * Porque `next/dynamic` decide en el render, y esto tiene que decidir **después
 * de medir** —el nivel se conoce tras montar, y la inactividad después—. Un
 * `import()` dentro del efecto hace lo mismo con el mismo troceado de Next, y
 * además deja pedir el módulo en el momento exacto.
 */
export function OntoyEn3D({ children }: { children: React.ReactNode }) {
  const { cargarEl3D, quieto } = useNivel();
  const hueco = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    if (!cargarEl3D) return;
    const caja = hueco.current;
    if (!caja) return;

    let vivo = true;
    let ontoy: Ontoy3D | null = null;
    let cancelarOcio: (() => void) | null = null;

    const traer = async () => {
      try {
        const { montarOntoy3D } = await import("./escena");
        if (!vivo || !hueco.current) return;
        ontoy = montarOntoy3D(hueco.current, { quieto });
        setMontado(true);
      } catch {
        /*
         * Si el fragmento no baja —red caída, un bloqueador, una tarjeta de
         * video que no da WebGL— **no pasa nada**: el 2D sigue donde estaba y
         * la portada se ve entera. Un 3D que falla no puede llevarse la página.
         */
      }
    };

    /* Segunda puerta: que el hueco esté a la vista. */
    const mirando = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        mirando.disconnect();

        /* Tercera: que el navegador esté desocupado, con tope por si nunca lo está. */
        const pedir = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
        const soltar = window.cancelIdleCallback ?? clearTimeout;
        const id = pedir(() => traer(), { timeout: 2500 });
        cancelarOcio = () => soltar(id as never);
      },
      { rootMargin: "200px" },
    );
    mirando.observe(caja);

    return () => {
      vivo = false;
      mirando.disconnect();
      cancelarOcio?.();
      ontoy?.destruir();
      setMontado(false);
    };
  }, [cargarEl3D, quieto]);

  return (
    <div className="landing-ontoy-3d">
      {/*
       * El 2D y el hueco del 3D van UNO ENCIMA DEL OTRO, y el 2D sólo se
       * esconde cuando el 3D ya está dibujado. Quitarlo antes dejaría un
       * agujero en la portada durante lo que tarde en bajar `three`.
       *
       * Se esconde con `visibility`, no desmontándolo: así el hueco conserva su
       * tamaño y nada de alrededor se mueve al cambiar uno por otro.
       */}
      <div className="landing-ontoy-2d" style={montado ? { visibility: "hidden" } : undefined}>
        {children}
      </div>
      <div ref={hueco} className="landing-ontoy-lienzo" aria-hidden="true" />
    </div>
  );
}
