"use client";

import { useEffect, useState } from "react";
import { PantallaCompleta } from "@/components/ontoy/pantalla-completa";
import { LO_ULTIMO_QUE_SUPE, aDondeRegresar, edadDeLaCopia, palabrasSinSenal } from "@/lib/ontoy/sin-senal";

type Copia = { edad: string | null } | null;

/**
 * La pantalla completa de SIN SEÑAL: Ontoy ondulado, «Sin señal.», una línea
 * y **un** botón (estándar §G).
 *
 * Lo que dice depende de una sola cosa, y la lee aquí mismo: **si hay copia
 * guardada de la app** y de cuándo es. El service worker sabe lo mismo, pero
 * que la pantalla lo pregunte directamente evita que haya dos versiones de la
 * misma respuesta.
 *
 * Hasta que la caché conteste se dibuja la versión sin copia, que no promete
 * nada y es cierta en cualquier caso. Si hay copia, cambia en el siguiente
 * cuadro.
 */
export function SinSenal() {
  /*
   * La página que el pasajero pidió, de la dirección. Se lee al montar y no en
   * el valor inicial: el HTML guardado se armó sin `?desde=`, y un `href`
   * distinto al hidratar React no lo corrige — se quedaría el del servidor.
   */
  const [desde, setDesde] = useState(LO_ULTIMO_QUE_SUPE);
  const [copia, setCopia] = useState<Copia>(null);

  useEffect(() => {
    setDesde(aDondeRegresar(new URLSearchParams(window.location.search).get("desde")));
    let vigente = true;
    if (typeof caches !== "undefined") {
      caches
        .match(LO_ULTIMO_QUE_SUPE)
        .then((r) => {
          if (vigente && r) setCopia({ edad: edadDeLaCopia(r.headers.get("date"), new Date()) });
        })
        .catch(() => {
          /* sin caché legible no hay copia que ofrecer: se queda la versión que no promete */
        });
    }
    return () => {
      vigente = false;
    };
  }, []);

  /*
   * «Cuando vuelva la señal, me actualizo solo.» Es lo que la pantalla
   * promete, y se cumple aquí: al volver la red se regresa a la página que se
   * pidió. Si el teléfono dice «en línea» pero la red no contesta, el service
   * worker trae al pasajero de vuelta aquí; no hay lazo, porque `online` sólo
   * suena cuando la red cambia.
   */
  useEffect(() => {
    const alVolver = () => window.location.replace(desde);
    window.addEventListener("online", alVolver);
    return () => window.removeEventListener("online", alVolver);
  }, [desde]);

  const { ayuda, boton } = palabrasSinSenal(copia, desde);
  return <PantallaCompleta pose="sin-red" titular="Sin señal." ayuda={ayuda} boton={boton} />;
}
