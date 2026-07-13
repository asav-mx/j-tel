"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type CandidateTrack = {
  unitId: string;
  label: string;
  color: string;
  points: Array<{ lat: number; lng: number; at?: string }>;
};

export function CarrierCandidateCompareMap({
  kmlWaypoints,
  geofence,
  tracks,
  focusUnitId,
}: {
  kmlWaypoints: Array<{ lat: number; lng: number }>;
  geofence: Array<{ lat: number; lng: number }>;
  tracks: CandidateTrack[];
  focusUnitId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

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

      const bounds: [number, number][] = [];

      if (geofence.length >= 3) {
        const latlngs = geofence.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polygon(latlngs, {
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip("Geocerca destino", { sticky: true });
      }

      if (kmlWaypoints.length >= 2) {
        const latlngs = kmlWaypoints.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(latlngs, {
          color: "#c4b5fd",
          weight: 4,
          opacity: 0.95,
          dashArray: "8 10",
        })
          .addTo(map)
          .bindTooltip("Ruta esperada (KML)", { sticky: true });
      }

      for (const track of tracks) {
        if (track.points.length < 2) continue;
        const focused = focusUnitId ? focusUnitId === track.unitId : true;
        const latlngs = track.points.map((p) => {
          if (focused || !focusUnitId) bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(latlngs, {
          color: track.color,
          weight: focused ? 4 : 2,
          opacity: focusUnitId ? (focused ? 0.95 : 0.25) : 0.75,
        })
          .addTo(map)
          .bindTooltip(`GPS · ${track.label}`, { sticky: true });
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
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
  }, [kmlWaypoints, geofence, tracks, focusUnitId]);

  return (
    <div
      ref={containerRef}
      className="h-96 w-full rounded-lg border border-white/10 [&_.leaflet-container]:rounded-lg [&_.leaflet-container]:bg-[#1a2332]"
    />
  );
}
