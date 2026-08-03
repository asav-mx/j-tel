"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/expediente-ruta-data";

/**
 * El trazado contratado de una ruta, con su corredor a escala.
 *
 * **El corredor se dibuja en metros, no en píxeles.** Un trazo grueso se ve
 * como un corredor y no lo es: al alejar el mapa parecería que el corredor
 * crece, y quien mire sacaría conclusiones sobre cuánto margen tiene una
 * unidad. `L.circle` toma el radio en metros, así que el ancho dibujado es el
 * ancho acordado a cualquier escala. Es la diferencia entre ilustrar y medir.
 *
 * Fondo oscuro en ambos temas: el lienzo es evidencia, y es la excepción
 * declarada del skill.
 *
 * **Audiencia de las dos capas: planta y campus.** No hay ninguna capa de
 * carrier aquí — ni apagada, porque listarla apagada ya diría que existe.
 */

/** Cuántos puntos del trazado llevan círculo de corredor. */
const MUESTRAS_DE_CORREDOR = 90;

function token(nombre: string, respaldo: string): string {
  if (typeof window === "undefined") return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v.length > 0 ? v : respaldo;
}

export function RutaTrazadoMapa({
  puntos,
  corredorMetros,
  geocercas,
}: {
  puntos: LatLng[];
  corredorMetros: number | null;
  geocercas: { id: string; nombre: string; poligono: LatLng[] }[];
}) {
  const [capas, setCapas] = useState({ trazado: true, corredor: true, geocercas: true });
  const [listo, setListo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const encuadradoRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelado = false;
    void import("leaflet").then((L) => {
      if (cancelado || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { scrollWheelZoom: true });
      mapRef.current = map;
      // Sin rótulos de negocios ni tráfico: el fondo aporta geometría de calles
      // y nada más. Misma condición que el lienzo del Workbench.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);
      overlayRef.current = L.layerGroup().addTo(map);
      map.setView([31.69, -106.42], 12);
      setListo(true);
    });
    return () => {
      cancelado = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        overlayRef.current = null;
        leafletRef.current = null;
      }
      setListo(false);
      encuadradoRef.current = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!L || !map || !overlay) return;
    overlay.clearLayers();

    const acero = token("--acero", "#7a9cb8");
    const limites: [number, number][] = [];

    if (capas.corredor && corredorMetros != null && puntos.length > 1) {
      const paso = Math.max(1, Math.floor(puntos.length / MUESTRAS_DE_CORREDOR));
      for (let i = 0; i < puntos.length; i += paso) {
        const p = puntos[i]!;
        L.circle([p.lat, p.lng], {
          radius: corredorMetros,
          color: acero,
          weight: 0,
          fillColor: acero,
          fillOpacity: 0.1,
        }).addTo(overlay);
      }
    }

    if (capas.trazado && puntos.length > 1) {
      L.polyline(
        puntos.map((p) => L.latLng(p.lat, p.lng)),
        { color: acero, weight: 3, opacity: 0.95 },
      )
        .bindTooltip("Trazado contratado", { sticky: true })
        .addTo(overlay);
      for (const p of puntos) limites.push([p.lat, p.lng]);
    }

    if (capas.geocercas) {
      for (const g of geocercas) {
        L.polygon(
          g.poligono.map((p) => L.latLng(p.lat, p.lng)),
          {
            color: acero,
            weight: 1.5,
            opacity: 0.9,
            fillColor: acero,
            fillOpacity: 0.12,
            dashArray: "6 4",
          },
        )
          .bindTooltip(`Destino · ${g.nombre}`, { sticky: true })
          .addTo(overlay);
        for (const p of g.poligono) limites.push([p.lat, p.lng]);
      }
    }

    if (!encuadradoRef.current && limites.length > 0) {
      map.fitBounds(limites, { padding: [24, 24] });
      encuadradoRef.current = true;
    }
  }, [listo, capas, puntos, corredorMetros, geocercas]);

  const CAPAS: { id: keyof typeof capas; label: string; disponible: boolean }[] = [
    { id: "trazado", label: "Trazado contratado", disponible: puntos.length > 1 },
    {
      id: "corredor",
      label: corredorMetros != null ? `Corredor · ${corredorMetros} m` : "Corredor",
      disponible: corredorMetros != null && puntos.length > 1,
    },
    { id: "geocercas", label: "Geocerca de destino", disponible: geocercas.length > 0 },
  ];

  return (
    <div className="flex flex-col gap-2 min-[900px]:flex-row">
      <div className="min-w-0 flex-1">
        <div
          ref={containerRef}
          className="lienzo-workbench h-[380px] w-full rounded-sm border border-[var(--linea)] min-[900px]:h-[440px]"
        />
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-[var(--tenue)]">
          El corredor se dibuja a escala real, en metros: su ancho en pantalla es el ancho
          acordado a cualquier zoom. El trazado es política del contrato, no propiedad del
          producto.
        </p>
      </div>

      <div className="flex-none rounded-sm border border-[var(--linea)] px-3 py-2.5 min-[900px]:w-[200px]">
        <p className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]">
          Capas
        </p>
        {CAPAS.map((c) => (
          <label
            key={c.id}
            className={`mt-1.5 flex items-center gap-2 text-[12px] ${
              c.disponible ? "cursor-pointer text-[var(--texto)]" : "cursor-default text-[var(--tenue)]"
            }`}
          >
            <input
              type="checkbox"
              checked={capas[c.id] && c.disponible}
              disabled={!c.disponible}
              onChange={(e) => setCapas((p) => ({ ...p, [c.id]: e.target.checked }))}
              className="cursor-pointer accent-[var(--acero)]"
            />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="flex-none font-[family-name:var(--fuente-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--tenue)]">
              Planta
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
