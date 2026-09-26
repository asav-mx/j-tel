"use client";

import { useEffect, useState } from "react";

/**
 * **La hora del teléfono, al día cada 15 s mientras `activo`; quieta si no.**
 *
 * Sin señal, la edad de lo último que se supo tiene que seguir creciendo con
 * el reloj (ver `edadAlDia`), y para eso la pantalla necesita volver a pintarse
 * aunque no llegue ninguna respuesta. Vivía dentro de `atajo-de-parada.tsx`
 * (#610); salió aquí cuando el Mapa necesitó lo mismo, para que Inicio y Mapa
 * cuenten con el mismo reloj y al mismo paso.
 */
export function useAhoraMientras(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [activo]);
  return ahora;
}
