"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JornadaRoute } from "@/lib/jornada-data";

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

export function JornadaContrastMap({
  routes,
  unitFilter,
  statusFilter,
}: {
  routes: JornadaRoute[];
  unitFilter: string | null;
  statusFilter: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [showExpected, setShowExpected] = useState(true);
  const [showObserved, setShowObserved] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [observedOpacity, setObservedOpacity] = useState(0.55);

  const visible = useMemo(() => {
    return routes.filter((r) => {
      if (unitFilter && r.observedUnitId !== unitFilter) return false;
      if (statusFilter && (r.status ?? "sin_verificar") !== statusFilter) return false;
      return true;
    });
  }, [routes, unitFilter, statusFilter]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

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

      const expected = L.layerGroup();
      const observed = L.layerGroup();
      const geofences = L.layerGroup();
      const bounds: [number, number][] = [];
      const drawnGeo = new Set<string>();

      for (const r of visible) {
        const color = COLORS[r.colorIndex % COLORS.length]!;
        if (showGeofences && r.geofencePolygon.length >= 3) {
          const key = r.geofencePolygon.map((p) => `${p.lat},${p.lng}`).join("|");
          if (!drawnGeo.has(key)) {
            drawnGeo.add(key);
            const latlngs = r.geofencePolygon.map((p) => {
              bounds.push([p.lat, p.lng]);
              return L.latLng(p.lat, p.lng);
            });
            L.polygon(latlngs, {
              color: "#3b82f6",
              weight: 2.5,
              opacity: 0.95,
              fillColor: "#3b82f6",
              fillOpacity: 0.16,
              dashArray: "6 4",
            })
              .bindTooltip(
                r.geofenceName ? `Geocerca · ${r.geofenceName}` : `Geocerca · ${r.profileCode}`,
                { sticky: true },
              )
              .addTo(geofences);
          }
        }
        if (showExpected && r.kmlWaypoints.length >= 2) {
          const latlngs = r.kmlWaypoints.map((p) => {
            bounds.push([p.lat, p.lng]);
            return L.latLng(p.lat, p.lng);
          });
          L.polyline(latlngs, {
            color,
            weight: 3,
            opacity: 0.9,
            dashArray: "6 8",
          })
            .bindTooltip(`Esperado · ${r.profileCode}`, { sticky: true })
            .addTo(expected);
        }
        if (showObserved && r.gpsTrack.length >= 2) {
          const latlngs = r.gpsTrack.map((p) => {
            bounds.push([p.lat, p.lng]);
            return L.latLng(p.lat, p.lng);
          });
          L.polyline(latlngs, {
            color,
            weight: 2,
            opacity: observedOpacity,
          })
            .bindTooltip(
              `Observado · ${r.profileCode} · ${r.observedUnitLabel ?? "flota (sin unidad)"}`,
              { sticky: true },
            )
            .addTo(observed);
        }
      }

      if (showGeofences) geofences.addTo(map);
      if (showExpected) expected.addTo(map);
      if (showObserved) observed.addTo(map);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else {
        map.setView([31.69, -106.42], 12);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [visible, showExpected, showObserved, showGeofences, observedOpacity]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGeofences}
            onChange={(e) => setShowGeofences(e.target.checked)}
          />
          Geocercas destino
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showExpected}
            onChange={(e) => setShowExpected(e.target.checked)}
          />
          Esperado (KML)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showObserved}
            onChange={(e) => setShowObserved(e.target.checked)}
          />
          Observado (GPS)
        </label>
        <label className="flex items-center gap-2">
          Opacidad GPS
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={observedOpacity}
            onChange={(e) => setObservedOpacity(Number(e.target.value))}
          />
        </label>
      </div>
      <div ref={containerRef} className="h-[480px] w-full rounded-lg border border-white/10" />
    </div>
  );
}
