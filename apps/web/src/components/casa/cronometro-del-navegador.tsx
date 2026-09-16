"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * El cronómetro del cascarón — la mitad del navegador.
 *
 * La mitad del servidor (`lib/casa/cronometro.ts`) dice cuánto tardó el render.
 * Ésta dice lo que de verdad vive quien usa la pantalla:
 *
 *   · **carga**: una página abierta de cero — hasta el primer byte, hasta que
 *     el documento está listo y hasta que terminó de cargar todo;
 *   · **navegación**: del clic en un enlace del cascarón a que la pantalla
 *     nueva quedó dibujada (dos cuadros después del cambio de ruta).
 *
 * Se manda con `sendBeacon` a `/api/casa/cronometro`, que sólo escribe la línea
 * en los registros. Números y rutas; nada más. Se quita cuando la lentitud esté
 * cerrada.
 */
export function CronometroDelNavegador() {
  const ruta = usePathname();
  const busqueda = useSearchParams();
  const clic = useRef<{ desde: string; hacia: string; t: number } | null>(null);
  const primera = useRef(true);

  const enviar = (datos: Record<string, string | number>) => {
    try {
      navigator.sendBeacon("/api/casa/cronometro", JSON.stringify(datos));
    } catch {
      /* medir nunca debe romper la pantalla */
    }
  };

  // La carga de cero, una vez.
  useEffect(() => {
    const reportar = () => {
      const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!n) return;
      enviar({
        tipo: "carga",
        hacia: location.pathname,
        primerByte: Math.round(n.responseStart),
        listo: Math.round(n.domContentLoadedEventEnd),
        completo: Math.round(n.loadEventEnd || performance.now()),
      });
    };
    if (document.readyState === "complete") setTimeout(reportar, 0);
    else window.addEventListener("load", () => setTimeout(reportar, 0), { once: true });
  }, []);

  // El clic que empieza una navegación dentro del cascarón.
  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/casa")) return;
      clic.current = { desde: location.pathname, hacia: url.pathname, t: performance.now() };
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, []);

  // La ruta cambió: si venía de un clic, cuánto tardó en quedar dibujada.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const c = clic.current;
    if (!c || c.hacia !== ruta) return;
    clic.current = null;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => enviar({ tipo: "navegacion", desde: c.desde, hacia: c.hacia, ms: Math.round(performance.now() - c.t) })),
    );
  }, [ruta, busqueda]);

  return null;
}
