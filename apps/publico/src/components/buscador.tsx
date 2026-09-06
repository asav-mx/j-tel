"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  circuitoQueSirve,
  tramoDelTrazado,
  type MotivoDeNoServir,
  type ResultadoDeBusqueda,
} from "@jtel/domain";
import { useTema } from "@/lib/tema";
import { useMiUbicacion } from "@/lib/ubicacion";
import { tinte } from "@/lib/color-ruta";
import {
  aPie,
  distancia,
  porQueNo,
  TITULARES,
  tituloDelNo,
  tocaDecirQueCrecemos,
} from "@/lib/decir-el-no";
import {
  emparejarLugares,
  type ParadaBuscable,
  type RutaBuscable,
  type Sugerencia,
} from "@/lib/buscar-lugar";
import type { SalidaDelBuscador } from "@/lib/salida-del-buscador";
import { useTinteDelMapa } from "@/lib/tinte-del-mapa";

/**
 * «¿A dónde vas?» — el buscador honesto.
 *
 * ## Las tres cosas que esta pantalla existe para NO hacer
 *
 * **No manda a ningún lado dónde está ni a dónde va el pasajero.** El destino
 * dice de una persona todavía más que su ubicación actual —su casa, su trabajo,
 * un hospital—, y las dos se quedan aquí. El emparejamiento por nombre corre
 * contra las paradas que ya bajaron con la forma, y la medición corre en el
 * dominio, en este mismo teléfono. No es una promesa de política: la petición
 * que los mandaría no existe.
 *
 * **No dice cuántos minutos.** Un tiempo estimado es una afirmación de tiempo, y
 * quién puede hacerla la gobierna el interruptor del rango del circuito, que
 * vive en el otro endpoint y que aquí ni siquiera se consulta. Esta pantalla
 * habla en METROS y en KILÓMETROS, que es lo que midió sobre el trazado. Entrar
 * un minuto por esta puerta sería la quinta fuga del mismo interruptor.
 *
 * **No emite un veredicto sobre la ciudad.** Un «no» de aquí dice que ninguna
 * de las rutas PUBLICADAS pasa cerca, nunca que no hay cómo llegar. Es la misma
 * frontera que separó `sin_servicio` de `sin_evidencia`: que no veamos algo no
 * autoriza a afirmar que no está. Por eso el mapa de cobertura está siempre
 * puesto y no aparece sólo al fallar — enseñar el hueco es más honesto que
 * juzgarlo.
 *
 * ## Y el límite se declara
 *
 * Esto empareja nombres de parada, no direcciones. Se dice en pantalla, en vez
 * de dejar que el pasajero crea que escribió mal. Ver `lib/buscar-lugar.ts`.
 */

// ── Lo que baja del servidor ─────────────────────────────────────────────

export interface CircuitoParaBuscador {
  slug: string;
  nombre: string;
  color_hex: string;
  trazados: Array<{ sentido: "ida" | "vuelta"; coordenadas: Array<[number, number]> }>;
  paradas: Array<{ id: string; nombre: string; lat: number; lon: number }>;
}

interface Punto {
  lat: number;
  lon: number;
  /** Cómo se nombra en pantalla. Nunca se inventa: o es una parada, o es «el punto que picaste». */
  etiqueta: string;
}

type Respuesta = { circuito: CircuitoParaBuscador; resultado: ResultadoDeBusqueda };

// ── El componente ────────────────────────────────────────────────────────

export function Buscador({
  circuitos,
  salida,
}: {
  circuitos: CircuitoParaBuscador[];
  /**
   * A dónde se sale de aquí. **La resuelve el servidor**, que es quien tiene la
   * lista de lo publicado para cotejar el `desde` — ver `salida-del-buscador.ts`.
   */
  salida: SalidaDelBuscador;
}) {
  const { deNoche, alternar } = useTema();
  const yo = useMiUbicacion();

  const [consulta, setConsulta] = useState("");
  /*
   * Lo que ya se escogió. Sin esto, escoger «Terminal Norte» dejaba el nombre
   * en el campo, y el campo volvía a emparejarlo: la sugerencia se quedaba
   * abajo repitiendo palabra por palabra lo que el campo ya decía. Es la misma
   * falta que se corrigió entre el titular y la frase de la vista de la ruta —
   * cada renglón agrega, o no va.
   */
  const [escogido, setEscogido] = useState<string | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [origenPicado, setOrigenPicado] = useState<Punto | null>(null);
  const [picando, setPicando] = useState<"origen" | "destino" | null>(null);

  const contenedor = useRef<HTMLDivElement>(null);
  /*
   * El mapa se crea en un efecto asíncrono, así que «ya hay mapa» es un HECHO
   * QUE OCURRE DESPUÉS del primer render — y hay efectos que dependen de él.
   * Como referencia no serviría: una referencia no vuelve a correr nada.
   */
  const [mapaListo, setMapaListo] = useState(false);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const capaViaje = useRef<import("leaflet").LayerGroup | null>(null);
  /* El manejador del clic lee estado, y Leaflet lo registra una sola vez: sin
     esta referencia se quedaría con el `picando` del primer render. */
  const alPicar = useRef<(lat: number, lon: number) => void>(() => {});

  /*
   * De dónde sale el pasajero: lo que picó manda sobre su ubicación.
   *
   * Sin permiso de ubicación la pantalla NO se bloquea ni insiste: pide que
   * pique también de dónde sale, y contesta igual de bien. Una app de calle que
   * exige un permiso para servir es una app que no sirve.
   */
  const origen: Punto | null =
    origenPicado ?? (yo ? { ...yo, etiqueta: "donde estás" } : null);

  // ── El emparejamiento por nombre ──────────────────────────────────────

  const paradasBuscables = useMemo<ParadaBuscable[]>(
    () =>
      circuitos.flatMap((c) =>
        c.paradas.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          lat: p.lat,
          lon: p.lon,
          circuitoSlug: c.slug,
          circuitoNombre: c.nombre,
        })),
      ),
    [circuitos],
  );

  const rutasBuscables = useMemo<RutaBuscable[]>(
    () => circuitos.map((c) => ({ slug: c.slug, nombre: c.nombre })),
    [circuitos],
  );

  const { sugerencias, omitidas } = useMemo(
    () =>
      consulta === escogido
        ? { sugerencias: [], omitidas: 0 }
        : emparejarLugares(consulta, paradasBuscables, rutasBuscables),
    [consulta, escogido, paradasBuscables, rutasBuscables],
  );

  // ── La medición ───────────────────────────────────────────────────────

  const respuestas = useMemo<Respuesta[] | null>(() => {
    if (!origen || !destino) return null;
    return circuitos.map((circuito) => ({
      circuito,
      resultado: circuitoQueSirve(origen, destino, circuito.trazados),
    }));
  }, [origen, destino, circuitos]);

  /* Las que sirven, la de menos camino a bordo primero. */
  const sirven = useMemo(() => {
    if (!respuestas) return [];
    return respuestas
      .filter((r): r is Respuesta & { resultado: Extract<ResultadoDeBusqueda, { sirve: true }> } =>
        r.resultado.sirve,
      )
      .sort((a, b) => a.resultado.recorridoMetros - b.resultado.recorridoMetros);
  }, [respuestas]);

  const mejor = sirven[0] ?? null;

  // ── El mapa: la cobertura, siempre puesta ─────────────────────────────

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

      /*
       * TODOS los trazados publicados, a resolución completa. **Esto ES el mapa
       * de cobertura**: lo que la app cubre hoy, dibujado, en vez de una frase
       * que el pasajero tenga que creer.
       *
       * ⚠ El trazado no se simplifica —a resolución burda corta esquinas y la
       * medición cae en el lugar equivocado—, así que esta pantalla baja la
       * geometría completa de cada circuito publicado. Con los de hoy son
       * decenas de KB y no hay problema. **Con veinte circuitos deja de
       * haberlo**, y entonces la salida NO es simplificar esta copia —dos
       * geometrías del mismo circuito en el mismo archivo se acaban usando la
       * equivocada— sino servir una geometría de dibujo aparte, por su propio
       * camino, que ningún cálculo pueda alcanzar.
       */
      const puntos: Array<[number, number]> = [];
      for (const c of circuitos) {
        for (const t of c.trazados) {
          const latlngs = t.coordenadas.map(([lon, lat]) => [lat, lon] as [number, number]);
          leaflet
            .polyline(
              latlngs,
              t.sentido === "ida"
                ? { color: c.color_hex, weight: 4, opacity: 0.75 }
                : { color: c.color_hex, weight: 3, opacity: 0.4, dashArray: "7 8" },
            )
            .addTo(m);
          puntos.push(...latlngs);
        }
      }
      if (puntos.length) m.fitBounds(leaflet.latLngBounds(puntos), { padding: [26, 26] });
      else m.setView([31.7, -106.42], 12);

      capaViaje.current = leaflet.layerGroup().addTo(m);
      m.on("click", (e) => alPicar.current(e.latlng.lat, e.latlng.lng));
      mapa.current = m;
      setMapaListo(true);
    })();
    return () => {
      montado = false;
      mapa.current?.remove();
      mapa.current = null;
      setMapaListo(false);
    };
  }, [circuitos]);

  /* El mismo teñido que la vista de la ruta, y ahora literalmente el mismo: una
     sola copia en `lib/`. Ver ahí por qué depende de que YA HAYA MAPA. */
  useTinteDelMapa(contenedor, deNoche, mapaListo);

  useEffect(() => {
    alPicar.current = (lat: number, lon: number) => {
      if (picando === "destino") {
        setDestino({ lat, lon, etiqueta: "el punto que picaste" });
        setConsulta("");
        setEscogido(null);
      } else if (picando === "origen") {
        setOrigenPicado({ lat, lon, etiqueta: "el punto que picaste" });
      }
      setPicando(null);
    };
  }, [picando]);

  /* Los dos extremos y —cuando hay viaje— el tramo que va a bordo. */
  useEffect(() => {
    const leaflet = L.current;
    const capa = capaViaje.current;
    if (!leaflet || !capa) return;
    capa.clearLayers();

    const marca = (p: Punto, clase: string, titulo: string) =>
      leaflet
        .marker([p.lat, p.lon], {
          icon: leaflet.divIcon({ className: "", html: `<div class="${clase}"></div>` , iconSize: [18, 18], iconAnchor: [9, 9] }),
          title: titulo,
        })
        .addTo(capa);

    if (origen) marca(origen, "pin-origen", "De donde sales");
    if (destino) marca(destino, "pin-destino", "A donde vas");

    if (mejor) {
      const t = mejor.circuito.trazados.find((x) => x.sentido === mejor.resultado.sentido);
      if (t) {
        const tramo = tramoDelTrazado(
          t.coordenadas,
          mejor.resultado.subir.avanceMetros,
          mejor.resultado.bajar.avanceMetros,
        );
        if (tramo.length >= 2) {
          leaflet
            .polyline(
              tramo.map(([lon, lat]) => [lat, lon] as [number, number]),
              { color: mejor.circuito.color_hex, weight: 8, opacity: 1 },
            )
            .addTo(capa);
        }
      }
      const { subir, bajar } = mejor.resultado;
      marca({ ...subir, etiqueta: "" }, "pin-subir", "Aquí te subes");
      marca({ ...bajar, etiqueta: "" }, "pin-bajar", "Aquí te bajas");
    }

    /* Encuadre al viaje cuando lo hay: el recorrido completo no dice nada de él. */
    if (mejor && origen && destino && mapa.current) {
      mapa.current.fitBounds(
        leaflet.latLngBounds([
          [origen.lat, origen.lon],
          [destino.lat, destino.lon],
          [mejor.resultado.subir.lat, mejor.resultado.subir.lon],
          [mejor.resultado.bajar.lat, mejor.resultado.bajar.lon],
        ]),
        { padding: [40, 40] },
      );
    }
  }, [origen, destino, mejor]);

  // ── Lo que se lee ─────────────────────────────────────────────────────

  const escoger = (s: Sugerencia) => {
    if (s.tipo === "parada") {
      setDestino({ lat: s.lat, lon: s.lon, etiqueta: s.nombre });
      setConsulta(s.nombre);
      setEscogido(s.nombre);
    }
  };

  return (
    <div className="busc" data-picando={picando ?? "no"}>
      <div className="busc-mapa">
        <div id="mapa" ref={contenedor} />
        <div className="tope">
          {/*
            LA SALIDA, y es el único control de esta pantalla que no se puede
            omitir. El manifiesto declara `display: "standalone"`: instalada en
            la pantalla de inicio no hay botón de atrás del navegador, así que
            sin esto el buscador es una puerta sin salida — no una incomodidad.

            Es una liga de verdad y NUNCA `history.back()`: quien abre esto de
            frío no tiene historia, y ahí el botón no haría nada. Un control que
            no hace nada es peor que ninguno, porque el que lo pica ya se creyó
            que hay salida.

            `<a>` y no `<Link>`, como las otras ligas de ruta de esta pantalla:
            `<Link>` prefetchearía la página de la ruta en cuanto el botón entra
            a la vista —y aquí está siempre—, y eso se paga en datos de un
            teléfono que los tiene contados, aunque el pasajero nunca lo pique.

            Enseña sólo la flecha. Arriba a la izquierda ya significa «regresar»
            en cualquier teléfono, y el ancho que ahorra lo gana el nombre de la
            ruta. El destino lo dice el nombre accesible, que es lo que lee
            quien no ve el dibujo.
          */}
          <a className="btn-salida" href={salida.href} aria-label={salida.etiqueta}>
            <span aria-hidden="true">←</span>
          </a>
          <div className="chapa">
            <span className="cuad">¿?</span>
            {/* En su propio `span` para que pueda recortarse con puntos
                suspensivos: un texto suelto dentro de un flex se corta a la
                mitad de una letra, y eso se lee como pantalla rota. */}
            <span className="chapa-t">¿A dónde vas?</span>
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
        {picando && (
          <div className="busc-picando" role="status">
            Pica en el mapa {picando === "destino" ? "a dónde vas" : "de dónde sales"}
            <button type="button" onClick={() => setPicando(null)}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="busc-panel">
        <label className="busc-etiqueta" htmlFor="busc-destino">
          A dónde vas
        </label>
        <input
          id="busc-destino"
          className="busc-campo"
          type="search"
          autoComplete="off"
          placeholder="Nombre de una parada"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
        />

        {sugerencias.length > 0 && (
          <ul className="busc-sugs">
            {sugerencias.map((s) => (
              <li key={s.clave}>
                {s.tipo === "parada" ? (
                  <button type="button" onClick={() => escoger(s)}>
                    <span className="sug-n">{s.nombre}</span>
                    <span className="sug-r">{s.circuitoNombre}</span>
                  </button>
                ) : (
                  /* Una ruta no es un destino: se ofrece como lo que es. */
                  <a className="sug-ruta" href={`/c/${s.slug}`}>
                    <span className="sug-n">{s.nombre}</span>
                    <span className="sug-r">Ver esta ruta</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* El corte no se hace en silencio. */}
        {omitidas > 0 && (
          <p className="busc-nota">
            Hay {omitidas} {omitidas === 1 ? "coincidencia más" : "coincidencias más"}. Escribe un
            poco más para acortar la lista.
          </p>
        )}

        {/*
          «No tenemos ninguna parada con ese nombre» sólo cuando de verdad no la
          hay — y **eso no es lo mismo que la lista esté vacía.** Al escoger una
          sugerencia la lista se cierra a propósito, y sin la condición de
          `escogido` esta nota salía justo encima de la tarjeta que acababa de
          encontrar la ruta: la pantalla negando lo que la respuesta afirmaba,
          tres renglones abajo. Es la tercera vez en esta pantalla que un
          renglón contradice al de al lado, y las tres se vieron mirando.
        */}
        {consulta.trim().length > 0 && escogido !== consulta && sugerencias.length === 0 && (
          <p className="busc-nota">
            No tenemos ninguna parada con ese nombre. Puedes picar en el mapa a dónde vas.
          </p>
        )}

        <div className="busc-acciones">
          <button type="button" onClick={() => setPicando("destino")}>
            Picar el destino en el mapa
          </button>
          <button type="button" onClick={() => setPicando("origen")}>
            {origenPicado ? "Cambiar de dónde sales" : "Picar de dónde sales"}
          </button>
        </div>

        <p className="busc-desde">
          {origen ? (
            <>
              Sales de <strong>{origen.etiqueta}</strong>
              {origenPicado && (
                <>
                  {" · "}
                  <button type="button" className="busc-liga" onClick={() => setOrigenPicado(null)}>
                    usar mi ubicación
                  </button>
                </>
              )}
            </>
          ) : (
            /* Sin ubicación no se bloquea nada, y no se le echa la culpa a nadie. */
            <>Falta de dónde sales. Pícalo en el mapa, o activa tu ubicación.</>
          )}
        </p>

        {respuestas && (
          <Respuestas
            sirven={sirven}
            respuestas={respuestas}
            destino={destino!}
            deNoche={deNoche}
          />
        )}

        {/*
          El límite, dicho. Una app que calla lo que no sabe hace que el
          pasajero crea que escribió mal.
        */}
        <p className="busc-limite">
          Buscamos por nombre de parada y de ruta. <strong>Todavía no entendemos calle y
          número</strong> — para cualquier otro lugar, pícalo en el mapa.
        </p>
        {/* Misma regla que en la vista de la ruta: el para qué, no el dónde. Ver
            `docs/Ficha-Textos-De-Privacidad.md`. El destino sigue sin salir del
            teléfono — la petición que lo mandaría no existe. */}
        <p className="promesa">A dónde vas y dónde estás se usan para contestarte.</p>
      </div>
    </div>
  );
}

// ── La respuesta ─────────────────────────────────────────────────────────

function Respuestas({
  sirven,
  respuestas,
  destino,
  deNoche,
}: {
  sirven: Array<Respuesta & { resultado: Extract<ResultadoDeBusqueda, { sirve: true }> }>;
  respuestas: Respuesta[];
  destino: Punto;
  deNoche: boolean;
}) {
  if (sirven.length > 0) {
    return (
      <div className="busc-res">
        {sirven.map(({ circuito, resultado }) => (
          <article
            className="busc-sirve"
            key={circuito.slug}
            /*
             * El color de ESTA ruta, inyectado por tarjeta. No puede vivir en
             * la raíz de la pantalla como en la vista de la ruta: aquí puede
             * haber varias, cada una con el suyo. Y el tinte se deriva con
             * `deNoche` porque `--ruta-claro` no tiene par de tema — sin esto
             * el fondo se quedaba claro en la pantalla oscura y el texto de
             * encima, que sí sigue al tema, quedaba blanco sobre blanco.
             */
            style={
              {
                "--ruta": circuito.color_hex,
                "--ruta-claro": tinte(circuito.color_hex, deNoche),
              } as React.CSSProperties
            }
          >
            <h2>{circuito.nombre}</h2>
            <dl>
              <div>
                <dt>Te subes</dt>
                <dd>{aPie(resultado.subir.caminataMetros, "de donde estás")}</dd>
              </div>
              <div>
                <dt>Te bajas</dt>
                <dd>{aPie(resultado.bajar.caminataMetros, `de ${destino.etiqueta}`)}</dd>
              </div>
              <div>
                <dt>A bordo</dt>
                {/*
                  Metros de recorrido, NUNCA minutos. El minuto estimado lo
                  gobierna el interruptor del rango del circuito, que vive en el
                  otro endpoint; decirlo aquí sería la siguiente fuga del mismo
                  interruptor, por una puerta que nadie está mirando.
                */}
                <dd>{distancia(resultado.recorridoMetros)} de recorrido</dd>
              </div>
            </dl>
            <a className="busc-ver" href={`/c/${circuito.slug}`}>
              Ver dónde vienen los camiones
            </a>
          </article>
        ))}
      </div>
    );
  }

  /*
   * EL TITULAR TIENE QUE DECIR LA VERDAD DE LO QUE HAY DEBAJO.
   *
   * La primera versión decía siempre «ninguna pasa cerca de ahí», y con el
   * motivo «pasa por los dos, pero en el otro sentido» tres renglones abajo la
   * pantalla se contradecía a sí misma: el titular negaba justo lo que la
   * razón afirmaba. Es la §D del Marco —lo falso lo puso el ALCANCE, un
   * titular hablando de distancia sobre un caso que no era de distancia— y es
   * la misma forma que ya se pagó entre el titular y el hilo de paradas.
   *
   * Así que el titular se escoge por lo que de verdad pasó.
   */
  const motivos = respuestas
    .map(({ resultado }) => (resultado.sirve ? null : resultado.motivo))
    .filter((m): m is MotivoDeNoServir => m !== null);
  const titulo = tituloDelNo(motivos);

  return (
    <div className="busc-res">
      <article className="busc-no">
        {/*
          Y el «no» habla de LAS RUTAS PUBLICADAS, nunca de la ciudad. Decir «no
          hay cómo llegar» sería un veredicto sobre un universo que el sistema
          no midió — la misma falta que decía «ahorita no hay unidades en
          servicio» cuando lo único cierto era que no teníamos evidencia.
        */}
        <h2>{TITULARES[titulo]}</h2>
        <ul>
          {respuestas.map(({ circuito, resultado }) => (
            <li key={circuito.slug}>
              <span className="no-r">{circuito.nombre}</span>
              <span className="no-p">{porQueNo(resultado)}</span>
            </li>
          ))}
        </ul>
        {/*
          «Estamos creciendo» contesta a un problema de COBERTURA. Cuando la
          ruta sí pasa por los dos puntos —o cuando el viaje es de una cuadra—
          la cobertura no es lo que falló, y ofrecer ahí que estamos creciendo
          sería contestar otra pregunta.
        */}
        {tocaDecirQueCrecemos(titulo) && (
          <p className="busc-creciendo">
            El mapa de arriba es todo lo que cubrimos hoy. Estamos creciendo.
          </p>
        )}
      </article>
    </div>
  );
}
