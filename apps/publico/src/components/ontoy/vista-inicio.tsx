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
import { useEnVivo } from "@/lib/ontoy/en-vivo";
import { useParadasDeLaCiudad } from "@/lib/ontoy/usar-paradas-de-la-ciudad";

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
 * La lista de paradas de la ciudad (`/api/circuitos/paradas-de-la-ciudad`) se baja sólo cuando hace
 * falta —sin guardadas y con ubicación—, una vez, y el cruce con la ubicación
 * ocurre aquí. La petición no lleva nada del pasajero.
 */
export function VistaInicio({
  rutas,
  guardadas,
  guardadasListas,
  puedeGuardar,
  ubicacion,
  alAbrirRuta,
  alQuitarGuardada,
  alIrAlMapa,
}: {
  rutas: RutaDeLaCiudad[];
  guardadas: ParadaGuardada[];
  /** Si ya se leyó el teléfono: antes, «ninguna guardada» todavía no es cierto. */
  guardadasListas: boolean;
  puedeGuardar: boolean;
  ubicacion: Ubicacion;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: Sentido) => void;
  alQuitarGuardada: (g: ParadaGuardada) => void;
  alIrAlMapa: () => void;
}) {
  /*
   * Los camiones de TODAS las rutas de tus paradas, en una sola consulta cada
   * 15 s (PR 3b). Antes cada tarjeta sondeaba la suya.
   */
  const rutasGuardadas = useMemo(() => [...new Set(guardadas.map((g) => g.ruta))], [guardadas]);
  const enVivo = useEnVivo(rutasGuardadas);

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
          <p className="ontoy-vacio">Para guardar otra, abre una ruta en el Mapa y toca su parada.</p>
        </section>
      ) : (
        <ParadasCercaDeTi
          rutas={rutas}
          puedeGuardar={puedeGuardar}
          ubicacion={ubicacion}
          alAbrirRuta={alAbrirRuta}
          alIrAlMapa={alIrAlMapa}
        />
      )}

      <p className="ontoy-pie">
        Tus paradas guardadas se quedan en tu teléfono. No hace falta cuenta.{" "}
        <a href="/privacidad">Qué datos usa la app y para qué</a>.
      </p>
    </div>
  );
}

function ParadasCercaDeTi({
  rutas,
  puedeGuardar,
  ubicacion,
  alAbrirRuta,
  alIrAlMapa,
}: {
  rutas: RutaDeLaCiudad[];
  puedeGuardar: boolean;
  ubicacion: Ubicacion;
  alAbrirRuta: (circuitoId: string, parada?: string, sentido?: Sentido) => void;
  alIrAlMapa: () => void;
}) {
  const { yo, estado, pedir } = ubicacion;
  const lista = useParadasDeLaCiudad(estado === "concedida");

  const cercanas = useMemo(
    () => (yo && lista.datos ? paradasCerca(yo, lista.datos.paradas) : null),
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
          las rutas y sus paradas. Si cambias de idea, el permiso se da desde los ajustes de tu teléfono.
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
          No hay paradas a menos de {RADIO_CERCA_M / 1000} km de ti. En el Mapa están todas las rutas.
        </p>
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
