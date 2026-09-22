"use client";

import { useMemo, useState } from "react";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { promesaEnPalabras } from "@/lib/ontoy/llegadas";
import { distanciaEnPalabras } from "@/lib/ontoy/paradas-cerca";
import { ordenarRutas, RUTAS_A_LA_VISTA } from "@/lib/ontoy/rutas-cerca";

/**
 * **Las rutas, en Inicio** (8.8; ASAV, 22-sep-2026).
 *
 * Tres rutas a la vista y el resto detrás de un botón que las despliega y las
 * vuelve a cerrar. Tocar una la abre en el Mapa. Aquí vive **el único camino a
 * la lista completa de la ciudad**: «Ir a» quedó sólo como buscador.
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
  yo,
  puedePedirUbicacion,
  alPedirUbicacion,
  alAbrirRuta,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /** Las paradas públicas de la ciudad; vacío mientras bajan o sin ubicación. */
  paradas: ParadaDeLaCiudad[];
  yo: { lat: number; lon: number } | null;
  /**
   * Si esta sección debe ofrecer el botón de ubicación.
   *
   * **Una sola petición de permiso por pantalla.** Sin paradas guardadas, la
   * sección de arriba ya la pide («Ver paradas cerca de mí») y concederla
   * ordena las dos: repetir el botón aquí sería pedir dos veces lo mismo.
   */
  puedePedirUbicacion: boolean;
  alPedirUbicacion: () => void;
  alAbrirRuta: (circuitoId: string) => void;
}) {
  const [todas, setTodas] = useState(false);
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

      {visibles.map(({ ruta: r, distanciaM }) => {
        const e = estadoDe.get(r.circuito_id);
        return (
          <button
            key={r.circuito_id}
            type="button"
            className="ontoy-ruta"
            onClick={() => alAbrirRuta(r.circuito_id)}
          >
            {/* El color es identidad y NUNCA va solo: el nombre siempre lo acompaña (8.8c). */}
            <span className="ontoy-ruta-color" style={{ background: r.color_hex }} aria-hidden="true" />
            <span className="ontoy-ruta-info">
              <span className="ontoy-ruta-nombre">{r.nombre}</span>
              <span className="ontoy-ruta-sub">
                {e?.situacion === "por_arrancar" && e.arranca_el
                  ? `Arranca el ${e.arranca_el}`
                  : e?.situacion === "cerrado"
                    ? `Fuera de horario · abre ${e.abre_a}`
                    : promesaEnPalabras(r.promesa, null)}
              </span>
            </span>
            {/* Sin distancia medida no va número: el hueco se calla, no se rellena. */}
            {distanciaM !== null && (
              <span className="ontoy-ruta-distancia mono">{distanciaEnPalabras(distanciaM)}</span>
            )}
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

      {puedePedirUbicacion && !porDistancia && (
        <>
          <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alPedirUbicacion}>
            Ver rutas cerca de mí
          </button>
          {/* El PARA QUÉ, antes de que el teléfono pregunte. */}
          <p className="ontoy-porque">Tu ubicación se usa para ordenar las rutas por cuál te queda más cerca.</p>
        </>
      )}

      <p className="ontoy-vacio ontoy-rutas-nota">
        {porDistancia
          ? "Se ordenan por su parada más cercana a ti. La distancia es en línea recta, no caminando."
          : "En orden alfabético."}{" "}
        El color de cada ruta es el que sus camiones traen pintado en la calle — la app lo registra, no lo
        inventa. Sólo se muestran rutas publicadas.
      </p>
    </section>
  );
}
