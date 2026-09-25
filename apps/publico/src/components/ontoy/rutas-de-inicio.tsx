"use client";

import { useMemo, useState } from "react";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { promesaEnPalabras } from "@/lib/ontoy/llegadas";
import { distanciaEnPalabras } from "@/lib/ontoy/distancia";
import { ordenarRutas, RUTAS_A_LA_VISTA } from "@/lib/ontoy/rutas-cerca";
import type { Ubicacion } from "@/lib/ubicacion";
import { arranqueCorto } from "@/lib/fecha-arranque";

/**
 * **Las rutas, en Inicio** (8.8; ASAV, 22-sep-2026).
 *
 * Tres rutas a la vista y el resto detrás de un botón que las despliega y las
 * vuelve a cerrar. Aquí vive **el único camino a la lista completa de la
 * ciudad**: «Ir a» quedó sólo como buscador.
 *
 * ## El renglón contesta la pregunta completa (ASAV, 22-sep, tarde)
 *
 * Con ubicación, cada ruta dice **por dónde se toma**: «por Hospital General,
 * a 120 m». Tocarla la abre en el Mapa **con esa parada abierta**, que es a
 * donde el pasajero iba a ir de todos modos.
 *
 * Esto sustituye a la sección «Paradas cerca de ti», que vivía arriba y decía
 * lo mismo con los mismos números —la misma ruta, la misma distancia, un
 * bloque encima del otro—. Una lista en vez de dos, y de paso el número se
 * vuelve comprobable: «a 120 m» suelto es una distancia abstracta; «a 120 m de
 * Hospital General» se verifica parándose ahí.
 *
 * ## El encabezado dice lo que la app de verdad sabe
 *
 * Con ubicación son **«Rutas cerca de ti»**, ordenadas por su parada más
 * cercana, y cada renglón enseña su distancia. Sin ubicación son **«Rutas de
 * la ciudad»**, en orden alfabético y **sin distancia**.
 *
 * Eso no es un detalle de redacción. Sin ubicación, tres rutas cualesquiera
 * tituladas «cerca de ti» son el dato correcto con la afirmación falsa (Marco
 * §D): la lista no miente, miente el título. Y la sección se enseña igual —con
 * tres rutas, no vacía— porque una sección vacía no le sirve a nadie; lo que
 * no se hace es llamarlas cercanas.
 *
 * El porqué de cada orden, y por qué el de «sin ubicación» no puede salir de
 * rastrear a nadie, vive en `lib/ontoy/rutas-cerca.ts`.
 *
 * ## Lo que el renglón NO dice, y por qué
 *
 * **No dice «hacia Centro».** Saber hacia dónde va un sentido necesita el
 * trazado de esa ruta, y traerlo aquí es una petición por ruta. Se dice al
 * abrirla, que es cuando importa.
 *
 * **No dice «en vivo».** De los camiones sólo sabemos los de tus rutas
 * favoritas, que llegan en la consulta única. Ponerlo en unas y no en otras se
 * leería como «las demás no traen camiones», y eso no lo sabemos.
 *
 * Lo que sí lleva cada una es **su promesa** —que se enseña aunque no haya una
 * sola unidad en vivo (8.2)— y, si está cerrada o todavía no arranca, eso.
 */
export function RutasDeInicio({
  rutas,
  estados,
  paradas,
  ubicacion,
  listaConError,
  alReintentarLista,
  alAbrirRuta,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /** Las paradas públicas de la ciudad; vacío mientras bajan o sin ubicación. */
  paradas: ParadaDeLaCiudad[];
  ubicacion: Ubicacion;
  /** No se pudo bajar la lista de paradas: hay rutas, pero no hay con qué medir. */
  listaConError: boolean;
  alReintentarLista: () => void;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: "ida" | "vuelta") => void;
}) {
  const [todas, setTodas] = useState(false);
  const { yo, estado, pedir, reintentar } = ubicacion;
  const { rutas: ordenadas, porDistancia } = useMemo(
    () => ordenarRutas(rutas, paradas, yo),
    [rutas, paradas, yo],
  );
  const estadoDe = useMemo(() => new Map(estados.map((e) => [e.circuito_id, e])), [estados]);

  if (rutas.length === 0) {
    return (
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Rutas de la ciudad</h2>
        <p className="ontoy-vacio">Todavía no hay rutas publicadas en esta ciudad.</p>
      </section>
    );
  }

  const ocultas = ordenadas.length - RUTAS_A_LA_VISTA;
  const visibles = todas ? ordenadas : ordenadas.slice(0, RUTAS_A_LA_VISTA);

  return (
    <section className="ontoy-seccion">
      <h2 className="ontoy-seccion-titulo">{porDistancia ? "Rutas cerca de ti" : "Rutas de la ciudad"}</h2>

      {visibles.map(({ ruta: r, entrada }) => {
        const e = estadoDe.get(r.circuito_id);
        return (
          <button
            key={r.circuito_id}
            type="button"
            className="ontoy-ruta"
            onClick={() => alAbrirRuta(r.circuito_id, entrada?.id, entrada?.sentido ?? undefined)}
          >
            {/* El color es identidad y NUNCA va solo: el nombre siempre lo acompaña (8.8c). */}
            <span className="ontoy-ruta-color" style={{ background: r.color_hex }} aria-hidden="true" />
            <span className="ontoy-ruta-info">
              <span className="ontoy-ruta-nombre">{r.nombre}</span>
              {/*
                Por dónde se toma, cuando se midió. Es el renglón que sustituyó
                a la sección de paradas cercanas: nombra el lugar Y su número,
                y el número se puede comprobar porque dice de qué.
              */}
              {entrada && (
                <span className="ontoy-ruta-entrada">
                  por <b>{entrada.nombre}</b>, {distanciaEnPalabras(entrada.distanciaM)}
                </span>
              )}
              <span className="ontoy-ruta-sub">
                {e?.situacion === "por_arrancar" && arranqueCorto(e.arranca_el ?? "")
                  ? `Arranca el ${arranqueCorto(e.arranca_el ?? "")}`
                  : e?.situacion === "cerrado"
                    ? `Fuera de horario · abre ${e.abre_a}`
                    : promesaEnPalabras(r.promesa, null)}
              </span>
            </span>
            <svg className="ontoy-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        );
      })}

      {ocultas > 0 && (
        <button
          type="button"
          className="ontoy-desplegar"
          aria-expanded={todas}
          onClick={() => setTodas((a) => !a)}
        >
          {todas ? "Ver menos" : `Ver todas las rutas (${ordenadas.length})`}
          <span className="ontoy-desplegar-flecha" aria-hidden="true">{todas ? "▴" : "▾"}</span>
        </button>
      )}

      {!porDistancia && <SinCercania estado={estado} conError={listaConError} alPedir={pedir} alReintentar={estado === "sin-senal" ? reintentar : alReintentarLista} />}

      <p className="ontoy-vacio ontoy-rutas-nota">
        {porDistancia
          ? "Se ordenan por la parada más cercana a ti, y ésa es la que se abre al tocarlas. La distancia es en línea recta, no caminando."
          : "En orden alfabético."}{" "}
        El color de cada ruta es el que sus camiones traen pintado en la calle — la app lo registra, no lo
        inventa. Sólo se muestran rutas publicadas.
      </p>
    </section>
  );
}

/**
 * Lo que se dice cuando las rutas NO se pudieron ordenar por cercanía.
 *
 * **Ninguno de estos casos es un callejón**, y por eso ninguno se lleva la
 * pantalla: la lista de rutas está completa y sirve igual, en orden alfabético.
 * Aquí sólo se explica por qué no hay distancias, y se ofrece lo que sí se
 * puede hacer al respecto.
 *
 * Antes estos estados vivían en la sección de paradas cercanas, y ahí **sí**
 * eran bloqueantes —sin ubicación esa sección no tenía nada que enseñar—, así
 * que cada uno ocupaba un párrafo y un botón al Mapa. Fundida con las rutas, la
 * pantalla siempre tiene algo que contestar y esto vuelve a ser una nota.
 *
 * Cada caso dice lo suyo: un permiso que no se ha pedido, uno negado, un
 * teléfono que no la da y una lista que no bajó son cuatro cosas distintas, y
 * juntarlas en «no se pudo» le quitaría al pasajero lo único que le dice si hay
 * algo que él pueda hacer.
 */
function SinCercania({
  estado,
  conError,
  alPedir,
  alReintentar,
}: {
  estado: Ubicacion["estado"];
  conError: boolean;
  alPedir: () => void;
  alReintentar: () => void;
}) {
  if (estado === "sin-pedir") {
    return (
      <>
        <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alPedir}>
          Ver rutas cerca de mí
        </button>
        {/* El PARA QUÉ, antes de que el teléfono pregunte. */}
        <p className="ontoy-porque">
          Tu ubicación se usa para ordenarlas por cuál te queda más cerca y decirte por dónde tomarlas.
        </p>
      </>
    );
  }
  if (estado === "buscando") return <p className="ontoy-porque">Buscando dónde estás…</p>;
  if (estado === "negada") {
    return (
      <p className="ontoy-porque">
        Sin tu ubicación no podemos ordenarlas por cercanía, y la app funciona igual. Si cambias de idea,
        dale permiso de ubicación a esta app en los ajustes de tu teléfono o de tu navegador.
      </p>
    );
  }
  if (estado === "no-disponible") {
    return <p className="ontoy-porque">Este teléfono no nos da tu ubicación, así que no podemos ordenarlas por cercanía.</p>;
  }
  if (estado === "sin-senal") {
    return (
      <>
        <p className="ontoy-porque">
          Tu teléfono no nos da tu posición ahorita. Revisa que la ubicación esté prendida, o intenta donde
          haya mejor señal.
        </p>
        <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alReintentar}>
          Reintentar
        </button>
      </>
    );
  }
  /* Permiso concedido: o la lista no bajó, o bajó y ninguna ruta tiene paradas. */
  if (conError) {
    return (
      <>
        <p className="ontoy-porque">No pudimos traer las paradas ahorita, así que no podemos ordenarlas por cercanía.</p>
        <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alReintentar}>
          Reintentar
        </button>
      </>
    );
  }
  return null;
}
