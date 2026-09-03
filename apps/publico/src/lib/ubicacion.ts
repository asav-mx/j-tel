"use client";

import { useEffect, useState } from "react";

/**
 * Dónde está el pasajero. **Nunca sale del teléfono.**
 *
 * No es una promesa de política: no hay ninguna petición en esta app que la
 * mande. `watchPosition` corre aquí, y lo que se calcula con el resultado —la
 * llegada, y si una ruta te sirve— se calcula aquí también.
 *
 * Salió de `vista-pasajero.tsx` cuando el buscador la necesitó igual. Dos
 * copias de esto serían dos lugares donde alguien puede, sin querer, mandarla a
 * algún lado; una sola es un solo lugar que revisar.
 *
 * Devuelve `null` mientras no haya permiso o no haya llegado el primer fix, y
 * **eso no es un error**: las dos pantallas siguen sirviendo sin ubicación. La
 * ruta enseña su recorrido y su frecuencia; el buscador pide que el pasajero
 * pique también de dónde sale.
 */
export function useMiUbicacion(): { lat: number; lon: number } | null {
  const [yo, setYo] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setYo({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {
        /* Sin permiso la app sigue sirviendo. No se insiste ni se bloquea. */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return yo;
}
