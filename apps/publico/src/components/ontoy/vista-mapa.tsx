"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import { fondoDelMapa } from "@/lib/ontoy/mapa-base";
import { haloParaLaTraza } from "@/lib/ontoy/contraste-de-ruta";
import { pistaDelMapa } from "@/lib/ontoy/pista-del-mapa";
import type { Forma, RutaDeLaCiudad, Sentido, Vivo } from "@/lib/ontoy/forma";

/**
 * **El Mapa de la ciudad** — tus rutas favoritas en vivo (8.8; Ontoy 2.0, PR 3b).
 *
 * Todas las rutas dibujadas (las líneas vienen con la portada: no cuestan una
 * petición); las favoritas —las rutas de tus paradas guardadas— resaltadas y
 * con sus camiones, que llegan todos juntos por una sola consulta
 * (`useEnVivo`); tus paradas guardadas marcadas. Tocar una ruta, un camión o
 * una parada guardada abre su hilo.
 */
export interface ModoCiudad {
  favoritas: string[];
  prendidas: Set<string>;
  vivos: Map<string, Vivo>;
  guardadas: Array<{ id: string; ruta: string; nombre: string; lat: number; lon: number }>;
  alAlternar: (ruta: string) => void;
  alAbrirRuta: (ruta: string, parada?: string) => void;
}

/** Los lienzos de las dos pieles, que es contra lo que se mide el halo (8.8c). */
const LIENZO = { dia: "#EFEBE3", noche: "#2B323B" } as const;

/**
 * **Mapa** — la segunda vista (8.8): los circuitos sobre la ciudad, y el que se
 * enfoca con sus paradas y sus unidades en vivo.
 *
 * ## Las unidades NO se animan
 *
 * El prototipo las deslizaba por el trazado con `requestAnimationFrame` y las
 * daba vuelta al llegar al final. Aquí no: **una unidad se mueve cuando llega un
 * fix, y no antes.** Un camión avanzando suave en la pantalla mientras su GPS
 * lleva tres minutos callado es la mentira más creíble que puede tener esta app
 * —se ve exactamente igual que la verdad— y es justo lo que la Pieza 1.E
 * prohíbe. Lo único que late es el anillo de «en vivo», que no la mueve de
 * lugar: dice que está viva, no que avanza.
 *
 * ## El fondo es un mapa real
 *
 * El prototipo dibujaba una retícula de calles inventadas. Una ruta trazada
 * sobre calles que no existen se lee como posicionada contra ellas. Aquí el
 * fondo es el de `fondoDelMapa()` — hoy OpenStreetMap — o no hay fondo; nunca
 * una ciudad de mentira.
 *
 * ## El color de la ruta no va solo
 *
 * Se mide contra el lienzo de la piel que esté puesta y el halo aparece cuando
 * no llega a 3:1 (8.8c). Y el nombre acompaña siempre: en las fichas de arriba,
 * en el rótulo del sentido y en la hoja.
 */
export function VistaMapa({
  rutas,
  enfocada,
  forma,
  vivo,
  error,
  deNoche,
  sentido,
  paradaAbierta,
  alEnfocar,
  alCambiarSentido,
  alTocarParada,
  alReintentar,
  alVerTodas,
  rutaAbierta = false,
  ciudad,
}: {
  rutas: RutaDeLaCiudad[];
  enfocada: string | null;
  forma: Forma | null;
  vivo: Vivo | null;
  error: boolean;
  deNoche: boolean;
  sentido: Sentido;
  paradaAbierta: string | null;
  alEnfocar: (circuitoId: string) => void;
  alCambiarSentido: (s: Sentido) => void;
  alTocarParada: (paradaId: string) => void;
  alReintentar: () => void;
  /** Abre la lista completa de rutas de la ciudad. */
  alVerTodas: () => void;
  /**
   * Con una ruta abierta, el sentido y la salida viven en su cabeza teñida; el
   * mapa no los repite (dos selectores del mismo sentido se contradicen).
   */
  rutaAbierta?: boolean;
  /** Con esto, el mapa es el de la ciudad y no el de una ruta. */
  ciudad?: ModoCiudad;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaRutas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaUnidades = useRef<import("leaflet").LayerGroup | null>(null);
  const [listo, setListo] = useState(false);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;
  const lienzo = deNoche ? LIENZO.noche : LIENZO.dia;

  // ── El mapa, una vez ───────────────────────────────────────────────────
  useEffect(() => {
    let montado = true;
    void (async () => {
      const leaflet = await import("leaflet");
      if (!montado || !contenedor.current || mapa.current) return;
      L.current = leaflet;
      const m = leaflet.map(contenedor.current, { zoomControl: false, attributionControl: true });
      // El crédito arriba a la derecha, bajo el selector de sentido: abajo se enciman la pista
      // y las fichas de ruta, que crecen con el contenido (ver `ontoy.css`).
      m.attributionControl.setPosition("topright");
      const fondo = fondoDelMapa();
      leaflet
        .tileLayer(fondo.url, { maxZoom: fondo.zoomMaximo, attribution: fondo.atribucion })
        .addTo(m);
      capaRutas.current = leaflet.layerGroup().addTo(m);
      capaParadas.current = leaflet.layerGroup().addTo(m);
      capaUnidades.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
      /*
       * Leaflet mide su caja al crearse, y en un `flex: 1` esa medida todavía
       * no está resuelta en el primer cuadro: se queda con alto cero, y sus
       * controles de abajo —la atribución de OpenStreetMap, que es obligatoria—
       * aterrizan a media pantalla porque `bottom: 0` de una caja de alto cero
       * es arriba. Se volvió a medir en el siguiente cuadro, que es cuando el
       * navegador ya repartió el alto.
       */
      requestAnimationFrame(() => m.invalidateSize());
      setListo(true);
    })();
    return () => {
      montado = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // ── Los trazados de todas, y el encuadre de la enfocada ────────────────
  useEffect(() => {
    const leaflet = L.current;
    const m = mapa.current;
    if (!listo || !leaflet || !m || !capaRutas.current || ciudad) return;
    capaRutas.current.clearLayers();
    const puntos: Array<[number, number]> = [];

    for (const r of rutas) {
      const es = r.circuito_id === enfocada;
      const halo = haloParaLaTraza(r.color_hex, lienzo);
      for (const t of r.trazados) {
        /*
         * **De la ruta enfocada se dibuja UN sentido: el que está elegido.**
         *
         * Los dos sentidos comparten geometría cuando la ruta va y vuelve por
         * la misma calle, y entonces el segundo se pinta encima del primero: la
         * primera captura mostró la traza de ida completamente tapada por la
         * punteada de vuelta, o sea el mapa enseñando el sentido que el
         * conmutador decía que NO estaba viendo. Un dibujo que contradice a su
         * propio control es peor que no tener control.
         *
         * Las rutas que no están enfocadas sí dibujan su ida a secas: son
         * contexto de la ciudad, no la ruta que alguien está leyendo.
         */
        if (es && t.sentido !== sentido) continue;
        if (!es && t.sentido !== "ida") continue;
        const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
        /*
         * El halo va DEBAJO y del color del lienzo: separa la traza del fondo
         * sin tocar el color de la ruta, que viene de la calle. Sólo cuando
         * `haloParaLaTraza` dice que hace falta.
         */
        if (es && halo > 0) {
          leaflet
            .polyline(latlngs, { color: lienzo, weight: 6 + halo, opacity: 0.9, interactive: false })
            .addTo(capaRutas.current);
        }
        leaflet
          .polyline(latlngs, {
            color: r.color_hex,
            weight: es ? 6 : 3,
            opacity: es ? 0.95 : 0.25,
            interactive: false,
          })
          .addTo(capaRutas.current);
        if (es) puntos.push(...latlngs);
      }
    }

    if (puntos.length > 1) m.fitBounds(leaflet.latLngBounds(puntos).pad(0.12));
  }, [listo, rutas, enfocada, lienzo, sentido, ciudad]);

  // ── Las paradas de la enfocada ─────────────────────────────────────────
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaParadas.current || !forma || ciudad) return;
    capaParadas.current.clearLayers();

    for (const p of forma.paradas) {
      if (p.sentido !== null && p.sentido !== sentido) continue;
      const abierta = p.id === paradaAbierta;
      leaflet
        .circleMarker([p.lat, p.lon], {
          radius: abierta ? 9 : 7,
          color: forma.color_hex,
          weight: abierta ? 4 : 2.5,
          fillColor: lienzo,
          fillOpacity: 1,
        })
        // El nombre acompaña al color siempre (8.8c): el marcador se anuncia con él.
        .bindTooltip(p.nombre, { direction: "top", opacity: 0.95 })
        .on("click", () => alTocarParada(p.id))
        .addTo(capaParadas.current);
    }
  }, [listo, forma, sentido, paradaAbierta, lienzo, alTocarParada]);

  // ── Las unidades: donde su último fix las dejó ─────────────────────────
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaUnidades.current || !forma || ciudad) return;
    capaUnidades.current.clearLayers();
    if (!vivo) return;

    for (const u of vivo.unidades) {
      if (u.sentido !== sentido) continue;
      /*
       * Una unidad con dato viejo NO se borra —el camión no se fue a ningún
       * lado— y tampoco se dibuja como si fuera de ahorita: se apaga y dice de
       * cuándo es (8.9). Borrarla mandaría al pasajero a creer que no hay
       * servicio; pintarla viva sería afirmar dónde está.
       */
      const vieja = !u.fresco;
      const icono = leaflet.divIcon({
        className: "ontoy-unidad-icono",
        html: `<span class="ontoy-unidad${vieja ? " vieja" : ""}" style="--ruta:${forma.color_hex}">
                 ${u.fresco ? '<span class="ontoy-anillo" aria-hidden="true"></span>' : ""}
                 <span class="ontoy-unidad-punto"></span>
                 <span class="ontoy-unidad-num">${u.economico}</span>
                 <span class="ontoy-unidad-edad">${haceNMinutos(u.antiguedad_seg)}</span>
               </span>`,
        iconSize: [0, 0],
      });
      leaflet.marker([u.lat, u.lon], { icon: icono, keyboard: false }).addTo(capaUnidades.current);
    }
  }, [listo, forma, vivo, sentido]);

  // ── El Mapa de la ciudad (PR 3b) ───────────────────────────────────────
  const prendidasClave = ciudad ? [...ciudad.prendidas].sort().join(",") : "";

  // Las líneas de todas; las favoritas prendidas, resaltadas y tocables.
  useEffect(() => {
    const leaflet = L.current;
    const m = mapa.current;
    if (!listo || !leaflet || !m || !capaRutas.current || !ciudad) return;
    capaRutas.current.clearLayers();
    const puntos: Array<[number, number]> = [];
    const todos: Array<[number, number]> = [];
    // Primero las de contexto y encima las prendidas: una línea tenue no tapa a una viva.
    const orden = [...rutas].sort((a, b) => Number(ciudad.prendidas.has(a.circuito_id)) - Number(ciudad.prendidas.has(b.circuito_id)));
    for (const r of orden) {
      const viva = ciudad.prendidas.has(r.circuito_id);
      const halo = haloParaLaTraza(r.color_hex, lienzo);
      for (const t of r.trazados) {
        if (t.sentido !== "ida") continue; // ida y vuelta suelen compartir calle; la ruta abierta enseña las dos
        const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
        todos.push(...latlngs);
        if (viva && halo > 0) {
          leaflet.polyline(latlngs, { color: lienzo, weight: 5 + halo, opacity: 0.9, interactive: false }).addTo(capaRutas.current);
        }
        const linea = leaflet.polyline(latlngs, {
          color: r.color_hex,
          weight: viva ? 5 : 3,
          opacity: viva ? 0.95 : 0.25,
          interactive: viva,
        });
        if (viva) {
          linea.bindTooltip(r.nombre, { sticky: true, opacity: 0.95 }).on("click", () => ciudad.alAbrirRuta(r.circuito_id));
          puntos.push(...latlngs);
        }
        linea.addTo(capaRutas.current);
      }
    }
    const encuadre = puntos.length > 1 ? puntos : todos;
    if (encuadre.length > 1) m.fitBounds(leaflet.latLngBounds(encuadre).pad(0.12));
    // Sin `ciudad` en la lista a propósito: cambia cada 15 s con los camiones, y re-encuadrar el mapa
    // cada sondeo le movería la vista a quien la está mirando. Encuadra cuando cambian las prendidas.
  }, [listo, rutas, lienzo, prendidasClave, !!ciudad]);

  // Tus paradas guardadas, con su estrella en el nombre.
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaParadas.current || !ciudad) return;
    capaParadas.current.clearLayers();
    for (const p of ciudad.guardadas) {
      const color = rutas.find((r) => r.circuito_id === p.ruta)?.color_hex ?? "#22282e";
      leaflet
        .circleMarker([p.lat, p.lon], { radius: 8, color, weight: 4, fillColor: lienzo, fillOpacity: 1 })
        .bindTooltip(`★ ${p.nombre}`, { direction: "top", opacity: 0.95 })
        .on("click", () => ciudad.alAbrirRuta(p.ruta, p.id))
        .addTo(capaParadas.current);
    }
  }, [listo, ciudad, rutas, lienzo]);

  // Los camiones de las favoritas prendidas, los dos sentidos, con su edad.
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaUnidades.current || !ciudad) return;
    capaUnidades.current.clearLayers();
    for (const ruta of ciudad.prendidas) {
      const v = ciudad.vivos.get(ruta);
      const color = rutas.find((r) => r.circuito_id === ruta)?.color_hex;
      if (!v || !color) continue;
      for (const u of v.unidades) {
        const vieja = !u.fresco;
        const icono = leaflet.divIcon({
          className: "ontoy-unidad-icono",
          html: `<span class="ontoy-unidad${vieja ? " vieja" : ""}" style="--ruta:${color}">
                   ${u.fresco ? '<span class="ontoy-anillo" aria-hidden="true"></span>' : ""}
                   <span class="ontoy-unidad-punto"></span>
                   <span class="ontoy-unidad-num">${u.economico}</span>
                   <span class="ontoy-unidad-edad">${haceNMinutos(u.antiguedad_seg)}</span>
                 </span>`,
          iconSize: [0, 0],
        });
        leaflet
          .marker([u.lat, u.lon], { icon: icono, keyboard: false })
          .on("click", () => ciudad.alAbrirRuta(ruta))
          .addTo(capaUnidades.current);
      }
    }
  }, [listo, ciudad, rutas]);

  const sentidos: Sentido[] = ["ida", "vuelta"];
  // Sólo se invita a tocar paradas que existen en el sentido elegido.
  const pista = pistaDelMapa(forma, enfocada, sentido);

  return (
    <div className="ontoy-mapa">
      <div ref={contenedor} className="ontoy-lienzo" style={{ background: lienzo }} />

      {/* El sentido, arriba: la misma ruta tiene dos, y mezclarlas es mezclar dos servicios. */}
      {forma && !rutaAbierta && !ciudad && (
        <div className="ontoy-sentido" role="group" aria-label="Sentido de la ruta">
          {sentidos.map((s) => (
            <button
              key={s}
              type="button"
              className="ontoy-sentido-btn"
              aria-pressed={sentido === s}
              onClick={() => alCambiarSentido(s)}
            >
              <span className="ontoy-flecha" style={{ color: forma.color_hex }} aria-hidden="true">
                {s === "ida" ? "→" : "←"}
              </span>{" "}
              {s === "ida" ? "Ida" : "Vuelta"}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="ontoy-aviso-red" role="status">
          <span>No pudimos preguntar ahorita. Lo que ves es lo último que supimos.</span>
          <button type="button" onClick={alReintentar}>
            Reintentar
          </button>
        </div>
      )}

      {ciudad && (
        <div className="ontoy-fichas">
          {ciudad.favoritas.length === 0 && (
            <p className="ontoy-pista">Guarda una parada y aquí verás su ruta en vivo.</p>
          )}
          <div className="ontoy-fichas-fila">
            <button type="button" className="ontoy-ficha ontoy-ficha-todas" onClick={alVerTodas}>
              Todas las rutas
            </button>
            {ciudad.favoritas.map((id) => {
              const r = rutas.find((x) => x.circuito_id === id);
              if (!r) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="ontoy-ficha"
                  style={{ ["--ruta" as string]: r.color_hex }}
                  aria-pressed={ciudad.prendidas.has(id)}
                  aria-label={`${r.nombre}: ${ciudad.prendidas.has(id) ? "en vivo en el mapa; tocar para ocultar" : "oculta; tocar para verla en vivo"}`}
                  onClick={() => ciudad.alAlternar(id)}
                >
                  <span className="ontoy-ficha-punto" aria-hidden="true" />
                  {r.nombre} ★
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!rutaAbierta && !ciudad && (
      <div className="ontoy-fichas">
        {pista && <p className="ontoy-pista">{pista}</p>}
        <div className="ontoy-fichas-fila">
          {/*
            La lista completa de la ciudad, a un toque (8.8). PRIMERA de la
            fila, no al final: la fila se desliza de lado, y al final quedaba
            fuera de la pantalla de un teléfono — lo enseñó la captura.
          */}
          <button type="button" className="ontoy-ficha ontoy-ficha-todas" onClick={alVerTodas}>
            Todas las rutas
          </button>
          {rutas.map((r) => (
            <button
              key={r.circuito_id}
              type="button"
              className="ontoy-ficha"
              style={{ ["--ruta" as string]: r.color_hex }}
              aria-pressed={r.circuito_id === enfocada}
              onClick={() => alEnfocar(r.circuito_id)}
            >
              <span className="ontoy-ficha-punto" aria-hidden="true" />
              {r.nombre}
            </button>
          ))}
        </div>
      </div>
      )}

      {!rutaEnfocada && rutas.length === 0 && (
        <p className="ontoy-mapa-vacio">Todavía no hay rutas publicadas en esta ciudad.</p>
      )}
    </div>
  );
}
