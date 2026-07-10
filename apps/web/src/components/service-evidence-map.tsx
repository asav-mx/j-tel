"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapPoint, MapPolygon, MapWaypoint } from "@/lib/service-detail-data";

export interface ServiceEvidenceMapProps {
  points: MapPoint[];
  geofence: MapPolygon;
  arrival: MapPoint | null;
  kmlWaypoints?: MapWaypoint[];
}

export function ServiceEvidenceMap({
  points,
  geofence,
  arrival,
  kmlWaypoints = [],
}: ServiceEvidenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Leaflet icon paths (Next.js bundler)
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
          fillOpacity: 0.12,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip("Geocerca destino", { sticky: true });
      }

      if (kmlWaypoints.length >= 2) {
        const kmlTrack = kmlWaypoints.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(kmlTrack, {
          color: "#a78bfa",
          weight: 3,
          opacity: 0.7,
          dashArray: "6 8",
        })
          .addTo(map)
          .bindTooltip("Ruta KML esperada", { sticky: true });
      }

      if (points.length > 0) {
        const track = points.map((p) => {
          bounds.push([p.lat, p.lng]);
          return L.latLng(p.lat, p.lng);
        });
        L.polyline(track, { color: "#22c55e", weight: 3, opacity: 0.9 }).addTo(map);
      }

      if (arrival) {
        bounds.push([arrival.lat, arrival.lng]);
        L.circleMarker([arrival.lat, arrival.lng], {
          radius: 8,
          color: "#eab308",
          fillColor: "#eab308",
          fillOpacity: 0.9,
          weight: 2,
        })
          .addTo(map)
          .bindTooltip("Llegada observada", { sticky: true });
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
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
  }, [points, geofence, arrival, kmlWaypoints]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full rounded-lg border border-white/10 [&_.leaflet-container]:rounded-lg [&_.leaflet-container]:bg-[#1a2332]"
    />
  );
}
