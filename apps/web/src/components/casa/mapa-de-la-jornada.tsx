"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/**
 * El mapa de la hoja de la jornada (PR C de la ficha de Circuitos, 22-sep-2026).
 *
 * Recuerdo, no vida: **cero cobre**, sin playback, sin cámara que persiga.
 *
 * - **La ruta declarada** va de referencia, en su color de identidad (8.8c),
 *   ancha y suave. No es lo que hizo la unidad: es contra qué se lee.
 * - **La traza medida** va encima, delgada, en tinta — tramo por tramo, como
 *   llegan del servidor. **Nunca se une un tramo con el siguiente**: entre dos
 *   tramos hubo un silencio, y dentro de un silencio no se dibuja trayecto
 *   (9.3c, Pieza 1 §E). Sus dos extremos llevan el círculo hueco del skill.
 * - **Una salida del corredor** se dibuja punteada y más gruesa, en tinta, con
 *   su rótulo al pasar el cursor: la forma la distingue, no el color.
 *
 * Aquí no se calcula nada: los tramos, los silencios y las salidas llegan
 * hechos del motor (B).
 */

export interface MapaDeLaJornadaProps {
  color: string;
  trazados: Array<{ sentido: "ida" | "vuelta"; coordinates: Array<[number, number]> }>;
  paradas: Array<{ nombre: string; lat: number; lon: number }>;
  tramos: Array<Array<{ lat: number; lng: number; at: string }>>;
  salidas: Array<{ desde: string; hasta: string; rotulo: string }>;
}

const JUAREZ: [number, number] = [31.69, -106.42];

export function MapaDeLaJornada({ color, trazados, paradas, tramos, salidas }: MapaDeLaJornadaProps) {
  const nodo = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    let mapa: import("leaflet").Map | null = null;
    void import("leaflet").then((L) => {
      if (cancelado || !nodo.current) return;
      mapa = L.map(nodo.current, { zoomControl: false, attributionControl: true }).setView(JUAREZ, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(mapa);
      L.control.zoom({ position: "bottomright" }).addTo(mapa);

      const encuadre: Array<[number, number]> = [];
      for (const t of trazados) {
        const linea = t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
        encuadre.push(...linea);
        L.polyline(linea, { className: "jornada-ruta", color, interactive: false }).addTo(mapa);
      }
      for (const p of paradas) {
        L.circleMarker([p.lat, p.lon], { radius: 4, className: "jornada-parada" }).bindTooltip(p.nombre).addTo(mapa);
      }
      tramos.forEach((t, i) => {
        const linea = t.map((q) => [q.lat, q.lng] as [number, number]);
        encuadre.push(...linea);
        L.polyline(linea, { className: "jornada-traza", interactive: false }).addTo(mapa!);
        // Los extremos de cada silencio: el fin de este tramo y el principio del siguiente.
        if (i < tramos.length - 1 && t.length > 0) {
          const fin = t.at(-1)!;
          const sig = tramos[i + 1]![0]!;
          for (const q of [fin, sig]) {
            L.circleMarker([q.lat, q.lng], { radius: 6, className: "punto-hueco", interactive: false }).addTo(mapa!);
          }
        }
      });
      // Las salidas: el pedazo de traza que cae dentro de cada una, punteado encima.
      for (const s of salidas) {
        const d = Date.parse(s.desde);
        const h = Date.parse(s.hasta);
        for (const t of tramos) {
          const dentro = t.filter((q) => {
            const x = Date.parse(q.at);
            return x >= d && x <= h;
          });
          if (dentro.length > 1) {
            L.polyline(
              dentro.map((q) => [q.lat, q.lng] as [number, number]),
              { className: "jornada-salida" },
            )
              .bindTooltip(s.rotulo, { sticky: true })
              .addTo(mapa!);
          }
        }
      }
      if (encuadre.length > 1) mapa.fitBounds(L.latLngBounds(encuadre).pad(0.1), { maxZoom: 16 });
    });
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [color, trazados, paradas, tramos, salidas]);

  return (
    <div
      ref={nodo}
      role="img"
      aria-label="El recorrido medido de la unidad sobre la ruta del circuito"
      className="mapa-flota h-[420px] w-full overflow-hidden rounded-[10px] border border-[var(--linea)] max-sm:h-[320px]"
    />
  );
}
