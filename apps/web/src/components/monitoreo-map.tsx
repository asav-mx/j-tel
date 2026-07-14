"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MonitoreoPayload,
  MonitoreoRoute,
  MonitoreoState,
} from "@/lib/monitoreo-data";

const COLORS = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#65a30d",
  "#0d9488",
  "#4f46e5",
  "#c026d3",
];

const STATE_LABEL: Record<MonitoreoState, string> = {
  programada: "Programada",
  en_ruta: "En ruta",
  avanzando: "Avanzando",
  llego: "Llegó",
  alerta: "Alerta",
  cerrado: "Cerrado",
};

const STATE_STYLE: Record<MonitoreoState, string> = {
  programada: "bg-white/10 text-white/70",
  en_ruta: "bg-sky-500/20 text-sky-200",
  avanzando: "bg-indigo-500/20 text-indigo-200",
  llego: "bg-emerald-500/20 text-emerald-200",
  alerta: "bg-red-500/25 text-red-200",
  // Servicio con veredicto emitido: apagado / neutro. Sin estado en vivo.
  cerrado: "bg-white/10 text-white/50",
};

const REFRESH_MS = 45_000;

function colorFor(r: MonitoreoRoute): string {
  return COLORS[r.colorIndex % COLORS.length]!;
}

export function MonitoreoLive({
  initial,
  query,
}: {
  initial: MonitoreoPayload;
  /** Query string para /api/monitoreo (account, fecha, turno, groupId|plantId). */
  query: string;
}) {
  const [data, setData] = useState<MonitoreoPayload>(initial);
  const [showKml, setShowKml] = useState(true);
  const [showHuella, setShowHuella] = useState(true);
  const [showGeocercas, setShowGeocercas] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now());
  const [paused, setPaused] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const didFitRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitoreo?${query}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as MonitoreoPayload;
      setData(json);
      setRefreshedAt(Date.now());
    } catch {
      // Silencioso: el siguiente ciclo reintenta.
    }
  }, [query]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh, paused]);

  const visibleRoutes = useMemo(
    () => data.routes.filter((r) => !hidden.has(r.occurrenceId)),
    [data.routes, hidden],
  );

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(containerRef.current, { scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);
      overlayRef.current = L.layerGroup().addTo(map);
      map.setView([31.69, -106.42], 12);
      setMapReady(true);
      setRefreshedAt(Date.now());
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        overlayRef.current = null;
        leafletRef.current = null;
      }
      setMapReady(false);
      didFitRef.current = false;
    };
  }, []);

  // Redibuja capas cuando cambian datos, toggles o filtros.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!L || !map || !overlay) return;
    overlay.clearLayers();
    const bounds: [number, number][] = [];

    if (showGeocercas) {
      const drawn = new Set<string>();
      for (const r of visibleRoutes) {
        if (r.geofencePolygon.length < 3) continue;
        const key = r.geofencePolygon.map((p) => `${p.lat},${p.lng}`).join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const latlngs = r.geofencePolygon.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polygon(latlngs, {
          color: "#38bdf8",
          weight: 1.5,
          opacity: 0.8,
          fillOpacity: 0.08,
        }).addTo(overlay);
      }
    }

    for (const r of visibleRoutes) {
      const color = colorFor(r);
      if (showKml && r.kmlWaypoints.length >= 2) {
        const latlngs = r.kmlWaypoints.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(latlngs, {
          color,
          weight: 2,
          opacity: 0.35,
          dashArray: "4 8",
        })
          .bindTooltip(`Esperado · ${r.profileCode}`, { sticky: true })
          .addTo(overlay);
      }
      if (showHuella && r.huella.length >= 2) {
        const latlngs = r.huella.map((p) => L.latLng(p.lat, p.lng));
        const isClosed = r.state === "cerrado";
        L.polyline(latlngs, {
          color,
          weight: 4,
          opacity: isClosed ? 0.45 : 0.95,
        })
          .bindTooltip(
            isClosed
              ? `Huella · ${r.profileCode} · servicio cerrado`
              : `Huella · ${r.profileCode} · ${r.matchedUnitLabel ?? "—"} · ${r.coveragePct}%`,
            { sticky: true },
          )
          .addTo(overlay);
      }
      if (r.currentPoint) {
        const isAlert = r.state === "alerta";
        const isArrival = r.state === "llego";
        L.circleMarker([r.currentPoint.lat, r.currentPoint.lng], {
          radius: isArrival ? 6 : 7,
          color: isAlert ? "#ef4444" : isArrival ? "#fbbf24" : color,
          weight: 3,
          fillColor: isArrival ? "#fbbf24" : color,
          fillOpacity: 0.9,
        })
          .bindTooltip(
            isArrival
              ? `Llegada · ${r.profileCode} · ${r.matchedUnitLabel ?? "—"} (servicio terminado)`
              : `${r.matchedUnitLabel ?? "Unidad"} · ${STATE_LABEL[r.state]} · ${r.profileCode}`,
            { sticky: true },
          )
          .addTo(overlay);
        bounds.push([r.currentPoint.lat, r.currentPoint.lng]);
      }
    }

    if (!didFitRef.current && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [24, 24] });
      didFitRef.current = true;
    }
  }, [mapReady, visibleRoutes, showKml, showHuella, showGeocercas]);

  const secondsAgo = Math.max(0, Math.round((Date.now() - refreshedAt) / 1000));

  function toggleRoute(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGeocercas}
            onChange={(e) => setShowGeocercas(e.target.checked)}
          />
          Geocercas
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showKml}
            onChange={(e) => setShowKml(e.target.checked)}
          />
          Rutas esperadas (KML)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showHuella}
            onChange={(e) => setShowHuella(e.target.checked)}
          />
          Huella (cubierto)
        </label>
        <span className="ml-auto flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>Actualizado hace {secondsAgo}s</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-white/15 px-2 py-1 hover:bg-white/10"
          >
            Actualizar
          </button>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={paused}
              onChange={(e) => setPaused(e.target.checked)}
            />
            Pausar auto
          </label>
        </span>
      </div>

      <div
        ref={containerRef}
        className="h-[520px] w-full rounded-lg border border-white/10"
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {data.routes.map((r) => {
          const off = hidden.has(r.occurrenceId);
          return (
            <button
              key={r.occurrenceId}
              type="button"
              onClick={() => toggleRoute(r.occurrenceId)}
              className={`flex items-center gap-2 rounded border px-2 py-1 ${
                off ? "border-white/10 opacity-40" : "border-white/20"
              }`}
              title={r.alertReason ?? undefined}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: colorFor(r) }}
              />
              <span>{r.profileCode}</span>
              <span className={`rounded px-1.5 py-0.5 ${STATE_STYLE[r.state]}`}>
                {STATE_LABEL[r.state]}
                {r.state === "avanzando" || r.state === "en_ruta"
                  ? ` ${r.coveragePct}%`
                  : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
