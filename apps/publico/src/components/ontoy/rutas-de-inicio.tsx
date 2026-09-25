"use client";

import { useMemo } from "react";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { promesaEnPalabras } from "@/lib/ontoy/llegadas";
import { distanciaEnPalabras } from "@/lib/ontoy/distancia";
import { ordenarRutas } from "@/lib/ontoy/rutas-cerca";
import type { Ubicacion } from "@/lib/ubicacion";
import { arranqueCorto } from "@/lib/fecha-arranque";

/**
 * **Las rutas, en Inicio** (8.8; ASAV, 22-sep y 25-sep).
 *
 * **Todas, en renglones compactos** con su franja de color, como en
 * `1-inicio/01` y `02`. Sin botón de «Ver todas»: con renglones compactos la
 * ciudad cabe, y un botón grande para desplegarla era la pantalla vieja.
 *
 * ## El renglón contesta la pregunta completa (ASAV, 22-sep, tarde)
 *
 * Con ubicación, cada ruta dice **por dónde se toma**: «por Hospital General,
 * a 120 m». Tocarla la abre en el Mapa **con esa parada abierta**, que es a
 * donde el pasajero iba a ir de todos modos. «a 120 m de Hospital General» se
 * verifica parándose ahí; «a 120 m» suelto, no.
 *
 * ## El encabezado dice lo que la app de verdad sabe
 *
 * Con ubicación son **«Rutas cerca de ti»**, ordenadas por su parada más
 * cercana, «en línea recta». Sin ubicación son **«Rutas de la ciudad»**, «en
 * orden alfabético» y **sin distancia**. Tres rutas cualesquiera tituladas
 * «cerca de ti» serían el dato correcto con la afirmación falsa (Marco §D): la
 * lista no miente, miente el título.
 *
 * ## Lo que ya no se dice aquí (ASAV, 25-sep)
 *
 * La ubicación **se pide una sola vez**, en la tarjeta de Ontoy de la
 * bienvenida: el botón «Ver rutas cerca de mí» se fue. Y los párrafos que
 * explicaban el orden, el color y el permiso negado se mudaron a «Qué datos
 * usa la app»: lo que es ley va ahí, no en la pantalla. Lo que queda es lo que
 * el pasajero puede HACER: si el teléfono no dio su posición o la lista no
 * bajó, un «Reintentar» chico junto al contexto.
 *
 * ## Lo que el renglón NO dice, y por qué
 *
 * **No dice «hacia Centro»**: saber hacia dónde va un sentido necesita el
 * trazado de esa ruta, una petición por ruta. **No dice «en vivo»**: de los
 * camiones sólo sabemos los de tus rutas guardadas. Lo que sí lleva es **su
 * promesa** (8.2) y, si está cerrada o todavía no arranca, eso — **sin
 * frecuencia**, que una ruta que no ha arrancado no promete.
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
  const { yo, estado, reintentar } = ubicacion;
  const { rutas: ordenadas, porDistancia } = useMemo(
    () => ordenarRutas(rutas, paradas, yo),
    [rutas, paradas, yo],
  );
  const estadoDe = useMemo(() => new Map(estados.map((e) => [e.circuito_id, e])), [estados]);

  if (rutas.length === 0) {
    return (
      <section className="ontoy-seccion" id="ontoy-rutas">
        <h2 className="ontoy-inicio-seccion-titulo">Rutas de la ciudad</h2>
        <p className="ontoy-vacio">Todavía no hay rutas publicadas en esta ciudad.</p>
      </section>
    );
  }

  /*
   * El contexto de la derecha. Cuando no se pudo medir y el pasajero puede
   * hacer algo, se dice y se ofrece; si no, sólo el orden.
   */
  const reintentable = estado === "sin-senal" || (estado === "concedida" && listaConError);
  /*
   * **Cada caso dice lo suyo** (Marco 8.8, tercera enmienda del 22-sep): un
   * permiso negado, un teléfono que no la da y una lista que no bajó son cosas
   * distintas, y juntarlas en «no se pudo» le quita al pasajero saber si hay
   * algo que él pueda hacer. Ya no en un párrafo: en el contexto, corto.
   */
  const contexto = porDistancia
    ? "en línea recta"
    : estado === "buscando"
      ? "buscando dónde estás…"
      : estado === "sin-senal"
        ? "tu teléfono no dio tu posición"
        : reintentable
          ? "no pude bajar las paradas"
          : estado === "negada"
            ? "en orden alfabético · sin permiso de ubicación"
            : estado === "no-disponible"
              ? "en orden alfabético · el teléfono no da ubicación"
              : "en orden alfabético";

  return (
    /* El ancla de «Buscar mi parada» de la bienvenida: una liga de verdad, sin JavaScript. */
    <section className="ontoy-seccion" id="ontoy-rutas">
      <div className="ontoy-inicio-seccion-cabeza">
        <h2 className="ontoy-inicio-seccion-titulo">{porDistancia ? "Rutas cerca de ti" : "Rutas de la ciudad"}</h2>
        <span className="ontoy-inicio-seccion-contexto">
          {contexto}
          {reintentable && (
            <>
              {" · "}
              <button
                type="button"
                className="ontoy-liga"
                onClick={estado === "sin-senal" ? reintentar : alReintentarLista}
              >
                Reintentar
              </button>
            </>
          )}
        </span>
      </div>

      <div className="ontoy-renglones">
        {ordenadas.map(({ ruta: r, entrada }) => {
          const e = estadoDe.get(r.circuito_id);
          const cuando = e?.situacion === "por_arrancar" ? arranqueCorto(e.arranca_el ?? "") : null;
          return (
            <button
              key={r.circuito_id}
              type="button"
              className="ontoy-renglon"
              style={{ ["--ruta" as string]: r.color_hex }}
              onClick={() => alAbrirRuta(r.circuito_id, entrada?.id, entrada?.sentido ?? undefined)}
            >
              {/* El color es identidad y NUNCA va solo: el nombre siempre lo acompaña (8.8c). */}
              <span className="ontoy-franja-vertical" aria-hidden="true" />
              <span className="ontoy-renglon-texto">
                <span className="ontoy-renglon-titulo">{r.nombre}</span>
                {entrada && (
                  <span className="ontoy-renglon-sub">
                    por <b>{entrada.nombre}</b>, {distanciaEnPalabras(entrada.distanciaM)}
                  </span>
                )}
                <span className="ontoy-renglon-sub">
                  {e?.situacion === "por_arrancar"
                    ? cuando
                      ? `Arranca el ${cuando}`
                      : "Todavía no arranca"
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
      </div>
    </section>
  );
}
