"use client";

import { useEffect, useRef } from "react";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RenglonDelHilo } from "@/lib/ontoy/hilo";
import type { AvisoEnLaCampana } from "@/lib/ontoy/avisos";

/**
 * **El hilo** — la ruta abierta como una línea (8.8, 8.8d). Sólo dibuja: el
 * orden, los números y qué camión va dónde los decide `armarHilo`.
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
export function VistaHilo({
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
  renglones: RenglonDelHilo[];
  cargando: boolean;
  /** Lo que la escalera dice arriba cuando no hay servicio: «Fuera de horario · abre 05:00». */
  aviso: string | null;
  promesa: string;
  color: string;
  paradaMarcada: string | null;
  alTocarParada: (id: string) => void;
  /**
   * Los avisos de la concesión de ESTA ruta (PR 4b): una línea arriba del hilo.
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
    <div className="ontoy-vista ontoy-hilo" style={{ ["--ruta" as string]: color }}>
      {aviso && <p className="ontoy-hilo-aviso">{aviso}</p>}
      {avisos.length > 0 && (
        <button type="button" className="ontoy-hilo-aviso-concesion" onClick={alVerAvisos}>
          <span className="ontoy-hilo-aviso-etiqueta mono">Aviso de la concesión</span>
          <span className="ontoy-hilo-aviso-titulo">
            {avisos[0]!.titulo}
            {avisos.length > 1 && <> · y {avisos.length - 1} más</>}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {cargando && renglones.length === 0 ? (
        <p className="ontoy-vacio ontoy-hilo-vacio">Preguntando…</p>
      ) : renglones.length === 0 ? (
        <p className="ontoy-vacio ontoy-hilo-vacio">Esta ruta no tiene paradas en este sentido.</p>
      ) : (
        <ol className="ontoy-hilo-linea">
          {renglones.map((r, i) => {
            if (r.tipo === "parada") {
              const esLaMarcada = r.id === paradaMarcada;
              return (
                <li key={`p-${r.id}`} className="ontoy-hilo-renglon">
                  <button
                    type="button"
                    ref={esLaMarcada ? marcada : undefined}
                    className={`ontoy-hilo-parada${esLaMarcada ? " marcada" : ""}`}
                    onClick={() => alTocarParada(r.id)}
                  >
                    <span className="ontoy-hilo-nombre">
                      {r.nombre}
                      {r.guardada && (
                        <svg className="ontoy-hilo-estrella" viewBox="0 0 24 24" aria-label="guardada">
                          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                        </svg>
                      )}
                    </span>
                    {r.falta && <span className="ontoy-hilo-falta mono">{r.falta}</span>}
                  </button>
                </li>
              );
            }
            if (r.tipo === "unidad") {
              return (
                <li key={`u-${r.economico}-${i}`} className={`ontoy-hilo-renglon ontoy-hilo-unidad${r.fresca ? " viva" : " vieja"}`}>
                  <span className="mono">Unidad {r.economico}</span>
                  <span className="ontoy-hilo-edad">
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
              <li key="aqui" className="ontoy-hilo-renglon ontoy-hilo-aqui">
                <span className="ontoy-hilo-aqui-rotulo">Aquí estás</span>
                {r.falta && <span className="ontoy-hilo-falta mono">el próximo, {r.falta}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {renglones.some((r) => r.tipo === "aqui") && (
        <p className="ontoy-porque ontoy-hilo-porque">Tu ubicación se usa para marcar dónde estás sobre la ruta.</p>
      )}
      <p className="ontoy-hilo-promesa">{promesa}</p>
    </div>
  );
}
