"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Glifo } from "@/components/casa/glifo";
import type { LugarEnVivo, UnidadEnVivo } from "@/lib/casa/flota";

/**
 * El mapa de Flota en vivo.
 *
 * **Cada marcador es el mismo `Glifo` de la lista**, montado con un portal en
 * el elemento que Leaflet crea. Una segunda versión de las formas en SVG suelto
 * terminaría dibujando en el mapa un estado distinto del de la pieza.
 *
 * Lo que el mapa no hace, a propósito:
 *
 * - **No interpola.** Cada lectura mueve el marcador al punto medido; entre dos
 *   lecturas no se dibuja el camino que suponemos.
 * - **No mira adentro de un destino.** Una unidad EN DESTINO se queda en su
 *   punto de llegada (lo resuelve el servidor).
 * - **No dibuja traza.** Esto es «ahora»; el recorrido vive en Ver ‹unidad› (C3).
 *
 * **Mosaicos: OpenStreetMap directo**, como el mapa de circuitos. La decisión
 * del 16 de septiembre era CARTO, pero CARTO ya imprime «API KEY REQUIRED»
 * sobre sus mosaicos (comprobado ese día sobre Juárez). El tinte de cada piel
 * vive en `casa.css`, sobre la capa de mosaicos y nunca sobre los marcadores.
 */

const JUAREZ: [number, number] = [31.69, -106.42];

export function MapaFlota({
  unidades,
  lugares,
  seleccion,
  alSeleccionar,
}: {
  unidades: UnidadEnVivo[];
  lugares: LugarEnVivo[];
  seleccion: string | null;
  alSeleccionar: (id: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaLugares = useRef<import("leaflet").LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, import("leaflet").Marker>());
  const encuadrado = useRef(false);
  /** Lo que hay que encuadrar la primera vez; se guarda hasta que el mapa tenga tamaño. */
  const puntosDeEncuadre = useRef<Array<[number, number]>>([]);
  const [listo, setListo] = useState(false);
  /** Los elementos donde se monta cada glifo, por unidad. */
  const [anclas, setAnclas] = useState<Map<string, HTMLElement>>(new Map());
  const alSeleccionarRef = useRef(alSeleccionar);
  alSeleccionarRef.current = alSeleccionar;

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
      capaLugares.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      setListo(true);
    });
    // En celular el mapa nace escondido detrás de «Lista»: al mostrarse hay que
    // decirle a Leaflet su tamaño real, o pinta mosaicos a medias. Y el primer
    // encuadre espera a ese momento: calculado con tamaño cero, Leaflet se va
    // al mapa del mundo entero (visto en las capturas de C2).
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
      marcadores.current.clear();
    };
  }, []);

  function encuadrarSiSePuede() {
    const m = mapa.current;
    const mod = L.current;
    const nodo = contenedor.current;
    if (!m || !mod || !nodo || encuadrado.current) return;
    if (nodo.clientWidth === 0 || nodo.clientHeight === 0) return;
    if (puntosDeEncuadre.current.length === 0) return;
    m.invalidateSize();
    m.fitBounds(mod.latLngBounds(puntosDeEncuadre.current).pad(0.15), { maxZoom: 15 });
    encuadrado.current = true;
  }

  /* Los lugares: los destinos punteados, el resto con línea fina. */
  useEffect(() => {
    const mod = L.current;
    const capa = capaLugares.current;
    if (!mod || !capa || !listo) return;
    capa.clearLayers();
    for (const l of lugares) {
      if (l.poligono.length < 3) continue;
      mod
        .polygon(
          l.poligono.map((p) => [p.lat, p.lng] as [number, number]),
          { className: l.rol === "destino" ? "lugar-flota lugar-destino" : "lugar-flota", interactive: false },
        )
        // El rótulo va arriba del polígono, no en su centro: adentro es justo
        // donde están las unidades que llegaron, y se enciman.
        .bindTooltip(l.rol === "destino" ? `${l.nombre} · destino` : l.nombre, {
          permanent: true,
          direction: "top",
          offset: [0, -6],
          className: "rotulo-lugar",
        })
        .addTo(capa);
    }
  }, [lugares, listo]);

  /* Las unidades: se agregan, se mueven al punto medido y se quitan. */
  useEffect(() => {
    const mod = L.current;
    const m = mapa.current;
    if (!mod || !m || !listo) return;
    const conPosicion = unidades.filter((u) => u.posicion);
    const vigentes = new Set(conPosicion.map((u) => u.id));
    let cambiaron = false;

    for (const [id, marcador] of marcadores.current) {
      if (!vigentes.has(id)) {
        marcador.remove();
        marcadores.current.delete(id);
        cambiaron = true;
      }
    }
    for (const u of conPosicion) {
      const punto: [number, number] = [u.posicion!.lat, u.posicion!.lng];
      const existente = marcadores.current.get(u.id);
      if (existente) {
        existente.setLatLng(punto);
        continue;
      }
      const marcador = mod
        .marker(punto, {
          icon: mod.divIcon({ className: "marcador-flota", html: "", iconSize: [48, 48], iconAnchor: [24, 16] }),
          keyboard: false,
          title: u.nombre,
        })
        .on("click", () => alSeleccionarRef.current(u.id))
        .addTo(m);
      marcadores.current.set(u.id, marcador);
      cambiaron = true;
    }
    if (cambiaron) {
      const nuevas = new Map<string, HTMLElement>();
      for (const [id, marcador] of marcadores.current) {
        const el = marcador.getElement();
        if (el) nuevas.set(id, el);
      }
      setAnclas(nuevas);
    }

    // El primer encuadre, sobre lo que hay: unidades y lugares. Después, quien
    // mira manda en el mapa; una lectura nueva no le mueve la cámara.
    if (!encuadrado.current) {
      puntosDeEncuadre.current = [
        ...conPosicion.map((u) => [u.posicion!.lat, u.posicion!.lng] as [number, number]),
        ...lugares.flatMap((l) => l.poligono.map((p) => [p.lat, p.lng] as [number, number])),
      ];
      encuadrarSiSePuede();
    }
  }, [unidades, lugares, listo]);

  /* La unidad señalada, a la vista. */
  useEffect(() => {
    const m = mapa.current;
    const u = unidades.find((x) => x.id === seleccion);
    if (!m || !u?.posicion) return;
    const punto: [number, number] = [u.posicion.lat, u.posicion.lng];
    if (!m.getBounds().pad(-0.1).contains(punto)) m.panTo(punto);
    // Sólo cuando cambia la selección: seguir a la unidad en cada lectura le
    // quitaría el mapa a quien lo está moviendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion]);

  return (
    <>
      <div ref={contenedor} className="mapa-flota h-full w-full" role="region" aria-label="Mapa de la flota" />
      {unidades.map((u) => {
        const ancla = anclas.get(u.id);
        if (!ancla) return null;
        return createPortal(
          // Apagada: el nombre va en tenue y el glifo ya lleva su forma apagada;
          // nada baja su opacidad. Al 60 % se mezclaban con el mapa de abajo
          // (skill, ley 2 del color: se apaga hasta el mínimo legible).
          <span className="flex flex-col items-center">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full bg-[var(--pieza)]${
                u.id === seleccion ? " ring-2 ring-[var(--tinta)]" : ""
              }`}
            >
              <Glifo estado={u.glifo} rumbo={u.rumbo ?? 0} tamano={22} />
            </span>
            <span
              data-medida
              className={`mt-0.5 rounded bg-[var(--pieza)] px-1 text-[11.5px] leading-[16px] ${u.apagada ? "text-[var(--tenue)]" : "text-[var(--tinta)]"}`}
            >
              {u.nombre}
            </span>
          </span>,
          ancla,
          u.id,
        );
      })}
    </>
  );
}
