"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTema } from "@/lib/tema";
import { useMiUbicacion } from "@/lib/ubicacion";
import { iniciales, tinte } from "@/lib/color-ruta";
import { arranqueCorto, arranqueLargo } from "@/lib/fecha-arranque";
import {
  avanceSobreTrazado,
  permisoDeRango,
  proximaLlegada,
  rangoDeLlegada,
  velocidadDelCorredor,
  type MuestraDeAvance,
  type PermisoDeRango,
  type RangoDeLlegada,
} from "@jtel/domain";

/**
 * La app del pasajero — estructura del prototipo aprobado del 27 de agosto.
 *
 * Mapa de fondo a pantalla completa, barra flotante, y una hoja que se arrastra:
 * cerrada enseña la llegada, abierta enseña todas las paradas. El 90% de las
 * veces el pasajero solo quiere el número.
 *
 * ## Las tres cosas que este archivo existe para NO hacer
 *
 * **No manda la ubicación del pasajero a ningún lado.** `watchPosition` corre
 * aquí, la proyección sobre el trazado corre aquí, y al servidor solo se le pide
 * el circuito. No es una promesa de política: la petición que la mandaría no
 * existe.
 *
 * **No dibuja un camión donde ya no está.** Las unidades con dato viejo no
 * llegan siquiera — el servidor las filtra— y la barra de acercamiento
 * desaparece en modo «Por horario» en vez de congelarse.
 *
 * **No inventa el rango.** El ancho es el piso del circuito y nada más.
 */

// ── Lo que baja del servidor ─────────────────────────────────────────────

export interface Forma {
  circuito_id: string;
  nombre: string;
  /** `null` cuando el concesionario no la declaró. La app entonces NO promete cadencia. */
  frecuencia_declarada_min: number | null;
  /** El color de la ruta. Sale del dato: con más rutas, cada una lleva el suyo. */
  color_hex: string;
  piso_rango_seg: number;
  dato_viejo_seg: number;
  /**
   * La tolerancia del corredor del circuito, la misma con la que el servidor
   * decidió qué publicar. Llega por la forma en vez de vivir clavada aquí: una
   * copia local que coincide «por ahora» es una divergencia esperando el día
   * que alguien mueva la columna.
   */
  corredor_m: number;
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
  /**
   * Si la posición todavía dice dónde está el camión. Las que NO lo están
   * siguen viniendo —el camión no se fue a ningún lado— pero se pintan
   * apagadas y no entran al cálculo del rango.
   */
  fresco: boolean;
}

interface Vivo {
  /** La escalera ya resuelta por el servidor. La pantalla lee, no deduce. */
  estado: "por_arrancar" | "fuera_de_horario" | "en_vivo" | "por_horario" | "sin_evidencia";
  /** A qué hora abre el circuito, para poder decirlo cuando está cerrado. */
  abre_a: string;
  /**
   * Qué día arranca el servicio. `null` en todo circuito que ya opera — que es
   * lo que la columna guarda, sin traducir.
   */
  arranca_el: string | null;
  /** El rango de llegada sólo se enseña si la velocidad del circuito ya se calibró. */
  rango_activo: boolean;
  /** `null` cuando el concesionario no la declaró. La app entonces NO promete cadencia. */
  frecuencia_declarada_min: number | null;
  unidades: UnidadViva[];
  generado_en: string;
}

/** Atado al TTL del CDN: más seguido no trae dato más fresco y sí gasta datos. */
const SONDEO_MS = 15_000;

/** Cuánto se puede alejar algo del trazado y seguir «en el circuito». */

/** Cuánto camino cubre la barra de acercamiento. Del prototipo: 2.6 km. */
const VENTANA_PISTA_M = 2600;

const IconoBus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm1.5-6H6V6h12v5z" />
  </svg>
);

// ── El componente ────────────────────────────────────────────────────────

export function VistaPasajero({
  forma,
  esVistaPrevia = false,
}: {
  forma: Forma;
  /**
   * El circuito se está enseñando SIN publicar. Se pinta, y no es decoración:
   * una app que se ve idéntica publicada y sin publicar es exactamente cómo
   * alguien acaba creyendo que ya está en la calle.
   */
  esVistaPrevia?: boolean;
}) {
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState(false);

  /*
   * El tema y la ubicación viven en `lib/` desde que el buscador los necesitó
   * igual. **No fue limpieza:** dos copias de «claro por omisión, y la llave se
   * llama así» se separan, y el pasajero vería un tema en la ruta y otro en el
   * buscador. Lo mismo con la ubicación, que además es la que nunca sale del
   * teléfono: un solo lugar es un solo lugar que revisar.
   */
  const { deNoche, alternar } = useTema();
  const yo = useMiUbicacion();

  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaCamiones = useRef<import("leaflet").LayerGroup | null>(null);
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
    let t: ReturnType<typeof setInterval> | null = null;
    const arrancar = () => {
      if (t) return;
      void sondear();
      t = setInterval(() => void sondear(), SONDEO_MS);
    };
    const parar = () => {
      if (t) clearInterval(t);
      t = null;
    };
    /* En pausa con la pestaña escondida: en el bolsillo, la batería y los datos
       del pasajero importan más que la frescura de algo que nadie mira. */
    const alCambiar = () => (document.hidden ? parar() : arrancar());
    document.addEventListener("visibilitychange", alCambiar);
    alCambiar();
    return () => {
      document.removeEventListener("visibilitychange", alCambiar);
      parar();
    };
  }, [sondear]);

  // ── El cálculo ────────────────────────────────────────────────────────

  const trazadoPorSentido = useMemo(() => {
    const m = new Map<string, Array<[number, number]>>();
    for (const t of forma.trazados) m.set(t.sentido, t.coordenadas);
    return m;
  }, [forma.trazados]);

  const principal = forma.trazados[0]?.coordenadas;

  /* Mide cuánto avanzó cada unidad entre sondeos: de ahí sale la velocidad. */
  useEffect(() => {
    if (!vivo) return;
    const ahora = Date.now();
    const nuevas: MuestraDeAvance[] = [];
    for (const u of vivo.unidades) {
      if (!u.sentido) continue;
      const trazado = trazadoPorSentido.get(u.sentido);
      if (!trazado) continue;
      const a = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
      if (!a) continue;
      const antes = anteriores.current.get(u.id_publico);
      if (antes) {
        const metros = a.avanceMetros - antes.avance;
        // Solo hacia adelante: un retroceso es ruido de GPS, no un camión en
        // reversa por la avenida.
        if (metros > 0) nuevas.push({ metros, segundos: (ahora - antes.en) / 1000 });
      }
      anteriores.current.set(u.id_publico, { avance: a.avanceMetros, en: ahora });
    }
    // Ventana corta: el tráfico de hace media hora no dice nada del de ahora.
    if (nuevas.length) setMuestras((p) => [...p, ...nuevas].slice(-12));
  }, [vivo, trazadoPorSentido]);

  const velocidad = useMemo(
    () => velocidadDelCorredor(forma.velocidad_declarada_kmh, muestras),
    [forma.velocidad_declarada_kmh, muestras],
  );

  const llegadas = useMemo(() => {
    if (!vivo || !yo) return [] as RangoDeLlegada[];
    const salida: RangoDeLlegada[] = [];
    for (const u of vivo.unidades) {
      /*
       * El permiso resuelve las dos condiciones de una vez —el interruptor del
       * circuito y la frescura de ESTA posición— y sin él no hay minuto que
       * calcular. Antes aquí vivía un `if (!u.fresco)` suelto, y el interruptor
       * se comprobaba mucho más abajo, al pintar. Que fueran dos comprobaciones
       * separadas y lejos una de otra es lo que dejó al hilo de paradas sin
       * ninguna de las dos.
       */
      const permiso = permisoDeRango({
        rangoActivo: vivo.rango_activo,
        posicionFresca: u.fresco,
        velocidadKmh: velocidad.kmh,
        pisoSegundos: forma.piso_rango_seg,
      });
      if (!permiso) continue;
      if (!u.sentido) continue; // sin sentido no se sabe si viene o va
      const trazado = trazadoPorSentido.get(u.sentido);
      if (!trazado) continue;
      const donde = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
      const miAvance = avanceSobreTrazado(yo, trazado, forma.corredor_m);
      if (!donde || !miAvance) continue;
      const r = rangoDeLlegada(donde.avanceMetros, miAvance.avanceMetros, permiso);
      if (r) salida.push(r);
    }
    return salida.sort((a, b) => a.estimadoSeg - b.estimadoSeg);
  }, [vivo, yo, trazadoPorSentido, velocidad.kmh, forma.piso_rango_seg]);

  const proxima = useMemo(() => proximaLlegada(llegadas), [llegadas]);
  /* «La de después»: si la primera viene llena o se le va, cuánto para la otra. */
  const siguiente = llegadas.length > 1 ? llegadas[1] : null;

  /*
   * EL MODO, y por qué dejó de ser uno solo.
   *
   * El 27 de agosto se colapsaron tres causas —sin conexión, fuera de horario,
   * sin unidades con posición— en un único «Por horario». La razón era buena y
   * sigue siéndolo: la app no le cuenta al pasajero de quién es la culpa, y
   * antes de eso llegó a dibujar camiones donde no los había.
   *
   * Pero resolvió de más. «Por horario» no es un silencio: es una AFIRMACIÓN
   * —«el servicio corre cada N minutos, aguanta»— y se estaba diciendo también
   * cuando la ruta estaba cerrada y cuando no había un solo camión operando.
   * Prometer cadencia donde no hay servicio es la falta de la sección E del
   * Marco: completar un hueco porque la pantalla se ve mejor completa.
   *
   * Lo que lo reemplaza es una escalera de cuatro estados que **resuelve el
   * servidor** y que esta pantalla sólo lee. No vuelve a separar por culpa:
   * separa por lo que el sistema puede AFIRMAR. Cerrado, en vivo, hay servicio
   * pero calló la señal, y no hay servicio — cuatro afirmaciones distintas
   * porque son cuatro verdades distintas.
   *
   * `sin_conexion` es el único que decide el teléfono, y va aparte a propósito:
   * sin respuesta no sabemos nada del servicio, así que no se puede reusar la
   * copia de «sin servicio» —que afirma que no lo hay— ni la de «por horario»
   * —que promete una cadencia sin evidencia—. Es el mismo error de antes visto
   * desde el otro lado.
   */
  type Modo = "cargando" | "sin_conexion" | Vivo["estado"];
  const modo: Modo = error && !vivo ? "sin_conexion" : vivo === null ? "cargando" : vivo.estado;

  /** Ni mapa vivo ni pista ni rango: no hay posición que dibujar. */
  const porHorario = modo !== "en_vivo";
  /**
   * El interruptor del circuito, **sin importar el modo**.
   *
   * Va aparte de `conRango` porque hay una afirmación de tiempo que se hace
   * fuera de «en vivo»: la promesa de POR HORARIO —«verás el tiempo exacto en
   * cuanto haya ubicación»—, que con el interruptor apagado promete algo que
   * nunca va a llegar. `conRango` no la alcanzaba porque exige estar en vivo, y
   * en ese modo no lo estamos.
   */
  const rangoActivo = vivo?.rango_activo ?? false;
  /** El rango existe sólo en vivo, con ubicación del pasajero, y con el interruptor prendido. */
  const conRango = modo === "en_vivo" && rangoActivo;

  // ── El mapa, de fondo ─────────────────────────────────────────────────

  useEffect(() => {
    let montado = true;
    void (async () => {
      const leaflet = await import("leaflet");
      if (!montado || !contenedor.current || mapa.current) return;
      L.current = leaflet;
      const m = leaflet.map(contenedor.current, { zoomControl: false, attributionControl: true });
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        })
        .addTo(m);

      const puntos: Array<[number, number]> = [];
      for (const t of forma.trazados) {
        const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
        leaflet
          .polyline(
            latlngs,
            t.sentido === "ida"
              ? { color: forma.color_hex, weight: 5, opacity: 0.9 }
              : // La vuelta va punteada y más delgada: es el mismo circuito, no
                // otro producto, así que comparte color y se distingue por trazo.
                { color: forma.color_hex, weight: 3.5, opacity: 0.5, dashArray: "7 8" },
          )
          .addTo(m);
        puntos.push(...latlngs);
      }
      for (const p of forma.paradas) {
        leaflet
          .circleMarker([p.lat, p.lon], {
            radius: 4,
            color: "#fff",
            weight: 2,
            fillColor: forma.color_hex,
            fillOpacity: 1,
          })
          .addTo(m)
          .bindPopup(p.nombre);
      }
      if (puntos.length) m.fitBounds(leaflet.latLngBounds(puntos), { padding: [30, 30] });
      capaCamiones.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
    })();
    return () => {
      montado = false;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [forma.trazados, forma.paradas, forma.color_hex]);

  /*
   * Las teselas se tiñen para el tema: de noche, un mapa blanco encandila.
   *
   * El filtro va a la CAPA DE TESELAS, no al contenedor del mapa. Aplicado al
   * contenedor teñía también el trazado y los camiones: el morado de la ruta
   * salía invertido en lavanda y el ámbar dejaba de ser ámbar. O sea, el color
   * que viene del dato dejaba de ser el color que se ve — que es exactamente lo
   * que la regla del color por ruta existe para garantizar.
   */
  useEffect(() => {
    const pane = contenedor.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (!pane) return;
    pane.style.filter = deNoche
      ? "invert(1) hue-rotate(185deg) brightness(.82) contrast(.92) saturate(.7)"
      : "saturate(.72) brightness(1.03)";
  }, [deNoche, vivo]);

  /* Camiones y punto del pasajero: se redibujan por sondeo, el trazado no. */
  useEffect(() => {
    const leaflet = L.current;
    const capa = capaCamiones.current;
    if (!leaflet || !capa) return;
    capa.clearLayers();

    if (yo) {
      leaflet
        .circleMarker([yo.lat, yo.lon], {
          radius: 9,
          color: "#fff",
          weight: 4,
          fillColor: forma.color_hex,
          fillOpacity: 1,
        })
        .addTo(capa);
    }

    if (!vivo) return;

    /*
     * Se dibujan TODAS las que llegan, frescas o no.
     *
     * La vieja se pinta apagada y con cuánto hace que se le vio. No desaparece:
     * el camión no se fue a ningún lado —perdió señal y sigue su recorrido— y
     * un mapa vacío manda al pasajero caminando a otra ruta más lejos por algo
     * que no ocurrió. El servidor ya quitó las que pasaron la ventana de
     * confianza, que son las únicas de las que ya no se puede sostener nada.
     */
    for (const u of vivo.unidades) {
      const min = Math.max(1, Math.round(u.antiguedad_seg / 60));
      const cuerpo = u.fresco
        ? '<div style="width:30px;height:30px;background:var(--ambar);border:3px solid #fff;' +
          'border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,.4);display:flex;align-items:center;' +
          'justify-content:center"><svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#3A2500">' +
          '<path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm1.5-6H6V6h12v5z"/></svg></div>'
        : /*
           * Apagado, más chico y con su antigüedad al lado. Tres señales para
           * lo mismo, porque una sola —sólo el color— no la ve quien trae el
           * teléfono al sol o no distingue bien los tonos.
           */
          '<div style="display:flex;align-items:center;gap:4px">' +
          '<div style="width:22px;height:22px;background:var(--gris);border:2px solid #fff;opacity:.75;' +
          'border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;' +
          'justify-content:center"><svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:#fff">' +
          '<path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm1.5-6H6V6h12v5z"/></svg></div>' +
          `<span style="background:#fff;color:var(--gris);border-radius:9px;padding:1px 6px;font-size:10px;` +
          `font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">hace ${min} min</span>` +
          "</div>";
      leaflet
        .marker([u.lat, u.lon], {
          icon: leaflet.divIcon({
            className: "",
            html: cuerpo,
            iconSize: u.fresco ? [30, 30] : [22, 22],
            iconAnchor: u.fresco ? [15, 15] : [11, 11],
          }),
        })
        .addTo(capa);
    }
  }, [vivo, yo, forma.color_hex]);

  // ── La hoja, que se arrastra ──────────────────────────────────────────

  const arrastre = useRef<{ y0: number; abierta0: boolean } | null>(null);
  const hoja = useRef<HTMLDivElement>(null);

  const alBajar = (e: React.PointerEvent) => {
    arrastre.current = { y0: e.clientY, abierta0: abierta };
    hoja.current?.classList.add("arrastrando");
    /*
     * En try/catch porque `setPointerCapture` LANZA con un pointerId que el
     * navegador no tiene activo, y si lanza aquí se lleva el manejador entero:
     * la hoja deja de abrirse. Capturar el puntero es una mejora —que el dedo
     * pueda salirse del asa sin soltar el arrastre—, no un requisito.
     */
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* sin captura, el arrastre sigue funcionando mientras el dedo no se salga */
    }
  };
  const alSubir = (e: React.PointerEvent) => {
    const a = arrastre.current;
    hoja.current?.classList.remove("arrastrando");
    arrastre.current = null;
    if (!a) return;
    const dy = e.clientY - a.y0;
    /* Un tirón de 40 px decide; menos que eso es un toque, y un toque alterna.
       Sin este umbral, un dedo tembloroso abre y cierra la hoja sin querer. */
    if (Math.abs(dy) < 40) setAbierta(!a.abierta0);
    else setAbierta(dy < 0);
  };

  // ── Lo que se lee ─────────────────────────────────────────────────────

  /*
   * La del sondeo cuando la hay, la de la forma mientras no. Dos fuentes para
   * el mismo número es cómo terminan contradiciéndose: aquí manda la más
   * fresca, y un `null` del sondeo es una respuesta, no un hueco que rellenar.
   */
  const cadaMin = vivo ? vivo.frecuencia_declarada_min : forma.frecuencia_declarada_min;
  /* El horario tal como lo declaró la concesión. Se cita, no se interpreta. */
  const horario = `${forma.horario.inicio.slice(0, 5)} a ${forma.horario.fin.slice(0, 5)}`;
  /*
   * El día del arranque, corto para el titular y largo para la frase. Los dos
   * pueden ser `null` —fecha ilegible— y entonces la pantalla dice que el
   * servicio no ha arrancado SIN decir cuándo: un día inventado manda a alguien
   * a la parada el día que no es, y en la pantalla no se ve nada raro.
   */
  const arrancaCorto = vivo?.arranca_el ? arranqueCorto(vivo.arranca_el) : null;
  const arrancaLargo = vivo?.arranca_el ? arranqueLargo(vivo.arranca_el) : null;
  const pisoMin = Math.max(1, Math.round(forma.piso_rango_seg / 60));
  const nombreApp = forma.nombre;
  const insignia = iniciales(forma.nombre);

  const estiloRuta = {
    "--ruta": forma.color_hex,
    "--ruta-claro": tinte(forma.color_hex, deNoche),
  } as React.CSSProperties;

  return (
    <div className="pantalla" style={estiloRuta} data-modo={modo} data-rango={conRango ? "si" : "no"}>
      <div id="mapa" ref={contenedor} />

      {esVistaPrevia && (
        <div className="franja-previa" role="status">
          Vista previa · circuito sin publicar
        </div>
      )}

      <div className="tope">
        <div className="chapa">
          <span className="cuad">{insignia}</span> {nombreApp}
        </div>
        <button
          className="btn-tema"
          type="button"
          onClick={alternar}
          aria-label={deNoche ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        >
          {deNoche ? "☀" : "☾"}
        </button>
      </div>

      <div className={`hoja${abierta ? " abierta" : ""}`} ref={hoja}>
        <button
          className="asa"
          type="button"
          onPointerDown={alBajar}
          onPointerUp={alSubir}
          aria-expanded={abierta}
          aria-label={abierta ? "Cerrar la lista de paradas" : "Ver todas las paradas"}
        >
          <span />
        </button>

        <div className="tarjeta">
          <div className="tj-cab">
            <span className="insignia">{insignia}</span>
            <span className="nom">{forma.nombre}</span>
          </div>

          {/*
            El VERDE de «Llegando» cuelga de `proxima`, que ahora sólo existe
            con permiso. Antes colgaba de `proxima?.llegando && !porHorario`,
            sin mirar el interruptor: con el rango apagado el titular decía «3
            en ruta» y ese 3 se pintaba verde porque un camión venía cerca — el
            color afirmando lo que la palabra ya se había callado, y encima
            robándole el significado a un dato que no era el suyo.

            Es la tercera vez que pasa (ver la ficha). Por eso no se arregló
            agregando `conRango &&` aquí, que es acordarse otra vez: se arregló
            haciendo que `proxima` no pueda existir sin permiso, y entonces el
            color no tiene de dónde encenderse.
          */}
          <div className={`tj-cuerpo${proxima?.llegando && !porHorario ? " llegando" : ""}`}>
            <div className="eta-fila">
              <div className="eta-1">
                {modo === "por_arrancar" ? (
                  /*
                   * Corto, para rimar con el «Abre 05:00» de fuera de horario:
                   * los dos contestan «¿cuándo?» y los dos caben en el número
                   * grande. La fecha completa va en la frase de abajo, que es
                   * donde hay lugar para leerla.
                   *
                   * Sin fecha legible NO se inventa un día: se dice que no ha
                   * arrancado, que sigue siendo cierto.
                   */
                  <span className="n">
                    {arrancaCorto ? `Arranca ${arrancaCorto}` : "Por arrancar"}
                  </span>
                ) : modo === "fuera_de_horario" ? (
                  <>
                    <span className="n">Abre {vivo?.abre_a}</span>
                  </>
                ) : modo === "sin_evidencia" ? (
                  /*
                   * El cuarto estado NO emite un veredicto sobre el mundo. Se
                   * enseña lo que la concesión declaró; si no declaró
                   * frecuencia, no se inventa ninguna NI se rellena el hueco
                   * con otra cosa: el titular pasa a ser el horario, que
                   * también es declaración suya.
                   */
                  cadaMin !== null ? (
                    <>
                      <span className="n">Cada {cadaMin}</span>
                      <span className="u">min</span>
                    </>
                  ) : (
                    <span className="n">{horario}</span>
                  )
                ) : modo === "sin_conexion" || modo === "cargando" ? (
                  <span className="n">—</span>
                ) : modo === "por_horario" ? (
                  /* Sin frecuencia declarada NO se inventa una cadencia. */
                  cadaMin !== null ? (
                    <>
                      <span className="n">Cada {cadaMin}</span>
                      <span className="u">min</span>
                    </>
                  ) : (
                    <span className="n">En servicio</span>
                  )
                ) : conRango && proxima ? (
                  proxima.llegando ? (
                    <span className="n">Llegando</span>
                  ) : (
                    <>
                      <span className="n">
                        {Math.floor(proxima.desdeSeg / 60)}–{Math.ceil(proxima.hastaSeg / 60)}
                      </span>
                      <span className="u">min</span>
                    </>
                  )
                ) : (
                  <>
                    <span className="n">{vivo?.unidades.length ?? "—"}</span>
                    <span className="u">en ruta</span>
                  </>
                )}
              </div>

              {conRango && proxima && (
                <div className="eta-sig">
                  <div className="k">Después</div>
                  <div className="v">
                    {siguiente
                      ? `${Math.max(0, Math.floor(siguiente.desdeSeg / 60))}–${Math.ceil(siguiente.hastaSeg / 60)} min`
                      : cadaMin !== null
                        ? `~${cadaMin} min`
                        : "—"}
                  </div>
                </div>
              )}
            </div>

            {/* La pista solo existe con posición en vivo Y con el rango prendido. */}
            {conRango && proxima && (
              <>
                <div className="pista">
                  <div className="riel" />
                  <div
                    className="riel-vivo"
                    style={{ width: `${pctPista(proxima.metrosDeDistancia)}%` }}
                  />
                  <div
                    className="bus-pista"
                    style={{ left: `calc(${pctPista(proxima.metrosDeDistancia)}% - 14px)` }}
                  >
                    <IconoBus />
                  </div>
                  <div className="marca-yo" />
                </div>
                <div className="pista-lbl">
                  <span>{distancia(proxima.metrosDeDistancia)}</span>
                  <span>tú</span>
                </div>
              </>
            )}

            <div className="cada">
              {modo === "por_arrancar" ? (
                /*
                 * Lo declarado, y nada más: qué día arranca y en qué horario va
                 * a correr. Ni una palabra sobre unidades — no hay ninguna
                 * porque todavía no las tiene que haber, y contarlo como
                 * ausencia sería enunciar un hueco que no existe.
                 *
                 * La frecuencia se agrega SÓLO si el concesionario la declaró.
                 * Sin ella la frase se cierra en el horario, que es el caso que
                 * va a salir en el arranque y el que tiene que leerse entero.
                 */
                <>
                  El servicio de esta ruta{" "}
                  {arrancaLargo ? <>arranca el {arrancaLargo}</> : <>todavía no arranca</>}, de{" "}
                  {horario}
                  {cadaMin !== null ? <>, cada {cadaMin} min</> : null}.
                </>
              ) : modo === "fuera_de_horario" ? (
                <>Esta ruta no está en servicio ahorita. Abre a las {vivo?.abre_a}.</>
              ) : modo === "sin_evidencia" ? (
                /*
                 * Ni una palabra sobre lo que nuestra telemetría ve o deja de
                 * ver. Decir «no hay unidades en servicio» era emitir un
                 * veredicto que el sistema no puede sostener, y de paso le
                 * contaba al pasajero una falla que le toca al centro de
                 * control del carrier, no a él.
                 *
                 * Cada renglón AGREGA: con frecuencia, el titular la dice y
                 * esta frase pone el horario; sin frecuencia el titular ya ES
                 * el horario, y repetirlo aquí era el mismo defecto que se
                 * acababa de corregir en el rótulo. La atribución no se pierde:
                 * vive en el rótulo de abajo, en los dos casos.
                 */
                cadaMin !== null ? <>Servicio declarado de {horario}.</> : null
              ) : modo === "sin_conexion" ? (
                <>No pudimos consultar el servicio. Revisa tu conexión y vuelve a intentar.</>
              ) : modo === "cargando" ? (
                <>Consultando el servicio…</>
              ) : modo === "por_horario" ? (
                /*
                 * La promesa va aparte del hecho, y sólo si se puede cumplir.
                 *
                 * «Verás el tiempo exacto en cuanto haya ubicación» es una
                 * afirmación de tiempo en futuro, y con el interruptor apagado
                 * es falsa: el pasajero da su ubicación, el circuito pasa a
                 * vivo, y lo que aparece es «3 en ruta». Prometer un número que
                 * el circuito no está autorizado a dar es la misma falta que
                 * darlo, sólo que con un rato de retraso.
                 *
                 * Se mira `rangoActivo` y no `conRango`: aquí el modo es POR
                 * HORARIO, así que `conRango` es falso por construcción y no
                 * distingue un circuito calibrado de uno que no lo está.
                 */
                <>
                  {cadaMin !== null ? (
                    <>El servicio de esta ruta corre cada {cadaMin} minutos.</>
                  ) : (
                    /*
                     * Hay evidencia de servicio y NO hay frecuencia declarada. Se
                     * dice lo primero y se calla lo segundo: inventar una cadencia
                     * para llenar el renglón es exactamente lo que este modo vino
                     * a quitar.
                     */
                    <>Hay unidades corriendo esta ruta.</>
                  )}
                  {/* El espacio va explícito: pegado al texto lo puede comer el formateador. */}
                  {rangoActivo && <>{" "}Verás el tiempo exacto en cuanto haya ubicación.</>}
                </>
              ) : !conRango ? (
                /*
                 * «Calibrado» no es palabra de pasajero: es palabra de quien
                 * afina un instrumento, y le pide a alguien parado en una
                 * banqueta que entienda de qué instrumento hablamos.
                 *
                 * Lo que necesita saber es sólo esto: el camión sí se ve, el
                 * minuto todavía no se lo podemos dar. Sin explicarle por qué
                 * —eso es asunto nuestro— y sin prometerle cuándo.
                 */
                <>
                  Puedes ver dónde vienen los camiones en el mapa. Todavía no podemos decirte en
                  cuántos minutos llega.
                </>
              ) : (
                <>Verás el tiempo exacto en cuanto actives tu ubicación.</>
              )}
            </div>

            {/*
              El rótulo vuelve al cuarto estado, y dice de dónde sale lo que se
              está enseñando: es declaración del concesionario. No repite el
              titular y no habla del GPS — «sin unidades en el corredor» habría
              sido contarle al pasajero lo que nuestra telemetría ve.
            */}
            <div className="fresca">
              <span className="p" />
              <span>
                {modo === "por_arrancar"
                  ? "Arranque declarado por el concesionario"
                  : modo === "fuera_de_horario"
                  ? "Fuera de horario"
                  : modo === "sin_evidencia"
                    ? cadaMin !== null
                      ? "Frecuencia declarada por el concesionario"
                      : "Horario declarado por el concesionario"
                  : modo === "sin_conexion"
                      ? "Sin conexión"
                      : modo === "cargando"
                        ? "Consultando…"
                        : modo === "por_horario"
                          ? "Por horario"
                          : conRango && proxima
                            ? `En vivo · ±${pisoMin} min · ${velocidad.origen === "medida" ? `${velocidad.kmh.toFixed(1)} km/h medidos` : `${velocidad.kmh.toFixed(1)} km/h declarados`}`
                            : conRango
                              ? "En vivo · activa tu ubicación para el tiempo"
                              : "En vivo · sin tiempo estimado"}
              </span>
            </div>
          </div>
        </div>

        <div className="lista">
          {/*
            La liga al buscador vive AQUÍ y no sólo en la portada, y es lo que
            lo hace existir: con un solo circuito publicado la portada redirige
            derecho a esta pantalla y nunca se ve. Un buscador colgado sólo de
            ella no lo abriría ningún pasajero el día del arranque.
          */}
          <Link className="liga-buscar" href="/buscar">
            <span className="lb-t">¿A dónde vas?</span>
            <span className="lb-s">Ve si alguna ruta te sirve</span>
          </Link>

          <h3>Paradas de la ruta</h3>
          {forma.paradas.length === 0 ? (
            <p className="lista-vacia">
              Esta ruta todavía no tiene paradas con nombre. El mapa muestra el recorrido completo
              y los camiones: la llegada se calcula sobre el trazado, no sobre las paradas.
            </p>
          ) : (
            <Hilo
              forma={forma}
              vivo={porHorario ? null : vivo}
              yo={yo}
              principal={principal}
              velocidadKmh={velocidad.kmh}
              pisoSeg={forma.piso_rango_seg}
            />
          )}
          <p className="promesa">
            Tu ubicación se usa solo en este teléfono. No se envía a ningún servidor.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── El hilo de paradas, con los camiones entre ellas ─────────────────────

function Hilo({
  forma,
  vivo,
  yo,
  principal,
  velocidadKmh,
  pisoSeg,
}: {
  forma: Forma;
  vivo: Vivo | null;
  yo: { lat: number; lon: number } | null;
  principal: Array<[number, number]> | undefined;
  velocidadKmh: number;
  pisoSeg: number;
}) {
  const paradas = useMemo(
    () => [...forma.paradas].sort((a, b) => a.orden - b.orden),
    [forma.paradas],
  );

  const avances = useMemo(() => {
    if (!principal) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const p of paradas) {
      const a = avanceSobreTrazado({ lat: p.lat, lon: p.lon }, principal, 1_000);
      if (a) m.set(p.id, a.avanceMetros);
    }
    return m;
  }, [paradas, principal]);

  const miAvance = useMemo(() => {
    if (!yo || !principal) return null;
    return avanceSobreTrazado(yo, principal, forma.corredor_m)?.avanceMetros ?? null;
  }, [yo, principal]);

  /*
   * Los camiones que pueden producir un tiempo en esta lista, cada uno con su
   * permiso a cuestas.
   *
   * Antes era un `number[]` de puros avances, y ahí estaba el defecto: al tirar
   * la unidad se tiraba también su `fresco`, así que el hilo daba minutos desde
   * camiones que el mapa de arriba pintaba grises con «hace N min». Y como
   * tampoco miraba el interruptor, los daba con el rango apagado. Cargar el
   * permiso en vez del número suelto es lo que impide las dos cosas: sin él no
   * se puede llamar a `rangoDeLlegada`.
   *
   * Los camiones se siguen DIBUJANDO todos en el mapa, frescos o no — eso no
   * cambió y no debe cambiar. Lo que se filtra aquí es quién puede afirmar un
   * tiempo, que es otra pregunta.
   */
  const camiones = useMemo(() => {
    const out: Array<{ avance: number; permiso: PermisoDeRango }> = [];
    if (!vivo || !principal) return out;
    for (const u of vivo.unidades) {
      const permiso = permisoDeRango({
        rangoActivo: vivo.rango_activo,
        posicionFresca: u.fresco,
        velocidadKmh,
        pisoSegundos: pisoSeg,
      });
      if (!permiso) continue;
      const a = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, principal, forma.corredor_m);
      if (a) out.push({ avance: a.avanceMetros, permiso });
    }
    return out;
  }, [vivo, principal, forma.corredor_m, velocidadKmh, pisoSeg]);

  /* La parada más cercana al pasajero: la que lleva la pastilla «aquí». */
  const miParada = useMemo(() => {
    if (miAvance === null) return null;
    let mejor: { id: string; d: number } | null = null;
    for (const p of paradas) {
      const a = avances.get(p.id);
      if (a === undefined) continue;
      const d = Math.abs(a - miAvance);
      if (!mejor || d < mejor.d) mejor = { id: p.id, d };
    }
    return mejor && mejor.d < 500 ? mejor.id : null;
  }, [paradas, avances, miAvance]);

  return (
    <div className="hilo">
      {paradas.map((p) => {
        const avance = avances.get(p.id);
        /* El camión más cercano por detrás de ESTA parada. */
        const atras =
          avance === undefined
            ? []
            : camiones.filter((c) => c.avance < avance).sort((a, b) => b.avance - a.avance);
        const r =
          avance !== undefined && atras.length
            ? rangoDeLlegada(0, avance - atras[0].avance, atras[0].permiso)
            : null;

        return (
          <div className={`par${miParada === p.id ? " yo" : ""}`} key={p.id}>
            <div className="b" />
            <div className="n">
              {p.nombre}
              {miParada === p.id && <span className="tu">aquí</span>}
            </div>
            <div className="e">
              {r
                ? r.llegando
                  ? "llegando"
                  : `${Math.floor(r.desdeSeg / 60)}–${Math.ceil(r.hastaSeg / 60)} min`
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Utilidades de presentación ───────────────────────────────────────────

/** Qué tan llena va la pista. A más de la ventana, pegada al extremo. */
function pctPista(metros: number): number {
  return Math.min(100, Math.max(0, (1 - metros / VENTANA_PISTA_M) * 100));
}

/** Metros redondeados a la decena; kilómetros con un decimal pasando los mil. */
function distancia(metros: number): string {
  return metros > 1000 ? `${(metros / 1000).toFixed(1)} km` : `${Math.round(metros / 10) * 10} m`;
}
