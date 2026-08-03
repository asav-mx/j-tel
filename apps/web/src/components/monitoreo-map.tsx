"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MonitoreoRoute } from "@/lib/monitoreo-data";
import { SIN_SENAL_MINUTOS } from "@/lib/monitoreo-umbrales";

/**
 * El mapa de la torre — zona dominante de la pantalla (Ficha-Monitoreo §3.3).
 *
 * **Capas apagables, nunca dibujo fijo**, y cada capa declara su audiencia. La
 * confidencialidad no la hace cumplir este panel sino el servidor: la capa de
 * carrier —el resto de la flota— no se manda, y por eso no se lista aquí ni
 * siquiera apagada. Listarla apagada ya le diría a la planta que existe.
 *
 * La traza corta al entrar a la geocerca. Eso se resuelve en `monitoreo-data`:
 * lo que llega a este componente ya viene cortado, y no hay forma de dibujar
 * movimiento posterior aunque alguien quisiera.
 */

/*
 * La paleta de identidad vive en `lib/colores-identidad` porque la comparten
 * este lienzo (cliente) y pantallas de servidor. Se re-exporta para no mover
 * los imports existentes, y la prueba de este archivo la sigue midiendo.
 */
export { COLORES_IDENTIDAD } from "@/lib/colores-identidad";
import { colorDeIdentidad } from "@/lib/colores-identidad";

function colorFor(r: MonitoreoRoute): string {
  return colorDeIdentidad(r.colorIndex);
}

/**
 * Lee un token del tema vigente: leaflet dibuja en canvas/SVG y no acepta
 * clases, así que el color tiene que viajar como valor. El respaldo es último
 * recurso —solo se usa si el token desapareciera de la hoja— y por eso repite
 * el valor de la paleta oscura en vez de inventar uno.
 */
function token(nombre: string, respaldo: string): string {
  if (typeof window === "undefined") return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v.length > 0 ? v : respaldo;
}

type Capas = {
  unidades: boolean;
  huella: boolean;
  kml: boolean;
  geocercas: boolean;
  sinSenal: boolean;
};

/**
 * Las capas, agrupadas por PREGUNTA y no por tipo de dato: el usuario piensa
 * "qué quiero saber", no "qué archivo prendo".
 */
const GRUPOS: Array<{ titulo: string; capas: Array<{ id: keyof Capas; label: string }> }> = [
  {
    titulo: "La operación",
    capas: [
      { id: "unidades", label: "Unidades en ruta" },
      { id: "huella", label: "Recorrido real" },
    ],
  },
  {
    titulo: "El territorio",
    capas: [
      { id: "kml", label: "Trazado contratado" },
      { id: "geocercas", label: "Geocercas de destino" },
    ],
  },
  {
    titulo: "Lo que requiere atención",
    capas: [{ id: "sinSenal", label: "Sin señal reciente" }],
  },
];

export function MonitoreoMapa({
  routes: entrada,
  quieto = false,
}: {
  routes: MonitoreoRoute[];
  /**
   * Mapa quieto (§5.1): territorio sí, unidades no. La última posición de un
   * turno que ya cerró dibujada como punto se lee como movimiento de ahora,
   * así que no se dibuja — y no se dibuja porque el dato no llega hasta acá,
   * no porque una casilla esté apagada.
   */
  quieto?: boolean;
}) {
  const routes = useMemo(
    () =>
      quieto
        ? entrada.map((r) => ({ ...r, currentPoint: null, huella: [] }))
        : entrada,
    [entrada, quieto],
  );

  const [capas, setCapas] = useState<Capas>({
    unidades: !quieto,
    huella: !quieto,
    kml: true,
    geocercas: true,
    sinSenal: !quieto,
  });
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [listo, setListo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const encuadradoRef = useRef(false);

  const visibles = useMemo(
    () => routes.filter((r) => !ocultas.has(r.occurrenceId)),
    [routes, ocultas],
  );

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelado = false;
    void import("leaflet").then((L) => {
      if (cancelado || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        scrollWheelZoom: true,
        attributionControl: true,
      });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
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

  // Redibuja cuando cambian datos, capas o filtros.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!L || !map || !overlay) return;
    overlay.clearLayers();

    const acero = token("--acero", "#7a9cb8");
    const ambar = token("--ambar", "#e3a81f");
    const limites: [number, number][] = [];

    if (capas.geocercas) {
      const dibujadas = new Set<string>();
      for (const r of visibles) {
        if (r.geofencePolygon.length < 3) continue;
        const llave = r.geofencePolygon.map((p) => `${p.lat},${p.lng}`).join("|");
        if (dibujadas.has(llave)) continue;
        dibujadas.add(llave);
        const latlngs = r.geofencePolygon.map((p) => {
          limites.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polygon(latlngs, {
          color: acero,
          weight: 2,
          opacity: 0.9,
          fillColor: acero,
          fillOpacity: 0.12,
          dashArray: "6 4",
        })
          .bindTooltip(`Destino · ${r.geofenceName ?? r.profileCode}`, { sticky: true })
          .addTo(overlay);
      }
    }

    for (const r of visibles) {
      const color = colorFor(r);
      const cerrado = r.state === "cerrado";

      // Trazado contratado: guía punteada tenue, marca de agua del acuerdo.
      if (capas.kml && r.kmlWaypoints.length >= 2) {
        const latlngs = r.kmlWaypoints.map((p) => {
          limites.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(latlngs, { color, weight: 2, opacity: 0.3, dashArray: "4 8" })
          .bindTooltip(`Trazado contratado · ${r.profileCode}`, { sticky: true })
          .addTo(overlay);
      }

      // Recorrido real: ya viene cortado en la llegada a geocerca.
      if (capas.huella && r.huella.length >= 2) {
        L.polyline(
          r.huella.map((p) => L.latLng(p.lat, p.lng)),
          { color, weight: 4, opacity: cerrado ? 0.4 : 0.95 },
        )
          .bindTooltip(
            cerrado
              ? `Recorrido · ${r.profileCode} · servicio sellado`
              : `Recorrido · ${r.profileCode} · ${r.matchedUnitLabel ?? "—"}`,
            { sticky: true },
          )
          .addTo(overlay);
      }

      if (!capas.unidades || !r.currentPoint) continue;

      const sinSenal =
        r.signalAgeMinutes !== null && r.signalAgeMinutes >= SIN_SENAL_MINUTOS;
      const llego = r.state === "llego";

      // La unidad sin señal reciente: ámbar con anillo punteado. Es aviso del
      // sistema —el dato dejó de llegar—, no una falta del servicio.
      if (sinSenal && capas.sinSenal) {
        L.circleMarker([r.currentPoint.lat, r.currentPoint.lng], {
          radius: 13,
          color: ambar,
          weight: 1.5,
          opacity: 0.9,
          dashArray: "3 3",
          fill: false,
        }).addTo(overlay);
      }

      const marcaSinSenal = sinSenal && capas.sinSenal;
      L.circleMarker([r.currentPoint.lat, r.currentPoint.lng], {
        radius: llego ? 6 : 7,
        color: marcaSinSenal ? ambar : llego ? acero : color,
        weight: 3,
        fillColor: marcaSinSenal ? ambar : llego ? acero : color,
        fillOpacity: 0.9,
      })
        .bindTooltip(
          [
            r.matchedUnitLabel ? `${r.matchedUnitLabel} · probable` : "Unidad",
            r.profileCode,
            llego && r.arrivalAt ? `Llegó ${r.arrivalAt}` : null,
            r.signalAgeMinutes !== null ? `señal hace ${r.signalAgeMinutes} min` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          { sticky: true },
        )
        .addTo(overlay);
      limites.push([r.currentPoint.lat, r.currentPoint.lng]);
    }

    if (!encuadradoRef.current && limites.length > 0) {
      map.fitBounds(limites, { padding: [24, 24] });
      encuadradoRef.current = true;
    }
  }, [listo, visibles, capas]);

  const sinGeocerca = useMemo(
    () => visibles.filter((r) => r.geofencePolygon.length < 3).length,
    [visibles],
  );

  return (
    <div className="space-y-2">
      {/* Aviso del sistema — ámbar por sistema, no por resultado. */}
      {sinGeocerca > 0 ? (
        <p className="rounded-sm border border-[var(--b-ambar)] bg-[var(--t-ambar)] px-3 py-2 text-[12px] text-[var(--texto)]">
          {sinGeocerca === 1
            ? "1 ruta no tiene polígono de geocerca."
            : `${sinGeocerca} rutas no tienen polígono de geocerca.`}{" "}
          Sin destino dibujado el sistema no puede detectar la llegada: revísalo en
          Oficina → Perfiles y geocercas.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 min-[900px]:flex-row">
        <div
          ref={containerRef}
          className="mapa-torre h-[420px] w-full rounded-sm border border-[var(--linea)] min-[900px]:h-[520px]"
        />

        {/* Panel de capas · cada una con su audiencia declarada. */}
        <div className="flex-none rounded-sm border border-[var(--linea)] px-3 py-2.5 min-[900px]:w-[200px]">
          <p className="font-mono text-[10px] tracking-[0.13em] text-[var(--tenue)] uppercase">
            Capas
          </p>
          {(quieto ? GRUPOS.filter((g) => g.titulo === "El territorio") : GRUPOS).map((g) => (
            <div key={g.titulo} className="mt-2.5">
              <p className="text-[11px] text-[var(--tenue)]">{g.titulo}</p>
              {g.capas.map((c) => (
                <label
                  key={c.id}
                  className="mt-1 flex cursor-pointer items-center gap-2 text-[12px] text-[var(--texto)]"
                >
                  <input
                    type="checkbox"
                    checked={capas[c.id]}
                    onChange={(e) =>
                      setCapas((prev) => ({ ...prev, [c.id]: e.target.checked }))
                    }
                    className="cursor-pointer accent-[var(--acero)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="flex-none font-mono text-[9px] tracking-[0.1em] text-[var(--tenue)] uppercase">
                    Planta
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Filtro por ruta: no es una capa, es qué rutas quiero mirar. */}
      <div className="flex flex-wrap gap-1.5">
        {routes.map((r) => {
          const apagada = ocultas.has(r.occurrenceId);
          return (
            <button
              key={r.occurrenceId}
              type="button"
              aria-pressed={!apagada}
              onClick={() =>
                setOcultas((prev) => {
                  const next = new Set(prev);
                  if (next.has(r.occurrenceId)) next.delete(r.occurrenceId);
                  else next.add(r.occurrenceId);
                  return next;
                })
              }
              className={`flex cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--azul)] ${
                apagada
                  ? "border-[var(--linea)] text-[var(--tenue)]"
                  : "border-[var(--linea-fuerte)] text-[var(--texto)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-[1px]"
                style={{ backgroundColor: colorFor(r), opacity: apagada ? 0.3 : 1 }}
              />
              {r.profileCode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
