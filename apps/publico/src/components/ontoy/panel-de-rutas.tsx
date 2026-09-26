"use client";

import { useState } from "react";
import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";
import { distanciaParaDecir } from "@/lib/ontoy/distancia";

/**
 * **El panel de «+N rutas más»** — las rutas que no caben en la tira (8.8;
 * ASAV, 22-sep-2026).
 *
 * Una **lista con casillas**, no un buscador. La decisión es de ASAV y tiene su
 * razón: la app ya tiene **una sola búsqueda**, en «Ir a», y se quedó con una
 * sola a propósito cuando se retiró `/buscar`. Un segundo campo de texto aquí
 * reabriría justo lo que se cerró — dos buscadores para preguntas parecidas son
 * dos respuestas que se pueden contradecir.
 *
 * Lo que se marca entra a la tira **prendido**: el pasajero acaba de escogerlo,
 * así que esconderlo después de escogerlo sería pedirle dos toques para una
 * decisión.
 *
 * Marcar y desmarcar no cuesta una petición ni se guarda en ningún lado.
 */
export function PanelDeRutas({
  margenM,
  resto,
  alCerrar,
  alAgregar,
}: {
  resto: RutaOrdenada[];
  /** El margen de la posición: con más de 100 m no se dicen metros (`esImprecisa`). */
  margenM: number | null;
  alCerrar: () => void;
  /** Las marcadas, todas juntas al cerrar: el mapa se redibuja una vez, no una por casilla. */
  alAgregar: (ids: string[]) => void;
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  const alternar = (id: string) =>
    setMarcadas((antes) => {
      const s = new Set(antes);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const cerrar = () => {
    if (marcadas.size > 0) alAgregar([...marcadas]);
    alCerrar();
  };

  return (
    <>
      <button type="button" className="ontoy-scrim" aria-label="Cerrar" onClick={cerrar} />
      <section className="ontoy-panel" role="dialog" aria-label="Más rutas para ver en el mapa">
        <span className="ontoy-hoja-asa" aria-hidden="true" />
        <div className="ontoy-panel-cabeza">
          <h2 className="ontoy-panel-titulo">Más rutas en el mapa</h2>
          <button type="button" className="ontoy-panel-cerrar" onClick={cerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <ul className="ontoy-panel-lista">
          {resto.map(({ ruta: r, entrada }) => (
            <li key={r.circuito_id}>
              <label className="ontoy-panel-renglon">
                <input
                  type="checkbox"
                  checked={marcadas.has(r.circuito_id)}
                  onChange={() => alternar(r.circuito_id)}
                />
                {/* El color es identidad y NUNCA va solo: el nombre lo acompaña (8.8c). */}
                <span className="ontoy-panel-color" style={{ background: r.color_hex }} aria-hidden="true" />
                <span className="ontoy-panel-texto">
                  <span className="ontoy-panel-nombre">{r.nombre}</span>
                  {/* Sin distancia medida no va número: el hueco se calla, no se rellena. */}
                  {entrada && (
                    <span className="ontoy-panel-donde">
                      por {entrada.nombre}
                      {(() => {
                        const d = distanciaParaDecir(entrada.distanciaM, margenM);
                        return d ? `, ${d}` : null;
                      })()}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <button type="button" className="ontoy-boton" onClick={cerrar}>
          {marcadas.size === 0
            ? "Cerrar"
            : `Ver ${marcadas.size} ${marcadas.size === 1 ? "ruta" : "rutas"} en el mapa`}
        </button>
        <p className="ontoy-porque ontoy-panel-pie">
          Prender y apagar rutas sólo cambia lo que se dibuja: no pide nada al servidor y no se guarda.
        </p>
      </section>
    </>
  );
}
