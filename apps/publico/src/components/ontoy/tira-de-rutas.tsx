"use client";

import type { RutaOrdenada } from "@/lib/ontoy/rutas-cerca";

/**
 * **La tira de rutas del Mapa** (8.8; ASAV, 22-sep-2026).
 *
 * Un chip por ruta, abajo, deslizable de lado. Tocarlo la prende o la apaga en
 * el mapa. Al final, «+N rutas más» abre el panel de las lejanas.
 *
 * ## Apagado no se dice sólo con color
 *
 * Un chip apagado cambia **tres cosas a la vez**: se atenúa, su punto de color
 * se vuelve gris, y su `aria-pressed` pasa a `false`. El color de ruta es
 * identidad, nunca estado (8.8c), así que no puede ser lo único que distinga
 * prendida de apagada — quien no distingue esos dos colores necesita la forma
 * y el texto.
 *
 * Y el rótulo del chip dice qué va a pasar al tocarlo, no sólo cómo está: «X:
 * se ve en el mapa; tocar para ocultar».
 */
export function TiraDeRutas({
  tira,
  prendidas,
  cuantasMas,
  alAlternar,
  alAbrirPanel,
}: {
  tira: RutaOrdenada[];
  prendidas: ReadonlySet<string>;
  /** Cuántas quedan fuera de la tira. Cero esconde el chip del panel. */
  cuantasMas: number;
  alAlternar: (circuitoId: string) => void;
  alAbrirPanel: () => void;
}) {
  if (tira.length === 0) return null;

  return (
    <div className="ontoy-tira-marco">
      <div className="ontoy-tira" role="group" aria-label="Rutas que se ven en el mapa">
        {tira.map(({ ruta: r }) => {
          const prendida = prendidas.has(r.circuito_id);
          return (
            <button
              key={r.circuito_id}
              type="button"
              className={`ontoy-chip${prendida ? "" : " apagado"}`}
              style={{ ["--ruta" as string]: r.color_hex }}
              aria-pressed={prendida}
              aria-label={`${r.nombre}: ${prendida ? "se ve en el mapa; tocar para ocultar" : "oculta; tocar para verla"}`}
              onClick={() => alAlternar(r.circuito_id)}
            >
              <span className="ontoy-chip-punto" aria-hidden="true" />
              {r.nombre}
            </button>
          );
        })}
        {cuantasMas > 0 && (
          <button type="button" className="ontoy-chip ontoy-chip-mas" onClick={alAbrirPanel}>
            + {cuantasMas} {cuantasMas === 1 ? "ruta más" : "rutas más"}
          </button>
        )}
      </div>
    </div>
  );
}
