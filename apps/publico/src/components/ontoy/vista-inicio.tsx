"use client";

import { useMemo } from "react";
import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import {
  distanciaEnPalabras,
  paradasCerca,
  RADIO_CERCA_M,
  sentidoEnPalabras,
} from "@/lib/ontoy/paradas-cerca";
import type { Ubicacion } from "@/lib/ubicacion";
import { AtajoDeParada } from "@/components/ontoy/atajo-de-parada";
import type { Vivo } from "@/lib/ontoy/forma";
import { useParadasDeLaCiudad, type ListaDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { RutasDeInicio } from "@/components/ontoy/rutas-de-inicio";

/**
 * **Inicio** — la app abre contestando (8.8, 22-sep).
 *
 * Con paradas guardadas, lo primero que ve el pasajero es lo que viene a
 * buscar: su parada, su próximo camión y su promesa abajo, punteada (8.8b). Cada
 * tarjeta es el atajo de siempre, subido a la portada.
 *
 * Sin guardadas, ofrece **las paradas cerca de él, calculadas en su teléfono**
 * (8.3b). La ubicación **no se pide al abrir**: se pide con el botón «Ver
 * paradas cerca de mí» (decisión de ASAV, 22-sep). Si el pasajero ya la había
 * dado, no se le vuelve a preguntar y la lista sale sola. Si dice que no, Inicio
 * lo manda al Mapa y la app sirve completa (8.7).
 *
 * Y debajo, **siempre**, las rutas: tres a la vista y el resto tras un botón
 * (`RutasDeInicio`). Ahí vive el único camino a la lista completa de la ciudad
 * — «Ir a» quedó sólo como buscador (ASAV, 22-sep).
 *
 * La lista de paradas de la ciudad (`/api/circuitos/paradas-de-la-ciudad`) se
 * baja sólo cuando hace falta —con ubicación concedida—, **una vez para toda
 * la pantalla**: la piden las paradas cercanas y el orden de las rutas, y se
 * lee aquí arriba para no bajarla dos veces. El cruce con la ubicación ocurre
 * en el teléfono; la petición no lleva nada del pasajero.
 */
export function VistaInicio({
  rutas,
  estados,
  guardadas,
  guardadasListas,
  puedeGuardar,
  ubicacion,
  alAbrirRuta,
  alQuitarGuardada,
  alIrAlMapa,
  enVivo,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  guardadas: ParadaGuardada[];
  /** Si ya se leyó el teléfono: antes, «ninguna guardada» todavía no es cierto. */
  guardadasListas: boolean;
  puedeGuardar: boolean;
  ubicacion: Ubicacion;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: Sentido) => void;
  alQuitarGuardada: (g: ParadaGuardada) => void;
  alIrAlMapa: () => void;
  /**
   * Los camiones de TODAS tus rutas, de la consulta única de la raíz (PR 4b):
   * Inicio ya no pregunta por su cuenta.
   */
  enVivo: { vivos: Map<string, Vivo>; error: boolean; respondio: boolean };
}) {
  /*
   * UNA sola bajada para toda la pantalla. Antes vivía dentro de las paradas
   * cercanas; ahora también la necesita el orden de las rutas, y dos hooks
   * serían dos peticiones para la misma lista.
   */
  const lista = useParadasDeLaCiudad(ubicacion.estado === "concedida");

  if (!guardadasListas) return <div className="ontoy-vista" />;

  const hayGuardadas = guardadas.length > 0;

  return (
    <div className="ontoy-vista">
      {hayGuardadas ? (
        <section className="ontoy-seccion">
          <h2 className="ontoy-seccion-titulo">Tu próximo camión</h2>
          {guardadas.map((g) => (
            <AtajoDeParada
              key={g.parada}
              guardada={g}
              ruta={rutas.find((r) => r.circuito_id === g.ruta) ?? null}
              yo={ubicacion.yo}
              vivo={enVivo.vivos.get(g.ruta) ?? (enVivo.respondio ? null : undefined)}
              errorVivo={enVivo.error}
              alAbrir={() => alAbrirRuta(g.ruta, g.parada)}
              alQuitar={() => alQuitarGuardada(g)}
            />
          ))}
          <p className="ontoy-vacio">Para guardar otra, abre una ruta en el Mapa y toca su parada.</p>
        </section>
      ) : (
        <ParadasCercaDeTi
          rutas={rutas}
          lista={lista}
          puedeGuardar={puedeGuardar}
          ubicacion={ubicacion}
          alAbrirRuta={alAbrirRuta}
          alIrAlMapa={alIrAlMapa}
        />
      )}

      <RutasDeInicio
        rutas={rutas}
        estados={estados}
        paradas={lista.datos?.paradas ?? []}
        yo={ubicacion.yo}
        /*
         * El permiso se pide UNA vez por pantalla. Sin paradas guardadas, el
         * bloque de arriba ya lo pide y concederlo ordena las dos secciones;
         * con guardadas, ese bloque no está y el botón vive aquí.
         */
        puedePedirUbicacion={hayGuardadas && ubicacion.estado === "sin-pedir"}
        alPedirUbicacion={ubicacion.pedir}
        alAbrirRuta={(id) => alAbrirRuta(id)}
      />

      <p className="ontoy-pie">
        Tus paradas guardadas se quedan en tu teléfono. No hace falta cuenta.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
  );
}

function ParadasCercaDeTi({
  rutas,
  lista,
  puedeGuardar,
  ubicacion,
  alAbrirRuta,
  alIrAlMapa,
}: {
  rutas: RutaDeLaCiudad[];
  /** Bajada UNA vez por `VistaInicio` y compartida con las rutas. */
  lista: ListaDeLaCiudad;
  puedeGuardar: boolean;
  ubicacion: Ubicacion;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: Sentido) => void;
  alIrAlMapa: () => void;
}) {
  const { yo, estado, pedir, reintentar } = ubicacion;

  const cercanas = useMemo(
    () => (yo && lista.datos ? paradasCerca(yo, lista.datos.paradas) : null),
    [yo, lista.datos],
  );
  /*
   * Lejos de toda parada, la MÁS cercana, a la distancia que sea: así el
   * pasajero ve que su ubicación sí funcionó, y tiene a dónde ir. Antes sólo
   * salía «no hay paradas a menos de 1 km» y el botón del Mapa, y se leía como
   * que la ubicación estaba rota (reporte del 22-sep-2026).
   */
  const laMasCercana = useMemo(
    () => (yo && lista.datos ? (paradasCerca(yo, lista.datos.paradas, { radioM: Infinity, maximo: 1 })[0] ?? null) : null),
    [yo, lista.datos],
  );
  const rutaDe = useMemo(() => {
    const m = new Map<string, { nombre: string; color_hex: string }>();
    for (const r of lista.datos?.rutas ?? []) m.set(r.id, r);
    // La portada ya trae nombre y color; si una ruta cambió entre las dos, manda la de la lista.
    for (const r of rutas) if (!m.has(r.circuito_id)) m.set(r.circuito_id, r);
    return m;
  }, [lista.datos, rutas]);

  const alMapa = (
    <button type="button" className="ontoy-boton ontoy-boton-segundo" onClick={alIrAlMapa}>
      Buscar mi ruta en el Mapa
    </button>
  );

  let cuerpo: React.ReactNode;
  if (estado === "no-disponible") {
    cuerpo = (
      <>
        <p className="ontoy-vacio">
          Este teléfono no nos da tu ubicación, así que no sabemos qué paradas te quedan cerca. En el Mapa están
          todas las rutas y sus paradas.
        </p>
        {alMapa}
      </>
    );
  } else if (estado === "negada") {
    cuerpo = (
      <>
        <p className="ontoy-vacio">
          Sin tu ubicación no sabemos qué paradas te quedan cerca, y la app funciona igual: en el Mapa están todas
          las rutas y sus paradas. Si cambias de idea, dale permiso de ubicación a esta app en los ajustes de tu
          teléfono o de tu navegador.
        </p>
        {alMapa}
      </>
    );
  } else if (estado === "sin-pedir") {
    cuerpo = (
      <>
        <p className="ontoy-vacio">
          Guarda una parada y aquí verás su próximo camión. Para empezar, te enseñamos las que tienes cerca.
        </p>
        <button type="button" className="ontoy-boton" onClick={pedir}>
          Ver paradas cerca de mí
        </button>
        {/* El PARA QUÉ, antes de que el teléfono pregunte. */}
        <p className="ontoy-porque">Tu ubicación se usa para escoger las paradas cerca de ti.</p>
        {alMapa}
      </>
    );
  } else if (estado === "buscando") {
    cuerpo = <p className="ontoy-vacio">Buscando dónde estás…</p>;
  } else if (estado === "sin-senal") {
    /* Hay permiso y no hay posición: GPS apagado o sin señal. No es un «no» del pasajero. */
    cuerpo = (
      <>
        <p className="ontoy-vacio">
          Tu teléfono no nos da tu posición ahorita. Revisa que la ubicación esté prendida, o intenta donde haya
          mejor señal.
        </p>
        <button type="button" className="ontoy-boton" onClick={reintentar}>
          Reintentar
        </button>
        {alMapa}
      </>
    );
  } else if (!lista.datos && !lista.error) {
    cuerpo = <p className="ontoy-vacio">Buscando las paradas cerca de ti…</p>;
  } else if (lista.error) {
    cuerpo = (
      <>
        <p className="ontoy-vacio">No pudimos traer las paradas ahorita.</p>
        <button type="button" className="ontoy-boton" onClick={lista.reintentar}>
          Reintentar
        </button>
        {alMapa}
      </>
    );
  } else if (cercanas && cercanas.length === 0) {
    cuerpo = (
      <>
        <p className="ontoy-vacio">
          No hay paradas a menos de {RADIO_CERCA_M / 1000} km de ti.
          {laMasCercana && " La más cercana, en línea recta:"}
        </p>
        {laMasCercana && (
          <button
            type="button"
            className="ontoy-cerca"
            style={{ ["--ruta" as string]: rutaDe.get(laMasCercana.ruta)?.color_hex ?? "currentColor" }}
            onClick={() => alAbrirRuta(laMasCercana.ruta, laMasCercana.id, laMasCercana.sentido ?? undefined)}
          >
            <span className="ontoy-cerca-info">
              <span className="ontoy-cerca-nombre">{laMasCercana.nombre}</span>
              <span className="ontoy-cerca-ruta">
                Ruta <b>{rutaDe.get(laMasCercana.ruta)?.nombre ?? laMasCercana.ruta}</b> · {sentidoEnPalabras(laMasCercana.sentido)}
              </span>
            </span>
            <span className="ontoy-cerca-distancia mono">{distanciaEnPalabras(laMasCercana.distanciaM)}</span>
          </button>
        )}
        {alMapa}
      </>
    );
  } else {
    cuerpo = (
      <>
        {(cercanas ?? []).map((p) => {
          const ruta = rutaDe.get(p.ruta);
          return (
            <button
              key={`${p.ruta}/${p.id}`}
              type="button"
              className="ontoy-cerca"
              style={{ ["--ruta" as string]: ruta?.color_hex ?? "currentColor" }}
              onClick={() => alAbrirRuta(p.ruta, p.id, p.sentido ?? undefined)}
            >
              <span className="ontoy-cerca-info">
                <span className="ontoy-cerca-nombre">{p.nombre}</span>
                {/* El color es identidad y NUNCA va solo: el nombre de la ruta lo acompaña (8.8c). */}
                <span className="ontoy-cerca-ruta">
                  Ruta <b>{ruta?.nombre ?? p.ruta}</b> · {sentidoEnPalabras(p.sentido)}
                </span>
              </span>
              <span className="ontoy-cerca-distancia mono">{distanciaEnPalabras(p.distanciaM)}</span>
            </button>
          );
        })}
        <p className="ontoy-vacio">
          {puedeGuardar
            ? "Toca una para ver su próximo camión y guardarla. La distancia es en línea recta, no caminando."
            : "Toca una para ver su próximo camión. La distancia es en línea recta, no caminando."}
        </p>
      </>
    );
  }

  return (
    <section className="ontoy-seccion">
      <h2 className="ontoy-seccion-titulo">Paradas cerca de ti</h2>
      {cuerpo}
    </section>
  );
}
