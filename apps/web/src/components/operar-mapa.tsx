"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dónde van las unidades del circuito, versión operador.
 *
 * Es el mismo mapa que ve el pasajero con una diferencia deliberada: **aquí sí
 * va el número económico**. Al pasajero se le manda un identificador opaco que
 * rota cada día —para que nadie arme el historial de un camión ni de su chofer
 * raspando el endpoint—; al dueño de la concesión no se le esconde cuál de sus
 * camiones es cuál, porque es suyo y porque sin eso no puede tomar el radio.
 *
 * Lo que NO cambia entre las dos caras es la honestidad del dibujo:
 *
 * - La unidad **callada se pinta apagada y con su «hace N min»**, no se borra.
 *   Un camión que perdió señal no se fue a ningún lado; borrarlo afirmaría que
 *   desapareció. Pero tampoco se pinta como si fuera de ahorita, que es lo que
 *   se leería como «va llegando».
 * - **Nada se interpola.** Los puntos son donde el GPS los reportó; entre dos
 *   posiciones no se dibuja el camino que suponemos que hizo.
 */

export interface TrazadoDibujable {
  sentido: "ida" | "vuelta";
  /** `[[lon, lat], ...]`, como lo guarda el circuito. */
  coordinates: Array<[number, number]>;
}

export interface UnidadDibujable {
  unitId: string;
  /** El número económico. Va visible: es como el operador la nombra. */
  unitLabel: string;
  lat: number;
  lon: number;
  /** El fix todavía dice dónde está. Lo resolvió el servidor con el umbral del circuito. */
  fresco: boolean;
  antiguedadSeg: number;
  /** `false` cuando su GPS la ve fuera del corredor: se dibuja igual, y se dice. */
  enCorredor: boolean;
}

export function OperarMapa({
  trazados,
  unidades,
  colorTrazado,
}: {
  trazados: TrazadoDibujable[];
  unidades: UnidadDibujable[];
  /** El color de identidad del circuito. Es columna suya, no una constante. */
  colorTrazado: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaTrazados = useRef<import("leaflet").LayerGroup | null>(null);
  const capaUnidades = useRef<import("leaflet").LayerGroup | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    let cancelado = false;
    void import("leaflet").then((mod) => {
      if (cancelado || !contenedor.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(contenedor.current, { zoomControl: false, scrollWheelZoom: false });
      // Mismo fondo que el editor: OSM directo. CARTO empezó a exigir llave y
      // devuelve un mosaico con "API KEY REQUIRED" impreso encima.
      mod
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        })
        .addTo(m);
      mod.control.zoom({ position: "bottomright" }).addTo(m);
      capaTrazados.current = mod.layerGroup().addTo(m);
      capaUnidades.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      setListo(true);
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  const puntosDelTrazado = useCallback(
    () =>
      trazados.flatMap((t) => t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])),
    [trazados],
  );

  /* El trazado, y el encuadre inicial sobre él. */
  useEffect(() => {
    const mod = L.current;
    const capa = capaTrazados.current;
    if (!mod || !capa || !listo) return;
    capa.clearLayers();
    for (const t of trazados) {
      mod
        .polyline(
          t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
          {
            color: colorTrazado,
            weight: 4,
            opacity: t.sentido === "ida" ? 0.95 : 0.55,
            dashArray: t.sentido === "vuelta" ? "9 7" : undefined,
          },
        )
        .bindTooltip(t.sentido)
        .addTo(capa);
    }
    const puntos = puntosDelTrazado();
    if (puntos.length && mapa.current) {
      mapa.current.fitBounds(mod.latLngBounds(puntos).pad(0.05));
    }
  }, [trazados, colorTrazado, listo, puntosDelTrazado]);

  /* Las unidades. */
  useEffect(() => {
    const mod = L.current;
    const capa = capaUnidades.current;
    if (!mod || !capa || !listo) return;
    capa.clearLayers();

    for (const u of unidades) {
      const min = Math.max(1, Math.round(u.antiguedadSeg / 60));
      /*
       * Tres señales para lo mismo cuando está callada —color apagado, tamaño
       * menor y el «hace N min» escrito—, porque una sola no la ve quien trae
       * el teléfono al sol o no distingue bien los tonos.
       *
       * El color sale de los tokens del tema: acero es lo medido, tenue es lo
       * que ya no dice dónde está. Ni verde ni rojo, que son de veredicto y
       * aquí no se sella nada.
       */
      const punto = u.fresco
        ? `<span style="width:13px;height:13px;border-radius:50%;background:var(--acero);` +
          `border:2px solid var(--panel);box-shadow:0 1px 6px rgba(0,0,0,.35);flex:none"></span>`
        : `<span style="width:10px;height:10px;border-radius:50%;background:var(--tenue);` +
          `border:2px solid var(--panel);opacity:.85;flex:none"></span>`;

      const rotulo =
        `<span style="font-family:var(--fuente-mono);font-size:10.5px;font-variant-numeric:tabular-nums;` +
        `padding:1px 5px;border-radius:3px;white-space:nowrap;border:1px solid ${
          u.fresco ? "var(--b-acero)" : "var(--linea-fuerte)"
        };background:var(--panel);color:${u.fresco ? "var(--acero)" : "var(--tenue)"}">` +
        `${escapar(u.unitLabel)}${u.fresco ? "" : ` · hace ${min} min`}</span>`;

      mod
        .marker([u.lat, u.lon], {
          icon: mod.divIcon({
            className: "",
            html: `<div style="display:flex;align-items:center;gap:4px">${punto}${rotulo}</div>`,
            iconSize: [0, 0],
            iconAnchor: [6, 6],
          }),
          // La fresca encima: si dos se enciman, la que dice dónde está gana.
          zIndexOffset: u.fresco ? 1000 : 0,
        })
        .bindTooltip(
          u.enCorredor
            ? `${u.unitLabel} · sobre el corredor`
            : `${u.unitLabel} · su GPS la ve fuera del corredor`,
        )
        .addTo(capa);
    }
  }, [unidades, listo]);

  const verTodo = useCallback(() => {
    const mod = L.current;
    if (!mod || !mapa.current) return;
    const puntos = [
      ...puntosDelTrazado(),
      ...unidades.map((u) => [u.lat, u.lon] as [number, number]),
    ];
    if (puntos.length) mapa.current.fitBounds(mod.latLngBounds(puntos).pad(0.08));
  }, [unidades, puntosDelTrazado]);

  const alTrazado = useCallback(() => {
    const mod = L.current;
    const puntos = puntosDelTrazado();
    if (!mod || !mapa.current || !puntos.length) return;
    mapa.current.fitBounds(mod.latLngBounds(puntos).pad(0.05));
  }, [puntosDelTrazado]);

  /*
   * El encuadre arranca sobre el trazado, así que una unidad que su GPS ve a
   * nueve kilómetros queda fuera del cuadro. No se esconde —su distancia va
   * escrita en la lista— pero hay que poder verla, y para eso está el botón.
   */
  const hayLejanas = unidades.some((u) => !u.enCorredor);

  return (
    <div className="relative">
      <div
        ref={contenedor}
        className="h-[54vh] min-h-[280px] w-full rounded-lg border border-[var(--linea)] bg-[var(--panel2)] sm:h-[420px]"
        role="img"
        aria-label={`Mapa del circuito con ${unidades.length} unidad${
          unidades.length === 1 ? "" : "es"
        } dibujada${unidades.length === 1 ? "" : "s"}`}
      />
      {hayLejanas ? (
        <div className="absolute top-2 right-2 z-[500] flex gap-1.5">
          <button
            type="button"
            onClick={alTrazado}
            className="rounded border border-[var(--linea-fuerte)] bg-[var(--panel)] px-2 py-1 font-[family-name:var(--fuente-mono)] text-[10.5px] tracking-[.08em] text-[var(--tenue)] uppercase hover:text-[var(--texto)]"
          >
            Al trazado
          </button>
          <button
            type="button"
            onClick={verTodo}
            className="rounded border border-[var(--linea-fuerte)] bg-[var(--panel)] px-2 py-1 font-[family-name:var(--fuente-mono)] text-[10.5px] tracking-[.08em] text-[var(--tenue)] uppercase hover:text-[var(--texto)]"
          >
            Ver todas
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** El número económico entra a `innerHTML` del icono; se escapa antes. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
