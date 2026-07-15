"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MonitoreoPayload,
  MonitoreoRoute,
  MonitoreoState,
} from "@/lib/monitoreo-data";

// Paleta de identidad de ruta: azules, cianes, púrpuras, magentas y grises —
// "luz de radar". Deliberadamente SIN verde / rojo / ámbar, para no invadir
// los colores del veredicto (cumplido / no cumplido / pendiente).
const COLORS = [
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#d946ef",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#2dd4bf",
  "#7dd3fc",
  "#94a3b8",
  "#5eead4",
  "#93c5fd",
];

// Colores en vivo destacados (radar), nunca los del veredicto.
const RADAR_ARRIVAL = "#22d3ee"; // cian — blip que alcanzó el destino
const RADAR_ALERT = "#e0f2fe"; // casi-blanco — resalta por brillo, no por rojo

const STATE_LABEL: Record<MonitoreoState, string> = {
  programada: "Programada",
  en_ruta: "En ruta",
  avanzando: "Avanzando",
  llego: "Llegó",
  alerta: "Alerta",
  cerrado: "Cerrado",
};

// Estados en vivo en paleta de radar (azules/grises), distinguidos por brillo,
// nunca por los colores del veredicto. "Alerta" resalta con un anillo, no rojo.
const STATE_STYLE: Record<MonitoreoState, string> = {
  programada: "bg-slate-500/15 text-slate-300",
  en_ruta: "bg-sky-500/20 text-sky-200",
  avanzando: "bg-blue-500/25 text-blue-100",
  llego: "bg-cyan-400/25 text-cyan-50",
  alerta: "bg-slate-200/15 text-white ring-1 ring-sky-300/70",
  // Servicio ya cerrado (con veredicto): apagado / neutro. Sin estado en vivo.
  cerrado: "bg-white/5 text-white/40",
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
        const poly = L.polygon(latlngs, {
          color: "#38bdf8",
          weight: 2.5,
          opacity: 0.95,
          fillColor: "#38bdf8",
          fillOpacity: 0.18,
          dashArray: "6 4",
        });
        const label = r.geofenceName
          ? `Geocerca · ${r.geofenceName}`
          : `Geocerca · ${r.profileCode}`;
        poly.bindTooltip(label, { sticky: true });
        poly.addTo(overlay);
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
          radius: isAlert ? 9 : isArrival ? 6 : 7,
          color: isAlert ? RADAR_ALERT : isArrival ? RADAR_ARRIVAL : color,
          weight: isAlert ? 4 : 3,
          fillColor: isArrival ? RADAR_ARRIVAL : color,
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

  const missingGeofence = useMemo(
    () => visibleRoutes.filter((r) => r.geofencePolygon.length < 3).length,
    [visibleRoutes],
  );

  return (
    <div className="space-y-3">
      {/* Leyenda permanente: la torre pronostica, no dictamina. Parte del diseño,
          no un disclaimer chiquito. */}
      <div className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-400/5 px-4 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-300" />
        </span>
        <p className="text-sm font-medium text-sky-100">
          Vista en vivo. El veredicto se emite al cierre.
        </p>
      </div>

      {missingGeofence > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          {missingGeofence} ruta(s) sin polígono de geocerca. Sin destino dibujado el motor no
          puede marcar «llegó»: revisa Configuración → Perfiles / Geocercas.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGeocercas}
            onChange={(e) => setShowGeocercas(e.target.checked)}
          />
          Geocercas destino
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
          const isClosed = r.state === "cerrado";
          return (
            <div
              key={r.occurrenceId}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 ${
                off
                  ? "border-white/10 opacity-40"
                  : isClosed
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/20"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleRoute(r.occurrenceId)}
                className="flex items-center gap-2"
                title={r.alertReason ?? undefined}
              >
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: colorFor(r), opacity: isClosed ? 0.4 : 1 }}
                />
                <span className={isClosed ? "text-white/45" : undefined}>{r.profileCode}</span>
                <span className={`rounded px-1.5 py-0.5 ${STATE_STYLE[r.state]}`}>
                  {STATE_LABEL[r.state]}
                  {r.state === "avanzando" || r.state === "en_ruta"
                    ? ` ${r.coveragePct}%`
                    : ""}
                </span>
              </button>
              {isClosed ? (
                <a
                  href={`/cliente/servicio/${r.occurrenceId}?account=${encodeURIComponent(data.accountSlug)}`}
                  className="text-sky-300 hover:underline"
                >
                  expediente ↗
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
