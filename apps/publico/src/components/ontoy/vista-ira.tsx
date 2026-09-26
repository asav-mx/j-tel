"use client";

import { useMemo, useState } from "react";
import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import {
  emparejarLugares,
  MAXIMO_SUGERENCIAS,
  type ParadaBuscable,
  type RutaBuscable,
} from "@/lib/ontoy/buscar-lugar";
import { Ontoy } from "@/components/ontoy/ontoy-muneco";
import { GlifoIra } from "@/components/ontoy/glifos";
import { encontre } from "@/lib/ontoy/encontre";

/**
 * **Ir a** — la única búsqueda de la app (8.8; ASAV, 22-sep).
 *
 * El pasajero escribe el nombre de una parada o de una ruta y la app se la
 * abre en el Mapa. Y nada más: **«Ir a» es sólo el buscador** (ASAV,
 * 22-sep-2026). La lista completa de la ciudad vive en Inicio, con sus rutas
 * ordenadas por cercanía — aquí tenía un botón y allá está la lista de verdad.
 *
 * ## El planeador no está, y tampoco se anuncia (ASAV, 25-sep)
 *
 * Aquí va a vivir el **planeador** (8.16): a dónde vas, y la app arma el viaje
 * con o sin transbordo. No está, y **no se finge**: sin recorridos medidos un
 * total sería una llegada inventada (8.9, 8.16 regla 4). Hasta el 25-sep la
 * pantalla lo explicaba en un párrafo al pie; se quitó, porque la versión 1 no
 * promete el planeador (tampoco la landing) y un párrafo sobre lo que no hay
 * le quitaba el lugar a lo que sí hay.
 *
 * ## Cuando no encuentra nada, una salida (3-ir-a/13)
 *
 * Ontoy triste dice qué no encontró, propone qué escribir y ofrece **«Ver
 * todas las rutas»**, que lleva a la lista de Inicio: ahí viven todas (Marco
 * 8.8, segunda enmienda del 22-sep). Una búsqueda sin resultados no es un
 * callejón (8.10).
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
  alVerTodasLasRutas,
  guardadas,
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
  /** Lleva a la lista de rutas de Inicio: la salida de una búsqueda sin resultados. */
  alVerTodasLasRutas: () => void;
  /** Tus paradas guardadas: lo que se ofrece antes de escribir (3-ir-a/02). */
  guardadas: ParadaGuardada[];
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
      <header className="ontoy-inicio-cabeza">
        <h1 className="ontoy-inicio-titulo">¿Qué buscas?</h1>
        <p className="ontoy-inicio-contexto">Escribe una ruta o una parada y te la abro en el mapa</p>
      </header>

      <section className="ontoy-seccion">
        <div className="ontoy-ira-campo">
          <GlifoIra tamano={28} className="ontoy-ira-glifo" />
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Busca una ruta o una parada"
            aria-label="Buscar una parada o una ruta"
            enterKeyHint="search"
            autoComplete="off"
          />
          {/*
            * La equis sólo existe cuando hay algo que borrar. Un botón siempre
            * puesto que la mitad del tiempo no hace nada enseña a no tocarlo.
            */}
          {consulta !== "" && (
            <button
              type="button"
              className="ontoy-ira-limpiar"
              onClick={() => setConsulta("")}
              aria-label="Borrar lo escrito"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/*
          * **Antes de escribir** (3-ir-a/02): Ontoy dice qué escribir y debajo
          * van tus paradas, para no tener que escribir la de siempre. El límite
          * —nombres, no calle y número— lo dice Ontoy aquí, y la línea chica
          * cuando ya se escribió.
          */}
        {escribio ? (
          <p className="ontoy-ira-limite">
            Busca por <b>nombre de parada o de ruta</b>. Todavía no entiende calle y número.
          </p>
        ) : (
          <AntesDeEscribir guardadas={guardadas} rutas={rutas} paradas={paradas} alAbrirRuta={alAbrirRuta} />
        )}

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
            <div className="ontoy-ira-nada">
              <Ontoy pose="triste" tamano={120} />
              <p className="ontoy-ira-nada-titulo">No encontré «{consulta.trim()}».</p>
              {/* Sin «el número de la ruta»: las rutas no tienen número en la versión 1. */}
              <p className="ontoy-ira-nada-apoyo">Prueba con el nombre de tu parada o de la ruta.</p>
              <button type="button" className="ontoy-boton-contorno" onClick={alVerTodasLasRutas}>
                Ver todas las rutas
              </button>
            </div>
          ) : (
            <>
              {/*
                * **El resumen, con Ontoy de 40 px.** Es «en línea con el dato»,
                * el tamaño chico del estándar: aquí Ontoy no es el mensajero de
                * la pantalla —lo es sólo cuando no encuentra nada—, acompaña a
                * una respuesta que ya está.
                */}
              <p className="ontoy-ira-encontre">
                <Ontoy pose="contento" tamano={40} />
                <span>
                  {encontre(
                    sugerencias.filter((s) => s.tipo === "ruta").length,
                    sugerencias.filter((s) => s.tipo === "parada").length,
                  )}
                </span>
              </p>
              <ul className="ontoy-ira-lista">
                {sugerencias.map((s, i) => (
                  <li key={`${s.clave}-${i}`}>
                    {s.tipo === "parada" ? (
                      <button
                        type="button"
                        className="ontoy-ira-sugerencia"
                        onClick={() => alAbrirRuta(s.circuitoSlug, s.paradaId, s.sentido ?? undefined)}
                      >
                        <span className="ontoy-ira-que cifra">Parada</span>
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
                        <span className="ontoy-ira-que cifra">Ruta</span>
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

      </section>

      {/*
        * Lo único que queda al pie es lo de privacidad: el PARA QUÉ de lo que
        * escribes, donde lo escribes, y la liga (a «Ir a» se llega sin pasar
        * por Inicio).
        */}
      <p className="ontoy-pie">
        Lo que escribes se usa para encontrar tu parada, y no se guarda.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
  );
}

/**
 * **«Ir a» antes de escribir** (3-ir-a/02, ASAV 25-sep).
 *
 * Ontoy de frente dice qué escribir —el nombre, porque **las rutas no tienen
 * número en la versión 1** y el diseño pide «el número de la ruta»—, y debajo
 * «Tus paradas» en renglones compactos, como en Inicio: franja y nombre de la
 * ruta, no una placa numerada. Tocar una la abre en su ruta, con esa parada.
 *
 * Es el Ontoy de la pantalla (uno), así que el asomado se esconde solo.
 */
function AntesDeEscribir({
  guardadas,
  rutas,
  paradas,
  alAbrirRuta,
}: {
  guardadas: ParadaGuardada[];
  rutas: RutaDeLaCiudad[];
  paradas: ParadaDeLaCiudad[];
  alAbrirRuta: (circuitoId: string, parada?: string) => void;
}) {
  return (
    <>
      <div className="ontoy-ira-antes">
        <Ontoy pose="al-frente" tamano={96} />
        <p className="ontoy-ira-antes-frase">Escribe el nombre de tu parada o de la ruta.</p>
      </div>

      {guardadas.length > 0 && (
        <section className="ontoy-ira-tus-paradas">
          <h2 className="ontoy-ira-tus-paradas-titulo">Tus paradas</h2>
          <div className="ontoy-renglones">
            {guardadas.map((g) => {
              const ruta = rutas.find((r) => r.circuito_id === g.ruta) ?? null;
              const parada = paradas.find((p) => p.id === g.parada && p.ruta === g.ruta) ?? null;
              return (
                <button
                  key={`${g.ruta}-${g.parada}`}
                  type="button"
                  className="ontoy-renglon"
                  style={{ ["--ruta" as string]: ruta?.color_hex ?? "currentColor" }}
                  onClick={() => alAbrirRuta(g.ruta, g.parada)}
                >
                  {/* El color es identidad y NUNCA va solo: el nombre de la ruta lo acompaña (8.8c). */}
                  <span className="ontoy-franja-vertical" aria-hidden="true" />
                  <span className="ontoy-renglon-texto">
                    {/* Mientras baja la lista de la ciudad, el nombre todavía no se sabe: no se inventa. */}
                    <span className="ontoy-renglon-titulo">{parada?.nombre ?? "Preguntando…"}</span>
                    <span className="ontoy-renglon-sub">Ruta {ruta?.nombre ?? "—"}</span>
                  </span>
                  <svg className="ontoy-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
