"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * El tema de la app del pasajero: claro por omisión, oscuro incluido.
 *
 * Vivía dentro de `vista-pasajero.tsx`, y salió de ahí al aparecer la segunda
 * pantalla que lo necesita. **No es limpieza: dos copias de esta decisión se
 * separan.** La llave de almacenamiento, el arranque en claro y el momento en
 * que se lee la preferencia del sistema tendrían que acordarse por su cuenta en
 * cada archivo, y el día que una cambie el pasajero vería un tema en la ruta y
 * otro en el buscador.
 */

const LLAVE = "jtel-tema";

export type Tema = "dia" | "noche";

export function useTema(): { deNoche: boolean; alternar: () => void } {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    try {
      const g = localStorage.getItem(LLAVE);
      if (g === "dia" || g === "noche") setTema(g);
    } catch {
      /* modo privado: se queda con la preferencia del sistema */
    }
  }, []);

  useEffect(() => {
    if (tema) document.documentElement.dataset.tema = tema;
    else delete document.documentElement.dataset.tema;
  }, [tema]);

  /*
   * La preferencia del sistema vive en ESTADO y no se lee al vuelo.
   *
   * Leer `window.matchMedia` dentro del render tira el render del SERVIDOR con
   * «window is not defined»: estos componentes son de cliente, pero Next los
   * pinta primero en el servidor. Y de paso queda reactivo: si el teléfono
   * entra en modo oscuro a las siete de la tarde, la app lo sigue sin recargar.
   *
   * Arranca en `false` —claro por omisión, como manda el diseño— y se corrige
   * en cuanto monta.
   */
  const [sistemaOscuro, setSistemaOscuro] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    setSistemaOscuro(mq.matches);
    const alCambiar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  const deNoche = tema ? tema === "noche" : sistemaOscuro;

  const alternar = useCallback(() => {
    const nuevo: Tema = deNoche ? "dia" : "noche";
    setTema(nuevo);
    try {
      localStorage.setItem(LLAVE, nuevo);
    } catch {
      /* sin almacenamiento, el tema dura lo que la sesión */
    }
  }, [deNoche]);

  return { deNoche, alternar };
}
