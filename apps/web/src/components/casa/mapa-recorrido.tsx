"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glifo, type EstadoGlifo } from "@/components/casa/glifo";
import { duracion, huecosQuietos, juntarEncimados, recorridoHasta, type HuecoQuieto, type Pedazo, type RecorridoJson } from "@/lib/casa/recorrido";

/**
 * El mapa de Recorridos y playback (C3).
 *
 * Todo lo que dibuja es medido y llega hecho del servidor: tramos ya cortados
 * por modalidad y simplificados, huecos con sus dos extremos, los lugares que
 * la unidad visitó. Aquí no se recalcula nada.
 *
 * - **Nada cruza un corte**, ni punteado: un pedazo termina, el siguiente
 *   empieza, y en medio sólo quedan sus dos marcas — círculos huecos para un
 *   hueco (nadie midió), rombos huecos para un salto del GPS (lo medido se
 *   contradice). Ningún punto se borra; lo que se niega es la línea.
 * - **Un hueco sin desplazamiento también se declara.** Sus dos círculos caen
 *   en el mismo lugar y la línea se ve continua; por eso lleva una pastilla con
 *   cuántos hubo ahí, en la capa de rótulos, que el marcador no tapa.
 * - **La cámara no persigue** (decisión 8): el recorrido se encuadra completo
 *   una vez por periodo, y después quien mira manda. Además de calma, es costo:
 *   un playback sin movimientos de cámara no pide un solo mosaico nuevo.
 * - **Lo declarado no se dibuja** (decisión 13): no hay trazado de contrato.
 *
 * El marcador es el mismo `Glifo` de las piezas, montado con un portal, igual
 * que en Flota en vivo.
 */

const JUAREZ: [number, number] = [31.69, -106.42];

/** Las marcas son HTML de Leaflet, no React: la misma forma que `Glifo`, escrita a mano. */
const ROMBO =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const CIRCULO =
  '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';

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
  saltos,
  cambios,
  lugares,
  progreso,
  marcador,
}: {
  /** Cambia con cada periodo leído: es lo que pide un encuadre nuevo. */
  clave: string;
  /** `sinUnidad`: lo que un dispositivo midió en bodega, punteado (Ver ‹dispositivo›). */
  pedazos: Array<Pedazo & { sinUnidad?: boolean }>;
  huecos: RecorridoJson["huecos"];
  /** Saltos del GPS: los dos puntos se marcan, la línea entre ellos no existe. */
  saltos: Array<{ lat: number; lng: number; latFin: number; lngFin: number }>;
  /** Dónde cambió de etapa un dispositivo: a una unidad (lleno) o a bodega (hueco). */
  cambios?: Array<{ lat: number; lng: number; aBodega: boolean }>;
  lugares: LugarDelRecorrido[];
  progreso: { seg: number; t: number };
  marcador: Marcador | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capa = useRef<import("leaflet").LayerGroup | null>(null);
  /** Las pastillas de huecos quietos: se vuelven a juntar con cada zoom. */
  const capaDePastillas = useRef<import("leaflet").LayerGroup | null>(null);
  const quietos = useRef<HuecoQuieto[]>([]);
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
      capaDePastillas.current = mod.layerGroup().addTo(m);
      // Lo que se encima depende del zoom: los mismos 10 m son una marca de lejos y dos de cerca.
      m.on("zoomend", () => dibujarPastillas());
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

  /**
   * Las pastillas de los huecos quietos, juntando sólo lo que se encima en la
   * pantalla con el zoom de ahora. Van en la capa de rótulos, encima de los
   * marcadores: el del playback no las tapa.
   */
  function dibujarPastillas() {
    const m = mapa.current;
    const mod = L.current;
    const p = capaDePastillas.current;
    if (!m || !mod || !p) return;
    p.clearLayers();
    for (const q of juntarEncimados(quietos.current, (lat, lng) => m.latLngToLayerPoint([lat, lng]))) {
      mod
        .tooltip({ permanent: true, direction: "top", offset: [0, -9], className: "rotulo-hueco", interactive: false })
        .setLatLng([q.lat, q.lng])
        .setContent(
          `${CIRCULO}<span>${q.n === 1 ? "1 hueco" : `${q.n} huecos`}</span><span class="sr-only"> · ${duracion(q.ms)} sin señal, sin moverse</span>`,
        )
        .addTo(p);
    }
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
    const forma = (p: { sinUnidad?: boolean }) => (p.sinUnidad ? " ruta-sin-unidad" : "");
    // El halo va debajo de todo: la línea se lee contra él, no contra la avenida
    // que tenga abajo (que en el mapa es casi del mismo tono que `--tenue`).
    for (const p of pedazos) {
      mod
        .polyline(p.puntos.map((q) => [q.lat, q.lng] as [number, number]), { className: `ruta-halo${forma(p)}`, interactive: false })
        .addTo(c);
    }
    for (const p of pedazos) {
      mod
        .polyline(p.puntos.map((q) => [q.lat, q.lng] as [number, number]), { className: `ruta-futura${forma(p)}`, interactive: false })
        .addTo(c);
    }
    hechas.current = pedazos.map((p) =>
      mod.polyline([], { className: `ruta-hecha${forma(p)}`, interactive: false }).addTo(c),
    );
    for (const k of cambios ?? []) {
      mod
        .marker([k.lat, k.lng], {
          icon: mod.divIcon({
            className: `marcador-cambio${k.aBodega ? " a-bodega" : ""}`,
            html: "<span></span>",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
          keyboard: false,
          interactive: false,
        })
        .addTo(c);
    }
    for (const h of huecos) {
      for (const [lat, lng] of [
        [h.lat, h.lng],
        [h.latFin, h.lngFin],
      ] as Array<[number, number]>) {
        mod.circleMarker([lat, lng], { radius: 6, className: "punto-hueco", interactive: false }).addTo(c);
      }
    }
    for (const x of saltos) {
      for (const [lat, lng] of [
        [x.lat, x.lng],
        [x.latFin, x.lngFin],
      ] as Array<[number, number]>) {
        mod
          .marker([lat, lng], {
            icon: mod.divIcon({ className: "marca-salto", html: ROMBO, iconSize: [16, 16], iconAnchor: [8, 8] }),
            keyboard: false,
            interactive: false,
          })
          .addTo(c);
      }
    }
    quietos.current = huecosQuietos(huecos);
    puntosDeEncuadre.current = [
      ...pedazos.flatMap((p) => p.puntos.map((q) => [q.lat, q.lng] as [number, number])),
      ...lugares.flatMap((l) => l.poligono.map((q) => [q.lat, q.lng] as [number, number])),
    ];
    encuadrarSiSePuede();
    dibujarPastillas();
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
