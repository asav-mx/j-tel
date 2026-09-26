"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * **La llave de ensayo, del lado del teléfono** (el servidor: `lib/ensayo.ts`).
 *
 * Un teléfono la recibe **una vez**, con `#ensayo=‹llave›` al final de
 * cualquier dirección de la app, y la guarda.
 *
 * **En el fragmento (`#`), no en la consulta (`?`)**, y no es estética: el
 * navegador **nunca** manda el fragmento al servidor. Con `?ensayo=` la llave
 * viajaría en la petición de la página y quedaría escrita en las bitácoras de
 * Vercel; con `#ensayo=` no sale del teléfono más que en la cabecera de la
 * puerta de ensayo. Y el fragmento sobrevive a la redirección de `/c/‹ruta›`,
 * que la consulta no. Desde ahí sus consultas de camiones van a la
 * puerta de ensayo con la llave **en una cabecera**, y en pantalla sale la banda
 * «ENSAYO» para que nadie confunda lo que ve con el servicio.
 *
 * - **La llave se borra de la barra de direcciones en cuanto se lee**, para que
 *   no quede en el historial, ni se comparta con la liga, ni salga en una
 *   captura.
 * - **`#ensayo=salir` la olvida.** Y si el servidor la rechaza —llave mala o
 *   apagada en Vercel— el teléfono la olvida solo en su siguiente consulta y
 *   vuelve a ser un teléfono cualquiera.
 * - El teléfono **no decide nada**: guardar una llave inventada no abre ninguna
 *   puerta. Quien decide es el servidor, que la compara con la de Vercel.
 */

export const LLAVE_EN_EL_TELEFONO = "ontoy.llave-de-ensayo";
/** La misma cadena que `CABECERA_DE_LA_LLAVE` del servidor (lo compara la prueba). */
export const CABECERA_DE_ENSAYO = "x-ontoy-ensayo";
/** El mismo piso que el servidor: algo más corto no puede ser la llave, y no se guarda. */
const LARGO_MINIMO = 32;

export type LoQueDiceLaDireccion = { accion: "guardar"; llave: string } | { accion: "olvidar" } | { accion: "nada" };

/** Lee `#ensayo=…` del fragmento (con o sin el `#`). */
export function leerEnsayoDeLaDireccion(fragmento: string): LoQueDiceLaDireccion {
  const valor = new URLSearchParams(fragmento.replace(/^#/, "")).get("ensayo");
  if (valor === null) return { accion: "nada" };
  if (valor.trim() === "salir") return { accion: "olvidar" };
  if (valor.trim().length >= LARGO_MINIMO) return { accion: "guardar", llave: valor.trim() };
  return { accion: "nada" };
}

/** La dirección sin `ensayo` en el fragmento, para reescribir la barra: lo demás se queda igual. */
export function direccionSinLaLlave(href: string): string {
  const url = new URL(href);
  const fragmento = new URLSearchParams(url.hash.replace(/^#/, ""));
  fragmento.delete("ensayo");
  const resto = fragmento.toString();
  return url.pathname + url.search + (resto ? `#${resto}` : "");
}

/** A dónde pregunta un teléfono de ensayo: la misma lista, en la puerta aparte. */
export function direccionDeEnsayo(direccionPublica: string): string {
  return direccionPublica.replace("/api/circuitos/en-vivo?", "/api/circuitos/en-vivo/ensayo?");
}

/**
 * `leida` es falsa hasta que el teléfono miró su llave. Existe por los
 * contadores de aperturas: un teléfono de ensayo no cuenta, y en el primer
 * cuadro —antes de leer— todavía no se sabe si lo es. Contar ahí fue lo que
 * enseñó la revisión en el navegador.
 */
export function useLlaveDeEnsayo(): { llave: string | null; leida: boolean; olvidar: () => void } {
  const [llave, setLlave] = useState<string | null>(null);
  const [leida, setLeida] = useState(false);

  useEffect(() => {
    try {
      const dice = leerEnsayoDeLaDireccion(window.location.hash);
      if (dice.accion === "guardar") window.localStorage.setItem(LLAVE_EN_EL_TELEFONO, dice.llave);
      if (dice.accion === "olvidar") window.localStorage.removeItem(LLAVE_EN_EL_TELEFONO);
      if (new URLSearchParams(window.location.hash.replace(/^#/, "")).has("ensayo")) {
        window.history.replaceState(window.history.state, "", direccionSinLaLlave(window.location.href));
      }
      setLlave(window.localStorage.getItem(LLAVE_EN_EL_TELEFONO));
    } catch {
      /* sin almacenamiento (modo privado): el teléfono se queda como cualquiera */
    }
    setLeida(true);
  }, []);

  const olvidar = useCallback(() => {
    try {
      window.localStorage.removeItem(LLAVE_EN_EL_TELEFONO);
    } catch {
      /* nada que olvidar */
    }
    setLlave(null);
  }, []);

  return { llave, leida, olvidar };
}
