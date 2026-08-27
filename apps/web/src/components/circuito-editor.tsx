"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Editor de un circuito: subir su KML y poner sus paradas sobre el mapa.
 *
 * ## Las dos decisiones que esta pantalla existe para respetar
 *
 * **Cuál capa es ida y cuál vuelta lo escoge una persona, no el código.** El KML
 * del circuito 1 trae cuatro trazos —dos de ellos una versión burda del mismo
 * recorrido— y el de un concesionario invitado va a venir con las convenciones
 * de quien se lo dibujó. Por eso la lista muestra las medidas de cada capa: con
 * el espaciado y el hueco máximo enfrente, la que corta esquinas se ve sola.
 *
 * **El pegado se ve antes de confirmar.** Picar y que la parada aparezca en otro
 * lado sin explicación es lo que vuelve incomprensible una pantalla. Aquí el
 * pico deja un fantasma en el trazado, dice a cuántos metros quedó, y si pasa la
 * tolerancia del circuito avisa y deja soltar el pegado.
 */

type Sentido = "ida" | "vuelta";

export interface CapaAnalizada {
  indice: number;
  nombre: string;
  carpeta: string | null;
  puntos: number;
  largoMetros: number;
  espaciadoMedianoMetros: number;
  huecoMaximoMetros: number;
  cortaEsquinas: boolean;
  coordenadas: Array<[number, number]>;
}

export interface ParadaVigente {
  stopId: string;
  qrSlug: string;
  name: string;
  orden: number;
  latitude: number;
  longitude: number;
}

export interface TrazadoGuardado {
  sentido: Sentido;
  coordinates: Array<[number, number]>;
  pointCount: number;
  lengthMeters: number;
  sourceLayerName: string | null;
}

const COLOR = { ida: "#2f81f7", vuelta: "#d29922", parada: "#3fb950", fantasma: "#8b949e" };

export function CircuitoEditor({
  circuitoId,
  toleranciaMetros,
  trazadosIniciales,
  paradasIniciales,
}: {
  circuitoId: string;
  toleranciaMetros: number;
  trazadosIniciales: TrazadoGuardado[];
  paradasIniciales: ParadaVigente[];
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaTrazados = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaFantasma = useRef<import("leaflet").LayerGroup | null>(null);

  const [trazados, setTrazados] = useState(trazadosIniciales);
  const [paradas, setParadas] = useState(paradasIniciales);
  const [analisis, setAnalisis] = useState<{
    archivo: string;
    capas: CapaAnalizada[];
    avisos: string[];
  } | null>(null);
  const [pendiente, setPendiente] = useState<{
    lat: number;
    lon: number;
    pegadaLat: number;
    pegadaLon: number;
    distancia: number;
    fuera: boolean;
  } | null>(null);
  const [soltarPegado, setSoltarPegado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);

  // ── mapa ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    let cancelado = false;
    void import("leaflet").then((mod) => {
      if (cancelado || !contenedor.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(contenedor.current, { scrollWheelZoom: true }).setView([31.7, -106.45], 12);
      // OpenStreetMap directo: CARTO empezó a exigir llave y devuelve un mosaico
      // con "API KEY REQUIRED" impreso, que es lo que dejó el mapa negro. Aquí
      // hace falta un mapa LEGIBLE para picar paradas sobre calles reales, así
      // que el fondo claro además ayuda.
      mod
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        })
        .addTo(m);
      capaTrazados.current = mod.layerGroup().addTo(m);
      capaParadas.current = mod.layerGroup().addTo(m);
      capaFantasma.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      // El mapa se crea de forma asíncrona, así que el primer dibujo del
      // trazado puede correr ANTES de que exista y su encuadre se pierde: al
      // recargar el editor había que ir a buscar el circuito a mano. Con esto
      // el dibujo se rehace en cuanto el mapa está listo.
      setMapaListo(true);
      setMensaje("Pica sobre el mapa para poner una parada.");
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  const dibujarTrazados = useCallback(() => {
    const mod = L.current;
    if (!mod || !capaTrazados.current || !mapaListo) return;
    capaTrazados.current.clearLayers();
    for (const t of trazados) {
      mod
        .polyline(
          t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
          { color: COLOR[t.sentido], weight: 4, opacity: 0.9 },
        )
        .bindTooltip(`${t.sentido} · ${t.pointCount} puntos · ${(t.lengthMeters / 1000).toFixed(2)} km`)
        .addTo(capaTrazados.current);
    }
    if (trazados.length > 0 && mapa.current) {
      const todas = trazados.flatMap((t) =>
        t.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      );
      mapa.current.fitBounds(mod.latLngBounds(todas).pad(0.05));
    }
  }, [trazados, mapaListo]);

  const dibujarParadas = useCallback(() => {
    const mod = L.current;
    if (!mod || !capaParadas.current || !mapaListo) return;
    capaParadas.current.clearLayers();
    for (const p of paradas) {
      mod
        .circleMarker([p.latitude, p.longitude], {
          radius: 7,
          color: COLOR.parada,
          fillColor: COLOR.parada,
          fillOpacity: 0.85,
          weight: 2,
        })
        .bindTooltip(`${p.name} · orden ${p.orden}`)
        .addTo(capaParadas.current);
    }
  }, [paradas, mapaListo]);

  useEffect(dibujarTrazados, [dibujarTrazados]);
  useEffect(dibujarParadas, [dibujarParadas]);

  // ── picar en el mapa: fantasma antes de confirmar ────────────────────────
  useEffect(() => {
    const m = mapa.current;
    const mod = L.current;
    if (!m || !mod) return;

    const alPicar = (e: import("leaflet").LeafletMouseEvent) => {
      const trazado = trazados[0];
      if (!trazado) {
        setMensaje("Sube el KML antes de poner paradas: sin trazado no hay dónde pegarlas.");
        return;
      }
      // La proyección se rehace en el servidor al guardar. Aquí solo es para
      // que se VEA dónde va a quedar antes de confirmar.
      const pegada = proyectarLocal(e.latlng.lat, e.latlng.lng, trazado.coordinates);
      setPendiente({
        lat: e.latlng.lat,
        lon: e.latlng.lng,
        pegadaLat: pegada.lat,
        pegadaLon: pegada.lon,
        distancia: pegada.distancia,
        fuera: pegada.distancia > toleranciaMetros,
      });
      setSoltarPegado(false);

      capaFantasma.current?.clearLayers();
      if (!capaFantasma.current) return;
      mod
        .circleMarker([pegada.lat, pegada.lon], {
          radius: 8,
          color: COLOR.fantasma,
          dashArray: "4 3",
          fillOpacity: 0.25,
        })
        .addTo(capaFantasma.current);
      mod
        .polyline(
          [
            [e.latlng.lat, e.latlng.lng],
            [pegada.lat, pegada.lon],
          ],
          { color: COLOR.fantasma, weight: 1, dashArray: "3 4" },
        )
        .addTo(capaFantasma.current);
    };

    m.on("click", alPicar);
    return () => {
      m.off("click", alPicar);
    };
  }, [trazados, toleranciaMetros]);

  // ── acciones ────────────────────────────────────────────────────────────
  async function subirKml(archivo: File) {
    setOcupado(true);
    setMensaje(null);
    try {
      const form = new FormData();
      form.set("kml", archivo);
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/kml`, { method: "POST", body: form });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo leer el archivo");
      setAnalisis(cuerpo);
      setMensaje(`${cuerpo.capas.length} capas leídas. Escoge cuál es ida y cuál vuelta.`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function guardarTrazado(capa: CapaAnalizada, sentido: Sentido) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/trazado`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sentido,
          coordenadas: capa.coordenadas,
          capaNombre: capa.nombre,
          archivoNombre: analisis?.archivo,
        }),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo guardar");
      setTrazados((prev) => [
        ...prev.filter((t) => t.sentido !== sentido),
        {
          sentido,
          coordinates: capa.coordenadas,
          pointCount: capa.puntos,
          lengthMeters: capa.largoMetros,
          sourceLayerName: capa.nombre,
        },
      ]);
      setMensaje(`Guardado como ${sentido}: "${capa.nombre}", ${cuerpo.puntos} puntos.`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarParada() {
    if (!pendiente) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/paradas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `sinPegar` solo viaja si el pico se salió de la tolerancia: dentro de
        // ella no hay nada que soltar, y mandarlo sería pasar una decisión que
        // nadie tomó.
        body: JSON.stringify({
          lat: pendiente.lat,
          lon: pendiente.lon,
          sinPegar: pendiente.fuera && soltarPegado,
        }),
      });
      // Un 500 devuelve HTML, no JSON: si se intenta `r.json()` primero, revienta
      // el parseo y el mensaje que llega es "Unexpected token <", que no dice
      // nada. Se lee el estado ANTES de suponer que la respuesta es JSON.
      if (!r.ok) {
        const detalle = await r.text();
        throw new Error(`El servidor contestó ${r.status}. ${detalle.slice(0, 200)}`);
      }
      const cuerpo = await r.json();
      setParadas((prev) => [
        ...prev,
        {
          stopId: cuerpo.stopId,
          qrSlug: cuerpo.qrSlug,
          name: cuerpo.nombre,
          orden: cuerpo.orden,
          latitude: cuerpo.lat,
          longitude: cuerpo.lon,
        },
      ]);
      setPendiente(null);
      capaFantasma.current?.clearLayers();
      setMensaje(`${cuerpo.nombre} creada. Su QR es ${cuerpo.qrSlug} y ya no cambia.`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function renombrar(parada: ParadaVigente) {
    const nombre = window.prompt("Nombre de la parada", parada.name);
    if (!nombre || nombre === parada.name) return;
    const motivo = window.prompt("¿Por qué cambia? (opcional)") ?? undefined;
    await revisar(parada.stopId, { nombre, motivo });
  }

  async function revisar(stopId: string, cambios: Record<string, unknown>) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/jstaff/circuitos/${circuitoId}/paradas/${stopId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const cuerpo = await r.json();
      if (!r.ok) throw new Error(cuerpo.error ?? "No se pudo cambiar");
      setParadas((prev) =>
        prev.map((p) =>
          p.stopId === stopId
            ? { ...p, name: cuerpo.nombre, orden: cuerpo.orden, latitude: cuerpo.lat, longitude: cuerpo.lon }
            : p,
        ),
      );
      setMensaje("Cambio guardado. La versión anterior queda con su fecha; el QR no se tocó.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function retirar(parada: ParadaVigente) {
    if (!window.confirm(`¿Retirar ${parada.name}? Deja de publicarse; su historia se conserva.`)) return;
    const motivo = window.prompt("¿Por qué se retira? (opcional)") ?? "";
    setOcupado(true);
    try {
      const r = await fetch(
        `/api/jstaff/circuitos/${circuitoId}/paradas/${parada.stopId}?motivo=${encodeURIComponent(motivo)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("No se pudo retirar");
      setParadas((prev) => prev.filter((p) => p.stopId !== parada.stopId));
      setMensaje(`${parada.name} retirada.`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  const puestos = new Set(trazados.map((t) => t.sentido));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div ref={contenedor} className="h-[560px] rounded border border-[var(--linea-tenue)]" />

      <div className="space-y-4">
        {mensaje && (
          <p className="rounded border border-[var(--linea-tenue)] p-3 text-sm text-[var(--muted)]">
            {mensaje}
          </p>
        )}

        <section className="rounded border border-[var(--linea-tenue)] p-3">
          <h3 className="mb-2 font-medium">Trazado</h3>
          <input
            type="file"
            accept=".kml"
            disabled={ocupado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirKml(f);
            }}
            className="text-sm"
          />
          {trazados.map((t) => (
            <p key={t.sentido} className="mt-2 text-xs text-[var(--muted)]">
              <span style={{ color: COLOR[t.sentido] }}>■</span> {t.sentido}: {t.pointCount} puntos ·{" "}
              {(t.lengthMeters / 1000).toFixed(2)} km
              {t.sourceLayerName ? ` · capa "${t.sourceLayerName}"` : ""}
            </p>
          ))}

          {analisis && (
            <div className="mt-3 space-y-2">
              {analisis.avisos.map((a) => (
                <p key={a} className="rounded bg-[var(--aviso-fondo,#3a2d00)] p-2 text-xs">
                  ⚠ {a}
                </p>
              ))}
              {analisis.capas.map((c) => (
                <div
                  key={c.indice}
                  className={`rounded border p-2 text-xs ${
                    c.cortaEsquinas
                      ? "border-dashed border-[var(--linea-tenue)] opacity-60"
                      : "border-[var(--linea-tenue)]"
                  }`}
                >
                  <p className="font-medium">
                    {c.nombre}
                    {c.cortaEsquinas ? (
                      <span className="ml-2 rounded bg-[var(--aviso-fondo,#3a2d00)] px-1 py-0.5">
                        ⚠ corta esquinas — no usar
                      </span>
                    ) : (
                      <span className="ml-2 text-[var(--muted)]">recomendada</span>
                    )}
                  </p>
                  <p className="text-[var(--muted)]">
                    {c.puntos} puntos · {(c.largoMetros / 1000).toFixed(2)} km · espaciado{" "}
                    {c.espaciadoMedianoMetros} m · hueco máx {c.huecoMaximoMetros} m
                  </p>
                  <div className="mt-1 flex gap-2">
                    {(["ida", "vuelta"] as Sentido[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          // Escoger una capa marcada sigue siendo posible —puede
                          // ser el único trazado que exista— pero deja de ser un
                          // clic distraído.
                          if (
                            c.cortaEsquinas &&
                            !window.confirm(
                              `"${c.nombre}" tiene saltos de hasta ${c.huecoMaximoMetros} m entre puntos. ` +
                                `A esa resolución el trazado corta esquinas y el "en circuito" miente. ` +
                                `¿Usarla de todos modos como ${s}?`,
                            )
                          ) {
                            return;
                          }
                          void guardarTrazado(c, s);
                        }}
                        className="rounded border border-[var(--linea-tenue)] px-2 py-1"
                      >
                        {puestos.has(s) ? `Reemplazar ${s}` : `Usar como ${s}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {pendiente && (
          <section className="rounded border border-[var(--linea-tenue)] p-3">
            <h3 className="mb-1 font-medium">Parada nueva</h3>
            <p className="text-xs text-[var(--muted)]">
              Picaste a <strong>{Math.round(pendiente.distancia)} m</strong> del recorrido. El
              círculo punteado es donde va a quedar.
            </p>
            {pendiente.fuera && (
              <p className="mt-2 rounded bg-[var(--aviso-fondo,#3a2d00)] p-2 text-xs">
                ⚠ Pasa los {toleranciaMetros} m de tolerancia de este circuito. Se va a pegar al
                trazado; si la parada va de verdad donde picaste, suelta el pegado.
              </p>
            )}
            {/*
              La casilla solo aparece cuando el pico se salió de la tolerancia.
              Ofrecerla siempre invitaba a dejar paradas sin pegar sin que nadie
              lo pidiera, y en un mapa oscuro una casilla sin marcar se confunde
              con una marcada. Dentro de la tolerancia el pegado no se discute:
              la parada está sobre la ruta por definición.
            */}
            {pendiente.fuera && (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={soltarPegado}
                  onChange={(e) => setSoltarPegado(e.target.checked)}
                />
                Soltar el pegado y dejarla donde piqué
              </label>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void confirmarParada()}
                className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm"
              >
                Crear parada
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendiente(null);
                  capaFantasma.current?.clearLayers();
                }}
                className="rounded px-3 py-1 text-sm text-[var(--muted)]"
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        <section className="rounded border border-[var(--linea-tenue)] p-3">
          <h3 className="mb-2 font-medium">Paradas ({paradas.length})</h3>
          {paradas.length === 0 && (
            <p className="text-xs text-[var(--muted)]">
              Ninguna todavía. El circuito calcula llegadas igual: la llegada sale del trazado, no
              de las paradas.
            </p>
          )}
          {paradas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((p) => (
              <div
                key={p.stopId}
                className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--linea-tenue)] pt-2 text-xs"
              >
                <span>
                  <strong>{p.name}</strong>
                  <span className="ml-1 text-[var(--muted)]">· QR {p.qrSlug}</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={ocupado} onClick={() => void renombrar(p)}>
                    Renombrar
                  </button>
                  <button type="button" disabled={ocupado} onClick={() => void retirar(p)}>
                    Retirar
                  </button>
                </span>
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}

/**
 * Proyección local, solo para dibujar el fantasma.
 *
 * **La que vale es la del servidor.** Ésta existe para que el pico se vea al
 * instante sin ida y vuelta a la red; lo que se guarda sale de
 * `pegarAlTrazado` en `@jtel/domain`, que es la misma función que después
 * calcula las llegadas. Dos implementaciones de la misma idea serían una
 * trampa, así que ésta no decide nada: solo pinta.
 */
function proyectarLocal(lat: number, lon: number, trazado: Array<[number, number]>) {
  const rad = Math.PI / 180;
  const mLat = 111_132.92 - 559.82 * Math.cos(2 * lat * rad);
  const mLon = 111_412.84 * Math.cos(lat * rad);
  const px = lon * mLon;
  const py = lat * mLat;
  let mejor = { d2: Infinity, lat, lon };
  for (let i = 0; i < trazado.length - 1; i++) {
    const ax = trazado[i][0] * mLon;
    const ay = trazado[i][1] * mLat;
    const bx = trazado[i + 1][0] * mLon;
    const by = trazado[i + 1][1] * mLat;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = (px - cx) ** 2 + (py - cy) ** 2;
    if (d2 < mejor.d2) mejor = { d2, lat: cy / mLat, lon: cx / mLon };
  }
  return { lat: mejor.lat, lon: mejor.lon, distancia: Math.sqrt(mejor.d2) };
}
