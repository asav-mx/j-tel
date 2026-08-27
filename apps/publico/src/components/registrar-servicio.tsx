"use client";

import { useEffect } from "react";

/**
 * Registra el service worker, que es lo que vuelve instalable la app.
 *
 * Falla callado a propósito: sin service worker la app funciona igual, solo
 * pierde el caché de teselas y la capacidad de abrir sin red. Tumbar la pantalla
 * porque un navegador viejo no lo soporta sería cambiar una comodidad por el
 * producto entero.
 */
export function RegistrarServicio() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* modo privado, navegador viejo, permisos: la app sigue sirviendo */
    });
  }, []);
  return null;
}
