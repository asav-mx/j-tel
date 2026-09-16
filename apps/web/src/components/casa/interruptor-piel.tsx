"use client";

import { useEffect, useState } from "react";
import { LLAVE_TEMA } from "@/components/tema-inicial";

type Piel = "clara" | "oscura";

/**
 * El interruptor de piel del cascarón.
 *
 * Hace lo mismo que `InterruptorTema` y **comparte con él la llave y el
 * atributo** —`LLAVE_TEMA` se importa, no se copia— porque la preferencia de
 * piel es una sola por persona: si el cascarón guardara la suya aparte, cruzar
 * de una pantalla vieja a una nueva cambiaría de piel a media navegación.
 *
 * Lo que no comparte es la ropa. Aquel botón está escrito con los tokens de la
 * piel anterior (`--texto`, `--hover`, `--azul`), que aquí dentro o no existen
 * o significan otra cosa. Reusarlo se vería casi bien, que es la peor forma de
 * estar mal.
 *
 * El valor real lo fija `TemaInicial` en `<html>` antes del primer pintado;
 * esto sólo lo lee del DOM al montar. Mientras no monta dibuja el mismo hueco
 * sin icono: así no hay salto de layout ni desajuste de hidratación por
 * renderizar en el servidor un icono que depende del navegador.
 *
 * Nota de vocabulario: el dato en `<html>` se sigue llamando `data-tema` con
 * valores `claro`/`oscuro`, que es como lo escribió la piel anterior y como lo
 * leen las pantallas vivas. El skill nuevo les dice «pieles». Cambiar el nombre
 * del atributo obligaría a tocar todo lo vivo, que es justo lo que este PR no
 * hace; se renombra cuando la mudanza termine.
 */
export function InterruptorPiel() {
  const [piel, setPiel] = useState<Piel | null>(null);

  useEffect(() => {
    setPiel(document.documentElement.dataset.tema === "claro" ? "clara" : "oscura");
  }, []);

  function cambiar() {
    const siguiente: Piel = piel === "clara" ? "oscura" : "clara";
    document.documentElement.dataset.tema = siguiente === "clara" ? "claro" : "oscuro";
    setPiel(siguiente);
    try {
      localStorage.setItem(LLAVE_TEMA, siguiente === "clara" ? "claro" : "oscuro");
    } catch {
      /* Sin localStorage el cambio vale para esta sesión y no se recuerda. Vale
         más eso que no dejar cambiar. */
    }
  }

  const etiqueta = piel === "clara" ? "Cambiar a piel oscura" : "Cambiar a piel clara";

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={piel === null}
      title={piel === null ? undefined : etiqueta}
      aria-label={piel === null ? "Cambiar piel" : etiqueta}
      className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-md text-[var(--tenue)] transition-colors hover:bg-[var(--roce)] hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--tinta)]"
    >
      {/* Se dibuja la piel a la que se va a cambiar, no la actual: el icono
          anuncia el destino, que es lo que la persona está por pedir. */}
      {piel === null ? null : piel === "clara" ? <IconoLuna /> : <IconoSol />}
    </button>
  );
}

/* Iconos SVG en línea, de trazo y en currentColor. El skill prohíbe emojis como
   iconos: iconos SVG, y sólo cuando dicen algo. */

function IconoSol() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
