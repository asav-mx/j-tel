"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import { fondoDelMapa } from "@/lib/ontoy/mapa-base";
import { haloParaLaTraza } from "@/lib/ontoy/contraste-de-ruta";
import { pistaDelMapa } from "@/lib/ontoy/pista-del-mapa";
import { useTinteDelMapa } from "@/lib/tinte-del-mapa";
import type { Forma, RutaDeLaCiudad, Sentido, Vivo } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";
import { TiraDeRutas } from "@/components/ontoy/tira-de-rutas";

/**
 * **El Mapa de la ciudad** — el pasajero decide qué rutas ve (8.8; ASAV, 22-sep).
 *
 * Abajo, **una tira de chips**: uno por ruta cercana, todas prendidas al abrir.
 * Tocar un chip prende o apaga esa ruta en el mapa, y «+N rutas más» abre el
 * panel de las lejanas. Arriba, el interruptor de **Paradas** —los puntitos de
 * las rutas prendidas— y, si el pasajero dio ubicación, la diana que centra el
 * mapa donde está.
 *
 * **Nada de esto pide nada al servidor.** Las líneas vienen con la portada y
 * las paradas con la lista pública de la ciudad; prender y apagar es mostrar y
 * ocultar lo que ya está en el teléfono. Tampoco se guarda: al volver a abrir
 * el Mapa, todas las de la tira están prendidas otra vez (8.7).
 *
 * Los camiones en vivo siguen siendo los de **tus favoritas y la ruta abierta**
 * —los que trae la consulta única—, no los de cualquier ruta que prendas: pedir
 * los de todas costaría una consulta por ruta cada quince segundos. Lo vivo
 * aparece al abrir la ruta, que es cuando importa.
 *
 * > ✎ **Aquí ya no está la ficha «Todas las rutas»** (ASAV, 22-sep). A la lista
 * > completa se llegaba por dos caminos —esta ficha y el lugar «Ir a»—, y dos
 * > caminos a la misma pantalla obligan al pasajero a preguntarse si son la
 * > misma. Queda uno: el de **Ir a**. El Mapa vuelve a ser sólo el mapa.
 */
export interface ModoCiudad {
  /** Las de los chips, en orden; se dibujan las que estén prendidas. */
  tira: RutaOrdenada[];
  prendidas: Set<string>;
  /** Cuántas quedan fuera de la tira, para el chip de «+N rutas más». */
  cuantasMas: number;
  vivos: Map<string, Vivo>;
  guardadas: Array<{ id: string; ruta: string; nombre: string; lat: number; lon: number }>;
  /** Las paradas públicas de la ciudad; los puntitos salen de aquí. */
  paradas: ParadaDeLaCiudad[];
  /** El interruptor de los puntitos de parada. */
  verParadas: boolean;
  alAlternar: (ruta: string) => void;
  alAlternarParadas: () => void;
  alAbrirPanel: () => void;
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
  rutaAbierta = false,
  ciudad,
  yo = null,
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
  /**
   * Con una ruta abierta, el sentido y la salida viven en su cabeza teñida; el
   * mapa no los repite (dos selectores del mismo sentido se contradicen).
   */
  rutaAbierta?: boolean;
  /** Con esto, el mapa es el de la ciudad y no el de una ruta. */
  ciudad?: ModoCiudad;
  /**
   * Dónde está el pasajero, **sólo si ya dio permiso** (el mapa nunca pregunta).
   * Se dibuja como «tú»: en tinta y con su palabra, sin el color de ninguna ruta
   * — el pasajero no es una ruta (8.8c). Recupera el punto que la cara vieja
   * (`vista-pasajero.tsx`) dibujaba y que se perdió en #476 (decisión de ASAV,
   * 22-sep-2026).
   */
  yo?: { lat: number; lon: number } | null;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaRutas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaUnidades = useRef<import("leaflet").LayerGroup | null>(null);
  const capaYo = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadasCiudad = useRef<import("leaflet").LayerGroup | null>(null);
  /** El encuadre se hace una vez por apertura del Mapa, no en cada filtro. */
  const yaEncuadro = useRef(false);
  const [listo, setListo] = useState(false);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;
  const lienzo = deNoche ? LIENZO.noche : LIENZO.dia;
  /*
   * El teñido de las teselas (`lib/tinte-del-mapa.ts`). **Esta llamada faltaba**,
   * y por eso este mapa salía a todo color en las dos pieles: de noche, blanco
   * debajo de un cascarón oscuro, y de día con los amarillos y naranjas de OSM
   * a todo volumen — que es contra lo que se dibujan las rutas.
   *
   * El hook existía, documentado y probado, pero su único llamador era la
   * pantalla `/buscar`, que se retiró en el #514. Nació para el mapa del
   * buscador y nadie lo conectó al de Ontoy.
   */
  useTinteDelMapa(contenedor, deNoche, listo);

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
      capaParadasCiudad.current = leaflet.layerGroup().addTo(m);
      capaUnidades.current = leaflet.layerGroup().addTo(m);
      // Hasta arriba: «tú» no queda debajo de un camión ni de una parada.
      capaYo.current = leaflet.layerGroup().addTo(m);
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

  // ── «tú»: dónde está el pasajero, si ya dio permiso ─────────────────────
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaYo.current) return;
    capaYo.current.clearLayers();
    if (!yo) return;
    const icono = leaflet.divIcon({
      className: "ontoy-tu-icono",
      html: `<span class="ontoy-tu"><span class="ontoy-tu-punto"></span><span class="ontoy-tu-palabra">tú</span></span>`,
      iconSize: [0, 0],
    });
    // No mueve el mapa: el pasajero decide qué mira; «tú» sólo aparece donde está.
    leaflet.marker([yo.lat, yo.lon], { icon: icono, keyboard: false, interactive: false }).addTo(capaYo.current);
  }, [listo, yo]);

  // ── El Mapa de la ciudad (PR 3b) ───────────────────────────────────────
  const prendidasClave = ciudad ? [...ciudad.prendidas].sort().join(",") : "";

  /**
   * Las rutas prendidas, y **sólo** ésas.
   *
   * Antes se dibujaban todas —las favoritas fuertes y el resto al 25% como
   * contexto—, y ese apagado escondía el mapa entero de quien no tenía
   * favoritas. Con la tira de chips el pasajero decide qué ve, así que ya no
   * hay dos clases de línea: **prendida se dibuja, apagada no se dibuja.** Un
   * estado que se ve en el chip no necesita además un tono a medias que lo
   * insinúe en el mapa.
   */
  useEffect(() => {
    const leaflet = L.current;
    const m = mapa.current;
    if (!listo || !leaflet || !m || !capaRutas.current || !ciudad) return;
    capaRutas.current.clearLayers();
    const puntos: Array<[number, number]> = [];
    for (const r of rutas) {
      if (!ciudad.prendidas.has(r.circuito_id)) continue;
      const halo = haloParaLaTraza(r.color_hex, lienzo);
      for (const t of r.trazados) {
        if (t.sentido !== "ida") continue; // ida y vuelta suelen compartir calle; la ruta abierta enseña las dos
        const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
        if (halo > 0) {
          leaflet.polyline(latlngs, { color: lienzo, weight: 7, opacity: 0.9, interactive: false }).addTo(capaRutas.current);
        }
        leaflet
          .polyline(latlngs, { color: r.color_hex, weight: 5, opacity: 0.95 })
          .bindTooltip(r.nombre, { sticky: true, opacity: 0.95 })
          .on("click", () => ciudad.alAbrirRuta(r.circuito_id))
          .addTo(capaRutas.current);
        puntos.push(...latlngs);
      }
    }
    /*
     * Encuadra UNA vez, al abrir el Mapa. Re-encuadrar en cada chip le movería
     * la vista al pasajero justo mientras filtra, que es cuando más está
     * mirando — la misma razón por la que «tú» no mueve el mapa.
     */
    if (!yaEncuadro.current && puntos.length > 1) {
      m.fitBounds(leaflet.latLngBounds(puntos).pad(0.12));
      yaEncuadro.current = true;
    }
    // Sin `ciudad` en la lista a propósito: cambia cada 15 s con los camiones.
  }, [listo, rutas, lienzo, prendidasClave, !!ciudad]);

  /**
   * Los puntitos de parada de las rutas prendidas, tras su interruptor.
   *
   * Salen de la lista pública que la app ya bajó (`paradas-de-la-ciudad`): **no
   * cuestan una petición** y no llevan nada del pasajero. Sin el interruptor,
   * el mapa con varias rutas se llena de puntos y deja de leerse.
   */
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaParadasCiudad.current || !ciudad) return;
    capaParadasCiudad.current.clearLayers();
    if (!ciudad.verParadas) return;
    const color = new Map(rutas.map((r) => [r.circuito_id, r.color_hex]));
    for (const p of ciudad.paradas) {
      if (!ciudad.prendidas.has(p.ruta)) continue;
      leaflet
        .circleMarker([p.lat, p.lon], {
          radius: 4.5,
          color: lienzo,
          weight: 2,
          fillColor: color.get(p.ruta) ?? lienzo,
          fillOpacity: 1,
        })
        .bindTooltip(p.nombre, { direction: "top", opacity: 0.95 })
        .on("click", () => ciudad.alAbrirRuta(p.ruta, p.id))
        .addTo(capaParadasCiudad.current);
    }
  }, [listo, rutas, lienzo, prendidasClave, ciudad?.verParadas, ciudad?.paradas, !!ciudad]);

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

  // Los camiones de tus favoritas, los dos sentidos, con su edad.
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
        <>
          <div className="ontoy-ctrl-mapa">
            <button
              type="button"
              className={`ontoy-ctrl${ciudad.verParadas ? " prendido" : ""}`}
              aria-pressed={ciudad.verParadas}
              onClick={ciudad.alAlternarParadas}
            >
              {/* El estado no lo carga solo el color: va el punto lleno/hueco y el aria-pressed. */}
              <span className="ontoy-ctrl-punto" aria-hidden="true" />
              Paradas
            </button>
            {yo && (
              <button
                type="button"
                className="ontoy-ctrl ontoy-ctrl-diana"
                aria-label="Centrar el mapa donde estás"
                onClick={() => {
                  const m = mapa.current;
                  if (m) m.setView([yo.lat, yo.lon], Math.max(m.getZoom(), 15));
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
                </svg>
              </button>
            )}
          </div>

          <TiraDeRutas
            tira={ciudad.tira}
            prendidas={ciudad.prendidas}
            cuantasMas={ciudad.cuantasMas}
            alAlternar={ciudad.alAlternar}
            alAbrirPanel={ciudad.alAbrirPanel}
          />
        </>
      )}

      {!rutaAbierta && !ciudad && (
      <div className="ontoy-fichas">
        {pista && <p className="ontoy-pista">{pista}</p>}
        <div className="ontoy-fichas-fila">
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
