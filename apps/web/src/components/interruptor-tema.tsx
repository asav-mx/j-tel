"use client";

import { useEffect, useState } from "react";
import { LLAVE_TEMA } from "@/components/tema-inicial";

type Tema = "claro" | "oscuro";

/**
 * El interruptor de tema.
 *
 * Vive abajo en la navegación lateral, junto al usuario: es preferencia
 * personal, no una acción de la pantalla. Por eso no es un botón de acento ni
 * pide atención — se lee como el engrane, no como algo que hay que hacer.
 *
 * El tema real lo fija `TemaInicial` antes del primer pintado; este componente
 * solo lo lee del DOM al montar y lo cambia. Mientras no ha montado dibuja el
 * mismo hueco sin icono: así no hay salto de layout ni desajuste de hidratación
 * por renderizar en el servidor un icono que depende del navegador.
 */
export function InterruptorTema() {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    const actual = document.documentElement.dataset.tema;
    setTema(actual === "claro" ? "claro" : "oscuro");
  }, []);

  function cambiar() {
    const siguiente: Tema = tema === "claro" ? "oscuro" : "claro";
    document.documentElement.dataset.tema = siguiente;
    setTema(siguiente);
    try {
      localStorage.setItem(LLAVE_TEMA, siguiente);
    } catch {
      /* Sin localStorage el cambio vale para esta sesión y no se recuerda.
         Vale más eso que no dejar cambiar. */
    }
  }

  const etiqueta = tema === "claro" ? "Cambiar a tema oscuro" : "Cambiar a tema claro";

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={tema === null}
      title={tema === null ? undefined : etiqueta}
      aria-label={tema === null ? "Cambiar tema" : etiqueta}
      className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-sm text-[var(--tenue)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--texto)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--azul)]"
    >
      {tema === null ? null : tema === "claro" ? <IconoLuna /> : <IconoSol />}
    </button>
  );
}

/* Iconos SVG en línea (trazo, 14px, currentColor) — el skill pide SVG, nunca
   emojis. Se dibuja el tema al que se va a cambiar, no el actual: el icono
   anuncia el destino, que es lo que el usuario está a punto de pedir. */

function IconoSol() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
