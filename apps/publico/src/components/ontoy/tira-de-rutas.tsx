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
 *
 * ## El ojo, que es la cuarta cosa
 *
 * Atenuar es una señal débil: un chip apagado se lee tan fácil como «oculta»
 * como «deshabilitada», y son cosas distintas —una la apagó el pasajero y la
 * puede prender; la otra no se puede tocar—. El ojo lo dice sin ambigüedad:
 * **abierto se ve, cerrado no**.
 *
 * Va dibujado con **la misma mirada de los personajes** —blanco con pupila
 * carbón, y cerrado es el mismo arco de Tino dormido—, que es lo que el
 * `Auditoria Iconos.md` del #562 pide («ojo del universo»). **No venía en el
 * paquete de símbolos**: está marcado «Generar», así que se arma aquí con esa
 * construcción, igual que las poses de Ontoy que tampoco venían.
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
              <Ojo abierto={prendida} />
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

/**
 * **El ojo de la tira**: abierto se ve, cerrado no.
 *
 * Misma construcción que la mirada de los personajes (handoff §1c): blanco con
 * pupila carbón, y cerrado es el mismo arco con el que duermen Tino y Ontoy.
 * Así el pasajero no tiene que aprender un símbolo nuevo — ya sabe leer esos
 * ojos en toda la app.
 *
 * `aria-hidden`: lo que el estado significa ya lo dice el `aria-label` del chip,
 * con todas sus letras y diciendo además qué pasa al tocarlo. Un rótulo más
 * aquí lo repetiría.
 */
function Ojo({ abierto }: { abierto: boolean }) {
  return (
    <svg className="ontoy-chip-ojo" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      {abierto ? (
        /*
         * **La almendra va dibujada, no insinuada con una mancha.** La primera
         * versión ponía una elipse rellena al 18 %: de día se leía como ojo y
         * **de noche se leía como un punto de grabar** — con la tinta clara, lo
         * que dominaba era el círculo blanco de adentro. Lo enseñó la captura
         * de noche, no la de día.
         *
         * Con el contorno, la forma de ojo se lee en las dos pieles.
         */
        <>
          <path
            d="M1.6 10q8.4-6.6 16.8 0-8.4 6.6-16.8 0z"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2.9" fill="#2A2E37" />
        </>
      ) : (
        /* Cerrado: el arco de dormir, con su pestaña. Sin pupila — no mira. */
        <>
          <path d="M2.4 8.6q7.6 6.4 15.2 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M5.2 12.4 4 14.4M10 13.6V16M14.8 12.4 16 14.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
