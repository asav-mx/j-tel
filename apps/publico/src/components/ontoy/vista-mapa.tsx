"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import { crearCapaDeFondo, type CapaDeFondo } from "@/lib/ontoy/capa-de-fondo";
import { fondoDelMapa } from "@/lib/ontoy/mapa-base";
import { LIENZO } from "@/lib/ontoy/piel-del-mapa";
import { haloParaLaTraza } from "@/lib/ontoy/contraste-de-ruta";
import { pistaDelMapa } from "@/lib/ontoy/pista-del-mapa";
import type { Forma, RutaDeLaCiudad, Sentido, UnidadViva, Vivo } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import { camiDesdeArriba, pasajeroConLinterna, tinoEnLaParada, type MiradaDeTino } from "@/lib/ontoy/munecos";
import { tinoEntero } from "@/lib/ontoy/zoom-de-tino";
import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";
import { TiraDeRutas } from "@/components/ontoy/tira-de-rutas";
import { GlifoIra } from "@/components/ontoy/glifos";

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
  guardadas: Array<{ id: string; ruta: string; nombre: string; lat: number; lon: number; sentido: Sentido | null }>;
  /** Las paradas públicas de la ciudad; los puntitos salen de aquí. */
  paradas: ParadaDeLaCiudad[];
  /** El interruptor de los puntitos de parada. */
  verParadas: boolean;
  alAlternar: (ruta: string) => void;
  alAlternarParadas: () => void;
  alAbrirPanel: () => void;
  alAbrirRuta: (ruta: string, parada?: string) => void;
  /** El buscador flotante: lleva a «Ir a», que es EL buscador de la app. */
  alBuscar: () => void;
  /**
   * **Tocar una parada NO es abrir su ruta.** Son dos verbos distintos y por eso
   * son dos props: `alAbrirRuta` cambia de pantalla (se llega desde Inicio y
   * desde la traza de una ruta), `alTocarParadaDeLaCiudad` abre su hoja encima
   * del mapa sin mover nada más. Antes los puntitos llamaban al primero, y por
   * eso tocar a Tino sacaba al pasajero del mapa.
   */
  alTocarParadaDeLaCiudad: (ruta: string, parada: string, sentido: Sentido | null) => void;
}

/*
 * El lienzo —contra lo que se mide el halo de la traza (8.8c)— ya no se declara
 * aquí: viene de `piel-del-mapa.ts`, que es quien pinta el suelo. Eran dos hex
 * medidos a ojo del mapa teñido; ahora el suelo lo pintamos nosotros y el lienzo
 * **es** el token. Dos valores que describían lo mismo se habrían separado el
 * día que la piel cambiara de tono, y el halo se habría medido contra un fondo
 * que ya no existe.
 */

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
 * fondo son **calles de verdad, dibujadas por nosotros** con datos de
 * OpenStreetMap que viajan en el repo (`lib/ontoy/capa-de-fondo.ts`), o no hay
 * fondo; nunca una ciudad de mentira.
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
  centrarEn = null,
  yo = null,
  alTocarCami,
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
   * **Dónde poner el mapa al abrir**, cuando se llegó por el letrero de una
   * parada: esa parada, cerca y arriba de la hoja. Sin esto el mapa encuadraba
   * la ciudad entera y la parada en la que el pasajero está parado quedaba como
   * un punto perdido —o debajo de su propia hoja—.
   */
  centrarEn?: { lat: number; lon: number } | null;
  /**
   * Dónde está el pasajero, **sólo si ya dio permiso** (el mapa nunca pregunta).
   * Se dibuja como «tú»: en tinta y con su palabra, sin el color de ninguna ruta
   * — el pasajero no es una ruta (8.8c). Recupera el punto que la cara vieja
   * (`vista-pasajero.tsx`) dibujaba y que se perdió en #476 (decisión de ASAV,
   * 22-sep-2026).
   */
  yo?: { lat: number; lon: number; rumbo?: number | null } | null;
  /**
   * Tocar a Cami. Lo maneja quien tiene el trazado cargado —la ruta abierta—
   * porque contar sus próximas paradas necesita la forma, y contarlas sin ella
   * sería inventarlas. En el Mapa de la ciudad no se pasa: ahí tocar a Cami abre
   * su ruta, que es lo que el dato alcanza a sostener.
   */
  alTocarCami?: (u: UnidadViva) => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaRutas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadas = useRef<import("leaflet").LayerGroup | null>(null);
  const capaUnidades = useRef<import("leaflet").LayerGroup | null>(null);
  const capaYo = useRef<import("leaflet").LayerGroup | null>(null);
  const capaParadasCiudad = useRef<import("leaflet").LayerGroup | null>(null);
  /** La capa del fondo, que se vuelve a pintar cuando cambia la piel. */
  const fondo = useRef<CapaDeFondo | null>(null);
  /** El encuadre se hace una vez por apertura del Mapa, no en cada filtro. */
  const yaEncuadro = useRef(false);
  const [listo, setListo] = useState(false);
  /**
   * **El acercamiento de ahorita.** De él depende si una parada se dibuja como
   * Tino entero o como punto — no de en qué vista está el pasajero.
   *
   * Vive en estado y no en una lectura suelta del mapa porque los efectos que
   * dibujan tienen que **volver a correr** cuando cambia: sin eso, acercarse no
   * redibuja nada y las paradas se quedan como estaban.
   */
  const [zoom, setZoom] = useState(13);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;
  const lienzo = deNoche ? LIENZO.noche : LIENZO.dia;

  /*
   * ── La piel del fondo ────────────────────────────────────────────────
   *
   * El fondo ya no se tiñe con un filtro CSS: se **dibuja** con los colores de
   * la piel que toca (`lib/ontoy/piel-del-mapa.ts`). Cambiar de piel es volver a
   * pintar las teselas, no filtrarlas.
   *
   * **`listo` es la dependencia que hace falta, no `deNoche` a secas** — es la
   * misma lección del #375, en su versión nueva: el mapa se crea en un efecto
   * **asíncrono**, así que la primera vez que esto corre la capa todavía no
   * existe. Sin `listo` el efecto se sale, no vuelve a correr porque sus
   * dependencias no cambian, y el mapa se queda con la piel con la que nació:
   * alternar el tema una vez no lo arreglaría, dos sí, y eso es exactamente el
   * defecto que se veía en el buscador.
   */
  useEffect(() => {
    if (!listo) return;
    fondo.current?.vestir(deNoche);
  }, [deNoche, listo]);

  // ── El mapa, una vez ───────────────────────────────────────────────────
  useEffect(() => {
    let montado = true;
    void (async () => {
      const leaflet = await import("leaflet");
      /*
       * Las dos esperas van ANTES de crear el mapa, y eso importa: si una
       * quedara en medio, un desmontaje durante la espera dejaría un mapa de
       * Leaflet creado sin que nadie lo pudiera cerrar —la limpieza mira
       * `mapa.current`, que todavía no existiría— y su DOM se quedaría pegado al
       * contenedor.
       */
      const capaDeFondo = await crearCapaDeFondo(leaflet, deNoche);
      if (!montado || !contenedor.current || mapa.current) return;
      L.current = leaflet;
      /*
       * **El mapa no se puede salir del mapa.** El recorte cubre Juárez, El Paso
       * y un margen; más allá no hay nada que dibujar, y un vacío de borde recto
       * no se lee como «hasta aquí llega el recorte» sino como una app rota. El
       * piso de zoom impide llegar al borde alejando y los límites, arrastrando.
       * Los dos números salen del archivo, no de aquí (`mapa-base.ts`).
       */
      const alcance = fondoDelMapa();
      const m = leaflet.map(contenedor.current, {
        zoomControl: false,
        attributionControl: true,
        minZoom: alcance.zoomMinimo,
        maxBounds: leaflet.latLngBounds(
          [alcance.limites.sur, alcance.limites.oeste],
          [alcance.limites.norte, alcance.limites.este],
        ),
      });
      // El crédito arriba a la derecha, bajo el selector de sentido: abajo se enciman la pista
      // y las fichas de ruta, que crecen con el contenido (ver `ontoy.css`).
      m.attributionControl.setPosition("topright");
      /*
       * El fondo: nuestro archivo del mapa, dibujado con la piel de Ontoy. Todo
       * lo que hay que saber de él vive en `lib/ontoy/capa-de-fondo.ts` —
       * incluido por qué seguimos en Leaflet y no en MapLibre.
       */
      fondo.current = capaDeFondo;
      capaDeFondo.capa.addTo(m);
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
      /*
       * `zoomend` y no `zoom`: el segundo dispara en cada cuadro de la
       * animación, y redibujar treinta marcadores en cada uno se siente como
       * que el mapa se traba. Al terminar el gesto basta — el cambio de Tino a
       * punto pasa una vez, cuando el acercamiento ya se decidió.
       */
      m.on("zoomend", () => setZoom(m.getZoom()));
      setZoom(m.getZoom());
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

    /*
     * **Tino en cada parada** (§9, escalón 2), en vez del punto de antes.
     *
     * Su mirada es señal y no adorno: mira **de lado** —«de allá viene»— sólo
     * cuando hay una unidad fresca en este sentido, y al frente cuando no la
     * hay. Sin dato no se le pone cara de que viene algo.
     */
    const vieneAlguien = (vivo?.unidades ?? []).some((u) => u.sentido === sentido && u.fresco);
    const mirada: MiradaDeTino = vieneAlguien ? "de-lado" : "al-frente";

    for (const p of forma.paradas) {
      if (p.sentido !== null && p.sentido !== sentido) continue;
      const abierta = p.id === paradaAbierta;

      /*
       * **La misma regla del acercamiento vale aquí.** Una ruta abierta no es
       * sinónimo de estar cerca: Oasis–Centro tiene 17 paradas a 667 m, y
       * viéndola entera de punta a punta caben en la pantalla con 20 px entre
       * una y otra. Diecisiete muñecos encimados tapan el trazado que se vino a
       * mirar.
       *
       * **La parada abierta es la excepción**: se dibuja entera aunque esté
       * lejos, porque es la única de la que el pasajero está preguntando algo y
       * lo que marca es cuál está mirando.
       */
      if (!abierta && !tinoEntero(zoom)) {
        leaflet
          .circleMarker([p.lat, p.lon], {
            radius: 4.5,
            color: lienzo,
            weight: 2,
            fillColor: forma.color_hex,
            fillOpacity: 1,
          })
          .on("click", () => alTocarParada(p.id))
          .addTo(capaParadas.current);
        continue;
      }

      const icono = leaflet.divIcon({
        className: `ontoy-tino-icono${abierta ? " abierta" : ""}`,
        html: tinoEnLaParada({ color: forma.color_hex, mirada }),
        /*
         * 44 px de toque, como Cami. El ancla cae **abajo del centro** porque
         * Tino es un poste: lo que marca la parada es su base, no su cabeza.
         */
        iconSize: [44, 44],
        iconAnchor: [22, 36],
      });
      leaflet
        .marker([p.lat, p.lon], { icon: icono, keyboard: false })
        // El nombre acompaña al color siempre (8.8c): el marcador se anuncia con él.
        .on("click", () => alTocarParada(p.id))
        .addTo(capaParadas.current);
    }
  }, [listo, forma, sentido, paradaAbierta, lienzo, alTocarParada, vivo, ciudad, zoom]);

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
      const icono = leaflet.divIcon({
        className: "ontoy-cami-icono",
        html: camiDesdeArriba({
          color: forma.color_hex,
          rumbo: u.rumbo,
          fresco: u.fresco,
          economico: u.economico,
          edad: haceNMinutos(u.antiguedad_seg),
        }),
        /*
         * **44 px, y no es decoración: es el área de toque.**
         *
         * Con `iconSize: [0, 0]` —lo que este mapa usaba— el `div` del marcador
         * mide cero y el dibujo se le sale por encima. Se VE, pero no hay nada
         * que tocar: medido en el navegador, 0 px de ancho. Daba igual mientras
         * tocar una unidad no hacía nada; con la hoja de Cami, la función entera
         * quedaba fuera del alcance de un dedo.
         *
         * 44 es el mínimo del estándar, y es lo que un pulgar acierta de pie en
         * una banqueta.
         */
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      leaflet
        .marker([u.lat, u.lon], { icon: icono, keyboard: false })
        // Tocar a Cami abre sus próximas paradas, contadas desde donde va.
        .on("click", () => alTocarCami?.(u))
        .addTo(capaUnidades.current);
    }
  }, [listo, forma, vivo, sentido, alTocarCami]);

  // ── «tú»: dónde está el pasajero, si ya dio permiso ─────────────────────
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaYo.current) return;
    capaYo.current.clearLayers();
    if (!yo) return;
    const icono = leaflet.divIcon({
      className: "ontoy-tu-icono",
      /*
       * **El pasajero**, no un punto (handoff §1: «"Tú estás aquí" = el
       * pasajero»; Ontoy no señala datos en vivo).
       *
       * La linterna sale **sólo con rumbo medido**. `coords.heading` viene nulo
       * casi siempre —un teléfono quieto no tiene rumbo—, y un cono al norte por
       * omisión mandaría a alguien a caminar hacia el lado equivocado.
       */
      html: pasajeroConLinterna(yo.rumbo ?? null),
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
      /*
       * **Las dos vías, siempre** (ASAV, 25-sep: «como la lámina»).
       *
       * Aquí había un `if (t.sentido !== "ida") continue`, con la razón de que
       * «ida y vuelta suelen compartir calle». Suelen, no siempre: donde no la
       * comparten, el mapa de la ciudad enseñaba la ida y callaba la vuelta. Y
       * las PARADAS sí se dibujaban de los dos sentidos, así que las de regreso
       * que caen en otra calle quedaban flotando lejos de cualquier línea — un
       * Páris sin ruta que lo explique.
       *
       * Donde comparten calle, la vuelta cae exacta encima de la ida con el mismo
       * color, y no se ve doble. Donde no, se ven las dos. Es lo que la ruta hace
       * en la calle.
       */
      for (const t of r.trazados) {
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
   * **La parada del letrero, a la vista**, una vez.
   *
   * Cerca (zoom 16, Páris entero) y **en la franja de mapa que queda libre**
   * entre la pila de arriba y la hoja: con la hoja a media altura y el
   * buscador, la tira y los controles arriba, el centro del mapa cae debajo de
   * la hoja. Las dos orillas se MIDEN del DOM y no se escriben: la pila cambia
   * cuando alguien le agrega algo, y la hoja tiene tres alturas.
   *
   * Marca `yaEncuadro` para que el encuadre de la ciudad entera no lo pise.
   */
  const yaCentro = useRef<string | null>(null);
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m || !centrarEn || !contenedor.current) return;
    const llave = `${centrarEn.lat},${centrarEn.lon}`;
    if (yaCentro.current === llave) return;
    yaCentro.current = llave;
    yaEncuadro.current = true;
    const cuadro = requestAnimationFrame(() => {
      const cont = contenedor.current?.getBoundingClientRect();
      if (!cont) return;
      const pila = contenedor.current?.parentElement?.querySelector(".ontoy-ctrl-mapa")?.getBoundingClientRect();
      const hoja = document.querySelector(".ontoy-hoja")?.getBoundingClientRect();
      const arriba = pila ? pila.bottom : cont.top;
      const abajo = hoja ? Math.min(hoja.top, cont.bottom) : cont.bottom;
      const objetivo = (arriba + abajo) / 2;
      const centro = cont.top + cont.height / 2;
      m.setView([centrarEn.lat, centrarEn.lon], 16, { animate: false });
      m.panBy([0, centro - objetivo], { animate: false });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [listo, centrarEn]);

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
      /*
       * **Tino entero o punto, según el ACERCAMIENTO** (§9: «zoom lejos: Tino →
       * punto del color de la ruta»).
       *
       * La primera versión de esto preguntaba «¿hay una ruta abierta?» en vez
       * de «¿qué tan cerca estoy?» —lo escribí yo en el #566— y el resultado era
       * que en la vista general las paradas se quedaban como puntos **aunque el
       * pasajero se acercara al máximo**, con dos paradas en pantalla. La regla
       * del handoff nunca habló de vistas: habla de zoom.
       *
       * El umbral y de dónde sale, en `zoom-de-tino.ts`.
       */
      const c = color.get(p.ruta) ?? lienzo;
      if (tinoEntero(zoom)) {
        const icono = leaflet.divIcon({
          className: "ontoy-tino-icono",
          html: tinoEnLaParada({ color: c, mirada: "al-frente" }),
          iconSize: [44, 44],
          iconAnchor: [22, 36],
        });
        leaflet
          .marker([p.lat, p.lon], { icon: icono, keyboard: false })
          .on("click", () => ciudad.alTocarParadaDeLaCiudad(p.ruta, p.id, p.sentido ?? null))
          .addTo(capaParadasCiudad.current);
      } else {
        leaflet
          .circleMarker([p.lat, p.lon], {
            radius: 4.5,
            color: lienzo,
            weight: 2,
            fillColor: c,
            fillOpacity: 1,
          })
          .on("click", () => ciudad.alTocarParadaDeLaCiudad(p.ruta, p.id, p.sentido ?? null))
          .addTo(capaParadasCiudad.current);
      }
    }
  }, [listo, rutas, lienzo, prendidasClave, ciudad?.verParadas, ciudad?.paradas, !!ciudad, zoom]);

  // Tus paradas guardadas, con su estrella en el nombre.
  useEffect(() => {
    const leaflet = L.current;
    if (!listo || !leaflet || !capaParadas.current || !ciudad) return;
    capaParadas.current.clearLayers();
    for (const p of ciudad.guardadas) {
      const color = rutas.find((r) => r.circuito_id === p.ruta)?.color_hex ?? "#22282e";
      /*
       * Las guardadas SÍ llevan a Tino entero aunque estemos en la ciudad: son
       * pocas —las que el pasajero escogió— y son lo que viene a buscar.
       */
      const icono = leaflet.divIcon({
        className: "ontoy-tino-icono",
        html: tinoEnLaParada({ color, mirada: "al-frente", guardada: true }),
        iconSize: [44, 44],
        iconAnchor: [22, 36],
      });
      leaflet
        .marker([p.lat, p.lon], { icon: icono, keyboard: false })
        .bindTooltip(`★ ${p.nombre}`, { direction: "top", opacity: 0.95 })
        .on("click", () => ciudad.alTocarParadaDeLaCiudad(p.ruta, p.id, p.sentido ?? null))
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
        const icono = leaflet.divIcon({
          className: "ontoy-cami-icono",
          html: camiDesdeArriba({
            color,
            rumbo: u.rumbo,
            fresco: u.fresco,
            economico: u.economico,
            edad: haceNMinutos(u.antiguedad_seg),
          }),
          // El mismo área de toque de 44 px: ver el porqué en la ruta abierta.
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        leaflet
          .marker([u.lat, u.lon], { icon: icono, keyboard: false })
          /*
           * En la ciudad, tocar a Cami **abre su ruta**, no su hoja: desde aquí
           * no hay trazado cargado con el que contar paradas, y contarlas sin él
           * sería inventarlas. La hoja de Cami vive en la ruta abierta, que es
           * donde el dato alcanza.
           */
          .on("click", () => ciudad.alAbrirRuta(ruta))
          .addTo(capaUnidades.current);
      }
    }
  }, [listo, ciudad, rutas]);

  const sentidos: Sentido[] = ["ida", "vuelta"];
  // Sólo se invita a tocar paradas que existen en el sentido elegido.
  const pista = pistaDelMapa(forma, enfocada, sentido);

  return (
    /*
     * `ontoy-mapa-ciudad` acomoda la pila de arriba —el buscador, la tira, los
     * controles, el aviso de red y los créditos— sólo en la ciudad: una ruta
     * abierta tiene su cabecera, no lleva buscador ni tira, y bajar lo demás ahí
     * dejaría un hueco sin razón.
     */
    <div className={`ontoy-mapa${ciudad ? " ontoy-mapa-ciudad" : ""}`}>
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
          {/*
            * **El buscador flotante** (lámina `2-mapa/01`, y el prototipo).
            *
            * Parece un campo pero es un BOTÓN, y así lo tiene el prototipo:
            * `onClick={irBuscar}` → la pantalla «Ir a». No se escribe aquí,
            * porque «Ir a» ya es el buscador de la app (versión 1: «Ir a» es
            * sólo un buscador) y dos buscadores que busquen distinto serían
            * dos respuestas a la misma pregunta.
            *
            * Por eso es un `<button>` y no un `<input>`: un lector de pantalla
            * tiene que anunciar «botón, busca una ruta o una parada» y no un
            * campo donde escribir que al tocarlo te saca de la pantalla.
            */}
          <button type="button" className="ontoy-buscador-flotante" onClick={ciudad.alBuscar}>
            <GlifoIra tamano={28} />
            <span>Busca una ruta o una parada</span>
          </button>

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
