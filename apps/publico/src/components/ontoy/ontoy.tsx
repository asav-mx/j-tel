"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTema } from "@/lib/tema";
import { useUbicacion } from "@/lib/ubicacion";
import { avanceSobreTrazado } from "@jtel/domain";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import {
  dondeCaeLaParada,
  llegadasHasta,
  paradasEnPalabras,
  paradasHastaLaParada,
  promesaEnPalabras,
  rangoEnPalabras,
  useVelocidadDelCorredor,
} from "@/lib/ontoy/llegadas";
import { useContarApertura } from "@/lib/ontoy/apertura";
import { useParadasGuardadas } from "@/lib/ontoy/paradas-guardadas";
import { useRutaEnVivo } from "@/lib/ontoy/ruta-en-vivo";
import { HojaDeParada, type LlegadaEnLaHoja } from "@/components/ontoy/hoja-de-parada";
import { VistaMapa } from "@/components/ontoy/vista-mapa";
import { VistaRutas, type EstadoDeRuta } from "@/components/ontoy/vista-rutas";
import { VistaInicio } from "@/components/ontoy/vista-inicio";
import { LugarReservado } from "@/components/ontoy/lugar-reservado";
import { Barra, type Lugar } from "@/components/ontoy/barra";
import { CabezaDeRuta } from "@/components/ontoy/cabeza-de-ruta";
import { VistaHilo } from "@/components/ontoy/vista-hilo";
import { armarHilo, haciaDonde } from "@/lib/ontoy/hilo";
import { rutasEnVivo, rutasFavoritas } from "@/lib/ontoy/favoritas";
import { useEnVivo } from "@/lib/ontoy/en-vivo";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";

/**
 * **Ontoy** — el cascarón de los cuatro lugares (8.8, 22-sep).
 *
 * **Inicio · Mapa · Ir a · Pase**, con la barra abajo. La app abre en Inicio,
 * contestando: la parada guardada con su próximo camión, o las paradas cerca
 * del pasajero. Quien llega por la liga de una ruta abre en el Mapa con esa
 * ruta enfocada. **Ir a** y **Pase** son lugares reservados hasta que existan
 * el planeador (8.16) y la cartera (8.14).
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
}) {
  const { deNoche, alternar: alternarPiel } = useTema();
  const pedida = rutaInicial && rutas.some((r) => r.circuito_id === rutaInicial) ? rutaInicial : null;
  const [lugar, setLugar] = useState<Lugar>(pedida ? "mapa" : "inicio");
  /** La lista de todas las rutas, abierta encima del Mapa. */
  const [listaAbierta, setListaAbierta] = useState(false);
  const [enfocada, setEnfocada] = useState<string | null>(pedida ?? rutas[0]?.circuito_id ?? null);
  const [sentido, setSentido] = useState<Sentido>("ida");
  const [paradaAbierta, setParadaAbierta] = useState<string | null>(null);
  /**
   * Una ruta ABIERTA: su cabeza teñida y su hilo o su mapa (8.8, 8.8d). Quien
   * llega por la liga de una ruta la ve abierta; el Mapa sin ruta abierta es el
   * de la ciudad.
   */
  const [rutaAbierta, setRutaAbierta] = useState<boolean>(pedida !== null);
  const [modo, setModo] = useState<"hilo" | "mapa">("hilo");

  const guardadas = useParadasGuardadas();
  useListaAlDia(vigenteHasta);
  const enElMapa = lugar === "mapa" && !listaAbierta;
  /** El Mapa de la ciudad (PR 3b): en el Mapa, sin ruta abierta. */
  const enLaCiudad = enElMapa && !rutaAbierta;
  // La ruta ABIERTA sondea la suya; el mapa de la ciudad no abre ninguna.
  const { forma, vivo, error, reintentar } = useRutaEnVivo(enElMapa && rutaAbierta ? enfocada : null);
  const { velocidad, trazadoPorSentido } = useVelocidadDelCorredor(forma, vivo);
  const ubicacion = useUbicacion({ pedirAlAbrir: false });
  const yo = ubicacion.yo;
  // La única escritura de la app: una apertura por ruta abierta (8.7).
  // Mirar tus favoritas en el mapa de la ciudad no es abrir una ruta: no cuenta.
  useContarApertura(enElMapa && rutaAbierta ? enfocada : null);

  /*
   * Tus favoritas, en vivo y en UNA consulta cada 15 s (PR 3b, decisión de ASAV):
   * sólo las prendidas, y ninguna petición si no hay.
   */
  const [apagadas, setApagadas] = useState<Set<string>>(new Set());
  const favoritas = useMemo(
    () => rutasFavoritas(guardadas.guardadas, rutas.map((r) => r.circuito_id)),
    [guardadas.guardadas, rutas],
  );
  const prendidas = useMemo(() => rutasEnVivo(favoritas, apagadas), [favoritas, apagadas]);
  const favoritasEnVivo = useEnVivo(enLaCiudad ? prendidas : []);
  const listaDeLaCiudad = useParadasDeLaCiudad(enLaCiudad && guardadas.guardadas.length > 0);
  const paradasGuardadasEnElMapa = useMemo(() => {
    const todas = listaDeLaCiudad.datos?.paradas ?? [];
    return guardadas.guardadas.flatMap((g) => {
      const p = todas.find((x) => x.id === g.parada && x.ruta === g.ruta);
      return p ? [{ id: p.id, ruta: p.ruta, nombre: p.nombre, lat: p.lat, lon: p.lon }] : [];
    });
  }, [listaDeLaCiudad.datos, guardadas.guardadas]);

  const abrirRuta = useCallback((circuitoId: string, parada?: string, enSentido?: Sentido) => {
    setEnfocada(circuitoId);
    setParadaAbierta(parada ?? null);
    if (enSentido) setSentido(enSentido);
    setListaAbierta(false);
    setRutaAbierta(true);
    setModo("hilo");
    setLugar("mapa");
  }, []);

  const irA = useCallback((l: Lugar) => {
    setLugar(l);
    setListaAbierta(false);
    setRutaAbierta(false);
    setParadaAbierta(null);
  }, []);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;

  /*
   * El Mapa de la ciudad, en UN objeto estable: los marcadores se redibujan
   * cuando cambia lo que dicen, no en cada render. Recreado en cada render, un
   * camión se borraba y se volvía a pintar bajo el dedo del pasajero — lo
   * enseñó la revisión en el navegador, cuando el toque no le atinaba.
   */
  const alternarFavorita = useCallback(
    (ruta: string) =>
      setApagadas((antes) => {
        const siguiente = new Set(antes);
        if (siguiente.has(ruta)) siguiente.delete(ruta);
        else siguiente.add(ruta);
        return siguiente;
      }),
    [],
  );
  const ciudad = useMemo(
    () => ({
      favoritas,
      prendidas: new Set(prendidas),
      vivos: favoritasEnVivo.vivos,
      guardadas: paradasGuardadasEnElMapa,
      alAlternar: alternarFavorita,
      alAbrirRuta: (ruta: string, parada?: string) => abrirRuta(ruta, parada),
    }),
    [favoritas, prendidas, favoritasEnVivo.vivos, paradasGuardadasEnElMapa, alternarFavorita, abrirRuta],
  );

  /* El hilo de la ruta abierta: se arma en `lib/ontoy/hilo.ts`, aquí sólo se pide. */
  const renglones = useMemo(
    () =>
      forma
        ? armarHilo({
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
          rotulo: vivo.arranca_el ? `Arranca el ${vivo.arranca_el}` : "Todavía no arranca",
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
        vieja: true,
        pasada: true,
      }));
    if (enMinutos.length > 0) return [...enMinutos, ...viejas].slice(0, 3);

    const frescas: LlegadaEnLaHoja[] = porParadas
      .filter((p) => p.fresca)
      .map((p, i) => ({
        rotulo: paradasEnPalabras(p.paradas),
        apoyo: `viene la ${p.unidad} · ${haceNMinutos(p.antiguedadSeg)}`,
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

      {lugar === "inicio" && (
        <VistaInicio
          rutas={rutas}
          guardadas={guardadas.guardadas}
          guardadasListas={guardadas.listo}
          puedeGuardar={guardadas.disponible}
          ubicacion={ubicacion}
          alAbrirRuta={abrirRuta}
          alQuitarGuardada={guardadas.alternar}
          alIrAlMapa={() => irA("mapa")}
        />
      )}

      {lugar === "mapa" &&
        (listaAbierta ? (
          <VistaRutas
            rutas={rutas}
            estados={estados}
            alAbrirRuta={(id) => abrirRuta(id)}
            alVolver={() => setListaAbierta(false)}
          />
        ) : rutaAbierta && rutaEnfocada ? (
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
            {modo === "hilo" ? (
              <VistaHilo
                renglones={renglones}
                cargando={!forma || !vivo}
                aviso={avisoDeLaEscalera(vivo, error)}
                promesa={promesaEnPalabras(vivo?.promesa ?? rutaEnfocada.promesa ?? null, sentido) ?? ""}
                color={rutaEnfocada.color_hex}
                paradaMarcada={paradaAbierta}
                alTocarParada={setParadaAbierta}
              />
            ) : (
          <VistaMapa
              rutaAbierta
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
            alVerTodas={() => {
              setParadaAbierta(null);
              setListaAbierta(true);
            }}
          />
            )}
          </>
        ) : (
          <VistaMapa
            ciudad={ciudad}
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
            alVerTodas={() => {
              setParadaAbierta(null);
              setListaAbierta(true);
            }}
          />
        ))}

      {lugar === "ira" && (
        <LugarReservado titulo="Ir a" alIrAlMapa={() => irA("mapa")}>
          <p>
            Aquí vas a escribir a dónde vas, y la app te va a armar el viaje, con o sin transbordo.{" "}
            <b>El planeador llega pronto.</b>
          </p>
          <p>Mientras, en el Mapa están todas las rutas con sus paradas y sus camiones en vivo.</p>
        </LugarReservado>
      )}

      {lugar === "pase" && (
        <LugarReservado titulo="Tu pase" alIrAlMapa={() => irA("mapa")}>
          <p>
            Aquí va a vivir tu pase para pagar el camión con el teléfono. <b>Llega después.</b>
          </p>
          <p>Mientras, pagas tu camión como siempre. Nada de esta app te pide cuenta ni dinero.</p>
        </LugarReservado>
      )}

      {enElMapa && parada && rutaEnfocada && (
        <HojaDeParada
          nombre={parada.nombre}
          direccion={`Ruta ${rutaEnfocada.nombre} · ${nombreDeSentido(sentido) ?? (sentido === "ida" ? "ida" : "vuelta")}${
            hastaMi ? ` · hasta donde estás ${hastaMi}` : ""
          }`}
          llegadas={llegadasDeLaHoja}
          promesa={promesaEnPalabras(vivo?.promesa ?? null, sentido) ?? ""}
          guardada={guardadas.estaGuardada(parada.id)}
          sePuedeGuardar={guardadas.disponible}
          color={rutaEnfocada.color_hex}
          alGuardar={() => guardadas.alternar({ parada: parada.id, ruta: rutaEnfocada.circuito_id })}
          alCerrar={() => setParadaAbierta(null)}
        />
      )}

      <Barra activo={lugar} alIr={irA} />
    </div>
  );
}

/**
 * Lo que la escalera dice arriba del hilo cuando no hay servicio o no hay red
 * (8.9). Cada caso dice lo suyo: una ruta cerrada y una red caída son dos cosas.
 */
function avisoDeLaEscalera(
  vivo: { estado: string; abre_a: string; arranca_el: string | null } | null,
  error: boolean,
): string | null {
  if (error) return "No pudimos preguntar ahorita. Lo que ves es lo último que supimos.";
  if (!vivo) return null;
  if (vivo.estado === "por_arrancar") return vivo.arranca_el ? `Arranca el ${vivo.arranca_el}` : "Todavía no arranca";
  if (vivo.estado === "fuera_de_horario") return `Fuera de horario · abre ${vivo.abre_a}`;
  return null;
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
