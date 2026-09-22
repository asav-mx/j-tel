"use client";

import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import type { Ubicacion } from "@/lib/ubicacion";
import { AtajoDeParada } from "@/components/ontoy/atajo-de-parada";
import type { Vivo } from "@/lib/ontoy/forma";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";
import type { EstadoDeRuta } from "@/lib/ontoy/estado-de-ruta";
import { RutasDeInicio } from "@/components/ontoy/rutas-de-inicio";

/**
 * **Inicio** — la app abre contestando (8.8, 22-sep).
 *
 * Dos cosas, en este orden:
 *
 * 1. **Tu parada guardada** con su próximo camión y su promesa (8.8b). Es lo
 *    que el pasajero de todos los días viene a buscar, y por eso va primero.
 * 2. **Las rutas**, siempre: tres a la vista y el resto tras un botón. Con
 *    ubicación van ordenadas por cercanía y cada una dice **por dónde se
 *    toma**; sin ubicación, alfabéticas. Ahí vive el único camino a la lista
 *    completa de la ciudad — «Ir a» quedó sólo como buscador.
 *
 * ## Por qué ya no hay una sección de «Paradas cerca de ti»
 *
 * La había, y decía lo mismo que las rutas de abajo con los mismos números: la
 * misma ruta, la misma distancia, un bloque encima del otro. Se fundieron
 * (ASAV, 22-sep, tarde): ahora **el renglón de la ruta nombra su parada** y
 * tocarlo abre esa parada. Una lista en vez de dos.
 *
 * Con ella se fueron sus estados bloqueantes. Sin ubicación esa sección no
 * tenía nada que enseñar, así que un permiso negado se llevaba la pantalla
 * entera; ahora la lista de rutas está completa de todos modos y la falta de
 * ubicación es una nota, no un muro.
 *
 * ## La ubicación
 *
 * **No se pide al abrir** (decisión de ASAV, 22-sep): se pide con el botón «Ver
 * rutas cerca de mí», y si el pasajero ya la había dado se usa sin volver a
 * preguntar. Si dice que no, la app sirve completa (8.7).
 *
 * La lista de paradas de la ciudad (`/api/circuitos/paradas-de-la-ciudad`) se
 * baja sólo cuando hace falta —con ubicación concedida—, **una vez**, y el
 * cruce ocurre en el teléfono (8.3b). La petición no lleva nada del pasajero.
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
  /**
   * Los camiones de TODAS tus rutas, de la consulta única de la raíz (PR 4b):
   * Inicio ya no pregunta por su cuenta.
   */
  enVivo: { vivos: Map<string, Vivo>; error: boolean; respondio: boolean };
}) {
  const lista = useParadasDeLaCiudad(ubicacion.estado === "concedida");

  if (!guardadasListas) return <div className="ontoy-vista" />;

  return (
    <div className="ontoy-vista">
      {guardadas.length > 0 ? (
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
        </section>
      ) : (
        /*
         * Sin guardadas, la puerta de entrada dicha una vez. No es un estado
         * vacío: debajo están las rutas, que es con lo que se llega a guardar
         * la primera.
         */
        puedeGuardar && (
          <p className="ontoy-vacio ontoy-inicio-invitacion">
            Guarda una parada y aquí verás su próximo camión. Abre una ruta y toca la suya.
          </p>
        )
      )}

      <RutasDeInicio
        rutas={rutas}
        estados={estados}
        paradas={lista.datos?.paradas ?? []}
        ubicacion={ubicacion}
        listaConError={lista.error}
        alReintentarLista={lista.reintentar}
        alAbrirRuta={alAbrirRuta}
      />

      <p className="ontoy-pie">
        Tus paradas guardadas se quedan en tu teléfono. No hace falta cuenta.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
  );
}
