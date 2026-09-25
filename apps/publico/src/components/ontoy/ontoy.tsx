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
import { CabezaDeRuta } from "@/components/ontoy/cabeza-de-ruta";
import { VistaParadas } from "@/components/ontoy/vista-paradas";
import { armarParadas, haciaDonde } from "@/lib/ontoy/paradas-de-la-ruta";
import { rutasFavoritas } from "@/lib/ontoy/favoritas";
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
  nombre,
  rutas,
  estados,
  vigenteHasta,
  rutaInicial,
  paradaInicial,
}: {
  /** De configuración, nunca del código: `NEXT_PUBLIC_APP_NOMBRE`. */
  nombre: string;
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /** Hasta cuándo vale lo que dice la lista (ISO); en ese instante se vuelve a pedir. */
  vigenteHasta: string | null;
  /**
   * La ruta que la dirección pidió (`/?ruta=…`, o una liga vieja `/c/‹slug›`).
   * Cuando viene, la app abre en el Mapa con esa ruta enfocada: quien llega por
   * una liga compartida quiere ver ESA ruta, no la lista de la ciudad.
   */
  rutaInicial: string | null;
  /**
   * La parada que la dirección pidió, por el slug de su QR (`/p/‹qr_slug›`).
   *
   * Quien llega escaneando un letrero atornillado a un poste está **parado en
   * esa parada**: la app abre en su hoja, no en la lista de la ciudad ni en la
   * ruta entera. La parada se abre sobre su ruta, que viene en `rutaInicial`.
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
  const [lugar, setLugar] = useState<Lugar>(pedida ? "mapa" : "inicio");
  const [enfocada, setEnfocada] = useState<string | null>(pedida ?? rutas[0]?.circuito_id ?? null);
  const [sentido, setSentido] = useState<Sentido>("ida");
  /* Con `paradaInicial` la app nace con la hoja abierta: quien escaneó el
     letrero está parado ahí. Cerrarla lo deja en su ruta, no en la nada. */
  const [paradaAbierta, setParadaAbierta] = useState<string | null>(
    pedida ? paradaInicial : null,
  );
  /**
   * Una ruta ABIERTA: su cabeza teñida y sus paradas o su mapa (8.8, 8.8d). Quien
   * llega por la liga de una ruta la ve abierta; el Mapa sin ruta abierta es el
   * de la ciudad.
   */
  const [rutaAbierta, setRutaAbierta] = useState<boolean>(pedida !== null);
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
  const [paradaTocada, setParadaTocada] = useState<{ ruta: string; parada: string } | null>(null);
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
  const consultada = abierta ?? (enLaCiudad ? (paradaTocada?.ruta ?? null) : null);
  const ubicacion = useUbicacion({ pedirAlAbrir: false });
  const yo = ubicacion.yo;
  // La única escritura de la app: una apertura por ruta abierta (8.7).
  // Mirar tus favoritas en el mapa de la ciudad no es abrir una ruta: no cuenta.
  useContarApertura(enElMapa && rutaAbierta ? enfocada : null);
  /*
   * Y la apertura de la PARADA, que es otra cifra y otra tabla (ASAV, 25-sep).
   * Cuelga de que la hoja esté abierta, así que cuenta las tres formas de
   * llegar a ella: el toque en el mapa de la ciudad, el toque dentro de una
   * ruta abierta, y el letrero escaneado.
   */
  useContarAperturaDeParada(enElMapa ? consultada : null, enElMapa ? paradaAbierta : null);

  /*
   * El filtro del Mapa (ASAV, 22-sep): qué rutas se dibujan. `apagadas` son las
   * que el pasajero apagó tocando su chip; `agregadas`, las lejanas que escogió
   * en el panel. **Ninguna de las dos se guarda**: al volver a abrir el Mapa,
   * todas las de la tira están prendidas otra vez (8.7).
   */
  const [apagadas, setApagadas] = useState<Set<string>>(new Set());
  const [agregadas, setAgregadas] = useState<Set<string>>(new Set());
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
    setCampanaAbierta(true);
    setParadaAbierta(null);
    setParadaTocada(null);
  }, []);
  useEffect(() => {
    // Abierta, lo que está en pantalla queda visto: el punto se apaga.
    if (campanaAbierta) marcarVistos(avisos.map((a) => a.id));
  }, [campanaAbierta, avisos, marcarVistos]);
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
  const paradasGuardadasEnElMapa = useMemo(() => {
    const todas = listaDeLaCiudad.datos?.paradas ?? [];
    return guardadas.guardadas.flatMap((g) => {
      const p = todas.find((x) => x.id === g.parada && x.ruta === g.ruta);
      return p ? [{ id: p.id, ruta: p.ruta, nombre: p.nombre, lat: p.lat, lon: p.lon, sentido: p.sentido }] : [];
    });
  }, [listaDeLaCiudad.datos, guardadas.guardadas]);

  const abrirRuta = useCallback((circuitoId: string, parada?: string, enSentido?: Sentido) => {
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
  const irA = useCallback((l: Lugar) => {
    setLugar(l);
    setRutaAbierta(false);
    setParadaAbierta(null);
    setParadaTocada(null);
    setCampanaAbierta(false);
    setVolverAlInicioDelLugar((n) => n + 1);
  }, []);

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
    }),
    [filtro, enVivo.vivos, paradasGuardadasEnElMapa, paradasDeLaCiudad, verParadas, alternarRuta, abrirRuta, tocarParadaDeLaCiudad],
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
  const parada = forma?.paradas.find((p) => p.id === paradaAbierta) ?? null;

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
  const llegadasDeLaHoja = useMemo((): LlegadaEnLaHoja[] => {
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

    const abscisa = dondeCaeLaParada(parada, trazadoPorSentido.get(sentido), forma.corredor_m);
    if (abscisa === null) {
      return [{ rotulo: "Sin dato en este sentido", apoyo: "esta parada no cae en el trazado de ida y vuelta", vieja: true }];
    }
    const lista = llegadasHasta(
      { avanceMetros: abscisa, sentido },
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
    const porParadas = paradasHastaLaParada({ avanceMetros: abscisa, sentido }, { forma, vivo, trazadoPorSentido });
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
  }, [forma, parada, vivo, error, sentido, trazadoPorSentido, velocidad.kmh]);

  /* 8.3b: hasta donde está el pasajero, calculado aquí y sin que salga nada. */
  const hastaMi = useMemo(() => {
    if (!forma || !vivo || !yo) return null;
    const trazado = trazadoPorSentido.get(sentido);
    const mi = trazado ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
    if (!mi) return null;
    const l = llegadasHasta(
      { avanceMetros: mi.avanceMetros, sentido },
      { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
    )[0];
    return l ? rangoEnPalabras(l.rango) : null;
  }, [forma, vivo, yo, sentido, trazadoPorSentido, velocidad.kmh]);

  return (
    <div className="ontoy">
      <header className="ontoy-cabeza">
        <LogoOntoy />
        <h1 className="ontoy-marca">{nombre}</h1>
        <Campana nuevos={hayAvisosNuevos(avisos, vistos)} abierta={campanaAbierta} alTocar={abrirCampana} />
        <button type="button" className="ontoy-piel" onClick={alternarPiel} aria-label="Cambiar entre piel de día y de noche">
          {deNoche ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
      </header>

      {campanaAbierta && (
        <VistaAvisos
          avisos={avisos}
          telefono={telefono.avisos}
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
        />
      )}

      {!campanaAbierta && lugar === "pase" && (
        <VistaPase
          volverAlInicio={volverAlInicioDelLugar}
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
          nombre={parada.nombre}
          direccion={`Ruta ${rutaDeLaHoja.nombre} · ${nombreDeSentido(sentido) ?? (sentido === "ida" ? "ida" : "vuelta")}${
            hastaMi ? ` · hasta donde estás ${hastaMi}` : ""
          }`}
          llegadas={llegadasDeLaHoja}
          porArrancar={
            vivo?.estado === "por_arrancar"
              ? { ruta: rutaDeLaHoja.nombre, arrancaEl: vivo.arranca_el }
              : null
          }
          promesa={promesaEnPalabras(vivo?.promesa ?? null, sentido) ?? ""}
          /* Sólo lo declarado lleva firma: ver el porqué en la prop. */
          promesaDeclarada={vivo?.promesa?.estado === "declarada"}
          guardada={guardadas.estaGuardada(parada.id)}
          sePuedeGuardar={guardadas.disponible}
          color={rutaDeLaHoja.color_hex}
          alGuardar={() => guardadas.alternar({ parada: parada.id, ruta: rutaDeLaHoja.circuito_id })}
          alCerrar={cerrarLaHoja}
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
 * La campana (8.13b): abre los avisos de tus rutas. **El punto se prende sólo
 * con avisos de la concesión que no has visto** — nunca por los del teléfono
 * (decisión de ASAV, 22-sep): una campana que grita por cada señal caída se
 * vuelve invisible. El punto es forma (un círculo lleno), no un color de alarma.
 */
function Campana({ nuevos, abierta, alTocar }: { nuevos: boolean; abierta: boolean; alTocar: () => void }) {
  return (
    <button
      type="button"
      className="ontoy-campana"
      onClick={alTocar}
      aria-pressed={abierta}
      aria-label={nuevos ? "Avisos de tus rutas, hay nuevos" : "Avisos de tus rutas"}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
      </svg>
      {nuevos && <span className="ontoy-campana-punto" aria-hidden="true" />}
    </button>
  );
}

/** El logo de Ontoy. Su identidad es de Ontoy, no de la plataforma. */
function LogoOntoy() {
  return (
    <svg className="ontoy-logo" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 54 C22 54 26 40 32 30" fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M32 30 L26 40 L38 38 Z" fill="currentColor" />
      <circle cx="46" cy="17" r="9.5" fill="currentColor" />
      <circle cx="46" cy="17" r="3.6" className="ontoy-logo-ojo" />
    </svg>
  );
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
