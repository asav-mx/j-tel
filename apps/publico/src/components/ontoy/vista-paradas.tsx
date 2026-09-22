"use client";

import { useEffect, useRef } from "react";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RenglonDeParadas } from "@/lib/ontoy/paradas-de-la-ruta";
import type { AvisoEnLaCampana } from "@/lib/ontoy/avisos";

/**
 * **Las paradas** — la ruta abierta como una línea (8.8, 8.8d). Sólo dibuja: el
 * orden, los números y qué camión va dónde los decide `armarParadas`.
 *
 * > ✎ **Se llamaba «Hilo»** (ASAV, 22-sep). El botón decía una metáfora que
 * > sólo entiende quien la inventó: el pasajero que abre su ruta busca **sus
 * > paradas**. El nombre se cambió en la pantalla **y en el código** —archivo,
 * > componente, función y clases de CSS— a propósito: un nombre viejo que
 * > sobrevive en el código es el que se cuela de vuelta a la pantalla en el
 * > siguiente cambio.
 *
 * ## El tinte y sus tres excepciones (8.8d)
 *
 * El fondo lleva un velo del color de la ruta y la línea y los círculos de las
 * paradas van en su color: es identidad (8.8c). **Nunca se tiñen:**
 *
 * - **el texto** — los nombres y los números van en tinta;
 * - **el latido** — el punto verde de un camión con posición de ahorita;
 * - **el dato viejo** — un camión con posición vieja va en gris y con anillo
 *   hueco: si llevara el color de la ruta, el color diría un estado.
 */
export function VistaParadas({
  renglones,
  cargando,
  aviso,
  promesa,
  color,
  paradaMarcada,
  alTocarParada,
  avisos = [],
  alVerAvisos,
}: {
  renglones: RenglonDeParadas[];
  cargando: boolean;
  /** Lo que la escalera dice arriba cuando no hay servicio: «Fuera de horario · abre 05:00». */
  aviso: string | null;
  promesa: string;
  color: string;
  paradaMarcada: string | null;
  alTocarParada: (id: string) => void;
  /**
   * Los avisos de la concesión de ESTA ruta (PR 4b): una línea arriba de la lista.
   * Quien abre la ruta para tomarla es justo quien necesita ver el desvío
   * (ASAV, 22-sep). Discreta: tinta, no alarma; el detalle vive en la campana.
   */
  avisos?: AvisoEnLaCampana[];
  alVerAvisos?: () => void;
}) {
  const marcada = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    marcada.current?.scrollIntoView({ block: "center" });
  }, [paradaMarcada, renglones.length]);

  return (
    <div className="ontoy-vista ontoy-paradas" style={{ ["--ruta" as string]: color }}>
      {aviso && <p className="ontoy-paradas-aviso">{aviso}</p>}
      {avisos.length > 0 && (
        <button type="button" className="ontoy-paradas-aviso-concesion" onClick={alVerAvisos}>
          <span className="ontoy-paradas-aviso-etiqueta mono">Aviso de la concesión</span>
          <span className="ontoy-paradas-aviso-titulo">
            {avisos[0]!.titulo}
            {avisos.length > 1 && <> · y {avisos.length - 1} más</>}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {cargando && renglones.length === 0 ? (
        <p className="ontoy-vacio ontoy-paradas-vacio">Preguntando…</p>
      ) : renglones.length === 0 ? (
        <p className="ontoy-vacio ontoy-paradas-vacio">Esta ruta no tiene paradas en este sentido.</p>
      ) : (
        <ol className="ontoy-paradas-linea">
          {renglones.map((r, i) => {
            if (r.tipo === "parada") {
              const esLaMarcada = r.id === paradaMarcada;
              return (
                <li key={`p-${r.id}`} className="ontoy-paradas-renglon">
                  <button
                    type="button"
                    ref={esLaMarcada ? marcada : undefined}
                    className={`ontoy-paradas-parada${esLaMarcada ? " marcada" : ""}`}
                    onClick={() => alTocarParada(r.id)}
                  >
                    <span className="ontoy-paradas-nombre">
                      {r.nombre}
                      {r.guardada && (
                        <svg className="ontoy-paradas-estrella" viewBox="0 0 24 24" aria-label="guardada">
                          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                        </svg>
                      )}
                    </span>
                    {r.falta && <span className="ontoy-paradas-falta mono">{r.falta}</span>}
                  </button>
                </li>
              );
            }
            if (r.tipo === "unidad") {
              return (
                <li key={`u-${r.economico}-${i}`} className={`ontoy-paradas-renglon ontoy-paradas-unidad${r.fresca ? " viva" : " vieja"}`}>
                  <span className="mono">Unidad {r.economico}</span>
                  <span className="ontoy-paradas-edad">
                    {r.fresca ? (
                      <>
                        <span className="ontoy-punto-vivo" aria-hidden="true" />
                        {haceNMinutos(r.antiguedadSeg)}
                      </>
                    ) : (
                      <>posición de {haceNMinutos(r.antiguedadSeg)}</>
                    )}
                  </span>
                </li>
              );
            }
            return (
              <li key="aqui" className="ontoy-paradas-renglon ontoy-paradas-aqui">
                <span className="ontoy-paradas-aqui-rotulo">Aquí estás</span>
                {r.falta && <span className="ontoy-paradas-falta mono">el próximo, {r.falta}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {renglones.some((r) => r.tipo === "aqui") && (
        <p className="ontoy-porque ontoy-paradas-porque">Tu ubicación se usa para marcar dónde estás sobre la ruta.</p>
      )}
      <p className="ontoy-paradas-promesa">{promesa}</p>
    </div>
  );
}
