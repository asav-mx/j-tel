"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { TrazaDelActa } from "@jtel/services";
import type { Pedazo } from "@/lib/casa/recorrido";

// Leaflet toca `window` al importarse: el mapa sólo existe en el navegador.
const MapaRecorrido = dynamic(() => import("@/components/casa/mapa-recorrido").then((m) => m.MapaRecorrido), {
  ssr: false,
});

type ConPuntos = Extract<TrazaDelActa, { tipo: "con_puntos" }>;

/**
 * La traza del acta: el mismo mapa de Recorridos y playback, quieto.
 *
 * Todo lo que dibuja llega hecho del servidor —los tramos de la unidad
 * observada, partidos en huecos y saltos y cortados en la llegada sellada— y
 * se dibuja completo, sin playback: el acta cuenta lo que pasó, no lo
 * reproduce. Nada cruza un corte; los extremos de cada hueco y de cada salto
 * llevan su marca. La geocerca de destino va debajo: es donde la traza se
 * corta.
 */
export function TrazaDelActaEnMapa({ traza, clave }: { traza: ConPuntos; clave: string }) {
  const pedazos = useMemo<Pedazo[]>(
    () =>
      traza.tramos
        .filter((t) => t.length > 0)
        .map((t) => {
          const puntos = t.map((p) => ({ lat: p.lat, lng: p.lng, t: Date.parse(p.at), v: p.speed ?? 0 }));
          return { puntos, t0: puntos[0]!.t, t1: puntos[puntos.length - 1]!.t };
        }),
    [traza],
  );
  const lugares = traza.destino
    ? [{ id: traza.destino.id, nombre: traza.destino.nombre, rol: "destino", poligono: traza.destino.poligono }]
    : [];

  return (
    <div className="h-[320px] overflow-hidden rounded-xl border border-[var(--linea)] max-sm:h-[260px]">
      <MapaRecorrido
        clave={clave}
        pedazos={pedazos}
        huecos={traza.huecos}
        saltos={traza.saltos}
        lugares={lugares}
        // Todo recorrido: cada pedazo es anterior al «progreso», así que se dibuja entero en tinta.
        progreso={{ seg: pedazos.length, t: Number.POSITIVE_INFINITY }}
        marcador={null}
      />
    </div>
  );
}
