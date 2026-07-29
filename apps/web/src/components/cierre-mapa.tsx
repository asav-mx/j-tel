"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { ServicioDelCierre } from "@/lib/cierre-data";

/**
 * El turno en el mapa — solo lo que necesita al usuario.
 *
 * Por defecto dibuja únicamente los servicios con excepción. Catorce rutas
 * encimadas no son un mapa, son un espagueti, y el problema no se resuelve
 * dibujando mejor: se resuelve no dibujando lo que ya está bien.
 *
 * La línea base es el **trazado contratado**. El recorrido real solo se dibuja
 * donde el árbitro acreditó una unidad, y ya viene cortado en la llegada.
 */

const COLOR = {
  rojo: "#E5484D",
  ambar: "#E3A81F",
  acero: "#7A9CB8",
  /**
   * La geocerca es territorio, no resultado: va en gris de apoyo.
   * Verde, ámbar y rojo están reservados para veredictos y no se prestan ni
   * para dibujar el destino.
   */
  tenue: "#71808F",
} as const;

function colorDe(s: ServicioDelCierre): string {
  if (s.estado === "no_cumplido") return COLOR.rojo;
  if (s.estado === "pendiente_evidencia") return COLOR.ambar;
  if (s.timing === "tarde") return COLOR.ambar;
  return COLOR.acero;
}

export function CierreMapa({
  excepciones,
  limpios,
}: {
  excepciones: ServicioDelCierre[];
  limpios: ServicioDelCierre[];
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const capas = useRef<import("leaflet").LayerGroup | null>(null);
  const [mostrarLimpios, setMostrarLimpios] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !contenedor.current) return;
      if (!mapa.current) {
        mapa.current = L.map(contenedor.current, {
          zoomControl: true,
          attributionControl: false,
        });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
        }).addTo(mapa.current);
        capas.current = L.layerGroup().addTo(mapa.current);
      }
      const grupo = capas.current!;
      grupo.clearLayers();

      const visibles = mostrarLimpios ? [...excepciones, ...limpios] : excepciones;
      const puntos: Array<[number, number]> = [];
      const geocercasDibujadas = new Set<string>();

      for (const s of visibles) {
        const color = colorDe(s);

        // Geocerca de destino: una por polígono, no una por servicio.
        if (s.geofencePolygon.length >= 3) {
          const clave = JSON.stringify(s.geofencePolygon[0]);
          if (!geocercasDibujadas.has(clave)) {
            geocercasDibujadas.add(clave);
            L.polygon(
              s.geofencePolygon.map((p) => [p.lat, p.lng] as [number, number]),
              {
                color: COLOR.tenue,
                weight: 1.5,
                opacity: 0.6,
                dashArray: "3 4",
                fill: false,
              },
            ).addTo(grupo);
          }
        }

        // Trazado contratado — la línea base, siempre disponible.
        if (s.kmlWaypoints.length >= 2) {
          const linea = s.kmlWaypoints.map((p) => [p.lat, p.lng] as [number, number]);
          puntos.push(...linea);
          L.polyline(linea, {
            color,
            weight: s.excepcion ? 2.5 : 1.5,
            opacity: s.excepcion ? 0.95 : 0.32,
            // Punteado donde la evidencia tiene hueco: el trazo mismo lo dice.
            dashArray: s.estado === "pendiente_evidencia" ? "6 6" : undefined,
          })
            .bindTooltip(`${s.profileName} · ${etiqueta(s)}`, { sticky: true })
            .addTo(grupo);
        }

        // Recorrido real, solo con unidad acreditada y cortado en la llegada.
        if (s.gpsTrack.length >= 2) {
          L.polyline(
            s.gpsTrack.map((p) => [p.lat, p.lng] as [number, number]),
            { color: COLOR.acero, weight: 2, opacity: 0.75 },
          )
            .bindTooltip(`${s.profileName} · recorrido real`, { sticky: true })
            .addTo(grupo);
        }
      }

      if (puntos.length > 0) {
        mapa.current!.fitBounds(L.latLngBounds(puntos).pad(0.12));
      } else {
        mapa.current!.setView([31.69, -106.42], 11);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [excepciones, limpios, mostrarLimpios]);

  useEffect(() => {
    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  const nLimpios = limpios.length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--tenue)]">
          <Marca color={COLOR.rojo} texto="No cumplido" />
          <Marca color={COLOR.ambar} texto="Pendiente por evidencia · tarde" />
          <Marca color={COLOR.acero} texto="Recorrido real y rutas limpias" />
          <Marca color={COLOR.tenue} texto="Destino · geocerca" punteada />
        </div>
        {nLimpios > 0 ? (
          <button
            type="button"
            onClick={() => setMostrarLimpios((v) => !v)}
            aria-pressed={mostrarLimpios}
            className="flex cursor-pointer items-center gap-2 font-mono text-[11.5px] text-[var(--tenue)] transition-colors hover:text-[var(--texto)]"
          >
            <span
              className={`relative block h-[18px] w-[34px] flex-none rounded-full border border-white/20 transition-colors ${
                mostrarLimpios ? "bg-[rgba(122,156,184,.25)]" : ""
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] block h-3 w-3 rounded-full transition-transform ${
                  mostrarLimpios
                    ? "translate-x-4 bg-[var(--acero)]"
                    : "bg-[var(--tenue)]"
                }`}
              />
            </span>
            Mostrar {nLimpios === 1 ? "la ruta que cerró limpio" : `las ${nLimpios} rutas que cerraron limpio`}
          </button>
        ) : null}
      </div>

      <div
        ref={contenedor}
        className="h-[380px] w-full border border-white/10 bg-[var(--panel)]"
        role="img"
        aria-label="Mapa del turno: por defecto solo los servicios con excepción"
      />

      <p className="mt-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--tenue)]">
        La línea es el <b className="font-medium text-[var(--texto)]">trazado contratado</b>, con el
        color del resultado. El recorrido real se dibuja en acero solo donde se acreditó una unidad,
        y corta en la llegada a la geocerca.
      </p>
    </div>
  );
}

function etiqueta(s: ServicioDelCierre): string {
  if (s.estado === "no_cumplido") return "no cumplido";
  if (s.estado === "pendiente_evidencia") return "pendiente por evidencia";
  if (s.timing === "tarde") return "cumplido · tarde";
  return "cumplido";
}

function Marca({
  color,
  texto,
  punteada,
}: {
  color: string;
  texto: string;
  punteada?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <i
        className="block h-0 w-[15px]"
        style={{ borderTop: `3px ${punteada ? "dashed" : "solid"} ${color}` }}
      />
      {texto}
    </span>
  );
}
