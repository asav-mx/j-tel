"use client";

import { createContext, useContext } from "react";
import { useNivelDeRendimiento, type Nivel } from "./nivel-de-rendimiento";

/**
 * **El nivel de rendimiento, uno para toda la página.**
 *
 * La landing tiene varias piezas que se mueven —el hero, la calle, y las
 * secciones que faltan— y todas necesitan saber a qué ritmo pueden hacerlo. Si
 * cada una lo averiguara por su cuenta pasarían tres cosas, y las tres malas:
 *
 *  1. **Tres mediciones de fps a la vez**, cada una compitiendo por los cuadros
 *     de las otras — midiendo, entre todas, un teléfono más lento del que hay.
 *  2. **Podrían discrepar**: la medición baja de nivel a la que va lenta, así
 *     que el hero acabaría en medio y la calle en alto, en la misma pantalla.
 *  3. Tres bucles de arranque donde basta uno.
 *
 * Así que se averigua **una vez**, arriba, y baja por contexto.
 *
 * ## Por qué es un proveedor y no vuelve cliente la página
 *
 * Este componente es cliente, pero lo que envuelve **no**: React deja pasar
 * componentes de servidor como `children` a través de uno de cliente. Así el
 * título, la frase y el botón de la portada siguen llegando en el HTML, y lo
 * único que espera al JavaScript es el movimiento.
 */
const NivelDeLaPagina = createContext<{
  nivel: Nivel;
  /** Si se baja y se monta el 3D. Se decide una vez y **no se revoca**. */
  cargarEl3D: boolean;
  quieto: boolean;
}>({
  nivel: "bajo",
  cargarEl3D: false,
  quieto: false,
});

export function ProveedorDeNivel({ children }: { children: React.ReactNode }) {
  const valor = useNivelDeRendimiento();
  return (
    <NivelDeLaPagina.Provider value={valor}>
      {children}
    </NivelDeLaPagina.Provider>
  );
}

/** El nivel de esta visita, si se carga el 3D, y si el movimiento está apagado. */
export function useNivel() {
  return useContext(NivelDeLaPagina);
}
