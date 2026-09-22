"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CircuitoEditor } from "@/components/circuito-editor";
import { clases } from "@/components/casa/formulario";

/**
 * El editor del mapa de siempre, **envuelto por fuera y sin tocarlo** (PR A3 de
 * la ficha de Circuitos, 21-sep-2026). ASAV: «Es el que uso en la prueba.
 * Envuélvelo por fuera; si le cambias la piel al componente, cambias la
 * pantalla vieja.» Este archivo no le pasa nada que la pantalla vieja no le
 * pase ya: las mismas cuatro props, las mismas rutas.
 *
 * Lo único que agrega el envoltorio:
 *
 *  - **El rótulo**, que dice que es el editor de siempre. Adentro rige su piel
 *    —la vieja—: son dos pieles en esta sección, decidido y a la vista.
 *  - **«Poner al día la cadena».** El editor escribe solo y no avisa, así que la
 *    cadena y los pasos 2 y 3 de arriba siguen diciendo lo de antes hasta
 *    recargar. `router.refresh()` vuelve a leer el servidor sin desmontar el
 *    editor: lo que tenga abierto no se pierde.
 *
 * **Deuda escrita hasta el PR D** (ASAV, 21-sep): en el mapa del editor el
 * sentido de una parada se distingue sólo por color (ida azul, vuelta ámbar),
 * y el skill pide forma. No se arregla aquí porque arreglarlo es tocar el
 * editor; mientras tanto la lista del paso 3 lo dice con palabras y con su
 * distancia. Se paga cuando D rehaga el editor en la piel nueva.
 */
export function EditorDelMapa(props: React.ComponentProps<typeof CircuitoEditor>) {
  const router = useRouter();
  const [recargando, recargar] = useTransition();

  return (
    <section id="editor" aria-label="Editor del mapa" className="mt-3 flex scroll-mt-6 flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[16px]" style={{ fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.01em" }}>
          Editor del mapa
        </h2>
        <span className="text-[13px] text-[var(--tenue)]">
          el de siempre, sin cambios: aquí se sube el trazado y se ponen, corrigen y mueven las paradas
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={clases.secundario} disabled={recargando} onClick={() => recargar(() => router.refresh())}>
          {recargando ? "Poniendo al día…" : "Poner al día la cadena"}
        </button>
        <span className={clases.ayuda}>El editor guarda solo; la cadena de arriba se pone al día con este botón o al recargar.</span>
      </div>
      <div className="rounded-[10px] border border-[var(--linea)] p-3">
        <CircuitoEditor {...props} />
      </div>
    </section>
  );
}
