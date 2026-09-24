"use client";

import type { Sentido } from "@/lib/ontoy/forma";
import { textoSobreLaRuta } from "@/lib/ontoy/tinte-de-ruta";

/**
 * La cabeza de una ruta abierta — **teñida con su color** (8.8d).
 *
 * El color de la ruta es el fondo; el texto se escoge con `textoSobreLaRuta`,
 * que garantiza 4.5:1: una ruta amarilla voltea a texto oscuro. Los botones
 * activos se marcan **llenándose** (forma), no cambiando de color.
 *
 * La salida está siempre arriba a la izquierda (8.10).
 */
export function CabezaDeRuta({
  nombre,
  color,
  enVivo,
  sentido,
  nombreDeSentido,
  modo,
  alVolver,
  alCambiarSentido,
  alCambiarModo,
}: {
  nombre: string;
  color: string;
  /** Cuántos camiones del SENTIDO que se ve tienen posición de ahorita. `null` mientras se pregunta. */
  enVivo: number | null;
  sentido: Sentido;
  /** «hacia Centro», o `null` y se dice «Ida» / «Vuelta». */
  nombreDeSentido: (s: Sentido) => string | null;
  modo: "paradas" | "mapa";
  alVolver: () => void;
  alCambiarSentido: (s: Sentido) => void;
  alCambiarModo: (m: "paradas" | "mapa") => void;
}) {
  const texto = textoSobreLaRuta(color).color;
  return (
    <div
      className="ontoy-cabeza-ruta"
      style={{ ["--ruta" as string]: color, ["--texto-cabeza" as string]: texto }}
    >
      <div className="ontoy-cabeza-ruta-fila">
        <button type="button" className="ontoy-cabeza-ruta-volver" onClick={alVolver} aria-label="Volver al mapa">
          ‹
        </button>
        <h2 className="ontoy-cabeza-ruta-nombre">{nombre}</h2>
        {enVivo !== null && (
          <span className="ontoy-cabeza-ruta-cuantos cifra">
            {enVivo === 0 ? "sin camiones en vivo" : enVivo === 1 ? "1 camión en vivo" : `${enVivo} camiones en vivo`}
          </span>
        )}
      </div>
      <div className="ontoy-cabeza-ruta-fila">
        <div className="ontoy-cabeza-ruta-grupo" role="group" aria-label="Sentido de la ruta">
          {(["ida", "vuelta"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={sentido === s} onClick={() => alCambiarSentido(s)}>
              {s === "ida" ? "→" : "←"} {nombreDeSentido(s) ?? (s === "ida" ? "Ida" : "Vuelta")}
            </button>
          ))}
        </div>
        <div className="ontoy-cabeza-ruta-grupo ontoy-cabeza-ruta-modo" role="group" aria-label="Ver como">
          {(["paradas", "mapa"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => alCambiarModo(m)}>
              {m === "paradas" ? "Paradas" : "Mapa"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
