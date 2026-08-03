"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { colorDeIdentidad } from "@/lib/colores-identidad";
import type { WorkbenchData } from "@/lib/workbench-data";

/**
 * El lienzo del Workbench — la zona dominante, y el instrumento de defensa.
 *
 * ── Por qué hay calles debajo ───────────────────────────────────────────────
 *
 * Decidido el 2026-08-02, y contra la inclinación de construirlo sin fondo
 * geográfico. El público final de este mapa **no es el árbitro: es una persona
 * discutiendo un pago.** Una desviación sin calles no se puede juzgar — "se
 * salió del corredor 400 metros" sin ver que se metió por una lateral porque la
 * avenida estaba cerrada no defiende a nadie, solo muestra una línea torcida.
 *
 * La objeción —que el fondo mete en pantalla cosas que el árbitro no mide— se
 * resuelve con jerarquía y no quitando el fondo: **el basemap va muy atenuado y
 * en gris; todo lo medido va encima y con contraste alto.** El filtro de
 * `.lienzo-workbench` lo hace cumplir en CSS, no en la buena voluntad de quien
 * elija el siguiente proveedor de mosaicos.
 *
 * **La condición, y es dura: el basemap no inventa nada.** Sin rótulos de
 * negocios, sin tráfico, sin capas de terceros que puedan contradecir lo
 * medido. Calles y nada más. Por eso NO se usan los mosaicos estándar de OSM
 * que usa el resto del producto —esos sí traen nombres de comercios— sino la
 * variante sin rótulos: lo único que aporta el fondo es geometría de calles.
 *
 * ── Las capas ───────────────────────────────────────────────────────────────
 *
 * Agrupadas por familia y con su audiencia: **todo esto es del transportista y
 * solo suyo.** Ninguna de estas capas existe del lado del cliente.
 */

/** Grosores. Lo medido va grueso; el acuerdo, delgado y punteado. */
const TRAZA_PESO = 3.5;
const TRAZA_PESO_FUERA_DE_VENTANA = 2;

function token(nombre: string, respaldo: string): string {
  if (typeof window === "undefined") return respaldo;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return v.length > 0 ? v : respaldo;
}

type Capas = {
  real: boolean;
  contratado: boolean;
  paradas: boolean;
  huecos: boolean;
  geocercas: boolean;
  ventana: boolean;
};

/**
 * Cuántos trazados o geocercas se pueden encimar antes de que el lienzo deje
 * de leerse.
 *
 * Un día de esta operación son 48 servicios sobre decenas de rutas. Dibujarlas
 * todas de entrada no es un mapa, es una maraña — y el remedio no es dibujar
 * mejor sino **arrancar mostrando solo lo que se preguntó**. La capa sigue ahí,
 * apagada y con su cuenta al lado, para que nadie tenga que adivinar que existe.
 */
const MAX_ENCIMADAS = 3;

/*
 * Aquí NO se formatea una sola hora. Las etiquetas de paradas y huecos llegan
 * armadas desde el servidor, con fecha completa y en el reloj de la operación:
 * un `toISOString()` en el navegador escribiría UTC, y un turno nocturno leído
 * en UTC cambia de día. En una pantalla de defensa eso no es un desfase
 * cosmético.
 */

export function WorkbenchLienzo({ data }: { data: WorkbenchData }) {
  const hayVentana = data.unidades.some((u) => u.tramosVentana !== null);

  const grupos: Array<{ titulo: string; capas: Array<{ id: keyof Capas; label: string }> }> = [
    {
      titulo: "Recorrido",
      capas: [
        { id: "real", label: "Recorrido real" },
        {
          id: "contratado",
          label:
            data.contratado.length > 1
              ? `Trazado contratado · ${data.contratado.length}`
              : "Trazado contratado",
        },
        { id: "paradas", label: "Paradas" },
      ],
    },
    {
      titulo: "Evidencia",
      capas: [
        { id: "huecos", label: "Huecos de señal" },
        {
          id: "geocercas",
          label:
            data.geocercas.length > 1
              ? `Geocercas · ${data.geocercas.length}`
              : "Geocercas de destino",
        },
        { id: "ventana", label: "Ventana verificada" },
      ],
    },
  ];

  const [capas, setCapas] = useState<Capas>({
    real: true,
    contratado: data.contratado.length <= MAX_ENCIMADAS,
    paradas: true,
    huecos: true,
    geocercas: data.geocercas.length <= MAX_ENCIMADAS,
    ventana: hayVentana,
  });
  const [listo, setListo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const overlayRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const encuadradoRef = useRef(false);

  const firma = useMemo(
    () => data.unidades.map((u) => `${u.unitId}:${u.puntosDibujados}`).join("|"),
    [data.unidades],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelado = false;
    void import("leaflet").then((L) => {
      if (cancelado || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { scrollWheelZoom: true });
      mapRef.current = map;
      // Sin rótulos: el fondo aporta geometría de calles y nada más. Ver el
      // encabezado de este archivo — es una condición del producto, no una
      // preferencia estética.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);
      overlayRef.current = L.layerGroup().addTo(map);
      map.setView([31.69, -106.42], 12);
      setListo(true);
    });
    return () => {
      cancelado = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        overlayRef.current = null;
        leafletRef.current = null;
      }
      setListo(false);
      encuadradoRef.current = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!L || !map || !overlay) return;
    overlay.clearLayers();

    const acero = token("--acero", "#7a9cb8");
    const ambar = token("--ambar", "#e3a81f");
    const limites: [number, number][] = [];

    // El territorio primero, para que quede debajo de lo medido.
    if (capas.geocercas) {
      for (const g of data.geocercas) {
        if (g.poligono.length < 3) continue;
        L.polygon(
          g.poligono.map((p) => L.latLng(p.lat, p.lng)),
          {
            color: acero,
            weight: 1.5,
            opacity: 0.85,
            fillColor: acero,
            fillOpacity: 0.08,
            dashArray: "6 4",
          },
        )
          .bindTooltip(`Destino · ${g.nombre}`, { sticky: true })
          .addTo(overlay);
        for (const p of g.poligono) limites.push([p.lat, p.lng]);
      }
    }

    if (capas.contratado) {
      for (const c of data.contratado) {
        L.polyline(
          c.puntos.map((p) => L.latLng(p.lat, p.lng)),
          { color: acero, weight: 1.5, opacity: 0.5, dashArray: "4 7" },
        )
          .bindTooltip(`Trazado contratado · ${c.nombre}`, { sticky: true })
          .addTo(overlay);
        for (const p of c.puntos) limites.push([p.lat, p.lng]);
      }
    }

    for (const u of data.unidades) {
      const color = colorDeIdentidad(u.colorIndex);
      const partido = capas.ventana && u.tramosVentana !== null;

      if (capas.real) {
        // Un polyline POR TRAMO, no uno por unidad: la línea se corta en cada
        // hueco de señal en vez de cruzarlo. Cruzarlo dibujaría un camino que
        // nadie observó con el mismo brillo que la evidencia.
        //
        // Con la ventana encendida, lo de fuera se atenúa en vez de
        // desaparecer: que la unidad siguiera rodando después de llegar es un
        // hecho, y esconderlo aquí sería la pantalla decidiendo qué se ve.
        for (const tramo of u.tramos) {
          for (const p of tramo) limites.push([p.lat, p.lng]);
          if (tramo.length < 2) continue;
          L.polyline(
            tramo.map((p) => L.latLng(p.lat, p.lng)),
            {
              color,
              weight: partido ? TRAZA_PESO_FUERA_DE_VENTANA : TRAZA_PESO,
              opacity: partido ? 0.35 : 0.95,
            },
          )
            .bindTooltip(`${u.label} · recorrido observado`, { sticky: true })
            .addTo(overlay);
        }
      }

      if (partido) {
        for (const tramo of u.tramosVentana!) {
          if (tramo.length < 2) continue;
          L.polyline(
            tramo.map((p) => L.latLng(p.lat, p.lng)),
            { color, weight: TRAZA_PESO + 1, opacity: 1 },
          )
            .bindTooltip(`${u.label} · dentro de la ventana verificada`, { sticky: true })
            .addTo(overlay);
        }
      }

      if (capas.paradas) {
        for (const p of u.paradas) {
          // Con su duración, su hora y su lugar. Lo que NO se hace es
          // colapsarlas a un número: ahí se pierde justo lo que las hace
          // interpretables (Ficha-Workbench §3.4).
          L.circleMarker([p.lat, p.lng], {
            radius: 4,
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.25,
          })
            .bindTooltip(p.etiqueta, { sticky: true })
            .addTo(overlay);
        }
      }

      if (capas.huecos) {
        for (const h of u.huecos) {
          // Ámbar: aviso del sistema, no falta del transportista. Sin evidencia
          // NO es incumplimiento (ley 7), y el mapa no puede sugerir lo
          // contrario.
          L.polyline(
            [L.latLng(h.lat, h.lng), L.latLng(h.latFin, h.lngFin)],
            { color: ambar, weight: 2, opacity: 0.9, dashArray: "3 6" },
          )
            .bindTooltip(h.etiqueta, { sticky: true })
            .addTo(overlay);
          L.circleMarker([h.lat, h.lng], {
            radius: 5,
            color: ambar,
            weight: 1.5,
            dashArray: "2 2",
            fill: false,
          }).addTo(overlay);
        }
      }
    }

    if (!encuadradoRef.current && limites.length > 0) {
      map.fitBounds(limites, { padding: [24, 24] });
      encuadradoRef.current = true;
    }
  }, [listo, firma, capas, data]);

  return (
    <div className="flex flex-col gap-2 min-[900px]:flex-row">
      <div className="min-w-0 flex-1">
        <div
          ref={containerRef}
          className="lienzo-workbench h-[440px] w-full rounded-sm border border-[var(--linea)] min-[900px]:h-[560px]"
        />

        {/* La declaración de la simplificación. VISIBLE, junto al lienzo, no un
            asterisco al pie: es la primera de las dos condiciones de la ley. */}
        <p className="mt-1.5 font-[family-name:var(--fuente-mono)] text-[10.5px] tabular-nums text-[var(--tenue)]">
          {data.simplificacion.declaracion}
          {data.simplificacion.activa ? (
            <>
              {" · "}
              {data.simplificacion.puntosDibujados.toLocaleString("es-MX")} de{" "}
              {data.simplificacion.puntosTotales.toLocaleString("es-MX")} puntos · desvío
              máximo {data.simplificacion.toleranciaMetros} m
            </>
          ) : null}
        </p>

        {/* La ley 4 no aplica aquí, y se dice. */}
        <p className="mt-1 text-[10.5px] leading-relaxed text-[var(--tenue)]">
          Aquí la traza no se corta al llegar a la geocerca: es tu flota, no evidencia de un
          cliente. Ninguna de estas capas existe del lado del cliente.
        </p>
      </div>

      <div className="flex-none rounded-sm border border-[var(--linea)] px-3 py-2.5 min-[900px]:w-[210px]">
        <p className="font-[family-name:var(--fuente-mono)] text-[10px] uppercase tracking-[0.13em] text-[var(--tenue)]">
          Capas
        </p>
        {grupos.map((g) => (
          <div key={g.titulo} className="mt-2.5">
            <p className="text-[11px] text-[var(--tenue)]">{g.titulo}</p>
            {g.capas.map((c) => {
              const desactivada = c.id === "ventana" && !hayVentana;
              return (
                <label
                  key={c.id}
                  className={`mt-1 flex items-center gap-2 text-[12px] ${
                    desactivada
                      ? "cursor-default text-[var(--tenue)]"
                      : "cursor-pointer text-[var(--texto)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={capas[c.id] && !desactivada}
                    disabled={desactivada}
                    onChange={(e) => setCapas((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                    className="cursor-pointer accent-[var(--acero)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="flex-none font-[family-name:var(--fuente-mono)] text-[9px] uppercase tracking-[0.1em] text-[var(--tenue)]">
                    Tuya
                  </span>
                </label>
              );
            })}
          </div>
        ))}

        {/* Una capa apagada sin razón se lee como un error de la pantalla. */}
        {!hayVentana ? (
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--tenue)]">
            La ventana verificada aparece al abrir un servicio: es la que el árbitro miró.
          </p>
        ) : null}

        <div className="mt-3 border-t border-[var(--linea)] pt-2">
          <p className="text-[10px] leading-relaxed text-[var(--tenue)]">
            Paradas: velocidad reportada en cero por {data.paradaUmbralMinutos} min o más. Un
            hueco de señal corta la parada — el equipo dejó de reportar y no se sabe si siguió
            quieta.
          </p>
        </div>

        {/* La puerta abierta, declarada. */}
        <p className="mt-3 rounded-sm border border-dashed border-[var(--linea)] px-2 py-1.5 text-[10px] leading-relaxed text-[var(--tenue)]">
          Más capas y herramientas se agregan aquí.
        </p>
      </div>
    </div>
  );
}
