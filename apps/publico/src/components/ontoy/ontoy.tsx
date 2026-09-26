"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTema } from "@/lib/tema";
import { useUbicacion } from "@/lib/ubicacion";
import { avanceSobreTrazado } from "@jtel/domain";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RutaDeLaCiudad, Sentido, UnidadViva } from "@/lib/ontoy/forma";
import {
  dondeCaeLaParada,
  llegadasHasta,
  paradasEnPalabras,
  paradasHastaLaParada,
  promesaEnPalabras,
  rangoEnPalabras,
  useVelocidadDelCorredor,
  proximasParadasDeLaUnidad,
} from "@/lib/ontoy/llegadas";
import { useContarApertura, useContarAperturaDeParada } from "@/lib/ontoy/apertura";
import { useParadasGuardadas } from "@/lib/ontoy/paradas-guardadas";
import { useForma } from "@/lib/ontoy/ruta-en-vivo";
import { HojaDeParada, type LlegadaEnLaHoja } from "@/components/ontoy/hoja-de-parada";
import { HojaDeCami } from "@/components/ontoy/hoja-de-cami";
import { VistaTusParadas } from "@/components/ontoy/vista-tus-paradas";
import { VistaMapa } from "@/components/ontoy/vista-mapa";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { VistaInicio } from "@/components/ontoy/vista-inicio";
import { VistaPase } from "@/components/ontoy/vista-pase";
import { VistaIrA } from "@/components/ontoy/vista-ira";
import { Barra, type Lugar } from "@/components/ontoy/barra";
import { Asomado } from "@/components/ontoy/asomado";
import { CabezaDeRuta } from "@/components/ontoy/cabeza-de-ruta";
import { VistaParadas } from "@/components/ontoy/vista-paradas";
import { armarParadas, haciaDonde } from "@/lib/ontoy/paradas-de-la-ruta";
import { rutasFavoritas } from "@/lib/ontoy/favoritas";
import { paradaAsomada, porQueEnPalabras } from "@/lib/ontoy/parada-asomada";
import { gruposPorSentido } from "@/lib/ontoy/grupos-por-sentido";
import { ordenarRutas } from "@/lib/ontoy/rutas-cerca";
import { armarLaTira } from "@/lib/ontoy/tira-de-rutas";
import { PanelDeRutas } from "@/components/ontoy/panel-de-rutas";
import { useEnVivo } from "@/lib/ontoy/en-vivo";
import { rutasDeLaConsulta } from "@/lib/ontoy/consulta-de-la-raiz";
import { avisosDeTusRutas, hayAvisosNuevos } from "@/lib/ontoy/avisos";
import { registrarSondeo, TELEFONO_INICIAL, type EstadoDelTelefono } from "@/lib/ontoy/avisos-del-telefono";
import { useAvisosVistos } from "@/lib/ontoy/avisos-vistos";
import { VistaAvisos } from "@/components/ontoy/vista-avisos";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";
import { useElPase, useConfirmacionDelPase } from "@/lib/ontoy/pase-del-telefono";
import { arranqueCorto, arranqueLargo } from "@/lib/fecha-arranque";

/**
 * **Ontoy** — el cascarón de los cuatro lugares (8.8, 22-sep).
 *
 * **Inicio · Mapa · Ir a · Pase**, con la barra abajo. La app abre en Inicio,
 * contestando: la parada guardada con su próximo camión, o las paradas cerca
 * del pasajero. Quien llega por la liga de una ruta abre en el Mapa con esa
 * ruta enfocada. **Pase** es la cartera (8.14; Ontoy 3.0 · PR P2): viajes de
 * laboratorio, con su banda de R&D. **Ir a** es el buscador, y el planeador
 * (8.16) llega con el cierre de Ontoy 2.0.
 *
 * ## Toda pantalla tiene su salida (8.10)
 *
 * La barra está siempre visible. La lista de todas las rutas regresa al mapa
 * con su botón. La hoja de una parada se cierra de tres maneras. Ninguna
 * pantalla de esta app es un callejón.
 *
 * ## La app no sabe quién eres (8.7)
 *
 * No hay cuenta, no hay registro, no hay identificación. Lo único que se guarda
 * son las paradas guardadas, y viven en el teléfono. La ubicación **no se pide
 * al abrir** (decisión de ASAV, 22-sep): se pide con el botón de Inicio, y si ya
 * se había dado se usa sin volver a preguntar. Entra al cálculo aquí mismo y no
 * sale del aparato (8.3b). Se lee UNA vez, aquí, y baja a quien la usa.
 */
export function Ontoy({
  rutas,
  estados,
  vigenteHasta,
  rutaInicial,
  paradaInicial,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /** Hasta cuándo vale lo que dice la lista (ISO); en ese instante se vuelve a pedir. */
  vigenteHasta: string | null;
  /**
   * La ruta que la dirección pidió (`/rutas?ruta=…`, o una liga vieja `/c/‹slug›`).
   * Cuando viene, la app abre en el Mapa con esa ruta enfocada: quien llega por
   * una liga compartida quiere ver ESA ruta, no la lista de la ciudad.
   */
  rutaInicial: string | null;
  /**
   * La parada que la dirección pidió, por el slug de su QR (`/p/‹qr_slug›`).
   *
   * Quien llega escaneando un letrero atornillado a un poste está **parado en
   * esa parada**: la app abre en su hoja, no en la lista de la ciudad ni en la
   * ruta entera. La hoja se abre **encima del mapa de la ciudad**, con su ruta
   * —que viene en `rutaInicial`— prendida en la tira (ver `delLetrero`).
   *
   * ✎ 25-sep: hasta aquí el texto ya lo decía, pero el código abría la RUTA
   * debajo de la hoja —la pantalla con la lista de sus paradas—, y al cerrar la
   * hoja eso es lo que quedaba. Ahora queda el mapa.
   *
   * No se valida aquí contra la forma de la ruta —las paradas llegan después,
   * con la consulta— y no hace falta: si el slug no fuera de esta ruta, la hoja
   * simplemente no se abre y queda la ruta enfocada. Quien decide si el slug
   * existe es el servidor, en `/p/‹qr_slug›`, y ahí un slug que no resuelve ni
   * siquiera llega a esta pantalla.
   */
  paradaInicial: string | null;
}) {
  const { deNoche, alternar: alternarPiel } = useTema();
  const pedida = rutaInicial && rutas.some((r) => r.circuito_id === rutaInicial) ? rutaInicial : null;
  /**
   * **Se llegó por el letrero de una parada** (`/p/‹qr_slug›`): el MAPA de la
   * ciudad con la hoja de esa parada encima, no la pantalla de la ruta con su
   * lista (ASAV, 25-sep; láminas `5-paradas/04` y `05`).
   *
   * Sólo cuando viene parada. Una liga de RUTA compartida —`/rutas?ruta=…`,
   * `/c/…`— sigue abriendo la ruta: quien la manda quiere enseñar la ruta.
   */
  const delLetrero = pedida && paradaInicial ? paradaInicial : null;
  const [lugar, setLugar] = useState<Lugar>(pedida ? "mapa" : "inicio");
  const [enfocada, setEnfocada] = useState<string | null>(pedida ?? rutas[0]?.circuito_id ?? null);
  const [sentido, setSentido] = useState<Sentido>("ida");
  /* Con `paradaInicial` la app nace con la hoja abierta: quien escaneó el
     letrero está parado ahí. Cerrarla lo deja en el mapa, con la parada más
     cercana asomándose abajo —no en la nada, ni en la lista de la ruta—. */
  const [paradaAbierta, setParadaAbierta] = useState<string | null>(
    pedida ? paradaInicial : null,
  );
  /**
   * Una ruta ABIERTA: su cabeza teñida y sus paradas o su mapa (8.8, 8.8d). Quien
   * llega por la liga de una ruta la ve abierta; el Mapa sin ruta abierta es el
   * de la ciudad.
   */
  const [rutaAbierta, setRutaAbierta] = useState<boolean>(pedida !== null && !delLetrero);
  /**
   * El camión tocado, si hay uno. Se guarda **la unidad entera** y no su número:
   * la hoja necesita su posición para contar las paradas que le siguen, y
   * buscarla de nuevo por el económico la perdería justo cuando el sondeo la
   * mueve.
   */
  const [camiTocado, setCamiTocado] = useState<UnidadViva | null>(null);
  /**
   * **La parada tocada en el Mapa de la ciudad**, con su ruta.
   *
   * Lleva la ruta y no sólo el identificador de la parada porque en la ciudad no
   * hay ninguna ruta abierta de la cual deducirla: la lista pública de paradas
   * trae `ruta` por parada (`ParadaDeLaCiudad`) y es la única forma de saber a
   * quién preguntarle sus llegadas. Deducirla del mapa —«la ruta enfocada»—
   * daría la respuesta de otra ruta el día que el pasajero toque una parada de
   * una ruta distinta a la que está resaltada, que es justo el caso normal.
   */
  const [paradaTocada, setParadaTocada] = useState<{ ruta: string; parada: string } | null>(
    delLetrero && pedida ? { ruta: pedida, parada: delLetrero } : null,
  );
  /**
   * La parada del letrero, mientras su hoja siga abierta. Se suelta al cerrarla
   * o al tocar otra: tocarla después desde el mapa ya no es «llegar por el
   * letrero», y la hoja no tiene por qué volver a saludar.
   */
  const [paradaDelLetrero, setParadaDelLetrero] = useState<string | null>(delLetrero);
  /**
   * «Tus paradas» cuelga de Inicio, como la ruta abierta cuelga del Mapa: la
   * barra tiene cuatro lugares y eso es ley (8.8). No es un quinto lugar.
   */
  const [verTusParadas, setVerTusParadas] = useState(false);
  const [modo, setModo] = useState<"paradas" | "mapa">("paradas");

  const guardadas = useParadasGuardadas();
  const elPase = useElPase();
  /*
   * El cierre del ciclo (P3.5): con señal, el pase pregunta por los boletos que
   * enseñó y nadie confirmó. Vive aquí arriba y no dentro de la pestaña para
   * que la respuesta llegue aunque el pasajero esté mirando el mapa — el
   * lector sincroniza cuando el camión sale del túnel, no cuando alguien abre
   * una pantalla.
   */
  useConfirmacionDelPase({ pase: elPase.pase, listo: elPase.listo, guardar: elPase.guardar });
  useListaAlDia(vigenteHasta);
  const enElMapa = lugar === "mapa";
  /** El Mapa de la ciudad (PR 3b): en el Mapa, sin ruta abierta. */
  const enLaCiudad = enElMapa && !rutaAbierta;
  /**
   * **La ruta que se CONSULTA**, que ya no es la misma que «la ruta abierta».
   *
   * De aquí cuelgan la forma (`useForma`) y los camiones de la consulta única.
   * Hasta el #588 era `rutaAbierta ? enfocada : null`, y esa línea es la que
   * hacía imposible el bucle del mapa: en el Mapa de la ciudad no había forma ni
   * dato vivo de ninguna ruta, así que tocar una parada **no podía** contestar
   * ahí mismo. La única forma de enseñar sus llegadas era abrir la ruta entera,
   * o sea sacar al pasajero del mapa justo cuando acababa de señalar dónde está.
   *
   * Ahora son dos preguntas distintas:
   * - **abierta**: ¿qué ruta está ocupando la pantalla? Decide la cabeza teñida,
   *   la lista de paradas y la apertura que se cuenta (8.7).
   * - **consultada**: ¿de qué ruta necesito datos? Es la abierta, o —en la
   *   ciudad— la de la parada que el pasajero acaba de tocar.
   *
   * La apertura sigue colgando de la primera, a propósito: mirar la hoja de una
   * parada sobre el mapa no es abrir una ruta, y contarlo inflaría la única
   * cifra que dice cuántas rutas se abrieron.
   */
  const abierta = enElMapa && rutaAbierta ? enfocada : null;
  /* `consultada` se calcula más abajo, junto a la consulta: desde la hoja asomada
     depende también de la lista de la ciudad y del filtro del mapa. */
  const ubicacion = useUbicacion({ pedirAlAbrir: false });
  const yo = ubicacion.yo;
  // La única escritura de la app: una apertura por ruta abierta (8.7).
  // Mirar tus favoritas en el mapa de la ciudad no es abrir una ruta: no cuenta.
  useContarApertura(enElMapa && rutaAbierta ? enfocada : null);

  /*
   * El filtro del Mapa (ASAV, 22-sep): qué rutas se dibujan. `apagadas` son las
   * que el pasajero apagó tocando su chip; `agregadas`, las lejanas que escogió
   * en el panel. **Ninguna de las dos se guarda**: al volver a abrir el Mapa,
   * todas las de la tira están prendidas otra vez (8.7).
   */
  const [apagadas, setApagadas] = useState<Set<string>>(new Set());
  /*
   * La ruta del letrero entra a la tira como si el pasajero la hubiera sumado
   * desde el panel: sin ubicación la tira es alfabética, y sin esto la ruta de
   * la parada que acaba de escanear podía no dibujarse — el mapa se abría sin
   * la parada en la que está parado.
   */
  const [agregadas, setAgregadas] = useState<Set<string>>(
    () => new Set(delLetrero && pedida ? [pedida] : []),
  );
  const [verParadas, setVerParadas] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(false);

  /* Las favoritas siguen decidiendo de qué rutas se piden camiones (PR 3b). */
  const favoritas = useMemo(
    () => rutasFavoritas(guardadas.guardadas, rutas.map((r) => r.circuito_id)),
    [guardadas.guardadas, rutas],
  );

  /*
   * **La consulta única de la raíz** (PR 4b, decisión de ASAV): tus favoritas y
   * la ruta abierta, en UNA consulta cada 15 s. De ella salen Inicio, el Mapa,
   * la lista de paradas y la campana: 4 peticiones por minuto en toda la app —antes, con
   * una ruta abierta, eran 8— y los avisos al día en cualquier pantalla.
   */
  /*
   * La lista pública de paradas. Una sola bajada, cacheada por el hook.
   *
   * ✎ **22-sep-2026 (ASAV): también al abrir el Mapa**, y no sólo si hay
   * paradas guardadas. La piden los puntitos de parada del filtro, y un
   * interruptor que aparece o desaparece según si diste ubicación es peor que
   * una petición más. Es un `GET` **sin parámetros, igual para todos y con
   * caché largo**: no lleva nada del pasajero y no lo identifica (8.7).
   */
  /*
   * «Tus paradas» también la necesita: sin la lista de la ciudad no hay de
   * dónde sacar el nombre de cada guardada —el teléfono sólo guarda su slug—.
   */
  const listaDeLaCiudad = useParadasDeLaCiudad(lugar === "mapa" || lugar === "ira" || verTusParadas);

  /*
   * La tira: las cercanas primero (por distancia con ubicación, alfabéticas sin
   * ella) más las que el pasajero sumó desde el panel. La regla y su porqué,
   * en `lib/ontoy/tira-de-rutas.ts`.
   */
  const paradasDeLaCiudad = listaDeLaCiudad.datos?.paradas ?? [];
  const ordenDeLasRutas = useMemo(
    () => ordenarRutas(rutas, paradasDeLaCiudad, ubicacion.yo).rutas,
    [rutas, paradasDeLaCiudad, ubicacion.yo],
  );
  const filtro = useMemo(
    () => armarLaTira(ordenDeLasRutas, agregadas, apagadas),
    [ordenDeLasRutas, agregadas, apagadas],
  );

  /**
   * **La parada que se asoma abajo del mapa** — la más cerca de ti; sin
   * ubicación, tu guardada; sin nada, nada. La regla y su orden, en
   * `lib/ontoy/parada-asomada.ts`.
   *
   * Sólo en el Mapa de la ciudad: con una ruta abierta, la pantalla es de esa
   * ruta y la asomada hablaría de otra cosa.
   *
   * ⚠ **No es una apertura.** La asomada aparece sola; nadie la escogió. El
   * contador de paradas (0057) cuenta las tres formas de LLEGAR a una hoja
   * —tocarla en el mapa, tocarla en una ruta, escanear su letrero— y ésta no
   * es ninguna. Por eso no toca `paradaAbierta`, que es de lo que cuelga el
   * contador.
   */
  const asomada = useMemo(
    () =>
      enLaCiudad
        ? paradaAsomada({
            yo: ubicacion.yo,
            paradas: paradasDeLaCiudad,
            apagadas,
            guardadas: guardadas.guardadas,
          })
        : null,
    [enLaCiudad, ubicacion.yo, paradasDeLaCiudad, apagadas, guardadas.guardadas],
  );
  /*
   * La ruta que se CONSULTA (ver el comentario largo junto a `abierta`): la
   * abierta; en la ciudad, la de la parada tocada; y si no hay ninguna tocada,
   * la de la asomada — que tiene que decir su llegada, y sin su ruta en la
   * consulta no tendría qué decir.
   */
  const consultada =
    abierta ?? (enLaCiudad ? (paradaTocada?.ruta ?? asomada?.ruta ?? null) : null);
  /*
   * Y la apertura de la PARADA, que es otra cifra y otra tabla (ASAV, 25-sep).
   * Cuelga de `paradaAbierta` —la tocada o la escaneada—, así que cuenta las
   * tres formas de llegar a una hoja. **La asomada no es ninguna**: aparece
   * sola, y su `paradaAbierta` es `null`, así que aquí no manda nada.
   */
  useContarAperturaDeParada(enElMapa ? consultada : null, enElMapa ? paradaAbierta : null);

  const [telefono, setTelefono] = useState<EstadoDelTelefono>(TELEFONO_INICIAL);
  const consulta = useMemo(() => rutasDeLaConsulta(favoritas, consultada), [favoritas, consultada]);
  const enVivo = useEnVivo(consulta, { alSondear: (s) => setTelefono((e) => registrarSondeo(e, s)) });
  const f = useForma(consultada);
  const forma = f.forma;
  const vivo = consultada ? (enVivo.vivos.get(consultada) ?? null) : null;
  const error = enVivo.error || f.error;
  const reintentar = enVivo.reintentar;
  const { velocidad, trazadoPorSentido } = useVelocidadDelCorredor(forma, vivo);

  /* La campana (8.13b): los avisos de la concesión de tus rutas y de la abierta. */
  const avisos = useMemo(() => avisosDeTusRutas(enVivo.vivos, rutas), [enVivo.vivos, rutas]);
  const { vistos, marcarVistos } = useAvisosVistos();
  const [campanaAbierta, setCampanaAbierta] = useState(false);
  const abrirCampana = useCallback(() => {
    /*
     * **Avisos es una página de Inicio** (3-ir-a/14: «← Inicio», y la barra
     * marca Inicio). Se puede abrir desde las paradas de una ruta, y sin esto
     * la barra seguía marcando Mapa estando en Avisos.
     */
    setLugar("inicio");
    setCampanaAbierta(true);
    setParadaAbierta(null);
    setParadaTocada(null);
  }, []);
  useEffect(() => {
    // Abierta, lo que está en pantalla queda visto: el punto se apaga.
    if (campanaAbierta) marcarVistos(avisos.map((a) => a.id));
  }, [campanaAbierta, avisos, marcarVistos]);
  const paradasGuardadasEnElMapa = useMemo(() => {
    const todas = listaDeLaCiudad.datos?.paradas ?? [];
    return guardadas.guardadas.flatMap((g) => {
      const p = todas.find((x) => x.id === g.parada && x.ruta === g.ruta);
      return p ? [{ id: p.id, ruta: p.ruta, nombre: p.nombre, lat: p.lat, lon: p.lon, sentido: p.sentido }] : [];
    });
  }, [listaDeLaCiudad.datos, guardadas.guardadas]);

  const abrirRuta = useCallback((circuitoId: string, parada?: string, enSentido?: Sentido) => {
    setParadaDelLetrero(null);
    setEnfocada(circuitoId);
    setParadaAbierta(parada ?? null);
    setParadaTocada(null);
    if (enSentido) setSentido(enSentido);
    setRutaAbierta(true);
    setModo("paradas");
    setLugar("mapa");
    setCampanaAbierta(false);
  }, []);

  /**
   * **Tocar una parada en el Mapa de la ciudad: su hoja, encima del mapa.**
   *
   * Esto es el bucle que faltaba. Antes, este toque llamaba a `abrirRuta` y el
   * pasajero acababa en la lista de las 18 paradas de la ruta: había señalado un
   * punto del mapa y la app le contestaba cambiándole la pantalla. La pantalla de
   * la ruta sigue existiendo —se llega a ella desde Inicio—, pero ya no es el
   * destino de un toque en el mapa.
   *
   * No toca `lugar`, ni `rutaAbierta`, ni `enfocada`: el mapa se queda **exacto
   * como estaba**, con el mismo encuadre y las mismas rutas prendidas. Lo único
   * que cambia es que ahora hay una parada tocada, y de ella cuelga la consulta.
   */
  const tocarParadaDeLaCiudad = useCallback(
    (ruta: string, parada: string, enSentido: Sentido | null) => {
      setParadaTocada({ ruta, parada });
      setParadaAbierta(parada);
      setParadaDelLetrero(null);
      setCamiTocado(null);
      /*
       * **El sentido sale de la parada tocada**, no del que traía la app.
       *
       * Sin esto, tocar una parada del regreso enseñaba «Ruta 51 · hacia Centro»
       * encima de las llegadas del otro sentido: el dato bueno con el rótulo de
       * otra cosa, que es el §D. Las paradas que sirven a los dos sentidos traen
       * `null` y ahí el que había es tan bueno como cualquiera.
       */
      if (enSentido) setSentido(enSentido);
    },
    [],
  );

  const cerrarLaHoja = useCallback(() => {
    setParadaAbierta(null);
    setParadaTocada(null);
    setParadaDelLetrero(null);
  }, []);

  /**
   * Tocar un lugar de la barra **siempre** regresa a su pantalla de entrada,
   * incluso el lugar en el que ya estás.
   *
   * Sin esto, el Pase tenía una pantalla sin salida de verdad: desde el código
   * QR, tocar «Pase» en la barra no hacía nada —ya estabas en «pase»— y la
   * única salida era un botón que el código grande empujaba fuera de la vista.
   * La 8.10 dice que la barra es la salida de cualquier pantalla; ahora lo es.
   */
  const [volverAlInicioDelLugar, setVolverAlInicioDelLugar] = useState(0);
  /* Si Inicio abre su lista de rutas completa: sólo al llegar desde «Ver todas las rutas» de «Ir a». */
  const [rutasAbiertas, setRutasAbiertas] = useState(false);
  const irA = useCallback((l: Lugar) => {
    setParadaDelLetrero(null);
    setLugar(l);
    setRutaAbierta(false);
    setParadaAbierta(null);
    setParadaTocada(null);
    setCampanaAbierta(false);
    setVerTusParadas(false);
    setRutasAbiertas(false);
    setVolverAlInicioDelLugar((n) => n + 1);
  }, []);

  /*
   * «Ver todas las rutas», la salida de una búsqueda sin resultados: a Inicio,
   * y bajando hasta su lista de rutas (ahí viven todas, Marco 8.8). Se baja en
   * un efecto porque la lista existe hasta que Inicio se dibuja.
   */
  const [bajarALasRutas, setBajarALasRutas] = useState(0);
  const verTodasLasRutas = useCallback(() => {
    irA("inicio");
    setRutasAbiertas(true);
    setBajarALasRutas((n) => n + 1);
  }, [irA]);
  useEffect(() => {
    if (bajarALasRutas === 0 || lugar !== "inicio") return;
    document.getElementById("ontoy-rutas")?.scrollIntoView({ block: "start" });
  }, [bajarALasRutas, lugar]);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;
  /**
   * **La ruta de la hoja abierta** — la consultada, que en la ciudad es la de la
   * parada tocada y no la que el mapa tiene resaltada. Usar `rutaEnfocada` aquí
   * pondría el nombre y el color de OTRA ruta encima de las llegadas de ésta:
   * un dato correcto en el lugar equivocado, que es exactamente el §D.
   */
  const rutaDeLaHoja = rutas.find((r) => r.circuito_id === consultada) ?? null;

  /*
   * El Mapa de la ciudad, en UN objeto estable: los marcadores se redibujan
   * cuando cambia lo que dicen, no en cada render. Recreado en cada render, un
   * camión se borraba y se volvía a pintar bajo el dedo del pasajero — lo
   * enseñó la revisión en el navegador, cuando el toque no le atinaba.
   */
  const alternarRuta = useCallback(
    (ruta: string) =>
      setApagadas((antes) => {
        const siguiente = new Set(antes);
        if (siguiente.has(ruta)) siguiente.delete(ruta);
        else siguiente.add(ruta);
        return siguiente;
      }),
    [],
  );
  const agregarRutas = useCallback(
    (ids: string[]) => setAgregadas((antes) => new Set([...antes, ...ids])),
    [],
  );


  const ciudad = useMemo(
    () => ({
      tira: filtro.tira,
      prendidas: filtro.prendidas,
      cuantasMas: filtro.resto.length,
      vivos: enVivo.vivos,
      guardadas: paradasGuardadasEnElMapa,
      paradas: paradasDeLaCiudad,
      verParadas,
      alAlternar: alternarRuta,
      alAlternarParadas: () => setVerParadas((v) => !v),
      alAbrirPanel: () => setPanelAbierto(true),
      alAbrirRuta: (ruta: string, parada?: string) => abrirRuta(ruta, parada),
      alTocarParadaDeLaCiudad: tocarParadaDeLaCiudad,
      alBuscar: () => irA("ira"),
    }),
    [filtro, enVivo.vivos, paradasGuardadasEnElMapa, paradasDeLaCiudad, verParadas, alternarRuta, abrirRuta, tocarParadaDeLaCiudad, irA],
  );

  /* Las paradas de la ruta abierta: se arma en `lib/ontoy/paradas-de-la-ruta.ts`, aquí sólo se pide. */
  const renglones = useMemo(
    () =>
      forma
        ? armarParadas({
            forma,
            vivo,
            sentido,
            yo,
            velocidadKmh: velocidad.kmh,
            trazadoPorSentido,
            estaGuardada: guardadas.estaGuardada,
          })
        : [],
    [forma, vivo, sentido, yo, velocidad.kmh, trazadoPorSentido, guardadas.estaGuardada],
  );
  const nombreDeSentido = useCallback(
    (s: Sentido) => (forma ? haciaDonde(forma, s, trazadoPorSentido) : null),
    [forma, trazadoPorSentido],
  );
  /**
   * La parada de la hoja: la TOCADA si hay una; si no, en la ciudad, la
   * asomada. Son dos hojas distintas —una la escogiste, la otra se asoma sola—
   * y la pantalla las trata distinto (ver `fija` en la hoja).
   */
  const laHojaEsLaAsomada = !paradaAbierta && enLaCiudad && asomada !== null;
  const paradaDeLaHoja = paradaAbierta ?? (laHojaEsLaAsomada ? asomada!.id : null);
  const parada = forma?.paradas.find((p) => p.id === paradaDeLaHoja) ?? null;
  /**
   * **El sentido de la hoja sale de su parada**, sin tocar el estado global.
   *
   * Al TOCAR una parada, `tocarParadaDeLaCiudad` ya pone su sentido en el
   * estado, porque el pasajero la escogió. La asomada no la escogió nadie, y
   * cambiar el sentido global cada vez que el GPS hace que otra parada quede
   * más cerca se llevaría ese sentido a la ruta que abras después. Por eso aquí
   * se DERIVA y no se guarda. Una parada que sirve a los dos sentidos trae
   * `null` y se queda el que había.
   */
  /*
   * La hoja del letrero tampoco la abrió un toque que haya puesto el sentido:
   * se saca de su parada en la lista de la ciudad, igual que la asomada.
   */
  const paradaDelLetreroEnLaCiudad =
    paradaDelLetrero && paradaAbierta === paradaDelLetrero
      ? (paradasDeLaCiudad.find((p) => p.id === paradaDelLetrero && p.ruta === paradaTocada?.ruta) ?? null)
      : null;
  const sentidoDeLaHoja: Sentido = laHojaEsLaAsomada
    ? (asomada!.sentido ?? sentido)
    : paradaDelLetreroEnLaCiudad
      ? (paradaDelLetreroEnLaCiudad.sentido ?? sentido)
      : sentido;

  /*
   * Las próximas paradas del camión tocado. Se recalculan con cada sondeo, que
   * es lo que hace que la hoja siga diciendo la verdad mientras está abierta:
   * si el camión avanza una parada, la cuenta baja sola.
   */
  const paradasDeCami =
    camiTocado && forma
      ? proximasParadasDeLaUnidad(camiTocado, { forma, trazadoPorSentido })
      : [];

  /*
   * El camión tocado, **vuelto a buscar en el sondeo de ahorita**. Sin esto la
   * hoja se quedaría con la posición del momento del toque y seguiría contando
   * desde ahí — el número se congelaría sin decirlo, que es un dato correcto
   * mintiendo por viejo.
   */
  const camiAhora = camiTocado
    ? (vivo?.unidades.find((u) => u.economico === camiTocado.economico) ?? camiTocado)
    : null;

  /* Lo que la hoja enseña: lo medido arriba, la promesa abajo, nunca fundidos. */
  /**
   * Lo que la hoja enseña **en un sentido**. Una función y no un valor porque
   * la hoja completa de una parada que sirve a los dos pide los dos (ver
   * `gruposDeLaHoja`); la media y la asomada piden sólo el suyo.
   */
  const llegadasEnSentido = useCallback((sentidoPedido: Sentido): LlegadaEnLaHoja[] => {
    if (!forma || !parada) return [];
    if (error) {
      return [{ rotulo: "No pudimos preguntar", apoyo: "lo que ves es lo último que supimos", vieja: true }];
    }
    if (!vivo) return [{ rotulo: "Preguntando…", apoyo: "un momento", vieja: true }];
    if (vivo.estado === "por_arrancar") {
      return [
        {
          rotulo: arranqueCorto(vivo.arranca_el ?? "") ?? "Todavía no arranca",
          apoyo: "esta ruta aún no da servicio",
          vieja: true,
        },
      ];
    }
    if (vivo.estado === "fuera_de_horario") {
      return [{ rotulo: "Fuera de horario", apoyo: `abre ${vivo.abre_a}`, vieja: true }];
    }

    const abscisa = dondeCaeLaParada(parada, trazadoPorSentido.get(sentidoPedido), forma.corredor_m);
    if (abscisa === null) {
      return [{ rotulo: "Sin dato en este sentido", apoyo: "esta parada no cae en el trazado de ida y vuelta", vieja: true }];
    }
    const lista = llegadasHasta(
      { avanceMetros: abscisa, sentido: sentidoPedido },
      { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
    );
    const enMinutos: LlegadaEnLaHoja[] = lista.slice(0, 3).map((l, i) => ({
      rotulo: rangoEnPalabras(l.rango),
      apoyo: `viene la ${l.unidad} · ${haceNMinutos(l.antiguedadSeg)}`,
      placa: l.unidad,
      /*
       * El rango NO se parte en cifra grande: «4–7 min» es **un solo valor con
       * dos extremos**, y agrandar sólo el «4» lo volvería una promesa de
       * cuatro minutos con el resto en letra chica. La cuenta de paradas sí se
       * parte, porque ahí el número es uno.
       */
      enVivo: i === 0,
      vieja: i > 0,
    }));

    /*
     * 8.9b: sin minutos, la cuenta de paradas. Y el dato viejo se queda como
     * dato viejo (8.9): en pasado, con su edad, al final — con o sin minutos.
     */
    const porParadas = paradasHastaLaParada({ avanceMetros: abscisa, sentido: sentidoPedido }, { forma, vivo, trazadoPorSentido });
    const viejas: LlegadaEnLaHoja[] = porParadas
      .filter((p) => !p.fresca)
      .map((p) => ({
        rotulo: `iba ${paradasEnPalabras(p.paradas)}`,
        apoyo: `la ${p.unidad} · posición de ${haceNMinutos(p.antiguedadSeg)}`,
        placa: p.unidad,
        /*
         * **La posición vieja NO lleva cifra grande** (8.9; decisión de ASAV
         * del 22-sep): es lo último que se vio, no dónde está. El número
         * grande es lo que el ojo lee primero, y dárselo a un dato de hace seis
         * minutos lo presenta como si fuera de ahorita. Se queda en el rótulo
         * chico, en pasado, con su edad al lado.
         */
        vieja: true,
        pasada: true,
      }));
    if (enMinutos.length > 0) return [...enMinutos, ...viejas].slice(0, 3);

    const frescas: LlegadaEnLaHoja[] = porParadas
      .filter((p) => p.fresca)
      .map((p, i) => ({
        rotulo: paradasEnPalabras(p.paradas),
        /*
         * La cifra viene del **número**, no de recortar la frase: el día que
         * `paradasEnPalabras` diga «a 1 parada» en singular, o le cambie el
         * orden, partir la cadena se equivocaría en silencio.
         */
        cifra: { valor: String(p.paradas), unidad: p.paradas === 1 ? "parada" : "paradas" },
        apoyo: `viene la ${p.unidad} · ${haceNMinutos(p.antiguedadSeg)}`,
        placa: p.unidad,
        enVivo: i === 0,
        vieja: i > 0,
      }));
    const todas = [...frescas, ...viejas].slice(0, 3);
    if (todas.length === 0) {
      return [{ rotulo: "Sin unidad a la vista", apoyo: "ahorita no hay ninguna que se pueda medir", vieja: true }];
    }
    return todas;
  }, [forma, parada, vivo, error, trazadoPorSentido, velocidad.kmh]);
  const llegadasDeLaHoja = useMemo(() => llegadasEnSentido(sentidoDeLaHoja), [llegadasEnSentido, sentidoDeLaHoja]);

  /**
   * **La hoja completa de una parada que sirve a los dos sentidos: los dos,
   * agrupados** (ASAV, 25-sep: «como la lámina»).
   *
   * La lámina lo separa por ALTURA, no por tipo de parada: la media de «Av.
   * Tecnológico y Calle 16» dice «hacia Centro» con sus filas, y la completa
   * de la misma parada dice «paran los dos sentidos» y enseña «Hacia Centro» y
   * «Hacia Tecnológico», cada uno con las suyas. Aquí sólo se calcula; es la
   * hoja la que decide enseñarlo al subir hasta arriba.
   *
   * `null` —y la hoja se queda con un sentido— en tres casos:
   * - la parada es de UN sentido: no hay otro que enseñar;
   * - la ruta no tiene trazado de los dos: no hay cómo contar el otro;
   * - ningún sentido tiene una unidad medida: dos veces «Sin unidad a la
   *   vista» bajo dos títulos es la misma frase dicha dos veces, no dos
   *   respuestas.
   *
   * El sentido que la hoja traía va primero: es el que el pasajero estaba
   * leyendo, y subir la hoja no tiene por qué cambiarle el orden.
   */
  const gruposDeLaHoja = useMemo(
    () =>
      forma && parada
        ? gruposPorSentido({
            sentidoDeLaParada: parada.sentido,
            hayTrazado: (s) => !!trazadoPorSentido.get(s),
            sentidoActual: sentidoDeLaHoja,
            llegadasEn: llegadasEnSentido,
            nombreDe: nombreDeSentido,
          })
        : null,
    [forma, parada, sentidoDeLaHoja, trazadoPorSentido, nombreDeSentido, llegadasEnSentido],
  );

  /* 8.3b: hasta donde está el pasajero, calculado aquí y sin que salga nada. */
  const hastaMi = useMemo(() => {
    if (!forma || !vivo || !yo) return null;
    const trazado = trazadoPorSentido.get(sentidoDeLaHoja);
    const mi = trazado ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
    if (!mi) return null;
    const l = llegadasHasta(
      { avanceMetros: mi.avanceMetros, sentido: sentidoDeLaHoja },
      { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
    )[0];
    return l ? rangoEnPalabras(l.rango) : null;
  }, [forma, vivo, yo, sentidoDeLaHoja, trazadoPorSentido, velocidad.kmh]);

  return (
    <div className="ontoy">
      {/* Sin cabecera (ASAV, 25-sep): Ontoy se asoma arriba y lleva a Inicio. No sale sobre el Mapa. */}
      {lugar !== "mapa" && <Asomado alTocar={() => irA("inicio")} />}

      {campanaAbierta && (
        <VistaAvisos
          avisos={avisos}
          telefono={telefono.avisos}
          vistos={vistos}
          rutasGuardadas={new Set(guardadas.guardadas.map((g) => g.ruta))}
          alVolver={() => setCampanaAbierta(false)}
          alAbrirRuta={(ruta) => abrirRuta(ruta)}
        />
      )}

      {!campanaAbierta && lugar === "inicio" && verTusParadas && (
        <VistaTusParadas
          guardadas={guardadas.guardadas}
          rutas={rutas}
          paradas={paradasDeLaCiudad}
          alVolver={() => setVerTusParadas(false)}
          alReordenar={guardadas.reordenar}
          alQuitar={guardadas.quitar}
          alReponer={guardadas.reponer}
          alAbrirRuta={(r, p) => {
            setVerTusParadas(false);
            abrirRuta(r, p);
          }}
        />
      )}

      {!campanaAbierta && lugar === "inicio" && !verTusParadas && (
        <VistaInicio
          alVerTusParadas={() => setVerTusParadas(true)}
          rutas={rutas}
          estados={estados}
          guardadas={guardadas.guardadas}
          guardadasListas={guardadas.listo}
          puedeGuardar={guardadas.disponible}
          ubicacion={ubicacion}
          alAbrirRuta={abrirRuta}
          alQuitarGuardada={guardadas.alternar}
          enVivo={enVivo}
          avisos={avisos}
          avisosNuevos={hayAvisosNuevos(avisos, vistos)}
          alVerAvisos={abrirCampana}
          deNoche={deNoche}
          alAlternarPiel={alternarPiel}
          rutasAbiertas={rutasAbiertas}
        />
      )}

      {!campanaAbierta && lugar === "mapa" &&
        (rutaAbierta && rutaEnfocada ? (
          <>
            <CabezaDeRuta
              nombre={rutaEnfocada.nombre}
              color={rutaEnfocada.color_hex}
              enVivo={vivo ? vivo.unidades.filter((u) => u.fresco && u.sentido === sentido).length : null}
              sentido={sentido}
              nombreDeSentido={nombreDeSentido}
              modo={modo}
              alVolver={() => {
                setRutaAbierta(false);
                setParadaAbierta(null);
              }}
              alCambiarSentido={setSentido}
              alCambiarModo={setModo}
            />
            {modo === "paradas" ? (
              <VistaParadas
                renglones={renglones}
                cargando={!forma || !vivo}
                aviso={avisoDeLaEscalera(vivo, error)}
                promesa={promesaEnPalabras(vivo?.promesa ?? rutaEnfocada.promesa ?? null, sentido) ?? ""}
                color={rutaEnfocada.color_hex}
                paradaMarcada={paradaAbierta}
                alTocarParada={setParadaAbierta}
                avisos={avisos.filter((a) => a.ruta === rutaEnfocada.circuito_id)}
                alVerAvisos={abrirCampana}
              />
            ) : (
          <VistaMapa
              rutaAbierta
              yo={yo}
              alTocarCami={setCamiTocado}
            rutas={rutas}
            enfocada={enfocada}
            forma={forma}
            vivo={vivo}
            error={error}
            deNoche={deNoche}
            sentido={sentido}
            paradaAbierta={paradaAbierta}
            alEnfocar={(id) => abrirRuta(id)}
            alCambiarSentido={setSentido}
            alTocarParada={setParadaAbierta}
            alReintentar={reintentar}
          />
            )}
          </>
        ) : (
          <VistaMapa
            ciudad={ciudad}
            centrarEn={paradaDelLetreroEnLaCiudad}
            yo={yo}
            rutas={rutas}
            enfocada={enfocada}
            forma={forma}
            vivo={vivo}
            error={error}
            deNoche={deNoche}
            sentido={sentido}
            paradaAbierta={paradaAbierta}
            alEnfocar={(id) => abrirRuta(id)}
            alCambiarSentido={setSentido}
            alTocarParada={setParadaAbierta}
            alReintentar={reintentar}
          />
        ))}

      {!campanaAbierta && lugar === "ira" && (
        <VistaIrA
          rutas={rutas}
          paradas={listaDeLaCiudad.datos?.paradas ?? []}
          paradasListas={listaDeLaCiudad.datos !== null}
          error={listaDeLaCiudad.error}
          alReintentar={listaDeLaCiudad.reintentar}
          alAbrirRuta={abrirRuta}
          alVerTodasLasRutas={verTodasLasRutas}
          guardadas={guardadas.guardadas}
        />
      )}

      {!campanaAbierta && lugar === "pase" && (
        <VistaPase
          volverAlInicio={volverAlInicioDelLugar}
          alVolverAlInicio={() => irA("inicio")}
          pase={elPase.pase}
          disponible={elPase.disponible}
          alComprar={elPase.comprar}
          alMostrar={elPase.mostrar}
          alAlternarCuenta={elPase.alternarCuenta}
        />
      )}

      {!campanaAbierta && enLaCiudad && panelAbierto && (
        <PanelDeRutas
          resto={filtro.resto}
          alCerrar={() => setPanelAbierto(false)}
          alAgregar={agregarRutas}
        />
      )}

      {/*
        * **La hoja vive encima del mapa, en la ciudad y en una ruta abierta.**
        * Su ruta es la CONSULTADA (`rutaDeLaHoja`), no la resaltada.
        */}
      {!campanaAbierta && enElMapa && parada && rutaDeLaHoja && (
        <HojaDeParada
          /*
           * La llave cambia con la parada Y con si es la asomada o la tocada:
           * tocar la misma parada que se estaba asomando tiene que abrirla en
           * la media, no dejarla donde estaba.
           */
          key={`${parada.id}:${laHojaEsLaAsomada ? "asomada" : "tocada"}`}
          nombre={parada.nombre}
          direccion={`Ruta ${rutaDeLaHoja.nombre} · ${nombreDeSentido(sentidoDeLaHoja) ?? (sentidoDeLaHoja === "ida" ? "ida" : "vuelta")}${
            hastaMi ? ` · hasta donde estás ${hastaMi}` : ""
          }`}
          fija={laHojaEsLaAsomada}
          alturaInicial={laHojaEsLaAsomada ? "asomada" : "media"}
          porQue={laHojaEsLaAsomada ? porQueEnPalabras(asomada!.porQue) : null}
          haciaDonde={nombreDeSentido(sentidoDeLaHoja) ?? null}
          delLetrero={paradaDelLetrero && paradaAbierta === paradaDelLetrero ? paradaDelLetrero : null}
          llegadas={llegadasDeLaHoja}
          porArrancar={
            vivo?.estado === "por_arrancar"
              ? { ruta: rutaDeLaHoja.nombre, arrancaEl: vivo.arranca_el }
              : null
          }
          promesa={promesaEnPalabras(vivo?.promesa ?? null, sentidoDeLaHoja) ?? ""}
          /* Sólo lo declarado lleva firma: ver el porqué en la prop. */
          promesaDeclarada={vivo?.promesa?.estado === "declarada"}
          guardada={guardadas.estaGuardada(parada.id)}
          sePuedeGuardar={guardadas.disponible}
          color={rutaDeLaHoja.color_hex}
          alGuardar={() => guardadas.alternar({ parada: parada.id, ruta: rutaDeLaHoja.circuito_id })}
          alCerrar={cerrarLaHoja}
          grupos={gruposDeLaHoja}
          direccionDosSentidos={`Ruta ${rutaDeLaHoja.nombre} · paran los dos sentidos`}
        />
      )}

      {!campanaAbierta && enElMapa && camiAhora && rutaEnfocada && (
        <HojaDeCami
          economico={camiAhora.economico}
          color={rutaEnfocada.color_hex}
          edad={haceNMinutos(camiAhora.antiguedad_seg)}
          fresca={camiAhora.fresco}
          paradas={paradasDeCami}
          alCerrar={() => setCamiTocado(null)}
        />
      )}

      <Barra activo={lugar} alIr={irA} />
    </div>
  );
}

/**
 * Lo que la escalera dice arriba de la lista de paradas cuando no hay servicio o no hay red
 * (8.9). Cada caso dice lo suyo: una ruta cerrada y una red caída son dos cosas.
 */
function avisoDeLaEscalera(
  vivo: { estado: string; abre_a: string; arranca_el: string | null } | null,
  error: boolean,
): string | null {
  if (error) return "No pudimos preguntar ahorita. Lo que ves es lo último que supimos.";
  if (!vivo) return null;
  if (vivo.estado === "por_arrancar") {
    const cuando = arranqueLargo(vivo.arranca_el ?? "");
    return cuando ? `Arranca el ${cuando}` : "Todavía no arranca";
  }
  if (vivo.estado === "fuera_de_horario") return `Fuera de horario · abre ${vivo.abre_a}`;
  return null;
}

/**
 * La lista de rutas se arma una vez en el servidor, y lo que dice —la promesa
 * de cada ruta, si está abierta— vale hasta la próxima frontera
 * (`vigenteHasta`). Justo entonces se vuelve a pedir: seguir diciendo la
 * promesa de una franja que ya terminó es afirmar algo que ya no es cierto.
 *
 * Con la pestaña escondida el reloj del teléfono puede dormir el temporizador;
 * al volver, si la frontera ya pasó, se pide en ese momento.
 *
 * Refrescar vuelve a correr el servidor de la portada: trae las rutas con sus
 * trazados, pero sólo en las fronteras (unas cuantas veces al día), no cada
 * minuto.
 */
function useListaAlDia(vigenteHasta: string | null) {
  const router = useRouter();
  useEffect(() => {
    if (!vigenteHasta) return;
    const limite = new Date(vigenteHasta).getTime();
    const refrescar = () => router.refresh();
    // Un segundo después de la frontera: en la frontera misma el servidor todavía podría leer la de antes.
    const espera = Math.max(0, limite - Date.now() + 1000);
    const t = window.setTimeout(refrescar, Math.min(espera, 2_147_000_000));
    const alVolver = () => {
      if (document.visibilityState === "visible" && Date.now() > limite) refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [vigenteHasta, router]);
}
