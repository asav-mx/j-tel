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
 *
 * **Cada parada dice su sentido, y se pega al trazado de ese sentido** (Oasis,
 * 21 sep 2026). La pantalla nunca lo preguntaba: toda parada nacía «de los dos»
 * pegada a la ida, y donde la vuelta va por otra calle eso inventaba paradas.
 * Ahora el sentido se escoge sin valor por defecto, «ambos» avisa si queda lejos
 * de la vuelta, y en la lista cada parada lo muestra y se puede corregir — y
 * mover, porque corregir el sentido no la cambia de calle.
 */

type Sentido = "ida" | "vuelta";
/** Lo que se escoge al crear o corregir. «ambos» viaja como `null`. */
type Eleccion = Sentido | "ambos";
const aEleccion = (s: Sentido | null): Eleccion => s ?? "ambos";
const aSentido = (e: Eleccion): Sentido | null => (e === "ambos" ? null : e);
const PALABRA: Record<Eleccion, string> = { ida: "Ida", vuelta: "Vuelta", ambos: "Ambos" };

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
  /** `null` = sirve a los dos sentidos. */
  sentido: Sentido | null;
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
  /** Donde se picó. El pegado depende del sentido, que se escoge después. */
  const [pendiente, setPendiente] = useState<{ lat: number; lon: number } | null>(null);
  /** El sentido de la parada nueva. `null` = todavía no se escoge: sin valor por defecto. */
  const [sentidoPendiente, setSentidoPendiente] = useState<Eleccion | null>(null);
  /** Corregir el sentido de una parada, con su motivo. */
  const [corrigiendo, setCorrigiendo] = useState<{ stopId: string; eleccion: Eleccion; motivo: string } | null>(
    null,
  );
  /** Mover una parada: el próximo pico en el mapa es su lugar nuevo. */
  const [moviendo, setMoviendo] = useState<{ stopId: string; lat: number | null; lon: number | null } | null>(null);
  /** Lo que el servidor dijo al corregir, por parada (p. ej. «queda a 180 m de la vuelta»). */
  const [avisoDe, setAvisoDe] = useState<Record<string, string>>({});
  const [soltarPegado, setSoltarPegado] = useState(false);
  /**
   * El nombre que va a llevar la parada que se está por crear.
   *
   * El endpoint ya aceptaba `nombre` desde el primer día y **la pantalla nunca
   * lo mandaba**: toda parada nacía como «Parada 7» y había que renombrarla
   * después, en otro paso. Quien captura tiene el nombre en la cabeza justo
   * cuando pica el mapa —está viendo la esquina—, y es el único momento en que
   * no cuesta nada escribirlo.
   */
  const [nombrePendiente, setNombrePendiente] = useState("");
  /**
   * La parada que se está renombrando, con lo tecleado hasta ahora.
   *
   * Antes eran dos `window.prompt` encadenados. En el teléfono eso es un cuadro
   * del sistema operativo encima de la pantalla: no se ve qué parada se está
   * cambiando, no se puede corregir sin volver a empezar, y el segundo cuadro
   * —el del motivo— aparece sin contexto. La edición vive donde vive la parada.
   */
  const [editando, setEditando] = useState<{ stopId: string; nombre: string; motivo: string } | null>(
    null,
  );
  /** La parada que se está por retirar, con su motivo. Misma razón que arriba. */
  const [retirando, setRetirando] = useState<{ stopId: string; motivo: string } | null>(null);
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
          // Del color del trazado de su sentido; «ambos», el neutro.
          color: p.sentido ? COLOR[p.sentido] : COLOR.parada,
          fillColor: p.sentido ? COLOR[p.sentido] : COLOR.parada,
          fillOpacity: 0.85,
          weight: 2,
        })
        .bindTooltip(`${p.name} · ${PALABRA[aEleccion(p.sentido)].toLowerCase()} · orden ${p.orden}`)
        .addTo(capaParadas.current);
    }
  }, [paradas, mapaListo]);

  useEffect(dibujarTrazados, [dibujarTrazados]);
  useEffect(dibujarParadas, [dibujarParadas]);

  // ── picar en el mapa: fantasma antes de confirmar ────────────────────────
  /*
   * `mapaListo` va en las dependencias, y no es adorno: **sin él el pico no se
   * engancha nunca al reabrir un circuito que ya trae su trazado.**
   *
   * El mapa se crea dentro de un `import("leaflet")`, que es asíncrono, así que
   * la primera corrida de este efecto ocurre con `mapa.current` todavía en
   * null y se sale por la guardia de arriba. Si después nada cambia
   * `trazados` ni `toleranciaMetros` —el caso normal: abrir un circuito
   * capturado hace semanas— el efecto no vuelve a correr y el mapa se queda
   * sin oyente. El trazado y las paradas sí se dibujan, porque sus efectos ya
   * miraban `mapaListo`; sólo el clic se quedaba fuera.
   *
   * Y la pantalla decía «Pica sobre el mapa para poner una parada» igual, que
   * es lo que lo volvía indescifrable: el mapa se ve completo, invita al pico,
   * y el pico no hace nada. Sólo funcionaba subiendo un KML en la misma
   * sesión, porque eso cambia `trazados` cuando el mapa ya existe — que es
   * exactamente como se construyó y por eso nadie lo vio.
   */
  useEffect(() => {
    const m = mapa.current;
    const mod = L.current;
    if (!m || !mod) return;

    const alPicar = (e: import("leaflet").LeafletMouseEvent) => {
      if (trazados.length === 0) {
        setMensaje("Sube el KML antes de poner paradas: sin trazado no hay dónde pegarlas.");
        return;
      }
      // Moviendo una parada: este pico es su lugar nuevo, no una parada nueva.
      if (moviendo) {
        setMoviendo({ ...moviendo, lat: e.latlng.lat, lon: e.latlng.lng });
        return;
      }
      setPendiente({ lat: e.latlng.lat, lon: e.latlng.lng });
      // Cada pico pregunta el sentido otra vez: arrastrar el de la anterior sería un valor por defecto.
      setSentidoPendiente(null);
      setSoltarPegado(false);
    };

    m.on("click", alPicar);
    return () => {
      m.off("click", alPicar);
    };
  }, [trazados, toleranciaMetros, mapaListo, moviendo]);

  /*
   * El fantasma: dónde va a quedar, pegado al trazado DEL SENTIDO escogido.
   * Sin sentido todavía, sólo se marca el pico — pegar a la ida «mientras» sería
   * volver a decidir por quien captura.
   */
  const trazadoDe = (s: Sentido) => trazados.find((t) => t.sentido === s);
  const previa = (() => {
    const pico = moviendo?.lat != null && moviendo.lon != null ? { lat: moviendo.lat, lon: moviendo.lon } : pendiente;
    if (!pico) return null;
    const eleccion = moviendo ? aEleccion(paradas.find((p) => p.stopId === moviendo.stopId)?.sentido ?? null) : sentidoPendiente;
    if (!eleccion) return { pico, eleccion: null, pegada: null, sinTrazado: false, avisoAmbos: null };
    const principal = trazadoDe(eleccion === "vuelta" ? "vuelta" : "ida");
    if (!principal) return { pico, eleccion, pegada: null, sinTrazado: true, avisoAmbos: null };
    const pegada = proyectarLocal(pico.lat, pico.lon, principal.coordinates);
    let avisoAmbos: string | null = null;
    const vuelta = trazadoDe("vuelta");
    if (eleccion === "ambos" && vuelta) {
      const d = proyectarLocal(pegada.lat, pegada.lon, vuelta.coordinates).distancia;
      if (d > toleranciaMetros) {
        avisoAmbos = `Queda a ${Math.round(d)} m del trazado de la vuelta (la tolerancia es ${toleranciaMetros} m): ¿de verdad sirve a los dos sentidos?`;
      }
    }
    return { pico, eleccion, pegada, sinTrazado: false, avisoAmbos };
  })();
  const fuera = previa?.pegada ? previa.pegada.distancia > toleranciaMetros : false;

  useEffect(() => {
    const mod = L.current;
    const capa = capaFantasma.current;
    if (!mod || !capa) return;
    capa.clearLayers();
    if (!previa) return;
    const { pico, pegada } = previa;
    if (!pegada) {
      mod.circleMarker([pico.lat, pico.lon], { radius: 6, color: COLOR.fantasma, fillOpacity: 0.4 }).addTo(capa);
      return;
    }
    mod
      .circleMarker([pegada.lat, pegada.lon], { radius: 8, color: COLOR.fantasma, dashArray: "4 3", fillOpacity: 0.25 })
      .addTo(capa);
    mod
      .polyline([[pico.lat, pico.lon], [pegada.lat, pegada.lon]], { color: COLOR.fantasma, weight: 1, dashArray: "3 4" })
      .addTo(capa);
  });

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
    if (!pendiente || !sentidoPendiente) return;
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
          // Vacío viaja como vacío y el servidor la numera. No se manda un
          // nombre inventado desde aquí: «Parada 7» puesta por el servidor es
          // un marcador de posición honesto; puesta por la pantalla se leería
          // como si alguien la hubiera nombrado así.
          nombre: nombrePendiente.trim() || undefined,
          // Siempre viaja, y nunca por defecto: «ambos» es `null` dicho a propósito.
          sentido: aSentido(sentidoPendiente),
          sinPegar: fuera && soltarPegado,
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
          sentido: cuerpo.sentido ?? null,
        },
      ]);
      setPendiente(null);
      setSentidoPendiente(null);
      setNombrePendiente("");
      capaFantasma.current?.clearLayers();
      setMensaje(
        `${cuerpo.nombre} creada (${PALABRA[aEleccion(cuerpo.sentido ?? null)].toLowerCase()}). Su QR es ${cuerpo.qrSlug} y ya no cambia.` +
          (cuerpo.aviso ? ` ⚠ ${cuerpo.aviso}` : ""),
      );
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function guardarNombre() {
    if (!editando) return;
    const nombre = editando.nombre.trim();
    const parada = paradas.find((p) => p.stopId === editando.stopId);
    // Sin cambio no se manda nada: una versión nueva idéntica a la anterior
    // ensucia la historia de la parada sin decir nada.
    if (!nombre || nombre === parada?.name) return setEditando(null);
    await revisar(editando.stopId, {
      nombre,
      motivo: editando.motivo.trim() || undefined,
    });
    setEditando(null);
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
            ? {
                ...p,
                name: cuerpo.nombre,
                orden: cuerpo.orden,
                latitude: cuerpo.lat,
                longitude: cuerpo.lon,
                sentido: cuerpo.sentido ?? null,
              }
            : p,
        ),
      );
      // El aviso se queda en el renglón de SU parada: «queda a 180 m de la vuelta, muévela».
      setAvisoDe((prev) => {
        const siguiente = { ...prev };
        if (cuerpo.aviso) siguiente[stopId] = cuerpo.aviso;
        else delete siguiente[stopId];
        return siguiente;
      });
      setMensaje("Cambio guardado. La versión anterior queda con su fecha; el QR no se tocó.");
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err));
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarMovida() {
    if (!moviendo || moviendo.lat == null || moviendo.lon == null) return;
    const parada = paradas.find((p) => p.stopId === moviendo.stopId);
    // Sin `sentido`: el servidor pega al que la parada YA tiene (antes pegaba a la ida).
    await revisar(moviendo.stopId, {
      lat: moviendo.lat,
      lon: moviendo.lon,
      sinPegar: fuera && soltarPegado,
      motivo: `Se movió al trazado de ${parada?.sentido === "vuelta" ? "la vuelta" : "la ida"}`,
    });
    setMoviendo(null);
    setSoltarPegado(false);
    capaFantasma.current?.clearLayers();
  }

  async function confirmarCorreccion() {
    if (!corrigiendo) return;
    const parada = paradas.find((p) => p.stopId === corrigiendo.stopId);
    if (!parada || aEleccion(parada.sentido) === corrigiendo.eleccion) return setCorrigiendo(null);
    await revisar(corrigiendo.stopId, {
      sentido: aSentido(corrigiendo.eleccion),
      motivo: corrigiendo.motivo.trim() || undefined,
    });
    setCorrigiendo(null);
  }

  async function confirmarRetiro() {
    if (!retirando) return;
    const parada = paradas.find((p) => p.stopId === retirando.stopId);
    if (!parada) return setRetirando(null);
    setOcupado(true);
    try {
      const r = await fetch(
        `/api/jstaff/circuitos/${circuitoId}/paradas/${parada.stopId}?motivo=${encodeURIComponent(retirando.motivo.trim())}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("No se pudo retirar");
      setParadas((prev) => prev.filter((p) => p.stopId !== parada.stopId));
      setMensaje(`${parada.name} retirada. Deja de publicarse; su historia se conserva.`);
      setRetirando(null);
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
          {/*
            El `<input type="file">` nativo pinta su propio texto —«Choose File
            / No file chosen»— **en el idioma del navegador, no en el de la
            página**. Ni `lang` ni ningún atributo lo cambian: es interfaz del
            navegador. En un teléfono con el sistema en inglés, la única pantalla
            en español se rompe a media captura.

            La forma de arreglarlo es la de siempre: se esconde el control
            nativo —sin quitarlo, para no perder el diálogo del sistema ni la
            navegación con teclado— y la etiqueta se pinta encima. `sr-only` y
            no `display:none`: escondido de ese modo, el input deja de recibir
            foco y el campo se vuelve inalcanzable sin ratón.
          */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-[var(--linea-tenue)] px-3 py-1.5 text-sm hover:bg-[var(--superficie-2)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            <input
              type="file"
              accept=".kml"
              disabled={ocupado}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirKml(f);
              }}
              className="sr-only"
            />
            Elegir archivo KML
          </label>
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

        {pendiente && !moviendo && (
          <section className="rounded border border-[var(--linea-tenue)] p-3">
            <h3 className="mb-1 font-medium">Parada nueva</h3>
            {/*
              El sentido va PRIMERO y sin valor por defecto: de él depende a qué
              trazado se pega. Sin escogerlo no hay fantasma pegado ni botón.
            */}
            <fieldset>
              <legend className="mb-1 text-xs text-[var(--muted)]">¿Qué sentido sirve?</legend>
              <div className="flex gap-2" role="radiogroup">
                {(["ida", "vuelta", "ambos"] as Eleccion[]).map((e) => (
                  <label
                    key={e}
                    className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${
                      sentidoPendiente === e ? "border-[var(--b-acero)] bg-[var(--t-acero)]" : "border-[var(--linea-tenue)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sentidoPendiente"
                      value={e}
                      checked={sentidoPendiente === e}
                      onChange={() => setSentidoPendiente(e)}
                      className="sr-only"
                    />
                    {e !== "ambos" && <span style={{ color: COLOR[e] }}>■ </span>}
                    {PALABRA[e]}
                  </label>
                ))}
              </div>
            </fieldset>
            {!sentidoPendiente && (
              <p className="mt-2 text-xs text-[var(--muted)]">Escoge el sentido: de él depende a qué trazado se pega.</p>
            )}
            {previa?.sinTrazado && (
              <p className="mt-2 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2 text-xs text-[var(--texto)]">
                ⚠ Este circuito no tiene trazado de {sentidoPendiente === "vuelta" ? "vuelta" : "ida"}: súbelo antes de
                poner paradas de ese sentido.
              </p>
            )}
            {previa?.pegada && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Picaste a <strong>{Math.round(previa.pegada.distancia)} m</strong> del trazado de{" "}
                {sentidoPendiente === "vuelta" ? "la vuelta" : "la ida"}. El círculo punteado es donde va a quedar.
              </p>
            )}
            {previa?.avisoAmbos && (
              <p className="mt-2 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2 text-xs text-[var(--texto)]">
                ⚠ {previa.avisoAmbos}
              </p>
            )}
            {fuera && (
              // El color sale de los tokens de las dos paletas. El
              // `var(--aviso-fondo,#3a2d00)` que vivía aquí no existía en
              // ninguna: siempre caía al literal, y el literal es un café oscuro
              // que en tema claro deja texto oscuro sobre fondo oscuro.
              <p className="mt-2 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2 text-xs text-[var(--texto)]">
                ⚠ Pasa los {toleranciaMetros} m de pegado de este circuito. Se va a pegar al
                trazado; si la parada va de verdad donde picaste, suelta el pegado.
              </p>
            )}

            {/*
              El nombre se escribe AQUÍ, con la esquina enfrente.

              El endpoint aceptaba `nombre` desde el primer día y la pantalla no
              lo mandaba: toda parada nacía «Parada 7» y renombrarla era otro
              paso, después, cuando ya nadie se acuerda de cuál era cuál.

              Vacío es válido y el servidor la numera. El `placeholder` dice cómo
              va a quedar si se deja así — no es un valor sugerido: no se envía.
            */}
            <div className="mt-3">
              <label className="mb-1 block text-xs text-[var(--muted)]" htmlFor="nombreParada">
                Nombre de la parada
              </label>
              <input
                id="nombreParada"
                value={nombrePendiente}
                onChange={(e) => setNombrePendiente(e.target.value)}
                placeholder={`vacío: Parada ${paradas.length + 1}`}
                className="w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-sm text-[var(--texto)]"
              />
            </div>
            {/*
              La casilla solo aparece cuando el pico se salió de la tolerancia.
              Ofrecerla siempre invitaba a dejar paradas sin pegar sin que nadie
              lo pidiera, y en un mapa oscuro una casilla sin marcar se confunde
              con una marcada. Dentro de la tolerancia el pegado no se discute:
              la parada está sobre la ruta por definición.
            */}
            {fuera && (
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
                disabled={ocupado || !sentidoPendiente || !previa?.pegada}
                onClick={() => void confirmarParada()}
                className="rounded border border-[var(--linea-tenue)] px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear parada
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendiente(null);
                  setSentidoPendiente(null);
                  setNombrePendiente("");
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
          {/*
            Renombrar y retirar viven DENTRO del renglón de su parada.

            Eran `window.prompt` y `window.confirm`: cuadros del sistema
            operativo encima de la pantalla, que en un teléfono tapan justo la
            parada de la que hablan. Aquí se ve cuál se está cambiando, se puede
            corregir sin volver a empezar, y el motivo aparece con su contexto en
            vez de en un segundo cuadro suelto.
          */}
          {paradas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((p) => (
              <div
                key={p.stopId}
                className="mt-2 border-t border-[var(--linea-tenue)] pt-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <strong className="text-[var(--texto)]">{p.name}</strong>
                    {/* El sentido, siempre a la vista: es lo que decide a qué calle pertenece. */}
                    <span
                      className="ml-2 rounded border border-[var(--linea-tenue)] px-1.5 py-0.5"
                      style={p.sentido ? { color: COLOR[p.sentido] } : undefined}
                    >
                      {PALABRA[aEleccion(p.sentido)].toLowerCase()}
                    </span>
                    <span className="ml-1 text-[var(--muted)]">· QR {p.qrSlug}</span>
                  </span>
                  {editando?.stopId !== p.stopId &&
                  retirando?.stopId !== p.stopId &&
                  corrigiendo?.stopId !== p.stopId &&
                  moviendo?.stopId !== p.stopId ? (
                    <span className="flex shrink-0 flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          setEditando(null);
                          setRetirando(null);
                          setMoviendo(null);
                          setCorrigiendo({ stopId: p.stopId, eleccion: aEleccion(p.sentido), motivo: "" });
                        }}
                        className="text-[var(--acero)] underline"
                      >
                        Corregir sentido
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          setEditando(null);
                          setRetirando(null);
                          setCorrigiendo(null);
                          setPendiente(null);
                          setSoltarPegado(false);
                          setMoviendo({ stopId: p.stopId, lat: null, lon: null });
                          setMensaje(`Pica en el mapa dónde va ${p.name}. Se pega al trazado de su sentido y el QR no cambia.`);
                        }}
                        className="text-[var(--acero)] underline"
                      >
                        Mover
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          setRetirando(null);
                          setEditando({ stopId: p.stopId, nombre: p.name, motivo: "" });
                        }}
                        className="text-[var(--acero)] underline"
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          setEditando(null);
                          setRetirando({ stopId: p.stopId, motivo: "" });
                        }}
                        className="text-[var(--muted)] underline"
                      >
                        Retirar
                      </button>
                    </span>
                  ) : null}
                </div>

                {avisoDe[p.stopId] && moviendo?.stopId !== p.stopId ? (
                  <div className="mt-2 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2 text-[var(--texto)]">
                    <p>⚠ {avisoDe[p.stopId]}</p>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        setPendiente(null);
                        setSoltarPegado(false);
                        setMoviendo({ stopId: p.stopId, lat: null, lon: null });
                        setMensaje(`Pica en el mapa dónde va ${p.name}. Se pega al trazado de su sentido y el QR no cambia.`);
                      }}
                      className="mt-1 text-[var(--acero)] underline"
                    >
                      Moverla
                    </button>
                  </div>
                ) : null}

                {corrigiendo?.stopId === p.stopId ? (
                  <div className="mt-2 space-y-2 rounded border border-[var(--linea)] bg-[var(--panel2)] p-2">
                    <fieldset>
                      <legend className="mb-1 text-[var(--muted)]">Sentido de {p.name}</legend>
                      <div className="flex gap-2" role="radiogroup">
                        {(["ida", "vuelta", "ambos"] as Eleccion[]).map((e) => (
                          <label
                            key={e}
                            className={`cursor-pointer rounded border px-2.5 py-1 ${
                              corrigiendo.eleccion === e ? "border-[var(--b-acero)] bg-[var(--t-acero)]" : "border-[var(--linea-tenue)]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`sentido-${p.stopId}`}
                              value={e}
                              checked={corrigiendo.eleccion === e}
                              onChange={() => setCorrigiendo({ ...corrigiendo, eleccion: e })}
                              className="sr-only"
                            />
                            {PALABRA[e]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <label className="mb-1 block text-[var(--muted)]" htmlFor={`msen-${p.stopId}`}>
                        Por qué cambia (opcional)
                      </label>
                      <input
                        id={`msen-${p.stopId}`}
                        value={corrigiendo.motivo}
                        onChange={(e) => setCorrigiendo({ ...corrigiendo, motivo: e.target.value })}
                        placeholder="la vuelta va por otra calle…"
                        className="w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-sm text-[var(--texto)]"
                      />
                    </div>
                    <p className="text-[var(--muted)]">
                      Corregir el sentido no la mueve de calle. Si su lugar queda lejos del trazado nuevo, se te dice y
                      puedes moverla.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado || corrigiendo.eleccion === aEleccion(p.sentido)}
                        onClick={() => void confirmarCorreccion()}
                        className="rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-1.5 text-[var(--acero)] disabled:opacity-50"
                      >
                        Guardar sentido
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrigiendo(null)}
                        className="rounded px-3 py-1.5 text-[var(--muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                {moviendo?.stopId === p.stopId ? (
                  <div className="mt-2 space-y-2 rounded border border-[var(--b-acero)] bg-[var(--panel2)] p-2">
                    {moviendo.lat == null ? (
                      <p className="text-[var(--texto)]">Pica en el mapa dónde va {p.name}.</p>
                    ) : previa?.pegada ? (
                      <p className="text-[var(--texto)]">
                        Va a quedar sobre el trazado de {p.sentido === "vuelta" ? "la vuelta" : "la ida"}, a{" "}
                        {Math.round(previa.pegada.distancia)} m de donde picaste. El QR no cambia.
                      </p>
                    ) : null}
                    {moviendo.lat != null && fuera && (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={soltarPegado} onChange={(e) => setSoltarPegado(e.target.checked)} />
                        Soltar el pegado y dejarla donde piqué
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado || moviendo.lat == null}
                        onClick={() => void confirmarMovida()}
                        className="rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-1.5 text-[var(--acero)] disabled:opacity-50"
                      >
                        Mover aquí
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoviendo(null);
                          capaFantasma.current?.clearLayers();
                        }}
                        className="rounded px-3 py-1.5 text-[var(--muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                {editando?.stopId === p.stopId ? (
                  <div className="mt-2 space-y-2 rounded border border-[var(--linea)] bg-[var(--panel2)] p-2">
                    <div>
                      <label className="mb-1 block text-[var(--muted)]" htmlFor={`nom-${p.stopId}`}>
                        Nombre nuevo
                      </label>
                      <input
                        id={`nom-${p.stopId}`}
                        autoFocus
                        value={editando.nombre}
                        onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        className="w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-sm text-[var(--texto)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[var(--muted)]" htmlFor={`mot-${p.stopId}`}>
                        Por qué cambia (opcional)
                      </label>
                      <input
                        id={`mot-${p.stopId}`}
                        value={editando.motivo}
                        onChange={(e) => setEditando({ ...editando, motivo: e.target.value })}
                        placeholder="obra en la avenida, ajuste de operación…"
                        className="w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-sm text-[var(--texto)]"
                      />
                    </div>
                    <p className="text-[var(--muted)]">
                      No sobrescribe: la versión anterior queda con su fecha y el QR impreso no se
                      toca.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void guardarNombre()}
                        className="rounded border border-[var(--b-acero)] bg-[var(--t-acero)] px-3 py-1.5 text-[var(--acero)]"
                      >
                        Guardar nombre
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="rounded px-3 py-1.5 text-[var(--muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                {retirando?.stopId === p.stopId ? (
                  <div className="mt-2 space-y-2 rounded border border-[var(--b-ambar)] bg-[var(--t-ambar)] p-2">
                    <p className="text-[var(--texto)]">
                      Al retirarla deja de publicarse. No se borra: su historia y su QR se
                      conservan.
                    </p>
                    <div>
                      <label className="mb-1 block text-[var(--muted)]" htmlFor={`ret-${p.stopId}`}>
                        Por qué se retira (opcional)
                      </label>
                      <input
                        id={`ret-${p.stopId}`}
                        autoFocus
                        value={retirando.motivo}
                        onChange={(e) => setRetirando({ ...retirando, motivo: e.target.value })}
                        className="w-full rounded border border-[var(--linea)] bg-transparent px-2 py-1.5 text-sm text-[var(--texto)]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void confirmarRetiro()}
                        className="rounded border border-[var(--b-ambar)] px-3 py-1.5 text-[var(--ambar)]"
                      >
                        Retirar {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRetirando(null)}
                        className="rounded px-3 py-1.5 text-[var(--muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
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
