"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  avanceSobreTrazado,
  proximaLlegada,
  rangoDeLlegada,
  velocidadDelCorredor,
  type MuestraDeAvance,
  type RangoDeLlegada,
} from "@jtel/domain";

/**
 * La app del pasajero.
 *
 * ## Las tres cosas que este archivo existe para no hacer
 *
 * **No manda la ubicación del pasajero a ningún lado.** `watchPosition` corre
 * aquí, la proyección sobre el trazado corre aquí, y al servidor solo se le
 * pide el circuito. No es una promesa de política: es que la petición que la
 * mandaría no existe.
 *
 * **No dibuja un camión donde ya no está.** Las unidades con dato viejo no
 * llegan siquiera: el servidor las filtra. Y si no queda ninguna, el mapa
 * muestra la ruta sin camiones en vez de la última posición conocida — un
 * camión de hace veinte minutos se lee como «va llegando».
 *
 * **No inventa el rango.** El ancho es el piso del circuito y nada más. La
 * varianza de tráfico no está medida, y hasta que la prueba de campo la mida,
 * el rango se queda angosto y honesto.
 */

// ── Lo que baja del servidor ─────────────────────────────────────────────

export interface Forma {
  circuito_id: string;
  nombre: string;
  frecuencia_declarada_min: number;
  /** El color de la ruta. Sale del dato: con más rutas, cada una lleva el suyo. */
  color_hex: string;
  piso_rango_seg: number;
  dato_viejo_seg: number;
  velocidad_declarada_kmh: number;
  horario: { inicio: string; fin: string; zona: string };
  trazados: Array<{ sentido: "ida" | "vuelta"; coordenadas: Array<[number, number]>; largo_m: number }>;
  paradas: Array<{
    id: string;
    nombre: string;
    orden: number;
    sentido: "ida" | "vuelta" | null;
    lat: number;
    lon: number;
  }>;
}

interface UnidadViva {
  id_publico: string;
  lat: number;
  lon: number;
  rumbo: number | null;
  sentido: "ida" | "vuelta" | null;
  antiguedad_seg: number;
}

interface Vivo {
  en_servicio: boolean;
  frecuencia_declarada_min: number;
  unidades: UnidadViva[];
  generado_en: string;
}

/**
 * Cada cuánto se le pregunta al servidor.
 *
 * Atado al TTL del CDN: preguntar más seguido no trae un dato más fresco —el
 * recolector escribe cada 30-60 s— y sí gasta datos que el pasajero paga.
 */
const SONDEO_MS = 15_000;

/** Cuánto se puede alejar el pasajero del trazado y seguir «en el circuito». */
const CORREDOR_METROS = 150;

// ── El componente ────────────────────────────────────────────────────────

export function VistaPasajero({ forma }: { forma: Forma }) {
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [yo, setYo] = useState<{ lat: number; lon: number } | null>(null);
  const [ubicacion, setUbicacion] = useState<"pidiendo" | "ok" | "negada" | "sin-soporte">(
    "pidiendo",
  );
  const [error, setError] = useState(false);

  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaCamiones = useRef<import("leaflet").LayerGroup | null>(null);
  const capaYo = useRef<import("leaflet").LayerGroup | null>(null);

  /*
   * Las muestras de avance por unidad, para medir la velocidad del corredor.
   * En un ref y no en estado: cambian en cada sondeo y no pintan nada por sí
   * solas — meterlas al estado provocaría un re-render por cada camión.
   */
  const anteriores = useRef<Map<string, { avance: number; en: number }>>(new Map());
  const [muestras, setMuestras] = useState<MuestraDeAvance[]>([]);

  // ── Sondeo, en pausa cuando nadie mira ────────────────────────────────

  const sondear = useCallback(async () => {
    try {
      const r = await fetch(`/api/circuitos/${forma.circuito_id}/unidades`);
      if (!r.ok) {
        setError(true);
        return;
      }
      setVivo((await r.json()) as Vivo);
      setError(false);
    } catch {
      setError(true);
    }
  }, [forma.circuito_id]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setInterval> | null = null;

    const arrancar = () => {
      if (temporizador) return;
      void sondear();
      temporizador = setInterval(() => void sondear(), SONDEO_MS);
    };
    const parar = () => {
      if (!temporizador) return;
      clearInterval(temporizador);
      temporizador = null;
    };

    /*
     * En pausa con la pestaña escondida. Sin esto, la app en el bolsillo
     * gasta datos y batería toda la tarde sin que nadie la mire — en el
     * teléfono real del pasajero eso importa más que la frescura.
     */
    const alCambiar = () => (document.hidden ? parar() : arrancar());
    document.addEventListener("visibilitychange", alCambiar);
    alCambiar();

    return () => {
      document.removeEventListener("visibilitychange", alCambiar);
      parar();
    };
  }, [sondear]);

  // ── Dónde está el pasajero. Nunca sale del teléfono. ──────────────────

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setUbicacion("sin-soporte");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setYo({ lat: p.coords.latitude, lon: p.coords.longitude });
        setUbicacion("ok");
      },
      () => setUbicacion("negada"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── El cálculo, todo aquí ─────────────────────────────────────────────

  const trazadoPorSentido = useMemo(() => {
    const m = new Map<string, Array<[number, number]>>();
    for (const t of forma.trazados) m.set(t.sentido, t.coordenadas);
    return m;
  }, [forma.trazados]);

  /* Mide cuánto avanzó cada unidad entre sondeos: de ahí sale la velocidad. */
  useEffect(() => {
    if (!vivo) return;
    const ahora = Date.now();
    const nuevas: MuestraDeAvance[] = [];

    for (const u of vivo.unidades) {
      if (!u.sentido) continue;
      const trazado = trazadoPorSentido.get(u.sentido);
      if (!trazado) continue;
      const a = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, CORREDOR_METROS);
      if (!a) continue;

      const antes = anteriores.current.get(u.id_publico);
      if (antes) {
        const metros = a.avanceMetros - antes.avance;
        const segundos = (ahora - antes.en) / 1000;
        // Solo hacia adelante: un retroceso es ruido de GPS, no un camión en
        // reversa por la avenida.
        if (metros > 0) nuevas.push({ metros, segundos });
      }
      anteriores.current.set(u.id_publico, { avance: a.avanceMetros, en: ahora });
    }

    if (nuevas.length > 0) {
      // Ventana corta: el tráfico de hace media hora no dice nada del de ahora.
      setMuestras((previas) => [...previas, ...nuevas].slice(-12));
    }
  }, [vivo, trazadoPorSentido]);

  const velocidad = useMemo(
    () => velocidadDelCorredor(forma.velocidad_declarada_kmh, muestras),
    [forma.velocidad_declarada_kmh, muestras],
  );

  /* El rango de cada unidad que viene hacia el pasajero, y el más próximo. */
  const llegadas = useMemo(() => {
    if (!vivo || !yo) return [] as Array<{ unidad: UnidadViva; rango: RangoDeLlegada }>;
    const salida: Array<{ unidad: UnidadViva; rango: RangoDeLlegada }> = [];

    for (const u of vivo.unidades) {
      if (!u.sentido) continue; // sin sentido no se sabe si viene o va
      const trazado = trazadoPorSentido.get(u.sentido);
      if (!trazado) continue;

      const dondeVaLaUnidad = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, CORREDOR_METROS);
      const dondeEstoy = avanceSobreTrazado(yo, trazado, CORREDOR_METROS);
      if (!dondeVaLaUnidad || !dondeEstoy) continue;

      const rango = rangoDeLlegada(
        dondeVaLaUnidad.avanceMetros,
        dondeEstoy.avanceMetros,
        velocidad.kmh,
        forma.piso_rango_seg,
      );
      if (rango) salida.push({ unidad: u, rango });
    }
    return salida.sort((a, b) => a.rango.estimadoSeg - b.rango.estimadoSeg);
  }, [vivo, yo, trazadoPorSentido, velocidad.kmh, forma.piso_rango_seg]);

  const proxima = useMemo(() => proximaLlegada(llegadas.map((l) => l.rango)), [llegadas]);

  /*
   * «La de después»: la segunda que llega. Sirve para una decisión concreta —
   * si la primera viene llena o se le va, cuánto falta para la otra.
   */
  const siguiente = useMemo(() => (llegadas.length > 1 ? llegadas[1].rango : null), [llegadas]);

  // ── El mapa ───────────────────────────────────────────────────────────

  useEffect(() => {
    let vivo2 = true;
    void (async () => {
      const leaflet = await import("leaflet");
      if (!vivo2 || !contenedor.current || mapa.current) return;
      L.current = leaflet;

      const m = leaflet.map(contenedor.current, { zoomControl: false, attributionControl: true });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "© OpenStreetMap",
        })
        .addTo(m);

      // El trazado, una vez. No se vuelve a dibujar en cada sondeo.
      const puntos: Array<[number, number]> = [];
      for (const t of forma.trazados) {
        const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
        leaflet
          .polyline(latlngs, {
            // El color de la RUTA sale del dato. La vuelta va del mismo color,
            // más tenue: son el mismo circuito, no dos productos distintos.
            color: forma.color_hex,
            weight: 4,
            opacity: t.sentido === "ida" ? 0.9 : 0.45,
          })
          .addTo(m);
        puntos.push(...latlngs);
      }
      for (const p of forma.paradas) {
        leaflet
          .circleMarker([p.lat, p.lon], {
            radius: 4,
            color: "#ffffff",
            weight: 2,
            fillColor: "#5a6874",
            fillOpacity: 1,
          })
          .addTo(m)
          .bindPopup(p.nombre);
      }

      if (puntos.length > 0) m.fitBounds(leaflet.latLngBounds(puntos), { padding: [24, 24] });
      capaCamiones.current = leaflet.layerGroup().addTo(m);
      capaYo.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
    })();

    return () => {
      vivo2 = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [forma.trazados, forma.paradas, forma.color_hex]);

  /* Los camiones se redibujan en cada sondeo; el trazado no. */
  useEffect(() => {
    const leaflet = L.current;
    const capa = capaCamiones.current;
    if (!leaflet || !capa) return;
    capa.clearLayers();
    if (!vivo) return;

    for (const u of vivo.unidades) {
      const clase = u.sentido ?? "sin-sentido";
      const flecha = u.rumbo === null ? "•" : "▲";
      const giro = u.rumbo === null ? "" : `transform:rotate(${u.rumbo}deg)`;
      leaflet
        .marker([u.lat, u.lon], {
          icon: leaflet.divIcon({
            className: "",
            html: `<div class="camion ${clase}"><span style="${giro}">${flecha}</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
        .addTo(capa);
    }
  }, [vivo]);

  useEffect(() => {
    const leaflet = L.current;
    const capa = capaYo.current;
    if (!leaflet || !capa) return;
    capa.clearLayers();
    if (!yo) return;
    leaflet
      .marker([yo.lat, yo.lon], {
        icon: leaflet.divIcon({ className: "", html: '<div class="yo"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
      })
      .addTo(capa);
  }, [yo]);

  // ── Lo que se lee ─────────────────────────────────────────────────────

  return (
    <main className="envoltura">
      <Respuesta
        forma={forma}
        vivo={vivo}
        proxima={proxima}
        siguiente={siguiente}
        ubicacion={ubicacion}
        velocidad={velocidad}
        error={error}
      />

      <div className="mapa" ref={contenedor} />

      <HiloDeParadas forma={forma} vivo={vivo} yo={yo} />

      <p className="pie">
        Tu ubicación se usa <b>solo en este teléfono</b> para calcular cuánto falta. No se envía a
        ningún servidor.
        <br />
        {forma.nombre} · pasa cada {forma.frecuencia_declarada_min} min declarados
      </p>
    </main>
  );
}

// ── La respuesta de arriba ───────────────────────────────────────────────

/**
 * ## La ley del lenguaje de esta tarjeta
 *
 * **Cuando no hay ubicación en vivo NO es un error, y la app no se disculpa.**
 * Es otro modo de operar: la misma tarjeta se pone gris, el número pasa a ser la
 * frecuencia declarada, y la etiqueta cambia de «En vivo» a «Por horario».
 *
 * Nada de «las unidades no están reportando». Eso expone al operador y **no es
 * asunto del pasajero**: él quiere saber cuándo pasa el camión, no por qué el
 * GPS de alguien más está apagado. Una versión anterior de este archivo decía
 * exactamente eso, y estaba mal.
 *
 * **La barra de acercamiento desaparece en ese modo.** Congelada sería la
 * mentira que la regla existe para prohibir: un camión dibujado avanzando
 * cuando nadie sabe dónde está.
 */
function Respuesta({
  forma,
  vivo,
  proxima,
  siguiente,
  ubicacion,
  velocidad,
  error,
}: {
  forma: Forma;
  vivo: Vivo | null;
  proxima: RangoDeLlegada | null;
  siguiente: RangoDeLlegada | null;
  ubicacion: string;
  velocidad: { kmh: number; origen: "declarada" | "medida" };
  error: boolean;
}) {
  const cadaMin = forma.frecuencia_declarada_min;
  const pisoMin = Math.round(forma.piso_rango_seg / 60);

  /*
   * El modo POR HORARIO. Uno solo para tres causas —sin conexión, fuera de
   * horario, sin unidades con posición— porque para el pasajero las tres
   * significan lo mismo: hoy toca guiarse por la frecuencia. Separarlas sería
   * contarle de quién es la culpa, que es justo lo que no le toca saber.
   */
  const porHorario =
    (error && !vivo) || (vivo !== null && (!vivo.en_servicio || vivo.unidades.length === 0));

  if (!vivo && !error) {
    return (
      <div className="respuesta">
        <div className="cifra">Buscando…</div>
      </div>
    );
  }

  if (porHorario) {
    const fueraDeHorario = vivo !== null && !vivo.en_servicio;
    return (
      <div className="respuesta por-horario">
        <div className="etiqueta gris">Por horario</div>
        <div className="cifra gris">Cada {cadaMin} min</div>
        <p className="lectura">
          {fueraDeHorario ? (
            <>
              El servicio corre de <b>{forma.horario.inicio.slice(0, 5)}</b> a{" "}
              <b>{forma.horario.fin.slice(0, 5)}</b>.
            </>
          ) : (
            <>Frecuencia declarada de la ruta.</>
          )}
        </p>
      </div>
    );
  }

  /* Hay unidades en vivo, pero no sabemos dónde está parado el pasajero. */
  if (!proxima) {
    const cuantos = vivo!.unidades.length;
    return (
      <div className="respuesta">
        <div className="etiqueta verde">En vivo</div>
        <div className="cifra">
          {cuantos} {cuantos === 1 ? "camión" : "camiones"} en ruta
        </div>
        <p className="lectura">
          {ubicacion === "negada" || ubicacion === "sin-soporte" ? (
            <>
              Activa tu ubicación para saber cuánto falta. <b>No sale de tu teléfono.</b>
            </>
          ) : ubicacion === "pidiendo" ? (
            <>Buscando dónde estás…</>
          ) : (
            <>
              Ninguno viene hacia donde estás. Esta ruta pasa cada <b>{cadaMin} min</b>.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="respuesta">
      <div className="etiqueta verde">En vivo</div>
      {proxima.llegando ? (
        <div className="cifra llegando">Llegando</div>
      ) : (
        <div className="cifra">
          {Math.floor(proxima.desdeSeg / 60)}–{Math.ceil(proxima.hastaSeg / 60)} min
        </div>
      )}
      <p className="lectura">
        rango de ±{pisoMin} min ·{" "}
        {velocidad.origen === "medida"
          ? `medido en el corredor: ${velocidad.kmh.toFixed(1)} km/h`
          : `estimado a ${velocidad.kmh.toFixed(1)} km/h declarados`}
      </p>

      <BarraDeAcercamiento rango={proxima} color={forma.color_hex} />

      {siguiente && (
        <div className="despues">
          <span className="k">La de después</span>
          <span className="v">
            {siguiente.llegando ? "Llegando" : `${Math.round(siguiente.estimadoSeg / 60)} min`}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * El camión acercándose al círculo del pasajero, con los metros que faltan.
 *
 * **Es lo que hace entendible el dato sin leerlo.** Un número de minutos es
 * abstracto; ver el camión avanzar hacia uno no lo es. Sale de la misma
 * proyección sobre el trazado que ya calcula el rango — no es una animación
 * decorativa, es el mismo dato dibujado.
 *
 * Solo se dibuja cuando hay posición en vivo. En modo «Por horario» este
 * componente no se monta: una barra congelada afirmaría una distancia que
 * nadie está midiendo.
 */
function BarraDeAcercamiento({ rango, color }: { rango: RangoDeLlegada; color: string }) {
  /*
   * Qué tan lejos arranca la barra. Mil metros es el largo típico entre
   * paradas de este corredor; más allá el camión se queda pegado al extremo y
   * la barra deja de decir nada nuevo, que es honesto: a dos kilómetros lo que
   * importa es el rango, no el dibujo.
   */
  const ALCANCE_M = 1000;
  const avance = Math.max(0, Math.min(1, 1 - rango.metrosDeDistancia / ALCANCE_M));

  return (
    <div className="acercamiento" aria-hidden="true">
      <div className="pista">
        <div className="camion-mini" style={{ left: `${avance * 100}%`, background: color }}>
          ▲
        </div>
        <div className="yo-punto" />
      </div>
      <div className="metros">{rango.metrosDeDistancia} m</div>
    </div>
  );
}

// ── El hilo de paradas ───────────────────────────────────────────────────

function HiloDeParadas({
  forma,
  vivo,
  yo,
}: {
  forma: Forma;
  vivo: Vivo | null;
  yo: { lat: number; lon: number } | null;
}) {
  const paradas = [...forma.paradas].sort((a, b) => a.orden - b.orden);

  if (paradas.length === 0) {
    return (
      <div className="hilo">
        <h2>La ruta</h2>
        <p className="aviso">
          Este circuito todavía <b>no tiene paradas dadas de alta</b>. El mapa de arriba sí muestra
          el recorrido completo y los camiones en vivo — la llegada se calcula sobre el trazado, no
          sobre las paradas, así que no depende de esta lista.
        </p>
      </div>
    );
  }

  /* Dónde cae cada camión entre las paradas, para intercalarlos en el hilo. */
  const trazados = new Map(forma.trazados.map((t) => [t.sentido, t.coordenadas]));
  const avanceDeParada = new Map<string, number>();
  for (const p of paradas) {
    const trazado = trazados.get(p.sentido ?? "ida") ?? forma.trazados[0]?.coordenadas;
    if (!trazado) continue;
    const a = avanceSobreTrazado({ lat: p.lat, lon: p.lon }, trazado, 1_000);
    if (a) avanceDeParada.set(p.id, a.avanceMetros);
  }

  const camiones: Array<{ avance: number; sentido: string }> = [];
  for (const u of vivo?.unidades ?? []) {
    if (!u.sentido) continue;
    const trazado = trazados.get(u.sentido);
    if (!trazado) continue;
    const a = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, 300);
    if (a) camiones.push({ avance: a.avanceMetros, sentido: u.sentido });
  }

  let miAvance: number | null = null;
  if (yo) {
    const trazado = forma.trazados[0]?.coordenadas;
    if (trazado) {
      const a = avanceSobreTrazado(yo, trazado, 300);
      if (a) miAvance = a.avanceMetros;
    }
  }

  return (
    <div className="hilo">
      <h2>La ruta</h2>
      <ol>
        {paradas.map((p, i) => {
          const avance = avanceDeParada.get(p.id);
          const siguiente = avanceDeParada.get(paradas[i + 1]?.id ?? "");
          const entre =
            avance !== undefined && siguiente !== undefined
              ? camiones.filter((c) => c.avance >= avance && c.avance < siguiente)
              : [];
          const cerca =
            miAvance !== null && avance !== undefined && Math.abs(miAvance - avance) < 300;

          return (
            <li key={p.id} className={cerca ? "cerca" : undefined}>
              <div className="nombre">{p.nombre}</div>
              {cerca && <div className="dato">estás aquí</div>}
              {entre.length > 0 && (
                <div className="camion-entre">
                  ▲ {entre.length} {entre.length === 1 ? "camión" : "camiones"} en este tramo
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
