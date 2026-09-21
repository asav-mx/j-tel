"use client";

import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import { promesaEnPalabras } from "@/lib/ontoy/llegadas";
import type { ParadaGuardada } from "@/lib/ontoy/paradas-guardadas";
import { AtajoDeParada } from "@/components/ontoy/atajo-de-parada";

/** Lo que el servidor ya resolvió del horario de cada ruta. La pantalla lee, no deduce. */
export interface EstadoDeRuta {
  circuito_id: string;
  /** `abierto` · `cerrado` · `por_arrancar`. Resuelto en el servidor con la zona del circuito. */
  situacion: "abierto" | "cerrado" | "por_arrancar";
  /** A qué hora abre, para poder decirlo cuando está cerrada. */
  abre_a: string;
  /** El día que arranca, cuando todavía no opera. */
  arranca_el: string | null;
}

/**
 * **Rutas** — la primera de las dos vistas (8.8).
 *
 * Arriba, las paradas guardadas: el atajo que reemplazó a una tercera vista
 * (8.8b), con su próximo paso ya visible. Abajo, las rutas publicadas de la
 * ciudad, cada una con **su promesa** — que se enseña aunque no haya una sola
 * unidad en vivo (8.2).
 *
 * ## Lo que esta lista NO dice, y por qué
 *
 * No dice cuántas unidades trae cada ruta ahorita. Saberlo costaría una
 * petición por ruta cada quince segundos, para todas las rutas de la ciudad,
 * todo el tiempo — y el pasajero está mirando una. Lo vivo aparece al abrir la
 * ruta, que es cuando importa. Lo que sí está siempre es la promesa, que es el
 * corazón de la pantalla (8.2) y no cuesta una petición.
 *
 * Una ruta cerrada lo dice con su hora de apertura; una que no ha arrancado lo
 * dice con su fecha. **Ninguna se esconde**: una ruta que existe y no aparece
 * deja al pasajero buscándola.
 */
export function VistaRutas({
  rutas,
  estados,
  guardadas,
  puedeGuardar,
  alAbrirRuta,
  alQuitarGuardada,
}: {
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  guardadas: ParadaGuardada[];
  puedeGuardar: boolean;
  alAbrirRuta: (circuitoId: string, parada?: string) => void;
  alQuitarGuardada: (g: ParadaGuardada) => void;
}) {
  const estadoDe = new Map(estados.map((e) => [e.circuito_id, e]));

  return (
    <div className="ontoy-vista">
      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Tus paradas</h2>
        {guardadas.length === 0 ? (
          <p className="ontoy-vacio">
            {puedeGuardar
              ? "Todavía no guardas ninguna. Abre una ruta, toca una parada y guárdala: aparecerá aquí con su próximo paso."
              : "Tu navegador no deja guardar nada en este teléfono, así que este atajo no está disponible. Todo lo demás funciona igual."}
          </p>
        ) : (
          guardadas.map((g) => (
            <AtajoDeParada
              key={g.parada}
              guardada={g}
              ruta={rutas.find((r) => r.circuito_id === g.ruta) ?? null}
              alAbrir={() => alAbrirRuta(g.ruta, g.parada)}
              alQuitar={() => alQuitarGuardada(g)}
            />
          ))
        )}
      </section>

      <section className="ontoy-seccion">
        <h2 className="ontoy-seccion-titulo">Rutas publicadas</h2>
        {rutas.length === 0 ? (
          <p className="ontoy-vacio">Todavía no hay rutas publicadas en esta ciudad.</p>
        ) : (
          rutas.map((r) => {
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
                <svg className="ontoy-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            );
          })
        )}
      </section>

      <p className="ontoy-pie">
        El color de cada ruta es el que sus camiones traen pintado en la calle — la app lo registra, no lo inventa.
        Sólo se muestran rutas publicadas. Ninguna pantalla te pide cuenta ni te identifica.
      </p>
    </div>
  );
}
