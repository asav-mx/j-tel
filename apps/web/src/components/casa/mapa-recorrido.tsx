"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glifo, type EstadoGlifo } from "@/components/casa/glifo";
import { recorridoHasta, type Pedazo } from "@/lib/casa/recorrido";

/**
 * El mapa de Recorridos y playback (C3).
 *
 * Todo lo que dibuja es medido y llega hecho del servidor: tramos ya cortados
 * por modalidad y simplificados, huecos con sus dos extremos, los lugares que
 * la unidad visitó. Aquí no se recalcula nada.
 *
 * - **Nada cruza un hueco**, ni punteado: un pedazo termina, el siguiente
 *   empieza, y en medio sólo quedan dos círculos huecos.
 * - **La cámara no persigue** (decisión 8): el recorrido se encuadra completo
 *   una vez por periodo, y después quien mira manda. Además de calma, es costo:
 *   un playback sin movimientos de cámara no pide un solo mosaico nuevo.
 * - **Lo declarado no se dibuja** (decisión 13): no hay trazado de contrato.
 *
 * El marcador es el mismo `Glifo` de las piezas, montado con un portal, igual
 * que en Flota en vivo.
 */

const JUAREZ: [number, number] = [31.69, -106.42];

export type LugarDelRecorrido = {
  id: string;
  nombre: string;
  rol: string;
  poligono: Array<{ lat: number; lng: number }>;
};

export type Marcador = {
  lat: number;
  lng: number;
  glifo: EstadoGlifo;
  rumbo: number;
  tinta: "tinta" | "senal";
};

export function MapaRecorrido({
  clave,
  pedazos,
  huecos,
  lugares,
  progreso,
  marcador,
}: {
  /** Cambia con cada periodo leído: es lo que pide un encuadre nuevo. */
  clave: string;
  pedazos: Pedazo[];
  huecos: Array<{ lat: number; lng: number; latFin: number; lngFin: number }>;
  lugares: LugarDelRecorrido[];
  progreso: { seg: number; t: number };
  marcador: Marcador | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capa = useRef<import("leaflet").LayerGroup | null>(null);
  const hechas = useRef<import("leaflet").Polyline[]>([]);
  const pin = useRef<import("leaflet").Marker | null>(null);
  const encuadreDe = useRef<string | null>(null);
  const puntosDeEncuadre = useRef<Array<[number, number]>>([]);
  const [listo, setListo] = useState(false);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    let cancelado = false;
    const nodo = contenedor.current;
    void import("leaflet").then((mod) => {
      if (cancelado || mapa.current) return;
      L.current = mod;
      const m = mod.map(nodo, { zoomControl: false, attributionControl: true }).setView(JUAREZ, 12);
      mod
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        })
        .addTo(m);
      mod.control.zoom({ position: "bottomright" }).addTo(m);
      capa.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      setListo(true);
    });
    const observador = new ResizeObserver(() => {
      mapa.current?.invalidateSize();
      encuadrarSiSePuede();
    });
    observador.observe(nodo);
    return () => {
      cancelado = true;
      observador.disconnect();
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function encuadrarSiSePuede() {
    const m = mapa.current;
    const mod = L.current;
    const nodo = contenedor.current;
    if (!m || !mod || !nodo || encuadreDe.current === clave) return;
    if (nodo.clientWidth === 0 || nodo.clientHeight === 0) return;
    if (puntosDeEncuadre.current.length === 0) return;
    m.invalidateSize();
    m.fitBounds(mod.latLngBounds(puntosDeEncuadre.current).pad(0.12), { maxZoom: 16 });
    encuadreDe.current = clave;
  }

  /* El periodo: lugares, línea futura, línea hecha vacía, extremos de huecos. */
  useEffect(() => {
    const mod = L.current;
    const c = capa.current;
    if (!mod || !c || !listo) return;
    c.clearLayers();
    for (const l of lugares) {
      if (l.poligono.length < 3) continue;
      mod
        .polygon(
          l.poligono.map((p) => [p.lat, p.lng] as [number, number]),
          { className: l.rol === "destino" ? "lugar-flota lugar-destino" : "lugar-flota", interactive: false },
        )
        .bindTooltip(l.nombre, { permanent: true, direction: "top", offset: [0, -6], className: "rotulo-lugar" })
        .addTo(c);
    }
    for (const p of pedazos) {
      mod
        .polyline(p.puntos.map((q) => [q.lat, q.lng] as [number, number]), { className: "ruta-futura", interactive: false })
        .addTo(c);
    }
    hechas.current = pedazos.map(() =>
      mod.polyline([], { className: "ruta-hecha", interactive: false }).addTo(c),
    );
    for (const h of huecos) {
      for (const [lat, lng] of [
        [h.lat, h.lng],
        [h.latFin, h.lngFin],
      ] as Array<[number, number]>) {
        mod.circleMarker([lat, lng], { radius: 6, className: "punto-hueco", interactive: false }).addTo(c);
      }
    }
    puntosDeEncuadre.current = [
      ...pedazos.flatMap((p) => p.puntos.map((q) => [q.lat, q.lng] as [number, number])),
      ...lugares.flatMap((l) => l.poligono.map((q) => [q.lat, q.lng] as [number, number])),
    ];
    encuadrarSiSePuede();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, listo]);

  /* El avance: lo recorrido se dibuja en tinta mientras corre el tiempo. */
  const segPintado = useRef<{ clave: string; seg: number } | null>(null);
  useEffect(() => {
    if (!listo) return;
    // Los pedazos completos o vacíos sólo cambian al cambiar de pedazo o de periodo;
    // en cada cuadro basta con redibujar el que está corriendo.
    const otro = segPintado.current?.clave !== clave || segPintado.current?.seg !== progreso.seg;
    pedazos.forEach((p, i) => {
      const linea = hechas.current[i];
      if (!linea) return;
      if (i === progreso.seg) linea.setLatLngs(recorridoHasta(p, progreso.t));
      else if (otro) linea.setLatLngs(i < progreso.seg ? p.puntos.map((q) => [q.lat, q.lng] as [number, number]) : []);
    });
    segPintado.current = { clave, seg: progreso.seg };
  }, [clave, pedazos, progreso.seg, progreso.t, listo]);

  /* El marcador: se mueve al instante del playback; la cámara se queda quieta. */
  useEffect(() => {
    const mod = L.current;
    const m = mapa.current;
    if (!mod || !m || !listo) return;
    if (!marcador) {
      pin.current?.remove();
      pin.current = null;
      setAncla(null);
      return;
    }
    if (!pin.current) {
      pin.current = mod
        .marker([marcador.lat, marcador.lng], {
          icon: mod.divIcon({ className: "marcador-recorrido", html: "", iconSize: [28, 28], iconAnchor: [14, 14] }),
          keyboard: false,
          interactive: false,
          zIndexOffset: 1000,
        })
        .addTo(m);
      setAncla(pin.current.getElement() ?? null);
    } else {
      pin.current.setLatLng([marcador.lat, marcador.lng]);
    }
  }, [marcador, listo]);

  return (
    <>
      <div ref={contenedor} className="mapa-flota h-full w-full" role="region" aria-label="Mapa del recorrido del periodo" />
      {ancla &&
        marcador &&
        createPortal(
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--pieza)]">
            <Glifo estado={marcador.glifo} rumbo={marcador.rumbo} tamano={22} tinta={marcador.tinta} />
          </span>,
          ancla,
        )}
    </>
  );
}
