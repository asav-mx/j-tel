"use client";

import { useMemo, useState } from "react";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import {
  emparejarLugares,
  MAXIMO_SUGERENCIAS,
  type ParadaBuscable,
  type RutaBuscable,
} from "@/lib/ontoy/buscar-lugar";

/**
 * **Ir a** — la única búsqueda de la app (8.8; ASAV, 22-sep).
 *
 * El pasajero escribe el nombre de una parada o de una ruta y la app se la
 * abre en el Mapa. Debajo del campo vive el único camino a **todas las rutas**
 * de la ciudad.
 *
 * ## Lo que esta pantalla NO hace todavía, dicho en la pantalla
 *
 * Aquí va a vivir el **planeador** (8.16): a dónde vas, y la app arma el viaje
 * con o sin transbordo. No está, y **no se finge**. El planeador necesita
 * recorridos medidos —cuánto tarda de verdad cada tramo— y hasta que existan,
 * un total sería una llegada inventada (8.9, 8.16 regla 4). Mientras tanto
 * esto contesta la pregunta más chica que sí se puede contestar sin mentir:
 * *dónde está esa parada y qué ruta pasa por ella*.
 *
 * Esto **no es un lugar reservado**: es una pantalla que sirve hoy y que va a
 * crecer. Por eso no dice «llega pronto» y ya, sino qué hace y qué le falta.
 *
 * ## El límite se declara
 *
 * Empareja **nombres de parada y de ruta, no direcciones**. Se dice debajo del
 * campo, en vez de dejar que el pasajero que escribió su calle crea que
 * escribió mal. El porqué —un buscador de direcciones mandaría su destino a un
 * tercero— vive en `lib/ontoy/buscar-lugar.ts`.
 *
 * ## Nada de esto sale del teléfono
 *
 * El emparejamiento corre aquí, sobre la lista pública de paradas que ya bajó.
 * Lo que el pasajero escribe **no viaja a ningún lado**: la petición que lo
 * mandaría no existe (8.7). Tampoco se guarda: las búsquedas recientes son del
 * planeador (8.16 regla 6) y todavía no hay ninguna.
 */
export function VistaIrA({
  rutas,
  paradas,
  paradasListas,
  error,
  alReintentar,
  alAbrirRuta,
  alVerTodas,
}: {
  rutas: RutaDeLaCiudad[];
  /** Las paradas públicas de la ciudad. Vacío mientras bajan. */
  paradas: ParadaDeLaCiudad[];
  /** Ya llegó la lista (aunque venga vacía): distingue «buscando» de «no hay». */
  paradasListas: boolean;
  /** No se pudo bajar la lista. Se dice; no se contesta «no hay nada». */
  error: boolean;
  alReintentar: () => void;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: "ida" | "vuelta") => void;
  alVerTodas: () => void;
}) {
  const [consulta, setConsulta] = useState("");

  const nombreDeRuta = useMemo(
    () => new Map(rutas.map((r) => [r.circuito_id, r.nombre])),
    [rutas],
  );

  const paradasBuscables = useMemo<ParadaBuscable[]>(
    () =>
      paradas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        circuitoSlug: p.ruta,
        circuitoNombre: nombreDeRuta.get(p.ruta) ?? p.ruta,
        sentido: p.sentido,
      })),
    [paradas, nombreDeRuta],
  );

  const rutasBuscables = useMemo<RutaBuscable[]>(
    () => rutas.map((r) => ({ slug: r.circuito_id, nombre: r.nombre })),
    [rutas],
  );

  const { sugerencias, omitidas } = useMemo(
    () => emparejarLugares(consulta, paradasBuscables, rutasBuscables),
    [consulta, paradasBuscables, rutasBuscables],
  );

  const escribio = consulta.trim().length > 0;
  /*
   * Con la lista todavía en camino —o caída— «no encontramos nada» sería una
   * afirmación sobre paradas que ni siquiera se leyeron. Cada caso dice lo
   * suyo: una lista que no llegó y una búsqueda sin resultados son dos cosas.
   */
  const buscando = escribio && !paradasListas && !error;

  return (
    <div className="ontoy-vista ontoy-ira">
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Ir a</h2>

        <div className="ontoy-ira-campo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Una parada o una ruta"
            aria-label="Buscar una parada o una ruta"
            enterKeyHint="search"
            autoComplete="off"
          />
        </div>

        <p className="ontoy-ira-limite">
          Busca por <b>nombre de parada o de ruta</b>. Todavía no entiende calle y número.
        </p>

        {escribio &&
          (error && !paradasListas ? (
            <div className="ontoy-aviso-red" role="status">
              <span>No pudimos bajar las paradas ahorita, así que no podemos buscarlas.</span>
              <button type="button" onClick={alReintentar}>
                Reintentar
              </button>
            </div>
          ) : buscando ? (
            <p className="ontoy-vacio">Buscando…</p>
          ) : sugerencias.length === 0 ? (
            <p className="ontoy-vacio">
              No encontramos ninguna parada ni ruta con ese nombre. Búscala en la lista completa.
            </p>
          ) : (
            <>
              <ul className="ontoy-ira-lista">
                {sugerencias.map((s, i) => (
                  <li key={`${s.clave}-${i}`}>
                    {s.tipo === "parada" ? (
                      <button
                        type="button"
                        className="ontoy-ira-sugerencia"
                        onClick={() => alAbrirRuta(s.circuitoSlug, s.paradaId, s.sentido ?? undefined)}
                      >
                        <span className="ontoy-ira-que mono">Parada</span>
                        <span className="ontoy-ira-texto">
                          <span className="ontoy-ira-nombre">{s.nombre}</span>
                          {/*
                            La ruta, completa y en su propio renglón. Al lado se
                            truncaba —«Circuito de muestra — O…»—, y una parada
                            que no dice de qué ruta es deja de distinguirse de la
                            otra parada con el mismo nombre (8.8c).
                          */}
                          <span className="ontoy-ira-donde">{s.circuitoNombre}</span>
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ontoy-ira-sugerencia"
                        onClick={() => alAbrirRuta(s.slug)}
                      >
                        <span className="ontoy-ira-que mono">Ruta</span>
                        <span className="ontoy-ira-texto">
                          <span className="ontoy-ira-nombre">{s.nombre}</span>
                          <span className="ontoy-ira-donde">toda la ruta, con sus paradas</span>
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {/* Recortar callando dejaría al pasajero creyendo que su parada no existe. */}
              {omitidas > 0 && (
                <p className="ontoy-ira-omitidas">
                  Se enseñan {MAXIMO_SUGERENCIAS}; hay {omitidas} más. Escribe un poco más para acercarte.
                </p>
              )}
            </>
          ))}

        <button type="button" className="ontoy-boton ontoy-boton-segundo ontoy-ira-todas" onClick={alVerTodas}>
          Ver todas las rutas
        </button>
      </section>

      <p className="ontoy-pie">
        Aquí va a vivir el <b>planeador</b>: a dónde vas, y la app te arma el viaje, con o sin
        transbordo. Llega cuando estén medidos los recorridos de cada tramo — antes de eso
        cualquier total sería una llegada inventada. Lo que escribes se usa para encontrar tu
        parada, y no se guarda.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
  );
}
