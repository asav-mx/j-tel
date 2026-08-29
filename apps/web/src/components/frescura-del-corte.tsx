"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duracion } from "@/lib/formato-tiempo";

/**
 * Cuánto hace que se midió lo que estás viendo — **y crece solo en pantalla.**
 *
 * La pantalla no se refresca sola a propósito: un tablero que se actualiza
 * callado deja al operador sin saber de cuándo es lo que está leyendo. Pero un
 * corte quieto tiene el problema inverso — a los veinte minutos sigue viéndose
 * igual de firme que al segundo uno.
 *
 * Esto es lo único de la pantalla que se mueve sin que llegue un dato nuevo, y
 * se mueve **en la dirección honesta**: envejece. No inventa nada, no vuelve a
 * consultar y no toca el número de arriba; sólo cuenta el reloj contra la hora
 * del corte, que es un dato que ya venía del servidor.
 *
 * ## Por qué no hay endpoint nuevo
 *
 * `router.refresh()` vuelve a pedir esta misma ruta al servidor y sustituye lo
 * que cambió. No hace falta una API que devuelva posiciones en JSON —que sería
 * una segunda puerta a los mismos datos, con su propia guardia que mantener— ni
 * un sondeo que gaste batería del teléfono en una pantalla que se mira a ratos.
 *
 * ## Cuidado si alguien lo automatiza
 *
 * Poner aquí un `setInterval` con `router.refresh()` convertiría la pantalla en
 * un tablero que se mueve solo, y volvería mentira la frase de arriba. Si algún
 * día se quiere en vivo, se decide en voz alta y se escribe qué pasa cuando la
 * red se cae: hoy, si no actualizas, el número no cambia y el rótulo te dice
 * exactamente desde cuándo.
 */
export function FrescuraDelCorte({ corteIso }: { corteIso: string }) {
  const router = useRouter();
  const [actualizando, empezarActualizacion] = useTransition();
  /*
   * `null` en el primer render, y no el valor calculado.
   *
   * El servidor y el navegador no comparten reloj, así que calcular la edad en
   * el render del servidor produce un número que el cliente contradice al
   * hidratar. Empezar en `null` hace que el hueco sea explícito durante un
   * instante en vez de estampar una cifra que se corrige sola.
   */
  const [edadSeg, setEdadSeg] = useState<number | null>(null);

  useEffect(() => {
    const corte = new Date(corteIso).getTime();
    const medir = () => setEdadSeg(Math.max(0, (Date.now() - corte) / 1000));
    medir();
    // Cada quince segundos: es lo más lento que puede ir sin que el rótulo se
    // quede corto cuando alguien mira la pantalla justo al cambiar de minuto.
    const reloj = setInterval(medir, 15_000);
    return () => clearInterval(reloj);
  }, [corteIso]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={() => empezarActualizacion(() => router.refresh())}
        disabled={actualizando}
        className="rounded border border-[var(--linea-fuerte)] px-3 py-1.5 font-[family-name:var(--fuente-mono)] text-[11px] tracking-[.1em] text-[var(--tenue)] uppercase hover:border-[var(--acero)] hover:text-[var(--texto)] disabled:opacity-60"
      >
        {actualizando ? "Midiendo…" : "Volver a medir"}
      </button>
      <span
        className="font-[family-name:var(--fuente-mono)] text-[12px] text-[var(--tenue)] tabular-nums"
        aria-live="polite"
      >
        {edadSeg === null
          ? "actualizado —"
          : edadSeg < 45
            ? "actualizado hace unos segundos"
            : `actualizado hace ${duracion(edadSeg / 60)}`}
      </span>
    </div>
  );
}
